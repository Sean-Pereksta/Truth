/* Portable pilot builds and the local hero roster. The expedition checkpoint
   belongs to the team; these records belong to each individual pilot. */
(() => {
  'use strict';
  const format='cinder-relay.hero',version=1,prefix='cinderRelay.hero.v1.';
  const maxName=32,maxBytes=256*1024,maxInteger=Number.MAX_SAFE_INTEGER-1;
  const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,72}$/.test(id);
  const fail=message=>{throw new Error(message);};
  const invalid=label=>fail('Invalid hero file: '+label+'.');
  const choices=(value,options,label)=>options.includes(value)?value:invalid(label);
  const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
  function object(value,label){
    if(!value||typeof value!=='object'||Array.isArray(value))invalid(label);
    return value;
  }
  function integer(value,min,max,label){
    if(!Number.isSafeInteger(value)||value<min||value>max)invalid(label);
    return value;
  }
  function array(value,min,max,label){
    if(!Array.isArray(value)||value.length<min||value.length>max)invalid(label);
    return value;
  }
  function unique(values,label){
    if(new Set(values).size!==values.length)invalid('duplicate '+label);
    return values;
  }
  function nameOf(value,fallback){
    if(value==null||value==='')value=fallback;
    if(typeof value!=='string')invalid('hero name');
    const name=value.normalize('NFC').trim()||fallback;
    if(!name||[...name].length>maxName||/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(name))
      fail('Choose a hero name of 1–32 printable characters.');
    return name;
  }
  function catalogId(value,catalog,label){
    if(!Number.isSafeInteger(value)||value<0||catalog[value]?.id!==value)invalid(label);
    return value;
  }
  function slots(value,size,label){
    const pair=array(value,2,2,label).map(i=>integer(i,-1,size-1,label));
    if(pair.every(i=>i===-1)||(pair[0]>=0&&pair[0]===pair[1]))invalid(label);
    return pair;
  }
  function readGun(value,local){
    const w=object(value,'gun'),id=catalogId(w.id,Combat.guns,'gun model');
    const {forgeTier}=Combat.guns[id];
    const affixes=Combat.eligibleAffixes(id);
    const rarity=local?Combat.rarityOf(w):w.rarity;
    const rarities=forgeTier?[forgeTier]:Combat.rarityOdds.map(t=>t.name);
    return {id,
      rarity:choices(rarity,rarities,'gun rarity'),
      upgradeLevel:integer(w.upgradeLevel??(local?Combat.rankOf(w):undefined),0,3,'gun upgrade'),
      prefix:choices(w.prefix??'',['',...affixes.prefix],'gun prefix'),
      suffix:choices(w.suffix??'',['',...affixes.suffix],'gun suffix'),
      chip:choices(w.chip??'',['',...Combat.compatibleChips(id)],'installed gun chip')};
  }
  function readAbility(value,local){
    const a=object(value,'ability'),id=catalogId(a.id,Combat.abilities,'ability model');
    const augment=integer(a.augment??0,0,2,'ability augment');
    const learned=unique(array(a.learned??(local&&augment?[augment]:[]),0,2,'learned augments')
      .map(n=>integer(n,1,2,'learned augment')),'learned augment').sort();
    if(augment&&!learned.includes(augment))invalid('equipped augment has not been learned');
    return {id,augment,learned};
  }
  function readBuild(data,local=false){
    const v=object(data,'equipment'),kitId=catalogId(v.kitId??(local?0:undefined),Progress.kits,'pilot class');
    const level=integer(v.level,1,maxInteger,'pilot level');
    const xp=v.xp;
    if(typeof xp!=='number'||!Number.isFinite(xp)||xp<0||xp>=Progress.levelXP(level))invalid('level experience');
    const guns=array(v.guns,1,4,'weapon inventory').map(w=>readGun(w,local));
    const abilities=array(v.abilities,1,4,'ability inventory').map(a=>readAbility(a,local));
    unique(abilities.map(a=>a.id),'ability');
    const ready=slots(v.ready,guns.length,'ready weapon slots'),selected=integer(v.selected??0,0,1,'selected weapon');
    if(ready[selected]<0)invalid('selected weapon slot is empty');
    const activeSlots=slots(v.activeSlots,abilities.length,'active ability slots');
    const suits=unique(array(v.suits,1,2,'armor inventory').map(id=>catalogId(id,Progress.suits,'armor model')),'armor');
    const suit=choices(v.suit,suits,'equipped armor'),suitRolls={};
    const rawRolls=object(v.suitRolls??{},'armor rolls');
    for(const [key,data] of Object.entries(rawRolls)){
      if(!suits.some(id=>String(id)===key))invalid('armor roll for an unowned suit');
      const roll=object(data,'armor roll');
      suitRolls[key]={prefix:choices(roll.prefix??'',['',...Object.keys(Progress.armorPrefixes)],'armor prefix'),
        suffix:choices(roll.suffix??'',['',...Object.keys(Progress.armorSuffixes)],'armor suffix')};
    }
    const upgrades={},raw=object(v.upgrades??{},'upgrades');
    for(const key of Object.keys(raw).sort()){
      const def=Progress.passives.find(p=>p.name===key);
      if(!def)invalid('unknown upgrade');
      const rank=integer(raw[key],0,def.cap,'upgrade rank');
      if(rank)upgrades[key]=rank;
    }
    const passiveNames=Progress.passives.filter(d=>d.line==='Keystone').map(d=>d.name);
    const keystones=unique(array(v.keystones??[],0,passiveNames.length,'keystones')
      .map(name=>choices(name,passiveNames,'keystone')),'keystone');
    const keystoneSlots=array(v.keystoneSlots??[],0,2,'slotted keystones')
      .map(name=>choices(name??'',['',...keystones],'slotted keystone'));
    unique(keystoneSlots.filter(Boolean),'slotted keystone');
    const clockNames=Progress.overclocks.map(item=>item.name);
    const overclocks=unique(array(v.overclocks??[],0,clockNames.length,'overclocks')
      .map(n=>choices(n,clockNames,'overclock')),'overclock');
    const overclock=choices(v.overclock??'',['',...overclocks],'equipped overclock');
    const chips=array(v.chips??[],0,maxBytes,'spare chips').map(n=>choices(n,Combat.chips,'spare chip'));
    const skin=v.skin==null?null:catalogId(v.skin,Progress.suits,'armor appearance');
    return {kitId,level,xp,pendingLevels:integer(v.pendingLevels??0,0,level-1,'unspent level selections'),
      scrap:integer(v.scrap??0,0,maxInteger,'scrap'),guns,ready,selected,abilities,activeSlots,
      suits,suit,suitRolls,upgrades,keystones,keystoneSlots,overclocks,overclock,chips,skin,
      activeCaches:integer(v.activeCaches??0,0,maxInteger,'ability caches')};
  }
  function readRecord(value){
    const r=object(value,'hero record');
    if(!validId(r.id))invalid('hero ID');
    if(r.originId!==undefined&&!validId(r.originId))invalid('source hero ID');
    const build=readBuild(r.build);
    return {id:r.id,name:nameOf(r.name,''),revision:integer(r.revision,1,maxInteger,'hero revision'),
      updatedAt:integer(r.updatedAt,0,maxInteger,'save date'),kitId:build.kitId,level:build.level,xp:build.xp,
      ...(r.originId?{originId:r.originId}:{}),build};
  }
  function store(){
    try{if(window.localStorage)return window.localStorage;}catch{}
    return fail('Hero storage is unavailable in this browser.');
  }
  function storageGet(key){
    try{return store().getItem(key);}catch{return fail('The local hero roster could not be read.');}
  }
  function get(id){
    if(!validId(id))return null;
    const json=storageGet(prefix+id);
    if(json===null)return null;
    try{
      const record=readRecord(JSON.parse(json));
      if(record.id!==id)invalid('stored hero ID');
      return record;
    }catch{return fail('This saved hero could not be read.');}
  }
  function list(){
    const records=[];
    let s;
    try{s=store();}catch{return records;}
    for(let i=0;i<s.length;i++){
      const key=s.key(i);
      if(!key?.startsWith(prefix))continue;
      try{const record=get(key.slice(prefix.length));if(record)records.push(record);}catch{/* Preserve an unreadable record intact. */}
    }
    return records.sort((a,b)=>b.updatedAt-a.updatedAt||a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
  }
  function freshId(){
    for(let tries=0;tries<12;tries++){
      const token=window.crypto?.randomUUID?.()??(Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+tries);
      const id='h-'+token;
      if(storageGet(prefix+id)===null)return id;
    }
    return fail('A new hero ID could not be created. Try saving again.');
  }
  function packet(record){
    return JSON.stringify({format,version,hero:{id:record.id,name:record.name,revision:record.revision,
      updatedAt:record.updatedAt,build:record.build}},null,2);
  }
  const bytes=text=>new TextEncoder().encode(text).length;
  function put(record){
    if(bytes(packet(record))>maxBytes)fail('This hero is too large for the portable file format.');
    try{store().setItem(prefix+record.id,JSON.stringify(record));}catch{return fail('Hero could not be saved. Browser storage may be full or disabled.');}
    return record;
  }
  function same(a,b){return a.name===b.name&&JSON.stringify(a.build)===JSON.stringify(b.build);}
  function save(player,name,existingId=null,expectedRevision=player?.heroRevision){
    const build=readBuild(player,true);
    if(existingId!==null&&!validId(existingId))fail('Select a valid hero before saving.');
    const prior=existingId?get(existingId):null;
    const pilotName=nameOf(name,player.heroName||prior?.name||Progress.kits[build.kitId].name);
    const samePilot=prior&&player.heroId===existingId;
    if(samePilot&&same(prior,{name:pilotName,build}))return prior;
    const current=samePilot&&expectedRevision===prior.revision;
    const id=current?existingId:freshId(),revision=current?prior.revision+1:1;
    return put({id,name:pilotName,revision,updatedAt:Date.now(),kitId:build.kitId,level:build.level,xp:build.xp,
      ...(current&&prior.originId?{originId:prior.originId}:{}),build});
  }
  function load(id){
    const hero=get(id);if(!hero)fail('This hero is no longer in your roster.');
    const b=hero.build,p=Progress.newPlayer(b.kitId);
    Object.assign(p,b,{heroId:id,heroName:hero.name,heroRevision:hero.revision});
    p.guns=b.guns.map(w=>Object.assign(Combat.makeGun(w.id),w));
    p.abilities=b.abilities.map(a=>Object.assign(Combat.makeAbility(a.id),a));
    Progress.recalc({player:p});
    p.hp=p.maxHp;p.shield=p.maxShield;
    for(const w of p.guns)w.ammo=w.capacity=Combat.capacity({player:p},w);
    return p;
  }
  function exportJSON(id){
    const r=get(id);if(!r)fail('Choose a saved hero to export.');
    return packet(r);
  }
  function importJSON(text){
    if(typeof text!=='string'||text.length>maxBytes||bytes(text)>maxBytes)fail('Choose a hero JSON file under 256 KB.');
    let file;
    try{file=JSON.parse(text.replace(/^\uFEFF/,''));}catch{fail('This file does not contain valid hero JSON.');}
    if(file?.format!==format)fail('Choose a Cinder Relay hero file.');
    if(file.version!==version)fail('This hero file version is not supported.');
    const incoming=readRecord(file.hero),original=get(incoming.id);
    if(original&&same(original,incoming))return original;
    const fork=list().find(r=>r.originId===incoming.id&&same(r,incoming));
    if(fork)return fork;
    const id=original?freshId():incoming.id;
    return put({...incoming,id,revision:1,updatedAt:Date.now(),...(original?{originId:incoming.id}:{originId:undefined})});
  }
  function checkCrew(ids){
    if(!Array.isArray(ids)||ids.length<1||ids.length>2)fail('Choose one or two pilots.');
    const selected=ids.filter(id=>id!=null&&id!=='');
    if(new Set(selected).size!==selected.length)fail('Each pilot needs a different saved hero.');
    for(const id of selected)if(!get(id))fail('A selected hero is no longer in your roster.');
    return true;
  }
  window.HeroRoster={maxName,maxBytes,list,get,save,load,exportJSON,importJSON,checkCrew,nameFor:nameOf,
    buildKey:player=>JSON.stringify(readBuild(player,true)),roles:()=>Progress.kits};
})();
