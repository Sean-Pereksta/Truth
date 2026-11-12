const test=require('node:test');
const assert=require('node:assert/strict');
const {createApp}=require('./shell-harness.cjs');

const studentCard=(doc,id)=>doc.querySelector(`[data-student="${id}"]`);

test('the roster button identifies the original house captain without marking ordinary students',()=>{
 const {s,$,doc}=createApp();s.begin();$('rosterToggle').click();
 assert.equal(s.ui.drawer,'roster');
 const captain=studentCard(doc,'player_0'),student=studentCard(doc,'player_1');
 assert.match(captain.querySelector('.captain-tag').textContent,/House captain/);
 assert.equal(student.querySelector('.captain-tag'),null);
 assert.match(student.querySelector('.student-status').textContent,/Rally intact/);
 assert.equal(doc.querySelectorAll('.captain-tag').length,1);
});

test('captured recruits display their lasting penalty separately from their captain morale countdown',()=>{
 const {s,a,g,$,doc,host}=createApp(),T=host.AcademyTest;s.begin();
 T.transferHouse('mars','player');$('rosterToggle').click();
 const captain=g.students.find(unit=>unit.id==='mars_0');
 assert.match(studentCard(doc,'mars_1').textContent,/Recruited · -23% damage & movement/);
 assert.match(studentCard(doc,captain.id).querySelector('.captain-tag').textContent,/House captain/);
 assert.doesNotMatch(studentCard(doc,'player_1').textContent,/Recruited/);

 T.knockOut(captain,{controller:'diana'});s.update(a);
 assert.match(studentCard(doc,'mars_1').textContent,/Morale shaken · 20s · -15% damage & -10% movement/);
 assert.doesNotMatch(studentCard(doc,'player_1').textContent,/Morale shaken/);
 assert.match(studentCard(doc,'player_1').textContent,/Rally intact/);
 g.time+=4;s.update(a);
 assert.match(studentCard(doc,'mars_1').textContent,/Morale shaken · 16s/);

 T.respawnStudent(captain);s.update(a);
 assert.doesNotMatch(studentCard(doc,'mars_1').textContent,/Morale shaken/);
 assert.match(studentCard(doc,'mars_1').textContent,/Rally intact/);
 assert.match(studentCard(doc,'mars_1').textContent,/Recruited · -23% damage & movement/);
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
