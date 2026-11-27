/* Cinder Relay — field equipment, reward drafts and expedition records. */
(() => {
  'use strict';

  const kits = [
    {name:'Breach Trooper', gun:0, ability:0, suit:0, cost:0, desc:'Linebreaker rifle and Repulsor Sweep. A balanced kit for fighting through the docks.'},
    {name:'Field Scout', gun:13, ability:2, suit:1, cost:12, desc:'Horizon Nail and Slip Beacon. Tag one target, change angles and return to safety.'},
    {name:'Break Crew', gun:6, ability:1, suit:2, cost:16, desc:'Rivet Jaw and Bastion Screen. Lead the breach with a shield and a wall of pellets.'},
    {name:'Signal Tender', gun:24, ability:3, suit:5, cost:20, desc:'Volt Arc and Arc Lattice. Draw a line across the floor and electrify the pack.'},
    {name:'Field Medic',gun:36,ability:12,suit:12,cost:0,desc:'Suture Carbine and Rescue Flare. Your Field Surgeon plates pulse hull repairs after a wound.'},
    {name:'Warden',gun:38,ability:13,suit:13,cost:0,desc:'Bulwark Repeater and Aegis Canopy. Hold the line with armor that can intercept a nearby partner’s hit.'},
    {name:'Engineer',gun:37,ability:14,suit:14,cost:0,desc:'Switchyard Driver and Relay Overcharger. Every fifth kill powers nearby shields and readies crew equipment.'},
    {name:'Fabricator',gun:40,ability:15,suit:7,cost:0,desc:'Honeycomb Harvester and Foamseed Nursery. Send out worker bees and grow pod mines. Your Sapper Exoframe extends deployable life by 35%.'}
  ].map((kit,id) => ({...kit,id}));

  const suits = [
    ['Linebreaker Plate','Standard issue','100 hull, 25 shield. Balanced mobility and handling.','#eb8a4b',{}],
    ['Slipstream Scout','Reconnaissance','Move 12% faster and dash 18% farther. Maximum hull falls by 14.','#b6e7ec',{move:.12,dashDistance:.18,hull:-14}],
    ['Break Crew Rig','Demolition','Close hits gain 40% stagger. Dash charges recover 12% slower.','#da7255',{closeStagger:.40,dashRecovery:-.12}],
    ['Bastion Frame','Bulwark','Add 22 shield capacity. Move 9% slower and wait one extra second for recharge.','#edbf6e',{shield:22,move:-.09,shieldDelay:-1}],
    ['Saltglass Diver','Recovery','Shield recharge starts 1.6 seconds sooner and runs 30% faster. Lose 7 shield capacity.','#6bc6bb',{shieldDelay:1.6,shieldRate:.30,shield:-7}],
    ['Reactor Harness','Ability specialist','Active cooldowns fall by 14%. Weapon cooling slows by 12%.','#e89e5b',{cdr:.14,cooling:-.12}],
    ['Moteweave Suit','Countermeasure','Grazing a hostile shot releases a short stagger pulse, once every 6 seconds. Lose 10 hull.','#b293dd',{hull:-10}],
    ['Sapper Exoframe','Field engineer','Deployables last 35% longer. Direct gun damage falls by 8%.','#c7ae6f',{deployLife:.35,damage:-.08}],
    ['Surveyor Shell','Reconnaissance','Pickup range increases by 65%. Sensors warn of incoming hostiles earlier. Lose 4 shield.','#83ddd2',{pickup:.65,earlyWarn:.5,shield:-4}],
    ['Cryo Carapace','Thermal control','Guns cool 32% faster. Weapon swaps take 15% longer.','#9ed3ed',{cooling:.32,swapSpeed:-.13}],
    ['Voidglass Mantle','Precision','Two clean dodges charge a 35% bonus on the next precision hit. Lose 12 hull.','#a69bd8',{hull:-12}],
    ['Field Medic Rig','Triage','Repair up to 6 hull when you complete a room objective. Lose 7 shield capacity.','#e4a1a0',{repairOnObjective:6,shield:-7}],
    ['Field Surgeon','Trauma response','After losing hull, repair 3 hull each second for 3 seconds for yourself and allies within 175. Recharges in 14s. Lose 5 maximum shield.','#ffaaa1',{shield:-5}],
    ['Brass Rampart','Interception','Every 9s, block up to 10 damage on your next hit or 6 on a teammate within 125. Gain 10 hull. Move 5% slower.','#eaba71',{hull:10,move:-.05}],
    ['Switchyard Rigger','Crew supply','Every fifth kill restores 7 shields and removes 1.5s of active cooldown for yourself and allies within 170. Pulses at most once per 5s.','#75d7c5',{deployLife:.12}],
    ['Capacitor Harness','Surge defense','Three hostile shots within 120 charge a 12-point barrier for 3s. Recharges in 10s. Lose 6 maximum hull.','#c4a6ff',{hull:-6}],
    ['Lifeline Mantle','Escort','Losing hull gives a teammate within 190 a 4s guard. It halves their next hit, saving up to 9 damage. Protects you when no teammate is in reach. Recharges in 10s.','#ff8ca8',{move:.04}],
    ['Reclaimer Shell','Counterattack','Kill within 3s of taking a hit to repair 5 hull and recover 1 scrap. Recharges in 3s. Gain 6 hull.','#daa77a',{hull:6}],
    ['Resonance Greaves','Kinetic pulse','Every 7s of wear, a shockwave pushes enemies within 120. Elites resist the push. Bosses hold position. Gain 8 hull and move 4% slower.','#82cce7',{hull:8,move:-.04}],
    ['Chorus Dynamo','Shield relay','Every 9s of wear, restore 8 shields to yourself and living allies in sight within 170. Gain 5 shield capacity and lose 5 hull.','#9de6cb',{shield:5,hull:-5}]
  ].map(([name,role,desc,color,mods],id) => ({id,name,role,desc,color,mods}));

  const contracts = [
    {id:'glass',name:'Glass Cannon',cost:12,bonus:4,desc:'Deploy with 18 less maximum hull. Earn 4 extra Relay Data per gate.'},
    {id:'blackout',name:'Blackout',cost:18,bonus:5,desc:'Lose 12 maximum shield and delay recharge by one second. Earn 5 extra data per gate.'},
    {id:'lean',name:'Lean Supply',cost:8,bonus:3,desc:'Station repairs cost 24 scrap. Earn 3 extra data per gate.'}
  ];
  const contractInfo = id => contracts.find(c => c.id === id || c.name === id);
  const overclocks = [
    ['Heavy Core','Harder stagger, slower gunfire.'],
    ['Tight Orbit','Actives recharge faster with a smaller effect radius.'],
    ['Fast Hands','Faster first shot on drawing a gun, smaller magazines.'],
    ['Long Cut','Charged shots pierce more bodies but take longer to charge.'],
    ['Tailwind','Dash charges return 25% faster. Dash distance falls by 12%.']
  ].map(([name,desc],id)=>({id,name,desc}));

  const families = ['Assault','Scatter','Precision','Ordnance','Emitter','Fabricator'];
  const chassis = [
    ['Reactor Tuning','damage',.06,'All guns deal 6% more damage.'],
    ['Overpressure','fireRate',.07,'Gunfire cadence increases by 7%.'],
    ['Deep Magazine','magazine',.15,'Magazine capacity increases by 15%.'],
    ['Quick Feed','reload',.12,'Reload speed increases by 12%.'],
    ['Heat Sink','cooling',.12,'Guns cool and vent 12% faster.'],
    ['Fast Tracers','shotSpeed',.15,'Projectiles travel 15% faster.'],
    ['Arc Battery','abilityDamage',.10,'Actives deal 10% more damage.'],
    ['Field Capacitors','cdr',.07,'Reduce active cooldowns by 7%, up to a total of 35%.'],
    ['Servo Stride','move',.05,'Move 5% faster.'],
    ['Dash Bearings','dashRecovery',.08,'Dash charges recover 8% faster.'],
    ['Layered Plating','hull',12,'Gain 12 maximum hull and repair 12 hull immediately.'],
    ['Shield Reservoir','shield',8,'Add 8 rechargeable shield capacity.'],
    ['Shield Wake','shieldDelay',.5,'Shields begin charging half a second sooner.'],
    ['Salvage Magnet','pickup',.25,'Pickup attraction range increases by 25%.']
  ].map(([name,stat,value,desc]) => ({name,stat,value,desc,line:'Chassis',cap:3}));
  const handling = [
    ['Sustained Fire','Tighten continuous fire. At rank III, the opening burst after a swap starts stabilized.'],
    ['Breach Pattern','Increase pellet range. At rank III, eligible close shots gain a center pellet.'],
    ['Throughline','Charge and travel faster. At rank III, gain one light-body pierce after reloading.'],
    ['Expanded Yield','Increase blast radius by 10%. Rank III increases damage around the blast edge.'],
    ['Closed Circuit','Improve heat efficiency. At rank III, improve beam ramp or the first chain jump.'],
    ['Larger Clutch','Faster drones and longer-lived devices. Rank III raises eligible summon caps.']
  ];
  const familyLines = families.flatMap((family,i) => [
    {name:family+' Calibration',line:'Calibration',family,desc:family+' weapons deal 12% more damage.',cap:3},
    {name:handling[i][0],line:'Handling',family,desc:handling[i][1],cap:3}
  ]);
  const behavior = [
    ['Fresh Paint','Your first direct hit after a reload marks its target.'],
    ['Second Address','Piercing a marked target can add a light-body pierce.'],
    ['Line Voltage','A chain jump from a charged target reaches farther.'],
    ['Static Step','Dash near a charged enemy to spend its Static for damage.'],
    ['Hot Lead','Every third direct hit on a target adds Burn.'],
    ['Flash Fuel','Burning enemies leave a brief fire patch when defeated.'],
    ['Ice Breaker','Heavy hits shatter a frozen target into damaging shards.'],
    ['Spore Transfer','Defeating a foe in acid passes one acid tick to a neighbor.'],
    ['Shield Harvest','Cross a marked elite’s remains to start shield recharge early.'],
    ['Ready Powder','Mines arm faster after the first toss in a room.'],
    ['Clean Escape','An elite kill or boss phase transition restores a spent dash charge.'],
    ['Quick Exchange','The first hit after a weapon swap delivers additional stagger.']
  ].map(([name,desc])=>({name,desc,line:'Behavior',cap:1}));
  const keystoneDefs = [
    ['Storm Circuit',24,3,'Chain through Arc Lattice to branch your Volt Arc into an additional enemy.'],
    ['Furnace Orbit',27,6,'A returning Phase Disc ignites a Cinder Wake trail for a directional blast.'],
    ['Siege Breaker',20,4,'Meteor Tag can follow an Anchor Cannon implosion and stagger its heaviest target.'],
    ['Living Screen',30,1,'Block six bullets with Bastion Screen to arm the next Wasp Foundry swarm.'],
    ['Glass Garden',8,5,'Glass Choir shatters a frozen target into a second fan of glass.'],
    ['Relay Assassin',14,2,'The first Rift Needle shot after a beacon return echoes from your departure point.']
  ].map(([name,gun,ability,desc])=>({name,gun,ability,desc,line:'Keystone',cap:1}));
  const passives = [...chassis,...familyLines,...behavior,...keystoneDefs].map((v,id)=>({...v,id}));
  const passivesByName = new Map(passives.map(line=>[line.name,line]));
  const armorPrefixes = {
    Lined:{desc:'+7 hull, −3% movement.',hull:7,move:-.03},
    Vented:{desc:'+8% cooling, −3 shield.',cooling:.08,shield:-3},
    Counterweighted:{desc:'+10% heavy-gun stability, −4% swap speed.',stableHeavy:.1,swapSpeed:-.04},
    Insulated:{desc:'Shorter slows, −4% dash recovery.',slowResist:.2,dashRecovery:-.04},
    Lightened:{desc:'+5% movement, −5 hull.',move:.05,hull:-5}
  };
  const armorSuffixes = {
    'of Recovery':'An elite kill jump-starts shield recharge.',
    'of the Long Step':'Dash 10% farther when both charges are full.',
    'of Reserves':'The first refit purchase each stage refunds 4 scrap.',
    'of Fieldwork':'Reload and swap faster for 5 seconds after an objective.',
    'of the Guard':'Reduce the first incoming hit each stage by 6 damage.'
  };
  const chipInfo = {
    'Counterweight':'Slows sustained spread growth.',
    'Condensate Coil':'Lowers beam heat buildup.',
    'Primer Cap':'Adds stagger to the first shot after a reload.',
    'Split Fuse':'Moves blast damage toward the outer edge.',
    'Relay Antenna':'Extends deployable engagement range.',
    'Field Spool':'A clean dodge grants a brief reload assist.'
  };
  const affixInfo = {
    Shortstroke:'Faster fire, smaller magazine.',
    'Heavy-Bore':'Harder hits, slower fire.',
    Threaded:'Pierces one extra light enemy at reduced direct damage.',
    Braced:'Tighter spread, slower strafing under sustained fire.',
    Featherweight:'Draw faster with greater recoil.',
    Drumfed:'Larger magazine, longer reload.',
    Quickdraw:'Fast first shot after swapping, smaller magazine.',
    'Cold-Jacket':'More heat capacity, longer forced vent.',
    Splitcore:'One extra outer pellet, less damage per pellet.',
    Longglass:'Longer range, weaker up close.',
    Compact:'More close stagger, shorter range.',
    Capacitor:'Charge faster, recover slower after release.',
    'Soft-Fused':'Earlier blast with a smaller radius.',
    'Spare-Coil':'An extra chain jump at lower chain damage.',
    'of First Contact':'First hit after reloading gains damage and stagger.',
    'of the Last Word':'The last round gains stagger.',
    'of Ricochet':'Eligible shots bounce once off solid cover.',
    'of Burrowing':'Fully charged shots pierce an extra body.',
    'of Aftershock':'A heavy hit triggers a delayed stagger burst.',
    'of Triage':'Marked elite kills restore shield.',
    'of the Hunter':'Deal more damage against marked enemies.',
    'of Shrapnel':'Direct kills sometimes throw a fan of shards.',
    'of Focus':'Repeated hits on one enemy tighten spread.',
    'of Momentum':'A clean dodge briefly improves reload speed.',
    'of the Reserve':'The first hit after extended stow gains stagger.',
    'of Scavenging':'Your first elite kill with this gun each stage gives extra scrap.',
    'of Grounding':'Hitting a charged target can slow nearby light enemies.',
    'of Breach':'Breaking armor releases a cone of shrapnel.',
    'of Cinders':'Hitting a burning enemy can release a flare.',
    'of Recall':'A completed return grants a short handling boost.'
  };
  const augmentInfo = [
    ['Widen the push cone and clear more ordinary projectiles.','Convert up to four erased bullets into friendly shards.'],
    ['Blocked shots charge your next attack.','The screen follows your aim and movement, with reduced capacity.'],
    ['Leave a decoy at your departure point.','Push light enemies back when you return.'],
    ['A third node forms a triangular trap.','Spend the first crossing enemy’s Static for a stronger burst.'],
    ['Four smaller strikes follow at the impact edge.','Focus the strike, add stagger and mark its targets.'],
    ['Leave a lingering frost patch after the cone.','A heavy shot can shatter the first eligible frozen enemy.'],
    ['Each fire trail flares on its first crossing.','Shooting through your trail extends its lifetime once.'],
    ['Restore shield when hull is full.','Trade some repairs for a limited projectile intercept.'],
    ['Return part of the cleared volley toward your aim.','Split the projectile clear across two successive pulses.'],
    ['The gravity field pulls for longer.','Enemies leaving the field take damage and are marked.'],
    ['The decoy sheds an acid pool as it expires.','The decoy copies your first volley at reduced power.'],
    ['Dashing during Overdrive briefly accelerates gunfire.','Completing one reload refunds a little cooldown.'],
    ['Expand the rescue radius from 140 to 204.','Also grant 10 shields to rescued pilots.'],
    ['Return up to four blocked shots at nearby enemies.','Raise the block limit from 16 to 24 and duration from 5s to 6.5s.'],
    ['Increase dry-magazine and vent assistance from 40% to 75%.','Raise the overcharge cadence bonus from 25% to 40%.'],
    ['Grow five pod mines instead of three.','Freeze nearby light enemies when pods detonate.'],
    ['Split fire into two bolts at 73% output each.','Extend the deployment from 7s to 11s.']
  ];

  const random = (g,items) => items.length ? items[Math.min(items.length-1,Math.floor(g.rng()*items.length))] : undefined;
  function sample(g,items,count) {
    const pool = [...items], result=[];
    while (pool.length && result.length < count) {
      result.push(pool.splice(Math.min(pool.length-1,Math.floor(g.rng()*pool.length)),1)[0]);
    }
    return result;
  }
  function newPlayer(kitId=0) {
    const kit = kits.find(kit=>kit.id===Number(kitId)) || kits[0];
    const skill = Combat.makeAbility(kit.ability);
    skill.learned=[];
    const p = {
      kitId:kit.id,x:480,y:304,a:0,r:7,hp:100,maxHp:100,shield:25,maxShield:25,
      guns:[Combat.makeGun(kit.gun,Math.random,false)], ready:[0,-1],selected:0,
      abilities:[skill],activeSlots:[0,-1],suit:kit.suit,suits:[kit.suit],suitRolls:{},
      stats:{},scrap:0,xp:0,level:1,dashCharges:2,dashTime:0,invuln:0,
      chips:[],upgrades:{},keystones:[],keystoneSlots:[],overclock:'',overclocks:[],
      activeCaches:0,skin:null,fieldworkUntil:0,voidDodges:0,voidPrimed:false
    };
    recalc({player:p});
    p.hp=p.maxHp; p.shield=p.maxShield;
    return p;
  }

  function recalc(g) {
    const p=g.player;
    if(p.activeArmorId!==p.suit){
      const old=p.armorReactions?.[p.activeArmorId];
      if(old){old.pulses=0;old.buffer=0;}
      p.activeArmorId=p.suit;
    }
    const stats = {hull:0,shield:0,move:0,dashRecovery:0,dashDistance:0,shieldRate:0,shieldDelay:0,pickup:0,
      damage:0,fireRate:0,magazine:0,reload:0,cooling:0,shotSpeed:0,abilityDamage:0,cdr:0,closeStagger:0,
      deployLife:0,swapSpeed:0,stableHeavy:0,slowResist:0,earlyWarn:0,repairOnObjective:0,
      familyDamage:{},familyHandling:{},overclock:p.overclock || ''};
    const addMods = mods => {
      for (const [key,value] of Object.entries(mods || {})) if (typeof value==='number') stats[key]=(stats[key]||0)+value;
    };
    const suit = suits[p.suit] || suits[0];
    addMods(suit.mods);
    const roll=p.suitRolls?.[suit.id] || {};
    addMods(armorPrefixes[roll.prefix]);
    stats.armorMark=roll.suffix || '';
    if (g.contract==='glass') stats.hull-=18;
    if (g.contract==='blackout') {stats.shield-=12; stats.shieldDelay-=1;}
    if (p.overclock==='Tailwind') {stats.dashDistance-=.12; stats.dashRecovery+=.25;}
    for (const [name,rank] of Object.entries(p.upgrades||{})) {
      const def=passivesByName.get(name);
      if (!def) continue;
      const n=Math.min(def.cap,Math.max(0,rank));
      if (def.stat) stats[def.stat]+=def.value*n;
      else if (def.line==='Calibration') stats.familyDamage[def.family]=.12*n;
      else if (def.line==='Handling') stats.familyHandling[def.family]=n;
      else if (def.line==='Behavior') stats[name]=n;
    }
    for (const name of p.keystoneSlots||[]) {
      const d=passivesByName.get(name);
      if (d && p.guns.some(w=>w.id===d.gun) && p.abilities.some(a=>a.id===d.ability)) stats[name]=1;
    }
    stats.cdr=Math.min(.35,stats.cdr);
    p.stats=stats;
    p.maxHp=Math.max(35,100+stats.hull);
    p.maxShield=Math.max(0,25+stats.shield);
    p.hp=Math.min(p.maxHp,p.hp);
    p.shield=Math.min(p.maxShield,p.shield);
    return stats;
  }

  function levelXP(level) {
    return 20+Math.min(120,(Math.max(1,level)-1)*5);
  }
  function addXP(g,amount) {
    if (!Number.isFinite(amount) || amount<=0) return 0;
    const p=g.player;
    p.xp+=amount;
    let levels=0;
    while (p.xp>=levelXP(p.level)) {p.xp-=levelXP(p.level); p.level++; levels++;}
    g.pendingLevels=(g.pendingLevels||0)+levels;
    return levels;
  }

  function gunCard(g,id) {
    const item=Combat.makeGun(id,()=>g.rng(),true);
    const def=Combat.guns[id];
    const rarity=Combat.rarityOf(item);
    return {kind:'gun',id,item,name:Combat.gunName(item),tag:rarity+' · '+def.family,desc:def.desc,
      detail:weaponDetail(g,item),traits:[item.prefix,item.suffix].filter(Boolean).map(n=>affixInfo[n]),
      artKind:'gun',artId:id,color:def.color};
  }
  function weaponDetail(g,item) {
    const def=Combat.guns[item.id];
    const s=g.player.stats, hand=s.familyHandling[def.family]||0;
    const bonus=Math.round(100*(s.damage+(s.familyDamage[def.family]||0)));
    const damage=Math.round(Combat.damageFor(g,item));
    const range=Math.round(def.range*(item.prefix==='Longglass'?1.20:item.prefix==='Compact'?.82:1)*(def.family==='Scatter'?1+.12*hand:1));
    const cycle=def.reload*(item.prefix==='Drumfed'||item.prefix==='Cold-Jacket'?1.18:1)/(1+(def.heat?s.cooling:s.reload));
    const cadence=Combat.rateFor(g,item);
    const stagger=def.family==='Scatter'||def.family==='Ordnance'?'heavy':def.family==='Precision'?'medium':'light';
    const notes=[damage+' base hit',cadence.toFixed(1)+'/s',range+' range',stagger+' stagger',
      def.heat?'heat cycle':Combat.capacity(g,item)+' rounds',cycle.toFixed(1)+'s '+(def.heat?'vent':'reload')];
    if (bonus) notes.push((bonus>0?'+':'')+bonus+'% build damage');
    if (item.id===36) notes.push('Stored healing charge '+Math.round(Math.max(0,Math.min(18,item.sutureCharge??12)))+'/18');
    if (item.chip) notes.push(item.chip);
    return notes.join(' · ');
  }
  function gunDraft(g,available) {
    const owned=g.player.guns.map(w=>w.id);
    const familiesHeld=new Set(owned.map(id=>Combat.guns[id].family));
    const pool=Combat.guns.filter(def=>!owned.includes(def.id) && available('gun',def.id));
    const matched=random(g,pool.filter(d=>familiesHeld.has(d.family)));
    const other=random(g,pool.filter(d=>!familiesHeld.has(d.family)));
    const chosen=[matched,other].filter(Boolean);
    chosen.push(...sample(g,pool.filter(d=>!chosen.includes(d)),3-chosen.length));
    return chosen.map(d=>gunCard(g,d.id));
  }
  function abilityCard(id) {
    const def=Combat.abilities[id];
    return {kind:'active',id,name:def.name,tag:'Active · '+def.cooldown+'s',desc:def.desc,
      artKind:'ability',artId:id,color:def.color};
  }
  function augmentCards(p) {
    return p.abilities.flatMap(skill=>[1,2].filter(i=>!(skill.learned||[]).includes(i)).map(branch=>{
      const def=Combat.abilities[skill.id];
      return {kind:'augment',id:skill.id,branch,name:def.augments[branch-1],tag:'Augment · '+def.name,
        desc:augmentInfo[skill.id][branch-1],artKind:'ability',artId:skill.id,color:def.color};
    }));
  }
  function activeDraft(g,available) {
    const p=g.player;
    const fresh=Combat.abilities.filter(a=>!p.abilities.some(owned=>owned.id===a.id) && available('active',a.id)).map(a=>abilityCard(a.id));
    if (!p.activeCaches) return sample(g,fresh,3);
    const branches=augmentCards(p).filter(c=>available(c.kind,c.id,c.branch));
    const options=[];
    if (branches.length) options.push(random(g,branches));
    if (fresh.length) options.push(random(g,fresh));
    return options.concat(sample(g,[...fresh,...branches].filter(c=>!options.includes(c)),3-options.length));
  }
  function makeSuitRoll(g) {
    const chance=g.rng();
    return {prefix:chance<.55 ? random(g,Object.keys(armorPrefixes)):'',
      suffix:chance<.20 || chance>.78 ? random(g,Object.keys(armorSuffixes)):''};
  }
  function suitName(id,roll={}) {
    return [roll.prefix,suits[id].name,roll.suffix].filter(Boolean).join(' ');
  }
  function equippedName(g,index) {
    const id=g.player.suits[index];
    return suits[id] ? suitName(id,g.player.suitRolls?.[id]) : '';
  }
  function armorDraft(g,available) {
    return sample(g,suits.filter(s=>!g.player.suits.includes(s.id) && available('armor',s.id)),2).map(s=>{
      const roll=makeSuitRoll(g);
      const detail=[armorPrefixes[roll.prefix]?.desc,armorSuffixes[roll.suffix]].filter(Boolean).join(' ');
      return {kind:'armor',id:s.id,roll,name:suitName(s.id,roll),tag:s.role+' · Armor',desc:s.desc,
        detail,artKind:'suit',artId:s.id,color:s.color};
    });
  }
  function chipDraft(g,available) {
    const compatible=new Set(g.player.guns.flatMap(w=>Combat.compatibleChips(w.id)));
    return sample(g,[...compatible].filter(name=>available('chip',name)),3).map(name=>{
      const weapon=g.player.guns.find(w=>Combat.compatibleChips(w.id).includes(name) && !w.chip)
        || g.player.guns.find(w=>Combat.compatibleChips(w.id).includes(name));
      return {kind:'chip',id:name,name,tag:'Weapon chip',desc:chipInfo[name] || 'Install this chip in a compatible gun.',
        detail:weapon ? 'Compatible with '+Combat.guns[weapon.id].name+'.' : '',color:'#7ccebf'};
    });
  }
  function overclockDraft(g,available) {
    return sample(g,overclocks.filter(c=>c.name!==g.player.overclock && available('overclock',c.id)),3)
      .map(c=>({kind:'overclock',id:c.id,name:c.name,tag:'Overclock',desc:c.desc,color:'#e4ad6c'}));
  }
  function passiveCard(p,def) {
    const rank=(p.upgrades[def.name]||0)+1;
    return {kind:def.line==='Keystone'?'keystone':'passive',id:def.id,name:def.name,
      tag:def.line+(def.cap>1?' · Rank '+['','I','II','III'][rank]:''),
      desc:def.desc,color:def.line==='Keystone'?'#dd99df':def.family?'#ddb477':'#81cfc2',
      detail:def.line==='Keystone'?'Requires '+Combat.guns[def.gun].name+' and '+Combat.abilities[def.ability].name+'.':undefined};
  }
  const fieldSupplies = () => [
    {kind:'repair',id:'repair',name:'Repair pack',tag:'Field supply',desc:'Restore 30 hull immediately.',color:'#ec958e'},
    {kind:'scrap',id:'scrap',name:'Salvage reserve',tag:'Field supply',desc:'Recover 18 scrap to spend at a refit station.',color:'#e1b67e'}
  ];
  // Shared enemy statuses can come from either pilot. Weapon handling still requires that pilot's own gun.
  function buildPrerequisites(g) {
    const p=g.player,squad=g.players?.length?g.players:[p];
    const carries=(pilot,...ids)=>pilot.guns.some(w=>ids.includes(w.id));
    const knows=(pilot,id,branch)=>pilot.abilities.some(a=>a.id===id &&
      (!branch || a.augment===branch || a.learned?.includes(branch)));
    const canMark=squad.some(q=>q.upgrades['Fresh Paint'] || carries(q,1) || knows(q,4,2) || knows(q,9,2));
    const canPierce=carries(p,2,9,12,14,15,27) || p.guns.some(w=>w.prefix==='Threaded' ||
      w.suffix==='of Burrowing' || (Combat.guns[w.id].family==='Precision' && p.upgrades.Throughline===3));
    const hasMagazine=p.guns.some(w=>!Combat.guns[w.id].heat);
    return {
      'Deep Magazine':hasMagazine,'Quick Feed':hasMagazine,'Heat Sink':p.guns.some(w=>Combat.guns[w.id].heat),
      'Second Address':canMark && canPierce,'Line Voltage':carries(p,24),
      'Static Step':squad.some(q=>carries(q,24,29) || knows(q,3)),
      'Flash Fuel':squad.some(q=>q.upgrades['Hot Lead'] || carries(q,7) || knows(q,6)),
      'Ice Breaker':squad.some(q=>carries(q,26,35) || knows(q,5) || q.guns.some(w=>w.suffix==='of Grounding')),
      'Spore Transfer':carries(p,9) || knows(p,10,1),'Shield Harvest':canMark,
      'Ready Powder':carries(p,21),'Quick Exchange':p.guns.length>1
    };
  }
  function levelDraft(g,available) {
    const p=g.player;
    const held=new Set(p.guns.map(w=>Combat.guns[w.id].family));
    const prerequisites=buildPrerequisites(g);
    const eligible=passives.filter(d=>{
      if (prerequisites[d.name]===false || (p.upgrades[d.name]||0)>=d.cap || (d.family && !held.has(d.family)) ||
          !available(d.line==='Keystone'?'keystone':'passive',d.id)) return false;
      if (d.line!=='Keystone') return true;
      return g.stage>2 && p.guns.some(w=>w.id===d.gun) && p.abilities.some(a=>a.id===d.ability);
    });
    const own=eligible.filter(d=>d.family);
    const general=eligible.filter(d=>d.line==='Chassis');
    const mechanics=eligible.filter(d=>d.line==='Behavior');
    const keys=eligible.filter(d=>d.line==='Keystone');
    const result=[];
    const push=d=>{if (d && !result.includes(d)) result.push(d);};
    push(random(g,own)); push(random(g,general));
    if (keys.length && g.rng()<.70) push(random(g,keys));
    else push(random(g,mechanics));
    const cards=result.map(d=>passiveCard(p,d));
    if (g.stage>=6 && (!eligible.length || (p.level>=18 && g.rng()<.25))) {
      const o=random(g,overclockDraft(g,available));
      if (o && cards.length===3) cards[2]=o; else if (o) cards.push(o);
    }
    if (cards.length<3) cards.push(...sample(g,eligible.filter(d=>!result.includes(d)),3-cards.length).map(d=>passiveCard(p,d)));
    if (cards.length<3) cards.push(...sample(g,fieldSupplies().filter(c=>available(c.kind,c.id) && (c.kind!=='repair'||!p.downed)),3-cards.length));
    if (cards.length<3) cards.push(...sample(g,chipDraft(g,available),3-cards.length));
    return cards;
  }
  function draft(g,kind,previous=[],level=g.player.level) {
    const available=(kind,id,branch)=>!previous.some(c=>c.kind===kind && c.id===id && c.branch===branch);
    let cards;
    switch (kind) {
      case 'gun': cards=gunDraft(g,available); break;
      case 'active': cards=activeDraft(g,available); break;
      case 'armor': cards=armorDraft(g,available); break;
      case 'chip': cards=chipDraft(g,available); break;
      case 'overclock': cards=overclockDraft(g,available); break;
      case 'repair': return [fieldSupplies()[0]];
      default: cards=levelDraft(g,available);
    }
    // On a reroll a small compatible pool may need a previous item to fill out the choices.
    const ordinary=previous.filter(card=>card.kind!=='tuneGun');
    cards.push(...sample(g,ordinary,Math.max(0,ordinary.length-cards.length)));
    if(kind==='level' && level>=4 && level%4===0 && g.player.guns.some(w=>Combat.rankOf(w)<3)){
      const tune={kind:'tuneGun',id:'tuneGun',name:'Upgrade a weapon',tag:'Gunsmith · Level '+level,
        desc:'Choose a carried gun to increase its damage and firing speed. Each gun can be upgraded three times.'};
      // Preserve the build-specific first card and the wildcard at the end of the draft.
      cards.splice(Math.min(1,cards.length),cards.length>=3?1:0,tune);
    }
    return cards;
  }
  const validIndex=(list,i)=>Number.isInteger(i)&&i>=0&&i<list.length;
  function storeItem(list,cap,item,index) {
    if (list.length<cap) {list.push(item); return list.length-1;}
    if (!validIndex(list,index)) return -1;
    list[index]=item;
    return index;
  }
  function fillSlot(slots,index) {
    if (slots.includes(index)) return;
    const vacant=[0,1].find(n=>!Number.isInteger(slots[n]) || slots[n]<0);
    if (vacant!==undefined) slots[vacant]=index;
  }
  function take(g,card,replaceIndex) {
    if (!card) return false;
    const p=g.player;
    switch(card.kind) {
      case 'tuneGun': {
        if(!validIndex(p.guns,replaceIndex))return false;
        const gun=p.guns[replaceIndex],rank=Combat.rankOf(gun);
        if(rank>=3)return false;
        gun.upgradeLevel=rank+1;
        break;
      }
      case 'gun': {
        if (!Combat.guns[card.id] || (card.item && card.item.id!==card.id)) return false;
        const displaced=p.guns.length===4 && validIndex(p.guns,replaceIndex) ? p.guns[replaceIndex] : null;
        const index=storeItem(p.guns,4,card.item || Combat.makeGun(card.id,()=>g.rng(),true),replaceIndex);
        if (index<0) return false;
        if (displaced?.chip) p.chips.push(displaced.chip);
        fillSlot(p.ready,index);
        break;
      }
      case 'active': {
        if (!Combat.abilities[card.id]) return false;
        if (p.abilities.some(a=>a.id===card.id)) return true;
        const ability=Combat.makeAbility(card.id);
        ability.learned=[];
        const index=storeItem(p.abilities,4,ability,replaceIndex);
        if (index<0) return false;
        fillSlot(p.activeSlots,index); p.activeCaches++;
        break;
      }
      case 'augment': {
        const ability=p.abilities.find(a=>a.id===card.id);
        if (!ability || ![1,2].includes(card.branch)) return false;
        ability.learned=ability.learned||[];
        if (!ability.learned.includes(card.branch)) ability.learned.push(card.branch);
        ability.augment=card.branch;
        p.activeCaches++;
        break;
      }
      case 'armor': {
        if (!suits[card.id]) return false;
        if (p.suits.includes(card.id)) return true;
        const old=p.suits.length===2 ? p.suits[replaceIndex]:undefined;
        const index=storeItem(p.suits,2,card.id,replaceIndex);
        if (index<0) return false;
        if (old!==undefined) delete p.suitRolls[old];
        p.suitRolls[card.id]=card.roll || {};
        p.suit=card.id;
        break;
      }
      case 'passive':
      case 'keystone': {
        const def=passives[card.id];
        if (!def) return false;
        if ((p.upgrades[def.name]||0)>=def.cap) return true;
        p.upgrades[def.name]=(p.upgrades[def.name]||0)+1;
        if (def.line==='Keystone') {
          p.keystones.push(def.name);
          if (p.keystoneSlots.length<2) p.keystoneSlots.push(def.name);
        }
        if (def.stat==='hull' && !p.downed) p.hp+=def.value;
        break;
      }
      case 'chip': {
        if (!Object.hasOwn(chipInfo,card.name)) return false;
        const ready=p.guns[p.ready[p.selected]];
        const free=ready && !ready.chip && Combat.compatibleChips(ready.id).includes(card.name)
          ? ready : p.guns.find(w=>!w.chip && Combat.compatibleChips(w.id).includes(card.name));
        if (free) free.chip=card.name; else p.chips.push(card.name);
        break;
      }
      case 'overclock':
        if (!overclocks.some(o=>o.name===card.name)) return false;
        if (!p.overclocks.includes(card.name)) p.overclocks.push(card.name);
        p.overclock=card.name; break;
      case 'repair': if (p.downed) return false; p.hp=Math.min(p.maxHp,p.hp+30); break;
      case 'scrap': p.scrap+=18; break;
      default: return false;
    }
    recalc(g);
    return true;
  }
  function salvage(g,card) {
    const amount=card && ['gun','armor'].includes(card.kind) ? 10 : 7;
    g.player.scrap+=amount;
    return amount;
  }

  function equipSlot(list,slots,index,slot) {
    if (!validIndex(list,index) || (slot!==0 && slot!==1)) return false;
    const other=1-slot;
    if (slots[other]===index && (slots[slot]===undefined || slots[slot]<0)) return false;
    if (slots[other]===index) slots[other]=slots[slot];
    slots[slot]=index;
    return true;
  }
  function refit(g,kind,index,slot=0) {
    const p=g.player;
    switch(kind) {
      case 'guns': case 'gun': return equipSlot(p.guns,p.ready,index,slot);
      case 'abilities': case 'ability': case 'active': return equipSlot(p.abilities,p.activeSlots,index,slot);
      case 'suits': case 'suit': case 'armor':
        if (!validIndex(p.suits,index)) return false;
        p.suit=p.suits[index]; break;
      case 'augment': {
        const ability=p.abilities[index];
        if (!ability || (slot!==0 && !ability.learned?.includes(slot))) return false;
        ability.augment=slot; break;
      }
      case 'keystone':
        if (!validIndex(p.keystones,index) || ![0,1].includes(slot)) return false;
        if (p.keystoneSlots[1-slot]===p.keystones[index]) p.keystoneSlots[1-slot]=p.keystoneSlots[slot] || '';
        p.keystoneSlots[slot]=p.keystones[index]; break;
      case 'overclock':
        if (index!==-1 && !validIndex(p.overclocks,index)) return false;
        p.overclock=p.overclocks[index]||''; break;
      default: return false;
    }
    recalc(g); return true;
  }
  function installChip(g,index,name,fromIndex) {
    const p=g.player,w=p.guns[index];
    if (!w) return false;
    if (!name) {if (w.chip) p.chips.push(w.chip); w.chip=''; return true;}
    if (!Combat.compatibleChips(w.id).includes(name) || w.chip===name) return false;
    const spare=p.chips.indexOf(name);
    if (fromIndex!==undefined) {
      if (fromIndex===index || p.guns[fromIndex]?.chip!==name) return false;
      p.guns[fromIndex].chip='';
    } else if (spare>=0) {
      p.chips.splice(spare,1);
    } else {
      const donor=p.guns.find(gun=>gun!==w && gun.chip===name);
      if (!donor) return false;
      donor.chip='';
    }
    if (w.chip) p.chips.push(w.chip);
    w.chip=name;
    return true;
  }
  function rollAffix(g,index,slot) {
    const w=g.player.guns[index];
    if (!w || !['prefix','suffix'].includes(slot)) return [];
    const pool=Combat.eligibleAffixes(w.id)[slot];
    return sample(g,(pool || []).filter(name=>name!==w[slot]),2);
  }
  function spend(g,cost) {
    const p=g.player;
    if (p.scrap<cost) return false;
    p.scrap-=cost;
    if (p.stats.armorMark==='of Reserves' && p.refundStage!==g.stage) {p.scrap+=4; p.refundStage=g.stage;}
    return true;
  }
  function buyAffix(g,index,slot,name) {
    const w=g.player.guns[index];
    if (!w || !['prefix','suffix'].includes(slot) || w[slot]===name ||
        !Combat.eligibleAffixes(w.id)[slot]?.includes(name) || !spend(g,18)) return false;
    w[slot]=name;
    if (w.ammo>0 && Combat.capacity) w.ammo=Math.min(w.ammo,Combat.capacity(g,w));
    return true;
  }
  const repairCost = g => g.contract==='lean' ? 24 : 12;
  function repair(g) {
    const p=g.player;
    if (p.downed || p.hp>=p.maxHp || !spend(g,repairCost(g))) return false;
    p.hp=Math.min(p.maxHp,p.hp+30); return true;
  }

  function onObjective(g) {
    const p=g.player;
    if (p.stats.repairOnObjective) p.hp=Math.min(p.maxHp,p.hp+p.stats.repairOnObjective);
    if (p.stats.armorMark==='of Fieldwork') p.fieldworkUntil=g.time+5;
  }
  function onElite(g) {
    const p=g.player;
    if (p.stats['Clean Escape']) p.dashCharges=Math.min(2,p.dashCharges+1);
    if (p.stats.armorMark==='of Recovery') {
      p.shield=Math.min(p.maxShield,p.shield+4);
      p.lastHit=Math.min(Number.isFinite(p.lastHit)?p.lastHit:g.time,g.time-5);
    }
  }
  function onNearMiss(g) {
    const p=g.player;
    if ((p.grazeRewardAt||0)>g.time) return;
    p.grazeRewardAt=g.time+1.2;
    if (p.suit===6 && (p.weaveReady||0)<=g.time) {
      p.weaveReady=g.time+6;
      for (const e of g.enemies) if (e.hp>0 && Math.hypot(e.x-p.x,e.y-p.y)<78)
        g.hurtEnemy(e,1,Math.atan2(e.y-p.y,e.x-p.x),95,'impact');
      g.fx?.(p.x,p.y,'#d1a9ff',16);
    }
    if (p.suit===10) {
      p.voidDodges=(p.voidDodges||0)+1;
      if (p.voidDodges>=2) {p.voidDodges=0; p.voidPrimed=true;}
    }
  }
  function onDodge(g) {
    const p=g.player;
    if (g.hostile?.some(b=>b.life>0 && Math.hypot(b.x-p.x,b.y-p.y)<55)) onNearMiss(g);
  }
  function onGate(g) {
    const p=g.player;
    p.weaveReady=0; p.grazeRewardAt=0;
  }
  function guardDamage(g,amount) {
    const p=g.player;
    if (p.stats.armorMark==='of the Guard' && p.guardStage!==g.stage && amount>0) {
      p.guardStage=g.stage;
      return Math.max(0,amount-6);
    }
    return amount;
  }
  const standing=p=>p&&p.hp>0&&!p.downed;
  const crewOf=(g,p)=>g.players?.length?g.players:[p];
  function within(g,p,q,range){
    if(p===q)return true;
    return (q.x-p.x)**2+(q.y-p.y)**2<=range*range&&(!g.map?.lab||Labyrinth.clearLine(g.map.lab,p,q));
  }
  function armorState(p,id=p.suit){
    const states=p.armorReactions??={};
    return states[id]??={ready:0};
  }
  function armorSpark(g,p,id){
    g.fx?.(p.x,p.y,suits[id].color,7);
  }
  function periodicPulse(g,p,dt){
    const kinetic=p.suit===18,period=kinetic?7:9,radius=kinetic?120:170;
    const state=armorState(p);
    state.remaining=(state.remaining??period)-dt;
    if(state.remaining>1e-7)return;
    state.remaining=period+state.remaining%period;
    p.armorPulse={x:p.x,y:p.y,t:g.time,id:p.suit,radius};
    if(kinetic){
      for(const e of g.enemies||[]){
        if(e.boss||e.dead||e.hp<=0||!within(g,p,e,radius))continue;
        const dx=e.x-p.x,dy=e.y-p.y,d=Math.hypot(dx,dy);
        const nx=d>.01?dx/d:Math.cos(e.post||0),ny=d>.01?dy/d:Math.sin(e.post||0);
        const impulse=(e.elite?82:225)*(1-.32*d/radius)/Math.sqrt(Math.max(1,e.mass||1));
        const kx=e.kx||0,ky=e.ky||0,boost=Math.max(0,Math.min(impulse,impulse-(kx*nx+ky*ny)));
        e.kx=kx+nx*boost;e.ky=ky+ny*boost;
      }
      armorSpark(g,p,18);
    }else{
      for(const q of crewOf(g,p))if(standing(q)&&within(g,p,q,radius)){
        q.shield=Math.min(q.maxShield,q.shield+8);armorSpark(g,q,19);
      }
    }
  }
  function drawArmorPulse(c,p,time){
    const wave=p.armorPulse;
    if(!wave)return;
    const t=(time-wave.t)/.42;
    if(t<0||t>=1)return;
    const r=4+(wave.radius-4)*(1-(1-t)**2);
    const kinetic=wave.id===18,parts=kinetic?7:6;
    c.save();c.translate(wave.x,wave.y);
    c.globalAlpha*=.68*(1-t);c.lineWidth=kinetic?2.1:1.5;c.strokeStyle=suits[wave.id].color;
    c.beginPath();
    for(let i=0;i<parts;i++){
      const a=i*Math.PI*2/parts;
      c.moveTo(Math.cos(a)*r,Math.sin(a)*r);c.arc(0,0,r,a,a+(kinetic?.51:.36));
      if(!kinetic){
        const x=Math.cos(a+.52)*r,y=Math.sin(a+.52)*r;
        c.moveTo(x-2.5,y);c.lineTo(x+2.5,y);c.moveTo(x,y-2.5);c.lineTo(x,y+2.5);
      }
    }
    c.stroke();c.restore();
  }
  function armorTick(g,p,dt){
    if(!standing(p)||dt<=0)return;
    if(p.suit===18||p.suit===19){
      periodicPulse(g,p,dt);
    }else if(p.suit===12){
      const state=armorState(p);
      while(state.pulses>0&&g.time>=state.next){
        state.pulses--;state.next+=1;
        for(const q of crewOf(g,p))if(standing(q)&&q.hp<q.maxHp&&within(g,p,q,175)){
          q.hp=Math.min(q.maxHp,q.hp+3);armorSpark(g,q,12);
        }
      }
    }else if(p.suit===15){
      const state=armorState(p);
      if(g.time<state.ready||g.time<(state.scan||0))return;
      state.scan=g.time+.14;
      let n=0;
      for(const b of g.hostile||[]){
        if(b.life<=0||b.kind||!within(g,p,b,120))continue;
        if(++n===3){
          state.buffer=12;state.expires=g.time+3;state.ready=g.time+10;armorSpark(g,p,15);break;
        }
      }
    }
  }
  function armorDamage(g,p,amount){
    if(!standing(p)||!(amount>0))return amount;
    if(p.lifelineUntil>g.time){
      amount-=Math.min(9,amount*.5);p.lifelineUntil=0;armorSpark(g,p,16);
    }
    if(p.suit===15){
      const state=armorState(p);
      if(state.expires>g.time&&state.buffer>0){
        const soak=Math.min(amount,state.buffer);amount-=soak;state.buffer-=soak;
        if(soak>0)armorSpark(g,p,15);
      }
    }
    // The struck pilot's own plate gets first refusal. One hit consumes at most one.
    const plate=q=>standing(q)&&q.suit===13&&armorState(q).ready<=g.time&&within(g,p,q,125);
    if(amount>0){
      const warden=plate(p)?p:crewOf(g,p).find(plate);
      if(warden){armorState(warden).ready=g.time+9;amount=Math.max(0,amount-(warden===p?10:6));armorSpark(g,p,13);}
    }
    return amount;
  }
  function armorHit(g,p,amount,hullDamage){
    if(!standing(p)||!(amount>0)||!(hullDamage>0))return;
    if(p.suit!==12&&p.suit!==16)return;
    const state=armorState(p);
    if(g.time<state.ready)return;
    if(p.suit===12){
      state.ready=g.time+14;state.pulses=3;state.next=g.time+1;armorSpark(g,p,12);
    }else{
      const target=crewOf(g,p).find(q=>q!==p&&standing(q)&&within(g,p,q,190))||p;
      target.lifelineUntil=g.time+4;state.ready=g.time+10;armorSpark(g,target,16);
    }
  }
  function armorKill(g,p,e){
    if(!standing(p)||!e)return;
    if(p.suit===14){
      const state=armorState(p);state.kills=Math.min(5,(state.kills||0)+1);
      if(state.kills<5||g.time<state.ready)return;
      state.kills=0;state.ready=g.time+5;
      for(const q of crewOf(g,p))if(standing(q)&&within(g,p,q,170)){
        q.shield=Math.min(q.maxShield,q.shield+7);
        for(const ab of q.abilities||[])ab.cd=Math.max(0,(ab.cd||0)-1.5);
        armorSpark(g,q,14);
      }
    }else if(p.suit===17&&Number.isFinite(p.lastHit)&&g.time-p.lastHit>=0&&g.time-p.lastHit<=3){
      const state=armorState(p);
      if(g.time<state.ready)return;
      state.ready=g.time+3;p.hp=Math.min(p.maxHp,p.hp+5);p.scrap=(p.scrap||0)+1;armorSpark(g,p,17);
    }
  }

  const routeMaps = [
    ['Saltglass Causeway','Floodlights cut across the reclaimed crane yards.','Rivet crews and pursuit skiffs.',['Intercept','Transmit']],
    ['The Lung Orchard','Boardwalk loops skirt a chain of flooded root chambers.','Brood flankers and spore curtains.',['Purge','Hunt']],
    ['Furnace Nine','Freight platforms share two crossings above the casting pit.','Foundry heavy crews and slag strikes.',['Stabilize','Breach']],
    ['The Choir Array','Three ramp approaches converge on a signal dais.','Relay marksmen and angled beam fire.',['Transmit','Breach']],
    ['Meridian Aperture','A shattered orbital deck opens around a great lens.','Relay constructs and split volleys.',['Hunt','Stabilize']],
    ['Glass Tide','Cut through tidal shutters beneath a flooded terminal.','Foundry convoy and cross-lane fire.',['Intercept','Breach']],
    ['Spore Observatory','Thread radial walkways between suspended greenhouse bulbs.','Winged brood and root valves.',['Purge','Stabilize']],
    ['Slagworks Crown','Cross the forge roof under a curtain of falling ash.','Staggered press strikes and heavy crews.',['Stabilize','Transmit']],
    ['Dead Frequency','Watch the three arches between paired antenna courtyards.','Echo Scribes and relay sentries.',['Breach','Transmit']],
    ['Moonfall Dock','Cross long moonlit ramps to outmaneuver a dock commander.','Mobile elites and their escorts.',['Hunt','Intercept']],
    ['The Lantern Vault','Enter the fuel chamber through four luminous storage bays.','Brood nests and close-range attackers.',['Purge','Hunt']]
  ];
  const modifiers=['Crosswind','Sleeping Relays','Red Shift'];
  function routes(g) {
    const fresh=routeMaps.map((_,i)=>i).filter(i=>i!==g.mapId);
    const deep=fresh.filter(i=>i>=5);
    const first=random(g,deep);
    const second=random(g,fresh.filter(id=>id!==first && (g.stage>6 || id>=5)));
    const mods=sample(g,modifiers,2);
    const rewards=sample(g,['gun','active','armor','chip',...(g.stage>=9?['overclock']:[])],2);
    return [first,second].map((mapId,i)=>{
      const [name,desc,threat,objectives]=routeMaps[mapId];
      return {mapId,name,desc,threat,objective:random(g,objectives),modifier:mods[i],reward:rewards[i]};
    });
  }

  const recordKey='cinderRelay.records.v1';
  const freeKits=kits.filter(k=>k.cost===0).map(k=>k.id);
  const freshMeta = () => ({
    version:1,data:0,best:0,deepest:0,clears:0,runs:0,last:null,lastRun:null,
    unlocked:freeKits.slice(),unlockedKits:freeKits.slice(),cosmetics:[],contracts:[],seen:[],seenBosses:[],
    firstClearTime:null,campaignCleared:false,highestClearedGate:0,contractedStages:0,ledger:{}
  });
  function loadMeta() {
    try {
      const raw=localStorage.getItem(recordKey);
      if (!raw) return freshMeta();
      const data=JSON.parse(raw);
      if (!data || typeof data!=='object' || Array.isArray(data)) return freshMeta();
      const meta={...freshMeta(),...data};
      meta.unlocked=Array.from(new Set([...freeKits,...(Array.isArray(data.unlocked)?data.unlocked:[]),
        ...(Array.isArray(data.unlockedKits)?data.unlockedKits:[])]));
      meta.unlockedKits=meta.unlocked;
      for (const key of ['cosmetics','contracts','seen','seenBosses']) if (!Array.isArray(meta[key])) meta[key]=[];
      for (const key of ['data','best','deepest','clears','runs','contractedStages'])
        if (!Number.isFinite(meta[key]) || meta[key]<0) meta[key]=0;
      if(!Object.hasOwn(data,'campaignCleared'))meta.campaignCleared=meta.best>=5||meta.deepest>=5||meta.firstClearTime!=null;
      if(!Number.isFinite(data.highestClearedGate))meta.highestClearedGate=Math.max(meta.best,meta.deepest);
      if (!meta.ledger || typeof meta.ledger!=='object' || Array.isArray(meta.ledger)) meta.ledger={};
      return meta;
    } catch (_) {return freshMeta();}
  }
  function saveMeta(meta) {
    try {localStorage.setItem(recordKey,JSON.stringify(meta)); return true;}
    catch (_) {return false;}
  }
  function unlockKit(meta,id) {
    const kit=kits.find(k=>k.id===id);
    if (!kit) return false;
    if (meta.unlocked.includes(id)) return true;
    if (meta.data<kit.cost) return false;
    meta.data-=kit.cost; meta.unlocked.push(id); meta.unlockedKits=meta.unlocked;
    saveMeta(meta); return true;
  }
  function unlockContract(meta,id) {
    const c=contractInfo(id);
    if (!c) return false;
    if (meta.contracts.includes(c.id)) return true;
    if (meta.data<c.cost) return false;
    meta.data-=c.cost; meta.contracts.push(c.id); saveMeta(meta); return true;
  }
  function unlockCosmetic(meta,id) {
    if (!suits[id]) return false;
    if (meta.cosmetics.includes(id)) return true;
    if (meta.data<6) return false;
    meta.data-=6; meta.cosmetics.push(id); saveMeta(meta); return true;
  }
  function setSkin(g,id) {
    if (id!=null && (!suits[id] || !g.meta?.cosmetics?.includes(id))) return false;
    g.player.skin=id; return true;
  }
  function observe(meta,id,boss=false) {
    const list=boss?meta.seenBosses:meta.seen;
    if (!list.includes(id)) list.push(id);
  }
  function ledgerEntry(meta,g) {
    const key=String(g.runId || g.seed || 'local-expedition');
    if (!Object.hasOwn(meta.ledger,key)) meta.ledger[key]={startGate:Math.max(1,Math.floor(g.startGate||1)),depth:0,data:0,finished:false};
    const entry=meta.ledger[key];
    entry.startGate??=1;
    return entry;
  }
  function endlessUnlocked(meta) {
    return meta.campaignCleared??(Math.max(meta.best||0,meta.deepest||0)>=5||meta.firstClearTime!=null);
  }
  function bankGate(meta,g) {
    const entry=ledgerEntry(meta,g);
    const possible=Math.max(0,(g.stage??entry.startGate)-entry.startGate+1);
    const reported=Math.max(0,Math.floor(g.cleared??possible));
    const depth=entry.startGate===1?reported:Math.min(reported,possible);
    if (entry.finished || depth<=entry.depth) return 0;
    const oldDepth=entry.depth, contract=contractInfo(g.contract);
    const gates=depth-oldDepth;
    const firstGate=entry.startGate+oldDepth,lastGate=entry.startGate+depth-1;
    const first=Math.min(firstGate-1,8),last=Math.min(lastGate,8);
    const openingBonus=(last*(last+1)-first*(first+1))/2;
    let earned=gates*(4+(contract?.bonus||0))+openingBonus+8*(gates-(last-first));
    meta.campaignCleared??=endlessUnlocked(meta);
    if (entry.startGate===1&&oldDepth<5 && depth>=5) {
      meta.campaignCleared=true;
      meta.clears++;
      if (meta.firstClearTime==null) {meta.firstClearTime=g.elapsed || 0; earned+=20;}
    }
    if (contract) meta.contractedStages+=depth-oldDepth;
    entry.depth=depth;
    entry.data+=earned;
    meta.data+=earned;
    meta.best=Math.max(meta.best,depth);
    meta.deepest=meta.best;
    meta.highestClearedGate=Math.max(meta.highestClearedGate||0,lastGate);
    saveMeta(meta);
    return earned;
  }
  function finish(meta,g,extracted) {
    const entry=ledgerEntry(meta,g);
    if (entry.finished) return entry.result;
    if ((g.cleared || 0)>entry.depth) bankGate(meta,g);
    const contract=contractInfo(g.contract);
    const success=!!extracted&&entry.depth>0;
    const extra=success ? 4+Math.min(60,entry.depth*2)+(contract?.bonus||0):0;
    entry.data+=extra; meta.data+=extra;
    const squad=g.players?.length ? g.players : [g.player];
    const loadouts=squad.map(p=>({
      kit:kits[p.kitId ?? g.kitId ?? 0]?.name || kits[0].name,
      guns:p.guns.map(w=>{
        const rank=Combat.rankOf(w);
        return Combat.rarityOf(w)+' '+Combat.gunName(w)+(rank?' +'+rank:'');
      }),
      abilities:p.abilities.map(a=>Combat.abilities[a.id].name),
      armor:suitName(p.suit,p.suitRolls?.[p.suit]),bounds:[p.maxHp,p.maxShield],level:p.level,
      overclock:p.overclock || '',keystones:[...(p.keystoneSlots||[])]
    }));
    const result={depth:entry.depth,startGate:entry.startGate,lastGate:entry.depth>0?entry.startGate+entry.depth-1:null,
      elapsed:g.elapsed||0,extracted:success,kills:g.kills||0,
      loadout:loadouts[0],loadouts,contract:contract?.name || '',data:entry.data,extractBonus:extra};
    entry.finished=true; entry.result=result;
    meta.runs++; meta.last=result; meta.lastRun=result;
    saveMeta(meta);
    return result;
  }

  window.Progress={
    kits,suits,passives,contracts,overclocks,chipInfo,affixInfo,armorPrefixes,armorSuffixes,newPlayer,recalc,levelXP,addXP,
    draft,take,salvage,refit,installChip,rollAffix,buyAffix,repair,repairCost,equippedName,weaponDetail,
    onObjective,onElite,onDodge,onNearMiss,onGate,guardDamage,armorTick,armorDamage,armorHit,armorKill,drawArmorPulse,routes,routeMaps,
    loadMeta,saveMeta,unlockKit,unlockContract,unlockCosmetic,setSkin,observe,bankGate,finish,endlessUnlocked
  };
})();
