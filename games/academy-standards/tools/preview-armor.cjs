'use strict';
// Exercise the actual troop renderer in Canvas2D, including measured frame anchors.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const {decodePNG}=require('./build-armor-metadata.cjs');
const base=path.join(__dirname,'..');
const ids=['player','mars','minerva','diana','apollo','juno','neptune','vulcan','venus','saturn'];
const names=['Augustus','Mars','Minerva','Diana','Apollo','Juno','Neptune','Vulcan','Venus','Saturn'];
const specs=[];
for(const role of ['Sword','Spear','Medic'])for(const tier of ['Light','Heavy','Champion'])specs.push({role,tier});
specs.push({role:'Archer',tier:'None'},{role:'Horseman',tier:'None'});
async function main(){
 const output=path.resolve(process.argv[2]||path.join(base,'preview'));fs.mkdirSync(output,{recursive:true});
 const scope={window:{},document:{createElement:()=>createCanvas(1,1)},Math,Map,WeakMap};
 for(const file of ['assets.js','armor-troops.js'])vm.runInNewContext(fs.readFileSync(path.join(base,file),'utf8'),scope);
 const images=new Map();
 const load=async file=>{if(!images.has(file))images.set(file,await loadImage(decodePNG(fs.readFileSync(path.join(base,file)))));return images.get(file);};
 const assets=scope.window.AcademyAssets,armor=scope.window.AcademyArmorTroops;
 for(const id of ids)assets.factions[id]=await load(assets.factions[id]);
 for(const key of Object.keys(armor.sheets))armor.sheets[key]=await load(armor.sheets[key]);
 let source=fs.readFileSync(path.join(base,'renderer.js'),'utf8').replace('  function rasterSoldier(', '  window.AcademyDrawTroop=rasterSoldier;\n  function rasterSoldier(');
 vm.runInNewContext(source,scope);
 const canvas=createCanvas(1450,1200),c=canvas.getContext('2d');
 const api={getHouse:id=>({id,color:'#b6c7ab'}),objectiveBuffsFor:()=>({})};
 function render(time){
  c.fillStyle='#18352d';c.fillRect(0,0,canvas.width,canvas.height);c.fillStyle='#f3dfb1';c.font='bold 28px Georgia';c.fillText('ACADEMY STANDARDS · ANIMATED ARMOR',32,43);
  c.font='15px sans-serif';c.fillStyle='#c9d9c3';c.fillText('Light · Heavy · Champion for every house. One archer and one horseman per house.',32,72);
  for(let i=0;i<specs.length;i++){const s=specs[i],x=173+i*115;c.textAlign='center';c.font='13px sans-serif';c.fillStyle='#e8d4a5';c.fillText(s.role,x,109);c.font='11px sans-serif';c.fillStyle='#a8bfa7';c.fillText(s.tier==='None'?'Single design':s.tier,x,127);}
  for(let i=0;i<ids.length;i++){
   const y=202+i*98;c.fillStyle=i%2?'#203f33':'#294737';c.fillRect(20,y-58,1410,92);c.textAlign='left';c.fillStyle='#eee0bc';c.font='bold 16px Georgia';c.fillText(names[i],35,y-6);
   for(let j=0;j<specs.length;j++){
    const spec=specs[j],s={id:'proof_'+ids[i]+'_'+j,origHouse:ids[i],controller:ids[i],x:173+j*115,y:y+12,armor:spec.tier==='Champion'?'Champion_'+ids[i]:spec.tier,weapon:spec.role==='Archer'?'Bow':spec.role==='Spear'?'Spear':'Sword',item:spec.role==='Medic'?'Medkit':'None',mount:spec.role==='Horseman',hp:100,maxHp:100,state:'move',facingDir:'right',path:[],pathIndex:0,attackAction:null,burnUntil:0};
    const phase=Math.floor(time*3)%4;if(phase===1)s.facingDir='up';if(phase===2)s.attackAction={phase:'windup',progress:.6};if(phase===3)s.attackAction={phase:'recovery',progress:.45};
    scope.window.AcademyDrawTroop(c,s,{time,selected:new Set(),students:[],lootBoxes:[],barricades:[]},api);
   }
  }
 }
 render(.2);fs.writeFileSync(path.join(output,'Academy-armor-all-houses.png'),canvas.toBuffer('image/png'));
 const frameDir=path.resolve(process.argv[3]||path.join(output,'animation-frames'));fs.mkdirSync(frameDir,{recursive:true});
 for(let i=0;i<24;i++){render(i/12);fs.writeFileSync(path.join(frameDir,`${String(i).padStart(2,'0')}.png`),canvas.toBuffer('image/png'));}
 console.log('Rendered all-house comparison and 24 actual animation frames.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
