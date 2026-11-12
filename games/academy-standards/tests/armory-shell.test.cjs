const test=require('node:test'),assert=require('node:assert/strict');
const {createApp}=require('./shell-harness.cjs');
test('equipment menu previews role changes, applies on demand and supports gear categories',()=>{
 const {s,a,g,$,doc}=createApp();s.begin();a.selectUnits([g.students[0].id]);const stock=a.getPlayerHouse().stockpile;stock.Longbow=4;stock.Light=4;stock.Boots=4;
 $('equipmentToggle').click();assert.equal(s.ui.drawer,'equipment');assert($('drawer').classList.contains('armory-drawer'));
 const before=g.students[0].weapon;doc.querySelector('[data-loadout="ranged"]').click();assert.equal(g.students[0].weapon,before,'choosing a preset only previews it');assert.match(doc.querySelector('.armory-preview').textContent,/changes/);
 doc.querySelector('[data-apply-loadout]').click();assert.equal(g.students[0].weapon,'Longbow');assert.equal(g.students[0].armor,'Light');
 doc.querySelector('[data-gear-category="weapons"]').click();assert.equal(doc.querySelectorAll('[data-armory-gear]').length,4);assert.match(doc.querySelector('.armory-result').textContent,/Party equipped/);
});
test('whole team quick equip works with an empty selection and keeps all troop checkboxes available',()=>{
 const {s,a,$,doc}=createApp();s.begin();a.selectUnits([]);const stock=a.getPlayerHouse().stockpile;for(const k of a.LOOT_KEYS)stock[k]=20;
 $('equipmentToggle').click();doc.querySelector('[data-team-equip]').click();assert.equal(a.getSelectedUnits().length,0);assert.equal(doc.querySelector('[data-equip-scope="team"]').getAttribute('aria-pressed'),'true');assert.match(doc.querySelector('.armory-result').textContent,/Party equipped/);assert.equal(doc.querySelectorAll('[data-equip-student]').length,10);
});
test('individual checkboxes build a selection without shift and saved squad recipients are independent',()=>{
 const {s,a,g,$,doc,host}=createApp();s.begin();a.selectUnits([]);$('equipmentToggle').click();
 doc.querySelector(`[data-equip-student="${g.students[0].id}"]`).click();doc.querySelector(`[data-equip-student="${g.students[1].id}"]`).click();assert.equal(a.getSelectedUnits().length,2);assert.equal(host.AcademyArmory.state.scope,'selected');
 a.saveSquad(2);a.selectUnits([g.students[5].id]);s.update(a);doc.querySelector('[data-equip-scope="2"]').click();assert.equal(a.equipmentTargets('2').length,2);assert.equal(a.getSelectedUnits().length,1);assert.equal(host.AcademyArmory.state.scope,'2');
});
test('hidden flag carriers and capture progress do not leak positions into mission or minimap',()=>{
 const {s,a,g,$}=createApp();s.begin();const thief=g.students.find(t=>t.controller==='mars'),own=a.getStandard('player');own.carriedBy=thief.id;thief.carryingStandard='player';a.refreshVisibility(true);s.update(a);s.drawMinimap(a);
 assert.equal($('flagStatusTitle').textContent,'YOUR FLAG STOLEN');assert.equal(s.ui.flagState.studentId,undefined);assert.equal(s.ui.flagState.focus,a.getPlayerHouse().castle);assert(!s.ui.mapMarkers.carriers.some(c=>c.studentId===thief.id));
 own.carriedBy=null;thief.carryingStandard=null;g.flagTargetId='mars';const flag=a.getStandard('mars');flag.captureContested=true;flag.captureInterruptedUntil=g.time+10;s.update(a);assert.match($('flagStatusTitle').textContent,/SCOUT/);assert.equal($('flagStatusProgress').style.width,'0%');
});
test('field guide explains fog and uses the production terrain artwork',()=>{
 const {s,$,doc}=createApp();s.begin();$('helpToggle').click();assert.equal(s.ui.drawer,'strategy');assert.match($('drawerBody').textContent,/Unexplored ground is hidden/);assert.equal(doc.querySelectorAll('.terrain-thumb').length,7);
});
