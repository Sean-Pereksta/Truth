/** Bundle the current game into one offline, double-clickable HTML document. */
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');

const project=path.resolve(__dirname,'..','..');
const dist=project;
const outputArgument=process.argv.find(arg=>arg.startsWith('--output='));
const output=outputArgument?path.resolve(outputArgument.slice('--output='.length)):path.join(project,'pacman-blackout.html');
const read=name=>fs.readFileSync(path.join(dist,name),'utf8');
const coreNames=['units','terrain','buildings'];
const bannerNames=['pac-banner','ghost-banner'];
const hasAsset=name=>fs.existsSync(path.join(dist,'assets',name+'.png'));
if(bannerNames.some(hasAsset))assert.ok(bannerNames.every(hasAsset),'Both faction banners must be present before packaging');
const names=[...coreNames,...bannerNames.filter(hasAsset)];
const assets={};
for(const name of names){
  const bytes=fs.readFileSync(path.join(dist,'assets',name+'.png'));
  assert.equal(bytes.subarray(1,4).toString(),'PNG',`${name} must be a real PNG atlas`);
  assets[name]='data:image/png;base64,'+bytes.toString('base64');
}

function moduleBody(name){
  let source=read(name).replace(/^\s*import\s+[^\r\n]+;\s*$/gm,'');
  source=source.replace(/^\s*export\s+(?=(?:const|let|var|class|function)\b)/gm,'');
  assert.ok(!/^\s*(?:import|export)\b/m.test(source),`${name} has unsupported module syntax`);
  return source;
}

let html=read('index.html');
let stylesheets=0;
html=html.replace(/<link\b(?=[^>]*\brel=["']stylesheet["'])[^>]*>/gi,tag=>{
  const file=tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
  assert.ok(file&&!/^(?:https?:|\/\/|data:)/i.test(file),'Stylesheets must be local');
  let css=read(file);
  css=css.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi,(whole,quote,url)=>{
    if(/^data:|^#/i.test(url))return whole;
    const match=url.match(/^(?:\.\/)?assets\/([a-z0-9-]+)\.png$/i);
    assert.ok(match&&Object.hasOwn(assets,match[1]),`Unbundled CSS resource: ${url}`);
    return `var(--blackout-asset-${match[1]})`;
  });
  assert.ok(!/<\/style/i.test(css));
  stylesheets++;
  return `<style data-offline-style="${file}">\n${css}\n</style>`;
});
assert.ok(stylesheets>=3,'All current game stylesheets must be included');

const engine=moduleBody('engine.js');
const ai=moduleBody('ai.js');
let render=moduleBody('render.js');
const imageLoader='new URL(path, import.meta.url).href';
assert.equal(render.split(imageLoader).length-1,1,'Renderer asset loader changed; review the bundler');
render=render.replace(imageLoader,'__BLACKOUT_ASSETS[path]');
for(const name of coreNames){
  const call=`loadImage('./assets/${name}.png')`;
  assert.ok(render.includes(call),`Missing ${name} renderer load`);
  render=render.replaceAll(call,`loadImage('${name}')`);
}
let main=moduleBody('main.js');
const portraitExpression=`'url("assets/'+(isBuilding?'buildings':'units')+'.png")'`;
assert.equal(main.split(portraitExpression).length-1,1,'Dynamic portrait loader changed; review the bundler');
main=main.replace(portraitExpression,`'var(--blackout-asset-'+(isBuilding?'buildings':'units')+')'`);
const resultExpression=`'url("assets/'+(citadelVictory?'buildings':'units')+'.png")'`;
assert.equal(main.split(resultExpression).length-1,1,'Dynamic Citadel result art changed; review the bundler');
main=main.replace(resultExpression,`'var(--blackout-asset-'+(citadelVictory?'buildings':'units')+')'`);

const runtime=`'use strict';
// Embed each PNG once, then share short, local Blob URLs. Large data URLs in
// custom properties can exceed CSS substitution limits and silently hide art.
const __BLACKOUT_EMBEDDED_IMAGES=${JSON.stringify(assets)};
const __BLACKOUT_ASSETS=Object.create(null);
for(const [name,dataURL]of Object.entries(__BLACKOUT_EMBEDDED_IMAGES)){
  const encoded=dataURL.slice(dataURL.indexOf(',')+1),binary=atob(encoded),bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  __BLACKOUT_ASSETS[name]=URL.createObjectURL(new Blob([bytes],{type:'image/png'}));
}
for(const [name,url]of Object.entries(__BLACKOUT_ASSETS))document.documentElement.style.setProperty('--blackout-asset-'+name,'url("'+url+'")');
const __BlackoutEngine=(()=>{
${engine}
return{Game,UNIT_DEFS,BUILDING_DEFS,DIFFICULTIES,TEAM_DEFS,PAC_TEAMS,GHOST_BOUNTIES};
})();
const __BlackoutAI=(({UNIT_DEFS,BUILDING_DEFS})=>{
${ai}
return{AIController};
})(__BlackoutEngine);
const __BlackoutRenderer=(({UNIT_DEFS,BUILDING_DEFS})=>{
${render}
return{Renderer,BUILDING_SPRITES};
})(__BlackoutEngine);
(()=>{
const{Game,UNIT_DEFS,BUILDING_DEFS,DIFFICULTIES,TEAM_DEFS,PAC_TEAMS}=__BlackoutEngine;
const{AIController}=__BlackoutAI;
const{Renderer}=__BlackoutRenderer;
${main}
})();
`;

// A classic script avoids file:// module/CORS restrictions in offline browsers.
new vm.Script(runtime,{filename:'pacman-blackout.offline.js'});
assert.ok(!/\bimport\s*(?:\(|\{|\*|['"]|\.)|^\s*export\b/m.test(runtime),'The offline runtime must not import anything');
assert.ok(!/\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/.test(runtime),'The game must not request network resources');
assert.ok(!/assets\/[a-z0-9-]+\.png/i.test(runtime),'All canvas and dynamic portrait references must be embedded');

let scripts=0;
html=html.replace(/<script\b[^>]*\bsrc=["']main\.js["'][^>]*>\s*<\/script>/gi,()=>{
  scripts++;
  return '<script data-offline-game>\n'+runtime.replace(/<\/script/gi,'<\\/script')+'\n</script>';
});
assert.equal(scripts,1,'The entry script must be replaced once');
assert.ok(!/<script\b[^>]*\bsrc=|<link\b[^>]*\brel=["']stylesheet["']|\bimport\.meta\b/i.test(html),'No external script, stylesheet or module references may remain');
assert.ok(!/url\(\s*["']?(?:https?:|\/\/|assets\/|\.\/assets\/)/i.test(html),'No external CSS artwork references may remain');
assert.ok(!/\bsrc=["'](?:https?:|\/\/|assets\/|\.\/assets\/)/i.test(html),'No external HTML artwork references may remain');

// Confirm that the embedded payload is byte-identical to the final PNGs.
for(const name of names){
  const decoded=Buffer.from(assets[name].split(',')[1],'base64');
  assert.deepEqual(decoded,fs.readFileSync(path.join(dist,'assets',name+'.png')));
}
const temporary=output+'.building';
fs.writeFileSync(temporary,html,'utf8');
fs.renameSync(temporary,output);
const sourceHashes=Object.fromEntries(['engine.js','ai.js','render.js','main.js','index.html'].map(file=>[file,crypto.createHash('sha256').update(read(file)).digest('hex')]));
const receiptName=outputArgument?'offline-draft-build-receipt.json':'offline-build-receipt.json';
fs.writeFileSync(path.join(__dirname,receiptName),JSON.stringify({output,bytes:Buffer.byteLength(html),stylesheets,embeddedAtlases:names,assetURLs:'local-blob',sourceHashes},null,2));
console.log(JSON.stringify({output,bytes:Buffer.byteLength(html),megabytes:(Buffer.byteLength(html)/1024/1024).toFixed(2),stylesheets,embeddedAtlases:names,assetURLs:'local-blob',syntax:'passed',externalReferences:'none',latestSummonShortcut:main.includes("key==='t'"),dragIntersection:main.includes('unitsInBox')},null,2));
