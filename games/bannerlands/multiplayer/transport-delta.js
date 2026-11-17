// Read-only snapshot transport. Stable entity IDs let a quiet building or an
// unchanged soldier order avoid being serialized on every network update.
const entityKeys=new Set(['units','buildings','teams','standards','projectiles','effects','fireZones','castles','objectives','events']);
const objectKeys=new Set(['territory','fog','aftermath']);
function same(a,b){
  if(a===b)return true;
  if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return false;
  if(Array.isArray(a)){if(!Array.isArray(b)||a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(!same(a[i],b[i]))return false;return true;}
  let count=0;for(const key in a){count++;if(!Object.hasOwn(b,key)||!same(a[key],b[key]))return false;}for(const key in b)count--;return count===0;
}
function changedFields(old,entity){
  let changes=null,unset=null;
  for(const name in entity)if(!same(entity[name],old[name])){if(!changes)changes={id:entity.id};changes[name]=entity[name];}
  for(const name in old)if(!Object.hasOwn(entity,name)){if(!unset)unset=[];unset.push(name);}
  return changes||unset?{values:changes||{id:entity.id},unset:unset||[]}:null;
}
function entityDelta(before,after,patchCache){
  const previous=new Map();for(let i=0;i<(before?.length||0);i++)previous.set(before[i].id,i);
  const upsert=[],update=[];
  let lastIndex=-1,reordered=false;
  for(const entity of after){
    const index=previous.get(entity.id);
    if(index===undefined){upsert.push(entity);continue;}
    previous.delete(entity.id);
    if(index<lastIndex||upsert.length)reordered=true;
    lastIndex=index;
    const old=before[index];
    // Multiple guests may hold these same two immutable, filtered unit views.
    // A reconnect with a different baseline must calculate its own patch.
    const cached=patchCache?.get(entity);
    let patch;
    if(cached?.before===old)patch=cached.patch;
    else{
      patch=changedFields(old,entity);
      if(patchCache)patchCache.set(entity,{before:old,patch});
    }
    if(patch)update.push(patch);
  }
  const remove=[...previous.keys()];
  if(reordered)return {upsert,update,remove,order:after.map(entity=>entity.id)};
  return upsert.length||update.length||remove.length?{upsert,update,remove}:null;
}
export function createSnapshotDelta(before,after,base,sequence,unitPatchCache){
  const fields={},entities={},objects={};
  for(const key in after){const value=after[key];
    if(key==='terrain')continue;
    if(entityKeys.has(key)&&Array.isArray(value)&&value.every(x=>x&&Number.isSafeInteger(x.id))){
      const changes=entityDelta(before[key],value,key==='units'?unitPatchCache:null);if(changes)entities[key]=changes;
    }else if(objectKeys.has(key)&&value&&typeof value==='object'){
      const previous=before[key]||{},set={},unset=[];let changed=false;
      for(const name in value){
        if(key==='aftermath'&&name==='bodies'&&Array.isArray(value.bodies)&&value.bodies.every(body=>body&&Number.isSafeInteger(body.id))){const changes=entityDelta(previous.bodies,value.bodies);if(changes)entities['aftermath.bodies']=changes;}
        else if(!same(value[name],previous[name])){set[name]=value[name];changed=true;}
      }
      for(const name in previous)if(!Object.hasOwn(value,name)){unset.push(name);changed=true;}
      if(changed)objects[key]={set,unset};
    }else if(!same(value,before[key]))fields[key]=value;
  }
  return {base,sequence,fields,entities,objects};
}
export function applySnapshotDelta(previous,delta){
  if(!previous||previous.sequence!==delta.base)throw new Error('Snapshot baseline was missed. Request initial synchronization.');
  const result={...previous,...delta.fields,sequence:delta.sequence};
  for(const [key,change]of Object.entries(delta.objects||{})){result[key]={...previous[key],...change.set};for(const name of change.unset||[])delete result[key][name];}
  for(const [key,change]of Object.entries(delta.entities||{})){
    const nested=key==='aftermath.bodies',old=nested?previous.aftermath?.bodies:previous[key],entities=new Map((old||[]).map(x=>[x.id,x]));
    for(const id of change.remove||[])entities.delete(id);
    for(const item of change.upsert||[])entities.set(item.id,item);
    for(const patch of change.update||[]){const old=entities.get(patch.values.id);if(!old)throw new Error('Missing synchronized entity.');const next={...old,...patch.values};for(const name of patch.unset||[])delete next[name];entities.set(next.id,next);}
    const values=change.order?change.order.map(id=>entities.get(id)):[...entities.values()];
    if(nested)result.aftermath={...(result.aftermath||previous.aftermath),bodies:values};else result[key]=values;
  }
  return result;
}
