/* Cinder Relay | personal weapons, deployables and field systems */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const families = ['Assault','Scatter','Precision','Ordnance','Emitter','Fabricator'];
  // Name, field notes, accent, base damage, shots/sec, magazine, refit time, range, shot velocity.
  const weaponRows = [
    ['Linebreaker','Automatic service rifle. Accurate midrange fire and a fast reload.','#ffb951',12,7.4,30,1.05,565,670],
    ['Sable Burst','Three-round volleys mark an enemy when all three connect.','#ffa88d',13,2.85,24,1.28,575,720],
    ['Thornwheel','Piercing thorns grow a second spike behind the first body.','#b9df67',16,5,24,1.35,500,530],
    ['Prism Carbine','Hold a steady bearing to focus a loose prism stream.','#c9baff',10,10,36,1.28,585,700],
    ['Ratchet AR','Strafe to wind the drum, then unload six rounds in a burst.','#ffd25d',16,4.6,30,1.4,545,645],
    ['Duplex Repeater','Alternates blue armor punches and red hull breakers.','#ff906a',18,5.2,24,1.3,550,665],
    ['Rivet Jaw','A seven-pellet blast drives nearby enemies into their squad.','#ffdb96',9,1.9,8,1.34,260,510],
    ['Furnace Vent','A broad cone of burning cinders scorches approaching enemies.','#ff914b',7,2.6,12,1.5,240,420],
    ['Glass Choir','Crystal buckshot fractures into diagonal fans at impact.','#e5bcff',10,2.15,9,1.5,330,625],
    ['Maw Pump','Piercing slugs. Every third shell spills a lingering acid pool.','#c4e677',22,2.7,9,1.45,315,530],
    ['Shear Door','Parallel banks of pellets cut both flanks around an empty center.','#a8e8ed',10,2,10,1.3,330,590],
    ['Kiln Brake','Hold to compress flechettes. Release for a tighter, heavier wedge.','#dfaaff',10,2.8,8,1.5,380,680],
    ['Rail Spike','Hold to charge the rails, release to send a piercing lance.','#8df8ff',28,3.1,6,1.45,735,1140],
    ['Horizon Nail','Rapid precision needles stack damage against the same target.','#d4e995',22,3.65,12,1.2,680,950],
    ['Rift Needle','Penetrating a marked target redirects the round toward your aim.','#c797fe',27,3,9,1.35,660,850],
    ['Surveyor','Tap to tag three targets. Hold and release to shoot through your tags.','#8dffe1',29,3.25,8,1.35,650,930],
    ['Corner Pin','Plant a mirror stake against a wall. Fire at the stake to bank shots.','#b4f3ff',30,2.65,8,1.35,775,870],
    ['Redress Rifle','Reload with one round left to cash in damage banked on your target.','#ff8b83',23,3.1,5,1.1,680,900],
    ['Drum Mortar','Lob a shell over cover to the marked impact point.','#ffb64b',70,1.45,6,1.65,520,430],
    ['Cinder Cluster','A heavy shell scatters four secondary charges.','#ff9355',45,1.3,6,1.85,530,490],
    ['Anchor Cannon','Impact creates an implosion that pulls enemies together, then bursts.','#abafff',63,1.25,6,1.8,515,440],
    ['Seedpod Lobber','Lob up to four dormant mines. Enemies trigger their spores.','#bfdf6d',77,1.65,7,1.7,480,430],
    ['Knucklebone','A heavy skipping slug arcs over cover and bursts on its second bounce.','#e7dec7',85,1.35,6,1.7,535,465],
    ['Fuse Stitcher','Hold to lay a stitch of charges along your aim. Release to detonate.','#ffbf68',31,5.4,12,1.45,495,570],
    ['Volt Arc','Short-range lightning chains between nearby targets, leaving Static.','#8edbff',15,5.1,48,1.65,280,720],
    ['Sunspool','Solar beam ramps on one target. Release early to avoid overheating.','#ffd36c',8,12,64,2.1,420,960],
    ['Frost Fan','A coolant fan chills approaching enemies and freezes light bodies.','#a7eeff',5,5.5,48,1.6,218,445],
    ['Phase Disc','A piercing disc returns to you. Strafe to steer its return path.','#c0a0ff',30,2.2,9,1.45,345,425],
    ['Sweep Lantern','A timed beam sweeps an arc. Each trigger reverses the direction.','#86ffdc',23,1.45,42,1.7,325,840],
    ['Crossfield','Two electric prongs converge on a high-energy Static crossing.','#d5b5ff',18,2.4,42,1.8,405,760],
    ['Wasp Foundry','Homing wasps acquire targets in your aiming cone.','#ffd76d',18,4.1,16,1.5,495,300],
    ['Hive Needle','Direct hits plant up to three small floor sentries.','#d0ed91',20,2.9,10,1.55,475,560],
    ['Remora Caster','Attaches a drone to an enemy. The drone fires along your aim.','#ffa6c5',18,3,10,1.55,485,550],
    ['Fossil Engine','A burrower travels beneath cover, then erupts at the target point.','#f0d09a',80,1.35,6,1.6,475,390],
    ['Lantern Tick','Ticks retrace your footsteps and explode when approached.','#d7f48c',70,1.85,9,1.45,325,255],
    ['Husk Loom','Place a pair of spool beetles. Their tripwire damages and slows.','#ffafba',32,2.8,10,1.45,405,465],
    ['Suture Carbine','Aim at a wounded ally to spend stored repair charge. Hitting enemies refills it and stitches your own hull every third hit.','#8cf0be',19,4.3,18,1.4,405,640],
    ['Switchyard Driver','Print a crosswise electric fence. Two fences can stand at once, slowing enemies and absorbing three ordinary shots each.','#f6ce78',20,1.55,7,1.7,330,360],
    ['Bulwark Repeater','Every third landed bolt restores shield to the most depleted visible pilot within 170 units of you.','#8dd5ff',16,6.1,27,1.4,455,590],
    ['Lifeboat Mortar','Lob a capsule that explodes, then shelters pilots inside its landing ring from four ordinary shots.','#ffd7a6',58,1.35,5,1.85,410,390],
    ['Honeycomb Harvester','Print two workers that sting foes and fly repair nectar to wounded pilots. Fire stingers while both workers are away.','#eac878',27,2.2,8,1.5,320,320],
    ['Watchtower Press','Print an automatic gun tower. Print on its pedestal again for twin barrels. Two towers can stand at once.','#9ac9dd',23,1.7,8,1.65,330,470],
    ['Gravwinch Mill','Install a winch that reels light foes toward its wheel in three damaging pulses. Heavy foes take damage in place.','#bea0ef',35,1.45,6,1.7,325,440]
  ];
  const supportFamilies=['Assault','Fabricator','Assault','Ordnance','Fabricator','Fabricator','Fabricator'];
  const guns = weaponRows.map(([name,desc,color,damage,rate,mag,reload,range,speed],id)=>{
    const familyIndex=id<36?Math.floor(id/6):families.indexOf(supportFamilies[id-36]);
    return {id,name,desc,color,damage,rate,mag,magazine:mag,reload,range,speed,family:families[familyIndex],familyIndex,
      heat:[24,25,26,28,29].includes(id),charged:[11,12,15].includes(id),
      pointTargeted:[15,18,19,20,21,22,23,29,33,35,37,39,40,41,42].includes(id)};
  });
  const creatureGear = window.CinderCreatureGear;
  for (const weapon of creatureGear.weapons) {
    guns.push({...weapon,id:guns.length,familyIndex:families.indexOf(weapon.family),magazine:weapon.mag,heat:!!weapon.heat});
  }
  const skillRows = [
    ['Repulsor Sweep','Push a cone of enemies and clear eight ordinary shots.',12,'#91efff','Wideband','Rebound'],
    ['Bastion Screen','Project a directional bullet barrier for 2.5 seconds.',20,'#a3e9ff','Stored Charge','Mobile Wall'],
    ['Slip Beacon','Drop an anchor. Recast within six seconds to return.',24,'#83eddb','Afterimage','Homecoming'],
    ['Arc Lattice','Stretch a charged wire across the floor to shock enemies.',22,'#a4bdff','Third Node','Capacitor'],
    ['Meteor Tag','Mark an orbital impact. The strike lands after one second.',25,'#ffaf66','Fragment','Deep Drill'],
    ['Frost Vane','Freeze light enemies in a broad coolant cone.',18,'#b9f7ff','Whiteout','Brittle Edge'],
    ['Cinder Wake','The next two dashes within five seconds leave burning trails.',19,'#ff8857','Backdraft','Fire Line'],
    ['Repair Wasp','A stationary drone repairs up to 14 hull while you stay nearby.',32,'#a3edb5','Field Stitch','Triage Split'],
    ['Null Halo','Expand a pulse to erase incoming ordinary bullets.',30,'#c7aeff','Counterpulse','Double Echo'],
    ['Gravity Fold','Compress light enemies into a small area and stagger heavy units.',24,'#ab9dff','Event Horizon','Shear Edge'],
    ['Brood Decoy','Deploy a fake target to distract ordinary enemies.',20,'#e0a1a0','Molt','Mirror Burst'],
    ['Vector Overdrive','Boost movement, reload, and swap speed for five seconds.',26,'#ffdb80','Redline','Perfect Rhythm'],
    ['Rescue Flare','Repair 18 hull nearby. A remote link sends 9 hull to a distant or obscured living partner. Revives require sight within the flare.',38,'#85e5b1','Wideband Flare','Trauma Seal'],
    ['Aegis Canopy','Deploy a five-second dome that blocks 16 ordinary shots. A partner outside it receives a mobile three-second shield for four ordinary shots, even across rooms.',25,'#91cdff','Counterbattery','Reserve Cell'],
    ['Relay Overcharger','Refill 40% of the readied magazine or vent its heat. Nearby pilots also gain 25% firing cadence for four seconds.',25,'#ffc766','Deep Magazine','Hot Bus'],
    ['Foamseed Nursery','Print a nursery that lays three proximity pods in a fan. Each pod bursts when a foe approaches.',24,'#a7e59c','Extra Brood','Frost Shell'],
    ['Mirror Foundry','Build a relay prism. While you fire with a clear link within 320 units, it sends a piercing bolt along your aim.',23,'#a6b9ff','Forked Lens','Long Exposure']
  ];
  const abilities=skillRows.map(([name,desc,cooldown,color,a,b],id)=>({id,name,desc,cooldown,color,augments:[a,b]}));
  const chips=['Counterweight','Condensate Coil','Primer Cap','Split Fuse','Relay Antenna','Field Spool'];
  const prefixRules = {
    Shortstroke:d=>!d.heat,'Heavy-Bore':()=>true,Threaded:d=>[0,1,2,3,4,5,9,12,13,14,17].includes(d.id),
    Braced:d=>[0,3,4,6,7,10].includes(d.id),Featherweight:d=>!d.heat,Drumfed:d=>!d.heat,Quickdraw:d=>!d.heat,
    'Cold-Jacket':d=>d.heat,Splitcore:d=>d.family==='Scatter',Longglass:d=>!d.heat&&d.family!=='Ordnance',
    Compact:d=>['Assault','Scatter','Precision'].includes(d.family),Capacitor:d=>d.charged,'Soft-Fused':d=>d.family==='Ordnance','Spare-Coil':d=>d.id===24
  };
  const suffixRules = {
    'of First Contact':d=>!d.heat,'of the Last Word':d=>!d.heat,'of Ricochet':d=>[0,1,2,3,4,5,6,9,10,12,13,14,17].includes(d.id),
    'of Burrowing':d=>d.charged,'of Aftershock':d=>['Precision','Ordnance'].includes(d.family),'of Triage':()=>true,
    'of the Hunter':()=>true,'of Shrapnel':d=>!d.heat,'of Focus':d=>['Assault','Emitter','Precision'].includes(d.family),
    'of Momentum':d=>!d.heat,'of the Reserve':()=>true,'of Scavenging':()=>true,'of Grounding':d=>[24,29].includes(d.id),
    'of Breach':d=>['Assault','Scatter','Precision'].includes(d.family),'of Cinders':()=>true,'of Recall':d=>[27,30,34].includes(d.id)
  };
  function eligibleAffixes(id) {
    const d=guns[id];
    if(d.creatureId){
      const prefix=d.heat?['Heavy-Bore','Cold-Jacket']:['Heavy-Bore','Shortstroke','Drumfed','Quickdraw'];
      if(d.creatureId==='unicorn-sniper')prefix.push('Threaded','Longglass','Compact');
      if(d.family==='Ordnance')prefix.push('Soft-Fused');
      return {prefix,suffix:['of the Hunter','of Cinders']};
    }
    return {prefix:Object.keys(prefixRules).filter(k=>prefixRules[k](d)),suffix:Object.keys(suffixRules).filter(k=>suffixRules[k](d))};
  }
  function compatibleChips(id) {
    const d=guns[id];
    if(d.creatureId)return d.heat?['Condensate Coil']:d.family==='Ordnance'?['Split Fuse','Primer Cap']:d.family==='Fabricator'?['Relay Antenna','Primer Cap']:['Primer Cap'];
    return chips.filter(c=>c==='Condensate Coil'?d.heat:c==='Split Fuse'?d.family==='Ordnance':c==='Relay Antenna'?d.family==='Fabricator':c==='Primer Cap'||c==='Field Spool'?!d.heat:true);
  }
  const pick=(a,r)=>a[Math.min(a.length-1,Math.floor(r()*a.length))];
  const clamp=(n,min,max)=>Math.max(min,Math.min(n,max));
  const distance=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y);
  const distanceSq=(a,b)=>{const dx=b.x-a.x,dy=b.y-a.y;return dx*dx+dy*dy;};
  const angle=(a,b)=>Math.atan2(b.y-a.y,b.x-a.x);
  const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const suit=g=>typeof g.player.suit==='object'?g.player.suit?.id:g.player.suit;
  const stat=(g,key)=>g.player.stats?.[key]||0;
  const handling=(g,d)=>g.player.stats?.familyHandling?.[d.family]||0;
  const live=e=>e&&e.hp>0&&!e.dead;
  // Cache cards roll independently on a 10,000-ticket deck; affixes can later be reforged.
  const rarityOdds=[
    {name:'Common',chance:72,damageBonus:0,cadenceBonus:0},
    {name:'Uncommon',chance:23,damageBonus:.32,cadenceBonus:.04},
    {name:'Rare',chance:4.5,damageBonus:.75,cadenceBonus:.09},
    {name:'Epic',chance:.45,damageBonus:1.32,cadenceBonus:.15},
    {name:'Legendary',chance:.05,damageBonus:2.10,cadenceBonus:.24}
  ];
  const tierByName=new Map(rarityOdds.map(tier=>[tier.name,tier]));
  function rollRarity(rng){
    let ticket=Math.min(9999,Math.floor(rng()*10000));
    for(const tier of rarityOdds){
      ticket-=Math.round(tier.chance*100);
      if(ticket<0)return tier.name;
    }
    return 'Legendary';
  }
  function rarityOf(w){
    if(tierByName.has(w.rarity))return w.rarity;
    // Legacy Standard / Tuned / Prototype items had zero / one / two affixes.
    if(w.prefix&&w.suffix)return 'Rare';
    return w.prefix||w.suffix?'Uncommon':'Common';
  }
  function rankOf(w){return Number.isFinite(w.upgradeLevel)?clamp(Math.floor(w.upgradeLevel),0,3):0;}
  function normalizeGun(w){
    w.rarity=rarityOf(w);w.upgradeLevel=rankOf(w);return w;
  }
  function weaponPower(w){
    return (1+tierByName.get(rarityOf(w)).damageBonus)*(1+.20*rankOf(w));
  }
  function weaponCadence(w){
    return (1+tierByName.get(rarityOf(w)).cadenceBonus)*(1+.06*rankOf(w));
  }
  function makeGun(id,rng=Math.random,roll=false) {
    const d=guns[id]||guns[0];
    const w={id:d.id,rarity:roll?rollRarity(rng):'Common',upgradeLevel:0,ammo:d.mag,capacity:d.mag,heat:0,reload:0,reloadTotal:0,charge:0,cd:0,prefix:'',suffix:'',chip:'',shots:0};
    if (roll) {
      const aff=eligibleAffixes(d.id),quality=rng();
      const paired=w.rarity==='Epic'||w.rarity==='Legendary'||(w.rarity==='Rare'&&quality<.55)||(w.rarity==='Uncommon'&&quality<.15);
      if(paired){
        w.prefix=pick(aff.prefix,rng);w.suffix=pick(aff.suffix,rng);
      }else if(w.rarity!=='Common'||quality<.20){
        if(rng()<.55)w.prefix=pick(aff.prefix,rng);else w.suffix=pick(aff.suffix,rng);
      }
      w.capacity=baseCapacity(w); w.ammo=w.capacity;
    }
    return w;
  }
  const makeAbility=id=>({id,cd:0,augment:0});
  const gunName=w=>[w.prefix,guns[w.id].name,w.suffix].filter(Boolean).join(' ');
  const currentGun=g=>g.player.guns[g.player.ready[g.player.selected||0]];
  function baseCapacity(w) {
    return Math.max(2,Math.round(guns[w.id].mag*(w.prefix==='Drumfed'?1.30:w.prefix==='Shortstroke'?.85:w.prefix==='Quickdraw'?.85:1)));
  }
  function capacity(g,w) {return Math.max(2,Math.round(baseCapacity(w)*(1+stat(g,'magazine'))*(stat(g,'overclock')==='Fast Hands'?.83:1)));}
  function state(g) {
    if(!g.combat) g.combat={shots:[],entities:[],lines:[],impacts:[],blasts:[],history:[],gap:0,wake:0,overdrive:0,lastDash:false,pathTick:0,healUsed:0};
    return g.combat;
  }
  function clearLab(g,a,b) {
    return !g.map?.lab||Labyrinth.clearLine(g.map.lab,a,b);
  }
  // Lobbed ordnance still clears low cover. Structural walls stop its targeting cursor and payload together.
  function reachablePoint(g,from,to) {
    if(clearLab(g,from,to))return to;
    let low=0,high=1;
    const at=t=>({x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t});
    for(let i=0;i<10;i++){
      const mid=(high+low)/2;
      if(clearLab(g,from,at(mid)))low=mid;else high=mid;
    }
    return at(Math.max(0,low-1/Math.max(1,distance(from,to))));
  }
  function near(g,p,max,condition=null) {
    let best=null, bestSq=max*max;
    for(const e of g.enemies) {
      if(!live(e))continue;
      const d=distanceSq(p,e);
      if(d<bestSq&&(!condition||condition(e))&&clearLab(g,p,e)){best=e;bestSq=d;}
    }
    return best;
  }
  function nearestOnAim(g,max,cone=.55) {
    const p=g.player; let target=null,best=Infinity;
    for(const e of g.enemies){
      if(!live(e))continue;
      const d=distanceSq(p,e);if(d>=max*max)continue;
      const off=Math.abs(wrap(angle(p,e)-p.a));if(off>=cone)continue;
      const score=off*180+Math.sqrt(d)*.15;
      if(score<best&&clearLab(g,p,e)){best=score;target=e;}
    }
    return target;
  }
  function line(g,a,b,col,width=2,life=.12,kind='line') {
    const arr=state(g).lines;
    if(arr.length<180)arr.push({x:a.x,y:a.y,tx:b.x,ty:b.y,color:col,width,life,max:life,kind});
  }
  function field(g,kind,x,y,r,life,options={}) {
    const e={kind,x,y,r,life,max:life,age:0,tick:0,color:'#ffd37e',damage:0,aug:0,...options};
    const arr=state(g).entities;
    if(arr.length>=140)arr.splice(Math.max(0,arr.findIndex(a=>a.life<=0||a.kind==='spark'||a.kind==='acid')),1);
    arr.push(e);return e;
  }
  function capField(g,kind,limit) {
    const items=state(g).entities.filter(q=>q.kind===kind&&q.life>0);
    if(items.length>=limit)items[0].life=0;
  }
  function crewInRange(g,origin,radius){
    return (g.players?.length?g.players:[g.player]).filter(p=>p.hp>0&&!p.downed&&distanceSq(origin,p)<=radius*radius&&clearLab(g,origin,p));
  }
  function neediest(pilots,key,maxKey){
    let target=null,fraction=1;
    for(const pilot of pilots){
      const fill=pilot[key]/Math.max(1,pilot[maxKey]);
      if(fill<fraction){target=pilot;fraction=fill;}
    }
    return target;
  }
  function repairHull(g,source,target,amount,color){
    if(!target||target.hp<=0||target.downed)return 0;
    const repair=Math.min(amount,Math.max(0,target.maxHp-target.hp));
    if(repair>0){
      target.hp+=repair;
      if(source!==target)line(g,source,target,color,2,.2);
      field(g,'repairPulse',target.x,target.y,14,.3,{color});
    }
    return repair;
  }
  function targetPoint(g,range) {
    const p=g.player,aim=g.aim||p;
    const len=clamp(distance(p,aim),22,range),a=p.a;
    return reachablePoint(g,p,{x:p.x+Math.cos(a)*len,y:p.y+Math.sin(a)*len});
  }
  function beamEnd(g,p,a,len) {
    let d=8;for(;d<len;d+=8)if((g.shotBlocked||g.blocked)(p.x+Math.cos(a)*d,p.y+Math.sin(a)*d,0))break;
    d=Math.min(d,len);return{x:p.x+Math.cos(a)*d,y:p.y+Math.sin(a)*d};
  }
  function touchesSegment(p,a,b,r) {
    if(p.x+r<Math.min(a.x,b.x)||p.x-r>Math.max(a.x,b.x)||p.y+r<Math.min(a.y,b.y)||p.y-r>Math.max(a.y,b.y))return false;
    const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);
    const x=p.x-a.x-dx*t,y=p.y-a.y-dy*t;
    return x*x+y*y<r*r;
  }
  function makeShot(g,p,a,opts) {
    const c=state(g);if(c.shots.length>=260)return;
    const s={x:p.x,y:p.y,ox:p.x,oy:p.y,a,speed:580,range:500,damage:12,color:'#ffd893',shape:'slug',r:2,pierce:0,push:12,hit:new Set(),age:0,travel:0,...opts};
    c.shots.push(s);return s;
  }
  function chill(e,amount) {
    e.frost=Math.min(1.3,(e.frost||0)+amount);
    if(e.frost>=1&&!e.boss&&(e.mass||1)<3) {e.stun=Math.max(e.stun||0,.75);e.frozen=.8;e.frost=.50;}
  }
  function lightHit(g,e,damage,a,push=0,element='') {
    if(!live(e)||e.boss&&e.arrive>0)return;
    if((e.elite||e.boss)&&!(e.breakLock>0)&&(push>=45||damage>=27)) {
      // Large bodies turn impact into a brief punish window instead of being launched.
      const impact=Math.min(27,Math.max(0,push-28)*.075+Math.max(0,damage-19)*.19);
      const threshold=e.boss?138:e.traits?.includes('Armored')?95:70;
      e.breakValue=Math.min(1,(e.breakValue||0)+impact/threshold);
      if(e.breakValue>=1){
        const duration=e.boss?1.15:e.traits?.includes('Armored')?1.55:1.05;
        e.stagger=Math.max(e.stagger||0,duration);e.breakLock=duration+2.2;e.breakVisible=duration;e.breakValue=0;
        field(g,'break',e.x,e.y,e.r+16,.45,{color:'#ffe4aa'});g.fx(e.x,e.y,'#ffe0a0',15);g.sound('break');
      }
    }
    g.hurtEnemy(e,damage*(e.marked>0?1.1:1),a,push,element);
  }
  function blastStyle(p,w,color) {
    if(w?.id===20||w?.id===29||color==='#d5b5ff')return 'ion';
    if(w?.id===21||p.kind==='tick')return 'spore';
    if(w?.id===22||w?.id===33)return 'quake';
    if(color==='#b9f8ff'||color==='#91efff')return 'cryo';
    return 'thermal';
  }
  function blastFX(g,x,y,r,style,priority=1,delay=0) {
    const c=state(g),blasts=c.blasts||(c.blasts=[]);
    if(blasts.length>=18){
      const replace=blasts.findIndex(fx=>fx.priority<=priority);
      if(replace<0)return;
      blasts.splice(replace,1);
    }
    const seed=(c.effectSeed=(c.effectSeed||0)+1),duration=.47+Math.min(r,112)*.0035;
    blasts.push({x,y,r,style,priority,age:-delay,duration,seed});
  }
  function deathFX(g,e) {
    if(!e||(!e.boss&&!e.elite))return;
    const r=e.r||16;
    if(!e.boss){blastFX(g,e.x,e.y,r+11,'quake',1);return;}
    const radius=clamp(r*2.8,54,115);
    blastFX(g,e.x,e.y,radius,'thermal',3);
    for(let i=0;i<3;i++){
      const a=i*TAU/3+.55,offset=radius*(i===1?.47:.35);
      blastFX(g,e.x+Math.cos(a)*offset,e.y+Math.sin(a)*offset,radius*(.32+i*.065),i===1?'ion':'quake',2,.11+i*.11);
    }
  }
  function blast(g,p,r,damage,color,push=110,element='',w=null) {
    const split=w?.chip==='Split Fuse',style=blastStyle(p,w,color);
    blastFX(g,p.x,p.y,r,style,r>80?2:1);
    if(r>=62&&g.settings?.shake)g.shakePower=Math.max(g.shakePower||0,Math.min(3,r/36));
    if(damage>29)g.sound(style+'-blast');
    window.Foes?.blast?.(g,p,r,damage);
    for(const e of g.enemies.slice()) {
      if(!live(e))continue;const d=distance(e,p);if(d>r+e.r||!clearLab(g,p,e))continue;
      const edge=clamp(d/r,0,1);
      const fall=split?.85+.22*edge:1-(w&&handling(g,guns[w.id])===3?.16:.32)*edge;
      if(element==='burn'){e.burn=Math.max(e.burn||0,1.5);e.burnPower=4;}
      const hitDamage=damage*fall, force=push*(1-.4*edge),direction=angle(p,e);
      if(w&&edge<.55)statusHit(g,e,{w,id:w.id,color,damage:hitDamage,a:direction,push:force,element});
      else lightHit(g,e,hitDamage,direction,force,element);
    }
  }
  function statusHit(g,e,s) {
    const w=s.w,p=g.player;
    const marked=e.marked>0,burning=e.burn>0,hadPlate=e.shield>0||e.armor>0||e.guard>0;
    let dmg=s.damage, push=s.push||0;
    if(s.firstMark)e.marked=3.8;
    if(s.element==='burn'){
      const power=w?weaponPower(w):1;
      e.burn=2.4;e.burnPower=Math.max(e.burnPower||0,Math.min(10*power,(e.burnPower||3*power)+power));
    }
    if(s.element==='chill')chill(e,s.chill||.18);
    if(s.element==='static')e.static=3.5;
    if(w) {
      const m=weaponMemory(w);
      if(s.id===5) {
        if(s.blue && e.shield>0){e.shield=Math.max(0,e.shield-dmg*.45);dmg*=1.08;}
        if(!s.blue&&!hadPlate)dmg*=1.14;
      }
      if(s.id===1&&s.burstKey){const count=s.burstKey.get(e)||0;s.burstKey.set(e,count+1);if(count>=2)e.marked=4.2;}
      if(s.id===13||s.id===25){m.chain=m.target===e?Math.min(6,(m.chain||0)+1):0;m.target=e;dmg*=1+m.chain*(s.id===25?.19:.09);if(s.id===25&&handling(g,guns[w.id])===3)dmg*=1+.025*(m.chain||0);}
      if(s.id===17){if(m.bankTarget!==e){m.bank=0;m.bankTarget=e;}m.bank=(m.bank||0)+dmg*.45;}
      if(w.suffix==='of the Hunter'&&marked)dmg*=1.18;
      if(w.prefix==='Longglass'&&distance(p,e)<95)dmg*=.90;
      if(w.prefix==='Compact'&&distance(p,e)<130)push+=36;
      if(distance(p,e)<150)push*=1+stat(g,'closeStagger');
      if(guns[w.id].family==='Precision'&&p.voidPrimed&&suit(g)===10){dmg*=1.35;p.voidPrimed=false;}
      if(w.suffix==='of First Contact'&&s.first){dmg*=1.22;push+=55;}
      if(w.chip==='Primer Cap'&&s.first)push+=60;
      if(w.suffix==='of the Last Word'&&s.last)push+=85;
      if(w.suffix==='of the Reserve'&&w.reserve){push+=65;w.reserve=false;}
      if(stat(g,'Quick Exchange')&&w.drawReady){push+=55;w.drawReady=false;}
      if(w.suffix==='of Focus'){m.focus=m.focusTarget===e?Math.min(7,(m.focus||0)+1):0;m.focusTarget=e;}
      if(w.suffix==='of Grounding'&&s.wasStatic&&g.time>(w.procAt||0)){e.static=0;w.procAt=g.time+.65;for(const t of g.enemies)if(live(t)&&distance(t,e)<70&&clearLab(g,e,t))chill(t,.50);}
      if(w.suffix==='of Cinders'&&burning&&g.time>(w.procAt||0)){w.procAt=g.time+1.1;blast(g,e,40,8*weaponPower(w),'#ff945b',20);}
      if(w.suffix==='of Aftershock'&&g.time>(w.procAt||0)){w.procAt=g.time+.8;field(g,'fuse',e.x,e.y,40,.36,{damage:10*weaponPower(w),color:'#ffda91'});}
      if(stat(g,'Hot Lead')){e.leadHits=(e.leadHits||0)+1;if(e.leadHits%3===0){e.burn=2.4;e.burnPower=Math.max(e.burnPower||0,Math.min(10,(e.burnPower||3)+2));}}
      if(e.frozen>0){
        const glassFan=s.id===8&&stat(g,'Glass Garden');
        if(glassFan||(dmg>=22&&(stat(g,'Ice Breaker')||e.brittle))){
          e.frozen=0;e.brittle=false;
          if(glassFan){
            const tip={x:e.x+Math.cos(s.a)*(e.r+4),y:e.y+Math.sin(s.a)*(e.r+4)};
            shards(g,tip,s.a,6,s.color,Math.max(10,s.damage));
          }
          blast(g,e,52,18,'#b9f8ff',48);
        }
      }
    }
    lightHit(g,e,dmg,s.a,push,s.element);
    const id=w?.id??s.artId;
    if(id!==undefined&&(e.impactAt??-1)<=g.time){
      const impacts=state(g).impacts;
      if(impacts.length<48){
        const a=s.a??p.a;
        impacts.push({x:e.x-Math.cos(a)*e.r*.7,y:e.y-Math.sin(a)*e.r*.7,a,
          family:guns[id].familyIndex,color:guns[id].color,life:.20});
        e.impactAt=g.time+.065;
      }
    }
    if(!w)return;
    if(w.suffix==='of Breach'&&hadPlate&&!(e.shield>0||e.armor>0||e.guard>0))shards(g,e,s.a,3,s.color,7*weaponPower(w));
    if(!live(e)){
      if(w.suffix==='of Triage'&&e.elite&&marked)p.shield=Math.min(p.maxShield,p.shield+7);
      if(w.suffix==='of Shrapnel'&&g.time>(w.procAt||0)){w.procAt=g.time+.38;shards(g,e,s.a,4,s.color,8*weaponPower(w));}
      if(w.suffix==='of Scavenging'&&e.elite&&w.scrapStage!==g.stage){w.scrapStage=g.stage;p.scrap=(p.scrap||0)+4;}
      if(stat(g,'Flash Fuel')&&burning)field(g,'fire',e.x,e.y,30,1.5,{damage:5,color:'#ff985c'});
      if(stat(g,'Shield Harvest')&&e.elite&&marked)field(g,'harvest',e.x,e.y,24,7,{color:'#90eaff'});
    }
  }
  const transient=new WeakMap();
  function weaponMemory(w){if(!transient.has(w))transient.set(w,{});return transient.get(w);}
  function shards(g,p,a,count,color,damage) {
    for(let i=0;i<count;i++)makeShot(g,p,a+(i-(count-1)/2)*.17,{range:130,speed:440,damage,color,push:12,shape:'shard',r:2});
  }
  function damageFor(g,w) {
    const d=guns[w.id],fam=g.player.stats?.familyDamage?.[d.family]||0;
    const precision=d.family==='Precision'?1+stat(g,'precisionBoost'):1;
    const creatureBoost=1+(g.player.stats?.creatureDamage?.[d.creatureClass]||0);
    return d.damage*creatureBoost*weaponPower(w)*(1+stat(g,'damage')+fam)*precision*(w.prefix==='Heavy-Bore'?1.16:w.prefix==='Threaded'?.9:w.prefix==='Splitcore'?.90:1);
  }
  function rateFor(g,w) {
    const d=guns[w.id];
    return d.rate*weaponCadence(w)*(1+stat(g,'fireRate'))*(g.combat?.overchargeUntil>g.time?1+g.combat.overchargeBoost:1)*(w.prefix==='Shortstroke'?1.12:w.prefix==='Heavy-Bore'?.88:1)
      *(stat(g,'overclock')==='Heavy Core'?.86:1)*(g.combat?.redline>0?1.28:1)*(w.recall>0?1.15:1)/(d.charged&&w.prefix==='Capacitor'?1.12:1);
  }
  function blastRadius(g,w,r) {
    return r*(1+handling(g,guns[w.id])*.10)*(w.prefix==='Soft-Fused'?.83:1);
  }
  function reload(g,manual=true) {
    const w=currentGun(g);if(!w||w.reload>0)return false;
    const d=guns[w.id];if(d.heat?w.heat<.055:w.ammo>=capacity(g,w))return false;
    if(w.id===17&&manual&&w.ammo===1) {
      const m=weaponMemory(w);if(live(m.bankTarget)&&m.bank>0&&clearLab(g,g.player,m.bankTarget)) {
        line(g,g.player,m.bankTarget,d.color,4,.27);
        lightHit(g,m.bankTarget,m.bank+damageFor(g,w),angle(g.player,m.bankTarget),80);
        g.fx(m.bankTarget.x,m.bankTarget.y,d.color,10);
      }
    }
    const m=weaponMemory(w);m.bank=0;m.bankTarget=null;m.burst=null;
    w.reloadTotal=d.reload*(w.prefix==='Drumfed'?1.18:1)*(w.prefix==='Cold-Jacket'&&w.heat>=.99?1.18:1);
    w.reload=w.reloadTotal;w.charge=0;g.sound('reload',w.id);return true;
  }
  function swap(g) {
    const p=g.player,i=1-(p.selected||0),next=p.guns[p.ready[i]];
    if(!next||next===currentGun(g))return false;
    const old=currentGun(g);
    if(old){old.charge=0;old.wound=old.wound||0;weaponMemory(old).burst=null;detonateStitch(g,old);}
    p.selected=i;
    const c=state(g);
    next.cd=Math.max(next.cd||0,.24/(1+stat(g,'swapSpeed'))*(next.prefix==='Quickdraw'?.32:next.prefix==='Featherweight'?.62:1)*(stat(g,'overclock')==='Fast Hands'?.45:1)*(c.overdrive>0?.50:1)*(p.fieldworkUntil>g.time?.8:1));
    next.drawReady=true;next.reserve=(next.stowed||0)>3;next.stowed=0;
    if(guns[next.id].family==='Assault'&&handling(g,guns[next.id])===3){next.stable=.45;next.focusTime=.8;}
    g.sound('swap');return true;
  }
  function creatureCombat(g) {
    const c=state(g);
    if(c.creatures)return c.creatures;
    const rayLength=(x,y,dx,dy,range,blocked)=>{
      if(blocked(x,y,0))return 0;
      let distance=0;
      while(distance<range){
        const next=Math.min(distance+6,range);
        if(blocked(x+dx*next,y+dy*next,0))break;
        distance=next;
      }
      return distance;
    };
    const shotRay=(x,y,dx,dy,range)=>rayLength(x,y,dx,dy,range,g.shotBlocked||g.blocked);
    return c.creatures=new CinderCreatureCombat({
      enemies:()=>g.enemies,
      isAlive:e=>live(e)&&!(e.boss&&e.arrive>0),
      clearLine(a,b){
        if(g.map?.lab)return clearLab(g,a,b);
        const dx=b.x-a.x,dy=b.y-a.y,range=Math.hypot(dx,dy);
        return !range||shotRay(a.x,a.y,dx/range,dy/range,range)>=range;
      },
      damageEnemy(e,amount,attack){
        const {w,push,x,y}=attack;
        const a=Math.atan2(e.y-y,e.x-x);
        statusHit(g,e,{id:w.id,w,damage:amount,a,push,color:attack.color,first:attack.first,last:attack.last,firstMark:attack.firstMark});
      },
      limitRay:shotRay,
      movementRay:(x,y,dx,dy,range)=>rayLength(x,y,dx,dy,range,g.blocked)
    });
  }
  function fire(g,w,charge=0) {
    const p=g.player,d=guns[w.id],c=state(g),m=weaponMemory(w),id=w.id;
    if(w.reload>0||w.cd>0||m.burst)return;
    if(!d.heat&&w.ammo<=0){reload(g,false);return;}
    const hand=handling(g,d), heavy=stat(g,'overclock')==='Heavy Core',longCut=stat(g,'overclock')==='Long Cut';
    w.cd=1/rateFor(g,w);
    const last=!d.heat&&w.ammo===1,first=!!w.fresh;
    if(d.heat){w.heat=clamp((w.heat||0)+(id===28?.19:id===29?.13:id===24?.065:.036)/(1+.12*hand)/(w.chip==='Condensate Coil'?1.2:1)/(w.prefix==='Cold-Jacket'?1.25:1),0,1);w.heatDelay=.24;}
    else w.ammo--;
    w.shots=(w.shots||0)+1;w.fresh=false;
    w.flash=.09;
    const a=p.a, f={x:p.x+Math.cos(a)*13,y:p.y+Math.sin(a)*13};
    const range=d.range*(w.prefix==='Longglass'?1.2:w.prefix==='Compact'?.82:1)*(d.family==='Scatter'?1+.12*hand:1);
    const speed=d.speed*(1+stat(g,'shotSpeed'))*(d.family==='Precision'||d.family==='Fabricator'?1+.1*hand:1);
    const damage=damageFor(g,w)*(c.stored?1+c.stored*.075:1);
    c.stored=0;
    const push=(d.family==='Scatter'?74:d.family==='Precision'?49:23)*(heavy?1.65:1);
    const spreadMod=(w.prefix==='Braced'?.75:w.prefix==='Featherweight'?1.15:1)*(w.chip==='Counterweight'?.73:1)*(w.stable>0?.64:1)/
      (1+(d.family==='Assault'?.13*hand:0)+(m.focus||0)*.035+(p.fieldworkUntil>g.time?.20:0));
    const pierce=(w.prefix==='Threaded'?1:0)+(first&&d.family==='Precision'&&hand===3?1:0)+(charge>.9&&(w.suffix==='of Burrowing'||longCut)?1:0);
    const base={id,w,damage,color:d.color,speed,range,push,pierce,first,last,firstMark:first&&!!stat(g,'Fresh Paint'),ricochet:w.suffix==='of Ricochet',a};
    const spawn=(spread=0,extra={},pos=f)=>makeShot(g,pos,a+spread,{...base,...extra,a:a+spread});
    const noise=x=>(g.rng()-.5)*2*x*spreadMod;
    const pt=d.pointTargeted?targetPoint(g,range):null;
    g.sound('fire',d.familyIndex*6+id%6);
    if(d.creatureId){
      const origin=d.creatureId==='catana'?p:f;
      const deployLife=1+stat(g,'deployLife')+.1*hand+(w.chip==='Relay Antenna'?.20:0);
      creatureCombat(g).fire({id:d.creatureId,owner:p,w,x:origin.x,y:origin.y,angle:a,damage,push,
        range,speed,penetration:pierce,deploy:pt,deployLife,first,last,color:d.color,firstMark:base.firstMark,blastScale:blastRadius(g,w,1)*(w.chip==='Split Fuse'?1.15:1)});
      if(d.heat&&w.heat>=1)reload(g,false);
      return;
    }
    const pellet=(count,spread,extra={})=>{
      count+=(w.prefix==='Splitcore'?1:0)+(d.family==='Scatter'&&hand===3?1:0);
      for(let i=0;i<count;i++)spawn((i-(count-1)/2)*spread/Math.max(1,count-1)*spreadMod+noise(.019),{...extra,speed:speed*(.92+g.rng()*.13),shape:extra.shape||'pellet',r:extra.r||2});
    };
    switch(id) {
      case 0:spawn(noise(.045),{shape:'tracer'});break;
      case 1:case 4:{
        const n=id===1?3:w.wound>=.98?6:1;
        const key=new WeakMap();spawn(noise(.027),{shape:'tracer',burstKey:key});
        if(n>1){const interval=.057/weaponCadence(w);m.burst={remaining:Math.min(w.ammo,n-1),timer:.06/weaponCadence(w),interval,key,base};if(id===4)w.wound=0;}
        break;
      }
      case 2:spawn(noise(.035),{shape:'thorn',pierce:pierce+1});break;
      case 3:spawn(noise(.21/(1+7*(w.focusTime||0))),{shape:'crystal'});break;
      case 5:{const blue=w.shots%2===1;spawn(noise(.022),{shape:blue?'needle':'slug',blue,color:blue?'#9dd8ff':'#ff8e82',damage:damage*(blue?.92:1.12),push:blue?push*3:push});break;}
      case 6:pellet(7,.67,{push:push*1.35});break;
      case 7:pellet(6,.80,{element:'burn',shape:'ember',push:18});break;
      case 8:pellet(3,.18,{shape:'crystal',split:true});break;
      case 9:pellet(2,.07,{shape:'slug',r:3,pierce:pierce+1,acid:w.shots%3===0});break;
      case 10:for(const side of [-1,1])for(let j=0;j<3;j++){const pos={x:f.x-Math.sin(a)*side*(11+j*3),y:f.y+Math.cos(a)*side*(11+j*3)};spawn(side*(.035+j*.050),{shape:'blade'},pos);}
        if(w.prefix==='Splitcore')spawn((w.shots%2?1:-1)*.21,{shape:'blade'});break;
      case 11:pellet(5+Math.floor(charge*3),.80-.66*charge,{damage:damage*(.6+charge*1.1),push:push*(.65+charge),shape:'shard'});break;
      case 12:spawn(0,{damage:damage*(.60+charge*2.65),shape:'rail',r:2+charge*2,pierce:pierce+Math.floor(4*charge),push:50+85*charge});break;
      case 13:spawn(0,{shape:'needle'});break;
      case 14:spawn(0,{shape:'rift',pierce:pierce+1});break;
      case 15:{
        const tags=(m.tags||[]).filter(v=>live(v.e)&&v.until>g.time&&clearLab(g,p,v.e));
        if(charge<.32){const lock=near(g,pt,80)||nearestOnAim(g,range,.34);if(lock&&!tags.some(v=>v.e===lock)){if(tags.length>=3)tags.shift();tags.push({e:lock,until:g.time+7});}m.tags=tags;if(lock){w.ammo++;w.cd=.12/weaponCadence(w);}else spawn(0,{shape:'needle'});}
        else if(tags.length){let lastPoint=f;for(const v of tags){if(!clearLab(g,lastPoint,v.e))continue;line(g,lastPoint,v.e,d.color,3,.20,'arc');statusHit(g,v.e,{...base,a:angle(lastPoint,v.e),damage:damage*(1+charge*.72)});lastPoint=v.e;}m.tags=[];}
        else spawn(0,{shape:'rail',damage:damage*(1+charge*.7),pierce:pierce+1});
        break;
      }
      case 16:spawn(0,{shape:'needle',stake:true});break;
      case 17:spawn(0,{shape:'needle'});break;
      case 18:case 21:case 22:case 33:{
        const kind=id===18?'mortar':id===21?'podlob':id===22?'skip':'burrow';
        const t=clamp(distance(f,pt)/speed,.25,1.25)*(w.prefix==='Soft-Fused'?.72:1);
        field(g,kind,f.x,f.y,blastRadius(g,w,id===33?71:65),t,{start:f,end:pt,color:d.color,damage,w});
        break;
      }
      case 19:case 20:spawn(0,{shape:id===19?'cluster':'anchor',r:5,point:pt,range:distance(f,pt),blastR:blastRadius(g,w,id===19?51:77)});break;
      case 23:capField(g,'stitch',10);field(g,'stitch',pt.x,pt.y,blastRadius(g,w,42),9,{damage,color:d.color,w});break;
      case 24:{
        const end=beamEnd(g,p,a,range),len=distance(p,end);
        const seen=new Set();let next=near(g,p,Infinity,e=>touchesSegment(e,p,end,e.r+13)&&distanceSq(p,e)<(len+e.r)**2),lastPoint=f;
        let jumps=2+(w.prefix==='Spare-Coil'?1:0)+(stat(g,'Storm Circuit')&&state(g).entities.some(v=>v.kind==='lattice'&&distance(v,p)<230)?1:0);
        if(!next){const hit=Foes.interceptLine(g,f,end,damage);line(g,f,hit||end,d.color,1,.10,'arc');break;}
        while(next&&jumps-->=0){
          const wasStatic=next.static>0;
          const jumpDamage=damage*(lastPoint===f?1:(hand===3&&seen.size===1?.87:.72))*(w.prefix==='Spare-Coil'&&lastPoint!==f?.86:1);
          const blocker=Foes.interceptLine(g,lastPoint,next,jumpDamage);
          line(g,lastPoint,blocker||next,d.color,3,.14,'arc');
          if(blocker)break;
          seen.add(next);
          statusHit(g,next,{...base,element:'static',wasStatic,a:angle(lastPoint,next),damage:jumpDamage});
          lastPoint=next;next=near(g,lastPoint,wasStatic&&stat(g,'Line Voltage')?150:99,e=>!seen.has(e));
        }break;
      }
      case 25:{const end=beamEnd(g,p,a,range);const hit=near(g,p,Infinity,e=>touchesSegment(e,p,end,e.r+2+(w.suffix==='of Focus'&&e===m.focusTarget?(m.focus||0)*.85:0)));
        const blocker=Foes.interceptLine(g,f,hit||end,damage);line(g,f,blocker||hit||end,d.color,2+(m.chain||0)*.45,.12);if(!blocker&&hit)statusHit(g,hit,base);break;}
      case 26:pellet(4,.66,{element:'chill',chill:.16,shape:'frost',push:5});break;
      case 27:spawn(0,{shape:'disc',pierce:99,r:7,disc:true});break;
      case 28:field(g,'sweep',p.x,p.y,range,.45,{a,dir:w.shots%2?1:-1,seen:new Set(),objects:new Set(),damage,color:d.color,w});break;
      case 29:{
        const to=beamEnd(g,p,a,distance(p,pt)),len=distance(p,to);
        let crossings=0;
        for(const side of [-1,1]){
          const bend=reachablePoint(g,f,{x:f.x+Math.cos(a)*len*.43-Math.sin(a)*side*29,y:f.y+Math.sin(a)*len*.43+Math.cos(a)*side*29});
          const first=Foes.interceptLine(g,f,bend,damage*.65),second=!first&&Foes.interceptLine(g,bend,to,damage*.65);
          line(g,f,first||bend,d.color,2,.17,'arc');
          if(!first)line(g,bend,second||to,d.color,2,.17,'arc');
          if(!first&&!second)crossings++;
          for(const e of g.enemies)if(live(e)&&(touchesSegment(e,f,first||bend,e.r+2)||!first&&touchesSegment(e,bend,second||to,e.r+2))&&clearLab(g,p,e))
            statusHit(g,e,{...base,damage:damage*.65,element:'static',wasStatic:e.static>0});
        }
        if(crossings===2)blast(g,to,27,damage*1.75,d.color,36);
        break;
      }
      case 30:{const lock=nearestOnAim(g,range,.92);spawn(noise(.12),{shape:'wasp',homing:lock,r:3,speed:speed*(1+.1*hand)});if(c.swarm){c.swarm=false;for(const s of [-.32,.32])spawn(s,{shape:'wasp',homing:lock});}break;}
      case 31:spawn(0,{shape:'thorn'});break;
      case 32:spawn(0,{shape:'clamp'});break;
      case 34:{const path=[p,...c.history.slice().reverse()].map(v=>({x:v.x,y:v.y}));capField(g,'tick',4);field(g,'tick',p.x,p.y,48,5,{path,i:1,damage,color:d.color,w});break;}
      case 35:{const places=c.entities.filter(v=>v.kind==='spool'&&v.life>0);if(places.length>=2)places[0].life=0;field(g,'spool',pt.x,pt.y,5,11*(1+stat(g,'deployLife')),{damage,color:d.color,w});break;}
      case 36:{
        const end=reachablePoint(g,p,beamEnd(g,p,a,range));
        const hit=near(g,p,range+32,e=>touchesSegment(e,p,end,e.r+3));
        const mate=crewInRange(g,p,range).find(q=>q!==p&&q.hp<q.maxHp&&touchesSegment(q,p,end,(q.bodyR||9)+7));
        w.sutureCharge??=12;
        const heal=mate&&w.sutureCharge>0&&(!hit||distanceSq(p,mate)<distanceSq(p,hit));
        const dest=heal?mate:(hit||end),blocker=Foes.interceptLine(g,p,dest,damage);
        line(g,f,blocker||dest,d.color,3,.15);
        if(blocker)break;
        if(heal){w.sutureCharge-=repairHull(g,p,mate,Math.min(w.sutureCharge,3*Math.sqrt(weaponPower(w))),d.color);break;}
        if(hit&&!(hit.boss&&hit.arrive>0)){
          statusHit(g,hit,base);w.sutureCharge=Math.min(18,w.sutureCharge+2);
          w.sutureHits=((w.sutureHits||0)+1)%3;
          if(!w.sutureHits)repairHull(g,hit,p,2,d.color);
        }
        break;
      }
      case 37:{
        const rig={x:pt.x,y:pt.y,a,r:63},ends=geometry(rig).map(t=>reachablePoint(g,pt,t));
        capField(g,'wireFence',2);
        field(g,'wireFence',pt.x,pt.y,63,4.2*(1+stat(g,'deployLife')),{w,damage,color:d.color,ends,budget:3});
        break;
      }
      case 38:spawn(0,{shape:'shieldBolt'});break;
      case 39:{
        const flight=clamp(distance(f,pt)/speed,.16,1.1);
        field(g,'lifeboat',f.x,f.y,blastRadius(g,w,52),flight,{start:f,end:pt,color:d.color,damage,w});
        break;
      }
      case 40:{
        const workers=c.entities.filter(v=>v.kind==='workerBee'&&v.life>0);
        if(workers.length<2)field(g,'workerBee',p.x,p.y,7,5.2*(1+stat(g,'deployLife')),{w,damage,color:d.color,goal:pt,a});
        else spawn(0,{shape:'thorn',speed:530,damage:damage*.84});
        break;
      }
      case 41:{
        const prior=c.entities.find(v=>v.kind==='watchtower'&&v.life>0&&distanceSq(v,pt)<34*34&&clearLab(g,pt,v));
        if(prior){
          prior.tier=2;prior.life=prior.max;prior.w=w;prior.damage=damage;
          field(g,'spark',prior.x,prior.y,22,.25,{color:d.color});
        }else{
          capField(g,'watchtower',2);field(g,'watchtower',pt.x,pt.y,210,6*(1+stat(g,'deployLife')),{w,damage,color:d.color,tier:1,a});
        }break;
      }
      case 42:capField(g,'gravwinch',2);field(g,'gravwinch',pt.x,pt.y,90,3.4,{w,damage,color:d.color,a,tick:.24,pulses:3});break;
    }
    if(c.afterimage&&stat(g,'Relay Assassin')&&id===14){makeShot(g,c.afterimage,a,{...base,damage:damage*.5,shape:'rift',pierce:pierce+1});c.afterimage=null;}
    if(g.decoy?.aug===2&&!g.decoy.copied){g.decoy.copied=true;makeShot(g,g.decoy,a,{damage:damage*.55,speed:600,range,color:d.color,shape:'crystal'});}
    if(d.heat&&w.heat>=1)reload(g,false);
  }
  function detonateStitch(g,w) {
    if(w.id!==23)return;
    let delay=.075;for(const v of state(g).entities)if(v.kind==='stitch'&&v.w===w){v.kind='fuse';v.life=delay;v.max=delay;delay+=.09;}
  }
  function onHit(g,s,e) {
    const w=s.w,p=g.player,marked=e.marked>0;
    if(s.id===19||s.id===20){ordnanceImpact(g,s);return true;}
    statusHit(g,e,s);
    if(s.id===38&&w&&!(e.boss&&e.arrive>0)){
      w.shieldHits=((w.shieldHits||0)+1)%3;
      if(!w.shieldHits){
        const target=neediest(crewInRange(g,p,170),'shield','maxShield');
        if(target){
          target.shield=Math.min(target.maxShield,target.shield+4*Math.sqrt(weaponPower(w)));
          line(g,p,target,s.color,2,.22);field(g,'shieldPulse',target.x,target.y,19,.35,{color:s.color});
        }
      }
    }
    if(s.id===2&&!s.offspring){makeShot(g,e,s.a+.32,{damage:s.damage*.65,shape:'thorn',color:s.color,speed:510,range:185,hit:new Set([e])});s.offspring=true;}
    if(s.split&&!s.offspring){for(const side of [-1,1])for(let j=0;j<2;j++)makeShot(g,e,s.a+side*(.38+j*.22),{shape:'shard',color:s.color,speed:510,range:145,damage:s.damage*.74,hit:new Set([e])});s.offspring=true;}
    if(s.acid){field(g,'acid',e.x,e.y,34,2.8,{color:'#aeeb64',damage:5*weaponPower(w)});s.acid=false;}
    if(s.id===14&&marked&&!s.redirect){s.a=p.a;s.redirect=true;s.pierce++;}
    if(s.pierce>0&&marked&&stat(g,'Second Address')&&!s.extraPierce){s.pierce++;s.extraPierce=true;}
    const dur=1+stat(g,'deployLife')+.15*(w?handling(g,guns[w.id]):0);
    if(s.id===31){
      capField(g,'sentry',3+(handling(g,guns[w.id])===3?1:0));field(g,'sentry',e.x,e.y,5,3.4*dur,{w,damage:s.damage*.42,color:s.color});
    }
    if(s.id===32){capField(g,'remora',3);field(g,'remora',e.x,e.y,5,2.75*dur,{w,target:e,damage:s.damage*.55,color:s.color});}
    g.fx(s.x,s.y,s.color,s.shape==='pellet'?2:4);
    return s.pierce--<=0;
  }
  function ordnanceImpact(g,s) {
    if(s.id===20){field(g,'implode',s.x,s.y,s.blastR,.57,{damage:s.damage,color:s.color,w:s.w});return;}
    blast(g,s,s.blastR,s.damage,s.color,125,'',s.w);
    for(let i=0;i<4;i++){const a=g.rng()*TAU;const r=18+g.rng()*24;const at=reachablePoint(g,s,{x:s.x+Math.cos(a)*r,y:s.y+Math.sin(a)*r});field(g,'fuse',at.x,at.y,31,.19+.075*i,{damage:s.damage*.48,color:s.color,w:s.w});}
  }
  const hitCell=64,emptyCell=[];
  // This index lives for one pilot's projectile pass. Gravity, movement, deaths
  // and spawns between pilots are reflected when the next pass rebuilds it.
  function hitBuckets(combat,enemies,shots){
    if(enemies.length<16||shots.length*enemies.length<300)return null;
    const grid=combat.hitGrid||(combat.hitGrid={rows:[],used:[]});
    for(const bucket of grid.used)bucket.length=0;
    grid.used.length=0;
    let padding=0;
    for(const shot of shots)padding=Math.max(padding,shot.r);
    for(const foe of enemies){
      if(!live(foe))continue;
      const r=foe.r+padding,firstX=Math.floor((foe.x-r)/hitCell),lastX=Math.floor((foe.x+r)/hitCell);
      const lastY=Math.floor((foe.y+r)/hitCell);
      for(let y=Math.floor((foe.y-r)/hitCell);y<=lastY;y++){
        const row=grid.rows[y]||(grid.rows[y]=[]);
        for(let x=firstX;x<=lastX;x++){
          const bucket=row[x]||(row[x]=[]);
          if(!bucket.length)grid.used.push(bucket);
          bucket.push(foe);
        }
      }
    }
    return grid.rows;
  }
  function moveShots(g,dt) {
    const c=state(g),p=g.player,enemies=g.enemies,hostile=g.hostile;
    const current=c.shots;c.shots=[];
    if(!current.length)return;
    const buckets=hitBuckets(c,enemies,current);
    // Hostile bullets cannot stop friendly fire. Keep only shootable objects, including
    // weak points that a preceding impact may have exposed within this same update.
    const blockers=[];
    let scanned=0;
    for(const s of current) {
      s.age+=dt;
      const returns=s.disc||(s.shape==='wasp'&&s.w?.suffix==='of Recall');
      if(s.age>4||s.travel>=s.range&&!returns){if(s.id===19||s.id===20)ordnanceImpact(g,s);continue;}
      if(returns&&s.travel>=s.range&&!s.returning){s.returning=true;s.hit.clear();}
      if(s.returning){s.a=angle(s,p);if(distance(s,p)<14){if(s.w.suffix==='of Recall')s.w.recall=2;continue;}}
      if(s.shape==='wasp'&&!s.returning){if(!live(s.homing))s.homing=near(g,s,110);if(s.homing)s.a+=clamp(wrap(angle(s,s.homing)-s.a),-dt*9,dt*9);}
      const step=s.speed*dt, ox=s.x,oy=s.y;let end=false;
      const pieces=Math.ceil(step/6);
      for(let i=0;i<pieces&&!end;i++){
        const dx=Math.cos(s.a)*step/pieces,dy=Math.sin(s.a)*step/pieces,nx=s.x+dx,ny=s.y+dy;
        if((g.shotBlocked||g.blocked)(nx,ny,0)){
          const mem=s.w&&weaponMemory(s.w);
          if(s.stake&&(!mem.stake||mem.stake.until<g.time||distance(mem.stake,s)>28)){
            mem.stake={x:s.x,y:s.y,until:g.time+12,flat:(g.shotBlocked||g.blocked)(nx,s.y,0)};field(g,'spark',s.x,s.y,13,.28,{color:s.color});end=true;break;
          }
          if(s.ricochet||s.stake&&mem.stake){
            const vertical=s.stake?mem.stake.flat:(g.shotBlocked||g.blocked)(nx,s.y,0);
            s.a=vertical?Math.PI-s.a:-s.a;s.ricochet=false;s.stake=false;s.damage*=.8;s.x+=Math.cos(s.a)*3;s.y+=Math.sin(s.a)*3;
            g.fx(s.x,s.y,s.color,5);continue;
          }
          if(s.disc&&!s.returning){s.returning=true;s.hit.clear();s.a=angle(s,p);continue;}
          if(s.id===19||s.id===20)ordnanceImpact(g,s);
          end=true;break;
        }
        s.x=nx;s.y=ny;s.travel+=step/pieces;
        while(scanned<hostile.length){
          const h=hostile[scanned++];
          if(h.life>0&&(h.hp>0||h.kind==='null'))blockers.push(h);
        }
        if(blockers.length&&window.Foes?.intercept?.(g,s.x,s.y,s.damage,blockers)){if(s.id===19||s.id===20)ordnanceImpact(g,s);end=true;break;}
        const candidates=buckets?(buckets[Math.floor(s.y/hitCell)]?.[Math.floor(s.x/hitCell)]||emptyCell):enemies;
        for(const e of candidates){
          if(!live(e))continue;
          const radius=e.r+s.r,x=s.x-e.x,y=s.y-e.y;
          if(x*x+y*y>=radius*radius||s.hit.has(e))continue;
          s.hit.add(e);end=onHit(g,s,e);if(end)break;
        }
      }
      if(!end)c.shots.push(s);
      if(s.shape==='rail')line(g,{x:ox,y:oy},s,s.color,3,.08);
    }
  }
  function clearBullets(g,test,limit,reflect=false) {
    let n=0;
    for(let i=g.hostile.length-1;i>=0&&n<limit;i--){const h=g.hostile[i];if(h.heavy||h.hp>0||h.kind&&h.kind!=='shot'||h.life<=0||!test(h))continue;
      g.hostile.splice(i,1);n++;g.fx(h.x,h.y,'#a1efff',3);
      if(reflect&&n<=4)makeShot(g,h,g.player.a+(g.rng()-.5)*.3,{damage:16,color:'#a7ebff',shape:'shard',range:340});
    }
    return n;
  }
  function activeRadius(g,r){return r*(stat(g,'overclock')==='Tight Orbit'?.78:1);}
  function cast(g,slot) {
    const p=g.player,c=state(g),ab=p.abilities[p.activeSlots[slot]],a=p.a;
    if(!ab||c.gap>0)return false;
    const id=ab.id,def=abilities[id],aug=ab.augment||0, col=def.color;
    const power=1+stat(g,'abilityDamage'),pt=[3,4,9,13,15,16].includes(id)?targetPoint(g,285):null,r=x=>activeRadius(g,x);
    if(id===2&&c.beacon?.life>0){
      if(window.World?.permitsRecall?.(g,c.beacon)===false){
        g.toast?.('Vault seal blocks recall to this beacon.');
        return false;
      }
      if(g.blocked(c.beacon.x,c.beacon.y,p.r))return false;
      const from={x:p.x,y:p.y};p.x=c.beacon.x;p.y=c.beacon.y;c.beacon.life=0;c.beacon=null;c.afterimage=from;
      line(g,from,p,col,4,.34);g.fx(p.x,p.y,col,14);
      if(aug===1)g.decoy=field(g,'decoy',from.x,from.y,14,3,{color:col});
      if(aug===2)blast(g,p,r(90),18*power,col,170);
      c.gap=.22;g.sound('ability',id);return true;
    }
    if(ab.cd>0)return false;
    const cdr=Math.min(.35,Math.max(0,stat(g,'cdr')+(stat(g,'overclock')==='Tight Orbit'?.13:0)));
    ab.cd=def.cooldown*(1-cdr);c.gap=.24;g.sound('ability',id);
    switch(id){
      case 0:{const radius=r(155),half=aug===1?1.55:1.00;
        field(g,'cone',p.x,p.y,radius,.29,{color:col,a,half});for(const e of g.enemies)if(live(e)&&distance(e,p)<radius+e.r&&Math.abs(wrap(angle(p,e)-a))<half&&clearLab(g,p,e)){lightHit(g,e,22*power,angle(p,e),300);if(!e.boss)e.stun=Math.max(e.stun||0,.3);}
        clearBullets(g,h=>distance(h,p)<radius&&Math.abs(wrap(angle(p,h)-a))<half&&clearLab(g,p,h),aug===1?14:8,aug===2);break;}
      case 1:field(g,'screen',p.x+Math.cos(a)*34,p.y+Math.sin(a)*34,r(53),2.5,{a,aug,color:col,budget:aug===2?7:12});break;
      case 2:c.beacon=field(g,'beacon',p.x,p.y,15,6,{color:col});break;
      case 3:field(g,'lattice',pt.x,pt.y,r(59),5,{a,aug,color:col,damage:18*power});break;
      case 4:{
        const fold=stat(g,'Siege Breaker')&&c.entities.find(v=>v.kind==='implode'&&v.life>0&&distance(v,pt)<100);
        const center=fold||pt;field(g,'meteor',center.x,center.y,r(aug===2?57:77),1,{aug,color:col,damage:113*power,siege:!!fold});break;}
      case 5:{const radius=r(146);field(g,'cone',p.x,p.y,radius,.45,{color:col,a,half:1.04});
        for(const e of g.enemies)if(live(e)&&distance(p,e)<radius+e.r&&Math.abs(wrap(angle(p,e)-a))<1.04&&clearLab(g,p,e)){chill(e,1.15);e.brittle=aug===2;lightHit(g,e,20*power,angle(p,e),35);}
        if(aug===1){const at=reachablePoint(g,p,{x:p.x+Math.cos(a)*78,y:p.y+Math.sin(a)*78});field(g,'ice',at.x,at.y,r(65),3,{color:col});}break;}
      case 6:c.wake=5;c.wakeLeft=2;c.wakeAug=aug;c.wakePower=power;field(g,'spark',p.x,p.y,38,.34,{color:col});break;
      case 7:field(g,'repair',p.x,p.y,r(98),5.2,{color:col,aug,left:aug===2?10:14,budget:5});break;
      case 8:field(g,'halo',p.x,p.y,r(210),.75,{color:col,aug,budget:aug===2?10:20});if(aug===2)field(g,'echo',p.x,p.y,r(210),.7,{color:col,budget:10});break;
      case 9:field(g,'gravity',pt.x,pt.y,r(112),aug===1?3.4:2.1,{color:col,aug,damage:14*power,held:new Set()});break;
      case 10:{const dest=targetPoint(g,135),at=g.blocked(dest.x,dest.y,7)?p:dest;g.decoy=field(g,'decoy',at.x,at.y,17,5,{color:col,aug,damage:8*power});break;}
      case 11:c.overdrive=5;c.overAug=aug;c.refund=false;field(g,'spark',p.x,p.y,43,.33,{color:col});break;
      case 12:{
        const radius=r(aug===1?204:140);
        for(const pilot of g.players||[p]){
          const nearby=distanceSq(p,pilot)<=radius*radius&&clearLab(g,p,pilot);
          if(pilot.downed){
            if(!nearby||pilot===p)continue;
            g.revivePilot(pilot);
          }else repairHull(g,nearby?p:pilot,pilot,(nearby?18:9)*power,col);
          if(aug===2&&pilot.hp>0)pilot.shield=Math.min(pilot.maxShield,pilot.shield+(nearby?10:5));
          if(!nearby&&pilot.hp>0)field(g,'repairPulse',pilot.x,pilot.y,34,.60,{color:col});
        }
        field(g,'repairPulse',p.x,p.y,radius,.60,{color:col});break;
      }
      case 13:{
        const radius=r(85);
        capField(g,'canopy',1);field(g,'canopy',pt.x,pt.y,radius,aug===2?6.5:5,{color:col,budget:aug===2?24:16,aug,echoes:4});
        const partner=g.players?.find(q=>q!==p&&live(q)&&!q.downed);
        if(partner&&(distanceSq(pt,partner)>radius*radius||!clearLab(g,pt,partner))){
          capField(g,'linkShell',1);field(g,'linkShell',partner.x,partner.y,40,3,{target:partner,color:col,budget:4});
        }break;
      }
      case 14:{
        const radius=r(175),refill=aug===1?.75:.4;
        for(const pilot of crewInRange(g,p,radius)){
          const station=pilot===p?g:g.forPilot(pilot),weapon=currentGun(station);
          if(!weapon)continue;
          if(guns[weapon.id].heat)weapon.heat=Math.max(0,weapon.heat-refill);
          else weapon.ammo=Math.min(weapon.capacity,weapon.ammo+Math.ceil(weapon.capacity*refill));
          if(guns[weapon.id].heat?weapon.heat<.9:weapon.ammo>0)weapon.reload=0;
          const local=state(station),boost=aug===2?.40:.25;
          local.overchargeBoost=local.overchargeUntil>g.time?Math.max(boost,local.overchargeBoost):boost;
          local.overchargeUntil=g.time+4;field(g,'shieldPulse',pilot.x,pilot.y,23,.42,{color:col});
          if(pilot!==p)line(g,p,pilot,col,2,.27,'arc');
        }field(g,'spark',p.x,p.y,radius,.42,{color:col});break;
      }
      case 15:capField(g,'nursery',1);field(g,'nursery',pt.x,pt.y,r(82),4,{a,aug,color:col,damage:40*power,produced:0,podLife:8*(1+stat(g,'deployLife'))});break;
      case 16:capField(g,'mirrorforge',1);field(g,'mirrorforge',pt.x,pt.y,22,(aug===2?11:7)*(1+stat(g,'deployLife')),{a,aug,color:col,damage:27*power});break;
    }
    return true;
  }
  function dashStart(g,c) {
    const p=g.player, w=currentGun(g);
    if(c.overdrive>0&&c.overAug===1)c.redline=2;
    if(c.wake>0&&c.wakeLeft>0){c.wakeLeft--;c.leaveTrail=.24;}
    const closeBullet=g.hostile.some(h=>h.life>0&&distance(p,h)<65);
    if(closeBullet&&w&&(w.suffix==='of Momentum'||w.chip==='Field Spool'))w.fastFeed=2.2;
    if(stat(g,'Static Step'))for(const e of g.enemies){if(live(e)&&e.static>0&&distance(e,p)<90&&clearLab(g,p,e)){e.static=0;lightHit(g,e,23,angle(p,e),50);line(g,p,e,'#afe5ff',2,.22,'arc');}}
  }
  function geometry(n) {
    const dx=-Math.sin(n.a)*n.r,dy=Math.cos(n.a)*n.r;
    return [{x:n.x+dx,y:n.y+dy},{x:n.x-dx,y:n.y-dy}];
  }
  function repairAtWasp(g,v){
    const c=state(g);
    if(v.left<=0||c.healUsed>=28)return;
    let target=null,shield=false,best=-1;
    for(const p of (g.players?.length?g.players:[g.player])){
      if(p.hp<=0||p.downed||distance(v,p)>=v.r||!clearLab(g,v,p))continue;
      const hullNeed=p.maxHp-p.hp,shieldNeed=v.aug===1?p.maxShield-p.shield:0;
      const priority=hullNeed>0?1+hullNeed/p.maxHp:shieldNeed>0?shieldNeed/Math.max(1,p.maxShield):-1;
      if(priority>best){target=p;shield=hullNeed<=0;best=priority;}
    }
    if(!target)return;
    const need=shield?target.maxShield-target.shield:target.maxHp-target.hp;
    const amount=Math.min(2,need,v.left,28-c.healUsed);
    if(shield)target.shield+=amount;else target.hp+=amount;
    c.healUsed+=amount;v.left-=amount;line(g,v,target,v.color,1,.34,'arc');
  }
  function updateEntity(g,v,dt) {
    const c=state(g),p=g.player;
    v.age+=dt;v.life-=dt;v.tick-=dt;
    const tick=v.tick<=0;
    const closeTo=q=>live(q)&&distanceSq(v,q)<(v.r+q.r)**2&&clearLab(g,v,q);
    switch(v.kind){
      case 'canopy':case 'shelter':case 'linkShell':{
        if(v.target){
          if(v.target.downed||v.target.hp<=0){v.life=0;break;}
          v.x=v.target.x;v.y=v.target.y;
        }
        const blocks=clearBullets(g,h=>distanceSq(v,h)<(v.r+(h.r||0))**2&&clearLab(g,v,h),v.budget);
        v.budget-=blocks;
        if(blocks){
          v.flash=.18;
          if(v.aug===1&&v.echoes>0){
            const target=near(g,v,230);
            if(target){
              const n=Math.min(v.echoes,blocks,3);v.echoes-=n;
              for(let i=0;i<n;i++)makeShot(g,v,angle(v,target)+(i-(n-1)/2)*.09,{damage:13,speed:445,range:230,color:v.color,shape:'shieldBolt'});
            }
          }
        }
        v.flash=Math.max(0,(v.flash||0)-dt);if(v.budget<=0)v.life=0;break;
      }
      case 'wireFence':{
        const [s,t]=v.ends;
        if(v.budget>0)v.budget-=clearBullets(g,h=>touchesSegment(h,s,t,(h.r||3)+5)&&clearLab(g,v,h),v.budget);
        if(!tick)break;
        Foes.interceptLine(g,s,t,v.damage);
        for(const foe of g.enemies)if(live(foe)&&touchesSegment(foe,s,t,foe.r+4)&&clearLab(g,v,foe)){
          chill(foe,.32);foe.static=Math.max(foe.static||0,1.6);
          statusHit(g,foe,{id:37,w:v.w,damage:v.damage,color:v.color,a:angle(v,foe),push:9});
        }
        v.tick=.6/weaponCadence(v.w);break;
      }
      case 'lifeboat':{
        const k=clamp(v.age/v.max,0,1);
        v.x=v.start.x+(v.end.x-v.start.x)*k;v.y=v.start.y+(v.end.y-v.start.y)*k;
        if(v.life<=0){
          blast(g,v,v.r,v.damage,v.color,75,'',v.w);capField(g,'shelter',1);
          field(g,'shelter',v.x,v.y,v.r,2.2,{color:v.color,budget:4});
        }break;
      }
      case 'workerBee':{
        if(p.downed||p.hp<=0){v.life=0;break;}
        if(tick){
          v.target=v.returning?(neediest(crewInRange(g,v,230),'hp','maxHp')||p):near(g,v,167);
          v.tick=.22;
        }
        const dest=v.target&&live(v.target)?v.target:v.returning?p:v.goal;
        const d=distance(v,dest);
        if(d>5&&clearLab(g,v,dest)){
          v.a=angle(v,dest);const step=Math.min(d,dt*190);
          v.x+=Math.cos(v.a)*step;v.y+=Math.sin(v.a)*step;
        }
        if(v.target&&d<18&&clearLab(g,v,v.target)){
          if(v.returning){if(live(v.target))repairHull(g,v,v.target,2.5*Math.sqrt(weaponPower(v.w)),v.color);v.life=0;}
          else if(live(v.target)&&!(v.target.boss&&v.target.arrive>0)){
            statusHit(g,v.target,{id:40,w:v.w,a:v.a,damage:v.damage,push:18,color:v.color});
            v.returning=true;v.target=null;v.tick=0;
          }
        }break;
      }
      case 'watchtower':{
        if(!tick)break;
        const enemy=near(g,v,v.r);v.tick=enemy?.66/weaponCadence(v.w):.21;
        if(enemy){v.a=angle(v,enemy);
          for(let i=0;i<v.tier;i++){
            const shift=v.tier===2?(i-.5)*9:0;
            const port=reachablePoint(g,v,{x:v.x-Math.sin(v.a)*shift,y:v.y+Math.cos(v.a)*shift});
            makeShot(g,port,angle(port,enemy),{id:41,w:v.w,color:v.color,damage:v.damage*.68,shape:'needle',speed:450,range:v.r+15,push:15});
          }
        }break;
      }
      case 'gravwinch':{
        if(!tick)break;
        for(const foe of g.enemies)if(closeTo(foe)){
          const a=angle(foe,v),d=Math.min(Math.max(0,distance(v,foe)-12),28/Math.max(1,foe.mass||1));
          if(!foe.boss&&!foe.elite)g.move(foe,Math.cos(a)*d,Math.sin(a)*d);
          statusHit(g,foe,{id:42,w:v.w,a,damage:v.damage*.77,push:0,color:v.color});
        }
        Foes.blast(g,v,v.r,v.damage*.77);field(g,'shieldPulse',v.x,v.y,v.r,.31,{color:v.color});
        v.pulses--;v.tick=.75/weaponCadence(v.w);if(!v.pulses)v.life=0;break;
      }
      case 'nursery':{
        if(!tick)break;
        const total=v.aug===1?5:3,bearing=v.a+(v.produced-(total-1)/2)*(2.15/(total-1));
        const dest=reachablePoint(g,v,{x:v.x+Math.cos(bearing)*v.r,y:v.y+Math.sin(bearing)*v.r});
        capField(g,'foamPod',5);
        field(g,'foamPod',dest.x,dest.y,37,v.podLife,{color:v.aug===2?'#9ce9fa':v.color,damage:v.damage,aug:v.aug});
        line(g,v,dest,v.color,1,.24);v.produced++;v.tick=.58;if(v.produced>=total)v.life=0;break;
      }
      case 'foamPod':
        if(tick&&v.age>.32){
          const enemy=near(g,v,26);v.tick=.12;
          if(enemy){
            blast(g,v,v.r,v.damage,v.color,63);
            if(v.aug===2)for(const foe of g.enemies)if(closeTo(foe))chill(foe,1.2);
            v.life=0;
          }
        }break;
      case 'mirrorforge':{
        v.a=p.a;
        if(!tick||!c.triggerHeld||p.hp<=0||distanceSq(v,p)>320*320||!clearLab(g,v,p))break;
        const offsets=v.aug===1?[-.11,.11]:[0];
        for(const offset of offsets)makeShot(g,v,p.a+offset,{color:v.color,damage:v.damage*(v.aug===1?.73:1),r:3,speed:550,range:350,pierce:1,shape:'rift'});
        v.tick=.55;break;
      }
      case 'mortar':case 'podlob':case 'skip':case 'burrow':{
        const t=clamp(1-v.life/v.max,0,1);v.x=v.start.x+(v.end.x-v.start.x)*t;v.y=v.start.y+(v.end.y-v.start.y)*t;
        if(v.life<=0){
          if(v.kind==='podlob'){capField(g,'mine',4);field(g,'mine',v.x,v.y,v.r,11,{damage:v.damage,color:v.color,w:v.w,arm:stat(g,'Ready Powder')?.18:.38});}
          else blast(g,v,v.r,v.damage,v.color,v.kind==='burrow'?230:130,'',v.w);
        }break;
      }
      case 'mine':if(v.age>v.arm&&(near(g,v,v.r*.84)||g.hostile.some(h=>h.hp>0&&distance(v,h)<v.r*.84+h.r&&clearLab(g,v,h)))){blast(g,v,v.r,v.damage,v.color,130,'',v.w);v.life=0;}break;
      case 'fuse':case 'meteor':case 'stitch':if(v.life<=0){
        if(v.siege){
          let heavy=null;for(const e of g.enemies)if(closeTo(e)&&(!heavy||e.mass>heavy.mass))heavy=e;
          if(heavy)heavy.stagger=Math.max(heavy.stagger||0,heavy.boss?.55:1.1);
        }
        blast(g,v,v.r,v.damage,v.color,v.aug===2?260:125,'',v.w);
        if(v.kind==='meteor'&&v.aug===1)for(let i=0;i<4;i++){const at=reachablePoint(g,v,{x:v.x+Math.cos(i*TAU/4)*v.r,y:v.y+Math.sin(i*TAU/4)*v.r});field(g,'fuse',at.x,at.y,35,.15+.04*i,{damage:v.damage*.30,color:v.color});}
        if(v.kind==='meteor'&&v.aug===2)for(const e of g.enemies)if(closeTo(e))e.marked=4;
      }break;
      case 'implode':case 'gravity':{
        for(const e of g.enemies){if(!live(e))continue;const d=distance(v,e);
          if(d>v.r+e.r){if(v.aug===2&&v.held?.delete(e)&&clearLab(g,v,e)){e.marked=3;lightHit(g,e,v.damage,angle(v,e),35);}continue;}
          if(!clearLab(g,v,e)){v.held?.delete(e);continue;}
          v.held?.add(e);const dir=angle(e,v);if(!e.boss){const strength=clamp(d-8,0,120)*dt*(v.kind==='implode'?6.8:3.5)/Math.max(1,e.mass||1);g.move(e,Math.cos(dir)*strength,Math.sin(dir)*strength);}
          if(v.kind==='gravity'&&tick)lightHit(g,e,v.damage*.36,dir,15);
        }
        if(tick)v.tick=.35;
        if(v.life<=0){if(v.kind==='implode')blast(g,v,v.r,v.damage,v.color,110,'',v.w);else if(v.aug===2)for(const e of v.held)if(live(e)){e.marked=3;lightHit(g,e,v.damage,angle(v,e),32);}}
        break;
      }
      case 'sweep':{const sweep=v.a+v.dir*(-.63+1.26*clamp(v.age/v.max,0,1));const end=beamEnd(g,v,sweep,v.r);
        const blocker=Foes.interceptLine(g,v,end,v.damage,v.objects);
        v.end=blocker||end;for(const e of g.enemies)if(live(e)&&touchesSegment(e,v,v.end,e.r+7)&&!v.seen.has(e)&&clearLab(g,v,e)){v.seen.add(e);statusHit(g,e,{w:v.w,id:28,color:v.color,a:sweep,damage:v.damage,push:27});}break;}
      case 'fire':case 'acid':case 'ice':if(tick){
        for(const e of g.enemies.slice())if(closeTo(e)){
          if(v.kind==='ice')chill(e,.48);
          else{if(v.kind==='fire'){e.burn=1.3;e.burnPower=4;}lightHit(g,e,v.damage,angle(v,e),v.aug===1&&!v.flared?70:0,v.kind);v.flared=true;
            if(!live(e)&&v.kind==='acid'&&stat(g,'Spore Transfer')){const adj=near(g,e,75);if(adj)lightHit(g,adj,8,angle(v,adj),0,'acid');}}
        }
        if(v.kind==='fire'&&!v.extended&&(v.aug===2||stat(g,'Furnace Orbit'))&&c.shots.some(s=>distance(s,v)<v.r&&(v.aug===2||s.returning))){v.extended=true;v.life+=.8;if(stat(g,'Furnace Orbit'))blast(g,v,42,20,v.color,52);}
        v.tick=.32;
      }break;
      case 'sentry':case 'remora':{
        if(v.kind==='remora'){if(!live(v.target)){v.life=0;break;}v.x=v.target.x+5;v.y=v.target.y-4;}
        if(tick){const target=near(g,v,v.w.chip==='Relay Antenna'?285:200);if(target||v.kind==='remora'){v.a=v.kind==='remora'?p.a:angle(v,target);makeShot(g,v,v.a,{damage:v.damage,artId:v.w.id,range:v.w.chip==='Relay Antenna'?260:205,speed:440,shape:'needle',color:v.color,hit:new Set(v.target?[v.target]:[])});}v.tick=.48/weaponCadence(v.w);}break;
      }
      case 'tick':{const t=v.path[v.i];if(t){const d=distance(v,t),length=dt*134;if(d<=length)v.i++;else{v.x+=(t.x-v.x)/d*length;v.y+=(t.y-v.y)/d*length;}}
        if(near(g,v,24)||g.hostile.some(h=>h.hp>0&&distance(v,h)<24+h.r&&clearLab(g,v,h))){blast(g,v,v.r,v.damage,v.color,115);v.life=0;}else if(!t&&!v.recalled&&v.w.suffix==='of Recall'){v.w.recall=1.6;v.recalled=true;}break;}
      case 'spool':{if(!tick)break;const partner=c.entities.find(u=>u!==v&&u.kind==='spool'&&u.life>0&&u.age>=v.age);if(partner&&clearLab(g,v,partner)){window.Foes?.interceptLine?.(g,v,partner,v.damage);for(const e of g.enemies)if(live(e)&&touchesSegment(e,v,partner,e.r+3)&&clearLab(g,v,e)){chill(e,.44);lightHit(g,e,v.damage,angle(v,e),32);}}v.tick=.48/weaponCadence(v.w);break;}
      case 'screen':{
        if(v.aug===2){v.a=p.a;v.x=p.x+Math.cos(v.a)*32;v.y=p.y+Math.sin(v.a)*32;}
        const [s,t]=geometry(v);const n=clearBullets(g,h=>touchesSegment(h,s,t,h.r+9)&&clearLab(g,v,h),v.budget);
        v.budget-=n;v.blocked=(v.blocked||0)+n;if(v.aug===1)c.stored=Math.min(8,(c.stored||0)+n);if(v.blocked>=6&&stat(g,'Living Screen'))c.swarm=true;
        if(v.budget<=0)v.life=0;break;
      }
      case 'lattice':if(tick){
        const [s,t]=geometry(v),z={x:v.x+Math.cos(v.a)*v.r*1.3,y:v.y+Math.sin(v.a)*v.r*1.3};
        for(const e of g.enemies)if(live(e)&&(touchesSegment(e,s,t,e.r+5)||v.aug===1&&(touchesSegment(e,s,z,e.r+5)||touchesSegment(e,t,z,e.r+5)))&&clearLab(g,v,e)){const boosted=e.static>0;e.static=boosted?0:3.5;lightHit(g,e,v.damage*(boosted?1.6:1)*(v.aug===2&&!v.used&&boosted?2:1),angle(v,e),25);if(boosted)v.used=true;}v.tick=.4;
      }break;
      case 'repair':if(tick){
        repairAtWasp(g,v);
        if(v.aug===2&&v.budget>0)v.budget-=clearBullets(g,h=>distance(v,h)<v.r*.58&&clearLab(g,v,h),1);
        v.tick=.43;
      }break;
      case 'halo':{const radius=v.r*clamp(v.age/v.max,0,1);v.budget-=clearBullets(g,h=>Math.abs(distance(v,h)-radius)<25&&clearLab(g,v,h),v.budget,v.aug===1);break;}
      case 'echo':if(v.life<=0)field(g,'halo',v.x,v.y,v.r,.65,{color:v.color,budget:v.budget});break;
      case 'decoy':if(v.life<=0){if(g.decoy===v)g.decoy=null;if(v.aug===1)field(g,'acid',v.x,v.y,47,2.8,{color:'#addb67',damage:v.damage});}break;
      case 'harvest':if(distance(v,p)<v.r+p.r){p.lastHit=Math.min(Number.isFinite(p.lastHit)?p.lastHit:g.time,g.time-10);g.fx(p.x,p.y,v.color,5);v.life=0;}break;
    }
  }
  function update(g,dt,input,tickStatuses=true) {
    const p=g.player,c=state(g),w=currentGun(g);
    if(tickStatuses)updateStatuses(g,dt);
    if(!w)return;
    c.triggerHeld=!!input.fire;
    c.gap=Math.max(0,c.gap-dt);c.wake-=dt;c.overdrive-=dt;c.redline=Math.max(0,(c.redline||0)-dt);
    const dash=!!(p.dashTime>0||p.dashing);if(dash&&!c.lastDash)dashStart(g,c);c.lastDash=dash;
    if(c.leaveTrail>0){c.leaveTrail-=dt;c.trailTick=(c.trailTick||0)-dt;if(c.trailTick<=0){field(g,'fire',p.x,p.y,24,2.5,{damage:5*c.wakePower,color:'#ff965c',aug:c.wakeAug});c.trailTick=.045;}}
    c.pathTick-=dt;if(c.pathTick<=0){c.history.push({x:p.x,y:p.y});if(c.history.length>60)c.history.shift();c.pathTick=.085;}
    p.combatMove=(c.overdrive>0?1.28:1)*(input.fire&&w.prefix==='Braced'?.92:1);
    for(const ab of p.abilities){if(ab)ab.cd=Math.max(0,(ab.cd||0)-dt);}
    for(const gun of p.guns) {
      if(!gun)continue;
      const d=guns[gun.id],m=weaponMemory(gun);gun.cd=Math.max(0,(gun.cd||0)-dt);gun.flash=Math.max(0,(gun.flash||0)-dt);
      gun.fastFeed=Math.max(0,(gun.fastFeed||0)-dt);gun.recall=Math.max(0,(gun.recall||0)-dt);gun.stable=Math.max(0,(gun.stable||0)-dt);
      if(gun.id===25&&(!input.fire||gun!==w))m.chain=0;
      if(gun!==w)gun.stowed=(gun.stowed||0)+dt;
      const cap=capacity(g,gun);if(gun.capacity!==cap){if(gun.ammo===gun.capacity)gun.ammo=cap;else gun.ammo=Math.min(cap,gun.ammo);gun.capacity=cap;}
      if(gun.reload>0){
        const mul=d.heat?1+stat(g,'cooling'):1+stat(g,'reload');
        gun.reload=Math.max(0,gun.reload-dt*mul*(c.overdrive>0?1.42:1)*(gun.fastFeed>0?1.32:1)*(p.fieldworkUntil>g.time?1.18:1));
        if(gun.reload===0){gun.ammo=cap;gun.heat=0;gun.fresh=true;if(c.overdrive>0&&c.overAug===2&&!c.refund){c.refund=true;const a=p.abilities.find(v=>v.id===11);if(a)a.cd=Math.max(0,a.cd-3);}}
      }else if(d.heat){gun.heatDelay=Math.max(0,(gun.heatDelay||0)-dt);if(gun.heatDelay===0)gun.heat=Math.max(0,(gun.heat||0)-dt*.40*(1+stat(g,'cooling')));}
      if(gun===w&&m.burst){const b=m.burst;b.timer-=dt;if(b.timer<=0&&b.remaining>0&&gun.ammo>0){
        const a=p.a+(g.rng()-.5)*.035;makeShot(g,{x:p.x+Math.cos(a)*13,y:p.y+Math.sin(a)*13},a,{...b.base,a,shape:'tracer',first:false,last:gun.ammo===1,firstMark:false,burstKey:b.key});gun.ammo--;b.remaining--;b.timer+=b.interval;gun.flash=.07;g.sound('fire',gun.id);}
        if(b.remaining<=0||gun.ammo<=0)m.burst=null;
      }
    }
    const d=guns[w.id];
    if(w.id===4)w.wound=Math.min(1,(w.wound||0)+dt*Math.abs(-Math.sin(p.a)*(input.moveX||0)+Math.cos(p.a)*(input.moveY||0))*.72);
    if(w.id===3){const hardTurn=Math.abs(wrap(p.a-(w.prevAngle??p.a)))>.15;w.focusTime=input.fire&&!hardTurn?Math.min(1.4,(w.focusTime||0)+dt):0;w.prevAngle=p.a;}
    if(d.charged){if(input.fire&&w.reload<=0&&w.cd<=0)w.charge=Math.min(1,(w.charge||0)+dt*weaponCadence(w)*(w.prefix==='Capacitor'?1.18:1)*(1+.13*handling(g,d))/(stat(g,'overclock')==='Long Cut'?1.15:1)/.75);if(input.fireReleased){fire(g,w,w.charge||.03);w.charge=0;}}
    else if(input.fire||input.firePressed)fire(g,w,0);
    if(w.id===23&&input.fireReleased)detonateStitch(g,w);
    if(!d.heat&&w.ammo<=0&&w.reload<=0&&!weaponMemory(w).burst)reload(g,false);
    moveShots(g,dt);
    c.creatures?.update(dt);
    const entities=c.entities.slice();for(const v of entities)if(v.life>0)updateEntity(g,v,dt);c.entities=c.entities.filter(v=>v.life>0);
    for(const l of c.lines)l.life-=dt;c.lines=c.lines.filter(l=>l.life>0);
    for(let i=c.impacts.length-1;i>=0;i--)if((c.impacts[i].life-=dt)<=0)c.impacts.splice(i,1);
    if(c.blasts)for(let i=c.blasts.length-1;i>=0;i--)if((c.blasts[i].age+=dt)>=c.blasts[i].duration)c.blasts.splice(i,1);
  }
  function updateStatuses(g,dt){
    for(const e of g.enemies){
      if(!live(e))continue;
      e.breakLock=Math.max(0,(e.breakLock||0)-dt);e.breakVisible=Math.max(0,(e.breakVisible||0)-dt);
      e.marked=Math.max(0,(e.marked||0)-dt);e.static=Math.max(0,(e.static||0)-dt);e.frozen=Math.max(0,(e.frozen||0)-dt);e.frost=Math.max(0,(e.frost||0)-dt*.15);
      e.combatSlow=e.frozen>0?.05:1-Math.min(.55,e.frost*.58)*(e.boss?.35:1);
      if(e.burn>0){e.burn-=dt;e.burnTick=(e.burnTick||0)-dt;if(e.burnTick<=0){lightHit(g,e,e.burnPower||4,0,0,'burn');e.burnTick=.5;}}else e.burnPower=0;
    }
  }
  function reset(g){
    const old=g.combat;g.combat=null;const c=state(g);if(old?.stage===g.stage)c.healUsed=old.healUsed;c.stage=g.stage;
    for(const w of g.player.guns){if(w){transient.delete(w);w.charge=0;}}
    g.decoy=null;g.player.combatMove=1;
  }
  function drawGun(ctx,id,x,y,scale=1,a=0,item=null){
    const def=guns[id];
    if(def)window.WeaponArt.draw(ctx,def,x,y,scale,a,item);
  }
  function path(ctx,pts,col,width=1,closed=false){
    ctx.strokeStyle=col;ctx.lineWidth=width;ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));if(closed)ctx.closePath();ctx.stroke();
  }
  function ring(ctx,x,y,r,col,width=1,facets=24,start=0,end=TAU){
    const pts=[];for(let i=0;i<=facets;i++){const a=start+(end-start)*i/facets;pts.push([Math.round(x+Math.cos(a)*r),Math.round(y+Math.sin(a)*r)]);}path(ctx,pts,col,width);
  }
  function fillDisk(ctx,x,y,r,col){ctx.fillStyle=col;ctx.beginPath();ctx.arc(x,y,Math.max(0,r),0,TAU);ctx.fill();}
  function square(ctx,x,y,size,col){ctx.fillStyle=col;ctx.fillRect(Math.round(x-size/2),Math.round(y-size/2),size,size);}
  function drawShot(ctx,s,time){
    const col=s.color;
    ctx.save();ctx.translate(Math.round(s.x),Math.round(s.y));ctx.rotate(s.a);
    const bar=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h);};
    switch(s.shape){
      case 'shieldBolt':path(ctx,[[-7,-3],[-1,-3],[3,0],[-1,3],[-7,3],[-3,0]],col,1.7,true);bar(-4,-1,5,2,'#e1f6ff');break;
      case 'tracer':case 'needle':case 'rail':case 'rift':{
        const len=s.shape==='rail'?29:s.shape==='needle'?17:s.shape==='rift'?16:12;
        bar(-len,-2,len+2,4,col+'38');bar(-len+3,-1,len,2,col);bar(-3,-1,6,2,'#fff9df');if(s.shape==='rift')bar(-7,-3,2,6,col);break;
      }
      case 'wasp':bar(-4,-1,8,3,'#654934');bar(-2,-2,4,4,col);bar(1,-1,2,2,'#fff4c5');bar(-2,-3-Math.floor(time*16)%2,3,2,'#b0d5d8');bar(-3,3,3,2,'#a1c4c8');break;
      case 'disc':ctx.rotate(time*10);ring(ctx,0,0,7,col,2,8);bar(-3,-1,6,2,'#f4e8ff');bar(0,-6,2,4,'#ede2ff');break;
      case 'cluster':case 'anchor':ring(ctx,0,0,5,col,2,8);bar(-9,-1,6,2,col);bar(-2,-2,4,4,s.shape==='anchor'?'#aaa0ef':'#ffe2a7');break;
      case 'thorn':case 'crystal':case 'shard':case 'blade':path(ctx,[[-7,1],[1,-2],[4,0],[-3,2]],col,2,true);bar(0,-1,3,1,'#fff9ef');break;
      case 'ember':bar(-5,-2,6,4,'#ff854970');bar(-3,-1,6,3,col);bar(0,0,2,1,'#fff1b3');break;
      case 'frost':bar(-6,-2,6,1,col);bar(-3,1,5,2,col+'b0');bar(0,-1,2,2,'#e0ffff');break;
      case 'clamp':bar(-4,-3,6,2,col);bar(-4,1,6,2,col);bar(-4,-2,2,5,col);break;
      default:bar(-5,-2,7,4,col+'66');bar(-3,-1,6,2,col);bar(1,-1,2,2,'#fffae7');
    }ctx.restore();
  }
  function drawEntity(ctx,g,v) {
    const x=Math.round(v.x),y=Math.round(v.y),col=v.color,t=clamp(v.age/v.max,0,1),p=g.player;
    const pulse=1+Math.sin(v.age*8)*.08;
    switch(v.kind){
      case 'shieldPulse':case 'repairPulse':{
        ring(ctx,x,y,Math.max(3,v.r*(.18+.82*t)),col,2*(1-t)+.4,24);
        if(v.kind==='repairPulse'&&t<.78){
          ctx.fillStyle=col;ctx.fillRect(x-1,y-5,3,10);ctx.fillRect(x-5,y-1,10,3);
        }break;
      }
      case 'canopy':case 'shelter':case 'linkShell':{
        const r=v.r;
        fillDisk(ctx,x,y,r,col+(v.flash>0?'33':'12'));
        ring(ctx,x,y,r,col+'b0',v.flash>0?3:1,32);
        for(const side of [-1,1]){
          path(ctx,[[x+side*r,y],[x+side*r*.76,y-r*.52],[x+side*r*.36,y-r*.82],[x,y-r]],col+'56',1);
        }
        if(v.kind!=='linkShell'){ring(ctx,x,y,6,col,2,6);square(ctx,x,y,4,'#edf9f3');}break;
      }
      case 'wireFence':{
        const [s,t]=v.ends,dx=t.x-s.x,dy=t.y-s.y,n=Math.hypot(dx,dy)||1;
        const points=[[s.x,s.y]];
        for(let j=1;j<9;j++){
          const bend=Math.sin(j*2.7+v.age*22)*(v.budget?4:2);
          points.push([s.x+dx*j/9-dy/n*bend,s.y+dy*j/9+dx/n*bend]);
        }points.push([t.x,t.y]);path(ctx,points,col+'58',4);path(ctx,points,v.budget?'#c8edff':col,1);
        for(const end of v.ends){
          square(ctx,end.x,end.y+2,10,'#283239');square(ctx,end.x,end.y,7,col);square(ctx,end.x,end.y-1,3,'#fff4c9');
        }break;
      }
      case 'lifeboat':{
        ring(ctx,v.end.x,v.end.y,v.r,col+'72',1,16);const h=Math.sin(t*Math.PI)*30;
        fillDisk(ctx,x,y+2,4,'#1c253a88');ring(ctx,x,y-h,6,col,2,6);square(ctx,x,y-h,3,'#fff5df');break;
      }
      case 'workerBee':case 'watchtower':case 'gravwinch':case 'nursery':case 'mirrorforge':{
        const id=v.kind==='workerBee'?40:v.kind==='watchtower'?41:v.kind==='gravwinch'?42:v.kind==='nursery'?15:16;
        v.active=v.returning||v.tick>.38;v.tier??=v.aug===1?2:1;
        Art.device(ctx,id,x,y,1,v.a||0,v);
        if(v.kind==='workerBee'&&v.returning)fillDisk(ctx,x,y+5,2,'#b9f8bf');
        break;
      }
      case 'foamPod':{
        fillDisk(ctx,x,y+2,6,'#1e3633');ring(ctx,x,y,6,col,2,6);
        square(ctx,x,y-2,3,v.age>.32?'#e6fad0':col);break;
      }
      case 'spark':ring(ctx,x,y,v.r*t,col,2,12);break;
      case 'break':for(let i=0;i<6;i++){const a=i*TAU/6+.5;const r=v.r*(.67+t),dx=Math.cos(a),dy=Math.sin(a);path(ctx,[[x+dx*r+dy*5,y+dy*r-dx*5],[x+dx*(r+3),y+dy*(r+3)],[x+dx*r-dy*5,y+dy*r+dx*5]],col,2.5*(1-t)+.7);}break;
      case 'cone':ring(ctx,x,y,v.r*(.3+.7*t),col,3*(1-t)+1,18,v.a-v.half,v.a+v.half);for(let i=0;i<7;i++){const a=v.a-v.half+2*v.half*i/6;path(ctx,[[x+Math.cos(a)*v.r*(.2+.6*t),y+Math.sin(a)*v.r*(.2+.6*t)],[x+Math.cos(a)*v.r*(.3+.7*t),y+Math.sin(a)*v.r*(.3+.7*t)]],col+'99',2);}break;
      case 'mortar':case 'podlob':case 'skip':case 'burrow':{
        ring(ctx,v.end.x,v.end.y,Math.max(7,v.r*.4*(1-t)),col+'99',1,12);fillDisk(ctx,x,y,3.5,'#101a25aa');
        if(v.kind==='burrow'){for(let i=0;i<4;i++)square(ctx,x-i*2,y+Math.sin(i+v.age*19)*2,3,col);break;}
        const elev=Math.abs(Math.sin(t*Math.PI*(v.kind==='skip'?2:1)))*(v.kind==='skip'?19:34);
        square(ctx,x,y-elev,8,'#26343d');square(ctx,x,y-elev,5,col);square(ctx,x-1,y-elev-1,2,'#fff3cb');break;
      }
      case 'stitch':case 'fuse':case 'meteor':{
        ring(ctx,x,y,v.r,col+'8c',1,16);ring(ctx,x,y,v.r*(1-t),col,1.5,12);
        if(v.kind==='meteor'){
          for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5])path(ctx,[[x+Math.cos(a)*v.r*.72,y+Math.sin(a)*v.r*.72],[x+Math.cos(a)*v.r*1.12,y+Math.sin(a)*v.r*1.12]],col,2);
          if(t>.49){
            const h=(1-t)*180,sx=x+h*.48,sy=y-h;
            path(ctx,[[sx+12,sy-25],[sx,sy]],col+'63',7);
            path(ctx,[[sx+9,sy-18],[sx,sy]],col,3);
            square(ctx,sx,sy,7,'#bd7956');square(ctx,sx-1,sy+1,4,'#ffdb91');
          }
        }
        square(ctx,x,y,5,'#293644');square(ctx,x,y,3,col);break;
      }
      case 'implode':case 'gravity':{fillDisk(ctx,x,y,v.r,col+'11');for(let i=0;i<3;i++){const k=1-(v.age*1.15+i/3)%1;ring(ctx,x,y,Math.max(4,v.r*k),col+(i===0?'ae':'55'),1.5,20,v.age+i*2,v.age+i*2+Math.PI*1.35);}square(ctx,x,y,8,col);square(ctx,x,y,4,'#352d51');break;}
      case 'sweep':if(v.end)path(ctx,[[x,y],[v.end.x,v.end.y]],col,3);break;
      case 'fire':case 'acid':case 'ice':{fillDisk(ctx,x,y,v.r*.85,col+'20');ring(ctx,x,y,v.r*.89,col+'86',1,14);for(let i=0;i<5;i++){const a=i*2.4,r=v.r*(i+1)/8;const sx=x+Math.cos(a)*r,sy=y+Math.sin(a)*r; square(ctx,sx,sy-(v.kind==='fire'?(v.age*19+i*2)%8:0),2+i%2,col);}break;}
      case 'screen':case 'lattice':{
        const [s,b]=geometry(v);path(ctx,[[s.x,s.y],[b.x,b.y]],col+'4a',8);path(ctx,[[s.x,s.y],[b.x,b.y]],col,2);
        if(v.kind==='lattice'&&v.aug===1){const z=[x+Math.cos(v.a)*v.r*1.3,y+Math.sin(v.a)*v.r*1.3];path(ctx,[[s.x,s.y],z,[b.x,b.y]],col,2);}
        square(ctx,s.x,s.y,6,col);square(ctx,b.x,b.y,6,col);break;
      }
      case 'halo':ring(ctx,x,y,v.r*t,col,2,38);ring(ctx,x,y,Math.max(2,v.r*t-6),col+'70',1,38);break;
      case 'echo':case 'beacon':case 'harvest':ring(ctx,x,y,(v.kind==='echo'?14:v.r)*pulse,col,1.5,8);square(ctx,x,y,4,col);break;
      case 'spool':{const k=state(g).entities.find(z=>z!==v&&z.kind==='spool'&&z.age>=v.age);if(k&&clearLab(g,v,k)){path(ctx,[[x,y],[k.x,k.y]],col+'55',4);path(ctx,[[x,y],[k.x,k.y]],col,1);}square(ctx,x,y,7,'#312a35');square(ctx,x,y,4,col);break;}
      case 'repair':ring(ctx,x,y,v.r,col+'42',1,24);square(ctx,x,y+5,7,'#203b35');square(ctx,x,y+Math.sin(v.age*5)*2-2,8,'#4c7468');square(ctx,x,y-2,4,col);path(ctx,[[x-10,y-2],[x-4,y-1],[x+4,y-1],[x+10,y-3]],col,2);break;
      case 'decoy':{const h=Math.sin(v.age*12)*2;ring(ctx,x,y,17,col+'66',1,12);square(ctx,x,y-6+h,9,col+'9e');square(ctx,x,y+2+h,13,col+'6e');square(ctx,x+2,y-7+h,4,'#f7dbab');break;}
      case 'mine':case 'tick':case 'sentry':case 'remora':{
        const size=v.kind==='mine'?8:6;fillDisk(ctx,x,y+3,size,'#18262a99');
        for(const side of [-1,1])path(ctx,[[x+side*2,y],[x+side*(size-1),y-2],[x+side*(size+1),y+3]],col+'b8',1.5);
        square(ctx,x,y,size+2,'#2c3935');square(ctx,x,y-1,size-1,col);square(ctx,x-1,y-2,2,'#f7ecd1');
        if(v.kind==='mine')ring(ctx,x,y,9*pulse,col+'66',1,8);if(v.kind==='sentry')path(ctx,[[x,y],[x+Math.cos(v.a||0)*9,y+Math.sin(v.a||0)*9]],col,2);break;
      }
    }
  }
  function drawImpact(ctx,v,bright){
    const t=1-v.life/.20,d=4+t*11,c=v.color;
    ctx.save();ctx.translate(Math.round(v.x),Math.round(v.y));ctx.rotate(v.a);
    ctx.globalAlpha*=1-t*.82;
    if(bright&&t<.40){
      const k=1-t/.4;
      path(ctx,[[-4*k,0],[7*k,0]],c,3);
      path(ctx,[[0,-4*k],[1,3*k]],'#fff0ce',1.7);
    }
    switch(v.family){
      case 0: // Hot jacket fragments scatter forward from a rifle impact.
        for(const side of [-1,1])path(ctx,[[d*.35,side*2],[d,side*d*.47]],c,2);
        square(ctx,d*.62,-1,2,'#fff5c8');break;
      case 1: // A compact pressure front and displaced grit.
        ring(ctx,0,0,d*.85,c,2,7,-.95,.95);
        for(let i=-1;i<=1;i++)square(ctx,d+i*i*2,i*d*.70,2.5,c);break;
      case 2: // A thin perforation streak and sparks at the entry point.
        path(ctx,[[-d*.5,0],[d*1.6,0]],c,2);
        path(ctx,[[0,-d*.52],[1,-2],[-2,d*.50]],'#e4fcff',1.2);break;
      case 3: // Segmented radial shockwave.
        for(let i=0;i<3;i++)ring(ctx,0,0,d,c,2,4,i*TAU/3,i*TAU/3+1.25);
        square(ctx,d*.45,-d*.65,3,'#f9bd88');break;
      case 4: // Forked ion discharge clings briefly around the target.
        for(const side of [-1,1])path(ctx,[[0,0],[3,side*d*.48],[-1,side*d*.55],[4,side*d*.95]],c,1.6);break;
      case 5: // Drone stings leave two short green-gold hooks.
        for(const side of [-1,1])path(ctx,[[d*.5,side],[d*.78,side*d*.35],[d*.32,side*d*.52]],c,2);break;
    }
    ctx.restore();
  }
  function draw(ctx,g) {
    const c=state(g),p=g.player;if(!p)return;const w=currentGun(g);if(!w)return;
    ctx.save();ctx.lineCap='butt';
    for(const v of c.entities)drawEntity(ctx,g,v);
    if(w.flash>0&&!p.downed)window.BlastArt?.muzzle(ctx,p,w,guns[w.id],g.settings?.flashes!==false);
    for(const s of c.shots)drawShot(ctx,s,g.time);
    c.creatures?.draw(ctx);
    for(const impact of c.impacts)drawImpact(ctx,impact,g.settings?.flashes!==false);
    for(const l of c.lines){const t=l.life/l.max;ctx.save();ctx.globalAlpha*=Math.min(1,t*2);
      let pts=[[l.x,l.y],[l.tx,l.ty]];
      if(l.kind==='arc'){const a=Math.atan2(l.ty-l.y,l.tx-l.x);pts=[pts[0],...[.25,.5,.75].map((k,i)=>[l.x+(l.tx-l.x)*k+Math.sin(a)*(i%2?4:-4),l.y+(l.ty-l.y)*k-Math.cos(a)*(i%2?4:-4)]),pts[1]];}
      path(ctx,pts,l.color+'48',l.width+4);path(ctx,pts,l.color,l.width);if(l.width>=2)path(ctx,pts,'#efffff',.85);ctx.restore();
    }
    const m=weaponMemory(w);if(w.id===15&&m.tags){for(let i=0;i<m.tags.length;i++){const v=m.tags[i];if(!live(v.e)||v.until<g.time)continue;ring(ctx,v.e.x,v.e.y,v.e.r+5,'#98ffdc',1.5,4);ctx.fillStyle='#effff2';ctx.font='bold 9px monospace';ctx.fillText(String(i+1),v.e.x+v.e.r+3,v.e.y-5);}}
    if(w.id===16&&m.stake&&m.stake.until>g.time){const s=m.stake;ring(ctx,s.x,s.y,7,'#98eaff',1.5,4);if(Math.abs(wrap(angle(p,s)-p.a))<.12){const a=s.flat?Math.PI-p.a:-p.a;path(ctx,[[s.x,s.y],[s.x+Math.cos(a)*75,s.y+Math.sin(a)*75]],'#8ee7ff77',1);}}
    if([18,21,22,33].includes(w.id)){const pt=targetPoint(g,guns[w.id].range);ring(ctx,pt.x,pt.y,9,'#efd7a47d',1,12);if(w.id===22)ring(ctx,(pt.x+p.x)/2,(pt.y+p.y)/2,6,'#efd7a47d',1,12);}
    if(w.charge>0&&w.id===12){const end=beamEnd(g,p,p.a,Math.min(guns[12].range,100+300*w.charge));path(ctx,[[p.x,p.y],[end.x,end.y]],'#8ee7ff83',1);}
    for(const e of g.enemies){if(!live(e))continue;const x=e.x,y=e.y,r=e.r;
      if((e.elite||e.boss)&&(e.breakValue>.008||e.breakVisible>0)){
        const width=e.boss?36:24, left=Math.round(x-width/2),top=Math.round(y-r-9);
        ctx.fillStyle='#191f2b';ctx.fillRect(left-1,top-1,width+2,4);
        ctx.fillStyle=e.breakVisible>0?'#ffebb9':'#dca267';ctx.fillRect(left,top,e.breakVisible>0?width:Math.round(e.breakValue*width),2);
      }
      if(e.marked>0)for(let i=0;i<4;i++)ring(ctx,x,y,r+3,'#ffc888',1.4,3,i*Math.PI/2-.18,i*Math.PI/2+.18);
      if(e.frozen>0)ring(ctx,x,y,r+1,'#c3f5ff',2,6);
      if(e.static>0)path(ctx,[[x+r-1,y-r-4],[x+r-4,y-r],[x+r,y-r],[x+r-2,y-r+4]],'#9fdfff',1.5);
      if(e.burn>0){const jump=(g.time*18)%8;square(ctx,x-r*.45,y-r-jump,2,'#e99b60');square(ctx,x+r*.3,y-r-(jump+4)%8,2,'#fcd385');}
    }
    ctx.restore();
  }
  function drawBlasts(ctx,g) {
    for(const fx of g.combat?.blasts||[])if(fx.age>=0)window.BlastArt?.draw(ctx,fx,g.settings?.flashes!==false);
  }
  window.Combat={guns,abilities,rarityOdds,rarityOf,rankOf,normalizeGun,makeGun,makeAbility,eligibleAffixes,compatibleChips,chips,gunName,currentGun,capacity,damageFor,rateFor,targetPoint,deathFX,drawBlasts,update,updateStatuses,draw,drawGun,cast,reload,swap,reset};
})();
