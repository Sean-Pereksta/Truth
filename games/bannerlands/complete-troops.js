// Complete vector animation cels. Each cache entry is drawn on a clean, transparent
// surface: body, hands and equipment are one authored cel, never patches on a PNG.
// The explicit pose table is shared by all detail levels. Only cadence may vary.
import {equipmentFor,poseForUnit} from './equipment.js';

export const TROOP_CELL={width:224,height:224,anchorX:112,anchorY:144,bodyHeight:31};
export const TROOP_ACTIONS=['ready','march','backward','advance','turn','lower','brace','thrust','recovery','hit','death','aiming','release','span','take_bolt','seat_bolt','raise','support','guard','block','attack'];
// Sixteen authored body views, proceeding clockwise in world space. Torso
// breadth, shoulder depth, cheek and visible breastplate differ by view; these
// are complete front/rear/quarter cels rather than a mirrored sideways body.
export const AUTHORED_BODY_VIEWS=Object.freeze([
 {width:.76,depth:-1.8,cheek:1.7,front:.8},{width:.9,depth:-1,cheek:1,front:1},
 {width:1,depth:0,cheek:0,front:1},{width:.9,depth:1,cheek:-1,front:1},
 {width:.76,depth:1.8,cheek:-1.7,front:.8},{width:.61,depth:2.3,cheek:-2,front:.5},
 {width:.55,depth:2.5,cheek:-2.1,front:0},{width:.61,depth:2.3,cheek:-1.8,front:-.5},
 {width:.76,depth:1.8,cheek:-1.3,front:-.8},{width:.9,depth:1,cheek:-.7,front:-1},
 {width:1,depth:0,cheek:0,front:-1},{width:.9,depth:-1,cheek:.7,front:-1},
 {width:.76,depth:-1.8,cheek:1.3,front:-.8},{width:.61,depth:-2.3,cheek:1.8,front:-.5},
 {width:.55,depth:-2.5,cheek:2.1,front:0},{width:.61,depth:-2.3,cheek:2,front:.5}
]);
export const AUTHORED_TROOP_POSES=Object.freeze({
 ready:{drop:0,lean:0,stride:0,grip:0,weapon:1},
 march:{drop:0,lean:.4,stride:3,grip:0,weapon:0},
 backward:{drop:1,lean:-.8,stride:-2.7,grip:0,weapon:1},
 advance:{drop:1,lean:1.1,stride:2.7,grip:0,weapon:1},
 turn:{drop:.5,lean:.8,stride:1.4,grip:0,weapon:.72},
 lower:{drop:1.4,lean:1.1,stride:1,grip:0,weapon:.5},
 brace:{drop:2,lean:1.4,stride:2.3,grip:0,weapon:1},
 thrust:{drop:1.7,lean:3.1,stride:2.7,grip:6,weapon:1},
 recovery:{drop:1.4,lean:1.5,stride:2.3,grip:2,weapon:1},
 hit:{drop:2.6,lean:-3.3,stride:2,grip:-2,weapon:.68},
 death:{drop:4,lean:-5,stride:3,grip:0,weapon:1},
 aiming:{drop:1,lean:1.7,stride:1.5,grip:1,weapon:1},
 release:{drop:1.2,lean:.6,stride:1.5,grip:0,weapon:1},
 span:{drop:5,lean:4,stride:3.7,grip:-1,weapon:.1},
 take_bolt:{drop:3,lean:2,stride:2.8,grip:-1,weapon:.3},
 seat_bolt:{drop:3.2,lean:2.6,stride:2.8,grip:0,weapon:.3},
 raise:{drop:1.8,lean:1.8,stride:2,grip:0,weapon:.7},
 support:{drop:3.5,lean:3,stride:2.7,grip:0,weapon:0},
 guard:{drop:1,lean:.6,stride:1.5,grip:0,weapon:1},
 block:{drop:1.7,lean:-1.2,stride:1.7,grip:-1,weapon:1},
 attack:{drop:1,lean:1.8,stride:2,grip:0,weapon:1}
});

const PALETTES={
 river_ranger:{cloth:'#376c9d',dark:'#1c3651',panel:'#af343b',steel:'#829ca8',trim:'#c4b694',skin:'#b98d69',cloak:'ranger',head:'hood',bow:'compact',satchel:true},
 sharpshooter:{cloth:'#345477',dark:'#182e42',panel:'#922c40',steel:'#aebfc8',trim:'#d5c39b',skin:'#b8906b',head:'close',crossbow:'windlass',heavy:true,case:true},
 hill_huntsman:{cloth:'#426d38',dark:'#273d25',panel:'#ae3633',steel:'#7d8975',trim:'#bead71',skin:'#bd946f',head:'peaked',cloak:'mantle',bow:'long',quiver:true},
 tollhouse_crossbow:{cloth:'#71858d',dark:'#34454f',panel:'#c3c5b2',steel:'#a9b5b4',trim:'#dfd5aa',skin:'#b38d6e',head:'flat',cloak:'square',crossbow:'lever',heavy:true,case:true,towers:true},
 hornhill_halberdier:{cloth:'#3f713b',dark:'#223e29',panel:'#a63132',steel:'#bbc4b6',trim:'#ddc078',skin:'#bb936f',head:'close',heavy:true,halberd:true},
 vale_sentinel:{cloth:'#d8e3e5',dark:'#274a70',panel:'#577eaf',steel:'#d1dee0',trim:'#e9dcaf',skin:'#ba9476',head:'falcon',cloak:'narrow',crossbow:'compact',case:true,kneeling:true},
 winter_pikeman:{cloth:'#4a5b69',dark:'#26363e',panel:'#929e9f',steel:'#a4afb0',trim:'#b6a987',skin:'#ad8c70',head:'northern',fur:true,heavy:true,pike:true},
 thornwall_pikeman:{cloth:'#3d743b',dark:'#24412b',panel:'#c3a445',steel:'#b7c4a5',trim:'#e0c568',skin:'#b28e6c',head:'crest',heavy:true,pike:true},
 bridge_warden:{cloth:'#728691',dark:'#374b57',panel:'#c6c8b2',steel:'#b7c1bb',trim:'#c3b88b',skin:'#b38d6d',head:'flat',heavy:true,towers:true},
 dread_pike:{cloth:'#8b4050',dark:'#3d2530',panel:'#c28b8b',steel:'#a7a7a3',trim:'#a99c8a',skin:'#b08c73',head:'close',heavy:true,pike:true},
 crannog_spearhand:{cloth:'#788444',dark:'#334729',panel:'#b49d50',steel:'#8eaa98',trim:'#b6ae7e',skin:'#b18b61',head:'hood',cloak:'ranger'},
 gilded_crossbow:{cloth:'#a33736',dark:'#512a2b',panel:'#cdb04c',steel:'#b1b5a4',trim:'#edce6c',skin:'#bc9470',head:'close',crossbow:'belt',case:true},
 dune_skirmisher:{cloth:'#c58d4b',dark:'#70512d',panel:'#d3b561',steel:'#c9c1a0',trim:'#e8d3a1',skin:'#a77e5c',head:'wrap',javelin:true},
 winter_guard:{cloth:'#526774',dark:'#263a45',panel:'#b0bdbe',steel:'#c2cbd0',trim:'#d4c8a1',skin:'#b08a6a',head:'northern',fur:true,heavy:true}
};
const MOUNTED=new Set(['cavalry','lance_champion','storm_rider','thorn_lancer','sun_horse_archer']);
const BOWS=new Set(['archer','river_ranger','hill_huntsman','crannog_hunter','sun_horse_archer']);
const POLEARMS=new Set(['winter_pikeman','thornwall_pikeman','bridge_warden','dread_pike','crannog_spearhand','hornhill_halberdier']);
const NONHUMAN=new Set(['siege','trebuchet','giant','beacon_engineer']);
export const COMPLETE_TROOP_TYPES=Object.freeze(['infantry','archer','cavalry','hero','winter_guard','gilded_crossbow','dragonfire_acolyte','storm_rider','thorn_lancer','dune_skirmisher','ironborn_reaver','vale_sentinel','dread_pike','bridge_warden','bear_mauler','river_ranger','crannog_hunter','hill_huntsman','freefolk_berserker','shield_bearer','lance_champion','winter_pikeman','thornwall_pikeman','sharpshooter','stormbreaker','saltwind_axethrower','tollhouse_crossbow','crannog_spearhand','hornhill_halberdier','sun_horse_archer']);
export const hasCompleteTroopArt=type=>COMPLETE_TROOP_TYPES.includes(type)&&!NONHUMAN.has(type);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const iso=(x,y)=>({x:(x-y)*28,y:(x+y)*14});
const frames=new Map();
const path=(c,points,fill,stroke='#1c292b',width=.8)=>{c.beginPath();c.moveTo(...points[0]);for(let i=1;i<points.length;i++)c.lineTo(...points[i]);c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}};
const line=(c,points,color,width=1)=>{c.beginPath();c.moveTo(...points[0]);for(let i=1;i<points.length;i++)c.lineTo(...points[i]);c.strokeStyle=color;c.lineWidth=width;c.stroke();};
const oval=(c,x,y,rx,ry,color,rotation=0)=>{c.beginPath();c.ellipse(x,y,rx,ry,rotation,0,Math.PI*2);c.fillStyle=color;c.fill();};
const hand=(c,p,skin)=>{oval(c,p.x,p.y,1.45,1.25,skin);};
function profileFor(type,team={}){
 const own=PALETTES[type];if(own)return own;
 const p={cloth:team.color||'#8c9ca3',dark:team.dark||'#34484c',panel:team.color||'#8c9ca3',steel:'#a4b4b4',trim:'#d3bf84',skin:'#b18c6a',head:'close'};
 if(BOWS.has(type)){p.head=type==='crannog_hunter'?'hood':'cap';p.bow='long';p.quiver=true;}
 if(type==='shield_bearer'){p.heavy=true;p.head=team.sigil==='dragon'?'dragon':'close';p.panel=team.sigil==='dragon'?'#624b6b':'#ac3032';p.cloth=team.sigil==='dragon'?'#35303d':'#a23431';p.trim=team.sigil==='dragon'?'#bc8497':'#e0bd64';}
 if(type==='thorn_lancer'){p.cloth='#457641';p.panel='#c6b04f';p.head='crest';}
 if(type==='storm_rider'){p.cloth='#c2a245';p.panel='#2c3439';p.head='antler';}
 if(type==='stormbreaker'||type==='bear_mauler'){p.heavy=true;p.fur=true;}
 if(type==='ironborn_reaver'){p.head='cap';p.cloth='#377c75';}
 return p;
}
export function authoredAnimationState(u,g,definition={}){
 const equipment=equipmentFor(u.type),pose=poseForUnit(u),speed=Math.hypot(u.motionVX??u.vx??0,u.motionVY??u.vy??0);
 let action=pose.action||'ready',phase=0;
 const event=u.attackVisual,age=event?(g.time||0)-event.at:Infinity;
 if(u.hp<=0){action='death';phase=clamp(((g.time??g.aftermath?.time??0)-(u.bornAt??-.45))/.45,0,1);}
 else if(u.hitVisual&&g.time-u.hitVisual.at<.18){action=u.hitVisual.blocked?'block':'hit';phase=clamp((g.time-u.hitVisual.at)/.18,0,1);}
 else if((u.releaseFrame||0)>0){action='release';phase=1-clamp(u.releaseFrame/.1,0,1);}
 else if(u.reloading&&u.reload){
   const stage=u.reload.stage;action=stage||crossbowStage((u.reload.progress||0)/(u.reload.duration||1));
   phase=stage?clamp((u.reload.stageProgress||0)/(u.reload.stageDuration||1),0,1):clamp((u.reload.progress||0)/(u.reload.duration||1),0,1);
 }else if(u.pendingShot){action='aiming';phase=clamp((u.pendingShot.aimProgress||0)/(u.pendingShot.aimDuration||(definition.crossbow?.24:.2)),0,1);}
 else if(age>=0&&age<.34){action=equipment.reloadStyle||definition.crossbow||BOWS.has(u.type)||equipment.kind==='javelin'||u.type==='saltwind_axethrower'?age<.1?'release':'recovery':POLEARMS.has(u.type)||MOUNTED.has(u.type)?age<.16?'thrust':'recovery':'attack';phase=clamp(age/.34,0,1);}
 else if((u.supportUntil||0)>g.time){action='support';phase=1-clamp((u.supportUntil-g.time)/.65,0,1);}
 else if(speed>.07){action=u.backpedaling?'backward':u.order?.mode==='advance'?'advance':'march';phase=((u.phase||0)/(Math.PI*2)%1+1)%1;}
 else if(pose.action==='lower')phase=clamp((u.braceTime||0)/.5,0,1);
 const directions=equipment.directions||((POLEARMS.has(u.type)||MOUNTED.has(u.type))?16:8),directionIndex=Number.isFinite(pose.directionIndex)?pose.directionIndex:((Math.round(Math.atan2(u.facingY||0,u.facingX??1)/(Math.PI*2)*directions)%directions)+directions)%directions;
 const frame=action==='lower'?Math.floor(phase*7):Math.min(7,Math.floor(phase*8)),tipReach=pose.tip?Math.hypot(pose.tip.x-u.x,pose.tip.y-u.y):equipment.reach;
 return {action:AUTHORED_TROOP_POSES[action]?action:'ready',frame,directionIndex,directions,phase,equipment,shieldPresented:pose.shieldPresented,tipReach,isKing:!!u.isKing,loaded:!u.reload,cocked:!u.reload||(u.reload.stageIndex||0)>=2,boltSeated:!u.reload||(u.reload.stageIndex||0)>=4};
}
function crossbowStage(t){return t<.12?'lower':t<.65?'span':t<.76?'take_bolt':t<.9?'seat_bolt':'raise';}

// A cel is complete and immutable after publication. The bounded cache is shared
// across soldiers, including economy graphics; equipment never disappears in LOD.
let frameBytes=0,cacheHits=0,cacheMisses=0;
const MAX_CEL_BYTES=128*1024*1024,MAX_CEL_COUNT=16384;
const ANIMATED_ACTIONS=new Set(['march','backward','advance','lower','span','take_bolt','seat_bolt','raise','support','death','attack']);
function celBounds(type,state){
 const mounted=MOUNTED.has(type),pose=AUTHORED_TROOP_POSES[state.action]||AUTHORED_TROOP_POSES.ready,t=(state.frame||0)/7;
 let left=mounted?-40:-30,right=mounted?40:30,top=mounted?-75:-48,bottom=8;
 const pole=POLEARMS.has(type)||mounted&&type!=='sun_horse_archer';
 if(pole){const eq=state.equipment||equipmentFor(type),angle=state.directionIndex/state.directions*Math.PI*2,reach=state.tipReach??((eq.reach||1.6)+(state.action==='thrust'?.16:state.action==='recovery'?.06:0)),v=iso(Math.cos(angle)*reach,Math.sin(angle)*reach),long=eq.kind==='pike',length=long?83:mounted?69:eq.kind==='halberd'?61:52;
   let presented=pose.weapon;if(state.action==='lower')presented=t;if(state.action==='march')presented=mounted?.65:0;
   const lowered=state.action==='lower'&&Number.isFinite(state.tipReach),x=v.x*(lowered?1:presented),y=-16+pose.drop*(mounted?.4:1)+(mounted?-23:0)+v.y*(lowered?1:presented)-length*(1-presented);
   left=Math.min(left,x-16);right=Math.max(right,x+16);top=Math.min(top,y-16);bottom=Math.max(bottom,y+16);
 }
 if(type==='dune_skirmisher'){left=-55;right=55;top=-66;bottom=28;}
 if(state.action==='death'){
   const angle=state.directionIndex/state.directions*Math.PI*2,screen=iso(Math.cos(angle),Math.sin(angle)),side=screen.x>=0?1:-1,points=[[left,top],[right,top],[right,bottom],[left,bottom]].map(([x,y])=>({x:x-side*.75*t*y-side*(2+6*t),y:.08*t*x+(1-.72*t)*y+4*t}));
   left=Math.min(...points.map(p=>p.x))-4;right=Math.max(...points.map(p=>p.x))+4;top=Math.min(...points.map(p=>p.y))-4;bottom=Math.max(...points.map(p=>p.y))+4;
 }
 return {left:Math.floor(left)-3,top:Math.floor(top)-3,right:Math.ceil(right)+3,bottom:Math.ceil(bottom)+3};
}
export function completeTroopFrame(type,team,state){
 const thrown=type==='dune_skirmisher'||type==='saltwind_axethrower',animated=ANIMATED_ACTIONS.has(state.action)||state.action==='aiming'&&(BOWS.has(type)||thrown)||state.action==='recovery'&&thrown;
 const frame=state.action==='attack'?(state.frame<4?0:7):animated?state.frame:0;
 state={...state,frame};
 const palette=PALETTES[type]?'authored':(team.color||'')+'|'+(team.dark||''),house=type==='shield_bearer'?team.sigil:MOUNTED.has(type)?['sun','rose'].includes(team.sigil)?team.sigil:'mounted':'';
 const loadingKey=equipmentFor(type).reloadStyle?(state.loaded===false?'empty':'loaded')+'|'+(state.cocked===false?'slack':'spanned')+'|'+(state.boltSeated===false?'bare':'bolt'):'';
 const key=[type,palette,house,state.action,state.directionIndex,frame,state.shieldPresented?'guard':'lowered',Number.isFinite(state.tipReach)?Math.round(state.tipReach*1000):'',state.isKing?'king':'',loadingKey].join('|');
 if(frames.has(key)){cacheHits++;const cel=frames.get(key);frames.delete(key);frames.set(key,cel);return cel;}cacheMisses++;
 const bounds=celBounds(type,state),width=bounds.right-bounds.left,height=bounds.bottom-bounds.top,image=document.createElement('canvas');image.width=width;image.height=height;
 const anchorX=-bounds.left,anchorY=-bounds.top,c=image.getContext('2d');c.translate(anchorX,anchorY);c.lineJoin='round';c.lineCap='round';
 paintCompleteCel(c,type,profileFor(type,team),state,team);
 const bytes=width*height*4,result={...TROOP_CELL,image,width,height,anchorX,anchorY,bytes,sourceBounds:{left:bounds.left+TROOP_CELL.anchorX,top:bounds.top+TROOP_CELL.anchorY,right:bounds.right+TROOP_CELL.anchorX,bottom:bounds.bottom+TROOP_CELL.anchorY},action:state.action,directionIndex:state.directionIndex,frame};
 frames.set(key,result);frameBytes+=bytes;
 while(frameBytes>MAX_CEL_BYTES||frames.size>MAX_CEL_COUNT){const oldest=frames.keys().next().value,cel=frames.get(oldest);frameBytes-=cel.bytes;frames.delete(oldest);}
 return result;
}

export function paintCompleteCel(c,type,p,state,team={}){
 const pose=AUTHORED_TROOP_POSES[state.action]||AUTHORED_TROOP_POSES.ready,t=(state.frame||0)/7,angle=(state.directionIndex||0)/(state.directions||16)*Math.PI*2;
 const f={x:Math.cos(angle),y:Math.sin(angle)},project=iso(f.x,f.y),n=Math.hypot(project.x,project.y)||1,dx=project.x/n,dy=project.y/n,view=AUTHORED_BODY_VIEWS[Math.round(angle/(Math.PI*2)*16)%16],back=view.front<0,side=dx>=0?1:-1;
 const mounted=MOUNTED.has(type),kneel=p.kneeling&&['aiming','release','brace','ready'].includes(state.action),walk=['march','backward','advance'].includes(state.action),gait=walk?Math.sin(t*Math.PI*2):0;
 let drop=pose.drop+(kneel?4:0)+(walk?Math.abs(gait)*.7:0),lean=pose.lean*dx;
 if(state.action==='lower')drop=1+t*1.5;
 c.save();
 if(state.action==='death'){drop=4*t;lean=-5*dx*t;c.translate(-side*(2+6*t),0);c.transform(1,.08*t,-side*.75*t,1-.72*t,0,4*t);}
 if(mounted){paintHorse(c,p,dx,dy,gait,team);c.translate(0,-23);drop*=.4;}
 const legY=-10+drop,bodyY=-20+drop,headY=-29+drop,wide=(p.heavy?7.3:5.8)*view.width,shoulderDepth=view.depth;
 const stride=pose.stride*(walk?gait:1),footA={x:-3+side*stride,y:0},footB={x:3-side*stride,y:-1};
 if(p.cloak){
  const cape=p.cloak==='ranger'?[[-5,bodyY-4],[-9-side*2,-5],[1,-3],[3,bodyY+2]]:p.cloak==='narrow'?[[-4,bodyY-3],[-5,-5],[1,-3],[3,bodyY]]:p.cloak==='square'?[[-8,bodyY-5],[-8,bodyY+3],[7,bodyY+3],[7,bodyY-5]]:[[-8,bodyY-3],[-10,bodyY+4],[4,bodyY+2],[5,bodyY-4]];
  path(c,cape,p.dark);line(c,[cape[0],cape[1]],p.trim,.9);
 }
 // Whole legs, pelvis and chest are redrawn for every pose, including reload.
 line(c,[[-2,legY],[footA.x-1,-4],[footA.x,footA.y]],p.dark,3.7);
 line(c,[[2,legY],[footB.x+1,-5],[footB.x,footB.y]],p.dark,3.7);
 line(c,[[footA.x-1,footA.y],[footA.x+side*3,footA.y]],'#3e342c',2.1);line(c,[[footB.x-1,footB.y],[footB.x+side*3,footB.y]],'#3e342c',2.1);
 path(c,[[-wide,bodyY-3-shoulderDepth],[wide,bodyY-3+shoulderDepth],[3.5*view.width+lean,legY+1],[-3.5*view.width+lean,legY+1]],p.cloth);
 const panelWidth=Math.max(1,wide*Math.abs(view.front));
 path(c,[[view.cheek-panelWidth,bodyY-3],[view.cheek+panelWidth*.45,bodyY-3],[lean+panelWidth*.45,legY],[lean-panelWidth*.65,legY]],back?p.dark:p.panel,null);
 if(p.heavy){path(c,[[-wide+.5,bodyY-3-shoulderDepth],[wide-.5,bodyY-3+shoulderDepth],[wide*.7+lean,bodyY+5],[-wide*.7+lean,bodyY+5]],back?'#68777a':p.steel);line(c,[[-wide*.6,bodyY-2],[view.cheek*.4,bodyY+3],[wide*.6,bodyY-2]],back?'#8b9997':'#e0e2ce',.7);}
 line(c,[[-4.5,legY-2],[4.5,legY-2]],'#423a2f',1.8);oval(c,.7,legY-2,1.1,.9,p.trim);
 if(p.fur){for(let k=0;k<6;k++)oval(c,-6+k*2.3,bodyY-3,2.2,2,k%2?'#8c9288':'#b2b4a1');}
 if(p.towers&&!back){for(const x of [-2.5,2.5]){path(c,[[x-1.2,bodyY+2],[x-1.2,bodyY-2],[x+.9,bodyY-2],[x+.9,bodyY+2]],p.trim,null);line(c,[[x-1.5,bodyY-2],[x+.3,bodyY-2]],p.dark,.8);}}
 if(p.quiver||BOWS.has(type)){
   path(c,[[-7-side,bodyY-3],[-9-side,legY],[-5-side,legY+1],[-3-side,bodyY-2]],'#6b5135');
   for(let k=0;k<4;k++){line(c,[[-7+k*.9,bodyY-3],[-8+k*.9,headY-2]],'#b7a675',.65);path(c,[[-8+k*.9,headY-2],[-9+k*.9,headY-4],[-7+k*.9,headY-3]],'#d5cab0',null);}
 }
 if(p.satchel){line(c,[[-4,bodyY-4],[6,legY]],'#aa9165',1.4);path(c,[[4,legY-3],[10,legY-3],[10,legY+3],[4,legY+2]],'#826240');line(c,[[4,legY-2],[10,legY-2]],'#c5ad79',.8);}
 if(p.case){path(c,[[6,legY-4],[11,legY-4],[12,legY+4],[7,legY+4]],'#554832');line(c,[[7,legY-5],[11,legY-5]],p.trim,1.5);for(let k=0;k<3;k++)line(c,[[7.5+k,legY-4],[7.5+k,legY-8]],'#ddd0a9',.8);}
 if(p.javelin)for(let k=0;k<3;k++){line(c,[[-5+k*1.5,legY+1],[-9+k*1.5,headY-8]],'#a28b58',1);path(c,[[-9+k*1.5,headY-12],[-11+k*1.5,headY-7],[-7+k*1.5,headY-7]],p.steel,null);}
 if(type==='saltwind_axethrower')for(let k=0;k<2;k++){line(c,[[6+k*3,legY+4],[7+k*3,legY-3]],'#a38a56',1.3);path(c,[[6+k*3,legY-4],[10+k*3,legY-5],[11+k*3,legY-1],[7+k*3,legY]],p.steel);}
 // Head and helmets deliberately give each priority a distinct silhouette.
 oval(c,lean*.65+view.cheek*.7,headY+2,2.5+view.width*.6,3.7,back?p.dark:p.skin);
 const hx=lean*.65+view.cheek*.5,hy=headY;
 if(p.head==='hood'||p.head==='peaked'){path(c,[[hx-4.6,hy+4],[hx-4.2,hy-2],[hx+(p.head==='peaked'?3.7:.5),hy-(p.head==='peaked'?5.3:3.6)],[hx+4.8,hy+3],[hx+2.6,hy+6],[hx+2,hy],[hx-2,hy+.5],[hx-2.8,hy+5]],p.dark);if(p.head==='peaked')line(c,[[hx-3.5,hy+1],[hx+5.6,hy+.4]],p.trim,1.1);}
 else if(p.head==='flat'){path(c,[[hx-5,hy+1],[hx-5,hy-3],[hx+4.8,hy-3],[hx+5,hy+2],[hx+3,hy+3],[hx-3,hy+3]],p.steel);line(c,[[hx-5,hy-3],[hx+4.8,hy-3]],'#e0e1d4',1);}
 else if(p.head==='wrap'){path(c,[[hx-4.2,hy-2],[hx+3.3,hy-3],[hx+4,hy+4],[hx+1,hy+3],[hx-3.5,hy+4]],p.panel);line(c,[[hx-4,hy],[hx+4,hy]],p.trim,1.6);}
 else if(p.head==='cap'){path(c,[[hx-3.7,hy+1],[hx-3.4,hy-2],[hx+1,hy-3],[hx+4,hy+.5],[hx+5,hy+2]],p.dark);}
 else{
  path(c,[[hx-4,hy+3],[hx-4,hy-1],[hx-1.5,hy-4],[hx+2,hy-4],[hx+4,hy],[hx+3.8,hy+4]],p.steel);
  if(!back){const faceWidth=1.2+2.2*Math.abs(view.front);line(c,[[hx+view.cheek-faceWidth,hy+.5],[hx+view.cheek+faceWidth,hy+.5]],'#253740',1.5);line(c,[[hx+view.cheek,hy-3],[hx+view.cheek,hy+4]],p.trim,.8);}
  else line(c,[[hx-1,hy-3],[hx+1,hy+3]],'#d5dcd1',.7);
  if(p.head==='falcon'){path(c,[[hx-3,hy-2],[hx-7,hy-4],[hx-5,hy+.3]],'#d6e3e5');path(c,[[hx+3,hy-2],[hx+6,hy-5],[hx+5,hy+1]],'#c4d6e1');path(c,[[hx+2,hy+.5],[hx+5,hy+2],[hx+2,hy+3]],p.trim,null);}
  if(p.head==='crest'){path(c,[[hx-2,hy-3],[hx,hy-8],[hx+3,hy-4]],p.trim);line(c,[[hx,hy-7],[hx+1,hy-3]],'#65834b',1);}
  if(p.head==='dragon'){path(c,[[hx-3,hy-1],[hx-6,hy-6],[hx-1,hy-3]],'#69576c');path(c,[[hx+2,hy-3],[hx+5,hy-6],[hx+4,hy+1]],'#69576c');}
  if(p.head==='antler'){line(c,[[hx-3,hy-1],[hx-6,hy-5],[hx-5,hy-8]],p.trim,1.3);line(c,[[hx+3,hy-1],[hx+6,hy-5],[hx+5,hy-8]],p.trim,1.3);}
 }
 if(back)path(c,[[hx-3,hy+1],[hx+3,hy+1],[hx+3,hy+4],[hx-3,hy+4]],p.head==='hood'?p.dark:p.steel,null);
 if(state.isKing)path(c,[[hx-4.5,hy-3],[hx-5.5,hy-8],[hx-2,hy-5.5],[hx,hy-10],[hx+2,hy-5.5],[hx+5,hy-8],[hx+4.5,hy-3]],'#e5c467','#685431',.7);
 const eq=state.equipment||equipmentFor(type),pole=POLEARMS.has(type)||mounted&&type!=='sun_horse_archer';
 const shoulderA={x:-wide+1+lean*.6,y:bodyY-shoulderDepth},shoulderB={x:wide-1+lean*.6,y:bodyY+shoulderDepth};
 const gripY=-16+drop,grip={x:lean+dx*(pose.grip||0),y:gripY+dy*(pose.grip||0)};
 const arms=(a,b)=>{const elbowA={x:(shoulderA.x+a.x)/2-1,y:(shoulderA.y+a.y)/2+2},elbowB={x:(shoulderB.x+b.x)/2+1,y:(shoulderB.y+b.y)/2+1};line(c,[[shoulderA.x,shoulderA.y],[elbowA.x,elbowA.y],[a.x,a.y]],p.dark,3.3);line(c,[[shoulderB.x,shoulderB.y],[elbowB.x,elbowB.y],[b.x,b.y]],p.dark,3.3);line(c,[[shoulderA.x,shoulderA.y],[elbowA.x,elbowA.y],[a.x,a.y]],p.steel,1.8);line(c,[[shoulderB.x,shoulderB.y],[elbowB.x,elbowB.y],[b.x,b.y]],p.steel,1.8);hand(c,a,p.skin);hand(c,b,p.skin);};
 if(pole){
  const reach=state.tipReach??((eq.reach|| (p.pike?2.4:p.halberd?1.6:1.2))+(state.action==='thrust'?.16:state.action==='recovery'?.06:0)),tip=iso(f.x*reach,f.y*reach),long=p.pike||type==='winter_pikeman'||type==='thornwall_pikeman';
  let presented=pose.weapon;if(state.action==='lower')presented=t;if(state.action==='march')presented=mounted?.65:0;
  // Upright march and lowered point are full shafts with both gripping hands.
  const length=long?83:mounted?69:p.halberd?61:52;
  const reachAlreadyLowered=state.action==='lower'&&Number.isFinite(state.tipReach),endX=tip.x*(reachAlreadyLowered?1:presented),endY=gripY+tip.y*(reachAlreadyLowered?1:presented)-length*(1-presented),vx=endX-grip.x,vy=endY-grip.y;
  const vl=Math.hypot(vx,vy)||1,ux=vx/vl,uy=vy/vl,tx=endX-ux*7,ty=endY-uy*7,bx=grip.x-ux*(long?10:14),by=grip.y-uy*(long?10:14);
  const a={x:grip.x-ux*8,y:grip.y-uy*8},b={x:grip.x+ux*5,y:grip.y+uy*5};
  line(c,[[bx,by],[tx,ty]],'#302c24',2.65);line(c,[[bx,by],[tx,ty]],long?'#a88c55':'#94764b',1.4);
  if(p.halberd){path(c,[[tx-ux*5-uy*2,ty-uy*5+ux*2],[tx-ux*9-uy*10,ty-uy*9+ux*10],[tx-ux*2-uy*11,ty-uy*2+ux*11],[tx+ux*2-uy*4,ty+uy*2+ux*4]],p.steel);line(c,[[tx-ux*5,ty-uy*5],[tx-ux*7+uy*6,ty-uy*7-ux*6],[tx-ux*11+uy*7,ty-uy*11-ux*7]],p.steel,1.6);}
  const leaf=type==='thornwall_pikeman'?4:2.5;
  path(c,[[tx+ux*7,ty+uy*7],[tx-ux*4-uy*leaf,ty-uy*4+ux*leaf],[tx-ux*2,ty-uy*2],[tx-ux*4+uy*leaf,ty-uy*4-ux*leaf]],p.steel);line(c,[[tx-ux*2,ty-uy*2],[tx+ux*5,ty+uy*5]],'#ebecda',.7);
  arms(a,b);
 }else if(p.crossbow||eq.reloadStyle){paintCrossbow(c,p,state,{x:grip.x,y:gripY},dx,dy,arms);}
 else if(BOWS.has(type)){
  if(type==='river_ranger'&&state.action==='support'){
    // The compact bow is slung while the ranger reaches into the shoulder bag
    // and opens a real bandage. Both hands belong to this complete support cel.
    const bx=-7;c.beginPath();c.moveTo(bx,-26);c.quadraticCurveTo(bx-6,-15,bx,-5);c.strokeStyle='#b79663';c.lineWidth=1.6;c.stroke();line(c,[[bx,-26],[bx,-5]],'#d2c9a7',.6);
    const a={x:5+t*3,y:-8-t*5},b={x:9-t*2,y:-7-t*5};path(c,[[a.x,a.y-1],[b.x+3,b.y-1],[b.x+3,b.y+2],[a.x,a.y+2]],'#e4d8b4',null);arms(a,b);
  }else paintBow(c,p,state,grip,dx,dy,arms);
 }
 else if(p.javelin||type==='saltwind_axethrower'){
  const release=iso(f.x*.28,f.y*.28),aim=state.action==='aiming',recover=state.action==='recovery',empty=state.action==='release'||recover&&t<.6;
  const a={x:lean-side*2,y:bodyY+4},b=state.action==='release'?{x:release.x,y:release.y-15}:aim?{x:release.x-dx*(1-t)*8,y:release.y-15-(1-t)*7}:recover?{x:side*(7-t*3),y:bodyY+4+t*3}:{x:side*4,y:bodyY+3};
  if(!empty){
   if(p.javelin){const len=36;line(c,[[b.x-dx*len*.25,b.y-dy*len*.25],[b.x+dx*len*.75,b.y+dy*len*.75]],'#ac8e5e',1.6);path(c,[[b.x+dx*len*.8,b.y+dy*len*.8],[b.x+dx*len*.65-dy*2,b.y+dy*len*.65+dx*2],[b.x+dx*len*.65+dy*2,b.y+dy*len*.65-dx*2]],p.steel);}
   else{line(c,[[b.x,b.y],[b.x+side*7,b.y-12]],'#9a7f50',1.9);path(c,[[b.x+side*4,b.y-14],[b.x+side*12,b.y-16],[b.x+side*14,b.y-9],[b.x+side*7,b.y-8]],p.steel);}
  }
  arms(a,b);
 }
 else{
  const strike=state.action==='attack'?(t<.5?-1:1):0,a={x:lean-side*2,y:bodyY+5},b={x:side*(7+strike*4),y:bodyY+3-strike*4};
  const hammer=type==='stormbreaker'||type==='bear_mauler',axe=type==='ironborn_reaver'||type==='saltwind_axethrower';
  line(c,[[b.x,b.y],[b.x+side*7,b.y-13]],hammer||axe?'#8f7047':p.steel,hammer?2:1.8);
  if(hammer)path(c,[[b.x+side*3,b.y-17],[b.x+side*13,b.y-14],[b.x+side*11,b.y-8],[b.x+side*1,b.y-11]],p.steel);
  else if(axe)path(c,[[b.x+side*4,b.y-14],[b.x+side*12,b.y-17],[b.x+side*14,b.y-10],[b.x+side*7,b.y-9]],p.steel);
  else line(c,[[b.x+side*3,b.y-3],[b.x+side*9,b.y]],p.trim,1.5);
  arms(a,b);
 }
 const shield=eq.shieldClass||(type==='shield_bearer'?'heavy':type==='winter_guard'?'small':null);
 if(shield){const guarded=state.shieldPresented??!['hit','turn','lower','march','backward','thrust','attack','death','span','take_bolt','seat_bolt'].includes(state.action),sx=side*(guarded?5:7),sy=guarded?bodyY+7:legY+1,w=shield==='heavy'?6.7:4.8,h=shield==='heavy'?10.5:6.7;
  // Guard/lowered/block are whole cels; no independent shield rotation at impact.
  const cover=Math.max(.25,Math.abs(dx));path(c,[[sx-w*cover,sy-h],[sx+w*cover,sy-h],[sx+w*cover*.85,sy+3],[sx,sy+h*.58],[sx-w*cover*.85,sy+3]],p.panel,p.steel,1.3);line(c,[[sx,sy-h+1],[sx,sy+5]],p.trim,1);if(team.sigil==='dragon')path(c,[[sx,sy-7],[sx+3,sy-3],[sx+1,sy],[sx+3,sy+2],[sx-2,sy+1],[sx-3,sy-4]],'#b8909b',null);else oval(c,sx,sy-2,1.5,1.7,p.trim);
 }
 c.restore();
}

function paintHorse(c,p,dx,dy,gait,team){
 const side=dx>=0?1:-1,foreshorten=.5+Math.abs(dx)*.5,bodyW=14*foreshorten,hide=team.sigil==='rose'?'#8a765b':team.sigil==='sun'?'#ac8b5e':'#6f655a';
 for(const [x,z]of [[-9,1],[6,-1]]){line(c,[[x,-10],[x+gait*3*z,-5],[x-gait*3*z,1]],'#3e3b33',3.1);line(c,[[x+3,-10],[x-gait*3*z,-4],[x+gait*3*z,0]],hide,3);}
 oval(c,0,-14,bodyW,7.5,hide);line(c,[[-side*bodyW,-16],[-side*(bodyW+6),-12],[-side*(bodyW+8),-5]],'#37372f',2.5);
 path(c,[[side*6,-17],[side*(bodyW+1),-28],[side*(bodyW+6),-27],[side*(bodyW+7),-18],[side*(bodyW+1),-16]],hide);
 oval(c,side*(bodyW+5),-25,4,3.5,hide);path(c,[[side*(bodyW+2),-27],[side*(bodyW+3),-33],[side*(bodyW+6),-27]],hide);
 line(c,[[side*(bodyW+1),-22],[side*(bodyW+8),-22]],'#c3ad81',.8);oval(c,side*(bodyW+7),-25,1,.8,'#202b27');
 path(c,[[-7,-19],[5,-19],[9,-11],[-8,-10]],p.dark);line(c,[[-7,-17],[6,-17],[8,-11]],p.trim,1.5);oval(c,0,-21,6,2.7,'#55442e');
}

function paintBow(c,p,state,grip,dx,dy,arms){
 const t=state.frame/7,aim=['aiming','release','attack'].includes(state.action),compact=p.bow==='compact',length=compact?19:30,ux=aim?dx:.25,uy=aim?dy:-.7,n=Math.hypot(ux,uy),nx=-uy/n,ny=ux/n,a=state.directionIndex/state.directions*Math.PI*2,release=iso(Math.cos(a)*.28,Math.sin(a)*.28),bx=aim?release.x:grip.x+4,by=grip.y+(aim?release.y:-1),bend=aim?5:2;
 const top={x:bx+nx*length*.5,y:by+ny*length*.5},bottom={x:bx-nx*length*.5,y:by-ny*length*.5};
 c.beginPath();c.moveTo(top.x,top.y);c.quadraticCurveTo(bx+dx*bend,by+dy*bend,bottom.x,bottom.y);c.strokeStyle='#c4a16d';c.lineWidth=1.8;c.stroke();
 const draw=aim&&state.action!=='release'?1+t*6:1,string={x:bx-dx*draw,y:by-dy*draw};line(c,[[top.x,top.y],[string.x,string.y],[bottom.x,bottom.y]],'#d4cfb0',.65);
 if(aim&&state.action!=='release'){line(c,[[string.x,string.y],[bx+dx*3,by+dy*3]],'#ddd3a6',.8);}
 arms({x:bx,y:by},aim?string:{x:grip.x-2,y:grip.y+4});
}

function paintCrossbow(c,p,state,grip,dx,dy,arms){
 const stage=state.action,t=state.frame/7,style=p.crossbow||state.equipment?.reloadStyle||'belt',work=['lower','span','take_bolt','seat_bolt','raise'].includes(stage);
 const low=stage==='span'?style==='lever'?8:5:stage==='take_bolt'||stage==='seat_bolt'?4:stage==='lower'?t*5:stage==='raise'?(1-t)*5:0;
 const bow=style==='windlass'?10:style==='compact'?6.3:8,stock=style==='windlass'?20:16,a=state.directionIndex/state.directions*Math.PI*2,release=iso(Math.cos(a)*.28,Math.sin(a)*.28),muzzle=Math.hypot(release.x,release.y);
 const bx=work?grip.x+3:release.x-dx*stock*.5,by=work?grip.y+low:grip.y+release.y-dy*stock*.5,ux=work?.55:dx,uy=work?-.65:dy,n=Math.hypot(ux,uy)||1,sx=ux/n,sy=uy/n,px=-sy,py=sx;
 const point=(a,b)=>({x:bx+sx*a+px*b,y:by+sy*a+py*b}),P=(a,b)=>{const v=point(a,b);return[v.x,v.y];};
 line(c,[P(-stock*.5,0),P(stock*.5,0)],'#292c29',3.5);line(c,[P(-stock*.5,0),P(stock*.5,0)],'#9a784d',2.1);
 line(c,[P(stock*.4,-bow),P(stock*.55,0),P(stock*.4,bow)],p.steel,2);
 const cock=stage==='span'?t:stage==='take_bolt'||stage==='seat_bolt'||stage==='raise'||state.cocked!==false&&!['release','lower'].includes(stage)?1:0,string=stock*.4-cock*stock*.7;
 line(c,[P(stock*.4,-bow),P(string,0),P(stock*.4,bow)],'#d7cbaa',.7);
 line(c,[P(stock*.53,-2),P(stock*.77,-2),P(stock*.77,2),P(stock*.53,2)],p.steel,1.1);
 let working=point(-4,2),support=point(5,1);
 if(work&&style==='belt'&&['lower','span'].includes(stage)){
  const belt=point(string-2,5+t*4);line(c,[P(string,0),[belt.x,belt.y],[grip.x-3,grip.y+8]],'#c0a367',1.4);working=belt;
 }else if(work&&(style==='lever'||style==='compact')&&['lower','span'].includes(stage)){
  const lever=.25+(stage==='span'?Math.sin(t*Math.PI):.2)*1.8,handle=point(-4+Math.cos(lever)*11,Math.sin(lever)*11);
  line(c,[P(-4,1),[handle.x,handle.y]],p.steel,2);line(c,[[handle.x,handle.y],P(string,0)],'#d2c8a4',.8);working=handle;
  if(style==='lever'){const boot=point(stock*.77,3);line(c,[[boot.x,boot.y],[boot.x+2,boot.y+4],[boot.x-4,boot.y+4]],'#3c3229',2.8);}
 }else if(work&&style==='windlass'&&['lower','span'].includes(stage)){
  line(c,[P(-7,-4),P(-7,4)],p.steel,2.5);line(c,[P(-7,-4),P(string,-1),P(-7,4)],'#d5c9a3',.7);const axle=point(-7,0);oval(c,axle.x,axle.y,2.4,2.4,'#7f8b8c');const handPoint=point(-7+Math.cos(t*Math.PI*4)*5,Math.sin(t*Math.PI*4)*4);line(c,[[axle.x,axle.y],[handPoint.x,handPoint.y]],p.trim,1.5);working=handPoint;
 }
 if(stage==='take_bolt'){working={x:7+(1-t)*3,y:-5-(1-t)*3};line(c,[[working.x,working.y],[working.x+sx*14,working.y+sy*14]],'#ded3a5',.9);}
 else if(stage==='seat_bolt'){working=point(-6+(1-t)*-4,-2+(1-t)*5);line(c,[[working.x,working.y],[working.x+sx*14,working.y+sy*14]],'#ddd1a8',.9);}
 else if(!['release','span','lower'].includes(stage)&&(state.loaded!==false||state.boltSeated===true||stage==='raise'))line(c,[P(-6,-1),P(stock*.6,-1)],'#e0d9ad',.85);
 arms(working,support);
}

export function completeArtCacheInfo(){return {frames:frames.size,maxFrames:MAX_CEL_COUNT,bytes:frameBytes,maxBytes:MAX_CEL_BYTES,hits:cacheHits,misses:cacheMisses,cell:TROOP_CELL};}

const hallFrames=new Map();
export function pikeProductionFrame(type,house){
 if(hallFrames.has(type))return hallFrames.get(type);
 const image=document.createElement('canvas');image.width=200;image.height=200;const c=image.getContext('2d'),north=house==='wolf',stone=north?'#82918c':'#b1b59a',roof=north?'#3b515b':'#3b693c',trim=north?'#c2c5ad':'#d9bd65';c.translate(100,175);c.lineJoin='round';c.lineCap='round';
 oval(c,0,4,75,16,'rgba(13,28,28,.28)');path(c,[[-76,-10],[-18,-34],[73,-8],[17,20]],'#7b8061');
 path(c,[[-40,-12],[-40,-64],[3,-80],[47,-58],[47,-9],[3,12]],stone);
 path(c,[[3,-69],[47,-58],[47,-9],[3,12]],north?'#4d6264':'#6b8060');
 for(let j=0;j<4;j++)line(c,[[-38,-19-j*11],[3,-1-j*11],[46,-20-j*10]],north?'#4a6261':'#7c8a6e',1);
 path(c,[[-48,-62],[-3,-100],[53,-60],[4,-40]],roof);path(c,[[-3,-100],[53,-60],[4,-40]],north?'#293e49':'#294d32');line(c,[[-48,-62],[-3,-100],[53,-60]],trim,1.8);
 for(let k=1;k<5;k++)line(c,[[-3+k*9,-100+k*7],[4+k*9,-40-k*3.4]],north?'#536b74':'#5a824e',1);
 path(c,[[-24,-18],[-24,-44],[-8,-49],[-8,-12]],'#293b3c',trim);line(c,[[-16,-46],[-16,-16]],'#806b47',2);
 path(c,[[19,-33],[19,-46],[29,-43],[29,-28]],'#263e3c',trim);
 // Two complete drill racks and a pike pennant replace the old shield hall art.
 for(const side of [-1,1]){
  const x=side*59,y=side<0?0:8;line(c,[[x-8,y],[x-8,y-26],[x+8,y-24],[x+8,y+2]],'#705d3f',3);line(c,[[x-10,y-14],[x+10,y-12]],'#b49a66',2);
  for(let k=0;k<3;k++){const px=x-7+k*6,py=y-12+k*.5;line(c,[[px,py+13],[px+2,py-62]],'#b9a375',1.6);path(c,[[px+2,py-70],[px-1,py-60],[px+2,py-63],[px+5,py-60]],north?'#d7e0d8':'#dce8bf',null);}
 }
 line(c,[[3,-99],[3,-126]],'#aa9568',1.8);path(c,[[3,-124],[22,-118],[18,-107],[3,-110]],north?'#607e8c':'#538048',trim);line(c,[[10,-121],[10,-111]],trim,1.3);path(c,[[10,-124],[7,-119],[13,-119]],trim,null);
 const frame={image,left:0,top:0,width:200,height:200,scale:.5,drawWidth:100,drawHeight:100,house,completePikeHall:true,regimentBuilding:true};hallFrames.set(type,frame);return frame;
}
