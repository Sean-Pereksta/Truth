(function () {
  'use strict';
  const W = window.OW, clamp=W.clamp, dist=W.dist;
  const rarityOrder=['Common','Uncommon','Rare','Epic','Legendary','Mythic'];
  const branches=['melee','firearms','explosives','survival','tactics','support'];
  const alive = e => e && e.hp>0 && !e.dead;
  const aget = (o,k,d=0) => Number(o && o[k]) || d;
  const values = o => Array.isArray(o) ? o : Object.values(o||{});
  class Game {
    constructor() {
      this.canvas=document.getElementById('game');
      this.state='menu'; this.paused=true; this.time=0; this.playTime=0;
      this.players=[]; this.reservePlayer=null; this.slot=0;
      this.settings={quality:'high',resolution:'auto',damageNumbers:true,music:.28,sfx:.6,ui:.5,minimap:true};
      try { Object.assign(this.settings,JSON.parse(localStorage.getItem('whiskerfall.settings')||'{}')); } catch (_) {}
      this.camera={x:1100,y:1100,zoom:1,shake:0};
      this.bulletPool=new W.Pool(W.config.maxProjectiles);
      this.effectPool=new W.Pool(W.config.maxEffects);
      this.particlePool=new W.Pool(W.config.maxParticles);
      this.projectiles=this.bulletPool.items; this.effects=this.effectPool.items; this.particles=this.particlePool.items;
      this.grid=new W.SpatialGrid(180); this.drops=[]; this.allies=[]; this.itemReveals=[]; this.pendingReward=null;
      this.world=new W.World(W.config.seed); this.completedQuests=new Set(); this.acceptedQuests=new Set();
      this.questStats={kills:0,explored:new Set(),caches:new Set(),rescued:new Set(),convoys:new Set()};
      this.questCounters={}; this.kills=0; this.trackedQuest=null; this.marker=null;
      this.missionRuns={};this.missionCompleted=new Set();
      this.audio=new W.Audio();this.audio.setVolumes(this.settings);this.input=new W.Input(this.canvas);
      this.renderer=new W.Renderer(this.canvas,this); this.ui=new W.UI(this);
      this.autosaveTime=0; this.questTime=0; this.enemyFrame=0; this.eventTime=35;
      this.ready=false; this.last=performance.now(); this.fps=60; this.frameMs=16.7;
      window.addEventListener('resize',()=>this.renderer.resize());
      window.addEventListener('beforeunload',()=>{if(this.state==='playing')this.save(false);});
      document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.state==='playing'){this.paused=true;if(!this.ui.isOpen)this.ui.showMenu('pause');this.save(false);}});
      this.renderer.load().then(()=>{this.ready=true;document.body.classList.add('assets-ready');this.ui.update();}).catch(e=>{console.error(e);this.ready=true;this.ui.toast('Artwork could not load. Keep the assets folder beside index.html.','error');});
      requestAnimationFrame(t=>this.frame(t));
    }
    weapon(p) { return W.Content.weapons[p.weapon]||W.Content.weapons[0]; }
    blade(p) { return W.Content.melee[p.melee]||W.Content.melee[0]; }
    newPlayer(id,skin=0) {
      const gun=W.Content.weapons[0];
      const start=this.world?.start||{x:1100,y:1100};const p={id,x:start.x+id*65,y:start.y,hp:140,maxHp:140,level:1,xp:0,xpNext:100,gold:120,materials:6,
        weapon:0,secondary:0,melee:0,armor:0,helmet:0,accessory:0,ability:0,ability2:1,skin,
        ammo:gun.magazine||12,reserve:240,magSize:gun.magazine||12,angle:0,anim:'idle',animTime:0,
        downed:false,revive:0,invuln:0,dodgeTime:0,cooldowns:{grenade:0,ability:0,ability2:0,dodge:0,melee:0},
        inventory:[],skills:Object.fromEntries(branches.map(b=>[b,0])),skillPoints:3,unlockedAbilities:[],skillBookVersion:1,abilityCooldowns:{},reloading:0,fireTimer:0,
        velocityX:0,velocityY:0,medkits:3,grenades:5,upgrade:0,weaponUpgrades:{},equipment:{},damageBonus:0,armorBonus:0,
        stats:{kills:0,damage:0},combo:0,comboTime:0,shieldTime:0,smokeTime:0,rageTime:0,
        armorSet:0,armorRank:0,unlockedArmorSets:[0],cores:0,moveTime:0,usingController:false,weaponTunes:{},heat:0,overheat:0,spin:0,charge:0,burstQueue:[],meleeCommit:0,meleeStrike:null,recoil:0};
      p.inventory.push({id:W.Content.equipment[0].id,upgrade:0});
      const starterBlade=W.Content.equipment.find(i=>i.melee===0);if(starterBlade)p.inventory.push({id:starterBlade.id,upgrade:0});
      return p;
    }
    start(opts={}) {
      const requestedSlot=clamp(Number(opts.slot)||0,0,2);
      if(opts.load){
        if(!W.Save.read(requestedSlot)){this.ui.toast('This campaign could not be loaded. Your existing save has not been replaced.','error');return false;}
        const previousSlot=this.slot;
        try{if(this.load(requestedSlot))return true;}catch(error){console.error(error);}
        this.slot=previousSlot;
        this.ui.toast('This campaign could not be restored. Your existing save has not been replaced.','error');return false;
      }
      this.audio.resetAnimals?.();
      this.audio.init(); this.slot=requestedSlot;
      this.world=new W.World(W.config.seed); this.players=[this.newPlayer(0,opts.character||0)]; this.reservePlayer=null;
      if(opts.coop)this.players.push(this.newPlayer(1,(opts.character||0)?0:1));
      this.bulletPool.reset();this.effectPool.reset();this.particlePool.reset();this.drops=[];this.allies=[];this.itemReveals=[];this.pendingReward=null;this.travelInteractUntil=0;
      this.completedQuests=new Set(); this.acceptedQuests=new Set(); this.questCounters={};
      this.missionRuns={};this.missionCompleted=new Set();
      this.questStats={kills:0,explored:new Set(),caches:new Set(),rescued:new Set(),convoys:new Set()};
      this.kills=0;this.time=0;this.playTime=0;this.trackedQuest=null;this.marker=null;this.campaignWon=false;
      this.eventTime=35;this.camera={x:this.world.start.x,y:this.world.start.y,zoom:1,shake:0};
      this.state='playing'; this.paused=false;this.ui.hideMenu();
      this.world.updateActive(this.players,0,this); this.world.reveal(this.world.start.x,this.world.start.y);
      this.acceptAvailable(); this.ui.toast('Welcome to the resistance. Meet the quartermaster with E / B.','quest');
      this.save(false);this.ui.update();return true;
    }
    toggleCoop() {
      if(this.players.length===2){this.reservePlayer=this.players.pop();this.ui.toast('Player 2’s fighter is saved. Press Start to rejoin.');}
      else {
        const p=this.reservePlayer||this.newPlayer(1,1);p.x=this.players[0].x+50;p.y=this.players[0].y+20;
        this.restorePlayerPosition(p);
        p.downed=false;p.hp=Math.max(p.hp,p.maxHp*.5);this.players.push(p);this.reservePlayer=null;
        this.ui.toast('Player 2 joined the resistance.','quest');
      }
      this.save(false);this.ui.update();
    }
    frame(t) {
      const dt=Math.min(.04,Math.max(.001,(t-this.last)/1000));this.last=t;
      this.frameMs=this.frameMs*.95+dt*1000*.05;this.fps=Math.round(1000/this.frameMs);
      this.input.update(this);
      if(this.state==='playing'&&!this.paused&&this.ready) this.update(dt);
      this.renderer.draw(dt);this.ui.update();
      requestAnimationFrame(n=>this.frame(n));
    }
    update(dt) {
      this.time+=dt;this.playTime+=dt;this.enemyFrame++;
      if(this.itemReveals?.length){this.itemReveals[0].life-=dt;if(this.itemReveals[0].life<=0)this.itemReveals.shift();}
      this.world.updateActive(this.players,dt,this);
      this.grid.clear(); for(const e of this.world.activeEnemies)if(alive(e))this.grid.insert(e);
      for(let i=0;i<this.players.length;i++)this.updatePlayer(this.players[i],this.input.forPlayer(i,this)||{},dt);
      this.updateEnemies(dt);this.updateProjectiles(dt);this.updateEffects(dt);this.updateAllies(dt);this.updateDrops(dt);
      this.updateMissions(dt);this.updateLocations(dt);this.updateCamera(dt);this.audio.update(dt,this);
      this.questTime+=dt;if(this.questTime>.6){this.questTime=0;this.checkQuests();}
      this.autosaveTime+=dt;if(this.autosaveTime>25){this.autosaveTime=0;this.save(false);}
      this.eventTime-=dt;if(this.eventTime<=0){this.eventTime=65+Math.random()*40;this.dynamicEvent();}
      if(this.players.every(p=>p.downed))this.defeat();
    }
    updatePlayer(p,input,dt) {
      p.animTime+=dt;p.invuln=Math.max(0,p.invuln-dt);p.fireTimer=Math.max(0,p.fireTimer-dt);
      p.comboTime=Math.max(0,p.comboTime-dt);p.shieldTime=Math.max(0,p.shieldTime-dt);p.smokeTime=Math.max(0,p.smokeTime-dt);p.rageTime=Math.max(0,p.rageTime-dt);
      p.slowTime=Math.max(0,(p.slowTime||0)-dt);p.jamTime=Math.max(0,(p.jamTime||0)-dt);p.recoil=Math.max(0,(p.recoil||0)-dt*1.6);
      if(p.poisonTime>0){p.poisonTime-=dt;p.poisonTick=(p.poisonTick||0)-dt;if(p.poisonTick<=0){p.poisonTick=.8;this.damagePlayer(p,p.poisonDamage||5,{x:p.x,y:p.y,poison:true});}}
      const equippedGun=this.weapon(p);p.heat=Math.max(0,(p.heat||0)-dt*(equippedGun.coolingRate||.24));p.overheat=Math.max(0,(p.overheat||0)-dt);p.spin=clamp((p.spin||0)+(input.shoot?dt/(equippedGun.spinupTime||.7):-dt*2.3),0,1);
      for(const k in p.cooldowns)p.cooldowns[k]=Math.max(0,p.cooldowns[k]-dt);
      if(p.downed){p.anim='death';return;}
      this.updateMelee(p,dt);
      const committed=(p.meleeCommit||0)>0;
      const gun=this.weapon(p);p.magSize=gun.magazine||12;
      if(p.reloading>0){p.reloading-=dt;p.anim='reload';if(p.reloading<=0){p.reloading=0;const take=Math.min(p.magSize-p.ammo,p.reserve);p.ammo+=take;p.reserve-=take;this.audio.play('reload');}}
      let mx=aget(input,'mx'),my=aget(input,'my');const len=Math.hypot(mx,my);if(len>1){mx/=len;my/=len;}
      if(Math.hypot(aget(input,'aimX'),aget(input,'aimY'))>.18)p.angle=Math.atan2(input.aimY,input.aimX);
      else if(len>.05&&!input.shoot)p.angle=Math.atan2(my,mx);
      if(input.dodge&&p.cooldowns.dodge<=0&&!committed){
        p.dodgeTime=.25;p.dodgeX=len>.1?mx:Math.cos(p.angle);p.dodgeY=len>.1?my:Math.sin(p.angle);
        p.cooldowns.dodge=Math.max(.55,1.25-(p.skills.survival||0)*.07-(p.perks?.fastDodge?.25:0))*(p.perks?.rollshell?.82:1);p.invuln=p.perks?.phaseweave?.57:.32;this.setAnim(p,'dodge');this.audio.play('dodge');this.armorDodge(p);
      }
      const slow=(p.reloading>0?.85:1)*(p.slowTime>0?.62:1)*(committed?.42:1)*(gun.kind==='lmg'&&input.shoot?.73:1)*(gun.mechanic==='charge'&&(p.charge||0)>0?.72:1);let speed=(245+(p.skills.survival||0)*4)*slow;
      if(p.perks?.wayfarer)speed*=1.14;
      if(p.dodgeTime>0){p.dodgeTime-=dt;mx=p.dodgeX;my=p.dodgeY;speed=760;p.anim='dodge';}
      p.velocityX=mx*speed;p.velocityY=my*speed;
      if(Math.hypot(p.velocityX,p.velocityY)>8)p.moveTime=(p.moveTime||0)+dt;
      p.usingController=!!input.usingController;p.aimDistance=input.aimDistance||180;
      this.move(p,p.velocityX*dt,p.velocityY*dt,19);
      if(this.players.length===2){const q=this.players[1-p.id];if(q&&dist(p,q)>1040){const a=Math.atan2(q.y-p.y,q.x-p.x);this.move(p,Math.cos(a)*speed*dt*1.6,Math.sin(a)*speed*dt*1.6,19);}}
      if(p.dodgeTime<=0&&p.reloading<=0&&!committed&&p.animTime>.2)p.anim=len>.05?'run':'idle';
      if(gun.mechanic==='charge'){
        if(input.shoot&&p.dodgeTime<=0&&!committed&&p.reloading<=0&&p.fireTimer<=0)p.charge=Math.min(gun.chargeTime||.85,(p.charge||0)+dt);
        else if((p.charge||0)>.08){const charge=p.charge;p.charge=0;if(!committed)this.shoot(p,false,charge);}
      }else if(input.shoot&&p.dodgeTime<=0&&!committed&&(gun.mechanic!=='semi'||!p.shootWasDown))this.shoot(p);
      p.shootWasDown=!!input.shoot;
      if(p.burstQueue?.length){for(const burst of p.burstQueue)burst.time-=dt;for(const burst of p.burstQueue.filter(b=>b.time<=0))this.shoot(p,true);p.burstQueue=p.burstQueue.filter(b=>b.time>0);}
      if(input.melee&&p.dodgeTime<=0)this.meleeAttack(p,input.heavy);
      if(input.reload)this.reload(p);
      if(input.switchWeapon)this.switchWeapon(p);
      if(input.grenade&&!committed)this.grenade(p);
      if(input.ability&&!committed)this.useAbility(p,'ability');
      if(input.ability2&&!committed)this.useAbility(p,'ability2');
      if(input.consumable)this.useConsumable(p);
      if(input.interact)this.interact(p);
      for(const q of this.players)if(q!==p&&q.downed&&dist(p,q)<100){
        if(input.interact||p.reviveTarget===q.id){p.reviveTarget=q.id;q.revive+=dt;
          if(q.revive>Math.max(.65,1.6-(p.skills.support||0)*.1)){q.downed=false;q.hp=q.maxHp*.5;q.revive=0;q.invuln=2;p.reviveTarget=null;this.effect('heal',q.x,q.y,100,1);this.ui.toast('Teammate revived!','quest');this.audio.play('heal');this.audio.vocal?.('cat_happy',q,this);}
        }
      }
      if(p.reviveTarget!=null){const q=this.players.find(q=>q.id===p.reviveTarget);if(!q||!q.downed||dist(p,q)>=100){if(q)q.revive=0;p.reviveTarget=null;}}
      this.world.reveal(p.x,p.y);
      const region=this.world.regionAt(p.x,p.y);const key=region&&region.id;
      if(key!=null&&!this.questStats.explored.has(key)){this.questStats.explored.add(key);this.awardXP(p,25+(region.level||1)*4);this.ui.toast('Discovered '+region.name+' · enemy level '+(region.level||1),'region');if((region.level||1)>p.level+2)this.ui.toast('Danger: this region is far above your level. Its patrols can defeat you quickly.','error');}
      if(p.hp<p.maxHp&&this.nearTown(p)&&this.time-(p.lastHit||0)>4)p.hp=Math.min(p.maxHp,p.hp+dt*p.maxHp*.09);
      if(p.reserve<30&&this.nearTown(p))p.reserve=180;
    }
    setAnim(o,name){o.anim=name;o.animTime=0;}
    move(o,dx,dy,r=18) {
      const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/18));
      for(let s=0;s<steps;s++){
        let x=clamp(o.x+dx/steps,r,this.world.width-r),y=clamp(o.y+dy/steps,r,this.world.height-r);
        if(o.bossIndex===8){const sector=this.world.berlinSector||(W.Content.sectors||[]).find(s=>s.id==='berlin');if(sector){x=clamp(x,sector.x+70,sector.x+sector.w-70);y=clamp(y,sector.y+70,sector.y+sector.h-70);}}
        if(!this.world.isBlocked(x,o.y,r))o.x=x;
        if(!this.world.isBlocked(o.x,y,r))o.y=y;
      }
    }
    lineOfSight(a,b) {
      const d=dist(a,b),steps=Math.ceil(d/65);
      for(let i=1;i<steps;i++)if(this.world.isBlocked(a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps,3))return false;
      return true;
    }
    shoot(p,fromBurst=false,charge=0) {
      if((p.fireTimer>0&&!fromBurst)||p.reloading>0||p.overheat>0||(p.meleeCommit||0)>0||p.downed)return;
      if(p.ammo<=0){this.reload(p);return;}
      const gun=this.weapon(p),mechanic=gun.mechanic||'';p.ammo--;
      const tuning=p.weaponTunes?.[p.weapon]?.active;
      if(!fromBurst)p.fireTimer=1/(gun.fireRate||3)/(1+(p.skills.firearms||0)*.055)/(mechanic==='spinup'?.35+.65*(p.spin||0):1)/(tuning==='rapid'?1.25:1);
      if(mechanic==='heat'){p.heat+=gun.heatPerShot||.085;if(p.heat>=1){p.overheat=gun.overheatTime||1.25;p.heat=.5;this.ui.toast('Weapon cooling · switch firearm or close in with your blade.');}}
      if(mechanic==='burst'&&!fromBurst)p.burstQueue=Array.from({length:(gun.burstCount||3)-1},(_,i)=>({time:(i+1)*(gun.burstDelay||.075)}));
      const pellets=gun.pellets||1,kind=String(gun.kind||gun.id||'').toLowerCase();
      const moving=Math.hypot(p.velocityX||0,p.velocityY||0)>65,steady=kind==='sniper'&&!moving;
      const bloom=(kind==='smg'?1+(p.heat||0)*1.4:kind==='sniper'&&moving?4:kind==='lmg'?1.7-(p.spin||0)*.7:1)+(p.recoil||0)*.4;
      p.recoil=clamp((p.recoil||0)+(kind==='pistol'?.18:kind==='rifle'?.10:.04),0,.7);
      const rocket=/rocket|launcher/.test(kind),flame=/flame/.test(kind),electric=/experimental|tesla|plasma/.test(kind);
      if(mechanic==='beam'){
        const range=gun.range||850,targets=this.grid.query(p.x,p.y,range).filter(e=>alive(e)&&Math.abs(W.wrapAngle(Math.atan2(e.y-p.y,e.x-p.x)-p.angle))<.06&&this.lineOfSight(p,e)).sort((a,b)=>dist(p,a)-dist(p,b));
        for(const e of targets.slice(0,4))this.damageEnemy(e,(gun.damage||20)*(1+p.level*.08+(p.skills.firearms||0)*.12+(p.damageBonus||0))*(1+(p.upgrade||0)*.12),p);
        const end=targets[3]||targets[targets.length-1]||{x:p.x+Math.cos(p.angle)*range,y:p.y+Math.sin(p.angle)*range};this.effect('beam',p.x,p.y,0,.16,{tx:end.x,ty:end.y,color:'#9df4ff',height:30,owner:p.id});this.setAnim(p,'shoot');this.audio.play('plasma');this.alertEnemies(p.x,p.y,750);if(p.ammo===0)this.reload(p);return;
      }
      for(let i=0;i<pellets;i++){
        const pelletOffset=pellets>1?(i-(pellets-1)/2)*(gun.spread||.23)/Math.max(1,pellets-1):0;
        const a=p.angle+pelletOffset+(Math.random()-.5)*(gun.spread||.045)*(pellets>1?.18:bloom)*(tuning==='power'?1.3:1);const speed=gun.speed||920;
        const critical=Math.random()<(p.perks?.crit||p.perks?.critical?.15:0);
        this.bulletPool.take({x:p.x+Math.cos(a)*30,y:p.y+Math.sin(a)*30,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,
          life:(gun.range||700)/speed,damage:(gun.damage||15)*(1+p.level*.07+(p.skills.firearms||0)*.1+(p.damageBonus||0))*(1+(p.upgrade||0)*.12)*(p.rageTime>0?1.4:1)*(critical?1.6:1)*(steady?1.16:1)*(mechanic==='charge'?1+clamp(charge/(gun.chargeTime||.85),0,1):1)*(tuning==='power'?1.2:1),
          owner:p.id,kind:rocket?'rocket':flame?'flame':electric?'plasma':'bullet',radius:rocket?11:flame?18:5,pierce:Math.max(gun.penetration||0,mechanic==='rail'?4:electric?2:p.perks?.pierce?1:0),bounces:mechanic==='ricochet'||p.perks?.ricochet?(gun.bounces||3):0,enemyBounces:gun.enemyBounces||0,homing:mechanic==='homing'||!!p.perks?.homing,turnRate:gun.homingStrength||4,knockback:gun.knockback||(pellets>1?12:0),explosive:!!(gun.explosive||p.perks?.explosive),blastRadius:gun.blastRadius||(rocket?135:65),burn:!!(gun.burn||p.perks?.burn),poison:!!gun.poison,freeze:!!gun.freeze,shatter:!!gun.shatter,chain:!!(gun.chain||p.perks?.chain),shock:!!(gun.shock||p.perks?.shock),critical,color:gun.color||(gun.poison?'#b5e77a':electric?'#8bf5ff':'#ffdf8a'),hitIds:[],travel:0,falloff:pellets>1?gun.range*.35:0,maxRange:gun.range||700});
      }
      this.setAnim(p,'shoot');this.effect('muzzle',p.x+Math.cos(p.angle)*39,p.y+Math.sin(p.angle)*39,22,.08,{angle:p.angle,height:30,owner:p.id});
      this.audio.play(rocket?'rocket':pellets>1?'shotgun':gun.kind||'shoot');this.alertEnemies(p.x,p.y,700);
      if(p.ammo===0)this.reload(p);
    }
    reload(p){if(p.reloading>0||p.ammo>=p.magSize)return;if(p.reserve<=0){this.ui.toast('Collect ammunition or return to a friendly camp.');return;}p.reloading=(this.weapon(p).reload||1.3)/(1+(p.skills.firearms||0)*.06)/(p.weaponTunes?.[p.weapon]?.active==='rapid'?1.2:1);this.setAnim(p,'reload');this.audio.play('reload');}
    switchWeapon(p) {
      const old=p.weapon;p.weapon=p.secondary==null?0:p.secondary;p.secondary=old;p.reloading=0;p.charge=0;p.burstQueue=[];
      p.reserve+=p.ammo;p.magSize=this.weapon(p).magazine||12;p.ammo=Math.min(p.magSize,p.reserve);p.reserve-=p.ammo;p.upgrade=p.weaponUpgrades[p.weapon]||0;
      this.recalculate(p);
      this.audio.play('ui');
    }
    meleeAttack(p,heavy=false) {
      if(p.cooldowns.melee>0||(p.meleeCommit||0)>0||p.downed)return;
      const blade=this.blade(p);p.combo=p.comboTime>0?(p.combo+1)%3:0;p.comboTime=.95;
      const finisher=heavy||p.combo===2,training=1+(p.skills.melee||0)*.035;
      p.cooldowns.melee=Math.max(finisher?.76:.43,(blade.speed||.4)*(finisher?1.65:1.1))/training;
      p.meleeCommit=(finisher?.66:.36)/training;p.charge=0;p.burstQueue=[];
      p.meleeStrike={windup:(finisher?.23:.10)/training,angle:p.angle,finisher,bladeIndex:p.melee};
      this.setAnim(p,finisher?'heavy':'melee');
      this.effect('slash',p.x,p.y,blade.range||75,.11,{angle:p.angle,heavy:false,owner:p.id,windup:true});
    }
    updateMelee(p,dt) {
      p.meleeCommit=Math.max(0,(p.meleeCommit||0)-dt);
      const swing=p.meleeStrike;if(!swing)return;swing.windup-=dt;if(swing.windup>0)return;
      p.meleeStrike=null;if(p.downed)return;
      const blade=W.Content.melee[swing.bladeIndex]||this.blade(p),finisher=swing.finisher,angle=swing.angle;
      const range=(blade.range||75)+(finisher?15:0),arc=finisher?1.45:.95;
      this.effect('slash',p.x,p.y,range,.24,{angle,heavy:finisher,owner:p.id});this.audio.play('melee');
      const lunge=finisher?35:16;this.move(p,Math.cos(angle)*lunge,Math.sin(angle)*lunge);
      for(const e of this.grid.query(p.x,p.y,range+22)){
        if(!alive(e)||dist(p,e)>range+(e.boss?24:14)||!this.lineOfSight(p,e))continue;
        const diff=Math.abs(W.wrapAngle(Math.atan2(e.y-p.y,e.x-p.x)-angle));if(diff>arc)continue;
        const backstab=Math.abs(W.wrapAngle((e.angle||0)-angle))<.65;
        const crit=Math.random()<.1+(p.skills.melee||0)*.018+(p.perks?.critical||p.perks?.crit?.15:0);
        const dmg=(blade.damage||30)*1.7*(1+p.level*.08+(p.skills.melee||0)*.14+(p.damageBonus||0))*(finisher?2:1)*(backstab?1.8:1)*(crit?1.6:1);
        this.damageEnemy(e,dmg,p,crit||backstab);e.stun=e.boss?Math.min(.12,finisher?.12:.04):finisher?.48:.18;
        if(finisher){e.bleed=2.4;e.bleedDamage=dmg*.12;e.bleedOwner=p.id;}if(p.perks?.burn){e.burn=2;e.burnDamage=dmg*.08;e.burnOwner=p.id;}
        if(!e.boss)this.move(e,Math.cos(angle)*(finisher?35:14),Math.sin(angle)*(finisher?35:14),18);
      }
      this.alertEnemies(p.x,p.y,250);
    }
    grenade(p) {
      if(p.cooldowns.grenade>0)return;
      if(p.grenades<=0){this.ui.toast('No grenades. Quartermasters restock supplies.');return;}
      p.grenades--;p.cooldowns.grenade=2.8;this.setAnim(p,'ability');
      const x=p.x+Math.cos(p.angle)*260,y=p.y+Math.sin(p.angle)*260;
      this.effect('grenade',x,y,125,.72,{owner:p.id,damage:100*(1+(p.skills.explosives||0)*.18+p.level*.045),startX:p.x,startY:p.y,delay:true});
      this.audio.play('dodge');this.alertEnemies(x,y,700);
    }
    useAbility(p,slot) {
      if(p.cooldowns[slot]>0)return;
      if((p.jamTime||0)>0){if((p.jamNotice||0)<this.time){this.ui.toast('Signal jammed. Leave the violet field to use tactical abilities.','error');p.jamNotice=this.time+2;}return;}
      const index=p[slot],ability=W.Content.abilities[index];if(!ability)return;
      if(p.level<(ability.level||1)){this.ui.toast(ability.name+' unlocks at level '+ability.level);return;}
      p.cooldowns[slot]=(ability.cooldown||20)/(1+(p.skills.tactics||0)*.065);
      this.setAnim(p,'ability');
      const damage=(ability.damage||95)*(1+p.level*.08+(p.skills.explosives||0)*.15),radius=(ability.radius||180)*(p.perks?.areaDamage?1.2:1);
      const x=clamp(p.x+Math.cos(p.angle)*310,40,this.world.width-40),y=clamp(p.y+Math.sin(p.angle)*310,40,this.world.height-40);
      const kind=ability.kind||['airstrike','heal','shockwave','smoke','artillery','lightning','mine','fire','reinforcements','rockets','cluster','bomber'][index];
      switch(kind) {
        case 'airstrike':case 'bomber':case 'artillery': {
          const count=kind==='bomber'?9:kind==='artillery'?5:3;
          this.effect('plane',x-650,y-90,150,2,{vx:850,owner:p.id,kind});
          for(let i=0;i<count;i++){
            const bx=x+(i-(count-1)/2)*100,by=y+(kind==='artillery'?(i%2?80:-80):0);
            this.effect('airstrike',bx,by,radius,1.1+i*.16,{owner:p.id,damage,delay:true});
          }break;
        }
        case 'heal': {
          this.effect('heal',p.x,p.y,radius,1.8,{owner:p.id});
          for(const q of this.players)if(dist(p,q)<radius+100&&!q.downed)q.hp=Math.min(q.maxHp,q.hp+q.maxHp*.5+20*(p.skills.support||0));
          this.audio.play('heal');break;
        }
        case 'shockwave':this.explode(p.x,p.y,radius,damage,p.id,'shockwave');p.shieldTime=3;break;
        case 'smoke':p.smokeTime=7;p.invuln=1;this.effect('smoke',p.x,p.y,radius,7);break;
        case 'lightning': {
          let origin=p;const hit=new Set();
          for(let i=0;i<7;i++){
            const target=this.grid.query(origin.x,origin.y,450).filter(e=>alive(e)&&!hit.has(e.id)).sort((a,b)=>dist(origin,a)-dist(origin,b))[0];
            if(!target)break;this.effect('lightning',origin.x,origin.y,0,.32,{tx:target.x,ty:target.y});hit.add(target.id);this.damageEnemy(target,damage*(1-i*.07),p);target.stun=.9;origin=target;
          }this.audio.play('hit');break;
        }
        case 'mine':for(let i=0;i<5;i++)this.effect('mine',p.x+Math.cos(i*1.256)*125,p.y+Math.sin(i*1.256)*125,120,35,{owner:p.id,damage,armed:.5});break;
        case 'fire':this.explode(p.x,p.y,radius,damage,p.id,'fire');this.effect('burn',p.x,p.y,radius,4,{owner:p.id,damage:damage*.12,tick:.4});break;
        case 'reinforcements': {
          for(let i=0;i<3;i++){const ax=p.x+(i-1)*55,ay=p.y+70;if(!this.world.isBlocked(ax,ay,18)&&!this.pointLocked(ax,ay))this.allies.push({x:ax,y:ay,hp:150,maxHp:150,angle:p.angle,life:18,fire:0,owner:p.id,skin:1,anim:'run',animTime:0});}
          this.effect('reinforcement',p.x,p.y,180,1);this.audio.play('quest');break;
        }
        case 'rockets': {
          const targets=this.grid.query(p.x,p.y,800).filter(alive);
          for(let i=0;i<7;i++){
            const target=targets[i%Math.max(1,targets.length)]||{x,y};const angle=Math.atan2(target.y-p.y,target.x-p.x);
            this.bulletPool.take({x:p.x,y:p.y,vx:Math.cos(angle)*580,vy:Math.sin(angle)*580,life:1.6,damage:damage*.65,owner:p.id,kind:'rocket',radius:10});
          }this.audio.play('rocket');break;
        }
        case 'cluster':for(let i=0;i<7;i++){const a=i*2.4,r=i?100:0;this.effect('grenade',x+Math.cos(a)*r,y+Math.sin(a)*r,120, .65+i*.09,{owner:p.id,damage:damage*.7,startX:p.x,startY:p.y,delay:true});}break;
        default:this.explode(x,y,radius,damage,p.id);
      }
      this.ui.toast(ability.name,'ability');this.alertEnemies(x,y,1000);
    }
    updateProjectiles(dt) {
      for(const b of this.projectiles){
        if(!b.alive)continue;b.life-=dt;
        if(b.homing&&b.owner>=0){const target=this.grid.query(b.x,b.y,650).filter(alive).sort((a,c)=>dist(a,b)-dist(c,b))[0];if(target){const speed=Math.hypot(b.vx,b.vy),a=Math.atan2(b.vy,b.vx),goal=Math.atan2(target.y-b.y,target.x-b.x),next=a+clamp(W.wrapAngle(goal-a),-dt*(b.turnRate||4),dt*(b.turnRate||4));b.vx=Math.cos(next)*speed;b.vy=Math.sin(next)*speed;}}
        const steps=Math.max(1,Math.ceil(Math.hypot(b.vx,b.vy)*dt/25));
        for(let i=0;i<steps&&b.alive;i++){
          const oldX=b.x,oldY=b.y;b.x+=b.vx*dt/steps;b.y+=b.vy*dt/steps;b.travel=(b.travel||0)+Math.hypot(b.x-oldX,b.y-oldY);
          if(W.Dungeons?.hitProjectile(this,b,oldX,oldY)){b.alive=false;break;}
          if(b.owner<0&&this.safeZoneAt(b.x,b.y)){b.alive=false;break;}
          const blocked=this.world.isBlocked(b.x,b.y,2);
          if(blocked&&b.bounces>0&&b.life>0){if(this.world.isBlocked(b.x,oldY,2))b.vx=-b.vx;else b.vy=-b.vy;b.x=oldX;b.y=oldY;b.bounces--;this.effect('impact',b.x,b.y,13,.18);continue;}
          if(b.life<=0||b.x<0||b.y<0||b.x>this.world.width||b.y>this.world.height||blocked){
            if(b.kind==='rocket')this.detonateProjectile(b);else this.effect('impact',b.x,b.y,14,.18);
            b.alive=false;break;
          }
          if(b.owner>=0){
            const e=this.grid.query(b.x,b.y,(b.radius||5)+43).find(e=>alive(e)&&!(b.hitIds||[]).includes(e.id)&&e.id!==b.lastHit&&dist(e,b)<(e.boss?43:21)+(b.radius||5));
            if(e){
              if(e.combatState==='rolling'){
                b.owner=-1;b.vx=-b.vx;b.vy=-b.vy;b.x=oldX;b.y=oldY;b.damage=Math.min(80,b.damage*.45);b.life=Math.min(1.2,b.life);b.kind='enemy';b.homing=false;b.explosive=false;b.pierce=0;b.enemyBounces=0;b.color='#fff2b0';
                this.effect('impact',e.x,e.y,29,.22);this.text('DEFLECT',e.x,e.y-45,'#ffe2a0');continue;
              }
              b.hitIds=b.hitIds||[];b.hitIds.push(e.id);
              const shatters=b.shatter&&(e.chillTime>0||e.freeze>0),impactDamage=b.damage*(shatters?2:1)*(b.falloff&&b.travel>b.falloff?clamp(1-(b.travel-b.falloff)/Math.max(1,b.maxRange-b.falloff)*.65,.35,1):1);
              if(b.kind==='rocket')this.detonateProjectile(b);
              else {this.damageEnemy(e,impactDamage,this.players[b.owner],b.critical);if(b.knockback&&!e.boss){const a=Math.atan2(b.vy,b.vx);this.move(e,Math.cos(a)*b.knockback,Math.sin(a)*b.knockback,18);}if(b.explosive)this.explode(b.x,b.y,b.blastRadius||65,b.damage*.3,b.owner);this.applyEnemyStatus(e,b);if(shatters){e.chillTime=0;e.freeze=0;this.explode(e.x,e.y,110,b.damage*.55,b.owner,'shockwave');}
                if(b.chain){const next=this.grid.query(e.x,e.y,160).find(n=>n!==e&&alive(n));if(next){this.effect('lightning',e.x,e.y,0,.2,{tx:next.x,ty:next.y});this.damageEnemy(next,b.damage*.45,this.players[b.owner]);}}
              }
              if(b.enemyBounces>0&&b.kind!=='rocket'){const next=this.grid.query(e.x,e.y,370).filter(n=>alive(n)&&!b.hitIds.includes(n.id)&&this.lineOfSight(e,n)).sort((a,c)=>dist(e,a)-dist(e,c))[0];if(next){const speed=Math.hypot(b.vx,b.vy),angle=Math.atan2(next.y-b.y,next.x-b.x);b.vx=Math.cos(angle)*speed;b.vy=Math.sin(angle)*speed;b.enemyBounces--;b.damage*=.83;b.life=Math.max(b.life,.4);b.lastHit=e.id;this.effect('lightning',e.x,e.y,0,.12,{tx:next.x,ty:next.y,color:b.color});continue;}}
              if(b.pierce>0){b.pierce--;b.lastHit=e.id;}else b.alive=false;
            }
          } else {
            for(const p of this.players)if(!p.downed&&dist(p,b)<22+(b.radius||5)){
              if(b.kind==='rocket')this.explode(b.x,b.y,115,b.damage,-1);else {this.damagePlayer(p,b.damage,b);if(b.kind==='ice'&&!p.perks?.rimeheart)p.slowTime=1.2;if(b.kind==='venom'){p.poisonTime=3.2;p.poisonDamage=b.damage*.15;p.poisonTick=.8;}}
              b.alive=false;break;
            }
            if(b.alive)for(const run of Object.values(this.missionRuns))if(run.type==='escort'&&run.state==='active'&&dist(run,b)<28){run.hp-=b.damage;b.alive=false;this.effect('impact',b.x,b.y,15,.2);break;}
          }
        }
      }
    }
    applyEnemyStatus(e,b){
      if(!alive(e)||e.combatState==='rolling')return;
      if(b.kind==='flame'||b.burn){e.burnDamage=Math.max(e.burn>0?e.burnDamage||0:0,b.damage*.22);e.burn=3;e.burnOwner=b.owner;}
      if(b.poison){e.poisonStacks=Math.min(5,(e.poison>0?e.poisonStacks||0:0)+1);e.poisonDamage=Math.max(e.poison>0?e.poisonDamage||0:0,b.damage*.12);e.poison=4;e.poisonOwner=b.owner;}
      if(b.freeze){e.chillTime=2.3;e.frostHits=(e.frostHits||0)+1;if(e.frostHits>=3){e.frostHits=0;if(!e.boss&&(e.freezeResist||0)<=0){e.freeze=.85;e.freezeResist=2.8;this.effect('shockwave',e.x,e.y,45,.3,{color:'#9ceaff'});}}}
      if(b.shock)e.stun=e.boss?.08:.35;
    }
    detonateProjectile(b){
      const radius=b.blastRadius||135;this.explode(b.x,b.y,radius,b.damage,b.owner);
      if(b.owner>=0&&(b.burn||b.poison||b.freeze))for(const e of this.grid.query(b.x,b.y,radius+25))if(dist(e,b)<radius+20)this.applyEnemyStatus(e,b);
    }
    effect(type,x,y,radius,life,extra={}) {if(extra.owner>=0&&extra.damage>0&&this.pointLocked(x,y))return null;return this.effectPool.take({type,x,y,radius,life,maxLife:life,...extra});}
    text(text,x,y,color='#fff0bb'){if(this.settings.damageNumbers)this.effect('text',x,y,0,.85,{text:String(text),color});}
    explode(x,y,radius,damage,owner=-1,type='explosion') {
      if(this.pointLocked(x,y))return;
      this.effect(type,x,y,radius,.65);this.camera.shake=Math.max(this.camera.shake,Math.min(14,radius*.045));this.audio.play('explosion');
      if(owner>=0){for(const e of this.grid.query(x,y,radius+40))if(alive(e)){
        if(dist(e,{x,y})>radius+(e.boss?32:12)||this.pointLocked(e.x,e.y))continue;
        if(e.combatState==='rolling')continue;
        const f=clamp(1-dist(e,{x,y})/(radius*1.8),.35,1);this.damageEnemy(e,damage*f,this.players[owner]);e.stun=Math.max(e.stun||0,e.boss?.08:.45);
        const a=Math.atan2(e.y-y,e.x-x);this.move(e,Math.cos(a)*35,Math.sin(a)*35,e.boss?40:18);
      }}else {for(const p of this.players)if(!p.downed&&dist(p,{x,y})<radius)this.damagePlayer(p,damage*(1-dist(p,{x,y})/(radius*2)),{x,y});for(const run of Object.values(this.missionRuns))if(run.type==='escort'&&run.state==='active'&&dist(run,{x,y})<radius&&!this.safeZoneAt(run.x,run.y))run.hp-=damage*.5;}
      this.alertEnemies(x,y,900);
    }
    updateEffects(dt) {
      for(const e of this.effects){
        if(!e.alive)continue;e.life-=dt;
        if(e.type==='text')e.y-=dt*34;
        if(e.type==='plane')e.x+=(e.vx||800)*dt;
        if(e.type==='mine'&&e.maxLife-e.life>.5){const target=this.grid.query(e.x,e.y,65).find(alive);if(target){e.life=0;e.delay=true;}}
        if(e.life<=0&&e.type==='meleeWarning'){
          const source=this.world.activeEnemies.find(n=>n.id===e.enemyId);
          if(alive(source))for(const p of this.players)if(!p.downed&&dist(p,{x:e.sourceX,y:e.sourceY})<95)this.damagePlayer(p,e.damage,source);
        }
        if(e.life<=0&&e.type==='sniper'){
          const source=this.world.activeEnemies.find(n=>n.id===e.enemyId);
          if(alive(source))this.enemyBullet(source,{x:e.tx,y:e.ty,velocityX:0,velocityY:0},e.damage,'enemy',0);
        }
        if(e.type==='burn'){
          e.tick-=dt;if(e.tick<=0){e.tick=.6;for(const enemy of this.grid.query(e.x,e.y,e.radius))if(alive(enemy))this.damageEnemy(enemy,e.damage,this.players[e.owner]);}
        }
        if(e.type==='hazard'){
          e.tick=(e.tick||0)-dt;if(e.tick<=0){e.tick=.7;for(const p of this.players)if(!p.downed&&dist(p,e)<e.radius&&!this.pointLocked(e.x,e.y)){this.damagePlayer(p,e.damage||0,e);if(e.slow&&!p.perks?.rimeheart)p.slowTime=1;if(e.jam)p.jamTime=1.2;}}
        }
        if(e.life<=0){e.alive=false;if(e.delay)this.explode(e.x,e.y,e.radius,e.damage,e.owner);if(e.spawnHazard&&!this.pointLocked(e.x,e.y))this.effect('hazard',e.x,e.y,e.radius,e.hazardLife||4,{owner:-1,damage:e.hazardDamage||e.damage*.3,color:e.color,tick:.65,slow:e.slow,jam:e.jam,poison:e.poison,fire:e.fire});}
      }
      for(const p of this.particles)if(p.alive){p.life-=dt;p.x+=(p.vx||0)*dt;p.y+=(p.vy||0)*dt;if(p.life<=0)p.alive=false;}
    }
    damageEnemy(e,amount,p,critical=false) {
      if(!alive(e))return;
      if(this.pointLocked(e.x,e.y)||(e.bossIndex===8&&!this.berlinUnlocked()))return;
      if(e.bossIndex===8&&p&&this.world.isFinalArena&&!this.world.isFinalArena(p.x,p.y))return;
      if((e.invuln||0)>0||e.combatState==='rolling')return;
      this.ensureEnemyScaling(e);
      if((e.shieldTime||0)>0)amount*=.35;
      const spec=W.Content.enemies[e.type]||W.Content.enemies[0],role=String(spec.role||spec.id||'').toLowerCase();
      if(/shield|bulwark/.test(role)&&p&&Math.abs(W.wrapAngle(Math.atan2(p.y-e.y,p.x-e.x)-e.angle))<.8)amount*=.38;
      const damage=Math.max(1,Math.round(amount));e.hp-=damage;e.hit=.14;e.lastHit=this.time;e.state='chase';e.alert=6;
      this.setAnim(e,'hurt');this.text((critical?'CRIT ':'')+damage,e.x,e.y-45,critical?'#ffd86b':'#fff4cf');
      if(p){p.stats.damage+=damage;e.target=p.id;}this.audio.play('hit');
      if(e.hp<=0)this.killEnemy(e,p);else this.audio.vocal?.('mouse_hurt',e,this);
    }
    killEnemy(e,p) {
      if(this.pointLocked(e.x,e.y)||(e.bossIndex===8&&!this.berlinUnlocked()))return;
      if(e.dead)return;e.dead=true;e.hp=0;this.audio.vocal?.('mouse_defeat',e,this);this.world.dead.add(e.id);this.setAnim(e,'death');this.effect('defeat',e.x,e.y,e.boss?70:32,.7,{typeIndex:e.type});
      this.kills++;this.questStats.kills++;this.questCounters['kills:'+e.region]=(this.questCounters['kills:'+e.region]||0)+1;
      const spec=e.boss?(W.Content.bosses[e.bossIndex]||W.Content.enemies[e.type]):W.Content.enemies[e.type]||W.Content.enemies[0];
      for(const q of this.players){if(!q.downed)this.awardXP(q,Math.round((spec.xp||20)*(1+(e.level||1)*.14)*(e.boss?1.4:1)));q.gold+=(e.boss?90:3)+(e.level||1);if(e.boss)q.cores=(q.cores||0)+3;}
      if(p){p.stats.kills++;if(p.perks?.healOnKill||p.equipment.accessory?.healOnKill)p.hp=Math.min(p.maxHp,p.hp+8);}
      if(p?.perks?.venomskin&&e.poison>0)p.hp=Math.min(p.maxHp,p.hp+12);
      if(p?.perks?.phaseweave&&(p.phaseShieldReady||0)<=this.time){p.shieldTime=Math.max(p.shieldTime||0,1.2);p.phaseShieldReady=this.time+12;this.effect('shield',p.x,p.y,55,.5);}
      this.grantEnemyReward(e);
      this.drops.push({id:'d'+this.time+Math.random(),x:e.x,y:e.y,type:'ammo',amount:e.boss?100:12+Math.floor(Math.random()*13),life:90});
      if(Math.random()<.16)this.drops.push({id:'mat'+this.time,x:e.x-20,y:e.y,type:'material',amount:2+(e.level||1),life:90});
      if(Math.random()<.1)this.drops.push({id:'health'+this.time,x:e.x,y:e.y-20,type:'health',amount:30,life:60});
      if(e.boss){this.completeBoss(e);this.camera.shake=13;this.audio.play('quest');}
    }
    damagePlayer(p,amount,source) {
      if(p.invuln>0||p.downed||p.smokeTime>0||this.safeZoneAt(p.x,p.y))return;
      let reduction=clamp((p.armorBonus||0)+(p.skills.survival||0)*.025,0,.72);if(p.shieldTime>0)reduction=.85;
      if(p.perks?.fireResist&&(source?.kind==='flame'||source?.fire))amount*=.5;
      if(p.perks?.cinderproof&&(source?.kind==='flame'||source?.fire))amount*=.3;
      if(p.perks?.venomskin&&(source?.kind==='venom'||source?.poison))amount*=.25;
      if((p.meleeCommit||0)>0)amount*=1.2;
      const dmg=Math.max(1,Math.round(amount*(1-reduction)));p.hp-=dmg;p.invuln=.28;p.lastHit=this.time;this.setAnim(p,'hurt');
      this.text('-'+dmg,p.x,p.y-50,'#ff9b8e');this.audio.play('hit');this.camera.shake=4;
      this.audio.vocal?.(p.hp<=0?'cat_down':'cat_hurt',p,this);
      if(p.perks?.rimeheart&&(p.frostPulseReady||0)<=this.time){p.frostPulseReady=this.time+6;this.effect('shockwave',p.x,p.y,175,.55,{color:'#b4efff'});for(const e of this.grid.query(p.x,p.y,175))if(alive(e)){this.applyEnemyStatus(e,{freeze:true,damage:0,owner:p.id});if(!e.boss)e.freeze=.75;}}
      if(source){const a=Math.atan2(p.y-source.y,p.x-source.x);this.move(p,Math.cos(a)*12,Math.sin(a)*12);}
      if(p.hp<=0){p.hp=0;p.downed=true;p.revive=0;this.setAnim(p,'death');this.ui.toast(this.players.length>1?'Fighter down! Approach and interact to revive.':'The resistance will get you back on your paws.','error');}
    }
    alertEnemies(x,y,radius){for(const e of this.world.activeEnemies)if(alive(e)&&Math.hypot(e.x-x,e.y-y)<radius){e.alert=7;if(e.state==='patrol')e.state='investigate';e.investigateX=x;e.investigateY=y;}}
    ensureEnemyScaling(e){
      // Authored waves and invasions manage their own health budget.
      if(e.boss||(e.regionScaleApplied&&(!Number.isFinite(e.regionDamage)||e.invasionId)))return;
      const r=Number.isFinite(e.region)?e.region:this.world.regionAt(e.x,e.y)?.index||0,scale=W.Content.enemyScaling(r);
      const applied=e.regionScaleApplied?(Number.isFinite(e.regionHealthScale)&&e.regionHealthScale>0?e.regionHealthScale:W.Content.enemyScaling(r,true).health):1;
      if(applied!==scale.health){const ratio=scale.health/applied;e.hp*=ratio;e.maxHp*=ratio;}
      e.regionScaleApplied=true;e.regionHealthScale=scale.health;e.regionDamage=scale.damage;
    }
    enemyDamage(e,spec,multiplier=1){
      const r=Number.isFinite(e.region)?e.region:this.world.regionAt(e.x,e.y)?.index||0;
      const tier=r>7?((W.Content.regions[r]?.level||22)-1)/3:r,pressure=e.boss?1.6:1.8-clamp(tier,0,7)*(.4/7);
      return (spec.damage||12)*(1+(e.level||1)*.07)*(e.boss?1+r*.07:W.Content.enemyScaling(r).damage)*pressure*multiplier;
    }
    armorDodge(p){
      if(p.perks?.wayfarer){const rounds=Math.min(3,p.reserve,Math.max(0,p.magSize-p.ammo));p.ammo+=rounds;p.reserve-=rounds;}
      if(p.perks?.rollshell){this.effect('shockwave',p.x,p.y,115,.35);for(const e of this.grid.query(p.x,p.y,115))if(alive(e)&&!e.boss&&e.combatState!=='rolling'){const a=Math.atan2(e.y-p.y,e.x-p.x);this.move(e,Math.cos(a)*65,Math.sin(a)*65,19);e.stun=.25;}}
      if(p.perks?.cinderproof)this.effect('burn',p.x,p.y,90,2.4,{owner:p.id,damage:12+p.level*2,tick:.1});
    }
    updateEnemies(dt) {
      const enemies=this.world.activeEnemies;
      for(let i=0;i<enemies.length;i++){
        const e=enemies[i];if(!alive(e))continue;
        this.ensureEnemyScaling(e);
        const spec=e.boss?(W.Content.bosses[e.bossIndex]||W.Content.enemies[e.type]):W.Content.enemies[e.type]||W.Content.enemies[0];e.animTime=(e.animTime||0)+dt;e.hit=Math.max(0,(e.hit||0)-dt);
        e.fireTimer=Math.max(0,(e.fireTimer||0)-dt);e.alert=Math.max(0,(e.alert||0)-dt);e.stun=Math.max(0,(e.stun||0)-dt);e.invuln=Math.max(0,(e.invuln||0)-dt);e.shieldTime=Math.max(0,(e.shieldTime||0)-dt);
        if(this.pointLocked(e.x,e.y)||(e.bossIndex===8&&!this.berlinUnlocked()))continue;
        if(e.burn>0){e.burn-=dt;e.hp-=dt*(e.burnDamage||6);if(e.hp<=0){this.killEnemy(e,this.players[e.burnOwner]||this.players[0]);continue;}}
        if(e.bleed>0){e.bleed-=dt;e.hp-=dt*(e.bleedDamage||8);if(e.hp<=0){this.killEnemy(e,this.players[e.bleedOwner]||this.players[0]);continue;}}
        if(e.poison>0){e.poison-=dt;e.hp-=dt*(e.poisonDamage||4)*(e.poisonStacks||1);if(e.hp<=0){this.killEnemy(e,this.players[e.poisonOwner]||this.players[0]);continue;}if(e.poison<=0)e.poisonStacks=0;}
        e.chillTime=Math.max(0,(e.chillTime||0)-dt);e.freezeResist=Math.max(0,(e.freezeResist||0)-dt);if(e.chillTime<=0)e.frostHits=0;
        if(e.freeze>0){e.freeze=Math.max(0,e.freeze-dt);e.anim='hurt';continue;}
        if(e.stun>0){e.anim='hurt';continue;}
        const role=String(spec.role||spec.id||spec.name||'').toLowerCase().replace(/[ _-]/g,'');
        const safe=this.safeZoneAt(e.x,e.y);
        if(safe){const a=Math.atan2(e.y-safe.y,e.x-safe.x);e.x=safe.x+Math.cos(a)*((safe.safeRadius||500)+45);e.y=safe.y+Math.sin(a)*((safe.safeRadius||500)+45);e.alert=0;e.specialMove=null;e.jumpHeight=0;}
        if(this.updateAdvancedEnemy(e,null,spec,dt))continue;
        if(this.updateSpecialMove(e,null,dt))continue;
        const escorts=Object.values(this.missionRuns).filter(r=>r.type==='escort'&&r.state==='active'&&r.hp>0);
        let target=[...this.players,...escorts].filter(p=>!p.downed&&!(p.smokeTime>0)&&p.hp>0&&!this.safeZoneAt(p.x,p.y)).sort((a,b)=>dist(e,a)-dist(e,b))[0];if(!target){this.patrol(e,spec,dt);continue;}
        if(e.bossIndex===8&&this.world.isFinalArena&&!this.world.isFinalArena(target.x,target.y)){this.patrol(e,spec,dt);continue;}
        const d=dist(e,target),sight=/sniper/.test(role)?1100:800;
        if(d>sight&&!e.alert&&!e.boss){this.patrol(e,spec,dt);continue;}
        if(d>sight*1.7&&!e.boss){this.patrol(e,spec,dt);continue;}
        const visible=this.lineOfSight(e,target);
        if(!visible&&e.alert<=0&&d>230){this.patrol(e,spec,dt);continue;}
        e.state='attack';e.alert=Math.max(e.alert,4);e.angle=Math.atan2(target.y-e.y,target.x-e.x);
        const knife=/knife|melee|duelist|leaper|fencer|blinkstalker|burrowrat|voidknight/.test(role);
        let speed=(spec.speed||95)*(e.boss?1.3:knife?1.7:1.45);
        if(e.chillTime>0)speed*=e.boss?.86:.6;
        if(!e.boss&&/roller|blinkstalker|fencer|burrowrat|cinderbeast|venomrat|frostwarden|voidknight/.test(role)&&this.updateAdvancedEnemy(e,target,spec,dt))continue;
        const melee=knife||/shield|leaper|bruiser|bulwark/.test(role);
        const desired=e.boss?([95,440,220,300,130,330,300,260,230][e.bossIndex]||230):melee?48:/shotgun|flame/.test(role)?170:/sniper/.test(role)?590:/tank|war/.test(role)?340:330;
        let vx=0,vy=0;
        if(knife&&d>38||d>desired+55||!visible){vx=Math.cos(e.angle);vy=Math.sin(e.angle);}
        else if(d<desired-65&&!knife){vx=-Math.cos(e.angle)*.75;vy=-Math.sin(e.angle)*.75;}
        else if(!knife&&!/shield|heavy|tank/.test(role)){const side=Math.sin(this.time*.9+i)>0?1:-1;vx=Math.cos(e.angle+Math.PI/2)*side*.65;vy=Math.sin(e.angle+Math.PI/2)*side*.65;}
        if(e.hp<e.maxHp*.23&&!e.boss&&!knife&&d<400){vx=-Math.cos(e.angle);vy=-Math.sin(e.angle);speed*=1.1;e.state='retreat';}
        // Squads flank from alternating sides and separate using the local spatial grid.
        if(d>250&&d<700&&!knife&&!/tank|heavy|sniper/.test(role)){const flank=(i%2?1:-1)*.28;vx+=Math.cos(e.angle+Math.PI/2)*flank;vy+=Math.sin(e.angle+Math.PI/2)*flank;}
        if(i%3===this.enemyFrame%3){for(const o of this.grid.query(e.x,e.y,e.boss?85:48))if(o!==e&&alive(o)){const od=dist(e,o)||1;vx+=(e.x-o.x)/od*.35;vy+=(e.y-o.y)/od*.35;}}
        if(!visible){const nav=this.world.steerAround(e,target,dt);vx=nav.mx;vy=nav.my;}
        if(e.turret){vx=0;vy=0;speed=0;}
        const oldX=e.x,oldY=e.y;this.move(e,vx*speed*dt,vy*speed*dt,e.boss?34:17);e.velocityX=(e.x-oldX)/dt;e.velocityY=(e.y-oldY)/dt;e.moveTime=(e.moveTime||0)+(Math.hypot(e.velocityX,e.velocityY)>8?dt:0);
        if(Math.hypot(e.x-oldX,e.y-oldY)<dt*speed*.12&&(Math.abs(vx)+Math.abs(vy))>.3){
          e.avoidTimer=(e.avoidTimer||0)+dt;
          const side=(e.avoidTimer%3)<1.5?1:-1;this.move(e,Math.cos(e.angle+side*1.5)*speed*dt,Math.sin(e.angle+side*1.5)*speed*dt,e.boss?34:17);
        } else e.avoidTimer=0;
        if(e.animTime>.25)e.anim=Math.hypot(e.x-oldX,e.y-oldY)>dt*12?'run':'idle';
        if(/medic/.test(role)&&e.fireTimer<=0){const friend=this.grid.query(e.x,e.y,230).find(o=>o!==e&&alive(o)&&o.hp<o.maxHp*.75);if(friend){friend.hp=Math.min(friend.maxHp,friend.hp+friend.maxHp*.18);this.effect('heal',friend.x,friend.y,55,.7);e.fireTimer=3;}}
        if(/officer/.test(role)){for(const other of this.grid.query(e.x,e.y,280))if(other!==e)other.officerBuff=this.time+1;}
        if(/commando/.test(role)&&e.hp<e.maxHp*.75&&(e.dodgeCooldown||0)<this.time&&d<400){const side=i%2?1:-1;this.move(e,Math.cos(e.angle+side*Math.PI/2)*80,Math.sin(e.angle+side*Math.PI/2)*80);e.dodgeCooldown=this.time+5;e.invuln=.2;}
        if(/engineer/.test(role)&&(e.buildCooldown||0)<this.time&&d<700){e.buildCooldown=this.time+14;this.spawnTurret(e);}
        if(e.boss){this.bossAI(e,target,spec,dt);continue;}
        if(e.specialMove)continue;
        if(/roller|blinkstalker|fencer|burrowrat|cinderbeast|venomrat|frostwarden|voidknight/.test(role))continue;
        if(/leaper|bruiser|mortar|sapper|skirmisher|frost|jammer|stormcaller|duelist|hunter|bombardier|bulwark/.test(role)){this.specialEnemyAI(e,target,spec,role,d,dt);continue;}
        if(e.fireTimer>0||!visible||d>(melee?90:(spec.range||650))||target.downed)continue;
        let damage=this.enemyDamage(e,spec);if((e.officerBuff||0)>this.time)damage*=1.18;
        const rate=(spec.fireRate||.8)*1.35;
        if(melee&&d<90){this.setAnim(e,'melee');this.effect('enemySlash',e.x,e.y,80,.32,{angle:e.angle});e.fireTimer=.68;
          this.effect('meleeWarning',target.x,target.y,75,.3,{enemyId:e.id,damage,owner:-1,sourceX:e.x,sourceY:e.y});
        }else if(!melee){
          if(/grenad/.test(role)){this.effect('telegraph',target.x+(target.velocityX||0)*.4,target.y+(target.velocityY||0)*.4,125,.85,{delay:true,damage:damage*2,owner:-1});e.fireTimer=2.3;this.setAnim(e,'ability');}
          else if(/sniper/.test(role)){
            this.effect('sniper',e.x,e.y,0,.65,{tx:target.x+(target.velocityX||0)*.3,ty:target.y+(target.velocityY||0)*.3,enemyId:e.id,damage:damage*1.9});e.fireTimer=2.25;this.setAnim(e,'aim');
          } else {
            const rocket=/rocket|tank|warmachine/.test(role),flame=/flame/.test(role);const spread=/machine|heavy/.test(role)?.17:.075;
            this.enemyBullet(e,target,damage,rocket?'rocket':flame?'flame':'enemy',spread);
            e.fireTimer=1/rate;this.setAnim(e,'shoot');e.shots=(e.shots||0)+1;
            if(e.shots%(/machine|heavy/.test(role)?15:5)===0){e.fireTimer+=.8;e.state='reload';this.setAnim(e,'reload');}
          }
        }
      }
    }
    patrol(e,spec,dt) {
      e.state=e.alert>0?'investigate':'patrol';
      if(!e.patrolTime||e.patrolTime<=0){const a=(Math.sin((e.homeX||e.x)*.01+this.time*.15)+1)*Math.PI;e.patrolX=(e.homeX||e.x)+Math.cos(a)*145;e.patrolY=(e.homeY||e.y)+Math.sin(a)*145;e.patrolTime=3+Math.random()*4;}
      e.patrolTime-=dt;const tx=e.state==='investigate'?e.investigateX:e.patrolX,ty=e.state==='investigate'?e.investigateY:e.patrolY;
      if(Number.isFinite(tx)&&Math.hypot(tx-e.x,ty-e.y)>25){e.angle=Math.atan2(ty-e.y,tx-e.x);this.move(e,Math.cos(e.angle)*(spec.speed||90)*.42*dt,Math.sin(e.angle)*(spec.speed||90)*.42*dt);e.anim='run';}else e.anim='idle';
    }
    enemyBullet(e,target,damage,kind='enemy',spread=.08) {
      const speed=kind==='rocket'?470:kind==='flame'?430:575;const lead=dist(e,target)/speed*.72;
      const angle=Math.atan2(target.y+(target.velocityY||0)*lead-e.y,target.x+(target.velocityX||0)*lead-e.x)+(Math.random()-.5)*spread;
      const count=kind==='flame'?3:1;
      for(let i=0;i<count;i++){const a=angle+(i-(count-1)/2)*.12;
        this.bulletPool.take({x:e.x+Math.cos(a)*30,y:e.y+Math.sin(a)*30,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:kind==='flame'?.65:3,damage,owner:-1,kind,radius:kind==='flame'?17:kind==='rocket'?11:6,color:'#ff997a'});
      }
      this.effect('muzzle',e.x+Math.cos(angle)*33,e.y+Math.sin(angle)*33,18,.07,{angle});
    }
    bossAI(e,target,spec,dt) {
      const final=e.bossIndex===8||spec.finalBoss,ratio=e.hp/e.maxHp;
      const phase=final?(ratio<.22?4:ratio<.46?3:ratio<.74?2:1):(ratio<.35?3:ratio<.68?2:1);
      if(e.phase&&e.phase!==phase){
        e.phase=phase;e.specialTimer=.7;e.shieldTime=.6;e.fireTimer=.7;
        e.specialMove=null;e.jumpHeight=0;e.comboMoves=[];
        this.effect('bossWarning',e.x,e.y,300,1.1,{text:spec.name+' · PHASE '+phase});
        this.ui.toast(spec.name+' · Phase '+phase+' / '+(final?4:3)+' · watch the marked attacks.','event');
        if(phase>=3)this.fan(e,final?18:12,this.enemyDamage(e,spec)*.4,310,'enemy',Math.PI*2);
        return;
      }
      e.phase=phase;e.specialTimer=(e.specialTimer==null?1:e.specialTimer)-dt;
      if(e.specialTimer>0){this.bossPressure(e,target,spec);return;}
      e.specialTimer=final?Math.max(1.3,3.2-phase*.42):Math.max(1.6,3.7-phase*.55);
      e.bossCycle=(e.bossCycle||0)+1;const cycle=e.bossCycle,variant=(cycle-1)%3;
      const damage=this.enemyDamage(e,spec)*(1+(phase-1)*.12),lead={x:target.x+(target.velocityX||0)*.48,y:target.y+(target.velocityY||0)*.48};
      this.effect('bossWarning',e.x,e.y,235,.6,{text:spec.name+' · PHASE '+phase});
      this.setAnim(e,'special');e.fireTimer=Math.max(e.fireTimer,.85);
      if(final){this.whiskerAI(e,target,spec,damage,cycle);return;}
      switch(e.bossIndex??e.regionIndex??e.region??0){
        case 0:
          if(variant===0){this.beginMove(e,lead,'charge',.8,.56,damage*1.6,135);if(phase>=2)e.comboMoves=[{kind:'charge',target:{x:e.x,y:e.y},windup:.55,duration:.5,damage:damage*1.3,radius:100}];}
          else if(variant===1){this.fan(e,5+phase*2,damage*.8,340,'enemy',1.55);this.beginMove(e,{x:e.x+Math.cos(e.angle+1.5)*230,y:e.y+Math.sin(e.angle+1.5)*230},'skate',.5,.65,0,60);}
          else {this.markStrike(lead.x,lead.y,120,1.05,damage*1.2);if(phase>1)for(const side of [-1,1])this.markStrike(lead.x+side*150,lead.y,95,1.35,damage);this.beginMove(e,target,'slam',.95,.5,damage*1.1,145);}
          break;
        case 1: {
          const a=Math.atan2(e.y-target.y,e.x-target.x)+(cycle%2?.8:-.8);
          if(variant===0){this.beginMove(e,{x:target.x+Math.cos(a)*420,y:target.y+Math.sin(a)*420},'leap',.65,.65,damage,90);for(let i=0;i<2+phase;i++)this.effect('sniper',e.x,e.y,0,.95+i*.32,{tx:lead.x+(i-1)*75,ty:lead.y,enemyId:e.id,damage:damage*.9});}
          else if(variant===1){for(let i=0;i<phase+2;i++){const offset=(i-(phase+1)/2)*110;this.markStrike(lead.x+Math.cos(e.angle+1.57)*offset,lead.y+Math.sin(e.angle+1.57)*offset,75,1.1+i*.15,damage);}this.spawnReinforcement(e,0,phase>1?33:1);}
          else {this.beginTeleport(e,{x:target.x+Math.cos(a+Math.PI/2)*350,y:target.y+Math.sin(a+Math.PI/2)*350},.8,damage*.7,85);this.fan(e,7+phase,damage*.65,410,'enemy',1.25);}
          break;
        }
        case 2:
          if(variant===0)this.beginMove(e,lead,'slam',1,.7,damage*1.55,175);
          else if(variant===1){this.seismicRings(e,damage,phase);this.beginMove(e,{x:e.x-Math.cos(e.angle)*180,y:e.y-Math.sin(e.angle)*180},'skate',.55,.7,0,60);}
          else {this.fan(e,9+phase*3,damage*.6,245,'enemy',Math.PI*2);for(let i=0;i<phase+1;i++)this.markStrike(lead.x+(i-1)*150,lead.y,100,1.1+i*.18,damage);}
          break;
        case 3: {
          const a=e.angle+Math.PI*.6;
          if(variant===0){this.beginMove(e,{x:e.x+Math.cos(a)*330,y:e.y+Math.sin(a)*330},'skate',.6,.85,damage,90);this.fan(e,12+phase*2,damage*.65,275,'ice',Math.PI*2);}
          else if(variant===1){for(let i=0;i<3+phase;i++)this.markStrike(lead.x+(i-2)*120,lead.y+Math.cos(i)*90,90,1+i*.16,damage*.7,{spawnHazard:true,slow:true,hazardLife:3.5,color:'#99dbe9'});}
          else {this.beginMove(e,lead,'slam',.9,.6,damage*1.25,155);this.fan(e,7+phase*2,damage*.7,320,'ice',1.6);}
          break;
        }
        case 4:
          if(variant===0){const start={x:e.x,y:e.y};this.beginMove(e,{x:target.x+(target.velocityX||0)*.6,y:target.y+(target.velocityY||0)*.6},'charge',.65,.45,damage*1.4,120);e.comboMoves=[{kind:'charge',target:start,windup:.45,duration:.28,damage:damage,radius:90}];for(let i=0;i<phase+2;i++)this.markStrike(lead.x+(i-1)*115,lead.y+Math.sin(i*2)*100,95,1+i*.18,damage*.85);}
          else if(variant===1){this.fan(e,5+phase,damage*.75,285,'rocket',1.8);this.beginMove(e,{x:e.x+Math.cos(e.angle+1.57)*300,y:e.y+Math.sin(e.angle+1.57)*300},'skate',.65,.6,damage*.6,60);}
          else {for(let i=0;i<4+phase;i++){const a=i*Math.PI/2;this.markStrike(lead.x+Math.cos(a)*160,lead.y+Math.sin(a)*160,90,1+i*.16,damage);}if(phase===3)this.beginMove(e,lead,'leap',.8,.6,damage,115);}
          break;
        case 5:
          if(variant===0){for(let i=0;i<3+phase;i++){const a=i*Math.PI*2/(3+phase);this.markStrike(lead.x+Math.cos(a)*220,lead.y+Math.sin(a)*220,95,1.2,damage*.6,{spawnHazard:true,poison:true,hazardLife:4.5,color:'#9fbc72'});}this.beginMove(e,{x:target.x-180,y:target.y+180},'leap',.8,.6,damage,105);}
          else if(variant===1){for(let i=0;i<phase+3;i++)this.markStrike(e.x+Math.cos(e.angle)*i*110,e.y+Math.sin(e.angle)*i*110,75,.85+i*.2,damage*.65,{spawnHazard:true,poison:true,hazardLife:3.5,color:'#9fbc72'});this.fan(e,7,damage*.7,390,'venom',1.5);}
          else {this.beginTeleport(e,{x:e.homeX+Math.cos(cycle)*220,y:e.homeY+Math.sin(cycle)*200},.85,damage,120);this.spawnReinforcement(e,0,phase>=2?27:15);}
          break;
        case 6:
          if(variant===0){e.shieldTime=2.5;this.spawnTurret(e);for(let i=0;i<3+phase;i++){const a=i*2.4;this.markStrike(lead.x+Math.cos(a)*170,lead.y+Math.sin(a)*170,80,1.4+i*.13,damage);}this.beginMove(e,{x:e.homeX+Math.cos(this.time)*180,y:e.homeY+Math.sin(this.time)*120},'skate',.6,.9,damage*.6,70);}
          else if(variant===1){this.beginMove(e,lead,'slam',1,.7,damage*1.3,190);for(const side of [-1,1])this.markStrike(lead.x+side*190,lead.y,100,1.6,damage*.7,{spawnHazard:true,hazardLife:3,color:'#e6a06d'});}
          else {this.fan(e,4+phase,damage*.8,270,'rocket',1.9);this.spawnReinforcement(e,0,phase===3?30:12);}
          break;
        case 7:
          if(variant===0){this.fan(e,14+phase*3,damage*.55,235,'enemy',Math.PI*2);this.beginMove(e,{x:e.homeX+Math.cos(cycle)*230,y:e.homeY+Math.sin(cycle)*180},'leap',.65,.65,damage,100);}
          else if(variant===1){for(let i=0;i<4+phase;i++)this.markStrike(lead.x+(i-3)*95,lead.y+Math.sin(i)*150,95,1.1+i*.14,damage*.85);this.fan(e,5,damage*.65,345,'ice',1.2);}
          else {this.beginMove(e,lead,'slam',.95,.65,damage*1.4,210);if(phase>1)this.seismicRings(e,damage*.7,phase-1);}
          if(phase===3&&cycle%3===0)this.spawnReinforcement(e,0,28);
          break;
      }
    }
    bossPressure(e,target,spec){
      if(e.fireTimer>0||e.specialMove||dist(e,target)>(spec.range||650)+200||!this.lineOfSight(e,target))return;
      const index=e.bossIndex??e.region??0,phase=e.phase||1,damage=this.enemyDamage(e,spec)*.7;
      // Each commander keeps a signature weapon active between its larger moves.
      // Positioning against a sniper, spreading ice, rockets and venom is different.
      if(index===1)this.effect('sniper',e.x,e.y,0,.6,{tx:target.x+(target.velocityX||0)*.35,ty:target.y+(target.velocityY||0)*.35,enemyId:e.id,damage:damage*1.25});
      else {
        const weapons=[[3,.3,540,'enemy'],null,[3,.75,330,'rocket'],[5,1.05,360,'ice'],[3,.32,650,'enemy'],[5,1.1,350,'venom'],[7,.8,480,'enemy'],[14,Math.PI*2,290,'enemy'],[5,1.25,460,phase%2?'ice':'venom']];
        const [count,arc,speed,kind]=weapons[index]||weapons[0];this.fan(e,count,damage,speed,kind,arc);
      }
      e.fireTimer=([.95,1.4,1.5,1.15,.72,1.25,.9,1.5,.95][index]||1)*(1-(phase-1)*.08);this.setAnim(e,'shoot');
    }
    markStrike(x,y,radius,delay,damage,extra={}){if(!this.pointLocked(x,y))this.effect('telegraph',x,y,radius,Math.max(.48,delay*.78),{owner:-1,damage,delay:true,...extra});}
    seismicRings(e,damage,phase){
      for(let ring=0;ring<phase;ring++){const radius=135+ring*125,count=8+ring*3;for(let i=0;i<count;i++){const a=i*Math.PI*2/count+ring*.35;this.markStrike(e.x+Math.cos(a)*radius,e.y+Math.sin(a)*radius,65,.95+ring*.35,damage*.65);}}
    }
    beginTeleport(e,target,windup=.75,damage=0,radius=105){
      this.effect('reinforcement',e.x,e.y,75,windup);
      this.beginMove(e,target,'blink',windup,.05,damage,radius);
    }
    whiskerAI(e,target,spec,damage,cycle){
      const phase=e.phase,mode=(cycle-1)%(phase===1?3:phase===2?4:6),a=Math.atan2(e.y-target.y,e.x-target.x),lead={x:target.x+(target.velocityX||0)*.45,y:target.y+(target.velocityY||0)*.45};
      const blinkTarget={x:target.x+Math.cos(a+cycle*.9)*250,y:target.y+Math.sin(a+cycle*.9)*250};
      if(mode===0){
        this.beginTeleport(e,blinkTarget,phase===4?.55:.8,damage*.85,105);
        this.fan(e,phase===4?21:15,damage*.55,245+phase*14,'enemy',Math.PI*2);
        if(phase>=2)this.markStrike(e.x,e.y,130,1.3,damage,{spawnHazard:phase>=3,hazardLife:2.8,color:'#c17da9'});
        if(phase===4)e.comboMoves=[{kind:'blink',target:{x:target.x-Math.cos(a)*220,y:target.y-Math.sin(a)*220},windup:.65,duration:.05,damage:damage*.8,radius:100}];
      }else if(mode===1){
        for(let i=0;i<3+phase;i++){const offset=(i-(2+phase)/2)*115;this.markStrike(lead.x+Math.cos(e.angle+1.57)*offset,lead.y+Math.sin(e.angle+1.57)*offset,85,1.1+i*.17,damage*.8,{spawnHazard:phase>=3&&i%2===0,hazardLife:2.4,color:'#d1948a'});}
        this.fan(e,3+phase,damage*.65,320,'rocket',1.25);
      }else if(mode===2){
        this.beginMove(e,lead,'charge',.8,.42,damage*1.35,120);
        this.seismicRings(e,damage*.75,phase>=3?3:2);
        if(phase>=2)e.comboMoves=[{kind:'skate',target:blinkTarget,windup:.45,duration:.45,damage:damage*.7,radius:75}];
      }else if(mode===3){
        const ox=e.x,oy=e.y;this.beginTeleport(e,{x:e.homeX+Math.cos(cycle)*340,y:e.homeY+Math.sin(cycle)*270},.7,damage*.7,100);
        for(let i=0;i<4+phase;i++){const angle=e.angle+(i-(3+phase)/2)*.17;this.effect('sniper',ox,oy,0,1+i*.16,{tx:ox+Math.cos(angle)*850,ty:oy+Math.sin(angle)*850,enemyId:e.id,damage:damage*.85});}
      }else if(mode===4){
        this.spawnReinforcement(e,0,31);this.spawnReinforcement(e,1,phase===4?32:30);
        for(const side of [-1,1])this.markStrike(lead.x+side*155,lead.y,110,1.3,damage*.75,{spawnHazard:true,slow:true,hazardLife:3.5,color:'#aa85bc'});
        this.fan(e,11+phase,damage*.5,315,'ice',2.3);
      }else{
        this.beginMove(e,lead,'slam',.9,.6,damage*1.45,205);
        for(let i=0;i<8;i++){const angle=i*Math.PI/4;this.markStrike(lead.x+Math.cos(angle)*280,lead.y+Math.sin(angle)*280,80,1.65+i*.07,damage*.7);}
        if(phase===4)e.comboMoves=[{kind:'blink',target:blinkTarget,windup:.65,duration:.05,damage:damage*.8,radius:105}];
      }
    }
    safeZoneAt(x,y){return this.world.safeZoneAt(x,y);}
    moveRicochet(e,angle,length,radius,damage,hitRadius,bounds=null){
      // Sweep in short segments: a fast roll must neither tunnel through a wall
      // nor miss a player between frames. Resolve each axis to preserve reflection.
      const blocked=(x,y)=>!!(bounds&&(x<bounds.minX||x>bounds.maxX||y<bounds.minY||y>bounds.maxY))||this.world.isBlocked(x,y,radius)||!!this.safeZoneAt(x,y)||!!this.pointLocked(x,y);
      const total=Math.max(0,Number.isFinite(length)?Math.min(length,8192):0),steps=Math.max(1,Math.ceil(total/8)),step=total/steps,hit=new Set();let travelled=0,bounces=0;
      let dx=Math.cos(angle),dy=Math.sin(angle);
      for(let i=0;i<steps&&step>0;i++){
        const ox=e.x,oy=e.y;let nx=ox+dx*step,ny=oy+dy*step;
        if(blocked(nx,ny)){
          const wallX=blocked(nx,oy),wallY=blocked(ox,ny);
          if(wallX||!wallY)dx=-dx;if(wallY||!wallX)dy=-dy;
          nx=ox+dx*step;ny=oy+dy*step;bounces++;
          this.effect('impact',ox,oy,radius+12,.2,{color:'#ffe1a1'});
          this.effect('chargeLane',ox,oy,hitRadius,.22,{tx:ox+dx*150,ty:oy+dy*150});
          if(blocked(nx,ny))break;
        }
        e.x=nx;e.y=ny;travelled+=step;
        for(const p of this.players){
          if(p.downed||hit.has(p)||bounds&&(p.x<bounds.minX-50||p.x>bounds.maxX+50||p.y<bounds.minY-50||p.y>bounds.maxY+50))continue;
          const sx=nx-ox,sy=ny-oy,t=clamp(((p.x-ox)*sx+(p.y-oy)*sy)/(sx*sx+sy*sy||1),0,1);
          if(Math.hypot(p.x-ox-sx*t,p.y-oy-sy*t)<hitRadius){hit.add(p);this.damagePlayer(p,damage,e);}
        }
      }
      angle=Math.atan2(dy,dx);e.angle=angle;e.rollAngle=angle;return{angle,travelled,bounces};
    }
    updateAdvancedEnemy(e,target,spec,dt){
      if(e.boss)return false;
      const role=spec.role,action=e.combatAction;
      if(action){
        action.timer-=dt;
        if(action.kind==='roll'){
          if(action.phase==='windup'&&action.timer<=0){action.phase='rolling';action.timer=action.length/900;e.combatState='rolling';e.rollAngle=action.angle;this.setAnim(e,'run');}
          else if(action.phase==='rolling'){
            const motion=this.moveRicochet(e,action.angle,900*Math.max(0,Math.min(dt,action.timer+dt)),23,action.damage,45);action.angle=motion.angle;action.bounces=(action.bounces||0)+motion.bounces;e.moveTime=(e.moveTime||0)+dt;
            if(action.timer<=0||motion.travelled<1){action.phase='recovery';action.timer=.7;e.combatState='recovery';this.setAnim(e,'land');this.text('DIZZY',e.x,e.y-48,'#ffe3a0');}
          }else if(action.phase==='recovery'){
            // A brief punish window follows the entire ricochet run.
            e.angle=action.angle+Math.sin(this.time*10)*.6;this.move(e,Math.cos(e.angle)*22*dt,Math.sin(e.angle)*22*dt,20);
            if(action.timer<=0){e.combatAction=null;e.combatState=null;e.fireTimer=.15;}
          }return true;
        }
        if(action.kind==='blink'){
          if(action.phase==='mark'&&action.timer<=0){
            if(this.world.isBlocked(action.tx,action.ty,20)||this.safeZoneAt(action.tx,action.ty)||this.pointLocked(action.tx,action.ty)){e.combatAction=null;e.combatState=null;e.fireTimer=1;return true;}
            this.effect('reinforcement',e.x,e.y,45,.3);e.x=action.tx;e.y=action.ty;this.effect('reinforcement',e.x,e.y,55,.35);action.phase='strike';action.timer=.36;e.combatState='strike';this.setAnim(e,'windup');
          }else if(action.phase==='strike'&&action.timer<=0){
            this.effect('enemySlash',e.x,e.y,action.radius,.3,{angle:e.angle});for(const p of this.players)if(!p.downed&&dist(e,p)<action.radius)this.damagePlayer(p,action.damage,e);
            action.phase='recovery';action.timer=.45;e.combatState='recovery';this.setAnim(e,'melee');
          }else if(action.phase==='recovery'&&action.timer<=0){
            if(action.second){const next=this.players.filter(p=>!p.downed&&!this.safeZoneAt(p.x,p.y)).sort((a,b)=>dist(e,a)-dist(e,b))[0];action.second=false;if(next&&dist(e,next)<650){action.phase='mark';action.timer=.65;action.tx=next.x;action.ty=next.y;e.combatState='windup';this.effect('telegraph',action.tx,action.ty,action.radius,1.01,{movement:true,color:'#cc99ff'});return true;}}
            e.combatAction=null;e.combatState=null;e.fireTimer=.75;
          }return true;
        }
      }
      if(!target||e.fireTimer>0||e.specialMove)return false;
      const d=dist(e,target),damage=this.enemyDamage(e,spec);
      if(role==='roller'&&d<780){const angle=Math.atan2(target.y-e.y,target.x-e.x),length=clamp(d*2.2,1450,1850),warning=Math.min(length,700);e.combatState='windup';e.rollAngle=angle;e.combatAction={kind:'roll',phase:'windup',timer:.52,angle,length,damage};this.effect('chargeLane',e.x,e.y,45,.52,{tx:e.x+Math.cos(angle)*warning,ty:e.y+Math.sin(angle)*warning});this.setAnim(e,'windup');return true;}
      if((role==='blinkstalker'||role==='voidknight'||role==='burrowrat')&&d<610){const radius=role==='burrowrat'?73:94;e.combatAction={kind:'blink',phase:'mark',timer:role==='burrowrat'?.8:.65,tx:target.x,ty:target.y,radius,damage,second:role==='voidknight'};e.combatState='windup';this.effect('telegraph',target.x,target.y,radius,1.01,{movement:true,color:role==='burrowrat'?'#c8ad87':'#cc99ff'});this.setAnim(e,'windup');return true;}
      if(role==='fencer'&&d<590){const a=Math.atan2(target.y-e.y,target.x-e.x),length=Math.min(560,d+70);this.beginMove(e,{x:e.x+Math.cos(a)*length,y:e.y+Math.sin(a)*length},'charge',.45,.25,damage*1.15,36);if(e.specialMove)e.specialMove.fencing=true;e.fireTimer=1.65;return true;}
      if(role==='cinderbeast'&&d<570){this.beginMove(e,target,'charge',.9,.58,damage*1.3,78);if(e.specialMove)e.specialMove.fireTrail=true;e.fireTimer=4.6;return true;}
      if(role==='venomrat'&&d<590){this.fan(e,7,damage*.7,310,'venom',1.15);this.markStrike(target.x+(target.velocityX||0)*.5,target.y+(target.velocityY||0)*.5,75,1.25,damage*.4,{spawnHazard:true,poison:true,hazardLife:3,color:'#b6d177'});e.fireTimer=2.8;this.setAnim(e,'shoot');return true;}
      if(role==='frostwarden'&&d<670){e.iceCycle=(e.iceCycle||0)+1;if(e.iceCycle%2){this.fan(e,12,damage*.55,255,'ice',Math.PI*2);}else {this.beginMove(e,target,'charge',.85,.45,damage,55);if(e.specialMove)e.specialMove.fencing=true;}e.fireTimer=3.2;return true;}
      return false;
    }
    fan(e,count,damage,speed,kind='enemy',arc=1.4){speed*=e.boss?1.35:1.2;for(let i=0;i<count;i++){const a=e.angle-arc/2+arc*(i/(arc>=Math.PI*2?count:count-1||1));this.bulletPool.take({x:e.x+Math.cos(a)*35,y:e.y+Math.sin(a)*35,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:3,damage,owner:-1,kind,radius:kind==='ice'?9:6,color:kind==='ice'?'#91e7f2':'#ffb18b'});}}
    specialEnemyAI(e,target,spec,role,d,dt){
      if(e.fireTimer>0)return;const damage=this.enemyDamage(e,spec);
      if((role==='leaper'||role==='duelist')&&d<95){this.setAnim(e,'melee');this.effect('enemySlash',e.x,e.y,85,.28,{angle:e.angle});this.effect('meleeWarning',target.x,target.y,75,.28,{enemyId:e.id,damage,owner:-1,sourceX:e.x,sourceY:e.y});e.fireTimer=.65;}
      else if(role==='leaper'&&d<650){this.beginMove(e,{x:target.x+(target.velocityX||0)*.4,y:target.y+(target.velocityY||0)*.4},'leap',.48,.36,damage*1.4,85);e.fireTimer=1.8;}
      else if(role==='bruiser'&&d<250){this.beginMove(e,{x:target.x,y:target.y},'slam',.9,.6,damage*1.5,130);e.fireTimer=4.5;}
      else if(role==='mortar'){for(let i=0;i<3;i++)this.effect('telegraph',target.x+(i-1)*100+(target.velocityX||0)*.3,target.y+Math.sin(i*2)*70,90,1.1+i*.2,{owner:-1,damage,delay:true});this.setAnim(e,'special');e.fireTimer=3.8;}
      else if(role==='sapper'){this.effect('telegraph',target.x,target.y,110,1.5,{delay:true,damage:damage*1.4,owner:-1});this.effect('hazard',e.x,e.y,65,5,{damage:damage*.6,tick:1,color:'#e5ad74'});this.setAnim(e,'special');e.fireTimer=4;}
      else if(role==='skirmisher'){this.fan(e,3,damage*.7,440,'enemy',.3);const a=e.angle+(e.id.length%2?1:-1)*Math.PI/2;this.beginMove(e,{x:e.x+Math.cos(a)*190,y:e.y+Math.sin(a)*190},'skate',.2,.32,0,40);e.fireTimer=2.4;}
      else if(role==='frost'){this.fan(e,7,damage*.6,300,'ice',1.2);this.setAnim(e,'special');e.fireTimer=2.6;}
      else if(role==='jammer'&&d<650){this.markStrike(target.x,target.y,135,1.1,damage*.5,{spawnHazard:true,jam:true,hazardLife:4,color:'#b083cf'});this.fan(e,3,damage*.5,250,'enemy',.8);this.setAnim(e,'special');e.fireTimer=5.2;}
      else if(role==='stormcaller'&&d<800){for(let i=0;i<3;i++)this.markStrike(target.x+(target.velocityX||0)*(.25+i*.2),target.y+(target.velocityY||0)*(.25+i*.2),65,.85+i*.35,damage*(i===2?1.1:.75),{color:'#c4a9f2'});this.setAnim(e,'special');e.fireTimer=4.4;}
      else if(role==='duelist'&&d<480){e.shieldTime=.4;this.beginMove(e,{x:target.x+(target.velocityX||0)*.2,y:target.y+(target.velocityY||0)*.2},'charge',.45,.24,damage*1.4,62);e.fireTimer=1.7;}
      else if(role==='hunter'&&d<700){this.fan(e,2,damage*.8,505,'enemy',.14);this.markStrike(target.x+(target.velocityX||0)*.5,target.y+(target.velocityY||0)*.5,75,1.35,damage*.55,{spawnHazard:true,slow:true,hazardLife:3,color:'#ccad78'});const a=e.angle+(e.id.length%2?1:-1)*1.57;this.beginMove(e,{x:e.x+Math.cos(a)*160,y:e.y+Math.sin(a)*160},'skate',.35,.4,0,40);e.fireTimer=3.9;}
      else if(role==='bombardier'&&d<850){for(let i=0;i<4;i++){const a=i*1.57;this.markStrike(target.x+Math.cos(a)*145,target.y+Math.sin(a)*145,95,1.1+i*.16,damage*.7,{spawnHazard:true,hazardLife:2.5,color:'#ef9e71'});}this.setAnim(e,'special');e.fireTimer=5.6;}
      else if(role==='bulwark'&&d<450){if(d>130)this.beginMove(e,target,'charge',.95,.65,damage*1.2,85);else{this.markStrike(e.x,e.y,130,.85,damage*1.15);this.setAnim(e,'melee');}e.shieldTime=.75;e.fireTimer=4.2;}
      if(e.fireTimer>0&&!/leaper|duelist/.test(role))e.fireTimer*=.72;
    }
    beginMove(e,target,kind,windup,duration,damage,radius){
      if(e.boss){windup=Math.max(.34,windup*.72);duration=Math.max(.05,duration*.78);}
      let tx=clamp(target.x,70,this.world.width-70),ty=clamp(target.y,70,this.world.height-70);
      if(!Number.isFinite(tx)||!Number.isFinite(ty))return;
      if(e.bossIndex===8){if(!this.berlinUnlocked())return;const sector=this.world.berlinSector||(W.Content.sectors||[]).find(s=>s.id==='berlin');if(sector){tx=clamp(tx,sector.x+95,sector.x+sector.w-95);ty=clamp(ty,sector.y+95,sector.y+sector.h-95);}}
      if(this.safeZoneAt(tx,ty)||this.pointLocked(tx,ty))return;
      const footprint=e.boss?34:20;
      if(this.world.isBlocked(tx,ty,footprint)){let found=false;for(let ring=1;ring<=3&&!found;ring++)for(let i=0;i<12;i++){const a=i*Math.PI/6,x=tx+Math.cos(a)*70*ring,y=ty+Math.sin(a)*70*ring;if(!this.world.isBlocked(x,y,footprint)&&!this.safeZoneAt(x,y)&&!this.pointLocked(x,y)&&(e.bossIndex!==8||!this.world.isFinalArena||this.world.isFinalArena(x,y))){tx=x;ty=y;found=true;break;}}if(!found){tx=e.x;ty=e.y;}}
      const length=Math.hypot(tx-e.x,ty-e.y),cap=e.boss?850:540;if(length>cap){tx=e.x+(tx-e.x)*cap/length;ty=e.y+(ty-e.y)*cap/length;}
      e.specialMove={kind,windup,duration,time:0,sx:e.x,sy:e.y,tx,ty,damage,radius,hit:false};this.setAnim(e,'windup');
      this.effect('telegraph',tx,ty,radius,windup+duration,{movement:true,color:kind==='blink'?'#d58bea':'#ff9d66'});
      if(kind==='charge')this.effect('chargeLane',e.x,e.y,radius,windup,{tx,ty});
    }
    updateSpecialMove(e,target,dt){
      const m=e.specialMove;if(!m)return false;
      if(this.pointLocked(e.x,e.y)||(e.bossIndex===8&&!this.berlinUnlocked())){e.specialMove=null;e.jumpHeight=0;return true;}
      if(m.windup>0){m.windup-=dt;e.anim='windup';return true;}
      m.time+=dt;const t=clamp(m.time/m.duration,0,1);e.angle=Math.atan2(m.ty-m.sy,m.tx-m.sx);e.anim=m.kind==='charge'||m.kind==='skate'?'run':'jump';
      e.moveTime=(e.moveTime||0)+dt;e.jumpHeight=m.kind==='leap'||m.kind==='slam'?Math.sin(t*Math.PI)*(e.boss?155:105):0;
      const nx=m.kind==='blink'?m.tx:m.sx+(m.tx-m.sx)*t,ny=m.kind==='blink'?m.ty:m.sy+(m.ty-m.sy)*t;
      if(this.pointLocked(nx,ny)){e.specialMove=null;e.jumpHeight=0;return true;}
      const oldX=e.x,oldY=e.y;
      if(m.kind==='blink'){e.x=nx;e.y=ny;this.effect('reinforcement',nx,ny,75,.4);}
      else if(e.jumpHeight>15){e.x=nx;e.y=ny;}else this.move(e,nx-e.x,ny-e.y,e.boss?32:17);
      if((m.kind==='charge'||m.kind==='skate')&&m.damage){const dx=e.x-oldX,dy=e.y-oldY;for(const p of this.players){const f=clamp(((p.x-oldX)*dx+(p.y-oldY)*dy)/(dx*dx+dy*dy||1),0,1);if(!p.downed&&Math.hypot(p.x-oldX-dx*f,p.y-oldY-dy*f)<(e.boss?65:40))this.damagePlayer(p,m.damage,e);}}
      if(m.fireTrail){m.trailTick=(m.trailTick||0)-dt;if(m.trailTick<=0){m.trailTick=.18;this.effect('hazard',e.x,e.y,42,2.2,{owner:-1,damage:m.damage*.22,fire:true,color:'#ed9a62',tick:.6});}}
      if(t>=1){
        if(this.world.isBlocked(e.x,e.y,e.boss?34:20)){let found=false;for(let ring=1;ring<=4&&!found;ring++)for(let i=0;i<12;i++){const a=i*Math.PI/6,x=m.tx+Math.cos(a)*ring*35,y=m.ty+Math.sin(a)*ring*35;if(!this.world.isBlocked(x,y,e.boss?34:20)&&!this.safeZoneAt(x,y)){e.x=x;e.y=y;found=true;break;}}if(!found){e.x=m.sx;e.y=m.sy;}}
        e.jumpHeight=0;e.specialMove=null;this.setAnim(e,'land');e.stun=m.fencing?.4:m.kind==='blink'?.35:e.boss?.18:.12;
        if(m.kind!=='skate'&&!m.fencing){this.explode(e.x,e.y,m.radius,m.damage,-1,'shockwave');if(e.boss&&e.bossIndex===0)this.fan(e,7,m.damage*.4,380,'enemy',1.1);if(e.boss&&e.bossIndex===2)this.fan(e,16,m.damage*.35,220,'enemy',Math.PI*2);}
        if(e.comboMoves?.length){const next=e.comboMoves.shift();this.beginMove(e,next.target,next.kind,next.windup,next.duration,next.damage,next.radius);}
      }return true;
    }
    spawnReinforcement(e,index,type=0) {
      if(this.world.activeEnemies.length>=W.config.maxEnemies)return;
      if(this.world.activeEnemies.filter(n=>alive(n)&&n.summonerId===e.id).length>=4)return;
      const spec=W.Content.enemies[type]||W.Content.enemies[0],id='reinforce-'+e.id+'-'+Math.round(this.time*1000)+'-'+index;
      const x=e.x+(index?100:-100),y=e.y+80;if(this.world.isBlocked(x,y,20)||this.safeZoneAt(x,y)||this.pointLocked(x,y))return;
      const enemy={id,x,y,hp:spec.hp*(1+(e.level||1)*.12),maxHp:spec.hp*(1+(e.level||1)*.12),type,level:e.level,angle:e.angle,anim:'run',animTime:0,state:'chase',homeX:e.x,homeY:e.y,locationId:null,region:e.region,alert:7,ephemeral:true,summonerId:e.id};
      if(this.world.addEnemy)this.world.addEnemy(enemy);else this.world.activeEnemies.push(enemy);
      this.effect('reinforcement',x,y,55,.7);
    }
    spawnTurret(e){
      if(this.world.activeEnemies.length>=W.config.maxEnemies)return;
      if(this.world.activeEnemies.filter(n=>alive(n)&&n.turret&&n.summonerId===e.id).length>=2)return;
      const x=e.x+Math.cos(e.angle+1.4)*70,y=e.y+Math.sin(e.angle+1.4)*70;if(this.world.isBlocked(x,y,20)||this.pointLocked(x,y)||this.safeZoneAt(x,y))return;
      const turret={id:'turret-'+e.id+'-'+Math.floor(this.time),x,y,hp:90,maxHp:90,type:3,level:e.level,angle:e.angle,anim:'idle',animTime:0,state:'attack',homeX:x,homeY:y,locationId:null,region:e.region,alert:30,ephemeral:true,turret:true,summonerId:e.id};
      if(this.world.addEnemy)this.world.addEnemy(turret);else this.world.activeEnemies.push(turret);
      this.effect('reinforcement',x,y,55,.7);
    }
    updateAllies(dt) {
      for(const a of this.allies){
        a.life-=dt;a.fire-=dt;a.animTime+=dt;const p=this.players[a.owner]||this.players[0];
        const e=this.grid.query(a.x,a.y,650).filter(alive).sort((b,c)=>dist(a,b)-dist(a,c))[0];
        if(e){a.angle=Math.atan2(e.y-a.y,e.x-a.x);if(a.fire<=0){a.fire=.35;this.bulletPool.take({x:a.x,y:a.y,vx:Math.cos(a.angle)*900,vy:Math.sin(a.angle)*900,damage:18*(1+p.level*.08),life:.8,owner:a.owner,kind:'bullet',radius:5});a.anim='shoot';}}
        else if(dist(a,p)>130){a.angle=Math.atan2(p.y-a.y,p.x-a.x);this.move(a,Math.cos(a.angle)*220*dt,Math.sin(a.angle)*220*dt);a.anim='run';}
      }this.allies=this.allies.filter(a=>a.life>0);
    }
    updateDrops(dt) {
      for(let i=this.drops.length-1;i>=0;i--){const d=this.drops[i];if(!d.reward)d.life-=dt;
        if(d.dismissed&&this.players.every(p=>dist(p,d)>110))d.dismissed=false;
        const p=this.players.find(p=>!p.downed&&dist(p,d)<(d.type==='equipment'?50:85));
        if(p&&!d.dismissed){if(this.collectDrop(d,p)!==false)this.drops.splice(i,1);if(this.paused)break;}else if(d.life<=0)this.drops.splice(i,1);
      }
      while(this.drops.length>180){const ordinary=this.drops.findIndex(d=>!d.reward);if(ordinary<0)break;this.drops.splice(ordinary,1);}
    }
    collectDrop(d,p) {
      if(d.choices?.length){this.openReward(d,p);return false;}
      if(d.type==='ammo')p.reserve=Math.min(1200,p.reserve+d.amount);
      if(d.type==='material')p.materials+=d.amount;
      if(d.type==='health')p.hp=Math.min(p.maxHp,p.hp+d.amount);
      if(d.type==='gold')p.gold+=d.amount;
      if(d.type==='equipment'){
        const item=W.Content.equipment.find(i=>i.id===d.item);if(item){let fresh=false;for(const recipient of d.reward?[...this.players,...(this.reservePlayer?[this.reservePlayer]:[])]:[p]){if(!recipient.inventory.some(i=>(i.id||i)===item.id)){recipient.inventory.push({id:item.id,upgrade:0});fresh=true;}else recipient.materials+=5;}if(fresh)this.revealItem(item,d.source);this.ui.toast(item.name+' recovered'+(d.reward?' · encounter treasure shared with your team':''),'loot');}
      }this.audio.play('pickup');
    }
    revealItem(item,source='Recovered equipment'){
      if(!item||item.slot==='consumable')return;
      this.itemReveals=this.itemReveals||[];
      this.itemReveals.push({id:item.id,name:item.name,rarity:item.rarity,type:item.slot,level:item.level,description:item.description,modifier:item.modifier,source,life:5,maxLife:5});
    }
    dropRewardChoice(itemIds,x,y,source,id,extra={}){
      const heroes=[...this.players,this.reservePlayer].filter(Boolean),items=[...new Set(itemIds)].filter(id=>W.Content.equipment.some(i=>i.id===id)&&!heroes.every(p=>p.inventory.some(i=>(i.id||i)===id)));
      if(!items.length)return null;
      const existing=this.drops.find(d=>d.id===id);if(existing)return existing;
      const drop={id,x,y,type:'equipment',item:items[0],choices:items,life:3600,reward:true,source,...extra};this.drops.push(drop);
      this.effect('level',x,y,85,1.2);this.ui.toast(source+' · choose one hard-earned reward','loot');return drop;
    }
    openReward(drop,p=this.players[0]){
      if(!drop?.choices?.length)return false;
      const heroes=[...this.players,this.reservePlayer].filter(Boolean);
      drop.choices=drop.choices.filter(id=>!heroes.every(p=>p.inventory.some(i=>(i.id||i)===id)));
      if(!drop.choices.length){for(const hero of heroes){hero.materials+=25;hero.cores=(hero.cores||0)+1;}this.drops.splice(this.drops.indexOf(drop),1);this.pendingReward=null;if(drop.dungeonId&&this.world.isDungeon)this.finishDungeonReward?.(this.world);this.ui.toast('All cache equipment already owned · 25 scrap and 1 core recovered','loot');this.checkQuests();this.save(false);return false;}
      drop.item=drop.choices[0];
      drop.dismissed=true;this.pendingReward={id:drop.id,source:drop.source,items:[...drop.choices]};this.ui.showMenu('reward',p.id);return true;
    }
    claimReward(itemId){
      const pending=this.pendingReward,drop=pending&&this.drops.find(d=>d.id===pending.id),item=W.Content.equipment.find(i=>i.id===itemId);
      if(!drop||!item||!drop.choices?.includes(itemId))return false;
      if([...this.players,this.reservePlayer].filter(Boolean).every(p=>p.inventory.some(i=>(i.id||i)===itemId))){this.openReward(drop);return false;}
      for(const p of [...this.players,this.reservePlayer].filter(Boolean)){if(!p.inventory.some(i=>(i.id||i)===itemId))p.inventory.push({id:itemId,upgrade:0});else p.materials+=5;}
      this.drops.splice(this.drops.indexOf(drop),1);this.pendingReward=null;this.revealItem(item,drop.source);this.audio.play('quest');
      if(drop.dungeonId&&this.world.isDungeon&&this.world.entry.id===drop.dungeonId)this.finishDungeonReward?.(this.world);
      this.ui.toast(item.name+' claimed · shared with your team','loot');this.checkQuests();this.save(false);return true;
    }
    dropReward(itemId,x,y,source='Encounter treasure'){
      const item=W.Content.equipment.find(i=>i.id===itemId);if(!item)return null;
      const drop={id:'reward-'+itemId+'-'+Math.round(this.time*1000)+'-'+this.drops.length,x,y,type:'equipment',item:item.id,life:3600,reward:true,source};this.drops.push(drop);
      this.effect('level',x,y,75,1.1);this.ui.toast(source+' · '+item.name+' dropped!','loot');return drop;
    }
    grantEnemyReward(e){
      if(e.dungeonBoss)return; // Dungeon treasure is awarded by the room's chest.
      const named=W.Content.quests.find(q=>['assassination','bounty'].includes(q.type)&&(Array.isArray(q.target)?q.target:[q.target]).includes(e.id));
      if(!e.boss&&!named)return;
      const key='reward-encounter:'+e.id,revision='commander-cache-v2:'+e.id;if(this.questCounters[key]&&(!e.boss||this.questCounters[revision]))return;this.questCounters[key]=1;if(e.boss)this.questCounters[revision]=1;
      const pool=e.boss?(W.Content.bossRewards[e.bossIndex]||[]):(W.Content.bossRewards[named.region]||[]).slice(0,2);
      const candidates=pool.map(id=>W.Content.equipment.find(i=>i.id===id)).filter(Boolean),heroes=[...this.players,this.reservePlayer].filter(Boolean);
      const pending=new Set([...this.drops,...(this.overworldDrops||[]),...Object.values(this.dungeonStates||{}).flatMap(state=>state.rewardDrops||[])].filter(d=>d.reward&&!d.choices).map(d=>d.item));
      const choices=candidates.filter(item=>!pending.has(item.id)&&!heroes.every(p=>p.inventory.some(entry=>(entry.id||entry)===item.id))).map(item=>item.id);
      this.dropRewardChoice(choices,e.x+35,e.y-12,e.boss?(W.Content.bosses[e.bossIndex]?.name||'Commander'):(named.targetName||e.name||'Named mission target'),'cache-'+e.id);
    }
    restoreCommanderRewards(){
      // Runs before cave restoration, so these persistent caches stay above ground.
      if(this.world.isDungeon)return 0;let count=0;
      for(const e of this.world._spawns.values())if(e.boss&&(this.world.dead.has(e.id)||this.world.liberated.has(e.locationId))&&!this.questCounters['commander-cache-v2:'+e.id]){const before=this.drops.length;this.grantEnemyReward(e);count+=this.drops.length-before;}
      if(count)this.ui.toast('Recovered commander caches await at your liberated strongholds.','loot');return count;
    }
    rollLoot(level,boss=false) {
      // Unique equipment comes only from its named enemies and dungeon chests.
      const list=W.Content.equipment.filter(i=>!i.rewardOnly&&!i.forgeOnly&&i.weapon==null&&i.slot!=='consumable'&&(i.level||1)<=level+2&&(i.level||1)>=Math.max(1,level-5));
      const rare=list.filter(i=>{const r=typeof i.rarity==='number'?i.rarity:rarityOrder.findIndex(r=>r.toLowerCase()===String(i.rarity).toLowerCase());return r>=(boss?2:0);});
      return (rare.length?rare:list)[Math.floor(Math.random()*(rare.length||list.length))]||W.Content.equipment[0];
    }
    awardXP(p,n){p.xp+=Math.round(n);while(p.xp>=p.xpNext){p.xp-=p.xpNext;p.level++;p.xpNext=Math.round(90*Math.pow(p.level,1.25));this.recalculate(p);p.hp=p.maxHp;p.skillPoints+=2;this.effect('level',p.x,p.y,110,1.5);this.ui.toast('Player '+(p.id+1)+' reached level '+p.level+' · 2 skill points earned','level');this.audio.play('level');}}
    nearTown(p){return this.world.locations.find(l=>(l.type==='town'||this.world.liberated.has(l.id))&&dist(p,l)<(l.radius||200)+80);}
    interact(p) {
      if(this.paused||p.downed)return;
      const fallen=this.players.find(q=>q!==p&&q.downed&&dist(p,q)<100);if(fallen){p.reviveTarget=fallen.id;this.ui.toast('Hold position to revive your teammate.');return;}
      const reward=this.drops.find(d=>d.choices?.length&&dist(d,p)<150);if(reward)return this.openReward(reward,p);
      const location=this.world.locations.filter(l=>dist(p,l)<(l.type==='town'?250:130)).sort((a,b)=>dist(p,a)-dist(p,b))[0];
      if(location){
        if(location.type==='forge'){this.shopLocation=location;this.shopPlayer=p.id;this.ui.showMenu('forge',p.id);return;}
        if(location.type==='npc'){this.npcLocation=location;this.shopPlayer=p.id;this.ui.showMenu('dialogue',p.id);this.audio.vocal?.('cat_greet',location,this,{allowMenu:true});return;}
        if(location.type==='town'||this.world.liberated.has(location.id)){
          for(const q of this.players)if(!q.downed){q.hp=q.maxHp;q.reserve=Math.max(q.reserve,240);q.grenades=Math.max(q.grenades,5);q.medkits=Math.max(q.medkits,3);}
          this.shopLocation=location;this.shopPlayer=p.id;this.ui.showMenu('shop');this.audio.play('heal');this.audio.vocal?.('cat_greet',location,this,{allowMenu:true});return;
        }
        if(location.type==='cache'||location.type==='cave'){
          if(this.questStats.caches.has(location.id)){this.ui.toast('This cache has already been recovered.');return;}
          if(this.world.activeEnemies.some(e=>alive(e)&&dist(e,location)<150)){this.ui.toast('Clear the guards before opening this cache.');return;}
          this.questStats.caches.add(location.id);this.world.liberated.add(location.id);location.cleared=true;
          p.gold+=60+(location.level||p.level)*15;p.materials+=10;p.cores=(p.cores||0)+1;const item=this.rollLoot(location.level||p.level,true);
          if(item){if(!p.inventory.some(i=>(i.id||i)===item.id)){p.inventory.push({id:item.id,upgrade:0});this.revealItem(item,'Supply cache');}else p.materials+=5;this.ui.toast('Cache recovered: '+item.name,'loot');}
          this.awardXP(p,80+p.level*12);this.audio.play('quest');this.effect('level',location.x,location.y,100,1);this.checkQuests();this.save(false);return;
        }
      }
      const drop=this.drops.find(d=>dist(d,p)<150);if(drop){if(this.collectDrop(drop,p)!==false)this.drops.splice(this.drops.indexOf(drop),1);return;}
      this.ui.toast('Approach a quartermaster, cache, or fallen teammate to interact.');
    }
    updateLocations(dt) {
      for(const l of this.world.locations){
        if(this.world.liberated.has(l.id)||!['base','boss','convoy','prison'].includes(l.type))continue;
        if(l.type==='boss'){
          if(!this.pointLocked(l.x,l.y)&&this.world.dead.has(l.id+'_commander'))this.completeBoss({locationId:l.id,boss:true,bossIndex:l.bossIndex??l.region,x:l.x,y:l.y});
          continue;
        }
        if(!this.players.some(p=>dist(p,l)<(l.radius||280)+300))continue;
        const ids=l.enemyIds||[];
        const allDead=ids.length>0?ids.every(id=>this.world.dead.has(id)):false;
        if(allDead){
          this.world.liberated.add(l.id);l.cleared=true;this.questStats.rescued.add(l.id);this.questStats.convoys.add(l.id);
          for(const p of this.players){p.gold+=l.type==='boss'?350:110;p.materials+=l.type==='boss'?25:8;this.awardXP(p,l.type==='boss'?400:150);}
          this.effect('level',l.x,l.y,220,2);this.ui.toast(l.name+' liberated! Quartermaster and travel point unlocked.','quest');this.audio.play('quest');
          this.checkQuests();this.save(false);
        }
      }
      const final=this.finalBossLocation();
      if(final&&this.bossDefeated(final)&&this.berlinUnlocked()&&!this.campaignWon)this.winCampaign();
    }
    majorBosses(){return this.world.locations.filter(l=>l.type==='boss'&&!l.finalBoss&&!l.final&&l.bossIndex!==8&&l.id!=='boss_berlin');}
    bossDefeated(l){return !!l&&(this.world.liberated.has(l.id)||this.world.dead.has(l.id+'_commander'));}
    defeatedMajorBosses(){return this.majorBosses().filter(l=>this.bossDefeated(l));}
    berlinUnlocked(){const bosses=this.majorBosses();return bosses.length>=8&&bosses.every(l=>this.bossDefeated(l));}
    finalBossLocation(){return this.world.locations.find(l=>l.type==='boss'&&(l.finalBoss||l.final||l.bossIndex===8||l.id==='boss_berlin'));}
    pointLocked(x,y){return !!(this.world.isPointLocked?this.world.isPointLocked(x,y):this.world.gateAt?.(x,y));}
    completeBoss(e){
      const l=this.world.locations.find(l=>l.id===e.locationId);if(!l||this.world.liberated.has(l.id))return;
      const final=l.finalBoss||l.final||e.bossIndex===8;if(final&&!this.berlinUnlocked())return;
      const wasUnlocked=this.majorBosses().filter(b=>this.world.liberated.has(b.id)).length>=8;this.world.liberated.add(l.id);l.cleared=true;
      for(const p of this.players){p.gold+=final?1500:350;p.materials+=final?60:25;this.awardXP(p,final?2000:400);}
      this.effect('level',l.x,l.y,220,2);
      if(final){this.ui.toast('Adolph Whisker defeated. Berlin is free!','quest');this.winCampaign();}
      else{
        this.ui.toast((W.Content.bosses[e.bossIndex]?.name||l.name)+' defeated · '+this.defeatedMajorBosses().length+' / 8 commanders.','quest');
        if(!wasUnlocked&&this.berlinUnlocked()){this.ui.toast('BERLIN UNLOCKED · All eight commanders are defeated. Adolph Whisker awaits in the Berlin sector.','quest');const target=this.finalBossLocation();if(target)this.marker={x:target.x,y:target.y};}
      }
      this.checkQuests();this.save(false);
    }
    winCampaign(){if(this.campaignWon)return;this.campaignWon=true;this.ui.toast('OPERATION WHISKERFALL COMPLETE · Adolph Whisker has fallen.','quest');this.ui.showMenu('victory');this.save(false);}
    questProgress(id) {
      const q=typeof id==='object'?id:W.Content.quests.find(q=>q.id===id);if(!q)return{current:0,required:1,complete:false,available:false};
      const target=q.target,required=q.required||1;let current=0;
      const targets=Array.isArray(target)?target:[target];
      if(['liberate','boss','rescue','convoy'].includes(q.type))current=targets.reduce((n,t)=>n+(this.world.liberated.has(t)?1:0),0);
      else if(q.type==='kill')current=q.region!=null?(this.questCounters['kills:'+q.region]||0):this.questStats.kills;
      else if(q.type==='explore')current=targets.reduce((n,t)=>n+(this.world.discovered.has(t)||this.questStats.explored.has(t)||this.questStats.explored.has(Number(t))?1:0),0);
      else if(q.type==='cache')current=targets.reduce((n,t)=>n+(this.questStats.caches.has(t)?1:0),0);
      const available=!q.prerequisite||this.completedQuests.has(q.prerequisite);
      return{current:Math.min(current,required),required,complete:this.completedQuests.has(q.id),available,accepted:this.acceptedQuests.has(q.id),ready:current>=required};
    }
    acceptQuest(id) {
      const q=W.Content.quests.find(q=>q.id===id);if(!q||!this.questProgress(q).available)return false;
      if(this.completedQuests.has(id))return true;
      const accepted=this.acceptedQuests.has(id);
      if(!accepted&&!this.canAcceptQuestFromNpc?.(q)){this.ui.toast('Speak with '+(this.questContact?.(q)?.name||'the quest giver')+' to accept this assignment.','quest');return false;}
      this.acceptedQuests.add(id);this.trackedQuest=id;if(!accepted)this.ui.toast('Mission accepted: '+q.title,'quest');this.checkQuests();return true;
    }
    acceptAvailable(){
      // Keep saved assignments intact; selecting a lead never accepts it.
      if(!this.trackedQuest||this.completedQuests.has(this.trackedQuest)){
        const q=W.Content.quests.find(q=>this.acceptedQuests.has(q.id)&&!this.completedQuests.has(q.id))||W.Content.quests.find(q=>q.main&&this.questProgress(q).available&&!this.completedQuests.has(q.id));
        this.trackedQuest=q?q.id:null;
      }
    }
    checkQuests() {
      this.acceptAvailable();let changed=false;
      const finished=[];
      for(const q of W.Content.quests){if(this.completedQuests.has(q.id)||!this.acceptedQuests.has(q.id))continue;const prog=this.questProgress(q);if(!prog.available||!prog.ready)continue;
        // World progress is remembered, but only spoken-for assignments pay rewards.
        this.completedQuests.add(q.id);this.acceptedQuests.add(q.id);changed=true;
        finished.push(q);
        for(const p of this.players){p.gold+=q.rewardGold||100;this.awardXP(p,q.rewardXp||80);}
        this.ui.toast('Mission complete: '+q.title+' · +'+(q.rewardGold||100)+' gold','quest');this.audio.play('quest');
      }
      if(changed){const tracked=finished.find(q=>q.id===this.trackedQuest);if(tracked)this.followQuestContact?.(tracked);this.acceptAvailable();this.save(false);}
    }
    trackQuest(id){if(!this.questProgress(id).available)return;this.trackedQuest=id;this.acceptedQuests.add(id);const q=W.Content.quests.find(q=>q.id===id);if(q){const target=Array.isArray(q.target)?q.target[0]:q.target;const l=this.world.locations.find(l=>l.id===target);if(l)this.marker={x:l.x,y:l.y};}this.ui.toast('Mission tracked');}
    equip(playerIndex,itemId,slotOverride) {
      const p=this.players[playerIndex]||this.players[0];const item=typeof itemId==='object'?itemId:W.Content.equipment.find(i=>i.id===itemId);
      if(!item||!p.inventory.some(i=>(i.id||i)===item.id)){this.ui.toast('Recover or purchase this equipment first.');return false;}
      if(p.level<(item.level||1)){this.ui.toast('Requires level '+item.level);return false;}
      const slot=String(item.slot||'accessory').toLowerCase();
      if(slot==='consumable'){if(item.id==='medkit'){p.medkits++;}else if(item.id==='ammo_crate')p.reserve=Math.min(1200,p.reserve+120);p.inventory.splice(p.inventory.findIndex(i=>(i.id||i)===item.id),1);this.ui.toast(item.name+' added to field supplies');this.save(false);return true;}
      if(item.weapon!=null||/firearm|main|gun|secondary/.test(slot)){
        let index=typeof item.weapon==='number'?item.weapon:W.Content.weapons.findIndex(w=>w.id===item.weapon);if(index<0)index=0;
        if(slotOverride==='secondary'){p.secondary=index;this.ui.toast(item.name+' assigned as secondary firearm','loot');this.save(false);return true;}
        p.reserve+=p.ammo;p.weapon=index;p.magSize=this.weapon(p).magazine||12;p.ammo=Math.min(p.magSize,p.reserve);p.reserve-=p.ammo;p.reloading=0;p.upgrade=p.weaponUpgrades[index]||0;p.charge=0;p.burstQueue=[];
      }else if(item.melee!=null||slot==='melee')p.melee=typeof item.melee==='number'?item.melee:Math.max(0,W.Content.melee.findIndex(w=>w.id===item.melee));
      else if(slot==='ability'||item.ability!=null)return this.equipAbility(playerIndex,typeof item.ability==='number'?item.ability:0,slotOverride==='ability2'?'ability2':'ability');
      else {p.equipment[slot]=item;p[slot]=W.Content.equipment.indexOf(item);this.recalculate(p);}
      this.recalculate(p);this.ui.toast(item.name+' equipped','loot');this.audio.play('ui');this.save(false);return true;
    }
    equipAbility(playerIndex,index,slot='ability'){const p=this.players[playerIndex]||this.players[0],a=W.Content.abilities[index];if(!a||p.level<(a.level||1)){this.ui.toast('Reach level '+(a&&a.level||1)+' to unlock this ability.');return false;}p[slot==='ability2'?'ability2':'ability']=index;this.ui.toast(a.name+' equipped');this.save(false);return true;}
    recalculate(p){
      const base=140+(p.level-1)*14;let health=(p.armorSet||0)*34+(p.armorRank||0)*12,damage=0,armor=(p.armorSet||0)*.08+(p.armorRank||0)*.022;p.perks={};
      // Saved equipped objects are snapshots; use current catalogue stats when available.
      for(const [slot,item]of Object.entries(p.equipment||{}))if(item?.id){const current=W.Content.equipment.find(i=>i.id===item.id);if(current)p.equipment[slot]=current;}
      const active=[...Object.values(p.equipment),W.Content.equipment.find(i=>i.weapon===p.weapon),W.Content.equipment.find(i=>i.melee===p.melee)].filter(Boolean);
      for(const item of active){health+=item.health||0;damage+=item.damage||0;armor+=item.armor||0;if(item.modifier)p.perks[item.modifier]=true;if(item.healOnKill)p.perks.healOnKill=true;}
      if(p.weaponTunes?.[p.weapon]?.active==='tactical'){const kind=this.weapon(p).kind,perk={pistol:'ricochet',smg:'chain',lmg:'chain',rifle:'pierce',sniper:'pierce',shotgun:'burn',rocket:'homing',plasma:'shock',flame:'areaDamage'}[kind];if(perk)p.perks[perk]=true;}
      p.maxHp=base+health;p.hp=Math.min(p.hp,p.maxHp);p.damageBonus=damage;p.armorBonus=clamp(armor,0,.72);
    }
    tuneWeapon(playerIndex,mode){
      const p=this.players[playerIndex]||this.players[0];if(!['power','rapid','tactical'].includes(mode))return false;
      if(!this.nearForge(p)){this.ui.toast('Visit the forge to tune a firearm.');return false;}
      if((p.weaponUpgrades[p.weapon]||0)<3){this.ui.toast('Upgrade this firearm to rank +3 before tuning it.');return false;}
      p.weaponTunes=p.weaponTunes||{};const tune=p.weaponTunes[p.weapon]||(p.weaponTunes[p.weapon]={unlocked:[],active:null});
      if(!tune.unlocked.includes(mode)){if(p.gold<400||p.materials<18||(p.cores||0)<1){this.ui.toast('Tuning costs 400 gold, 18 scrap and 1 commander core.');return false;}p.gold-=400;p.materials-=18;p.cores--;tune.unlocked.push(mode);}
      tune.active=mode;this.recalculate(p);this.ui.toast(mode+' tuning installed','loot');this.audio.play('level');this.save(false);return true;
    }
    bossVictories(){return this.defeatedMajorBosses().length;}
    shopInventory(location=this.shopLocation){
      const p=this.players[this.shopPlayer||0]||this.players[0];
      if(!location)location=this.world.locations.filter(l=>l.type==='town'||l.type==='shop'||l.type==='forge').sort((a,b)=>dist(p,a)-dist(p,b))[0];
      const r=clamp(Number(location?.region??this.world.regionAt(location?.x??p.x,location?.y??p.y)?.index)||0,0,7),hash=Array.from(String(location?.id||'town')).reduce((n,c)=>n+c.charCodeAt(0),0),variant=hash%3;
      const guns=[['field_pistol','woodland_carbine','trench_scattergun'],['woodland_carbine','foxguard'],['peakwatch','foxguard'],['snowshoe','peakwatch'],['suncatcher','snowshoe'],['reedrunner','suncatcher'],['emberline','reedrunner'],['liberator','emberline']][r];
      const ids=['medkit','ammo_crate',...guns,(['armor_','vest_','coat_'][variant])+r,(variant===1?'cap_':'helmet_')+r,'melee_'+Math.min(15,r*2+variant%2),'accessory_'+Math.min(31,r*4+variant)];
      // Remote traders have a tighter supply line than the regional quartermaster.
      if(location?.type==='forge')ids.splice(2,Math.max(0,guns.length-1));
      return ids.map(id=>W.Content.equipment.find(i=>i.id===id)).filter(i=>i&&!i.rewardOnly);
    }
    itemPrice(item){return item.weapon!=null&&item.weapon!==0?1200+(item.price||100)*8:item.price||0;}
    gunCoreCost(item){return item.weapon!=null&&item.weapon!==0?2+Math.floor((item.level||1)/6):0;}
    equipmentRequirement(item,p){
      if(item.rewardOnly)return 'Encounter reward · '+(item.rewardSource||'Defeat its guardian to recover it');
      if((p.level||1)<(item.level||1))return 'Requires hero level '+item.level;
      if(item.weapon!=null&&item.weapon!==0){const gun=W.Content.weapons[item.weapon],min={pistol:1,smg:1,rifle:1,shotgun:2,sniper:3,lmg:4,rocket:5,flame:6,plasma:7};const bosses=Math.max(min[gun.kind]||1,Math.floor(((item.level||1)-1)/4));
        if(this.bossVictories()<bosses)return 'Blueprint locked · defeat '+bosses+' regional commander'+(bosses===1?'':'s');
        if((p.cores||0)<this.gunCoreCost(item))return 'Requires '+this.gunCoreCost(item)+' rare commander cores';
      }return '';
    }
    buy(playerIndex,itemId) {
      const p=this.players[playerIndex]||this.players[0],item=W.Content.equipment.find(i=>i.id===itemId);if(!item)return false;
      if(item.rewardOnly||!this.shopInventory().some(i=>i.id===item.id)){this.ui.toast(item.rewardOnly?'Earn this treasure from '+item.rewardSource:'This quartermaster does not stock that item.');return false;}
      if(item.slot!=='consumable'&&p.inventory.some(i=>(i.id||i)===item.id)){this.ui.toast('You already own this equipment.');return false;}
      const reason=this.equipmentRequirement(item,p);if(reason){this.ui.toast(reason);return false;}
      const cost=this.itemPrice(item);if(p.gold<cost){this.ui.toast('More gold needed.');return false;}
      p.gold-=cost;p.cores=Math.max(0,(p.cores||0)-this.gunCoreCost(item));p.inventory.push({id:item.id,upgrade:0});this.revealItem(item,'Quartermaster purchase');this.ui.toast(item.name+' recovered','loot');this.audio.play('pickup');this.save(false);return true;
    }
    nearForge(p){return this.world.locations.find(l=>l.type==='forge'&&dist(p,l)<180);}
    upgrade(playerIndex=0){const p=this.players[playerIndex]||this.players[0],tier=p.weaponUpgrades[p.weapon]||0,cost=80+75*tier,mats=5+3*tier,cores=tier===5||tier===9?1:0;
      if(!this.nearForge(p)){this.ui.toast('Visit a peaceful settlement forge to upgrade equipment.');return false;}
      if(tier>=10){this.ui.toast('This firearm is fully upgraded.');return false;}if(p.gold<cost||p.materials<mats||(p.cores||0)<cores){this.ui.toast('Upgrade costs '+cost+' gold, '+mats+' scrap'+(cores?' and 1 commander core':'')+'.');return false;}
      p.gold-=cost;p.materials-=mats;p.cores-=cores;p.upgrade=tier+1;p.weaponUpgrades[p.weapon]=p.upgrade;this.ui.toast('Firearm upgraded to +'+p.upgrade+' · +12% damage','loot');this.audio.play('level');this.save(false);return true;}
    upgradeArmor(playerIndex=0){const p=this.players[playerIndex]||this.players[0],rank=p.armorRank||0,cost=90+65*rank,mats=6+4*rank,cores=rank===4||rank===8?1:0;
      if(!this.nearForge(p)){this.ui.toast('Visit a forge to strengthen your armor.');return false;}
      if(rank>=10){this.ui.toast('Armor is fully reinforced.');return false;}if(p.gold<cost||p.materials<mats||(p.cores||0)<cores){this.ui.toast('Armor reinforcement costs '+cost+' gold, '+mats+' scrap'+(cores?' and 1 core':'')+'.');return false;}
      p.gold-=cost;p.materials-=mats;p.cores-=cores;p.armorRank=rank+1;this.recalculate(p);this.ui.toast('Armor reinforced to +'+p.armorRank+' · defense and health improved','loot');this.audio.play('level');this.save(false);return true;}
    forgeArmor(playerIndex,setIndex){const p=this.players[playerIndex]||this.players[0];setIndex=clamp(Number(setIndex)||0,0,2);p.unlockedArmorSets=p.unlockedArmorSets||[0];
      if(!this.nearForge(p)){this.ui.toast('Visit a forge to change armor sets.');return false;}
      if(!p.unlockedArmorSets.includes(setIndex)){
        const bosses=setIndex===1?2:5,cost=setIndex===1?900:2400,mats=setIndex===1?60:120,cores=setIndex===1?4:8;
        if(this.bossVictories()<bosses){this.ui.toast('Defeat '+bosses+' regional commanders to recover this armor pattern.');return false;}
        if(p.gold<cost||p.materials<mats||(p.cores||0)<cores){this.ui.toast('Pattern requires '+cost+' gold, '+mats+' scrap and '+cores+' commander cores.');return false;}
        p.gold-=cost;p.materials-=mats;p.cores-=cores;p.unlockedArmorSets.push(setIndex);
      }
      p.armorSet=setIndex;this.recalculate(p);this.ui.toast(['Scout','Ranger','Vanguard'][setIndex]+' armor equipped','loot');this.audio.play('level');this.save(false);return true;
    }
    spendSkill(playerIndex,branch){const p=this.players[playerIndex]||this.players[0];branch=String(branch).toLowerCase();if(!branches.includes(branch)||p.skillPoints<=0||(p.skills[branch]||0)>=10)return false;p.skills[branch]=(p.skills[branch]||0)+1;p.skillPoints--;this.ui.toast(branch+' training improved');this.save(false);return true;}
    useConsumable(p){if(typeof p==='number')p=this.players[p];p=p||this.players[0];if(p.downed||p.medkits<=0){this.ui.toast('No field dressings available.');return false;}if(p.hp>=p.maxHp)return false;p.medkits--;p.hp=Math.min(p.maxHp,p.hp+p.maxHp*.55);this.effect('heal',p.x,p.y,80,1);this.audio.play('heal');this.audio.vocal?.('cat_purr',p,this);return true;}
    setMarker(x,y){this.marker={x:clamp(x,0,this.world.width),y:clamp(y,0,this.world.height)};this.audio.play('ui');}
    fastTravel(id){const l=this.world.locations.find(l=>l.id===id);if(!l||!(l.type==='town'||this.world.liberated.has(l.id)))return false;
      if(!this.players.every(p=>this.safeZoneAt(p.x,p.y))&&this.world.activeEnemies.some(e=>alive(e)&&this.players.some(p=>dist(p,e)<500&&e.state!=='patrol'))){this.ui.toast('Escape combat before travelling.');return false;}
      const r=this.world.regionAt(l.x,l.y);if(!this.questStats.explored.has(r.id)){this.ui.toast('Discover this region on foot first.');return false;}
      this.players.forEach((p,i)=>{p.x=l.x+i*55;p.y=l.y+100;p.hp=p.maxHp;p.downed=false;p.invuln=2;});this.camera.x=l.x;this.camera.y=l.y;this.ui.hideMenu();this.ui.toast('Travelled to '+l.name);this.save(false);return true;}
    dynamicEvent(){
      const p=this.players[0],r=this.world.regionAt(p.x,p.y);if(this.nearTown(p)||this.world.activeEnemies.length>120)return;
      const a=Math.random()*Math.PI*2,x=clamp(p.x+Math.cos(a)*670,150,this.world.width-150),y=clamp(p.y+Math.sin(a)*670,150,this.world.height-150);
      const convoy=Math.random()>.5;
      const count=r.index===0?2:r.index<3?3:4,pool=r.index===0?[20,36]:r.index<3?[38,39,24]:r.index<5?[37,42,36]:r.index<7?[40,41,37]:[43,42,40,18];
      for(let i=0;i<count;i++){const ex=x+i*85,ey=y+i*55;if(this.world.isBlocked(ex,ey,20)||this.pointLocked(ex,ey)||this.safeZoneAt(ex,ey))continue;const e={id:'event-'+Math.floor(this.time)+'-'+i,x:ex,y:ey,homeX:ex,homeY:ey,type:pool[i%pool.length],level:r.level||1,region:r.id,angle:a+Math.PI,anim:'run',animTime:0,state:'investigate',alert:8,investigateX:p.x,investigateY:p.y,ephemeral:true};const s=W.Content.enemies[e.type];e.hp=e.maxHp=s.hp*(1+e.level*.12);if(this.world.addEnemy)this.world.addEnemy(e);else this.world.activeEnemies.push(e);}
      this.ui.toast(convoy?'A mouse supply patrol is nearby. Defeat it for ammunition and scrap.':'Resistance radio: enemy reinforcements on the road.','event');
      this.effect('text',x,y-45,0,4,{text:convoy?'SUPPLY PATROL':'REINFORCEMENTS',color:'#ffcf89'});
    }
    defeat(){
      if(this.respawnAtCheckpoint)return this.respawnAtCheckpoint();
      const p=this.players[0];const towns=this.world.locations.filter(l=>l.type==='town'||this.world.liberated.has(l.id));
      const town=towns.sort((a,b)=>dist(p,a)-dist(p,b))[0]||{x:1100,y:1100,name:'Bramble Camp'};
      for(const q of this.players){q.x=town.x+q.id*50;q.y=town.y+100;q.hp=q.maxHp;q.downed=false;q.revive=0;q.gold=Math.floor(q.gold*.95);q.ammo=this.weapon(q).magazine;q.reserve=Math.max(q.reserve,120);q.invuln=4;}
      for(const b of this.projectiles)b.alive=false;for(const e of this.effects)if(e.owner===-1)e.alive=false;
      for(const e of this.world.activeEnemies)if(e.bossIndex===8&&alive(e)){e.hp=e.maxHp;e.x=e.homeX;e.y=e.homeY;e.phase=1;e.specialTimer=3;e.fireTimer=2;e.specialMove=null;e.comboMoves=[];e.jumpHeight=0;e.burn=0;e.bleed=0;}
      for(const q of this.players){q.meleeStrike=null;q.meleeCommit=0;q.jamTime=0;}
      this.camera.x=p.x;this.camera.y=p.y;this.ui.toast('Rescued at '+town.name+' · the resistance used 5% of your gold for supplies.','event');this.save(false);
    }
    updateCamera(dt){const active=this.players.filter(p=>!p.downed),list=active.length?active:this.players;const x=list.reduce((a,p)=>a+p.x,0)/list.length,y=list.reduce((a,p)=>a+p.y,0)/list.length;
      const distance=list.length>1?dist(list[0],list[1]):0,target=clamp(1.12-distance/1800,.62,1.12);
      const smooth=1-Math.exp(-dt*5);this.camera.x+=(x-this.camera.x)*smooth;this.camera.y+=(y-this.camera.y)*smooth;this.camera.zoom+=(target-this.camera.zoom)*smooth;this.camera.shake=Math.max(0,this.camera.shake-dt*35);
    }
    restorePlayerPosition(p){
      const start=this.world.start||{x:1100,y:1100};
      if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||this.pointLocked(p.x,p.y)){p.x=start.x;p.y=start.y;return;}
      if(!this.world.isBlocked(p.x,p.y,19))return;
      const ox=p.x,oy=p.y;for(let ring=1;ring<=18;ring++)for(let i=0;i<16;i++){const a=i*Math.PI/8,x=clamp(ox+Math.cos(a)*ring*24,30,this.world.width-30),y=clamp(oy+Math.sin(a)*ring*24,30,this.world.height-30);if(!this.world.isBlocked(x,y,19)&&!this.pointLocked(x,y)){p.x=x;p.y=y;return;}}
      p.x=start.x;p.y=start.y;
    }
    snapshot(){return{version:1,name:'Resistance campaign',slot:this.slot,savedAt:new Date().toISOString(),playTime:this.playTime,time:this.time,players:this.players,reservePlayer:this.reservePlayer,rewardDrops:this.drops.filter(d=>d.reward),world:this.world.exportState(),completedQuests:[...this.completedQuests],acceptedQuests:[...this.acceptedQuests],questCounters:this.questCounters,questStats:{kills:this.questStats.kills,explored:[...this.questStats.explored],caches:[...this.questStats.caches],rescued:[...this.questStats.rescued],convoys:[...this.questStats.convoys]},kills:this.kills,trackedQuest:this.trackedQuest,marker:this.marker,campaignWon:!!this.campaignWon,region:this.world.regionAt(this.players[0]?.x||this.world.start.x,this.players[0]?.y||this.world.start.y)?.name};}
    save(show=true){
      let ok=false,reason='The current campaign could not be saved.';
      try{if(this.players.length)ok=W.Save.write(this.slot,this.snapshot());}catch(error){reason='The current campaign could not be prepared for saving.';console.error(error);}
      const stored=W.Save.status?.(this.slot),status=ok?(stored||{state:W.Save.temporary?'temporary':'saved',savedAt:Date.now(),reason:''}):{state:'error',savedAt:stored?.savedAt||0,reason:stored?.state==='error'&&stored.reason?stored.reason:reason};
      this.lastSaveStatus={...status,slot:this.slot};
      const noticeKey=this.slot+':'+status.state,changed=this._saveNoticeState!==noticeKey;this._saveNoticeState=noticeKey;
      if(show||status.state!=='saved'&&changed){
        const message=status.state==='saved'?'Campaign saved in this browser · slot '+(this.slot+1)+'.':status.state==='temporary'?'Progress is kept only in this tab. Export a backup from Settings before reloading or closing the game.':'Saving failed. '+status.reason+' Keep this game open and try again.';
        this.ui.toast(message,status.state==='saved'?'success':'error');
      }
      return ok;
    }
    load(slot=0){const data=W.Save.read(slot);if(!data||!Array.isArray(data.players)||!data.players.length)return false;
      this.audio.resetAnimals?.();
      if(W.World.migrateSaveCoordinates)W.World.migrateSaveCoordinates(data);
      this.slot=slot;this.world=new W.World(W.config.seed);this.world.importState(data.world||{});this.players=data.players.slice(0,2).map((p,i)=>Object.assign(this.newPlayer(i,p.skin||0),p,{id:i,downed:!!p.downed||p.hp<=0,invuln:2}));
      this.reservePlayer=data.reservePlayer||null;this.completedQuests=new Set(data.completedQuests||[]);this.acceptedQuests=new Set(data.acceptedQuests||[]);this.questCounters=data.questCounters||{};
      const s=data.questStats||{};this.questStats={kills:s.kills||0,explored:new Set(s.explored||[]),caches:new Set(s.caches||[]),rescued:new Set(s.rescued||[]),convoys:new Set(s.convoys||[])};
      this.kills=data.kills||0;this.time=data.time||0;this.playTime=data.playTime||0;this.trackedQuest=data.trackedQuest;this.marker=data.marker;this.campaignWon=!!data.campaignWon&&this.bossDefeated(this.finalBossLocation());
      this.bulletPool.reset();this.effectPool.reset();this.particlePool.reset();this.drops=(data.rewardDrops||[]).filter(d=>d.reward&&W.Content.equipment.some(i=>i.id===d.item));this.allies=[];this.itemReveals=[];this.pendingReward=null;this.travelInteractUntil=0;this.camera={x:this.players[0].x,y:this.players[0].y,zoom:1,shake:0};
      for(const p of this.players){p.hp=p.downed?0:Math.max(1,p.hp);p.reloading=Math.max(0,p.reloading||0);p.meleeStrike=null;p.meleeCommit=0;p.burstQueue=[];this.restorePlayerPosition(p);this.recalculate(p);}
      this.lastSaveStatus={...(W.Save.status?.(slot)||{state:W.Save.temporary?'temporary':'saved',savedAt:0,reason:''}),slot};
      this.state='playing';this.paused=false;this.ui.hideMenu();this.audio.init();this.world.updateActive(this.players,0,this);this.acceptAvailable();
      const recovered=this.lastSaveStatus.recovered,recoveredTime=this.lastSaveStatus.savedAt?new Date(this.lastSaveStatus.savedAt).toLocaleString():'';
      this.ui.toast(recovered?'Recovered previous save'+(recoveredTime?' · '+recoveredTime:'')+'. The latest copy could not be read.':'Campaign restored. Welcome back.',recovered?'error':'quest');return true;
    }
    exportSave(){
      if(this.state==='playing'&&!this.save(false)){this.ui.toast('The latest progress could not be exported. Keep the game open and try saving again.','error');return '';}
      const data=W.Save.export(this.slot);if(!data){this.ui.toast('There is no valid campaign to export.','error');return '';}
      const blob=new Blob([data],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='MeowQuest-Campaign-'+(this.slot+1)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return data;
    }
    importSave(text){try{if(!W.Save.import(this.slot,text))throw Error('This is not a valid campaign backup, or it could not be saved.');if(!this.load(this.slot))throw Error('The imported campaign could not be restored.');return true;}catch(e){this.ui.toast('Could not import campaign: '+e.message,'error');return false;}}
    applySettings(){try{localStorage.setItem('whiskerfall.settings',JSON.stringify(this.settings));}catch(_){}this.audio.setVolumes(this.settings);this.renderer.resize();}
  }
  W.Game=Game;
  const boot=()=>{try{W.game=new Game();}catch(e){console.error(e);document.body.innerHTML='<main style="max-width:700px;margin:15vh auto;color:#eee;font:20px system-ui"><h1>MeowQuest the Purr’d Reich</h1><p>The game could not start. Keep every extracted folder together and open index.html.</p><pre>'+String(e.message).replace(/[<>]/g,'')+'</pre></main>';}};
  // Deferred scripts execute while readyState is "interactive". Wait until the
  // entire extension chain has registered its artwork and gameplay wrappers.
  if(document.readyState!=='complete')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
}());
