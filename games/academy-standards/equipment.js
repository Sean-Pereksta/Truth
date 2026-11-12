/* Shared, deterministic loadout planner. Preview and apply use the same inventory ledger. */
(() => {
 'use strict';
 const weapons=['Sword','Spear','Bow','Longbow'],armors=['Light','Heavy'];
 const items=['Shield','Boots','Medkit','EngineerKit','TrapKit','WarHorn','FireOil'];
 const presets={
  vanguard:{weapon:['Spear','Sword'],armor:['Heavy','Light'],item:['Shield','FireOil','Boots','WarHorn']},
  ranged:{weapon:['Longbow','Bow'],armor:['Light','Heavy'],item:['Boots','FireOil','Shield','WarHorn']},
  support:{weapon:['Spear','Sword','Bow','Longbow'],armor:['Light','Heavy'],item:['Medkit','EngineerKit','TrapKit','WarHorn','Boots','Shield']},
  cavalry:{weapon:['Spear','Sword'],armor:['Light','Heavy'],item:['WarHorn','Boots','Shield','FireOil']}
 };
 const slotFor=key=>weapons.includes(key)?'weapon':armors.includes(key)?'armor':items.includes(key)?'item':key==='Horse'?'mount':null;
 const roleOf=s=>['Medkit','EngineerKit','TrapKit','WarHorn'].includes(s.item)?'support':['Bow','Longbow'].includes(s.weapon)?'ranged':s.mount?'cavalry':'vanguard';
 function plan(units,inventory,{mode='auto',gear=null}={}){
  const stock={...inventory},changes=[],missing=[];
  const ready=units.filter(s=>s.controller==='player'&&s.state!=='knocked');
  const copies=ready.map(s=>({...s}));
  const assign=(s,key)=>{
   const slot=slotFor(key);if(!slot||!(stock[key]>0)||s[slot]===key||(slot==='mount'&&s.mount))return false;
   const before=slot==='mount'?(s.mount?'Horse':'None'):s[slot];
   stock[key]--;if(before&&before!=='None')stock[before]=(stock[before]||0)+1;
   s[slot]=slot==='mount'?true:key;if(slot==='weapon')s.weaponLevel=1;
   changes.push({studentId:s.id,name:s.name,slot,before,after:key});return true;
  };
  if(gear){
   const slot=slotFor(gear);
   if(slot)for(const s of [...copies].sort((a,b)=>(a[slot]==='None'?-1:0)-(b[slot]==='None'?-1:0))){
    if(s[slot]===gear||(slot==='mount'&&s.mount))continue;
    if(!assign(s,gear))missing.push({studentId:s.id,slot,choices:[gear]});
   }
  }else{
   const hasMedic=copies.some(s=>s.item==='Medkit');
   const roles=copies.map((s,i)=>mode==='balanced'?(['vanguard','vanguard','ranged','vanguard','support'][i%5]):mode==='auto'?(s.weapon==='None'&&s.item==='None'?(['vanguard','vanguard','ranged','vanguard','support'][i%5]):roleOf(s)):mode);
   // Keep specialist jobs and forged weapons. Auto equips upgrades, never trades a forged weapon for a level-one spare.
   for(let i=0;i<copies.length;i++){
    const s=copies[i],role=roles[i],preset=presets[role];if(!preset)continue;
    for(const slot of ['weapon','armor','item']){
     let choices=[...preset[slot]],current=s[slot]||'None';
     if(mode==='auto')choices.push(...(slot==='weapon'?weapons:slot==='item'?items:armors).filter(k=>!choices.includes(k)));
     if(mode==='auto'&&slot==='weapon'&&current!=='None'){
      if(s.weaponLevel>1)continue;
      choices=current==='Bow'?['Longbow','Bow']:current==='Longbow'?['Longbow']: [current];
     }
     if(mode==='auto'&&slot==='item'&&current!=='None')continue;
     if(mode==='auto'&&slot==='item'&&role==='support'&&!hasMedic&&!copies.some(t=>t.item==='Medkit'))choices=['Medkit',...choices.filter(k=>k!=='Medkit')];
     const currentIndex=choices.indexOf(current);
     const better=currentIndex<0?choices:choices.slice(0,currentIndex);
     const key=better.find(k=>stock[k]>0);
     if(key)assign(s,key);
     else if(current==='None'||(mode!=='auto'&&currentIndex<0))missing.push({studentId:s.id,slot,choices});
    }
   }
   // Role changes may return gear after an earlier student was processed. Fill those empty slots too.
   if(mode==='auto')for(let i=0;i<copies.length;i++){
    const s=copies[i],preset=presets[roles[i]];
    for(const slot of ['weapon','armor','item'])if(s[slot]==='None'){
     const pool=slot==='weapon'?weapons:slot==='armor'?armors:items;
     const key=[...preset[slot],...pool].find(k=>stock[k]>0);if(key)assign(s,key);
    }
   }
   // Every role benefits from a mount. Give cavalry first access, then use all spare horses for maximum readiness.
   const mountedOrder=[...copies].sort((a,b)=>(roles[copies.indexOf(a)]==='cavalry'?-1:0)-(roles[copies.indexOf(b)]==='cavalry'?-1:0));
   for(const s of mountedOrder)if(!s.mount&&stock.Horse>0)assign(s,'Horse');
   for(const s of copies)if(!s.mount)missing.push({studentId:s.id,slot:'mount',choices:['Horse']});
  }
  const shortages=missing.filter(m=>{const s=copies.find(t=>t.id===m.studentId);return m.slot==='mount'?!s.mount:gear?s[m.slot]!==gear:s[m.slot]==='None'||(mode!=='auto'&&!m.choices.includes(s[m.slot]));});
  return {mode,gear,units:copies,stock,changes,changed:changes.length,students:ready.length,affected:new Set(changes.map(c=>c.studentId)).size,missing:shortages};
 }
 const api={plan,presets,slotFor,roleOf};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else window.AcademyEquipment=api;
})();
