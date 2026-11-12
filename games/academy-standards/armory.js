(() => {
 'use strict';
 const state={scope:'selected',mode:'auto',category:'all',gear:null,report:'',open:false};
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const icon=x=>`<svg aria-hidden="true"><use href="#i-${x}"/></svg>`;
 const names={Light:'Light armor',Heavy:'Heavy armor',Medkit:'Medic kit',EngineerKit:'Engineer kit',TrapKit:'Trap kit',WarHorn:'War horn',FireOil:'Fire oil'};
 const label=x=>names[x]||x;
 const descriptions={Sword:'Fast close combat',Spear:'Reach · counters cavalry',Bow:'Ranged attacks',Longbow:'Longest weapon range',Light:'Faster movement',Heavy:'More health & protection',Shield:'Blocks frontal arrows',Boots:'Faster movement',Medkit:'Heals nearby allies',Horse:'Speed & extra health',EngineerKit:'Build barricades',TrapKit:'Build slowing traps',WarHorn:'Speed & damage',FireOil:'Damage & burning'};
 const modes=[['auto','spark','Best available','Fill slots & upgrade, keep jobs'],['balanced','party','Balanced team','Front line, archers & medics'],['vanguard','shield','Vanguard','Spears, heavy armor & shields'],['ranged','bow','Archers','Longbows, mobility & range'],['support','cross','Support','Healing & engineer equipment'],['cavalry','sword','Cavalry','Horses, spears & mobility']];
 function render(api){
  const g=api.game,stock=api.getPlayerHouse().stockpile,targets=api.equipmentTargets(state.scope);
  const plan=api.planEquipment({scope:state.scope,mode:state.mode,gear:state.gear});
  const categories={all:api.LOOT_KEYS,weapons:['Sword','Spear','Bow','Longbow'],armor:['Light','Heavy'],special:['Shield','Boots','Medkit','EngineerKit','TrapKit','WarHorn','FireOil'],mounts:['Horse']};
  return `<div class="armory-hero"><div><span class="eyebrow">QUICK OUTFIT</span><b>Get everyone battle ready</b><small>Uses shared supplies. Best available keeps forged weapons and specialist jobs.</small></div><button class="primary-button" data-team-equip>${icon('spark')}Best gear · whole team</button></div>
   <div class="armory-step"><span>1</span><b>Choose who to equip</b><small>${targets.length} ready</small></div>
   <div class="armory-scopes" role="group" aria-label="Equipment recipients">${[['selected','Current selection'],['team','Whole team'],['2',api.getSquadName(2)],['3',api.getSquadName(3)],['4',api.getSquadName(4)]].map(([value,title])=>`<button data-equip-scope="${value}" aria-pressed="${state.scope===value}" class="${state.scope===value?'active':''}">${esc(title)}</button>`).join('')}</div>
   <details class="armory-students" ${state.open?'open':''}><summary>Choose individual students <small>Checkboxes build your selection</small></summary><div>${g.students.filter(s=>s.controller==='player').map(s=>`<label class="armory-student"><input type="checkbox" data-equip-student="${s.id}" ${g.selected.has(s.id)?'checked':''} ${s.state==='knocked'?'disabled':''}><span><b>${esc(s.name)}</b><small>${s.state==='knocked'?'Recovering':esc(s.weapon)+(s.weapon!=='None'?' Lv.'+(s.weaponLevel||1):'')+' · '+esc(label(s.armor))+' · '+esc(label(s.item))+(s.mount?' · Horse':'')}</small></span></label>`).join('')}</div></details>
   <div class="armory-step"><span>2</span><b>Choose a loadout</b></div><div class="preset-grid armory-presets">${modes.map(([value,glyph,title,detail])=>`<button data-loadout="${value}" aria-pressed="${state.mode===value&&!state.gear}" class="${state.mode===value&&!state.gear?'active':''}">${icon(glyph)}<span>${title}<small>${detail}</small></span></button>`).join('')}</div>
   <div class="armory-preview" aria-live="polite"><div><b>${state.gear?'Assign '+esc(label(state.gear)):esc(modes.find(m=>m[0]===state.mode)?.[2]||'Best available')}</b><span>${plan.changed} changes · ${plan.affected} of ${plan.students} students</span></div><p>${plan.missing.length?plan.missing.length+' requested slots lack supplies. Available changes can still be applied.':'Everyone has the requested equipment.'} Replaced gear returns to supplies.${state.mode!=='auto'&&!state.gear?' Changing a weapon for a new role resets its forge level.':''}</p>${plan.changed?`<details><summary>Review changes</summary><ul>${plan.changes.map(c=>`<li>${esc(c.name)} · ${esc(label(c.before))} → <b>${esc(label(c.after))}</b></li>`).join('')}</ul></details>`:''}<button class="primary-button" data-apply-loadout ${plan.changed?'':'disabled'}>Apply to ${plan.students} students ${icon('arrow')}</button></div>
   ${state.report?`<p class="armory-result" role="status">${esc(state.report)}</p>`:''}
   <div class="armory-step"><span>3</span><b>Fine-tune equipment</b><small>${api.LOOT_KEYS.reduce((n,k)=>n+(stock[k]||0),0)} supplies</small></div><p>Pick an item to preview assigning it to everyone in your group. Empty slots are filled first. Changing a weapon starts its forge level at 1.</p><div class="armory-tabs" role="group" aria-label="Supply category">${Object.keys(categories).map(cat=>`<button data-gear-category="${cat}" aria-pressed="${state.category===cat}" class="${state.category===cat?'active':''}">${{all:'All gear',weapons:'Weapons',armor:'Armor',special:'Specialist',mounts:'Mounts'}[cat]}</button>`).join('')}</div><div class="gear-grid">${categories[state.category].map(k=>`<button class="gear-item ${state.gear===k?'active':''}" data-armory-gear="${k}" ${stock[k]>0?'':'disabled'} title="Preview ${esc(label(k))}"><span>${esc(label(k))}<small>${descriptions[k]}</small></span><b>${stock[k]||0}</b></button>`).join('')}</div><div class="drawer-label">Engineer orders</div><div class="build-row"><button data-build="barricade">Barricade <kbd>B</kbd></button><button data-build="trap">Trap <kbd>T</kbd></button></div>`;
 }
 function handleClick(e,api,toast){
  const find=selector=>e.target.closest(selector);let b;
  state.open=!!document.querySelector('.armory-students')?.open;
  if(b=find('[data-equip-scope]')){state.scope=b.dataset.equipScope;state.report='';}
  else if(b=find('[data-loadout]')){state.mode=b.dataset.loadout;state.gear=null;state.report='';}
  else if(b=find('[data-gear-category]'))state.category=b.dataset.gearCategory;
  else if(b=find('[data-armory-gear]')){state.gear=b.dataset.armoryGear;state.report='';}
  else if(find('[data-team-equip]')){const result=api.applyEquipment({scope:'team',mode:'auto'});state.scope='team';state.mode='auto';state.gear=null;state.report=result.report;toast(result.report);}
  else if(find('[data-apply-loadout]')){const result=api.applyEquipment({scope:state.scope,mode:state.mode,gear:state.gear});state.report=result.report;toast(result.report);}
  else if(b=find('[data-equip-student]')){
   const ids=new Set(api.getSelectedUnits().map(s=>s.id));b.checked?ids.add(b.dataset.equipStudent):ids.delete(b.dataset.equipStudent);
   api.selectUnits([...ids],false);state.scope='selected';state.report='';state.open=true;
  }else return false;
  return true;
 }
 window.AcademyArmory={render,handleClick,state};
})();
