(function(){
  'use strict';
  const W=window.OW,S=W.Save;if(!S?.validData||!S?.validPlayer)return;
  const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.prototype.toString.call(value)==='[object Object]'&&(Object.getPrototypeOf(value)===null||Object.getPrototypeOf(value)?.constructor?.name==='Object');
  const finite=(value,min=-1e7,max=1e7)=>Number.isFinite(value)&&value>=min&&value<=max;
  const optional=(object,key,test)=>object[key]===undefined||test(object[key]);
  const unique=(list,test,max)=>Array.isArray(list)&&list.length<=max&&new Set(list).size===list.length&&list.every(test);
  const keys=()=>new Set((W.Content.distantVaultKeys||[]).map(key=>key.id));
  const specs=()=>W.Content.distantVaults||[];
  const knownClaims=()=>new Set(specs().map(spec=>spec.questId));
  const boolean=value=>typeof value==='boolean';
  function enemy(record){
    if(!plain(record)||typeof record.id!=='string'||!record.id.length||record.id.length>240||!Number.isInteger(record.type)||record.type<0||record.type>=W.Content.enemies.length)return false;
    if(!['x','y','hp','maxHp'].every(key=>finite(record[key]))||record.hp<0||record.maxHp<=0||record.hp>record.maxHp)return false;
    for(const key of ['dead','boss','dungeonBoss','kraken','regionScaleApplied'])if(!optional(record,key,boolean))return false;
    for(const key of ['homeX','homeY','angle','damage','speed','range','fireRate','level','region','cycle','phase','cooldown','freeze','freezeResist','chillTime'])if(!optional(record,key,finite))return false;
    if(!optional(record,'guardian',value=>Number.isInteger(value)&&value>=0&&value<=3))return false;
    return true;
  }
  function records(list,max,predicate){return Array.isArray(list)&&list.length<=max&&new Set(list.map(record=>record?.id)).size===list.length&&list.every(record=>enemy(record)&&predicate(record));}
  function vaultState(state,spec){
    if(!plain(state))return false;
    for(const key of ['solved','bossDead','claimed'])if(!optional(state,key,boolean))return false;
    if(!optional(state,'vaultNodes',list=>Array.isArray(list)&&list.length<=spec.nodes.length&&Array.from(list).every(boolean)))return false;
    if(!optional(state,'krakenPartySize',size=>size===1||size===2))return false;
    if(!optional(state,'guardianProgression',value=>plain(value)&&value.version===1&&(value.partySize===1||value.partySize===2)))return false;
    if(!optional(state,'enemies',list=>records(list,160,record=>record.id.startsWith(spec.id+'_')&&(!record.kraken||spec.kraken===true))))return false;
    if(!optional(state,'rewardDrops',list=>Array.isArray(list)&&list.length<=100&&list.every(drop=>plain(drop)&&typeof drop.id==='string'&&finite(drop.x)&&finite(drop.y))))return false;
    return true;
  }
  const validPlayer=S.validPlayer;
  S.validPlayer=function(player){return validPlayer.call(this,player)&&optional(player,'expeditionRewardClaims',list=>unique(list,id=>knownClaims().has(id),4));};
  const validData=S.validData;
  S.validData=function(data){
    if(!validData.call(this,data))return false;
    const keyIds=keys();
    if(!optional(data,'distantVaultKeys',list=>unique(list,id=>keyIds.has(id),2)))return false;
    if(!optional(data,'distantVaultKeyRuns',runs=>plain(runs)&&Object.keys(runs).length<=2&&Object.entries(runs).every(([id,run])=>keyIds.has(id)&&plain(run)&&Array.isArray(run.records)&&run.records.length===3&&records(run.records,3,record=>[0,1,2].some(index=>record.id==='vault-key-'+id+'-'+index)))))return false;
    if(data.dungeonStates!==undefined){
      if(!plain(data.dungeonStates))return false;
      for(const spec of specs())if(data.dungeonStates[spec.id]!==undefined&&!vaultState(data.dungeonStates[spec.id],spec))return false;
    }
    const active=data.activeDungeon,spec=specs().find(value=>value.id===active?.id);
    if(spec){
      if(!plain(active)||!plain(data.dungeonStates?.[spec.id]))return false;
      if(spec.keyId&&!(data.distantVaultKeys||[]).includes(spec.keyId))return false;
      if(!optional(active,'players',list=>Array.isArray(list)&&list.length===data.players.length&&list.every(p=>plain(p)&&finite(p.x,0,1920)&&finite(p.y,0,1800))))return false;
    }
    return true;
  };
  W.ExpeditionSave={enemy,vaultState};
}());
