(function () {
  'use strict';
  const W=window.OW, C=W.Content, G=W.Game.prototype;
  const {patterns,families}=C.reconGear;
  const equippedSuit=p=>p.equipment?.armor?.reconSuit;
  const carried=(p,id)=>p.inventory.some(entry=>(entry.id||entry)===id);
  const zero=()=>({gold:0,materials:0,cores:0});
  const paid=(gold,materials,cores=0)=>({gold,materials,cores});
  const activeTune=(p,id)=>p.reconTunes?.[id]?.active;
  const bladeRank=(p,id)=>p.reconBladeRanks?.[id]||0;
  const ripostes=new WeakMap(), perfectDodges=new WeakMap(), spent=new WeakSet();
  function tunedGun(p,gun) {
    const family=gun.reconFamily,mode=activeTune(p,gun.id),suit=equippedSuit(p);
    if(!family&&!['railcoat','sluice','rigger','breakwater'].includes(suit))return gun;
    const w={...gun};
    if(mode===0||mode===1){
      const alt=mode===1;
      if(family==='carbine'){w.burstCount+=alt?1:-1;w.fireRate*=alt?1/1.2:1.22;}
      if(family==='scatter'){w.spread*=alt?.55:1.45;w.range*=alt?1.25:1;w.knockback*=alt?1:2;}
      if(family==='marksman'){w.chargeTime*=alt?1.35:.65;w.damage*=alt?1.30:.85;}
      if(family==='spool'){w.fireRate*=alt?1.22:.90;w.heatPerShot*=alt?1.3:1;w.coolingRate*=alt?1:1.6;}
    }
    if(suit==='railcoat')w.reload*=.74;
    if(suit==='sluice')w.reload*=1.12;
    if(suit==='breakwater')w.reload*=1.1;
    if(suit==='rigger')w.coolingRate=(w.coolingRate||.24)*1.65;
    return w;
  }
  const weapon=G.weapon;
  G.weapon=function(p){return tunedGun(p,weapon.call(this,p));};
  function tunedBlade(p,blade){
    if(!blade.reconFamily)return blade;
    const b={...blade},mode=activeTune(p,b.id);
    b.damage*=1+.12*bladeRank(p,b.id);
    if(b.reconFamily==='saber'&&mode===0)b.riposteTime+=.22;
    if(b.reconFamily==='saber'&&mode===1){b.speed*=.8;b.range*=.88;}
    if(b.reconFamily==='maul'&&mode===0){b.speed*=1.2;b.range*=1.25;}
    if(b.reconFamily==='maul'&&mode===1)b.range*=.88;
    return b;
  }
  const blade=G.blade;
  G.blade=function(p){return tunedBlade(p,blade.call(this,p));};
  G.reconBladeAt=function(p,index){return tunedBlade(p,C.melee[index]||blade.call(this,p));};
  const melee=G.meleeAttack;
  G.meleeAttack=function(p,heavy){
    const before=p.meleeStrike,result=melee.call(this,p,heavy),swing=p.meleeStrike;
    if(!swing||swing===before)return result;
    const b=this.blade(p);
    if(b.reconFamily){
      const tempo=1+(p.skills.melee||0)*.035;
      p.meleeCommit=b.speed*(swing.finisher?1.45:.87)/tempo;
      p.cooldowns.melee=b.speed*(swing.finisher?1.85:1.15)/tempo;
      swing.windup=b.speed*(swing.finisher?.46:.27)/tempo;
      if(b.reconFamily==='saber'&&ripostes.get(p)?.until>=this.time&&ripostes.get(p)?.id===b.id){
        swing.riposte=true;ripostes.delete(p);this.text('RIPOSTE',p.x,p.y-54,'#fff0a8');
      }
    }
    return result;
  };
  const dodge=G.armorDodge;
  G.armorDodge=function(p){
    const result=dodge.call(this,p),suit=equippedSuit(p);
    if(suit==='sluice')p.cooldowns.dodge*=.78;
    if(suit==='rigger')p.cooldowns.dodge*=1.15;
    perfectDodges.set(p,{armed:true,until:this.time+.27});
    return result;
  };
  const damage=G.damagePlayer;
  G.damagePlayer=function(p,amount,source){
    const suit=equippedSuit(p),step=perfectDodges.get(p);
    if(amount>0&&step?.armed&&step.until>=this.time&&p.invuln>0&&!p.downed&&source&&!source.poison){
      step.armed=false;
      const b=this.blade(p);
      if(b.reconFamily==='saber'){
        ripostes.set(p,{until:this.time+b.riposteTime,id:b.id});
        this.text('COUNTER NOW',p.x,p.y-48,'#ffd875');
      }
      if(suit==='lantern'){
        const n=Math.min(3,p.reserve,Math.max(0,p.magSize-p.ammo));p.ammo+=n;p.reserve-=n;
      }
    }
    return damage.call(this,p,suit==='riveter'&&amount>=32?amount*.78:amount,source);
  };
  const dressing=G.useConsumable;
  G.useConsumable=function(p){
    const h=(typeof p==='number'?this.players[p]:p)||this.players[0];
    const used=dressing.call(this,h);
    if(used&&equippedSuit(h)==='medic'){
      for(const ally of this.players)if(ally!==h&&!ally.downed&&W.dist(h,ally)<=260){
        ally.hp=Math.min(ally.maxHp,ally.hp+.24*ally.maxHp);this.effect('heal',ally.x,ally.y,64,.45);
      }
    }
    return used;
  };
  function walkScale(p){return ({reedrunner:1.15,railcoat:.94,medic:.95,riveter:.86,breakwater:.83})[equippedSuit(p)]||1;}
  function bladeImpact(g,p,e,b,swing){
    if(b.reconFamily==='maul'){e.shieldTime=0;g.breakReconGuard?.(e,p,swing.finisher?.85:.45);}
    return (swing.riposte?2:1)*(b.reconFamily==='maul'&&swing.finisher&&activeTune(p,b.id)===1?1.18:1);
  }
  function extraStun(p,b,swing){return swing.finisher?((equippedSuit(p)==='breakwater'?.4:0)+(b.reconFamily==='maul'&&activeTune(p,b.id)===1?.35:0)):0;}
  const clear=G.clearPlayerCombat;
  if(clear)G.clearPlayerCombat=function(p){ripostes.delete(p);perfectDodges.delete(p);return clear.call(this,p);};

  const masterworkPlans={
    gun:{measure:'intact',source:'Unbroken seal',name:'Sealed breech'},
    blade:{measure:'quiet',source:'Lantern census',name:'Silent temper'},
    suit:{measure:'crossing',source:'Against the current',name:'Storm binding'}
  };
  function choices(g,p,tab){
    const gun=g.weapon(p),blade=g.blade(p);
    if(tab==='Upgrade')return ['gun','suit',...(blade.reconFamily?['blade']:[])];
    if(tab==='Tune')return [...(gun.reconFamily?['gun.0','gun.1']:['power','rapid','tactical']),...(blade.reconFamily?['blade.0','blade.1']:[])];
    return [...patterns.map(v=>v.id),...(C.heroArmorPatterns||[]).map(v=>v.id),'outfit.0','outfit.1','outfit.2'];
  }
  const number=n=>Number(n.toFixed(2));
  function describe(item){
    if(item.slot==='armor')return Math.round(item.armor*100)+'% protection · +'+item.health+' health';
    if(item.range&&item.fireRate){
      const cadence=item.burstCount?item.burstCount+' rounds × '+number(item.fireRate)+' bursts/s':number(item.fireRate)+' shots/s';
      return [number(item.damage)+' damage'+(item.pellets>1?' × '+item.pellets:''),number(item.range)+' range',cadence,number(item.reload)+'s reload',item.chargeTime?number(item.chargeTime)+'s charge':'',item.heatPerShot?Math.round(item.heatPerShot*100)+'% heat/shot':''].filter(Boolean).join(' · ');
    }
    if(item.range)return number(item.damage)+' damage · '+number(item.range)+' reach · '+number(item.speed)+'s swing';
    return '';
  }
  function quote(g,owner,tab,id){
    const p=g.players[owner];
    if(!p||!choices(g,p,tab).includes(id))return null;
    const gun=g.weapon(p),blade=g.blade(p),whyTown='Visit a resistance forge.';
    let q={owner,p,tab,id,cost:zero(),gate:'',source:'Resistance forge',item:null,name:'',description:'',before:'',after:'',owned:false};
    let signature=[];
    if(tab==='Craft'){
      const pattern=C.equipment.find(v=>v.id===id&&(v.reconFamily||C.heroArmorPatterns?.some(x=>x.id===v.id)));
      if(pattern){
        const n=g.reconEvidenceCount?.()||0,b=g.bossVictories(),equipped=pattern.weapon!=null?p.weapon===pattern.weapon:pattern.melee!=null?p.melee===pattern.melee:p.equipment?.armor?.id===id;
        q={...q,item:pattern,name:pattern.name,description:pattern.description,owned:carried(p,id),source:pattern.rewardSource,cost:pattern.cost};
        q.before=pattern.weapon!=null?describe(gun):pattern.melee!=null?describe(blade):p.equipment?.armor?describe(p.equipment.armor):'Scout outfit';
        q.after=describe(pattern.weapon!=null?C.weapons[pattern.weapon]:pattern.melee!=null?C.melee[pattern.melee]:pattern);
        if(q.owned){q.cost=zero();q.gate=equipped?'Equipped':'';}
        else if(pattern.exclusivePlan&&!g.completedQuests?.has(pattern.planQuest)&&!(pattern.hubPlan&&g.campaignWon))q.gate=pattern.rewardSource;
        else if(!pattern.exclusivePlan&&pattern.clues>n&&!g.completedQuests?.has(pattern.planQuest))q.gate='Confirm '+(pattern.clues-n)+' more dossier leads.'+(pattern.planContact?' Or return to '+pattern.planContact+'.':'');
        else if(pattern.commanders>b)q.gate='Defeat '+(pattern.commanders-b)+' more commanders.';
        signature=[q.owned,equipped];
      }else{
        const i=Number(id.split('.')[1]),owned=p.unlockedArmorSets?.includes(i),names=['Scout','Ranger','Vanguard'];
        q.name=names[i]+' outfit';q.description='The base outfit adds protection and health beneath your suit.';q.owned=!!owned;
        q.before=names[p.armorSet||0]+' outfit';q.after=names[i]+' · '+8*i+'% base protection · +'+34*i+' health';
        q.cost=owned?zero():i===1?paid(900,60,4):paid(2400,120,8);const needs=[0,2,5][i];q.source=needs+' commander victories';
        q.gate=p.armorSet===i?'Equipped':!owned&&g.bossVictories()<needs?'Defeat '+needs+' commanders.':'';
        signature=[p.armorSet,!!owned];
      }
    }else if(tab==='Upgrade'){
      const rank=id==='suit'?(p.armorRank||0):id==='blade'?bladeRank(p,blade.id):(p.weaponUpgrades?.[p.weapon]||0);
      q.name=id==='suit'?'Outfit reinforcement':id==='blade'?blade.name:gun.name;
      q.item=id==='suit'?p.equipment?.armor:C.equipment.find(v=>id==='blade'?v.melee===p.melee:v.weapon===p.weapon);
      q.description=id==='suit'?'Each rank adds 12 maximum health and 2.2 percentage points of protection, up to the armor cap.':'Each rank adds 12% of base weapon damage.';
      const plan=masterworkPlans[id],unlocked=g.campaignWon&&(g.reconDossier?.scores?.[plan.measure]||0)>0;
      const cap=unlocked?11:10,nextRank=Math.min(cap,rank+1);
      q.before='Rank +'+rank;q.after='Rank +'+Math.max(rank,nextRank);
      q.gate=rank>=11?'Fully reinforced':rank===10&&!unlocked?'Finish '+plan.source+' from Dawnbridge after the Berlin campaign.':'';
      if(rank>=10){q.name=plan.name+' · '+q.name;q.source='Dawnbridge operation · '+plan.source;q.description+=' The masterwork pattern adds the eleventh rank.';}
      if(id==='suit'){
        q.before+=' · '+Math.round((p.armorBonus||0)*1000)/10+'% armor · '+p.maxHp+' health';
        q.after+=' · '+Math.round(Math.min(.72,(p.armorBonus||0)+(rank<cap?.022:0))*1000)/10+'% armor · '+(p.maxHp+(rank<cap?12:0))+' health';
      }else{
        const base=id==='blade'?C.melee[p.melee].damage:gun.damage;
        q.before+=' · '+number(base*(1+.12*rank))+' base damage';
        q.after+=' · '+number(base*(1+.12*Math.max(rank,nextRank)))+' base damage';
      }
      q.cost=id==='suit'?paid(90+65*rank,6+4*rank,[4,8].includes(rank)?1:0):paid(80+75*rank,5+3*rank,[5,9].includes(rank)?1:0);
      if(rank===10)q.cost=paid(940,75,3);
      signature=[id==='suit'?p.armorSet:id==='blade'?p.melee:p.weapon,rank];
    }else{
      const custom=id.includes('.'),target=id.startsWith('blade')?blade:gun,mode=custom?Number(id.split('.')[1]):id;
      const record=custom?p.reconTunes?.[target.id]:p.weaponTunes?.[p.weapon];
      const def=custom?families[target.reconFamily][mode]:({power:['Power','20% more damage with a wider spread.'],rapid:['Rapid','25% faster fire rate and 20% quicker reloads.'],tactical:['Tactical','Install your firearm family’s signature effect.']})[id];
      q.name=def[0];q.description=def[1];q.item=C.equipment.find(v=>target===blade?v.melee===p.melee:v.weapon===p.weapon);
      q.owned=!!record?.unlocked?.includes(mode);
      q.before=record?.active==null?'Factory setting':custom?families[target.reconFamily][record.active][0]:record.active;
      q.after=target.name+' · '+def[0];q.source=custom?'Reconnaissance workbench':'Firearm rank +3';q.cost=q.owned?zero():custom?paid(75,5):paid(400,18,1);
      if(custom){
        const preview={...p,reconTunes:{...p.reconTunes,[target.id]:{active:mode}}};
        const proposed=target===blade?tunedBlade(preview,C.melee[p.melee]):tunedGun(preview,C.weapons[p.weapon]);
        q.before+=' · '+describe(target);q.after+=' · '+describe(proposed);
      }
      q.gate=record?.active===mode?'Installed':!custom&&(p.weaponUpgrades?.[p.weapon]||0)<3?'Upgrade this firearm to rank +3.':'';
      signature=[target.id,record?.active??null,q.owned];
    }
    q.stamp=JSON.stringify([owner,tab,id,...signature]);
    q.reason=p.downed?'Revive this hero first.':!g.nearForge(p)?whyTown:q.gate;
    if(!q.reason&&Object.keys(q.cost).some(key=>(p[key]||0)<q.cost[key]))q.reason='More supplies needed. Recover scrap in the field and gold and cores from dossier leads or commanders.';
    return q;
  }
  // Quotes belong to a hero and a particular rank or tune. A double click,
  // stale dialog or hero switch cannot charge a second time.
  function commit(g,proposal,equip=false){
    if(!proposal||spent.has(proposal))return false;
    spent.add(proposal);
    const {owner,tab,id}=proposal,p=g.players[owner],q=quote(g,owner,tab,id);
    if(!q||q.reason||q.stamp!==proposal.stamp||p!==proposal.p)return false;
    const backup=JSON.parse(JSON.stringify(p));
    let ok=false;
    try{
      for(const key of Object.keys(q.cost))p[key]=(p[key]||0)-q.cost[key];
      if(tab==='Craft'){
        if(q.item){
          if(!q.owned){
            p.inventory.push({id,upgrade:0});
            if(q.item.armorStyle)p.heroArmorCrafted=[...new Set([...(p.heroArmorCrafted||[]),id])];
          }
          if(equip||q.owned){
            if(q.item.weapon!=null){
              p.reserve+=p.ammo;p.weapon=q.item.weapon;p.magSize=g.weapon(p).magazine;
              p.ammo=Math.min(p.magSize,p.reserve);p.reserve-=p.ammo;p.upgrade=p.weaponUpgrades[p.weapon]||0;
              p.reloading=0;p.charge=0;p.burstQueue=[];
            }else if(q.item.melee!=null)p.melee=q.item.melee;
            else{p.equipment.armor=q.item;p.armor=C.equipment.indexOf(q.item);}
          }
        }else{
          const i=Number(id.split('.')[1]);p.unlockedArmorSets=[...new Set([...(p.unlockedArmorSets||[0]),i])];
          if(equip||q.owned)p.armorSet=i;
        }
      }else if(tab==='Upgrade'){
        if(id==='suit')p.armorRank=(p.armorRank||0)+1;
        else if(id==='blade'){const key=g.blade(p).id;p.reconBladeRanks={...p.reconBladeRanks,[key]:bladeRank(p,key)+1};}
        else{p.upgrade=(p.weaponUpgrades[p.weapon]||0)+1;p.weaponUpgrades[p.weapon]=p.upgrade;}
      }else{
        const custom=id.includes('.'),key=custom?(id.startsWith('blade')?g.blade(p):g.weapon(p)).id:p.weapon;
        const mode=custom?Number(id.split('.')[1]):id,field=custom?'reconTunes':'weaponTunes',record=p[field]?.[key];
        p[field]={...p[field],[key]:{active:mode,unlocked:[...new Set([...(record?.unlocked||[]),mode])]}};
      }
      g.recalculate(p);ok=g.save(false);
    }catch(error){
      console.error('Forge transaction failed',error);
    }finally{
      if(!ok){for(const key of Object.keys(p))if(!(key in backup))delete p[key];Object.assign(p,backup);g.recalculate(p);}
    }
    if(ok)g.audio.play('level');
    return !!ok;
  }
  const validate=W.Save.validPlayer;
  W.Save.validPlayer=function(p){
    if(!validate.call(this,p))return false;
    const tunes=p.reconTunes,ranks=p.reconBladeRanks,record=v=>v&&typeof v==='object'&&!Array.isArray(v);
    if(tunes!==undefined&&(!record(tunes)||!Object.entries(tunes).every(([id,t])=>[...C.weapons,...C.melee].some(w=>w.id===id&&w.reconFamily)&&record(t)&&Array.isArray(t.unlocked)&&t.unlocked.every(m=>m===0||m===1)&&t.unlocked.includes(t.active))))return false;
    return ranks===undefined||record(ranks)&&Object.entries(ranks).every(([id,n])=>C.melee.some(b=>b.reconFamily&&b.id===id)&&Number.isInteger(n)&&n>=0&&n<=11);
  };
  W.ReconGear={walkScale,bladeImpact,extraStun,choices,quote,commit,describe,tunedGun,tunedBlade};
}());
