// Cosmetic snapshots only: never insert these into unit lists, spatial hashes,
// navigation, capture calculations or the simulation's random-number stream.
export const CORPSE_LIFETIME=120;
export const MAX_CORPSES=12000;
const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
const shade=(hex,amount)=>{
  const color=/^#[0-9a-f]{6}$/i.test(hex||'')?hex:'#a5a696';
  return '#'+[1,3,5].map(i=>clamp(Math.round(parseInt(color.slice(i,i+2),16)*amount),0,255).toString(16).padStart(2,'0')).join('');
};
export function corpseOpacity(body,time){return clamp(1-(time-body.bornAt)/CORPSE_LIFETIME,0,1);}
export class BattleAftermath{
  constructor(){this.bodies=[];this.ids=new Set();this.time=0;}
  record(unit,team,time,kind=unit?.type){
    if(!unit||unit.hp>0||!Number.isFinite(unit.x)||!Number.isFinite(unit.y)||!Number.isFinite(time)||this.ids.has(unit.id))return null;
    const seed=Math.imul((unit.id||0)^Math.imul((unit.team||0)+1,2654435761),1597334677)>>>0;
    const variant=(seed>>>4)%3,body={id:unit.id,team:unit.team,type:unit.type,kind,x:unit.x,y:unit.y,bornAt:time,pose:seed%4,variant,isKing:!!unit.isKing,
      color:shade(team?.color,[.76,.94,1.1][variant]),dark:shade(team?.dark,.9),trim:team?.teamColor||team?.color||'#a5a696',sigil:team?.sigil||'',skin:['#b59b7a','#c9af8c','#9b8065'][variant],armor:['#757d79','#92948a','#686f71'][variant]};
    if(this.bodies.length>=MAX_CORPSES){const removed=this.bodies.shift();this.ids.delete(removed.id);}
    this.bodies.push(body);this.ids.add(body.id);this.time=Math.max(this.time,time);return body;
  }
  update(time){
    if(!Number.isFinite(time))return;this.time=time;
    // Deaths are recorded chronologically, so cleanup touches only the expired
    // prefix rather than allocating a replacement array on every frame.
    let expired=0;while(expired<this.bodies.length&&time-this.bodies[expired].bornAt>=CORPSE_LIFETIME){this.ids.delete(this.bodies[expired].id);expired++;}
    if(expired)this.bodies.splice(0,expired);
  }
  clear(){this.bodies.length=0;this.ids.clear();}
}
