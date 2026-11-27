import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const dist=path.resolve(root,'..');
const out=process.argv[2]?path.resolve(process.argv[2]):path.join(root,'outputs');
fs.mkdirSync(out,{recursive:true});
const read=name=>fs.readFileSync(path.join(dist,name),'utf8');
const embeddedFiles=new Set();
function imageData(name){
  const relative=name.replace(/^\.\//,'');
  const absolute=path.resolve(dist,relative);
  if(!absolute.startsWith(dist+path.sep))throw new Error('Asset outside game: '+name);
  embeddedFiles.add(relative);
  const mime=relative.endsWith('.ico')?'image/x-icon':relative.endsWith('.webp')?'image/webp':relative.endsWith('.svg')?'image/svg+xml':'image/png';
  return 'data:'+mime+';base64,'+fs.readFileSync(absolute).toString('base64');
}
function embedImageLiterals(code){
  return code.replace(/(['"])(\.?\/?assets\/[A-Za-z0-9_./-]+\.(?:png|webp|svg))\1/g,(_,quote,name)=>JSON.stringify(imageData(name)));
}

// Follow the actual local import graph, so a new combat or artwork module
// cannot silently disappear from the downloadable game.
const modules=new Map(),visiting=new Set();
const importPattern=/^import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"];?\s*$/gm;
function collect(name){
  name=path.posix.normalize(name);
  if(modules.has(name))return;
  if(visiting.has(name))throw new Error('Standalone module cycle: '+name);
  visiting.add(name);
  const code=read(name),imports=[];
  for(const match of code.matchAll(importPattern)){
    const specifier=match[2];
    if(!specifier.startsWith('.'))throw new Error('Non-local standalone import: '+specifier);
    const dependency=path.posix.normalize(path.posix.join(path.posix.dirname(name),specifier));
    imports.push({clause:match[1].trim(),dependency});collect(dependency);
  }
  const exports=[...code.matchAll(/^export\s+(?:async\s+)?(?:const|let|class|function)\s+(\w+)/gm)].map(match=>match[1]);
  modules.set(name,{code,imports,exports});visiting.delete(name);
}
collect('app.js');

const {HOUSES}=await import('../core.js');
const {HERO_PROFILES}=await import('../heroes.js');
const replacements={HOUSE_ART_SOURCES:{troops:Object.fromEntries(HOUSES.map(h=>[h.sigil,imageData(`assets/houses/${h.sigil}-troops.png`)])),castles:imageData('assets/house-castles.png'),production:imageData('assets/house-production.png')}};
replacements.HERO_ART_SOURCES=Object.fromEntries(Object.values(HERO_PROFILES).map(p=>[p.sigil,imageData(p.artwork)]));
const paintedModule=path.join(dist,'painted-troops.js');
if(fs.existsSync(paintedModule)){
  const {PAINTED_TROOPS}=await import(pathToFileURL(paintedModule));
  replacements.PAINTED_TROOP_SOURCES=Object.fromEntries(Object.entries(PAINTED_TROOPS).map(([id,definition])=>[id,imageData(definition.file)]));
}
const ids=new Map([...modules.keys()].map((name,index)=>[name,'m'+index]));
function importBinding({clause,dependency}){
  const reference='__modules.'+ids.get(dependency);
  if(clause.startsWith('{')){
    const fields=clause.slice(1,-1).split(',').map(field=>field.trim().replace(/\s+as\s+/,':')).filter(Boolean).join(',');
    return `const {${fields}}=${reference};`;
  }
  if(clause.startsWith('* as '))return `const ${clause.slice(5).trim()}=${reference};`;
  throw new Error('Unsupported standalone import binding: '+clause);
}
const compiled=[];
for(const [name,module]of modules){
  let code=module.code.replace(importPattern,'').replace(/^export\s+(?=(?:async\s+)?(?:const|let|class|function)\s)/gm,'');
  if(name==='app.js')for(const [constant,value]of Object.entries(replacements)){
    const pattern=new RegExp('^const '+constant+'=.*?;\\r?\\n','m');
    if(!pattern.test(code))throw new Error('Missing standalone asset constant: '+constant);
    code=code.replace(pattern,'const '+constant+'='+JSON.stringify(value)+';\n');
  }
  // The app passes embedded sources to all loaders. Keep module defaults and
  // provenance filenames readable instead of duplicating every large atlas.
  if(name==='app.js'||name==='directional-sheets.js')code=embedImageLiterals(code);
  if(/^\s*(?:import|export)\s/m.test(code))throw new Error('Unsupported module syntax in '+name);
  const imports=module.imports.map(importBinding).join('\n');
  const asyncEntry=name==='app.js';
  compiled.push(`// ${name}\n__modules.${ids.get(name)}=${asyncEntry?'await (async':'('}()=>{\n${imports}\n${code}\nreturn {${module.exports.join(',')}};\n})();`);
}

const assetURL=/url\(\s*['"]?(?:\.{1,2}\/)?(assets\/[\w./-]+\.(?:png|webp|svg))['"]?\s*\)/g;
const css=[read('style.css'),read('hud.css'),read('multiplayer/lobby.css')].join('\n')
  .replace(assetURL,(_,name)=>'url("'+imageData(name)+'")');
const script=('const __modules=Object.create(null);\n'+compiled.join('\n')).replaceAll('</script','<\\/script');
const html=read('index.html')
  .replace(/<script\b[^>]*src="\/Truth\/hub\/play-signal\.mjs"[^>]*><\/script>\s*/,'')
  .replace(/\bsrc="(assets\/[\w./-]+\.(?:png|webp|svg))"/g,(_,name)=>'src="'+imageData(name)+'"')
  .replace('<body>','<body data-standalone="true">')
  .replace('<link rel="stylesheet" href="style.css">',()=>`<style>${css}</style>`)
  .replace('<link rel="stylesheet" href="hud.css">','')
  .replace('<link rel="stylesheet" href="multiplayer/lobby.css">','')
  .replace('href="assets/bannerlands.ico"',()=>`href="${imageData('assets/bannerlands.ico')}"`)
  .replace('<script type="module" src="app.js"></script>',()=>`<script type="module">\n${script}\n</script>`);
if(html.includes('<script type="module" src="app.js">'))throw new Error('Standalone entry was not replaced.');
fs.writeFileSync(path.join(out,'Bannerlands.html'),html);
fs.writeFileSync(path.join(out,'standalone-build.json'),JSON.stringify({modules:[...modules.keys()],embeddedImages:[...embeddedFiles].sort(),bytes:Buffer.byteLength(html)},null,2));
for(const [source,target]of [['assets/troops-atlas.png','Troops-sprite-sheet.png'],['assets/structures-atlas.png','Structures-sprite-sheet.png'],['assets/campaign-structures.png','Campaign-structures-sprite-sheet.png'],['assets/ground-textures.png','Ground-textures.png'],['assets/terrain-props.png','Terrain-sprite-sheet.png']])fs.copyFileSync(path.join(dist,source),path.join(out,target));
console.log(`Built self-contained Bannerlands.html: ${modules.size} modules and ${embeddedFiles.size} embedded images.`);
