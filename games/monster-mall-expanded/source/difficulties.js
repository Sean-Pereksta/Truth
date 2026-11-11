/* Escape rules are shared by the menu, world interactions and ending gate. */
export const MALL_TASKS = Object.freeze([
 {id:'keycard',name:'Recover the security keycard',location:'Night Owl Books · east, Level 01',x:20,y:0,z:-35,action:'Take security keycard'},
 {id:'valve',name:'Close the leaking coolant valve',location:'West maintenance · northwest staff corridor',x:-38,y:0,z:-49,action:'Close coolant valve'},
 {id:'relay',name:'Reset the gallery relay',location:'Upper east gallery · Level 02',x:13,y:4.4,z:35,action:'Reset gallery relay',requiresPower:true},
 {id:'crank',name:'Release the exit shutter with its crank',location:'Crank: west deliveries · shutter: south concourse',x:5,y:0,z:52,action:'Wind open the exit shutter',requiresPower:true},
 {id:'lockdown',name:'Cancel the security lockdown',location:'Security terminal · north concourse',x:4,y:0,z:-53,action:'Cancel security lockdown',requiresPower:true}
]);
export const MALL_DIFFICULTIES = Object.freeze({
 easy:{name:'Easy',tier:1,flashes:5,stun:6,description:'Two beasts. Slower reactions and short memories. One extra escape task.'},
 normal:{name:'Normal',tier:2,flashes:3,stun:5,description:'Three beasts track noise and search your last known position. Two extra tasks.'},
 hard:{name:'Hard',tier:3,flashes:3,stun:4.2,description:'Faster chases. Hunters anticipate your route and search longer. Three extra tasks.'},
 nightmare:{name:'Nightmare',tier:4,flashes:2,stun:3.5,description:'Rapid hunters share sightings and flank your escape route. Four extra tasks.'},
 insane:{name:'Insane',tier:5,flashes:2,stun:3,description:'The fastest pursuit, coordinated searches, five extra tasks, and The Still One. Watch it. Do not turn away.'}
});
export function createEscapeObjectives(difficulty='normal') {
 const key=Object.hasOwn(MALL_DIFFICULTIES,difficulty)?difficulty:'normal';
 const tasks=MALL_TASKS.slice(0,MALL_DIFFICULTIES[key].tier).map(task=>({...task,done:false}));
 let hasCrank=false;
 return {difficulty:key,tasks,
  get hasCrank(){return hasCrank;},takeCrank(){hasCrank=true;},
  complete(id,powered){const task=tasks.find(t=>t.id===id);if(!task||task.done)return false;if(task.requiresPower&&!powered)return false;if(id==='crank'&&!hasCrank)return false;if(id==='lockdown'&&tasks.some(t=>t.id!==id&&!t.done))return false;task.done=true;return true;},
  get remaining(){return tasks.filter(t=>!t.done);},
  canEscape(powered){return !!powered&&tasks.every(t=>t.done);}
 };
}
