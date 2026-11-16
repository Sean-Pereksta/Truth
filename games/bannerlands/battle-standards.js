import {heroProfile,STANDARD_RULES as RULES} from './heroes.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const response=(ok,message)=>({ok,message});
const clone=value=>JSON.parse(JSON.stringify(value));
const ownHero=(g,id)=>{const u=g.byId.get(typeof id==='object'?id.id:id);return u?.type==='hero'&&u.hp>0&&g.teams[u.team]?.alive?u:null;};
export const standardFor=(g,team=0)=>g.standards?.find(s=>s.team===team)||null;
export const heroFor=(g,team=0)=>g.units.find(u=>u.team===team&&u.type==='hero'&&u.hp>0)||null;
export const standardGround=s=>!!s&&s.hp>0&&!['carrying','planting'].includes(s.state)&&s.carrierId==null;

function makeStandard(g,u){
  // Physical standards have their own identity namespace. Adding artwork and
  // standards must not perturb seeded troop IDs used by formation/collision work.
  g.nextStandardId??=0;
  const s={id:--g.nextStandardId,type:'standard',team:u.team,owner:u.team,heroId:u.id,carrierId:u.id,x:u.x,y:u.y,facingX:u.facingX,facingY:u.facingY,hp:RULES.hp,maxHp:RULES.hp,radius:.12,state:'carrying',dormant:false,handlingHeroId:null,bornAt:g.time};
  g.standards.push(s);g.byId.set(s.id,s);return s;
}
export function attachHero(g,u){
  g.standards??=[];g.standardRemains??=[];u.heroProfile=heroProfile(g.teams[u.team]).id;
  let s=standardFor(g,u.team);
  if(!s&&!g.teams[u.team].heroStandardIssued)s=makeStandard(g,u);
  g.teams[u.team].heroStandardIssued=true;
  if(s)s.heroId=u.id;u.standardId=s?.id??null;u.heroMode=s?.carrierId===u.id&&s.hp>0?'carrying':'signature';
  u.standardAction=null;u.standardVisual=null;return s;
}
function isPlacementClear(g,u,x,y){
  if(!Number.isFinite(x)||!Number.isFinite(y)||!g.navigation.isClearPoint(x,y,u.radius+.05))return false;
  return !g.buildings.some(b=>b.hp>0&&distance({x,y},b)<g.buildingRadius(b)+.35);
}
export function validatePlacement(g,id,x,y){
  const u=ownHero(g,id);if(!u)return response(false,'Select your living hero.');
  const s=standardFor(g,u.team);if(!s||s.hp<=0||s.carrierId!==u.id)return response(false,'The hero must carry the standard before planting it.');
  if(!isPlacementClear(g,u,x,y))return response(false,'Choose clear ground for the standard.');
  if(!g.navigation.route(u,{x,y},'infantry').reachable)return response(false,'The standard site is blocked. Choose a reachable position.');
  return response(true,'Plant the standard here.');
}
function begin(g,u,kind,point,{standard=null,keep=null,fallen=false}={}){
  if(u.standardAction?.kind===kind&&u.standardAction.targetId===(standard?.id??keep?.id??null)&&distance(u.standardAction,point)<.01)return response(true,'The hero is already carrying out that standard order.');
  cancelStandard(g,u.id,false);
  // Travel is an ordinary order; the handling timer starts only after arrival.
  g.command([u.id],point.x,point.y,'move','spread');
  if(distance(u,point)<.16)u.order.mode='hold';
  u.target=null;u.standardBlocked=null;
  u.standardAction={kind,phase:'travel',progress:0,duration:kind==='plant'?RULES.plantSeconds:kind==='pickup'?RULES.pickupSeconds:RULES.keepSeconds,targetId:standard?.id??keep?.id??null,standardId:standard?.id??standardFor(g,u.team)?.id??null,keepId:keep?.id??null,x:point.x,y:point.y,fallen,lastDistance:distance(u,point),stalled:0,startedAt:g.time};
  return response(true,kind==='plant'?'Hero travelling to plant the standard.':kind==='pickup'?'Hero travelling to retrieve the standard.':'Hero travelling to the keep.');
}
export function plantStandard(g,id,x,y){
  const valid=validatePlacement(g,id,x,y);if(!valid.ok)return valid;
  const u=ownHero(g,id);return begin(g,u,'plant',{x,y},{standard:standardFor(g,u.team)});
}
export function retrieveStandard(g,id){
  const u=ownHero(g,id);if(!u)return response(false,'Select your living hero.');
  const s=standardFor(g,u.team);if(!s||s.hp<=0)return response(false,'The standard must be reforged at an owned keep.');
  if(s.carrierId===u.id)return response(false,'The hero already carries the standard.');
  if(!standardGround(s)||s.team!==u.team)return response(false,'Only your own ground standard can be retrieved.');
  if(!g.navigation.route(u,s,'infantry').reachable)return response(false,'Retrieval route blocked. Clear a route to this standard.');
  return begin(g,u,'pickup',s,{standard:s,fallen:s.state==='fallen'});
}
function keepOrder(g,id,kind){
  const u=ownHero(g,id);if(!u)return response(false,'Select your living hero.');
  const s=standardFor(g,u.team);
  if(kind==='refit'&&(!s||s.hp<=0||s.carrierId!==u.id||s.hp>=s.maxHp))return response(false,'Carry a damaged standard to refit it.');
  if(kind==='reforge'&&s?.hp>0)return response(false,'Recover the existing standard. An intact standard cannot be replaced remotely.');
  const options=[];
  for(const keep of g.buildings.filter(b=>b.team===u.team&&b.hp>0&&b.type==='keep')){
    const base=Math.atan2(u.y-keep.y,u.x-keep.x),r=g.buildingRadius(keep)+u.radius+.3;
    for(let i=0;i<16;i++){
      const angle=base+i*Math.PI/8,point={x:keep.x+Math.cos(angle)*r,y:keep.y+Math.sin(angle)*r};
      if(!g.navigation.isClearPoint(point.x,point.y,u.radius)||g.buildings.some(b=>b.hp>0&&distance(point,b)<g.buildingRadius(b)+u.radius+.08))continue;
      const route=g.navigation.route(u,point,'infantry');if(route?.reachable)options.push({keep,point,route});
    }
  }
  options.sort((a,b)=>a.route.cost-b.route.cost||a.keep.id-b.keep.id);
  if(!options.length)return response(false,'No living owned keep has a reachable approach.');
  const {keep,point}=options[0];return begin(g,u,kind,point,{standard:s,keep});
}
export const refitStandard=(g,id)=>keepOrder(g,id,'refit');
export const reforgeStandard=(g,id)=>keepOrder(g,id,'reforge');

export function cancelStandard(g,id,animate=true,reason='Standard order cancelled.'){
  const u=g.byId.get(typeof id==='object'?id.id:id),a=u?.standardAction;if(!a)return response(false,'No standard interaction is active.');
  const s=standardFor(g,u.team);
  if(s){
    if(a.kind==='plant'){s.state='carrying';s.carrierId=u.id;s.x=u.x;s.y=u.y;}
    if(a.kind==='pickup'){s.state=a.fallen?'fallen':'planted';s.carrierId=null;}
    if(animate&&a.phase==='handling'&&['plant','pickup'].includes(a.kind)){
      u.standardVisual={kind:a.kind,phase:'abort',fromProgress:a.progress/a.duration,progress:0,duration:.22,until:g.time+.22,fallen:a.fallen,x:a.x,y:a.y};s.handlingHeroId=u.id;
    }else{s.handlingHeroId=null;u.standardVisual=null;}
  }
  u.standardAction=null;u.standardBlocked=reason;u.heroMode=s?.carrierId===u.id?'carrying':'signature';u.target=null;
  return response(true,reason);
}
export function heroDied(g,u){
  if(u.type!=='hero'||u.standardDeathHandled)return;u.standardDeathHandled=true;
  const s=standardFor(g,u.team);if(!s)return;
  const a=u.standardAction;
  if(s.hp>0){
    if(s.carrierId===u.id||a?.kind==='plant'){s.x=u.x;s.y=u.y;s.state='fallen';s.carrierId=null;}
    else if(s.state==='picking-up')s.state=a?.fallen?'fallen':'planted';
    s.dormant=true;s.handlingHeroId=null;
  }
  u.standardAction=null;u.standardVisual=null;u.heroMode='signature';
}
export function eliminateStandards(g,team){
  const s=standardFor(g,team);if(!s)return;
  const u=g.byId.get(s.carrierId);if(u){s.x=u.x;s.y=u.y;}
  if(s.hp>0&&s.carrierId!=null)s.state='fallen';
  if(s.state==='picking-up')s.state='planted';
  s.carrierId=null;s.handlingHeroId=null;s.dormant=true;s.inert=true;
  for(const u of g.units)if(u.team===team&&u.type==='hero'){u.standardAction=null;u.standardVisual=null;}
}
export function damageStandard(g,s,amount,source){
  if(!standardGround(s)||!g.hostile(source.team,s.team)||!Number.isFinite(amount)||amount<=0)return;
  s.hp=Math.max(0,s.hp-amount);s.hit=.16;
  if(s.hp>0)return;
  const hero=g.byId.get(s.handlingHeroId);if(hero?.standardAction)cancelStandard(g,hero.id,false,'The standard was destroyed.');
  s.state='destroyed';s.carrierId=null;s.handlingHeroId=null;s.dormant=true;s.destroyedAt=g.time;
  g.event(`${g.teams[s.team].name}'s battle standard was broken.`,s.team);
}
function keepValid(g,u,a){
  const b=g.byId.get(a.keepId);return b&&b.hp>0&&b.type==='keep'&&b.team===u.team&&distance(u,b)<=g.buildingRadius(b)+u.radius+RULES.interactionRange;
}
function eligible(g,u,a,s){
  if(a.kind==='plant')return s?.hp>0&&s.carrierId===u.id&&isPlacementClear(g,u,a.x,a.y);
  if(a.kind==='pickup')return s?.hp>0&&s.team===u.team&&s.carrierId==null&&distance(u,s)<=RULES.interactionRange;
  if(!keepValid(g,u,a))return false;
  return a.kind==='refit'?s?.hp>0&&s.carrierId===u.id&&s.hp<s.maxHp:!s||s.hp<=0;
}
function complete(g,u,a,s){
  if(a.kind==='plant'){s.x=a.x;s.y=a.y;s.facingX=u.facingX;s.facingY=u.facingY;s.carrierId=null;s.state='planted';s.dormant=false;u.heroMode='signature';}
  else if(a.kind==='pickup'){s.carrierId=u.id;s.state='carrying';s.dormant=false;s.x=u.x;s.y=u.y;u.heroMode='carrying';}
  else if(a.kind==='refit'){s.hp=s.maxHp;u.heroMode='carrying';}
  else{
    if(s){g.standardRemains.push({...s,state:'destroyed',hp:0,inert:true});g.standards=g.standards.filter(v=>v!==s);g.byId.delete(s.id);}
    s=makeStandard(g,u);u.standardId=s.id;u.heroMode='carrying';
  }
  s.handlingHeroId=null;u.standardAction=null;u.standardVisual=null;u.standardBlocked=null;u.target=null;
  u.reload=null;u.crossbowAim=null;u.reloading=false;u.cooldown=Math.max(.15,u.cooldown||0);
  // This is an internal stance change, not a new order that can cancel itself.
  u.order={x:u.x,y:u.y,mode:'hold',formation:'line'};
  if(a.kind==='pickup'&&u.standardResumeOrder){const resume=u.standardResumeOrder;u.standardResumeOrder=null;g.command([u.id],resume.x,resume.y,resume.mode||'move',resume.formation||'line');Object.assign(u.order,resume);}
}
export function updateStandards(g,dt){
  g.standards??=[];g.standardRemains??=[];
  for(const s of g.standards){
    const carrier=g.byId.get(s.carrierId);if(carrier?.hp>0){s.x=carrier.x;s.y=carrier.y;}
    else if(s.carrierId!=null){const old=g.byId.get(s.carrierId)||g.units.find(u=>u.id===s.carrierId);if(old)heroDied(g,old);else{s.state='fallen';s.carrierId=null;s.dormant=true;}}
    s.hit=Math.max(0,(s.hit||0)-dt);
    // Keep ground records addressable after save/load or custom fixtures.
    if(s.hp>0)g.byId.set(s.id,s);
  }
  for(const u of g.units){
    if(u.type!=='hero')continue;
    if(u.hp<=0){heroDied(g,u);continue;}
    const s=standardFor(g,u.team),v=u.standardVisual;
    if(v?.phase==='abort'){v.progress=Math.min(v.duration,v.progress+dt);if(g.time>=v.until){u.standardVisual=null;if(s)s.handlingHeroId=null;}}
    const a=u.standardAction;if(!a)continue;
    if(u.knockT>0||u.shockUntil>g.time||u.stunUntil>g.time){cancelStandard(g,u.id,true,'The standard interaction was interrupted.');continue;}
    if(a.kind==='pickup'&&(!s||s.hp<=0||s.id!==a.standardId||s.carrierId!=null)){cancelStandard(g,u.id,false,'The target standard is no longer recoverable.');continue;}
    if(a.phase==='travel'){
      if(a.kind==='pickup'){a.x=s.x;a.y=s.y;}
      const arrived=['refit','reforge'].includes(a.kind)?keepValid(g,u,a):distance(u,a)<=RULES.interactionRange;
      if(!arrived){
        const remaining=distance(u,a);a.stalled=remaining<a.lastDistance-.005?0:a.stalled+dt;a.lastDistance=remaining;
        if(a.stalled>=3){u.standardBlocked='Route blocked. Clear the approach or issue the standard order again.';}
        continue;
      }
      if(!eligible(g,u,a,s)){cancelStandard(g,u.id,false,'The standard or keep is no longer eligible.');continue;}
      a.phase='handling';a.progress=0;a.anchorX=u.x;a.anchorY=u.y;a.handlingAt=g.time;u.target=null;u.vx=0;u.vy=0;u.reload=null;u.crossbowAim=null;u.reloading=false;
      u.order={x:u.x,y:u.y,mode:'hold',formation:'line',standardInteraction:true};
      if(s){s.handlingHeroId=u.id;if(a.kind==='plant')s.state='planting';else if(a.kind==='pickup')s.state='picking-up';}
      continue;
    }
    // Completion occurs after damage and all displacement in the step. Death
    // therefore always wins against the final animation event.
    const displaced=distance(u,{x:a.anchorX,y:a.anchorY})>.16;
    if(displaced||!eligible(g,u,a,s)){cancelStandard(g,u.id,true,'The standard interaction was interrupted.');continue;}
    a.progress=Math.min(a.duration,a.progress+dt);
    if(a.progress>=a.duration-1e-8&&u.hp>0&&eligible(g,u,a,s))complete(g,u,a,s);
  }
}
export function standardStatus(g,id){
  const u=g.byId.get(id),team=u?.type==='hero'?u.team:Number.isInteger(id)&&g.teams[id]?id:0,s=standardFor(g,team),a=u?.standardAction,profile=heroProfile(g.teams[team]);
  const state=a?.phase==='handling'?a.kind==='refit'?'refitting':a.kind==='reforge'?'reforging':s?.state:s?.state||'absent';
  return {state,action:a?.kind||null,phase:a?.phase||null,progress:a?.progress||0,duration:a?.duration||0,standard:s,hp:s?.hp||0,maxHp:s?.maxHp||RULES.hp,blocked:u?.standardBlocked||null,benefit:a?.phase==='handling'||s?.dormant||s?.inert||!s||s.hp<=0?null:s.state==='carrying'?profile.carried:s.state==='planted'?profile.planted:null};
}
export function exportStandards(g){
  return clone({version:1,nextStandardId:g.nextStandardId||0,standards:g.standards||[],remains:g.standardRemains||[],heroes:g.units.filter(u=>u.type==='hero').map(u=>({id:u.id,team:u.team,standardId:u.standardId,heroMode:u.heroMode,standardAction:u.standardAction,standardVisual:u.standardVisual,standardBlocked:u.standardBlocked,standardDeathHandled:u.standardDeathHandled,standardResumeOrder:u.standardResumeOrder,order:u.order})),heroTimers:g.teams.map(t=>({team:t.id,value:t.heroTimer,issued:!!t.heroStandardIssued}))});
}
export function importStandards(g,snapshot){
  if(snapshot?.version!==1||!Array.isArray(snapshot.standards))throw new Error('Unsupported battle-standard snapshot.');
  const data=clone(snapshot),teams=new Set(),ids=new Set();
  const states=new Set(['carrying','planting','planted','picking-up','fallen','destroyed']);
  for(const s of data.standards){
    const existing=g.byId.get(s.id),carrier=s.carrierId==null?null:g.byId.get(s.carrierId);
    if(teams.has(s.team)||ids.has(s.id)||!Number.isInteger(s.team)||!g.teams[s.team]||!Number.isInteger(s.id)||s.id>=0||existing&&existing.type!=='standard'||!Number.isFinite(s.x)||!Number.isFinite(s.y)||s.x<0||s.x>=g.W||s.y<0||s.y>=g.H||!Number.isFinite(s.hp)||s.maxHp!==RULES.hp||s.hp<0||s.hp>s.maxHp||!states.has(s.state)||s.owner!==s.team||s.carrierId!=null&&(!carrier||carrier.type!=='hero'||carrier.team!==s.team)||['carrying','planting'].includes(s.state)!==(s.carrierId!=null)||s.state==='destroyed'&&s.hp!==0||s.state!=='destroyed'&&s.hp<=0)throw new Error('Invalid or duplicate battle-standard identity.');
    teams.add(s.team);ids.add(s.id);
  }
  for(const old of g.standards||[])g.byId.delete(old.id);
  g.standards=data.standards;g.standardRemains=data.remains||[];
  g.nextStandardId=Math.min(0,Number.isInteger(data.nextStandardId)?data.nextStandardId:0,...g.standards.map(s=>s.id),...g.standardRemains.map(s=>s.id));
  for(const s of g.standards)if(s.hp>0)g.byId.set(s.id,s);
  for(const state of data.heroes||[]){const u=g.byId.get(state.id);if(u?.type==='hero'&&u.team===state.team){Object.assign(u,state);if(u.standardAction?.phase==='handling'){u.standardAction.anchorX=u.x;u.standardAction.anchorY=u.y;}}}
  for(const state of data.heroTimers||[])if(g.teams[state.team]){g.teams[state.team].heroTimer=state.value;if(typeof state.issued==='boolean')g.teams[state.team].heroStandardIssued=state.issued;}
  for(const u of g.units)if(u.target?.type==='standard')u.target=g.byId.get(u.target.id)||null;
  return g;
}
export function aiStandards(g,s){
  const u=heroFor(g,s.id),b=standardFor(g,s.id);if(!u)return;
  let danger=null;g.hash.visit(u.x,u.y,4,e=>{if(e.hp>0&&distance(u,e)<=4&&g.hostile(s.id,e.team)&&g.isVisibleTo(s.id,e)&&(!danger||distance(u,e)<distance(u,danger)))danger=e;});
  if(u.hp<u.maxHp*.35&&danger&&g.time>=(u.standardRetreatAt||0)){
    cancelStandard(g,u.id);const dx=u.x-danger.x,dy=u.y-danger.y,l=Math.hypot(dx,dy)||1,point=g.navigation.nearestPassable(g.bound({x:u.x+dx/l*6,y:u.y+dy/l*6}));
    if(point){g.command([u.id],point.x,point.y,'move','spread');u.order.aiTask='retreat';u.standardRetreatAt=g.time+5;}return;
  }
  if(u.standardAction||u.hp<u.maxHp*.35)return;
  if(!b||b.hp<=0){reforgeStandard(g,u.id);return;}
  if(b.carrierId==null&&['move','retreat'].includes(u.order?.mode)&&distance(b,u.order)>6&&distance(u,b)<7&&!danger){const resume={...u.order};if(retrieveStandard(g,u.id).ok)u.standardResumeOrder=resume;return;}
  if(b.carrierId==null&&(b.dormant||distance(u,b)>8)&&g.navigation.route(u,b,'infantry').reachable){retrieveStandard(g,u.id);return;}
  if(b.carrierId===u.id&&!['move','retreat'].includes(u.order?.mode)&&u.hp>u.maxHp*.65){
    let friends=0,enemies=0;g.hash.visit(u.x,u.y,5,o=>{if(o!==u&&o.hp>0&&distance(o,u)<=5){if(o.team===s.id)friends++;else if(g.hostile(s.id,o.team)&&g.isVisibleTo(s.id,o))enemies++;}});
    if(friends>=5&&enemies<=friends&&g.time>=(u.nextStandardAI||0)){u.nextStandardAI=g.time+12;plantStandard(g,u.id,u.x,u.y);}
  }
}
