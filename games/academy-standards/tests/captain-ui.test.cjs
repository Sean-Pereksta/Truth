const test=require('node:test');
const assert=require('node:assert/strict');
const {createApp}=require('./shell-harness.cjs');

const studentCard=(doc,id)=>doc.querySelector(`.roster-card[data-student="${id}"]`);
const inspectButton=(doc,id)=>doc.querySelector(`button[data-inspect-student="${id}"]`);
const detail=(doc,id)=>studentCard(doc,id).closest('.roster-entry').querySelector('.student-detail');
const selected=g=>Array.from(g.selected).sort();
function compactRows(doc){
 for(const card of doc.querySelectorAll('.roster-card')){
  assert.doesNotMatch(card.textContent,/Rally intact|Recruited|Morale shaken|-23%|-15%|-10%|House captain|\b(?:Sword|Spear|Bow|Longbow|Shield|Boots|Light armor|Heavy armor|Medic kit|Engineer kit|Trap kit|War horn|Fire oil)\b/,'list rows contain only the compact name, health, role, and captain icon');
  assert.equal(card.querySelector('.student-status'),null,'status details do not repeat inside the selection button');
 }
}

test('the default roster keeps captain identity accessible while keeping student rows compact',()=>{
 const {s,$,doc}=createApp();s.begin();$('rosterToggle').click();
 assert.equal(s.ui.drawer,'roster');
 const captain=studentCard(doc,'player_0'),student=studentCard(doc,'player_1');
 assert.equal(captain.querySelector('.captain-marker').getAttribute('aria-label'),'House captain');
 assert.equal(student.querySelector('.captain-marker'),null);
 assert.equal(doc.querySelectorAll('.captain-marker').length,1);
 assert.equal(doc.querySelectorAll('.roster-entry').length,10);
 assert.equal(doc.querySelectorAll('.student-detail').length,0);assert.equal(s.ui.inspectStudentId,null);
 assert.match(captain.textContent,/128 HP/);assert.match(captain.textContent,/Vanguard/);
 for(const button of doc.querySelectorAll('[data-inspect-student]'))assert.equal(button.getAttribute('aria-expanded'),'false');
 compactRows(doc);
});

test('inspection reveals equipment and status for one student at a time without selecting them',()=>{
 const {s,a,g,$,doc}=createApp();s.begin();a.selectUnits([]);$('rosterToggle').click();
 inspectButton(doc,'player_0').click();
 assert.equal(s.ui.inspectStudentId,'player_0');assert.equal(inspectButton(doc,'player_0').getAttribute('aria-expanded'),'true');assert.deepEqual(selected(g),[]);
 assert.equal(doc.querySelectorAll('.student-detail').length,1);
 const captainDetail=detail(doc,'player_0');assert(captainDetail);assert.match(captainDetail.textContent,/Sword/);assert.match(captainDetail.textContent,/Heavy armor/);assert.match(captainDetail.textContent,/Shield/);assert.match(captainDetail.textContent,/House captain/);assert.doesNotMatch(captainDetail.textContent,/Rally intact/);
 inspectButton(doc,'player_1').click();
 assert.equal(s.ui.inspectStudentId,'player_1');assert.equal(doc.querySelectorAll('.student-detail').length,1);assert.equal(detail(doc,'player_0'),null);assert(detail(doc,'player_1'));
 assert.equal(inspectButton(doc,'player_0').getAttribute('aria-expanded'),'false');assert.equal(inspectButton(doc,'player_1').getAttribute('aria-expanded'),'true');
 inspectButton(doc,'player_1').click();assert.equal(s.ui.inspectStudentId,null);assert.equal(doc.querySelectorAll('.student-detail').length,0);assert.deepEqual(selected(g),[]);
 compactRows(doc);
});

test('compact roster selection and shift selection keep their existing behavior',()=>{
 const {s,a,g,$,doc}=createApp();s.begin();a.selectUnits([]);$('rosterToggle').click();
 studentCard(doc,'player_1').click();assert.deepEqual(selected(g),['player_1']);assert.equal(studentCard(doc,'player_1').getAttribute('aria-pressed'),'true');
 studentCard(doc,'player_2').click({shiftKey:true});assert.deepEqual(selected(g),['player_1','player_2']);
 studentCard(doc,'player_1').click({shiftKey:true});assert.deepEqual(selected(g),['player_2']);assert.equal(studentCard(doc,'player_1').getAttribute('aria-pressed'),'false');
 studentCard(doc,'player_3').click();assert.deepEqual(selected(g),['player_3']);
});

test('a recovering student can be inspected while remaining unavailable for selection',()=>{
 const {s,a,g,$,doc,host}=createApp();s.begin();host.AcademyTest.knockOut(g.students.find(unit=>unit.id==='player_0'),{controller:'mars'});a.selectUnits(['player_1']);$('rosterToggle').click();
 assert.match(studentCard(doc,'player_0').textContent,/Recovering/);
 inspectButton(doc,'player_0').click();assert.equal(s.ui.inspectStudentId,'player_0');assert(detail(doc,'player_0'));assert.match(detail(doc,'player_0').textContent,/House captain/);
 studentCard(doc,'player_0').click();assert.deepEqual(selected(g),['player_1']);assert.equal(s.ui.inspectStudentId,'player_0');
});

test('recruited houses stay compact and grouped while inspected morale updates through recovery',()=>{
 const {s,a,g,$,doc,host}=createApp(),T=host.AcademyTest;s.begin();
 T.transferHouse('mars','player');$('rosterToggle').click();
 const captain=g.students.find(unit=>unit.id==='mars_0');
 T.knockOut(captain,{controller:'diana'});s.update(a);
 assert.equal(doc.querySelectorAll('.roster-entry').length,20);assert.equal(doc.querySelectorAll('.student-detail').length,0);compactRows(doc);
 const ids=doc.querySelectorAll('.roster-entry').map(entry=>entry.querySelector('[data-student]').dataset.student);
 const houses=ids.map(id=>g.students.find(unit=>unit.id===id).origHouse);
 assert.equal(houses.filter(id=>id==='player').length,10);assert.equal(houses.filter(id=>id==='mars').length,10);
 assert.equal(houses.filter((house,index)=>!index||house!==houses[index-1]).length,2,'each original house occupies one contiguous group');
 assert.equal(studentCard(doc,captain.id).querySelector('.captain-marker').getAttribute('aria-label'),'House captain');
 inspectButton(doc,'mars_1').click();
 assert.match(detail(doc,'mars_1').textContent,/Recruited · -23% damage & movement/);
 assert.match(detail(doc,'mars_1').textContent,/Morale shaken · 20s · -15% damage & -10% movement/);compactRows(doc);
 g.time+=4;s.update(a);
 assert.match(detail(doc,'mars_1').textContent,/Morale shaken · 16s/);

 T.respawnStudent(captain);s.update(a);
 assert.doesNotMatch(detail(doc,'mars_1').textContent,/Morale shaken|Rally intact/);
 assert.match(detail(doc,'mars_1').textContent,/Recruited · -23% damage & movement/);
 inspectButton(doc,'player_1').click();assert.equal(doc.querySelectorAll('.student-detail').length,1);assert.doesNotMatch(detail(doc,'player_1').textContent,/Recruited|Morale shaken|Rally intact/);compactRows(doc);
});

test('help explains central scarcity, captain recovery and the separate recruited weakness',()=>{
 const {$}=createApp();$('howToPlay').click();
 const help=$('modalBody').textContent;
 assert.match(help,/Almost all supplies lie in the center; home deliveries are rare/);
 assert.match(help,/gold crown/);
 assert.match(help,/-15% damage and -10% movement for up to 20 seconds/);
 assert.match(help,/recovery rallies them early/);
 assert.match(help,/Captured recruits have a separate -23% damage and movement/);
 assert.match(help,/Both weaknesses can apply together/);
});
