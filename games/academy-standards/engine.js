
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const DPR = Math.max(1, Math.min(2, devicePixelRatio || 1));

  const ui = {
    topStats: document.getElementById('topStats'),
    selectedInfo: document.getElementById('selectedInfo'),
    stockSummary: document.getElementById('stockSummary'),
    houses: document.getElementById('houses'),
    log: document.getElementById('log'),
    legend: document.getElementById('legend'),
    selectionPanel: document.getElementById('selectionPanel'),
    equipSection: document.getElementById('equipSection'),
    modeMove: document.getElementById('modeMove'),
    modeDefend: document.getElementById('modeDefend'),
    modeEscort: document.getElementById('modeEscort'),
    modeAttackMove: document.getElementById('modeAttackMove'),
    placeBarricade: document.getElementById('placeBarricade'),
    placeTrap: document.getElementById('placeTrap'),
    cancelPlace: document.getElementById('cancelPlace')
  };

  const TILE = 40;
  const COLS = 124;
  const ROWS = 132;
  const WORLD_W = COLS * TILE;
  const WORLD_H = ROWS * TILE;
  const STUDENTS_PER_HOUSE = 10;
  const MAX_PARTICLES = 300;
  const FLAG_CAPTURE_DURATION=3;
  const FLAG_CAPTURE_RADIUS=29;
  const FLAG_CONTEST_RADIUS=96;

  const HOUSE_DEFS = [
    { id:'player',   name:'House Augustus', color:'#5ca8ff', castle:{x:520,y:3250} },
    { id:'mars',     name:'House Mars', color:'#d65d5d', castle:{x:1220,y:760} },
    { id:'minerva',  name:'House Minerva', color:'#d0a44d', castle:{x:2280,y:520} },
    { id:'diana',    name:'House Diana', color:'#67c98d', castle:{x:3550,y:640} },
    { id:'apollo',   name:'House Apollo', color:'#f29c52', castle:{x:4440,y:1180} },
    { id:'juno',     name:'House Juno', color:'#b87ced', castle:{x:4620,y:2360} },
    { id:'neptune',  name:'House Neptune', color:'#52c4d8', castle:{x:4280,y:3620} },
    { id:'vulcan',   name:'House Vulcan', color:'#e06855', castle:{x:3360,y:4620} },
    { id:'venus',    name:'House Venus', color:'#eb77b8', castle:{x:2120,y:4920} },
    { id:'saturn',   name:'House Saturn', color:'#b3bc63', castle:{x:960,y:4480} }
  ];

  const NAMES = ['Cassius','Lorn','Tactus','Sevro','Adrius','Roque','Victra','Mustang','Holiday','Thorne','Pax','Nero','Ragnar','Karnus','Daxo','Rhonna','Pebble','Clown','Ajax','Aja','Lysander','Atlas','Orion','Tiber','Quinn','Evey','Julian','Nyla','Toren','Sera','Aurex','Bran','Cato','Varro','Silas','Nyx','Drusus','Mira','Joren','Vela','Maro','Sulla','Aurel','Tima','Dorian','Petra','Ione','Vale'];

  const LOOT_KEYS = ['Sword','Spear','Bow','Longbow','Light','Heavy','Shield','Boots','Medkit','Horse','EngineerKit','TrapKit','WarHorn','FireOil'];
  const WEAPON_SET = new Set(['Sword','Spear','Bow','Longbow']);
  const ARMOR_SET = new Set(['Light','Heavy']);
  const ITEM_SET = new Set(['Shield','Boots','Medkit','EngineerKit','TrapKit','WarHorn','FireOil']);

  let controlMode = 'move';
  let placementMode = null;
  let mouseWorld = {x:0,y:0};
  let lastUIAt=-1;
  let lastCameraUIAt=0;
  const keysDown = new Set();

  const game = {
    time:0,
    last:0,
    cam:{x:0,y:0},
    selected:new Set(),
    selectedOne:null,
    drag:null,
    logs:[],
    houses:[],
    students:[],
    standards:[],
    lootBoxes:[],
    groundLoot:[],
    particles:[],
    projectiles:[],
    barricades:[],
    traps:[],
    blacksmiths:[],
    objectives:[],
    terrain:{ dirt:[], waters:[], rivers:[], forestRects:[], hills:[], stones:[] },
    walkable:[],
    gameOver:false,
    paused:true,
    difficulty:'normal',
    squads:{2:null,3:null,4:null},
    activeSquad:1,
    formation:'balanced',
    combatEvents:[],
    hitEffects:[],
    flagTargetId:null,
    nextLootSpawnAt:5,
    nextBigMidLootAt:26,
    earlyBaseLootRemaining:20,
    followMode:true,
    followTargetIds:[]
  };

  function resize(){
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.floor(r.width * DPR);
    canvas.height = Math.floor(r.height * DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }
  addEventListener('resize', resize);
  resize();

  const rand=(a,b)=>Math.random()*(b-a)+a;
  const randi=(a,b)=>Math.floor(rand(a,b+1));
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const dist=(ax,ay,bx,by)=>Math.hypot(bx-ax, by-ay);
  const lerp=(a,b,t)=>a+(b-a)*t;
  const keyXY=(x,y)=>`${x},${y}`;

  function hashId(str){
    let h = 2166136261;
    for(let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h >>> 0);
  }

  function facingVector(dir){
    if(dir === 'right') return {x:1,y:0};
    if(dir === 'left') return {x:-1,y:0};
    if(dir === 'down') return {x:0,y:1};
    return {x:0,y:-1};
  }

  function visibleRect(pad=120){
    const r = canvas.getBoundingClientRect();
    return {
      x: game.cam.x - pad,
      y: game.cam.y - pad,
      w: r.width + pad*2,
      h: r.height + pad*2
    };
  }
  function inView(x,y,pad=0){
    const vr = visibleRect(pad);
    return x >= vr.x && y >= vr.y && x <= vr.x + vr.w && y <= vr.y + vr.h;
  }

  function addParticle(p){
    if(game.particles.length >= MAX_PARTICLES) game.particles.shift();
    game.particles.push(p);
  }

  function sparkBurst(x, y, color='#ffe7a8'){
    for(let i=0;i<9;i++){
      addParticle({
        x, y,
        c: color,
        vx: rand(-120,120),
        vy: rand(-120,120),
        t: rand(0.12,0.22),
        r: rand(1.4,2.8)
      });
    }
  }

  function distToSegment(px, py, ax, ay, bx, by){
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx*dx + dy*dy || 1;
    let t = ((px-ax)*dx + (py-ay)*dy) / lenSq;
    t = clamp(t, 0, 1);
    const cx = ax + dx*t;
    const cy = ay + dy*t;
    return Math.hypot(px-cx, py-cy);
  }

  function riverSlowFactor(x, y){
    let factor = 1;
    for(const river of game.terrain.rivers){
      for(let i=0;i<river.points.length-1;i++){
        const a = river.points[i];
        const b = river.points[i+1];
        const d = distToSegment(x, y, a.x, a.y, b.x, b.y);
        if(d < river.width * 0.5) factor = Math.min(factor, 0.80);
      }
    }
    return factor;
  }

  function log(msg){
    game.logs.unshift(msg);
    if(game.logs.length>110) game.logs.length=110;
    if(!window.AcademyUI) ui.log.innerHTML = game.logs.map(m=>`<div>${m}</div>`).join('');
  }

  function makeHouse(def){
    const stock = {};
    for(const k of LOOT_KEYS) stock[k]=0;
    return {
      ...def,
      controller:def.id,
      previousController:null,
      lastCapturedAt:-1,
      stockpile:stock,
      ai:{ thinkAt:0, aggression:0.25, raid:null, regroupUntil:0 }
    };
  }

  function makeStudent(house,i){
    const spawn=findSpawnPosition(house,i);
    const s = {
      id:`${house.id}_${i}`,
      name:NAMES[(house.name.length*11 + i*5) % NAMES.length] + ' ' + (i+1),
      origHouse:house.id,
      controller:house.id,
      x:spawn.x,
      y:spawn.y,
      tx:spawn.x,
      ty:spawn.y,
      path:[],
      pathIndex:0,
      hp:100,
      maxHp:100,
      state:'idle',
      koUntil:0,
      order:{type:'idle', x:spawn.x, y:spawn.y, targetId:null, targetType:null, manual:false},
      engageId:null,
      facingDir:'up',
      attackCd:0,
      attackAction:null,
      lastAttackReleaseAt:-1,
      lastDamagedAt:-1,
      damageSerial:0,
      flagCaptureId:null,
      flagCaptureProgress:0,
      flagCaptureBlockedId:null,
      radius:13,
      swing:0,
      swingSide:1,
      draw:0,
      mount:false,
      carryingStandard:null,
      weapon:'None',
      weaponLevel:0,
      armor:'None',
      item:'None',
      atkDmg:3,
      atkRange:14,
      moveSpeed:84,
      defense:0.00,
      aggro:135,
      slaveDebuff:false,
      trappedUntil:0,
      buildProgress:0,
      healTargetId:null,
      justRespawned:false,
      engineerCdUntil:0,
      smithTimer:0,
      smithingAt:null,
      lastPathAt:0,
      lastPosX:0,
      lastPosY:0,
      burnUntil:0
    };
    applyLoadout(s);
    s.lastPosX = s.x;
    s.lastPosY = s.y;
    return s;
  }

  function getHouse(id){ return game.houses.find(h=>h.id===id); }
  function getStandard(houseId){ return game.standards.find(s=>s.houseId===houseId); }
  function enemies(a,b){ return a.controller!==b.controller; }
  function isEquipped(s){ return s.weapon!=='None' || s.armor!=='None' || s.item!=='None' || s.mount; }
  function isEngineer(s){ return s.item==='EngineerKit' || s.item==='TrapKit'; }

  function getWeaponColor(lvl){
    if(lvl >= 3) return '#ff4c4c';
    if(lvl >= 2) return '#5ca8ff';
    return '#f4f7ff';
  }

  function objectiveBuffsFor(houseId){
    const buffs = { speed:0, dmg:0, range:0, heal:0, forge:0 };
    for(const o of game.objectives){
      if(o.controller !== houseId) continue;
      if(o.type==='rally') buffs.speed += 10;
      if(o.type==='arsenal'){ buffs.dmg += 3; buffs.range += 10; }
      if(o.type==='sanctum') buffs.heal += 1.2;
      if(o.type==='forge') buffs.forge += 1;
    }
    return buffs;
  }

  function applyLoadout(s){
    let speed=84, dmg=3, range=14, def=0.00, hp=100, atkCd=0.72;
    if(s.weapon==='Sword'){ dmg=22; range=26; atkCd=0.58; if(s.weaponLevel===0) s.weaponLevel=1; }
    if(s.weapon==='Spear'){ dmg=16; range=50; atkCd=0.70; if(s.weaponLevel===0) s.weaponLevel=1; }
    if(s.weapon==='Bow'){ dmg=14; range=190; atkCd=0.88; if(s.weaponLevel===0) s.weaponLevel=1; }
    if(s.weapon==='Longbow'){ dmg=13; range=240; atkCd=0.98; if(s.weaponLevel===0) s.weaponLevel=1; }
    if(s.weapon==='None') s.weaponLevel = 0;

    if(s.weapon!=='None'){
      const lvl = Math.max(1, s.weaponLevel || 1);
      if(s.weapon==='Sword'){ dmg += (lvl-1)*4; range += (lvl-1)*4; }
      if(s.weapon==='Spear'){ dmg += (lvl-1)*3; range += (lvl-1)*9; }
      if(s.weapon==='Bow'){ dmg += (lvl-1)*2.8; range += (lvl-1)*13; }
      if(s.weapon==='Longbow'){ dmg += (lvl-1)*2.2; range += (lvl-1)*18; }
    }

    if(s.armor==='Light') speed+=14;
    if(s.armor==='Heavy'){ speed-=8; def+=0.22; hp+=28; }
    if(s.item==='Shield'){ def+=0.16; speed-=3; }
    if(s.item==='Boots') speed+=20;
    if(s.item==='Medkit') speed-=1;
    if(s.item==='EngineerKit') speed-=3;
    if(s.item==='TrapKit') speed-=2;
    if(s.item==='WarHorn'){ speed+=14; dmg+=2; }
    if(s.item==='FireOil') dmg+=5;
    if(s.mount){ speed*=1.60; hp += 26; }
    if(s.origHouse==='mars') dmg*=1.08;
    if(s.origHouse==='diana') speed*=1.06;
    if((s.origHouse==='minerva' || s.origHouse==='apollo') && (s.weapon==='Bow' || s.weapon==='Longbow')) range += 14;
    if(s.slaveDebuff){ speed*=0.77; dmg*=0.77; }
    if(s.carryingStandard) speed *= 0.66;

    const buffs = objectiveBuffsFor(s.controller);
    speed += buffs.speed;
    dmg += buffs.dmg;
    range += buffs.range;

    s.maxHp = hp;
    s.hp = Math.min(Number.isFinite(s.hp) ? s.hp : hp, hp);
    s.moveSpeed = speed;
    s.atkDmg = dmg;
    s.atkRange = range;
    s.defense = def;
    s.baseAttackCd = atkCd;
    s.aggro = (s.weapon==='Bow' || s.weapon==='Longbow') ? 250 : 185;
    s.radius=s.mount?16:13;
  }

  function getRoleSegments(s){
    const segs = [];
    if(s.weapon==='None' && s.armor==='None' && s.item==='None' && !s.mount){
      segs.push('#ffffff');
      return segs;
    }
    if(s.weapon==='Sword' || s.weapon==='Spear') segs.push('#ff5757');
    if(s.weapon==='Bow' || s.weapon==='Longbow') segs.push('#58d97b');
    if(s.item==='Medkit') segs.push('#64b5ff');
    if(s.armor==='Heavy' || s.item==='Shield' || s.item==='EngineerKit' || s.item==='TrapKit') segs.push('#f2d25a');
    if(s.item==='WarHorn') segs.push('#d8bd66');
    if(s.item==='FireOil') segs.push('#ff8c3a');
    if(segs.length===0) segs.push('#ffffff');
    return segs.slice(0,2);
  }

  function isCommandLocked(s){
    if(s.state==='knocked') return false;
    return s.order.manual && s.order.type!=='idle' && s.order.type!=='attackMove' && s.order.type!=='escort';
  }

  function buildTerrain(){
    game.terrain.dirt = [
      {x:700,y:900,r:220},{x:1280,y:1460,r:260},{x:2100,y:980,r:280},{x:3040,y:1680,r:280},{x:3940,y:2860,r:300},
      {x:1680,y:3600,r:340},{x:900,y:4300,r:260},{x:2860,y:4600,r:250}
    ];
    game.terrain.waters = [
      {x:980,y:1100,rx:220,ry:130},{x:1880,y:760,rx:180,ry:110},{x:3340,y:980,rx:260,ry:140},
      {x:4050,y:3150,rx:220,ry:160},{x:2200,y:4100,rx:180,ry:110},{x:840,y:3340,rx:210,ry:130}
    ];
    game.terrain.rivers = [
      { width: 52, points: [{x:180,y:1360},{x:520,y:1460},{x:980,y:1650},{x:1420,y:1920},{x:1880,y:2180},{x:2440,y:2400},{x:3020,y:2600},{x:3660,y:2860},{x:4320,y:3240},{x:4760,y:3640}] },
      { width: 42, points: [{x:3520,y:260},{x:3380,y:740},{x:3240,y:1220},{x:3060,y:1720},{x:2860,y:2240},{x:2600,y:2820},{x:2280,y:3540},{x:1880,y:4360},{x:1520,y:5180}] }
    ];
    game.terrain.forestRects = [
      {x:520,y:420,w:420,h:280},{x:1420,y:520,w:340,h:350},{x:2500,y:520,w:340,h:260},{x:3500,y:700,w:420,h:320},
      {x:3780,y:1900,w:380,h:330},{x:2780,y:3360,w:380,h:340},{x:1180,y:3640,w:450,h:320},{x:420,y:2460,w:380,h:300}
    ];
    game.terrain.hills = [
      {x:1550,y:2200,r:220},{x:2450,y:2550,r:170},{x:3280,y:3920,r:220},{x:820,y:1850,r:160},{x:4220,y:1640,r:190}
    ];
    game.terrain.stones = [];
    for(let i=0;i<130;i++) game.terrain.stones.push({x:rand(80,WORLD_W-80), y:rand(80,WORLD_H-80), r:rand(3,8)});

    game.blacksmiths = [
      {id:'forge1', x:1150, y:2320, w:118, h:118},
      {id:'forge2', x:2460, y:2320, w:118, h:118},
      {id:'forge3', x:3720, y:2680, w:118, h:118}
    ];

    game.objectives = [
      { id:'obj_forge', type:'forge', x:2460, y:2460, r:110, controller:null, progress:{} },
      { id:'obj_rally', type:'rally', x:3180, y:2140, r:110, controller:null, progress:{} },
      { id:'obj_arsenal', type:'arsenal', x:2860, y:3140, r:110, controller:null, progress:{} },
      { id:'obj_sanctum', type:'sanctum', x:2060, y:3040, r:110, controller:null, progress:{} }
    ];

    rebuildWalkableGrid();
  }

  function rebuildWalkableGrid(){
    game.walkable = Array.from({length:ROWS},()=>Array(COLS).fill(true));
    for(let gy=0; gy<ROWS; gy++){
      for(let gx=0; gx<COLS; gx++){
        const cx = gx*TILE + TILE/2;
        const cy = gy*TILE + TILE/2;
        let blocked = false;

        for(const w of game.terrain.waters){
          const nx=(cx-w.x)/(w.rx+18), ny=(cy-w.y)/(w.ry+18);
          if(nx*nx + ny*ny < 1) blocked = true;
        }
        for(const f of game.terrain.forestRects){
          if(cx>f.x-18 && cx<f.x+f.w+18 && cy>f.y-18 && cy<f.y+f.h+18) blocked = true;
        }
        for(const b of game.barricades){
          if(!b.alive) continue;
          if(cx > b.x - b.w/2 - 2 && cx < b.x + b.w/2 + 2 && cy > b.y - b.h/2 - 2 && cy < b.y + b.h/2 + 2) blocked = true;
        }
        for(const h of HOUSE_DEFS){
          if(dist(cx,cy,h.castle.x,h.castle.y) < 64) blocked = false;
        }
        for(const smith of game.blacksmiths){
          if(cx>smith.x-smith.w/2 && cx<smith.x+smith.w/2 && cy>smith.y-smith.h/2 && cy<smith.y+smith.h/2) blocked = false;
        }
        game.walkable[gy][gx] = !blocked;
      }
    }
  }

  function terrainClear(x,y,radius=12){
    if(x<radius+2||y<radius+2||x>WORLD_W-radius-2||y>WORLD_H-radius-2)return false;
    for(const w of game.terrain.waters)if(((x-w.x)/(w.rx+radius+3))**2+((y-w.y)/(w.ry+radius+3))**2<1)return false;
    for(const f of game.terrain.forestRects)if(x>f.x-radius-2&&x<f.x+f.w+radius+2&&y>f.y-radius-2&&y<f.y+f.h+radius+2)return false;
    for(const b of game.barricades)if(b.alive&&x>b.x-b.w/2-radius&&x<b.x+b.w/2+radius&&y>b.y-b.h/2-radius&&y<b.y+b.h/2+radius)return false;
    return !!game.walkable[Math.floor(y/TILE)]?.[Math.floor(x/TILE)];
  }

  function segmentClear(ax,ay,bx,by,radius=12){
    const distance=dist(ax,ay,bx,by),steps=Math.max(1,Math.ceil(distance/12));
    for(let i=1;i<=steps;i++)if(!terrainClear(lerp(ax,bx,i/steps),lerp(ay,by,i/steps),radius))return false;
    return true;
  }

  function resolveDestination(x,y,radius=16,reserved=[]){
    x=clamp(x,radius+2,WORLD_W-radius-2);y=clamp(y,radius+2,WORLD_H-radius-2);
    const free=(px,py)=>terrainClear(px,py,radius)&&reserved.every(p=>dist(px,py,p.x,p.y)>radius+p.radius+10);
    if(free(x,y))return {x,y};
    const cell=nearestWalkable(x,y,radius),base={x:cell.gx*TILE+TILE/2,y:cell.gy*TILE+TILE/2};
    if(free(base.x,base.y))return base;
    for(let ring=1;ring<=10;ring++)for(let step=0;step<20;step++){
      const angle=step/20*Math.PI*2,px=base.x+Math.cos(angle)*ring*44,py=base.y+Math.sin(angle)*ring*44;
      if(free(px,py))return {x:px,y:py};
    }
    return base;
  }

  function findSpawnPosition(house,index){
    const occupied=game.students.filter(s=>s.state!=='knocked');
    const nominal={x:house.castle.x+((index%5)-2)*48,y:house.castle.y+112+Math.floor(index/5)*52};
    const available=(x,y)=>terrainClear(x,y,17)&&dist(x,y,house.castle.x,house.castle.y)>102&&occupied.every(s=>dist(x,y,s.x,s.y)>44);
    if(available(nominal.x,nominal.y))return nominal;
    for(let ring=0;ring<8;ring++){
      for(let step=0;step<20;step++){
        const angle=Math.PI*.1+(step/20)*Math.PI*.8;
        const x=house.castle.x+Math.cos(angle)*(130+ring*45);
        const y=house.castle.y+Math.sin(angle)*(130+ring*45);
        if(available(x,y))return {x,y};
      }
    }
    for(let ring=0;ring<10;ring++)for(let step=0;step<24;step++){
      const angle=(step/24)*Math.PI*2,x=house.castle.x+Math.cos(angle)*(145+ring*45),y=house.castle.y+Math.sin(angle)*(145+ring*45);
      if(available(x,y))return {x,y};
    }
    const cell=nearestWalkable(nominal.x,nominal.y);
    return {x:cell.gx*TILE+TILE/2,y:cell.gy*TILE+TILE/2};
  }

  function nearestWalkable(wx,wy,radius=16){
    let gx = clamp(Math.floor(wx/TILE),0,COLS-1);
    let gy = clamp(Math.floor(wy/TILE),0,ROWS-1);
    const valid=(x,y)=>game.walkable[y]?.[x]&&terrainClear(x*TILE+TILE/2,y*TILE+TILE/2,radius);
    if(valid(gx,gy)) return {gx,gy};
    for(let r=1;r<30;r++){
      let best=null,bestDistance=Infinity;
      for(let y=gy-r;y<=gy+r;y++){
        for(let x=gx-r;x<=gx+r;x++){
          if(Math.abs(x-gx)!==r&&Math.abs(y-gy)!==r)continue;
          if(x<0||y<0||x>=COLS||y>=ROWS) continue;
          if(valid(x,y)){const d=(x*TILE+TILE/2-wx)**2+(y*TILE+TILE/2-wy)**2;if(d<bestDistance){best={gx:x,gy:y};bestDistance=d;}}
        }
      }
      if(best)return best;
    }
    return {gx,gy};
  }

  function isAreaReachable(x,y,radius=44){
    const p = nearestWalkable(x,y);
    const cx = p.gx*TILE + TILE/2;
    const cy = p.gy*TILE + TILE/2;
    if(dist(x,y,cx,cy) > 45) return false;

    const checks = [
      [x+radius,y],[x-radius,y],[x,y+radius],[x,y-radius],
      [x+radius*0.7,y+radius*0.7],[x-radius*0.7,y-radius*0.7]
    ];
    let walkCount = 0;
    for(const [px,py] of checks){
      const np = nearestWalkable(px,py);
      const wx = np.gx*TILE+TILE/2, wy = np.gy*TILE+TILE/2;
      if(dist(px,py,wx,wy) < 35) walkCount++;
    }
    return walkCount >= 4;
  }

  function pathfind(sx,sy,tx,ty,avoid=null){
    const start = nearestWalkable(sx,sy);
    const goal = nearestWalkable(tx,ty);
    const open = [start];
    const came = new Map();
    const gScore = new Map([[keyXY(start.gx,start.gy), 0]]);
    const fScore = new Map([[keyXY(start.gx,start.gy), Math.abs(goal.gx-start.gx)+Math.abs(goal.gy-start.gy)]]);
    const closed = new Set();
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    let loops = 0;
    let bestReached=start,bestRemaining=Infinity;

    while(open.length && loops < 1800){
      loops++;
      let bestIdx=0, bestF=Infinity,bestH=Infinity;
      for(let i=0;i<open.length;i++){
        const k=keyXY(open[i].gx,open[i].gy), f=fScore.get(k) ?? Infinity;
        const h=Math.abs(goal.gx-open[i].gx)+Math.abs(goal.gy-open[i].gy);
        if(f<bestF||(f===bestF&&h<bestH)){ bestF=f;bestH=h;bestIdx=i; }
      }
      const current = open.splice(bestIdx,1)[0];
      const ck = keyXY(current.gx,current.gy);
      const remaining=Math.abs(goal.gx-current.gx)+Math.abs(goal.gy-current.gy);
      if(remaining<bestRemaining){bestRemaining=remaining;bestReached=current;}

      if(current.gx===goal.gx && current.gy===goal.gy){
        const path = [];
        let cur = ck;
        while(cur){
          const [x,y]=cur.split(',').map(Number);
          path.push({x:x*TILE+TILE/2,y:y*TILE+TILE/2});
          cur = came.get(cur);
        }
        path.reverse();
        return path;
      }

      closed.add(ck);
      for(const [dx,dy] of dirs){
        const nx=current.gx+dx, ny=current.gy+dy;
        if(nx<0||ny<0||nx>=COLS||ny>=ROWS) continue;
        if(!game.walkable[ny][nx]||!terrainClear(nx*TILE+TILE/2,ny*TILE+TILE/2,16)) continue;
        const nk=keyXY(nx,ny);
        if(closed.has(nk)) continue;
        const tentative=(gScore.get(ck)??Infinity)+1+(avoid?.has(nk)?3:0);
        if(tentative < (gScore.get(nk)??Infinity)){
          came.set(nk,ck);
          gScore.set(nk,tentative);
          fScore.set(nk,tentative + Math.abs(goal.gx-nx)+Math.abs(goal.gy-ny));
          if(!open.some(o=>o.gx===nx&&o.gy===ny)) open.push({gx:nx,gy:ny});
        }
      }
    }
    const partial=[];
    let cursor=keyXY(bestReached.gx,bestReached.gy);
    while(cursor){const [x,y]=cursor.split(',').map(Number);partial.push({x:x*TILE+TILE/2,y:y*TILE+TILE/2});cursor=came.get(cursor);}
    return partial.reverse();
  }

  function setFacingFromDx(s, dx){
    if(dx > 5) s.facingDir = 'right';
    else if(dx < -5) s.facingDir = 'left';
    else s.facingDir = 'up';
  }

  function setFacingTowardPoint(s, tx, ty){
    const dx = tx - s.x;
    const dy = ty - s.y;
    if(Math.abs(dx) > Math.abs(dy)) setFacingFromDx(s, dx);
    else s.facingDir = dy < 0 ? 'up' : 'down';
  }

  function setOrder(student, order){
    if(student.carryingStandard && order.type!=='returnBanner'){
      const home=getHouse(student.controller).castle;
      order={type:'returnBanner',x:home.x,y:home.y,manual:true};
    }
    const destination=resolveDestination(order.x??student.x,order.y??student.y,student.radius||13);
    const changed=student.order && (student.order.type!==(order.type??'move')||student.order.targetId!==(order.targetId??null)||dist(student.order.x,student.order.y,destination.x,destination.y)>24||(order.type==='idle'&&(student.attackAction||student.flagCaptureId)));
    if(changed){
      cancelAttackAction(student);
      if(student.flagCaptureId && !(order.type==='capture'&&order.targetId===student.flagCaptureId))interruptFlagCapture(student,'order');
    }
    if(order.type==='capture'&&order.targetType==='standard'){
      student.flagCaptureBlockedId=null;
      if(student.controller==='player'&&order.manual!==false)game.flagTargetId=order.targetId;
    }
    student.order = {
      type:order.type ?? 'move',
      x:destination.x,
      y:destination.y,
      targetId:order.targetId ?? null,
      targetType:order.targetType ?? null,
      manual:order.manual !== false
    };
    student.engageId = null;
    student.healTargetId = order.type === 'heal' ? order.targetId : null;
    student.buildProgress = 0;
    student.tx = student.order.x;
    student.ty = student.order.y;
    student.path = pathfind(student.x, student.y, student.tx, student.ty);
    student.pathIndex = 0;
    student.lastPathAt = game.time;
    student.state = 'move';
  }

  function randomLootSpawnPoint(centerBias=false){
    for(let tries=0; tries<200; tries++){
      const x = centerBias ? rand(WORLD_W*0.34, WORLD_W*0.68) : rand(180, WORLD_W-180);
      const y = centerBias ? rand(WORLD_H*0.26, WORLD_H*0.72) : rand(160, WORLD_H-160);
      const nw = nearestWalkable(x,y);
      const px = nw.gx*TILE + TILE/2;
      const py = nw.gy*TILE + TILE/2;
      const closeToBox = game.lootBoxes.some(b=>b.alive && dist(b.x,b.y,px,py) < 130);
      const closeToCastle = HOUSE_DEFS.some(h=>dist(h.castle.x,h.castle.y,px,py) < 155);
      const closeToWater = game.terrain.waters.some(w=>{
        const nx=(px-w.x)/(w.rx+32), ny=(py-w.y)/(w.ry+32);
        return nx*nx + ny*ny < 1;
      });
      const inForge = game.blacksmiths.some(f=>px>f.x-f.w/2-28 && px<f.x+f.w/2+28 && py>f.y-f.h/2-28 && py<f.y+f.h/2+28);
      if(!closeToBox && !closeToCastle && !closeToWater && !inForge && isAreaReachable(px,py,50)) return {x:px,y:py};
    }
    return null;
  }

  function randomLootSpawnNearHouse(house, minR=95, maxR=220){
    for(let tries=0; tries<100; tries++){
      const ang = rand(0, Math.PI*2);
      const rr = rand(minR, maxR);
      const x = house.castle.x + Math.cos(ang) * rr;
      const y = house.castle.y + Math.sin(ang) * rr;
      if(x < 120 || y < 120 || x > WORLD_W-120 || y > WORLD_H-120) continue;

      const nw = nearestWalkable(x,y);
      const px = nw.gx*TILE + TILE/2;
      const py = nw.gy*TILE + TILE/2;

      const closeToBox = game.lootBoxes.some(b=>b.alive && dist(b.x,b.y,px,py) < 100);
      const closeToWater = game.terrain.waters.some(w=>{
        const nx=(px-w.x)/(w.rx+26), ny=(py-w.y)/(w.ry+26);
        return nx*nx + ny*ny < 1;
      });
      if(!closeToBox && !closeToWater && isAreaReachable(px,py,44)) return {x:px,y:py};
    }
    return null;
  }

  function spawnLootBoxAt(x,y,rare=false,big=false){
    const pool = ['Sword','Spear','Bow','Longbow','Light','Heavy','Shield','Boots','Medkit','EngineerKit','WarHorn','FireOil'];
    const loot = [];
    if(rare) loot.push(['Horse','TrapKit','EngineerKit','WarHorn','FireOil'][randi(0,4)]);
    loot.push(pool[randi(0,pool.length-1)]);
    if(Math.random()<0.45 || big) loot.push(pool[randi(0,pool.length-1)]);
    if(Math.random()<0.25 || big) loot.push(pool[randi(0,pool.length-1)]);
    if(big){
      if(Math.random()<0.7) loot.push(['Horse','TrapKit','EngineerKit','Heavy','WarHorn'][randi(0,4)]);
      if(Math.random()<0.6) loot.push(['Sword','Spear','Bow','Longbow','Shield','FireOil'][randi(0,5)]);
    }
    game.lootBoxes.push({
      id:'box_'+Math.random().toString(36).slice(2),
      x,y,
      hp:big?210:(rare?150:100),
      maxHp:big?210:(rare?150:100),
      loot,
      alive:true,
      rare,big
    });
  }

  function spawnInitialLootBoxes(){
    game.lootBoxes = [];
    for(const h of game.houses){
      const a = randomLootSpawnNearHouse(h, 95, 180);
      const b = randomLootSpawnNearHouse(h, 130, 235);
      if(a) spawnLootBoxAt(a.x, a.y, false, false);
      if(b) spawnLootBoxAt(b.x, b.y, Math.random()<0.20, false);
    }
    for(let i=0;i<8;i++){
      const p = randomLootSpawnPoint(false);
      if(p) spawnLootBoxAt(p.x,p.y, i%4===0, false);
    }
  }

  function spawnGroundLoot(x,y,item){
    if(!item || item==='None') return;
    const nw = nearestWalkable(x,y);
    const px = nw.gx*TILE+TILE/2, py = nw.gy*TILE+TILE/2;
    game.groundLoot.push({ id:'ground_'+Math.random().toString(36).slice(2), x:px, y:py, item, alive:true });
  }

  function init(){
    game.time=0; game.last=0; game.gameOver=false;
    game.paused=true;
    game.squads={2:null,3:null,4:null};
    game.activeSquad=1;
    game.combatEvents=[];
    game.hitEffects=[];
    game.flagTargetId=null;
    game.result=null;
    game.formation='balanced';
    lastUIAt=-1;
    keysDown.clear();
    game.logs=[]; game.selected.clear(); game.selectedOne=null; game.drag=null;
    placementMode = null;
    controlMode = 'move';
    game.nextLootSpawnAt = 5;
    game.nextBigMidLootAt = 26;
    game.earlyBaseLootRemaining = 20;
    game.followMode = true;
    game.followTargetIds = [];
    game.groundLoot = [];

    game.houses = HOUSE_DEFS.map(makeHouse);
    game.barricades = [];
    game.traps = [];
    buildTerrain();

    game.students = [];
    for(const h of game.houses){
      for(let i=0;i<STUDENTS_PER_HOUSE;i++) game.students.push(makeStudent(h,i));
    }

    // Equal starting supplies make the opening about tactics from the first order.
    for(const h of game.houses){
      const troops=game.students.filter(s=>s.origHouse===h.id);
      troops.forEach((s,i)=>{
        s.weapon=i>=6 && i<=8 ? 'Bow' : (i===3 || i===4 || i===9 ? 'Spear' : 'Sword');
        s.weaponLevel=1;
        s.armor=i<4 ? 'Heavy' : 'Light';
        s.item=i<4 ? 'Shield' : (i===9 ? 'Medkit' : 'Boots');
        s.mount=i===5;
        s.roleHint=i>=6&&i<=8?'ranged':i===9?'support':'vanguard';
        applyLoadout(s);
        s.hp=s.maxHp;
      });
      Object.assign(h.stockpile,{Sword:2,Spear:2,Bow:2,Light:2,Heavy:2,Shield:2,Medkit:1,EngineerKit:1,Horse:1});
    }

    game.standards = game.houses.map(h=>({
      houseId:h.id,
      controller:h.id,
      x:h.castle.x,
      y:h.castle.y-34,
      carriedBy:null,
      homeOwner:h.id,
      dropped:false,
      returning:false
      ,captureStudentId:null,captureController:null,captureProgress:0,captureDuration:FLAG_CAPTURE_DURATION,captureContested:false,captureInterruptedUntil:0
    }));

    spawnInitialLootBoxes();
    game.particles=[];
    game.projectiles=[];

    const rect = canvas.getBoundingClientRect();
    const vw = rect.width || 1200;
    const vh = rect.height || 700;
    const pCastle = getHouse('player').castle;
    game.cam.x = clamp(pCastle.x - vw/2, 0, WORLD_W - vw);
    game.cam.y = clamp(pCastle.y - vh/2, 0, WORLD_H - vh);

    selectUnits(game.students.filter(s=>s.controller==='player').map(s=>s.id),false);
    game.activeSquad=1;
    game.followTargetIds=getSelectedUnits().map(s=>s.id);
    log(`Your expedition is ready. Right-click to command. Capture a rival standard and bring it home to conquer its house.`);
    refreshUI();
    syncModeButtons();
  }

  function getPlayerHouse(){ return getHouse('player'); }

  function refreshEquipButtons(){
    if(window.AcademyUI){refreshUI();return;}
    const p = getPlayerHouse();
    const m = k => `${k}(${p.stockpile[k]||0})`;
    document.getElementById('eqSword').textContent = m('Sword');
    document.getElementById('eqSpear').textContent = m('Spear');
    document.getElementById('eqBow').textContent = m('Bow');
    document.getElementById('eqLongbow').textContent = m('Longbow');
    document.getElementById('eqLight').textContent = m('Light');
    document.getElementById('eqHeavy').textContent = m('Heavy');
    document.getElementById('eqShield').textContent = m('Shield');
    document.getElementById('eqBoots').textContent = m('Boots');
    document.getElementById('eqMedkit').textContent = m('Medkit');
    document.getElementById('eqHorse').textContent = m('Horse');
    document.getElementById('eqEngineer').textContent = `Engineer(${p.stockpile.EngineerKit||0})`;
    document.getElementById('eqTrapKit').textContent = `Trap Kit(${p.stockpile.TrapKit||0})`;
    document.getElementById('eqWarHorn').textContent = `War Horn(${p.stockpile.WarHorn||0})`;
    document.getElementById('eqFireOil').textContent = `Fire Oil(${p.stockpile.FireOil||0})`;
  }

  function refreshUI(){
    if(window.AcademyUI){ window.AcademyUI(api); return; }
    renderTop();
    renderSelected();
    renderStockSummary();
    renderSelectionPanel();
    renderHouses();
    renderLegend();
    refreshEquipButtons();
  }

  function renderTop(){
    if(window.AcademyUI){refreshUI();return;}
    const p = getPlayerHouse();
    const active = game.students.filter(s=>s.controller==='player' && s.state!=='knocked').length;
    const knocked = game.students.filter(s=>s.controller==='player' && s.state==='knocked').length;
    const standardsHeld = game.standards.filter(st=>st.controller==='player').length;
    const mids = game.objectives.filter(o=>o.controller==='player').length;
    const modeText =
      controlMode==='attackmove' ? 'Attack Move' :
      controlMode==='defend' ? 'Defend' :
      controlMode==='escort' ? 'Escort' : 'Move';
    ui.topStats.innerHTML = `
      <div class="pill">House: <b style="color:${p.color}">${p.name}</b></div>
      <div class="pill">Active: <b>${active}</b></div>
      <div class="pill">Knocked Out: <b>${knocked}</b></div>
      <div class="pill">Standards Ruled: <b>${standardsHeld}/${game.houses.length}</b></div>
      <div class="pill">Mid Sites: <b>${mids}/${game.objectives.length}</b></div>
      <div class="pill">Mode: <b>${modeText}</b></div>
      <div class="pill">Camera: <b>${game.followMode ? 'Auto-follow' : 'Manual'}</b></div>
    `;
  }

  function renderSelected(){
    if(window.AcademyUI){refreshUI();return;}
    const s = game.selectedOne;
    if(!s){
      ui.selectedInfo.innerHTML = `<div class="small">Select one of your students or click a blue student on the field.</div>`;
      ui.equipSection.classList.add('hidden');
      return;
    }
    ui.equipSection.classList.remove('hidden');
    const engCd = Math.max(0, s.engineerCdUntil - game.time);
    ui.selectedInfo.innerHTML = `
      <div><b>${s.name}</b></div>
      <div class="small">Controller: <b>${getHouse(s.controller).name}</b> • Origin: <b>${getHouse(s.origHouse).name}</b></div>
      <div class="small">Weapon: <b>${s.weapon}</b>${s.weapon!=='None' ? ` Lv.${s.weaponLevel}` : ''} • Armor: <b>${s.armor}</b> • Item: <b>${s.item}</b> • Mount: <b>${s.mount?'Horse':'None'}</b></div>
      <div class="small">HP: <b>${Math.round(s.hp)}/${Math.round(s.maxHp)}</b> • Speed: <b>${Math.round(s.moveSpeed)}</b> • Damage: <b>${Math.round(s.atkDmg)}</b> • Range: <b>${Math.round(s.atkRange)}</b></div>
      <div class="small">State: <b>${s.state}</b>${s.carryingStandard ? ' • carrying banner' : ''}${s.trappedUntil>game.time ? ` • trapped ${Math.ceil(s.trappedUntil-game.time)}s` : ''}</div>
      <div class="small">Order: <b>${s.order.type}</b>${s.order.targetId ? ` • target ${s.order.targetId}` : ''}</div>
      <div class="small">Engineer CD: <b>${engCd>0 ? engCd.toFixed(1)+'s' : 'Ready'}</b> • Burn: <b>${Math.max(0, s.burnUntil-game.time).toFixed(1)}s</b></div>
    `;
  }

  function renderStockSummary(){
    if(window.AcademyUI){refreshUI();return;}
    const p = getPlayerHouse();
    const total = LOOT_KEYS.reduce((n,k)=>n+(p.stockpile[k]||0),0);
    ui.stockSummary.innerHTML = `
      <div>Total stored items: <b>${total}</b></div>
      <div class="tiny" style="margin-top:6px">
        Sword ${p.stockpile.Sword||0} • Spear ${p.stockpile.Spear||0} • Bow ${p.stockpile.Bow||0} • Longbow ${p.stockpile.Longbow||0}<br>
        Heavy ${p.stockpile.Heavy||0} • Shield ${p.stockpile.Shield||0} • Boots ${p.stockpile.Boots||0} • Medkit ${p.stockpile.Medkit||0}<br>
        Horse ${p.stockpile.Horse||0} • Engineer ${p.stockpile.EngineerKit||0} • Trap ${p.stockpile.TrapKit||0} • Horn ${p.stockpile.WarHorn||0} • Fire Oil ${p.stockpile.FireOil||0}
      </div>
    `;
  }

  function renderSelectionPanel(){
    if(window.AcademyUI){refreshUI();return;}
    const sel = [...game.selected].map(id=>game.students.find(s=>s.id===id)).filter(Boolean);
    if(!sel.length){
      ui.selectionPanel.innerHTML = `No units selected.`;
      return;
    }
    ui.selectionPanel.innerHTML = sel.map(s=>{
      const pct = (s.hp/s.maxHp)*100;
      return `
        <div class="card ${game.selectedOne?.id===s.id?'sel':''}" data-id="${s.id}">
          <div class="row">
            <div>
              <div><b>${s.name}</b></div>
              <div class="tiny">${s.state}${s.carryingStandard?' • banner':''}</div>
            </div>
            <div class="tiny">${getHouse(s.controller).name}</div>
          </div>
          <div class="bar"><div class="fill" style="width:${pct}%"></div></div>
          <div class="tags">
            <span class="tag">${s.weapon}${s.weapon!=='None'?' L'+s.weaponLevel:''}</span>
            <span class="tag">${s.armor}</span>
            <span class="tag">${s.item}</span>
            <span class="tag">${s.order.type}</span>
          </div>
        </div>
      `;
    }).join('');
    [...ui.selectionPanel.querySelectorAll('.card')].forEach(el=>{
      el.onclick=()=>{
        const s = game.students.find(x=>x.id===el.dataset.id);
        if(s){ game.selectedOne=s; renderSelected(); renderSelectionPanel(); }
      };
    });
  }

  function housePower(h){
    const active = game.students.filter(s=>s.controller===h.id && s.state!=='knocked');
    const ruled = game.houses.filter(x=>x.controller===h.id).length;
    const armed = active.filter(isEquipped).length;
    const mids = game.objectives.filter(o=>o.controller===h.id).length;
    const score = active.length*8 + armed*8 + ruled*26 + mids*18 +
      (h.stockpile.Sword+h.stockpile.Spear+h.stockpile.Bow+h.stockpile.Longbow)*3 +
      (h.stockpile.Heavy+h.stockpile.Shield+h.stockpile.Medkit+h.stockpile.WarHorn+h.stockpile.FireOil)*2;
    return { active, ruled, armed, mids, score };
  }

  function renderHouses(){
    if(window.AcademyUI){refreshUI();return;}
    const lords = game.houses.filter(h=>h.controller===h.id);
    const ranked = lords.map(h=>({h,...housePower(h)})).sort((a,b)=>b.score-a.score);
    ui.houses.innerHTML = ranked.map((entry, idx)=>{
      const h = entry.h;
      const vassals = game.houses.filter(x=>x.controller===h.id && x.id!==h.id);
      return `
        <div class="rankRow">
          <div class="row">
            <div><b>#${idx+1} <span style="color:${h.color}">${h.name}</span></b></div>
            <div class="tiny">Power ${entry.score}</div>
          </div>
          <div class="small">Ruled: <b>${entry.ruled}</b> • Active: <b>${entry.active.length}</b> • Equipped: <b>${entry.armed}</b> • Mid Sites: <b>${entry.mids}</b></div>
          ${vassals.length ? `<div class="vassal">${vassals.map(v=>`<div class="small">• <span style="color:${v.color}">${v.name}</span></div>`).join('')}</div>` : ``}
        </div>
      `;
    }).join('');
  }

  function renderLegend(){
    ui.legend.innerHTML = `
      <div class="pill legend"><span class="dot" style="background:#ffffff"></span>Basic</div>
      <div class="pill legend"><span class="dot" style="background:#ff5757"></span>Melee</div>
      <div class="pill legend"><span class="dot" style="background:#58d97b"></span>Archer</div>
      <div class="pill legend"><span class="dot" style="background:#7fb2ff"></span>Move order</div>
      <div class="pill legend"><span class="dot" style="background:#ff7a7a"></span>Direct target</div>
      <div class="pill legend"><span class="dot" style="background:#ffb347"></span>Attack-move</div>
      <div class="pill legend"><span class="dot" style="background:#ffef9a"></span>Shield Block</div>
      <div class="pill legend"><span class="dot" style="background:#5ca8ff"></span>Forge II</div>
      <div class="pill legend"><span class="dot" style="background:#ff4c4c"></span>Forge III</div>
    `;
  }

  function spendLootOnSelected(key){
  const selectedUnits = getSelectedUnits().filter(s=>s.controller==='player' && s.state!=='knocked');
  if(!selectedUnits.length) return;

  const p = getPlayerHouse();
  if((p.stockpile[key]||0)<=0){
    log(`<span style="color:#ffd5d5">You do not have ${key}.</span>`);
    return;
  }

  function gearScore(s){
    let score = 0;
    if(s.weapon !== 'None') score += 3;
    if(s.armor !== 'None') score += 2;
    if(s.item !== 'None') score += 2;
    if(s.mount) score += 1;
    return score;
  }

  function canUseItem(s, key){
    if(key === 'Horse') return !s.mount;
    if(WEAPON_SET.has(key)) return s.weapon === 'None';
    if(ARMOR_SET.has(key)) return s.armor === 'None';
    if(ITEM_SET.has(key)) return s.item === 'None';
    return true;
  }

  let target = null;

  if(selectedUnits.length > 1){
    const prioritized = [...selectedUnits]
      .filter(s=>canUseItem(s, key))
      .sort((a,b)=>gearScore(a)-gearScore(b));

    if(prioritized.length) target = prioritized[0];
  }

  if(!target){
    target = game.selectedOne && selectedUnits.includes(game.selectedOne)
      ? game.selectedOne
      : selectedUnits[0];
  }

  if(!target) return;

  p.stockpile[key]--;

  if(key==='Horse'){
    if(target.mount) p.stockpile['Horse']++;
    target.mount = true;
  }else if(WEAPON_SET.has(key)){
    if(target.weapon!=='None') p.stockpile[target.weapon] = (p.stockpile[target.weapon]||0)+1;
    target.weapon = key;
    target.weaponLevel = 1;
  }else if(ARMOR_SET.has(key)){
    if(target.armor!=='None') p.stockpile[target.armor] = (p.stockpile[target.armor]||0)+1;
    target.armor = key;
  }else if(ITEM_SET.has(key)){
    if(target.item!=='None') p.stockpile[target.item] = (p.stockpile[target.item]||0)+1;
    target.item = key;
  }

  applyLoadout(target);
  game.selectedOne = target;
  refreshUI();
}

  document.getElementById('eqSword').onclick=()=>spendLootOnSelected('Sword');
  document.getElementById('eqSpear').onclick=()=>spendLootOnSelected('Spear');
  document.getElementById('eqBow').onclick=()=>spendLootOnSelected('Bow');
  document.getElementById('eqLongbow').onclick=()=>spendLootOnSelected('Longbow');
  document.getElementById('eqLight').onclick=()=>spendLootOnSelected('Light');
  document.getElementById('eqHeavy').onclick=()=>spendLootOnSelected('Heavy');
  document.getElementById('eqShield').onclick=()=>spendLootOnSelected('Shield');
  document.getElementById('eqBoots').onclick=()=>spendLootOnSelected('Boots');
  document.getElementById('eqMedkit').onclick=()=>spendLootOnSelected('Medkit');
  document.getElementById('eqHorse').onclick=()=>spendLootOnSelected('Horse');
  document.getElementById('eqEngineer').onclick=()=>spendLootOnSelected('EngineerKit');
  document.getElementById('eqTrapKit').onclick=()=>spendLootOnSelected('TrapKit');
  document.getElementById('eqWarHorn').onclick=()=>spendLootOnSelected('WarHorn');
  document.getElementById('eqFireOil').onclick=()=>spendLootOnSelected('FireOil');

  function syncModeButtons(){
    [ui.modeMove,ui.modeDefend,ui.modeEscort,ui.modeAttackMove,ui.placeBarricade,ui.placeTrap].forEach(b=>b.classList.remove('active'));
    if(controlMode==='move') ui.modeMove.classList.add('active');
    if(controlMode==='defend') ui.modeDefend.classList.add('active');
    if(controlMode==='escort') ui.modeEscort.classList.add('active');
    if(controlMode==='attackmove') ui.modeAttackMove.classList.add('active');
    if(placementMode==='barricade') ui.placeBarricade.classList.add('active');
    if(placementMode==='trap') ui.placeTrap.classList.add('active');
    if(window.AcademyUI && typeof api!=='undefined') window.AcademyUI(api);
  }

  ui.modeMove.onclick=()=>{ controlMode='move'; placementMode=null; syncModeButtons(); };
  ui.modeDefend.onclick=()=>{ controlMode='defend'; placementMode=null; syncModeButtons(); };
  ui.modeEscort.onclick=()=>{ controlMode='escort'; placementMode=null; syncModeButtons(); };
  ui.modeAttackMove.onclick=()=>{ controlMode='attackmove'; placementMode=null; syncModeButtons(); };
  ui.placeBarricade.onclick=()=>{ placementMode='barricade'; syncModeButtons(); };
  ui.placeTrap.onclick=()=>{ placementMode='trap'; syncModeButtons(); };
  ui.cancelPlace.onclick=()=>{ placementMode=null; syncModeButtons(); };

  document.getElementById('selectAll').onclick=()=>{
    selectSquad(1);
  };

  document.getElementById('recall').onclick=()=>{
    const p = getPlayerHouse();
    issueFormationOrder(getSelectedUnits(), p.castle.x, p.castle.y, 'move', null, null, true);
  };

  document.getElementById('focusFlag').onclick=()=>{
    const targets = game.standards.filter(st=>st.controller!=='player' || st.dropped || st.carriedBy);
    if(!targets.length) return;
    targets.sort((a,b)=>dist(a.x,a.y,getPlayerHouse().castle.x,getPlayerHouse().castle.y)-dist(b.x,b.y,getPlayerHouse().castle.x,getPlayerHouse().castle.y));
    const st = targets[0];
    issueFormationOrder(getSelectedUnits(), st.x, st.y, 'capture', st.houseId, 'standard', true);
  };

  document.getElementById('restart').onclick=()=>init();

  addEventListener('keydown',e=>{
    if(e.defaultPrevented || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName||'') || e.target?.isContentEditable) return;
    if(e.altKey || ((e.ctrlKey||e.metaKey) && !['2','3','4'].includes(e.key)))return;
    const key=e.key.toLowerCase();
    if(e.key==='Escape'){
      e.preventDefault();
      if(placementMode){placementMode=null;controlMode='move';syncModeButtons();return;}
      if(window.onAcademyEscape){window.onAcademyEscape();return;}
      setPaused(!game.paused);return;
    }
    if(e.code==='Space' || e.key===' '){e.preventDefault();if(!e.repeat)setPaused(!game.paused);return;}
    if(game.gameOver) return;
    keysDown.add(e.key);
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();game.followMode=false;}
    if(['1','2','3','4'].includes(e.key)){
      e.preventDefault();
      if((e.ctrlKey||e.metaKey) && e.key!=='1') saveSquad(Number(e.key));
      else selectSquad(Number(e.key));
    }
    if(key==='r') document.getElementById('recall').click();
    if(key==='f'){e.preventDefault();focusParty();}
    if(key==='a') setMode('attackmove');
    if(key==='d') setMode('defend');
    if(key==='e') setMode('escort');
    if(key==='b') setMode('barricade');
    if(key==='t') setMode('trap');
  });
  addEventListener('keyup',e=>keysDown.delete(e.key));
  addEventListener('blur',()=>{keysDown.clear();});

  function getSelectedUnits(){
    return [...game.selected].map(id=>game.students.find(s=>s.id===id)).filter(Boolean);
  }

  function getRole(s){
    if(['Medkit','EngineerKit','TrapKit','WarHorn'].includes(s.item)) return 'support';
    if(s.weapon==='Bow'||s.weapon==='Longbow') return 'ranged';
    return 'vanguard';
  }

  function selectUnits(ids,follow=false){
    const wanted=new Set(ids);
    const units=game.students.filter(s=>wanted.has(s.id)&&s.controller==='player'&&s.state!=='knocked');
    game.selected=new Set(units.map(s=>s.id));
    game.selectedOne=units[0]||null;
    game.activeSquad=0;
    if(follow && units.length) focusParty();
    refreshUI();
    return units;
  }

  function getSquadUnits(index){
    const active=game.students.filter(s=>s.controller==='player'&&s.state!=='knocked');
    if(Number(index)===1)return active;
    const saved=game.squads[index];
    if(saved)return active.filter(s=>saved.includes(s.id));
    const role={2:'vanguard',3:'ranged',4:'support'}[index];
    return active.filter(s=>getRole(s)===role);
  }

  function getSquadName(index){
    return game.squads[index] ? `Squad ${index}` : ({1:'All students',2:'Vanguard',3:'Ranged',4:'Support'}[index]||'Selection');
  }

  function selectSquad(index,follow=false){
    const units=selectUnits(getSquadUnits(index).map(s=>s.id),follow);
    game.activeSquad=Number(index);
    refreshUI();
    return units;
  }

  function saveSquad(index){
    const units=getSelectedUnits().filter(s=>s.controller==='player'&&s.state!=='knocked');
    if(index<2 || index>4 || !units.length){log('Select students before saving a squad.');return false;}
    game.squads[index]=units.map(s=>s.id);
    game.activeSquad=Number(index);
    log(`Squad ${index} saved with ${units.length} students. Press ${index} to select it.`);
    refreshUI();
    return true;
  }

  function resetSquad(index){game.squads[index]=null;refreshUI();}

  function equipItemOn(s,key,replace=false){
    const stock=getPlayerHouse().stockpile;
    if(!s || s.controller!=='player' || s.state==='knocked' || !(stock[key]>0))return false;
    let slot=WEAPON_SET.has(key)?'weapon':ARMOR_SET.has(key)?'armor':ITEM_SET.has(key)?'item':key==='Horse'?'mount':null;
    if(!slot || s[slot]===key || (slot==='mount'&&s.mount))return false;
    if(slot!=='mount' && s[slot]!=='None' && !replace)return false;
    stock[key]--;
    if(slot!=='mount'&&s[slot]!=='None')stock[s[slot]]=(stock[s[slot]]||0)+1;
    s[slot]=slot==='mount'?true:key;
    if(slot==='weapon')s.weaponLevel=1;
    applyLoadout(s);
    return true;
  }

  function equipPreset(role){
    const aliases={frontline:'vanguard',archer:'ranged',medic:'support',scout:'cavalry'};
    role=aliases[role]||role;
    const presets={
      vanguard:{weapon:['Spear','Sword'],armor:['Heavy','Light'],item:['Shield','FireOil','Boots']},
      ranged:{weapon:['Longbow','Bow'],armor:['Light'],item:['Boots','FireOil','Shield']},
      support:{weapon:['Spear','Sword','Bow'],armor:['Light'],item:['Medkit','EngineerKit','TrapKit','WarHorn']},
      cavalry:{weapon:['Sword','Spear'],armor:['Light'],item:['Boots','WarHorn','Shield'],mount:['Horse']}
    };
    const selected=getSelectedUnits().filter(s=>s.controller==='player'&&s.state!=='knocked');
    let changed=0,missing=0;
    selected.forEach((s,i)=>{
      const chosen=role==='balanced'? (i%10<5?'vanguard':i%10<8?'ranged':i%10===8?'support':'cavalry'):role;
      const preset=presets[chosen];
      if(!preset)return;
      for(const [slot,choices]of Object.entries(preset)){
        if(slot==='mount'&&s.mount)continue;
        if(choices.includes(s[slot]))continue;
        const item=choices.find(k=>getPlayerHouse().stockpile[k]>0);
        if(item&&equipItemOn(s,item,true))changed++;
        else missing++;
      }
    });
    log(changed?`${changed} equipment changes applied from your supplies.`:'No matching spare equipment is available. Collect supply crates for more options.');
    refreshUI();
    return {changed,missing};
  }

  function autoEquipSelected(){
    const selected=getSelectedUnits().filter(s=>s.controller==='player'&&s.state!=='knocked');
    let changed=0;
    selected.forEach((s,i)=>{
      let desired=getRole(s);
      if(s.weapon==='None')desired=i%5===3?'ranged':i%5===4?'support':'vanguard';
      const stock=getPlayerHouse().stockpile;
      if(s.weapon==='None'){
        const choices=desired==='ranged'?['Longbow','Bow','Spear','Sword']:['Spear','Sword','Bow','Longbow'];
        const key=choices.find(k=>stock[k]>0);if(key&&equipItemOn(s,key))changed++;
      }else if(s.weapon==='Bow'&&s.weaponLevel<=1&&stock.Longbow>0){if(equipItemOn(s,'Longbow',true))changed++;}
      if(s.armor==='None'){
        const key=(getRole(s)==='vanguard'?['Heavy','Light']:['Light','Heavy']).find(k=>stock[k]>0);
        if(key&&equipItemOn(s,key))changed++;
      }
      if(s.item==='None'){
        const allied=game.students.filter(t=>t.controller==='player'&&t.state!=='knocked');
        const choices=!allied.some(t=>t.item==='Medkit')?['Medkit','Shield','Boots','EngineerKit','WarHorn']:getRole(s)==='ranged'?['Boots','FireOil','Shield']:['Shield','WarHorn','EngineerKit','Boots','Medkit'];
        const key=choices.find(k=>stock[k]>0);if(key&&equipItemOn(s,key))changed++;
      }
      if(!s.mount && getRole(s)==='vanguard' && s.weapon==='Sword'&&stock.Horse>0){if(equipItemOn(s,'Horse'))changed++;}
    });
    log(changed?`Party equipped: ${changed} items assigned.`:'Your selected students are equipped. Use a role preset to change their jobs.');
    refreshUI();
    return changed;
  }

  function setPaused(value){
    game.paused=!!value;
    keysDown.clear();
    refreshUI();
    if(window.onAcademyPause)window.onAcademyPause(game.paused);
    return game.paused;
  }

  function setDifficulty(value){
    const aliases={easy:'relaxed',hard:'veteran',standard:'normal'};
    value=aliases[value]||value;
    game.difficulty=['relaxed','normal','veteran'].includes(value)?value:'normal';
    refreshUI();return game.difficulty;
  }

  function centerCamera(x,y,follow=false){
    const r=canvas.getBoundingClientRect();
    game.cam.x=clamp(x-r.width/2,0,Math.max(0,WORLD_W-r.width));
    game.cam.y=clamp(y-r.height/2,0,Math.max(0,WORLD_H-r.height));
    game.followMode=follow;refreshUI();
  }

  function focusParty(){
    const selected=getSelectedUnits().filter(s=>s.controller==='player'&&s.state!=='knocked');
    const units=selected.length?selected:game.students.filter(s=>s.controller==='player'&&s.state!=='knocked');
    if(!units.length)return;
    const anchor=(game.selectedOne&&units.includes(game.selectedOne)?game.selectedOne:units[0]);
    const party=units.filter(s=>dist(s.x,s.y,anchor.x,anchor.y)<650);
    game.followTargetIds=units.map(s=>s.id);
    centerCamera(party.reduce((n,s)=>n+s.x,0)/party.length,party.reduce((n,s)=>n+s.y,0)/party.length,true);
  }

  function focusHome(){const home=getPlayerHouse().castle;centerCamera(home.x,home.y,false);}

  function setMode(name){
    if(name==='attackMove')name='attackmove';
    if(name==='barricade'||name==='trap'){placementMode=name;controlMode='move';}
    else{controlMode=['move','defend','escort','attackmove'].includes(name)?name:'move';placementMode=null;}
    syncModeButtons();return controlMode;
  }

  function setFormation(name){game.formation=['balanced','spread','column'].includes(name)?name:'balanced';refreshUI();return game.formation;}

  function stopSelected(){
    for(const s of getSelectedUnits())setOrder(s,{type:'idle',x:s.x,y:s.y,manual:false});
    refreshUI();
  }

  function exportSave(){
    const state={};
    const fields=['time','difficulty','cam','squads','activeSquad','formation','houses','standards','lootBoxes','groundLoot','barricades','traps','blacksmiths','objectives','terrain','gameOver','result','nextLootSpawnAt','nextBigMidLootAt','earlyBaseLootRemaining','followMode','followTargetIds','flagTargetId','logs'];
    for(const field of fields)state[field]=game[field];
    state.students=game.students.map(s=>({...s,path:[],pathIndex:0,attackAction:null}));
    state.selected=[...game.selected];
    state.selectedOneId=game.selectedOne?.id||null;
    state.controlMode=controlMode;
    return JSON.parse(JSON.stringify({version:2,savedAt:new Date().toISOString(),game:state}));
  }

  function importSave(data){
    let candidate;
    try{
      const fail=message=>{throw new Error(message);};
      const object=(value,label)=>{if(!value||typeof value!=='object'||Array.isArray(value))fail(`Invalid ${label}.`);return value;};
      const num=(value,min,max,label)=>{if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)fail(`Invalid ${label}.`);return value;};
      const bool=(value,label)=>{if(typeof value!=='boolean')fail(`Invalid ${label}.`);return value;};
      const text=(value,max,label)=>{if(typeof value!=='string'||value.length>max)fail(`Invalid ${label}.`);return value;};
      const choice=(value,allowed,label)=>{if(!allowed.includes(value))fail(`Invalid ${label}.`);return value;};
      const array=(value,max,label)=>{if(!Array.isArray(value)||value.length>max)fail(`Invalid ${label}.`);return value;};
      const houseIds=HOUSE_DEFS.map(h=>h.id),studentIds=HOUSE_DEFS.flatMap(h=>Array.from({length:10},(_,i)=>`${h.id}_${i}`));
      const houseId=(value,nullable=false)=>nullable&&value===null?null:choice(value,houseIds,'house allegiance');
      const studentId=(value,nullable=false)=>nullable&&value===null?null:choice(value,studentIds,'student identifier');
      const ids=(value,label)=>array(value,100,label).map(id=>studentId(id));
      const point=(raw,label)=>{object(raw,label);return {x:num(raw.x,0,WORLD_W,`${label} position`),y:num(raw.y,0,WORLD_H,`${label} position`)};};
      const entityId=(value,prefix)=>{text(value,70,'entity identifier');if(!new RegExp(`^${prefix}[A-Za-z0-9_]+$`).test(value))fail('Invalid entity identifier.');return value;};
      const escapeLog=value=>value.replace(/<[^>]*>/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      object(data,'saved trial');
      if(data.version!==2)fail('This save uses an unsupported version.');
      if(typeof data.savedAt!=='string'||!Number.isFinite(Date.parse(data.savedAt)))fail('Invalid save date.');
      const raw=object(data.game,'saved game');
      candidate={
        time:num(raw.time,0,1e8,'trial time'),
        difficulty:choice(raw.difficulty,['relaxed','normal','veteran'],'difficulty'),
        cam:point(raw.cam,'camera'),
        activeSquad:num(raw.activeSquad,0,4,'selected squad'),
        formation:choice(raw.formation,['balanced','spread','column'],'formation'),
        gameOver:bool(raw.gameOver,'trial result'),
        result:choice(raw.result,[null,'victory','defeat'],'trial result'),
        nextLootSpawnAt:num(raw.nextLootSpawnAt,0,1e9,'supply timer'),
        nextBigMidLootAt:num(raw.nextBigMidLootAt,0,1e9,'supply timer'),
        earlyBaseLootRemaining:num(raw.earlyBaseLootRemaining,0,20,'opening supplies'),
        followMode:bool(raw.followMode,'camera mode'),
        followTargetIds:ids(raw.followTargetIds,'followed party'),
        flagTargetId:raw.flagTargetId===undefined?null:houseId(raw.flagTargetId,true),
        logs:array(raw.logs,110,'event history').map(message=>escapeLog(text(message,1500,'event message')))
      };
      if(!Number.isInteger(candidate.activeSquad)||!Number.isInteger(candidate.earlyBaseLootRemaining))fail('Invalid saved count.');
      candidate.controlMode=choice(raw.controlMode,['move','defend','escort','attackmove'],'command mode');
      candidate.selected=ids(raw.selected,'selection');
      candidate.selectedOneId=studentId(raw.selectedOneId,true);
      object(raw.squads,'squads');candidate.squads={};
      for(const slot of [2,3,4])candidate.squads[slot]=raw.squads[slot]===null?null:ids(raw.squads[slot],'saved squad');

      const readRaid=value=>{
        if(value===null)return null;
        object(value,'raid');
        return {targetHouseId:houseId(value.targetHouseId),ids:ids(value.ids,'raiding party'),reserveIds:ids(value.reserveIds,'raid reserve'),escortIds:ids(value.escortIds,'raid escorts'),vanguardIds:ids(value.vanguardIds,'raid vanguard'),startedAt:num(value.startedAt,0,1e9,'raid time'),lastPressureAt:num(value.lastPressureAt,0,1e9,'raid time'),style:choice(value.style,['battle','snatch'],'raid style'),sizeType:choice(value.sizeType,['small','medium','major'],'raid size'),stage:choice(value.stage,['clear','approach','escape','takeFlag','snatch'],'raid stage')};
      };
      const houseRows=array(raw.houses,10,'houses');
      if(houseRows.length!==10||new Set(houseRows.map(h=>h?.id)).size!==10)fail('The saved trial must contain all ten houses.');
      candidate.houses=houseRows.map(row=>{
        object(row,'house');const id=houseId(row.id),definition=HOUSE_DEFS.find(h=>h.id===id);
        object(row.stockpile,'supplies');const stockpile={};
        for(const key of LOOT_KEYS){stockpile[key]=num(row.stockpile[key],0,1e6,'supply count');if(!Number.isInteger(stockpile[key]))fail('Invalid supply count.');}
        object(row.ai,'house strategy');
        return {...definition,castle:{...definition.castle},controller:houseId(row.controller),previousController:row.previousController===undefined?null:houseId(row.previousController,true),lastCapturedAt:row.lastCapturedAt===undefined?-1:num(row.lastCapturedAt,-1,1e9,'castle capture time'),stockpile,ai:{thinkAt:num(row.ai.thinkAt,0,1e9,'strategy timer'),aggression:num(row.ai.aggression,0,1,'house aggression'),regroupUntil:num(row.ai.regroupUntil,0,1e9,'regroup timer'),raid:readRaid(row.ai.raid)}};
      });
      for(const house of candidate.houses){const ruler=candidate.houses.find(h=>h.id===house.controller);if(ruler.controller!==ruler.id)fail('The saved house allegiances are inconsistent.');}

      const studentRows=array(raw.students,100,'students');
      if(studentRows.length!==100||new Set(studentRows.map(s=>s?.id)).size!==100)fail('The saved trial must contain all one hundred students.');
      const orderTypes=['idle','move','attackMove','capture','attack','heal','escort','box','groundLoot','attackBarricade','returnBanner','defend','buildBarricade','buildTrap'];
      candidate.students=studentRows.map(row=>{
        object(row,'student');const id=studentId(row.id),origHouse=id.slice(0,id.lastIndexOf('_')),index=Number(id.slice(id.lastIndexOf('_')+1));
        if(row.origHouse!==origHouse)fail('Invalid student origin.');
        const controller=houseId(row.controller);
        if(controller!==candidate.houses.find(h=>h.id===origHouse).controller)fail('Student allegiance does not match its house.');
        const definition=HOUSE_DEFS.find(h=>h.id===origHouse),p=point(row,'student');
        const weapon=choice(row.weapon,['None',...WEAPON_SET],'weapon'),armor=choice(row.armor,['None',...ARMOR_SET],'armor'),item=choice(row.item,['None',...ITEM_SET],'specialist equipment');
        const weaponLevel=num(row.weaponLevel,0,3,'weapon level');if(!Number.isInteger(weaponLevel))fail('Invalid weapon level.');
        const rawOrder=object(row.order,'student command');
        const targetType=choice(rawOrder.targetType,[null,'student','standard','box','ground','barricade'],'command target');
        const targetId=rawOrder.targetId===null?null:text(rawOrder.targetId,70,'command target');
        const order={type:choice(rawOrder.type,orderTypes,'student command'),...point(rawOrder,'command'),targetType,targetId,manual:bool(rawOrder.manual,'command mode')};
        if(targetType==='student'&&targetId!==null)studentId(targetId);
        if(targetType==='standard'&&targetId!==null)houseId(targetId);
        const s={id,name:NAMES[(definition.name.length*11+index*5)%NAMES.length]+' '+(index+1),origHouse,controller,...p,tx:num(row.tx,0,WORLD_W,'destination'),ty:num(row.ty,0,WORLD_H,'destination'),path:[],pathIndex:0,hp:num(row.hp,0,300,'health'),maxHp:100,state:choice(row.state,['idle','move','fight','knocked'],'student state'),koUntil:num(row.koUntil,0,1e9,'recovery timer'),order,engageId:studentId(row.engageId,true),facingDir:choice(row.facingDir,['up','down','left','right'],'facing'),attackCd:num(row.attackCd,-1,10,'attack timer'),radius:10,swing:num(row.swing,-1,2,'attack animation'),swingSide:choice(row.swingSide,[-1,1],'attack animation'),draw:num(row.draw,-1,2,'bow animation'),mount:bool(row.mount,'mount'),carryingStandard:houseId(row.carryingStandard,true),weapon,weaponLevel,armor,item,slaveDebuff:controller!==origHouse,trappedUntil:num(row.trappedUntil,0,1e9,'trap timer'),buildProgress:num(row.buildProgress,0,10,'build progress'),healTargetId:studentId(row.healTargetId,true),justRespawned:bool(row.justRespawned,'recovery state'),engineerCdUntil:num(row.engineerCdUntil,0,1e9,'engineer timer'),smithTimer:num(row.smithTimer,0,40,'forge progress'),smithingAt:row.smithingAt===null?null:choice(row.smithingAt,['forge1','forge2','forge3'],'forge'),lastPathAt:candidate.time-.5,lastPosX:p.x,lastPosY:p.y,burnUntil:num(row.burnUntil,0,1e9,'burn timer'),bracedUntil:row.bracedUntil===undefined?0:num(row.bracedUntil,0,1e9,'brace timer'),lastCombatLabelAt:row.lastCombatLabelAt===undefined?-1:num(row.lastCombatLabelAt,-1,1e9,'combat feedback'),roleHint:row.roleHint===undefined?'vanguard':choice(row.roleHint,['vanguard','ranged','support'],'party role')};
        if(s.state==='knocked'&&s.hp!==0)fail('Invalid knocked-out health.');
        s.attackAction=null;s.swing=0;s.draw=0;
        s.lastAttackReleaseAt=row.lastAttackReleaseAt===undefined?-1:num(row.lastAttackReleaseAt,-1,1e9,'attack release time');
        s.lastDamagedAt=row.lastDamagedAt===undefined?-1:num(row.lastDamagedAt,-1,1e9,'last damage time');
        s.damageSerial=row.damageSerial===undefined?0:num(row.damageSerial,0,1e9,'damage history');
        s.flagCaptureId=row.flagCaptureId===undefined?null:houseId(row.flagCaptureId,true);
        s.flagCaptureProgress=row.flagCaptureProgress===undefined?0:num(row.flagCaptureProgress,0,FLAG_CAPTURE_DURATION,'standard capture progress');
        s.flagCaptureBlockedId=row.flagCaptureBlockedId===undefined?null:houseId(row.flagCaptureBlockedId,true);
        s.flagCaptureRetryAt=row.flagCaptureRetryAt===undefined?0:num(row.flagCaptureRetryAt,0,1e9,'capture recovery timer');
        return s;
      });

      const readEntities=(value,max,prefix,read)=>{
        const rows=array(value,max,prefix),seen=new Set();
        return rows.map(row=>{object(row,prefix);const id=entityId(row.id,prefix);if(seen.has(id))fail('Duplicate battlefield entity.');seen.add(id);return {id,...point(row,prefix),...read(row)};});
      };
      const health=row=>{
        const maxHp=num(row.maxHp,1,1000,'entity health');
        // Earlier versions retained overkill damage on already-destroyed scenery.
        const hp=Math.max(0,num(row.hp,row.alive===false?-1e6:0,maxHp,'entity health'));
        return {hp,maxHp};
      };
      candidate.lootBoxes=readEntities(raw.lootBoxes,4000,'box_',row=>({...health(row),loot:array(row.loot,20,'crate contents').map(item=>choice(item,LOOT_KEYS,'loot')),alive:bool(row.alive,'crate state'),rare:bool(row.rare,'crate rarity'),big:bool(row.big,'crate size')}));
      candidate.groundLoot=readEntities(raw.groundLoot,4000,'ground_',row=>({item:choice(row.item,LOOT_KEYS,'ground loot'),alive:bool(row.alive,'ground loot state')}));
      candidate.barricades=readEntities(raw.barricades,1000,'bar_',row=>({...health(row),w:num(row.w,1,200,'barricade size'),h:num(row.h,1,200,'barricade size'),controller:houseId(row.controller),alive:bool(row.alive,'barricade state')}));
      candidate.traps=readEntities(raw.traps,2000,'trap_',row=>({controller:houseId(row.controller),alive:bool(row.alive,'trap state')}));
      const smiths=array(raw.blacksmiths,3,'blacksmiths');
      if(smiths.length!==3||new Set(smiths.map(f=>f?.id)).size!==3)fail('Invalid forge sites.');
      candidate.blacksmiths=smiths.map(row=>({id:choice(row.id,['forge1','forge2','forge3'],'forge identifier'),...point(row,'forge'),w:num(row.w,1,200,'forge size'),h:num(row.h,1,200,'forge size')}));
      const objectives=array(raw.objectives,4,'objectives');
      if(objectives.length!==4||new Set(objectives.map(o=>o?.id)).size!==4)fail('Invalid objectives.');
      candidate.objectives=objectives.map(row=>{
        object(row,'objective');const type=choice(row.type,['forge','rally','arsenal','sanctum'],'objective type');
        if(row.id!==`obj_${type}`)fail('Invalid objective identifier.');
        object(row.progress,'capture progress');const progress={};
        for(const [id,value]of Object.entries(row.progress))progress[houseId(id)]=num(value,0,8,'capture progress');
        const leader=Object.entries(progress).sort((a,b)=>b[1]-a[1])[0];
        return {id:row.id,type,...point(row,'objective'),r:num(row.r,10,200,'objective radius'),controller:houseId(row.controller,true),progress,contested:row.contested===undefined?false:bool(row.contested,'contested objective'),captureHouse:leader?leader[0]:null,captureProgress:leader?leader[1]:0,capturePercent:leader?leader[1]/8:0};
      });
      const flagRows=array(raw.standards,10,'standards');
      if(flagRows.length!==10||new Set(flagRows.map(f=>f?.houseId)).size!==10)fail('Invalid house standards.');
      candidate.standards=flagRows.map(row=>{
        object(row,'standard');
        return {houseId:houseId(row.houseId),controller:houseId(row.controller),...point(row,'standard'),carriedBy:studentId(row.carriedBy,true),homeOwner:houseId(row.homeOwner),dropped:bool(row.dropped,'dropped standard'),returning:bool(row.returning,'returning standard'),captureStudentId:row.captureStudentId===undefined?null:studentId(row.captureStudentId,true),captureController:row.captureController===undefined?null:houseId(row.captureController,true),captureProgress:row.captureProgress===undefined?0:num(row.captureProgress,0,FLAG_CAPTURE_DURATION,'standard capture progress'),captureDuration:FLAG_CAPTURE_DURATION,captureContested:row.captureContested===undefined?false:bool(row.captureContested,'contested standard'),captureInterruptedUntil:row.captureInterruptedUntil===undefined?0:num(row.captureInterruptedUntil,0,1e9,'capture interruption'),captureDamageSerial:row.captureDamageSerial===undefined?0:num(row.captureDamageSerial,0,1e9,'capture damage history')};
      });
      for(const standard of candidate.standards){
        if(standard.controller!==candidate.houses.find(h=>h.id===standard.houseId).controller)fail('Standard allegiance does not match its house.');
        if(standard.carriedBy){const carrier=candidate.students.find(s=>s.id===standard.carriedBy);if(carrier.carryingStandard!==standard.houseId||carrier.state==='knocked')fail('Invalid standard carrier.');}
        if(standard.captureStudentId){const capturer=candidate.students.find(s=>s.id===standard.captureStudentId);if(capturer.flagCaptureId!==standard.houseId||capturer.controller!==standard.captureController||capturer.state==='knocked'||standard.carriedBy)fail('Invalid standard capture channel.');}
      }
      for(const s of candidate.students){
        if(s.carryingStandard&&candidate.standards.find(f=>f.houseId===s.carryingStandard).carriedBy!==s.id)fail('Invalid carried standard.');
        if(s.flagCaptureId&&candidate.standards.find(f=>f.houseId===s.flagCaptureId).captureStudentId!==s.id)fail('Invalid capturing student.');
        const targetEntities={box:candidate.lootBoxes,ground:candidate.groundLoot,barricade:candidate.barricades};
        if(s.order.targetId&&targetEntities[s.order.targetType]&&!targetEntities[s.order.targetType].some(e=>e.id===s.order.targetId))fail('Missing command target.');
      }
      const terrain=object(raw.terrain,'terrain');candidate.terrain={};
      const readShapes=(name,extra,max=300)=>array(terrain[name],max,`${name} terrain`).map(row=>{const value=point(row,`${name} terrain`);for(const key of extra)value[key]=num(row[key],.1,2000,`${name} size`);return value;});
      candidate.terrain.dirt=readShapes('dirt',['r']);
      candidate.terrain.waters=readShapes('waters',['rx','ry']);
      candidate.terrain.forestRects=readShapes('forestRects',['w','h']);
      candidate.terrain.hills=readShapes('hills',['r']);
      candidate.terrain.stones=readShapes('stones',['r']);
      candidate.terrain.rivers=array(terrain.rivers,10,'rivers').map(row=>({width:num(row.width,1,200,'river width'),points:array(row.points,100,'river path').map(p=>point(p,'river'))}));
      const winner=candidate.houses.every(h=>h.controller==='player')?'victory':candidate.houses.find(h=>h.id==='player').controller!=='player'?'defeat':null;
      if(candidate.gameOver!==!!winner||candidate.result!==winner)fail('Invalid trial result.');
    }catch(error){return {ok:false,error:error.message||'This saved trial is damaged.'};}

    // Commit only after the entire document and its cross-references are valid.
    for(const [key,value]of Object.entries(candidate))if(!['selected','selectedOneId','controlMode'].includes(key))game[key]=value;
    game.selected=new Set(candidate.selected.filter(id=>game.students.some(s=>s.id===id&&s.controller==='player'&&s.state!=='knocked')));
    game.selectedOne=game.students.find(s=>s.id===candidate.selectedOneId&&game.selected.has(s.id))||game.students.find(s=>game.selected.has(s.id))||null;
    game.paused=true;game.last=0;game.drag=null;game.particles=[];game.projectiles=[];game.combatEvents=[];game.hitEffects=[];
    controlMode=candidate.controlMode;placementMode=null;mouseWorld={x:0,y:0};keysDown.clear();lastUIAt=-1;
    rebuildWalkableGrid();
    const placed=[];
    for(const s of game.students){
      applyLoadout(s);
      if(!terrainClear(s.x,s.y,s.radius)){const safe=resolveDestination(s.x,s.y,s.radius,placed);s.x=safe.x;s.y=safe.y;}
      placed.push({x:s.x,y:s.y,radius:s.radius});
      if(s.order.type==='idle'){s.order.x=s.x;s.order.y=s.y;s.tx=s.x;s.ty=s.y;}
      else{const destination=resolveDestination(s.tx,s.ty,s.radius);s.tx=destination.x;s.ty=destination.y;}
      if(s.carryingStandard){const home=getHouse(s.controller).castle;s.order={type:'returnBanner',x:home.x,y:home.y,targetId:null,targetType:null,manual:true};s.tx=home.x;s.ty=home.y;}
      if(s.flagCaptureId){const standard=getStandard(s.flagCaptureId);if(dist(s.x,s.y,standard.x,standard.y)>FLAG_CAPTURE_RADIUS)clearFlagCapture(standard);else s.flagCaptureProgress=standard.captureProgress;}
    }
    const view=canvas.getBoundingClientRect();game.cam.x=clamp(game.cam.x,0,Math.max(0,WORLD_W-view.width));game.cam.y=clamp(game.cam.y,0,Math.max(0,WORLD_H-view.height));
    refreshUI();
    if(window.onAcademyPause)window.onAcademyPause(true);
    return {ok:true};
  }

  function setFollowTargets(units){
    game.followTargetIds = units.map(u=>u.id);
    game.followMode = true;
  }

  function issueFormationOrder(units, x, y, type='move', targetId=null, targetType=null, manual=true){
    units = units.filter(Boolean).filter(s=>s.controller==='player' && s.state!=='knocked');
    if(!units.length) return;
    if(type==='capture'&&targetId&&manual)game.flagTargetId=targetId;
    const cols = game.formation==='column'?2:Math.ceil(Math.sqrt(units.length));
    const spacing = game.formation==='spread'?58:game.formation==='column'?32:38;
    const cx=units.reduce((n,s)=>n+s.x,0)/units.length,cy=units.reduce((n,s)=>n+s.y,0)/units.length;
    if(['move','defend','attackMove'].includes(type)){
      const body=Math.max(...units.map(s=>s.radius||13));
      if(!terrainClear(x,y,body)){
        // An invalid group click has one approach-side anchor, so a lake cannot split the party across shores.
        let approach={x:cx,y:cy};
        if(!terrainClear(approach.x,approach.y,body)){
          const pivot=units.includes(game.selectedOne)?game.selectedOne:units[0];
          approach=resolveDestination(pivot.x,pivot.y,body);
        }
        let near=approach;
        const steps=Math.max(1,Math.ceil(dist(approach.x,approach.y,x,y)/10));
        for(let step=1;step<=steps;step++){
          const point={x:lerp(approach.x,x,step/steps),y:lerp(approach.y,y,step/steps)};
          if(!terrainClear(point.x,point.y,body+28))break;
          near=point;
        }
        const anchor=resolveDestination(near.x,near.y,body);
        x=anchor.x;y=anchor.y;
      }
    }
    let dx=x-cx,dy=y-cy;
    const length=Math.hypot(dx,dy)||1;dx/=length;dy/=length;
    const roles={vanguard:[],ranged:[],support:[]};
    units.forEach(s=>roles[getRole(s)].push(s));
    const flagRunner=type==='capture' ? [...units].filter(s=>!s.carryingStandard).sort((a,b)=>b.moveSpeed-a.moveSpeed)[0] : null;
    const reserved=[];
    for(let i=0;i<units.length;i++){
      const col = i % cols;
      const row = Math.floor(i / cols);
      let lateral=(col-(cols-1)/2)*spacing;
      let depth=(row-(Math.ceil(units.length/cols)-1)/2)*spacing;
      if(game.formation==='balanced'){
        const role=getRole(units[i]),members=roles[role],j=members.indexOf(units[i]);
        const perRow=6,rowIndex=Math.floor(j/perRow),rowCount=Math.min(perRow,members.length-rowIndex*perRow);
        lateral=(j%perRow-(rowCount-1)/2)*32;
        const vanguardRows=Math.ceil(roles.vanguard.length/perRow),rangedRows=Math.ceil(roles.ranged.length/perRow);
        depth=role==='vanguard'?36-rowIndex*36:role==='ranged'?36-vanguardRows*36-28-rowIndex*34:36-vanguardRows*36-28-rangedRows*34-24-rowIndex*30;
      }
      const ox=-dy*lateral+dx*depth;
      const oy=dx*lateral+dy*depth;
      const destination=resolveDestination(x+ox,y+oy,units[i].radius||13,reserved);
      reserved.push({...destination,radius:units[i].radius||13});
      if(type==='capture' && units[i]===flagRunner){
        setOrder(units[i],{type:'capture',x,y,targetId,targetType:'standard',manual});
      }else if(type==='capture'){
        setOrder(units[i],{type:'attackMove',x:destination.x,y:destination.y,manual});
      }else setOrder(units[i], {type, x:destination.x, y:destination.y, targetId, targetType, manual});
    }
    setFollowTargets(units);
    refreshUI();
  }

  function nearestAvailableEngineer(x,y){
    const units = getSelectedUnits().filter(s=>isEngineer(s) && s.controller==='player' && s.state!=='knocked' && s.engineerCdUntil<=game.time);
    if(!units.length) return null;
    units.sort((a,b)=>dist(a.x,a.y,x,y)-dist(b.x,b.y,x,y));
    return units[0];
  }

  function issueBuildOrder(x, y, type){
    const builder = nearestAvailableEngineer(x,y);
    if(!builder){
      log(`<span style="color:#ffd5d5">No available engineer is ready.</span>`);
      return;
    }
    setOrder(builder, { type, x, y, manual:true });
    setFollowTargets([builder]);
    log(`<span style="color:${getPlayerHouse().color}">${builder.name}</span> moves to place a ${type==='buildBarricade'?'barricade':'trap'}.`);
    refreshUI();
  }

  canvas.addEventListener('contextmenu', e=>e.preventDefault());
  canvas.addEventListener('mousemove', e=>{
    const r=canvas.getBoundingClientRect();
    mouseWorld = screenToWorld(e.clientX-r.left,e.clientY-r.top);
    if(game.drag?.active){
      game.drag.x1=mouseWorld.x;
      game.drag.y1=mouseWorld.y;
    }
  });

  canvas.addEventListener('mousedown', e=>{
    if(game.gameOver)return;
    const r=canvas.getBoundingClientRect();
    const p=screenToWorld(e.clientX-r.left,e.clientY-r.top);

    if(e.button===0){
      game.drag={x0:p.x,y0:p.y,x1:p.x,y1:p.y,active:true,additive:e.shiftKey,previous:[...game.selected]};
      game.activeSquad=0;
      const hit = hitStudent(p.x,p.y, s=>s.controller==='player' && s.state!=='knocked');
      if(hit){
        if(!e.shiftKey) game.selected.clear();
        game.selected.add(hit.id);
        game.selectedOne=hit;
        renderSelected(); renderSelectionPanel();
      }else if(!e.shiftKey){
        game.selected.clear();
        game.selectedOne = null;
        renderSelected(); renderSelectionPanel();
      }
    } else if(e.button===2){
      const sel = getSelectedUnits();
      if(!sel.length && !placementMode) return;

      if(placementMode==='barricade'){
        issueBuildOrder(p.x, p.y, 'buildBarricade');
        placementMode=null; syncModeButtons(); return;
      }
      if(placementMode==='trap'){
        issueBuildOrder(p.x, p.y, 'buildTrap');
        placementMode=null; syncModeButtons(); return;
      }

      const enemy = hitStudent(p.x,p.y, s=>s.controller!=='player' && s.state!=='knocked');
      const allyInjured = hitStudent(p.x,p.y, s=>s.controller==='player' && s.state!=='knocked' && s.hp < s.maxHp);
      const box = hitBox(p.x,p.y);
      const std = hitStandard(p.x,p.y);
      const barricade = hitBarricade(p.x,p.y);
      const ground = hitGroundLoot(p.x,p.y);

      const medics = sel.filter(s=>s.item==='Medkit');
      if(allyInjured && medics.length){
        for(const m of medics){
          setOrder(m, {type:'heal', x:allyInjured.x, y:allyInjured.y, targetId:allyInjured.id, targetType:'student', manual:true});
        }
        const others = sel.filter(s=>s.item!=='Medkit');
        if(others.length) issueFormationOrder(others, p.x, p.y, 'move', null, null, true);
        setFollowTargets(sel);
        refreshUI();
        return;
      }

      if(ground){
        issueFormationOrder(sel, ground.x, ground.y, 'groundLoot', ground.id, 'ground', true);
      }else if(box){
        issueFormationOrder(sel, box.x, box.y, 'box', box.id, 'box', true);
      }else if(barricade && barricade.controller!=='player'){
        issueFormationOrder(sel, barricade.x, barricade.y, 'attackBarricade', barricade.id, 'barricade', true);
      }else if(enemy){
        issueFormationOrder(sel, enemy.x, enemy.y, 'attack', enemy.id, 'student', true);
      }else if(std){
        const carrier=std.carriedBy&&game.students.find(s=>s.id===std.carriedBy&&s.state!=='knocked');
        game.flagTargetId=std.houseId;
        if(carrier){
          issueFormationOrder(sel.filter(s=>s!==carrier),carrier.x,carrier.y,carrier.controller==='player'?'escort':'attack',carrier.id,'student',true);
        }else if(std.controller!=='player'||std.dropped)issueFormationOrder(sel, std.x, std.y, 'capture', std.houseId, 'standard', true);
      }else if(controlMode==='defend'){
        issueFormationOrder(sel, p.x, p.y, 'defend', null, null, true);
      }else if(controlMode==='escort'){
        const carrier = sel.find(s=>s.carryingStandard);
        if(carrier) issueFormationOrder(sel.filter(s=>s!==carrier), carrier.x, carrier.y, 'escort', carrier.id, 'student', true);
        else issueFormationOrder(sel, p.x, p.y, 'move', null, null, true);
      }else if(controlMode==='attackmove'){
        issueFormationOrder(sel, p.x, p.y, 'attackMove', null, null, true);
      }else{
        issueFormationOrder(sel, p.x, p.y, 'move', null, null, true);
      }
    }
  });

  addEventListener('mouseup', ()=>{
    if(!game.drag?.active) return;
    const d=game.drag; d.active=false;
    const minx=Math.min(d.x0,d.x1), maxx=Math.max(d.x0,d.x1);
    const miny=Math.min(d.y0,d.y1), maxy=Math.max(d.y0,d.y1);
    if(Math.abs(maxx-minx)>8 || Math.abs(maxy-miny)>8){
      if(d.additive)game.selected=new Set(d.previous);
      else game.selected.clear();
      for(const s of game.students){
        if(s.controller==='player' && s.state!=='knocked' && s.x>=minx && s.x<=maxx && s.y>=miny && s.y<=maxy) game.selected.add(s.id);
      }
      const first = game.students.find(s=>game.selected.has(s.id));
      game.selectedOne = first || null;
      renderSelected(); renderSelectionPanel();
    }
  });

  function screenToWorld(mx,my){ return {x:mx+game.cam.x, y:my+game.cam.y}; }

  function hitStudent(x,y,pred){
    for(let i=game.students.length-1;i>=0;i--){
      const s=game.students[i];
      if(s.state==='knocked') continue;
      if(pred && !pred(s)) continue;
      if(dist(x,y,s.x,s.y) <= s.radius+8) return s;
    }
    return null;
  }
  function hitBox(x,y){ for(const b of game.lootBoxes){ if(b.alive && Math.abs(x-b.x)<18 && Math.abs(y-b.y)<18) return b; } return null; }
  function hitGroundLoot(x,y){ for(const g of game.groundLoot){ if(g.alive && dist(x,y,g.x,g.y) < 14) return g; } return null; }
  function hitStandard(x,y){
    const candidates=game.standards.filter(st=>dist(x,y,st.x,st.y)<25||(Math.abs(x-st.x)<31&&y>st.y-88&&y<st.y+17));
    candidates.sort((a,b)=>dist(x,y,a.x,a.y-36)-dist(x,y,b.x,b.y-36));
    if(candidates[0])return candidates[0];
    for(const house of game.houses){
      const standard=getStandard(house.id);
      if(!standard||standard.carriedBy||standard.controller==='player'||dist(standard.x,standard.y,house.castle.x,house.castle.y)>150)continue;
      if(Math.abs(x-house.castle.x)<=115&&y>=house.castle.y-220&&y<=house.castle.y+72)return standard;
    }
    return null;
  }
  function hitBarricade(x,y){ for(const b of game.barricades){ if(b.alive && x > b.x - b.w/2 && x < b.x + b.w/2 && y > b.y - b.h/2 && y < b.y + b.h/2) return b; } return null; }

  function nearestEnemyInAggro(s){
    let best=null, bd=1e9;
    for(const e of game.students){
      if(e.state==='knocked' || !enemies(s,e)) continue;
      const d=dist(s.x,s.y,e.x,e.y);
      if(d < bd && d <= s.aggro){ bd=d; best=e; }
    }
    return best;
  }

  function nearestEnemyWithin(s, range){
    let best=null, bd=1e9;
    for(const e of game.students){
      if(e.state==='knocked' || !enemies(s,e)) continue;
      const d=dist(s.x,s.y,e.x,e.y);
      if(d < bd && d <= range){ bd=d; best=e; }
    }
    return best;
  }

  function nearestLootTaskTarget(houseId){
    const house = getHouse(houseId);
    const boxes = game.lootBoxes.filter(b=>b.alive);
    const ground = game.groundLoot.filter(g=>g.alive);
    const all = [
      ...boxes.map(x=>({kind:'box', obj:x, d:dist(house.castle.x,house.castle.y,x.x,x.y)})),
      ...ground.map(x=>({kind:'ground', obj:x, d:dist(house.castle.x,house.castle.y,x.x,x.y)}))
    ].sort((a,b)=>a.d-b.d);
    return all[0] || null;
  }

  function weakHouseTargetFor(house){
    const others = game.houses.filter(h=>h.id!==house.id && h.controller!==house.id);
    if(!others.length) return null;
    return others.map(t=>{
      const d = dist(house.castle.x,house.castle.y,t.castle.x,t.castle.y);
      const defenders = game.students.filter(s=>s.controller===t.id && s.state!=='knocked' && dist(s.x,s.y,t.castle.x,t.castle.y) < 300).length;
      const active = game.students.filter(s=>s.controller===t.id && s.state!=='knocked').length;
      const mids = game.objectives.filter(o=>o.controller===t.id).length;
      const score = d*0.55 + defenders*65 + active*8 + mids*28;
      return {house:t, score};
    }).sort((a,b)=>a.score-b.score)[0]?.house || null;
  }

  function controlledHouseCount(controllerId){
    return game.houses.filter(h=>h.controller===controllerId).length;
  }

  function activeForceFor(controllerId){
    return game.students.filter(s=>s.controller===controllerId && s.state!=='knocked');
  }

  function frontlineForceFor(controllerId){
    return game.students.filter(s=>s.controller===controllerId && s.state!=='knocked' && s.weapon!=='None');
  }

  function houseMilitaryScore(controllerId){
    const active = activeForceFor(controllerId);
    const fighters = frontlineForceFor(controllerId);
    const equipped = active.filter(isEquipped).length;
    const mids = game.objectives.filter(o=>o.controller===controllerId).length;
    const ruled = controlledHouseCount(controllerId);
    return fighters.length * 2 + equipped + mids * 2 + ruled * 3;
  }

  function chooseRaidPlan(house, targetHouse){
    const myFighters = frontlineForceFor(house.id);
    const targetFighters = frontlineForceFor(targetHouse.id);
    const ruled = controlledHouseCount(house.id);
    const myScore = houseMilitaryScore(house.id);
    const theirScore = houseMilitaryScore(targetHouse.id);

    const strongAdvantage = myScore >= theirScore * 1.45 || myFighters.length >= targetFighters.length + 4 || ruled >= 2;
    const overwhelming = myScore >= theirScore * 1.9 || myFighters.length >= Math.max(2, targetFighters.length * 1.8) || ruled >= 3;

    let sizeType = 'small';
    if(overwhelming){
      sizeType = Math.random() < 0.70 ? 'major' : 'medium';
    }else if(strongAdvantage){
      const roll = Math.random();
      if(roll < 0.48) sizeType = 'major';
      else if(roll < 0.82) sizeType = 'medium';
      else sizeType = 'small';
    }else{
      const roll = Math.random();
      if(roll < 0.18) sizeType = 'major';
      else if(roll < 0.54) sizeType = 'medium';
      else sizeType = 'small';
    }

    let pct = 0.34;
    if(sizeType === 'medium') pct = 0.56;
    if(sizeType === 'major') pct = 0.80;

    if(ruled >= 2) pct += 0.05;
    if(ruled >= 3) pct += 0.05;
    pct = clamp(pct, 0.28, 0.90);

    const styleRoll = Math.random();
    let style = 'battle';
    if(sizeType === 'small'){
      style = styleRoll < 0.60 ? 'snatch' : 'battle';
    }else if(sizeType === 'medium'){
      style = styleRoll < 0.45 ? 'snatch' : 'battle';
    }else{
      style = styleRoll < 0.30 ? 'snatch' : 'battle';
    }

    return { sizeType, pct, style, strongAdvantage, overwhelming };
  }

  function updateObjectives(dt){
    for(const o of game.objectives){
      const nearby = {};
      for(const s of game.students){
        if(s.state==='knocked') continue;
        if(dist(s.x,s.y,o.x,o.y) <= o.r) nearby[s.controller]=(nearby[s.controller]||0)+1;
      }
      const teams=Object.keys(nearby);
      o.contested=teams.length>1;
      // A contested site freezes all capture progress. Ownership gives no hidden bank.
      if(!o.contested){
        const team=teams[0]||null;
        for(const id of Object.keys(o.progress)){
          o.progress[id]=clamp(o.progress[id]||0,0,8);
          if(id!==team) o.progress[id]=Math.max(0,o.progress[id]-dt*0.75);
        }
        if(team && team!==o.controller){
          o.progress[team]=clamp((o.progress[team]||0)+dt*Math.min(4,nearby[team])*0.5,0,8);
          if(o.progress[team]>=8){
            const previous=o.controller;
            o.controller=team;
            o.progress={};
            log(`<span style="color:${getHouse(team).color}">${getHouse(team).name}</span> secures the ${o.type}.`);
            for(const s of game.students) if(s.controller===team || s.controller===previous) applyLoadout(s);
          }
        }else if(team===o.controller){
          o.progress={};
        }
      }
      const leader=Object.entries(o.progress).sort((a,b)=>b[1]-a[1])[0];
      o.captureHouse=leader && leader[1]>0 ? leader[0] : null;
      o.captureProgress=leader ? leader[1] : 0;
      o.capturePercent=o.captureProgress/8;
    }
  }

  function combatMatchup(att,target){
    let multiplier=1, defense=target.defense, label='';
    if(att.weapon==='Spear' && target.mount){multiplier*=1.75;label='ANTI-CAVALRY';}
    const fv=facingVector(target.facingDir);
    const dx=att.x-target.x,dy=att.y-target.y,len=Math.hypot(dx,dy)||1;
    const facingDot=(dx*fv.x+dy*fv.y)/len;
    if(target.armor==='Heavy' && facingDot<-.25){
      defense=Math.max(0,defense-.18);
      multiplier*=1.20;
      label=label||'FLANK';
    }
    if(att.mount && (target.weapon==='Bow' || target.weapon==='Longbow')){
      multiplier*=1.30;label=label||'CAVALRY';
    }
    if(att.controller!=='player') multiplier*=game.difficulty==='relaxed'?.80:game.difficulty==='veteran'?1.12:1;
    return {multiplier,defense,label,facingDot};
  }

  function showCombatEvent(s,label,color='#f2ce82'){
    if(!label || s.lastCombatLabelAt>game.time-.75) return;
    s.lastCombatLabelAt=game.time;
    game.combatEvents.push({x:s.x,y:s.y-32,text:label,color,ttl:1.1});
    if(game.combatEvents.length>24) game.combatEvents.shift();
  }

  function tryShieldBlock(target, attacker){
    if(target.item !== 'Shield') return false;
    if(attacker.weapon !== 'Bow' && attacker.weapon !== 'Longbow') return false;

    const incX = attacker.x - target.x;
    const incY = attacker.y - target.y;
    const len = Math.hypot(incX, incY) || 1;
    const incoming = {x:incX/len, y:incY/len};
    const fv = facingVector(target.facingDir);
    const facingDot = incoming.x * fv.x + incoming.y * fv.y;

    let chance = 0.12;
    if(facingDot > 0.55) chance = 0.48;
    else if(facingDot > 0.20) chance = 0.34;
    else if(facingDot > -0.15) chance = 0.22;

    if(target.armor === 'Heavy') chance += 0.06;
    if(target.carryingStandard) chance += 0.04;
    chance = clamp(chance, 0.12, 0.62);

    if(Math.random() < chance){
      sparkBurst(target.x, target.y-4, '#ffe79e');
      showCombatEvent(target,'BLOCK','#a9d4f7');
      emitHitEffect(target.x,target.y-22,'block','BLOCK','#a9d4f7');
      return true;
    }
    return false;
  }

  function emitHitEffect(x,y,type,text,color='#f2d08a'){
    game.hitEffects.push({x,y,type,text,color,ttl:.55,maxTtl:.55});
    if(game.hitEffects.length>80)game.hitEffects.shift();
  }

  function cancelAttackAction(s){
    if(!s)return;
    s.attackAction=null;s.swing=0;s.draw=0;
  }

  function attackEntity(action){
    if(action.targetType==='student')return game.students.find(s=>s.id===action.targetId);
    if(action.targetType==='box')return game.lootBoxes.find(b=>b.id===action.targetId);
    return game.barricades.find(b=>b.id===action.targetId);
  }

  function targetIsValid(att,target,type){
    if(!att||att.state==='knocked'||!target)return false;
    if(type==='student')return target.state!=='knocked'&&target.hp>0&&enemies(att,target);
    return target.alive&&target.hp>0&&(type!=='barricade'||target.controller!==att.controller);
  }

  function attackReach(att,target,packet={targetType:'student',weapon:att.weapon,range:att.atkRange}){
    const padding=packet.targetType==='student'?(target?.radius||13):12;
    let reach=packet.range+padding;
    if(packet.targetType==='student'&&packet.weapon!=='Bow'&&packet.weapon!=='Longbow')reach=Math.max(reach,(att.radius||13)+(target?.radius||13)+12);
    return reach;
  }

  function beginAttack(att,target,targetType='student'){
    if(att.attackCd>0||att.attackAction||att.flagCaptureId||!targetIsValid(att,target,targetType))return false;
    if(dist(att.x,att.y,target.x,target.y)>attackReach(att,target,{targetType,weapon:att.weapon,range:att.atkRange}))return false;
    const ranged=att.weapon==='Bow'||att.weapon==='Longbow';
    const windup=att.weapon==='Longbow'?.40:att.weapon==='Bow'?.32:att.weapon==='Spear'?.28:att.weapon==='None'?.18:.23;
    const recovery=ranged?.20:.24;
    setFacingTowardPoint(att,target.x,target.y);
    att.attackAction={targetId:target.id,targetType,phase:'windup',elapsed:0,windup,recovery,duration:windup,progress:0,impactDone:false,released:false,weapon:att.weapon,item:att.item,damage:att.atkDmg,range:att.atkRange,controller:att.controller,originX:att.x,originY:att.y};
    att.attackCd=Math.max(att.baseAttackCd,windup+recovery);
    att.swing=0;att.draw=ranged?windup:0;
    return true;
  }

  function applyStudentDamage(target,amount,attacker){
    if(target.state==='knocked'||!(amount>0))return;
    target.hp=Math.max(0,target.hp-amount);target.lastDamagedAt=game.time;target.damageSerial=(target.damageSerial||0)+1;
    if(target.flagCaptureId)interruptFlagCapture(target,'damage');
    emitHitEffect(target.x,target.y-22,'hit','−'+Math.round(amount),target.controller==='player'?'#ff9b8b':'#ffe6a1');
    if(target.hp<=0)knockOut(target,attacker||{controller:target.controller});
  }

  function applyAttackImpact(att,target,packet){
    if(!targetIsValid(att,target,packet.targetType))return false;
    const snapshot={...att,weapon:packet.weapon,item:packet.item,atkDmg:packet.damage,atkRange:packet.range};
    if(packet.targetType==='student'){
      const ranged=packet.weapon==='Bow'||packet.weapon==='Longbow';
      if(ranged&&tryShieldBlock(target,snapshot))return true;
      const matchup=combatMatchup(snapshot,target);
      const raw=packet.damage*matchup.multiplier*(ranged?1:rand(.92,1.12));
      const dealt=Math.max(ranged?5:4,raw*(1-matchup.defense));
      showCombatEvent(target,matchup.label);
      if(packet.weapon==='Spear'&&target.mount)target.bracedUntil=game.time+.65;
      if(packet.item==='FireOil')target.burnUntil=Math.max(target.burnUntil,game.time+(ranged?3.2:2.7));
      for(let i=0;i<4;i++)addParticle({x:target.x,y:target.y,c:getHouse(att.controller).color,vx:rand(-45,45),vy:rand(-45,45),t:.2,r:2.1});
      applyStudentDamage(target,dealt,att);
      return true;
    }
    const mult=packet.item==='FireOil'?(packet.targetType==='box'?1.7:1.8):1;
    const dealt=packet.damage*mult*rand(.95,1.1);
    target.hp=Math.max(0,target.hp-dealt);
    emitHitEffect(target.x,target.y-15,'hit','−'+Math.round(dealt),'#ecd9a5');
    for(let i=0;i<3;i++)addParticle({x:target.x,y:target.y,c:'#d3b86b',vx:rand(-35,35),vy:rand(-35,35),t:.18,r:2});
    if(target.hp<=0){
      if(packet.targetType==='box')destroyBox(target,att.controller);
      else{target.alive=false;rebuildWalkableGrid();}
    }
    return true;
  }

  function resolveAttack(att,action){
    if(action.impactDone)return false;
    action.impactDone=true;
    const target=attackEntity(action);
    if(!targetIsValid(att,target,action.targetType)||att.controller!==action.controller||dist(att.x,att.y,target.x,target.y)>attackReach(att,target,action)){
      emitHitEffect(att.x,att.y-28,'miss','MISS','#b3c2c7');return false;
    }
    setFacingTowardPoint(att,target.x,target.y);
    att.lastAttackReleaseAt=game.time;
    if(action.weapon==='Bow'||action.weapon==='Longbow'){
      const startX=att.x,startY=att.y-8,endX=target.x,endY=target.y-5;
      const flightDuration=clamp(dist(startX,startY,endX,endY)/570,.1,.44);
      game.projectiles.push({x:startX,y:startY,startX,startY,endX,endY,x1:startX,y1:startY,x2:endX,y2:endY,flightElapsed:0,flightDuration,targetId:target.id,targetType:action.targetType,attackerId:att.id,weapon:action.weapon,item:action.item,damage:action.damage,range:action.range,controller:att.controller,inFlight:true,ttl:flightDuration+.05,impactDone:false});
      return true;
    }
    att.swing=action.recovery;
    att.swingSide=Math.random()<.5?-1:1;
    return applyAttackImpact(att,target,action);
  }

  function updateAttackActions(dt){
    if(game.paused||game.gameOver)return;
    for(const s of game.students){
      const action=s.attackAction;
      if(!action)continue;
      if(s.state==='knocked'||s.controller!==action.controller){cancelAttackAction(s);continue;}
      action.elapsed+=dt;
      if(action.phase==='windup'){
        action.progress=clamp(action.elapsed/action.windup,0,1);
        if(action.elapsed+1e-8>=action.windup){
          action.phase='release';action.elapsed=0;action.duration=action.recovery;action.progress=0;
          resolveAttack(s,action);
        }
      }else{
        action.progress=clamp(action.elapsed/action.recovery,0,1);
        if(action.elapsed>=action.recovery)cancelAttackAction(s);
      }
    }
  }

  function updateProjectiles(dt){
    if(game.paused||game.gameOver)return;
    for(let i=game.projectiles.length-1;i>=0;i--){
      const p=game.projectiles[i];
      if(!p.inFlight){p.ttl-=dt;if(p.ttl<=0)game.projectiles.splice(i,1);continue;}
      p.flightElapsed+=dt;
      const progress=clamp(p.flightElapsed/p.flightDuration,0,1);
      p.x=lerp(p.startX,p.endX,progress);p.y=lerp(p.startY,p.endY,progress);
      p.ttl=Math.max(0,p.flightDuration-p.flightElapsed);
      if(progress<1)continue;
      const attacker=game.students.find(s=>s.id===p.attackerId),target=attackEntity(p);
      const padding=p.targetType==='student'?(target?.radius||13):14;
      const atEndpoint=target&&dist(target.x,target.y-5,p.endX,p.endY)<=padding+7;
      const inRange=target&&dist(p.startX,p.startY,target.x,target.y-5)<=p.range+padding;
      if(!p.impactDone&&attacker&&attacker.controller===p.controller&&targetIsValid(attacker,target,p.targetType)&&atEndpoint&&inRange){
        p.impactDone=true;applyAttackImpact(attacker,target,p);
      }else emitHitEffect(p.endX,p.endY,'miss','MISS','#b3c2c7');
      game.projectiles.splice(i,1);
    }
  }

  function performBowShot(att,target){return beginAttack(att,target,'student');}
  function attackTarget(att,target){return beginAttack(att,target,'student');}

  function partAround(x,y,controllerId){
    for(const s of game.students){
      if(s.state==='knocked') continue;
      const d = dist(s.x,s.y,x,y);
      if(d < 42){
        const dx = s.x-x, dy = s.y-y;
        const dd = Math.max(1, Math.hypot(dx,dy));
        const nx=s.x+(dx/dd)*10,ny=s.y+(dy/dd)*10;
        if(terrainClear(nx,ny,s.radius||13)){s.x=nx;s.y=ny;}
      }
    }
    for(let i=0;i<6;i++) addParticle({x,y,c:getHouse(controllerId).color,vx:rand(-90,90),vy:rand(-90,90),t:.22,r:2.3});
  }

  function attackBox(att,box){return beginAttack(att,box,'box');}
  function attackBarricade(att,barricade){return beginAttack(att,barricade,'barricade');}

  function destroyBox(box, controllerId){
    box.hp=0;
    box.alive=false;
    const house=getHouse(controllerId);
    for(const item of box.loot) house.stockpile[item] = (house.stockpile[item]||0) + 1;
    log(`<span style="color:${house.color}">${house.name}</span> breaks a loot box and finds <b>${box.loot.join(', ')}</b>.`);
    if(controllerId==='player') renderStockSummary();
    refreshEquipButtons();
    partAround(box.x, box.y, controllerId);
    for(let i=0;i<10;i++) addParticle({x:box.x,y:box.y,c:'#d3b86b',vx:rand(-80,80),vy:rand(-80,80),t:.30,r:2.4});
  }

  function maybeDropKnockoutItem(target){
    const dropPool = [];
    if(target.weapon!=='None') dropPool.push(target.weapon);
    if(target.item!=='None') dropPool.push(target.item);
    if(target.armor!=='None' && Math.random()<0.35) dropPool.push(target.armor);
    if(target.mount && Math.random()<0.2) dropPool.push('Horse');
    if(!dropPool.length) return;
    if(Math.random() < 0.48){
      const item = dropPool[randi(0,dropPool.length-1)];
      spawnGroundLoot(target.x + rand(-6,6), target.y + rand(-6,6), item);
      if(WEAPON_SET.has(item)){target.weapon='None';target.weaponLevel=0;}
      else if(ARMOR_SET.has(item))target.armor='None';
      else if(ITEM_SET.has(item))target.item='None';
      else if(item==='Horse')target.mount=false;
      applyLoadout(target);
      log(`<span style="color:#d8bd66">Dropped gear:</span> ${item} falls to the ground.`);
    }
  }

  function knockOut(target, by){
    if(target.flagCaptureId)interruptFlagCapture(target,'knockout');
    cancelAttackAction(target);
    game.projectiles=game.projectiles.filter(p=>p.attackerId!==target.id);
    target.hp=0;
    target.state='knocked';
    target.koUntil=game.time + rand(12,18);
    target.engageId=null;
    target.order = {type:'idle', x:target.x, y:target.y, targetId:null, targetType:null, manual:false};
    target.path=[]; target.pathIndex=0;
    target.healTargetId = null;
    target.smithTimer = 0;
    target.smithingAt = null;
    target.burnUntil = 0;

    maybeDropKnockoutItem(target);

    if(target.carryingStandard){
      if(game.flagTargetId===target.carryingStandard)game.flagTargetId=null;
      const st = getStandard(target.carryingStandard);
      if(st){
        const safe=nearestWalkable(target.x,target.y);
        st.carriedBy=null;
        st.x=safe.gx*TILE+TILE/2; st.y=safe.gy*TILE+TILE/2;
        st.dropped=true; st.returning=false;
      }
      target.carryingStandard=null;
      applyLoadout(target);
      log(`<span style="color:${getHouse(target.controller).color}">${target.name}</span> is knocked out and drops the banner.`);
    }

    if(game.selected.has(target.id)) game.selected.delete(target.id);
    if(game.selectedOne && game.selectedOne.id===target.id) game.selectedOne=null;

    for(let i=0;i<6;i++) addParticle({x:target.x,y:target.y,c:getHouse(by.controller).color,vx:rand(-65,65),vy:rand(-65,65),t:.30,r:2.5});
    refreshUI();
  }

  function captureBanner(carrier, standard){
    clearFlagCapture(standard);
    standard.carriedBy = carrier.id;
    standard.dropped = false;
    standard.returning = true;
    carrier.carryingStandard = standard.houseId;
    applyLoadout(carrier);
    setOrder(carrier, {type:'returnBanner', x:getHouse(carrier.controller).castle.x, y:getHouse(carrier.controller).castle.y, manual:true});
    log(`<span style="color:${getHouse(carrier.controller).color}">${carrier.name}</span> takes the banner of <span style="color:${getHouse(standard.houseId).color}">${getHouse(standard.houseId).name}</span>.`);
    for(const ally of game.students){
      if(ally===carrier || ally.controller!==carrier.controller || ally.state==='knocked' || ally.order.type!=='attackMove')continue;
      if(dist(ally.x,ally.y,carrier.x,carrier.y)<280){
        setOrder(ally,{type:'escort',x:carrier.x,y:carrier.y,targetId:carrier.id,targetType:'student',manual:true});
      }
    }
  }

  function secureReturnedBanner(carrier, standard){
    const houseId = standard.houseId;
    if(game.flagTargetId===houseId)game.flagTargetId=null;
    const alreadyOwned=standard.controller===carrier.controller;
    carrier.carryingStandard = null;
    applyLoadout(carrier);
    standard.carriedBy = null;
    standard.dropped = false;
    standard.returning = false;
    standard.controller = carrier.controller;
    standard.x = getHouse(carrier.controller).castle.x;
    standard.y = getHouse(carrier.controller).castle.y - 34;
    if(alreadyOwned){
      log(`<span style="color:${getHouse(carrier.controller).color}">${getHouse(carrier.controller).name}</span> recovers its ${getHouse(houseId).name} standard.`);
    }else transferHouse(houseId, carrier.controller);
  }

  function transferHouse(houseId, newControllerId){
    const house = getHouse(houseId);
    if(!house || !getHouse(newControllerId)) return;
    const oldControllerId=house.controller;
    // Defeating a ruling house also changes the allegiance of its vassals.
    const transferred=game.houses.filter(h=>h.id===houseId || (houseId===oldControllerId && h.controller===oldControllerId));
    const transferredIds=new Set(transferred.map(h=>h.id));
    for(const h of transferred){
      if(h.controller!==newControllerId){h.previousController=h.controller;h.lastCapturedAt=game.time;}
      h.controller=newControllerId;
      if(h.id!==newControllerId){
        const supplies=getHouse(newControllerId).stockpile;
        for(const item of LOOT_KEYS){supplies[item]+=(h.stockpile[item]||0);h.stockpile[item]=0;}
      }
    }
    for(const s of game.students){
      if(transferredIds.has(s.origHouse)){
        if(s.flagCaptureId)interruptFlagCapture(s,'allegiance');
        cancelAttackAction(s);
        if(s.carryingStandard){
          if(game.flagTargetId===s.carryingStandard)game.flagTargetId=null;
          const carried=getStandard(s.carryingStandard);
          if(carried){const safe=nearestWalkable(s.x,s.y);carried.carriedBy=null;carried.dropped=true;carried.returning=false;carried.x=safe.gx*TILE+TILE/2;carried.y=safe.gy*TILE+TILE/2;}
          s.carryingStandard=null;
        }
        s.controller = newControllerId;
        s.slaveDebuff = (newControllerId !== s.origHouse);
        s.engageId=null;
        s.path=[];
        s.pathIndex=0;
        s.order={type:'idle',x:s.x,y:s.y,targetId:null,targetType:null,manual:false};
        s.state=s.state==='knocked'?'knocked':'idle';
        applyLoadout(s);
      }
    }
    for(const st of game.standards){
      if(!transferredIds.has(st.houseId)) continue;
      st.controller=newControllerId;
      if(!st.carriedBy){st.x=getHouse(newControllerId).castle.x;st.y=getHouse(newControllerId).castle.y-34;st.dropped=false;st.returning=false;}
    }
    if(houseId===oldControllerId){
      for(const o of game.objectives){
        if(o.controller===oldControllerId){
          o.controller=newControllerId;
          o.progress={};o.captureHouse=null;o.captureProgress=0;o.capturePercent=0;
        }else if(o.progress[oldControllerId]){
          delete o.progress[oldControllerId];
          const leader=Object.entries(o.progress).sort((a,b)=>b[1]-a[1])[0];
          o.captureHouse=leader?leader[0]:null;o.captureProgress=leader?leader[1]:0;o.capturePercent=o.captureProgress/8;
        }
      }
      for(const s of game.students) if(s.controller===oldControllerId || s.controller===newControllerId) applyLoadout(s);
    }
    log(`<b style="color:${getHouse(newControllerId).color}">${getHouse(newControllerId).name}</b> takes command of <b style="color:${house.color}">${house.name}</b>.`);
    checkVictory();
    refreshUI();
  }

  function checkVictory(){
    const allPlayer = game.houses.every(h=>h.controller==='player');
    if(allPlayer){
      game.gameOver=true;
      game.result='victory';
      log(`<b style="color:#aaf0b8">Victory:</b> all houses now answer to your standard.`);
    }
    if(getPlayerHouse().controller !== 'player'){
      game.gameOver=true;
      game.result='defeat';
      log(`<b style="color:#ffb4b4">Defeat:</b> House Augustus has fallen.`);
    }
  }

  function respawnStudent(s){
    const ctrl = getHouse(s.controller);
    const spawn=findSpawnPosition(ctrl,Number(s.id.slice(s.id.lastIndexOf('_')+1)));
    s.x = spawn.x;
    s.y = spawn.y;
    s.hp = s.maxHp;
    s.state='idle';
    s.path=[]; s.pathIndex=0;
    s.engageId=null;
    s.swing=0; s.draw=0;
    s.trappedUntil = 0;
    s.order = {type:'idle', x:s.x, y:s.y, targetId:null, targetType:null, manual:false};
    s.tx = s.x; s.ty = s.y;
    s.justRespawned = true;
    s.smithTimer = 0;
    s.smithingAt = null;
    s.burnUntil = 0;
    s.attackAction=null;s.flagCaptureId=null;s.flagCaptureProgress=0;s.flagCaptureBlockedId=null;
  }

  function autoEquipAI(house){
    const active = game.students.filter(s=>s.controller===house.id && s.state!=='knocked');
    const stock = house.stockpile;
    for(const s of active){
      if(s.weapon==='None'){
        const choices=s.roleHint==='ranged'?['Longbow','Bow','Spear','Sword']:['Spear','Sword','Bow','Longbow'];
        const weapon=choices.find(k=>stock[k]>0);
        if(weapon){stock[weapon]--;s.weapon=weapon;s.weaponLevel=1;}
      }else if(s.weapon==='Bow' && s.weaponLevel<=1 && stock.Longbow>0){
        stock.Longbow--;stock.Bow++;s.weapon='Longbow';s.weaponLevel=1;
      }
      if(s.armor==='None'){
        if(stock.Heavy>0 && Math.random()<0.42){ stock.Heavy--; s.armor='Heavy'; }
        else if(stock.Light>0){ stock.Light--; s.armor='Light'; }
      }
      if(s.item==='None'){
        if(s.roleHint==='support' && stock.Medkit>0){stock.Medkit--;s.item='Medkit';}
        else if(stock.WarHorn>0 && Math.random()<0.16){ stock.WarHorn--; s.item='WarHorn'; }
        else if(stock.FireOil>0 && Math.random()<0.20){ stock.FireOil--; s.item='FireOil'; }
        else if(stock.Medkit>0 && Math.random()<0.11){ stock.Medkit--; s.item='Medkit'; }
        else if(stock.EngineerKit>0 && Math.random()<0.10){ stock.EngineerKit--; s.item='EngineerKit'; }
        else if(stock.TrapKit>0 && Math.random()<0.10){ stock.TrapKit--; s.item='TrapKit'; }
        else if(stock.Shield>0 && Math.random()<0.28){ stock.Shield--; s.item='Shield'; }
        else if(stock.Boots>0 && Math.random()<0.20){ stock.Boots--; s.item='Boots'; }
      }
      if(!s.mount && stock.Horse>0 && Math.random()<0.11){ stock.Horse--; s.mount=true; }
      applyLoadout(s);
    }
  }

  function bannerThreatForHouse(house){
    const ownBanner = getStandard(house.id);
    if(ownBanner.carriedBy){
      const carrier = game.students.find(s=>s.id===ownBanner.carriedBy && s.state!=='knocked');
      if(carrier) return {type:'chaseCarrier', target:carrier};
    }
    if(ownBanner.dropped) return {type:'recoverDropped', target:ownBanner};
    return null;
  }

  function assignParty(units, orderType, target){
    if(!units.length || !target) return;
    const cols = Math.ceil(Math.sqrt(units.length));
    for(let i=0;i<units.length;i++){
      const col = i % cols;
      const row = Math.floor(i / cols);
      const ox = (col - (cols-1)/2) * 34;
      const oy = (row - (cols-1)/2) * 34;
      setOrder(units[i], {
        type: orderType,
        x: target.x + ox,
        y: target.y + oy,
        targetId: target.id ?? target.houseId ?? null,
        targetType: target.kind === 'ground' ? 'ground' : target.kind === 'box' ? 'box' : target.houseId ? 'standard' : 'student',
        manual: true
      });
    }
  }

  function endRaid(house, success){
    if(!house.ai.raid) return;
    const survivors = house.ai.raid.ids.map(id=>game.students.find(s=>s.id===id)).filter(s=>s && s.controller===house.id && s.state!=='knocked');
    if(!success){
      for(const s of survivors){
        setOrder(s,{ type:'defend', x:house.castle.x + rand(-95,95), y:house.castle.y + rand(-95,95), manual:true });
      }
      house.ai.regroupUntil = game.time + rand(4.5, 7.5);
    }else{
      house.ai.regroupUntil = game.time + rand(1.2, 2.5);
    }
    house.ai.raid = null;
  }

  function beginRaid(house, targetHouse){
    const active = activeForceFor(house.id);
    const fighters = frontlineForceFor(house.id);
    if(fighters.length < 5) return false;

    const plan = chooseRaidPlan(house, targetHouse);

    let raidSize = Math.floor(fighters.length * plan.pct);
    if(plan.sizeType === 'small') raidSize = Math.max(4, raidSize);
    if(plan.sizeType === 'medium') raidSize = Math.max(6, raidSize);
    if(plan.sizeType === 'major') raidSize = Math.max(8, raidSize);
    raidSize = Math.min(fighters.length, raidSize);

    const raiders = [...fighters]
      .sort((a,b)=>{
        const da = dist(a.x,a.y,targetHouse.castle.x,targetHouse.castle.y) + (a.item==='WarHorn' ? -25 : 0) + (a.mount ? -18 : 0);
        const db = dist(b.x,b.y,targetHouse.castle.x,targetHouse.castle.y) + (b.item==='WarHorn' ? -25 : 0) + (b.mount ? -18 : 0);
        return da - db;
      })
      .slice(0, raidSize);

    const reserve = active.filter(s=>!raiders.includes(s));

    const archers = raiders.filter(s=>s.weapon==='Bow' || s.weapon==='Longbow');
    const melee = raiders.filter(s=>s.weapon!=='Bow' && s.weapon!=='Longbow');
    const escortsPreferred = [...melee.filter(s=>s.mount), ...melee.filter(s=>s.item==='Shield'), ...melee].slice(0, Math.max(2, Math.floor(raidSize * 0.24)));
    const vanguardPreferred = [...melee.filter(s=>!escortsPreferred.includes(s)), ...archers].slice(0, Math.max(2, Math.floor(raidSize * 0.38)));

    house.ai.raid = {
      targetHouseId: targetHouse.id,
      ids: raiders.map(s=>s.id),
      startedAt: game.time,
      lastPressureAt: game.time,
      style: plan.style,
      sizeType: plan.sizeType,
      reserveIds: reserve.map(s=>s.id),
      escortIds: escortsPreferred.map(s=>s.id),
      vanguardIds: vanguardPreferred.map(s=>s.id),
      stage: plan.style === 'battle' ? 'clear' : 'approach'
    };

    const raidText =
      plan.sizeType === 'major' ? 'a massive raid' :
      plan.sizeType === 'medium' ? 'a strong raid' :
      'a small raid';

    const styleText = plan.style === 'battle' ? 'to break resistance before seizing the flag' : 'to grab the flag and run';
    log(`<span style="color:${house.color}">${house.name}</span> launches ${raidText} on <span style="color:${targetHouse.color}">${targetHouse.name}</span> ${styleText}.`);

    return true;
  }

  function sustainRaid(house){
    const raid = house.ai.raid;
    if(!raid) return false;

    const targetHouse = getHouse(raid.targetHouseId);
    if(!targetHouse){ house.ai.raid = null; return false; }

    const targetStandard = getStandard(targetHouse.id);
    const committed = raid.ids.map(id=>game.students.find(s=>s.id===id)).filter(s=>s && s.controller===house.id && s.state!=='knocked');

    if(targetHouse.controller===house.id || (targetStandard && targetStandard.controller===house.id)){
      endRaid(house, true);
      return false;
    }

    if(!committed.length){
      endRaid(house, false);
      return false;
    }

    const carrier = committed.find(s=>s.carryingStandard === targetHouse.id);
    const escorts = committed.filter(s=>raid.escortIds.includes(s.id) && s!==carrier);
    const vanguard = committed.filter(s=>raid.vanguardIds.includes(s.id) && s!==carrier);
    const others = committed.filter(s=>!escorts.includes(s) && !vanguard.includes(s) && s!==carrier);

    const defenders = game.students
      .filter(e=>e.state!=='knocked' && e.controller!==house.id && dist(e.x,e.y,targetHouse.castle.x,targetHouse.castle.y) < 360)
      .sort((a,b)=>{
        const aw = dist(a.x,a.y,targetHouse.castle.x,targetHouse.castle.y) + a.hp*0.25;
        const bw = dist(b.x,b.y,targetHouse.castle.x,targetHouse.castle.y) + b.hp*0.25;
        return aw - bw;
      });

    if(carrier){
      raid.stage = 'escape';
      const home = getHouse(house.id).castle;

      setOrder(carrier,{ type:'returnBanner', x:home.x, y:home.y, manual:true });

      const bodyguards = escorts.length ? escorts : committed.filter(s=>s!==carrier).slice(0, Math.max(2, Math.floor(committed.length*0.45)));
      for(const s of bodyguards){
        setOrder(s,{ type:'escort', x:carrier.x, y:carrier.y, targetId:carrier.id, targetType:'student', manual:true });
      }

      const pursuers = defenders.slice(0, Math.max(1, Math.floor(defenders.length*0.6)));
      const blockers = committed.filter(s=>s!==carrier && !bodyguards.includes(s));
      for(let i=0;i<blockers.length;i++){
        const enemy = pursuers[i % Math.max(1, pursuers.length)];
        if(enemy){
          setOrder(blockers[i],{ type:'attack', x:enemy.x, y:enemy.y, targetId:enemy.id, targetType:'student', manual:true });
        }else{
          setOrder(blockers[i],{ type:'escort', x:carrier.x, y:carrier.y, targetId:carrier.id, targetType:'student', manual:true });
        }
      }
      return true;
    }

    if(raid.style === 'battle'){
      if(defenders.length){
        raid.stage = 'clear';
        raid.lastPressureAt = game.time;

        const nearStandard = defenders.filter(d=>targetStandard && dist(d.x,d.y,targetStandard.x,targetStandard.y) < 160);
        const priority = nearStandard.length ? nearStandard : defenders;

        const clearForceCount = Math.max(3, Math.ceil(committed.length * 0.72));
        const clearForce = [...vanguard, ...others, ...escorts].slice(0, clearForceCount);
        const flagForce = committed.filter(s=>!clearForce.includes(s));

        for(let i=0;i<clearForce.length;i++){
          const enemy = priority[i % priority.length];
          setOrder(clearForce[i],{
            type:'attack',
            x:enemy.x,
            y:enemy.y,
            targetId:enemy.id,
            targetType:'student',
            manual:true
          });
        }

        if(targetStandard){
          for(const s of flagForce){
            setOrder(s,{
              type:'capture',
              x:targetStandard.x + rand(-14,14),
              y:targetStandard.y + rand(-14,14),
              targetId:targetStandard.houseId,
              targetType:'standard',
              manual:true
            });
          }
        }
        return true;
      }

      raid.stage = 'takeFlag';
      if(targetStandard){
        for(const s of committed){
          setOrder(s,{
            type:'capture',
            x:targetStandard.x + rand(-16,16),
            y:targetStandard.y + rand(-16,16),
            targetId:targetStandard.houseId,
            targetType:'standard',
            manual:true
          });
        }
      }
    } else {
      raid.stage = 'snatch';

      const interceptors = defenders.slice(0, Math.max(1, Math.floor(defenders.length * 0.55)));
      const fastGroup = [...committed].sort((a,b)=>{
        const av = (a.mount ? 20 : 0) + a.moveSpeed;
        const bv = (b.mount ? 20 : 0) + b.moveSpeed;
        return bv - av;
      });

      const flagRunnersCount = Math.max(2, Math.ceil(committed.length * 0.30));
      const flagRunners = fastGroup.slice(0, flagRunnersCount);
      const support = committed.filter(s=>!flagRunners.includes(s));

      if(targetStandard){
        for(const s of flagRunners){
          setOrder(s,{
            type:'capture',
            x:targetStandard.x + rand(-12,12),
            y:targetStandard.y + rand(-12,12),
            targetId:targetStandard.houseId,
            targetType:'standard',
            manual:true
          });
        }
      }

      for(let i=0;i<support.length;i++){
        const enemy = interceptors[i % Math.max(1, interceptors.length)];
        if(enemy){
          setOrder(support[i],{
            type:'attack',
            x:enemy.x,
            y:enemy.y,
            targetId:enemy.id,
            targetType:'student',
            manual:true
          });
        }else if(targetStandard){
          setOrder(support[i],{
            type:'capture',
            x:targetStandard.x + rand(-18,18),
            y:targetStandard.y + rand(-18,18),
            targetId:targetStandard.houseId,
            targetType:'standard',
            manual:true
          });
        }
      }
    }

    const minContinue =
      raid.sizeType === 'major' ? 4 :
      raid.sizeType === 'medium' ? 3 : 2;

    if(game.time - raid.startedAt > 75){
      const enoughLeft = committed.length >= minContinue;
      const recentlyPressured = (game.time - raid.lastPressureAt) < 18;
      if(!enoughLeft || (!recentlyPressured && committed.length < Math.max(2, Math.floor(raid.ids.length * 0.35)))){
        endRaid(house, false);
        return false;
      }
    }

    return true;
  }

  function aiThink(house){
    if(house.controller!==house.id) return;
    const active = activeForceFor(house.id);
    if(!active.length) return;

    autoEquipAI(house);

    if(house.ai.raid && sustainRaid(house)) return;
    if(house.ai.regroupUntil > game.time) return;

    const fighters = frontlineForceFor(house.id);
    const bannerThreat = bannerThreatForHouse(house);
    const ownBuffs = game.objectives.filter(o=>o.controller===house.id).length;
    const ruled = controlledHouseCount(house.id);

    house.ai.aggression = clamp(
      0.28 + ownBuffs*0.08 + fighters.length*0.012 + (ruled-1)*0.10 + (game.difficulty==='relaxed'?-.15:game.difficulty==='veteran'?.12:0),
      0.28,
      0.98
    );

    if(bannerThreat){
      const chasers = (fighters.length ? fighters : active).slice(0, Math.max(4, Math.floor(active.length*0.58)));
      if(bannerThreat.type==='chaseCarrier'){
        for(const s of chasers) setOrder(s,{type:'attack',x:bannerThreat.target.x,y:bannerThreat.target.y,targetId:bannerThreat.target.id,targetType:'student',manual:true});
      } else {
        for(const s of chasers) setOrder(s,{type:'capture',x:bannerThreat.target.x,y:bannerThreat.target.y,targetId:bannerThreat.target.houseId,targetType:'standard',manual:true});
      }
      for(const s of active.filter(x=>!chasers.includes(x))){
        setOrder(s,{type:'defend',x:house.castle.x+rand(-90,90),y:house.castle.y+rand(-90,90),manual:true});
      }
      return;
    }

    const nearEnemies = game.students.filter(
      s=>s.controller!==house.id && s.state!=='knocked' && dist(s.x,s.y,house.castle.x,house.castle.y)<340
    );

    if(nearEnemies.length){
      const defenders = active.slice(0, Math.ceil(active.length*0.70));
      const weak = [...nearEnemies].sort((a,b)=>a.hp-b.hp);
      for(let i=0;i<defenders.length;i++){
        const t = weak[i % weak.length];
        setOrder(defenders[i],{type:'attack',x:t.x,y:t.y,targetId:t.id,targetType:'student',manual:true});
      }
      for(const s of active.filter(x=>!defenders.includes(x))){
        setOrder(s,{type:'defend',x:house.castle.x+rand(-80,80),y:house.castle.y+rand(-80,80),manual:true});
      }
      return;
    }

    const weakTarget = weakHouseTargetFor(house);
    const lootTarget = nearestLootTaskTarget(house.id);
    const uncappedObjective = game.objectives
      .filter(o=>o.controller !== house.id)
      .sort((a,b)=>dist(a.x,a.y,house.castle.x,house.castle.y)-dist(b.x,b.y,house.castle.x,house.castle.y))[0];

    const shouldContestMid =
      uncappedObjective &&
      fighters.length >= 4 &&
      Math.random() < (0.32 + ownBuffs*0.05);

    const shouldRaid =
      weakTarget &&
      fighters.length >= 5 &&
      Math.random() < (house.ai.aggression + (ruled >= 2 ? 0.12 : 0));

    if(shouldRaid){
      if(beginRaid(house, weakTarget)){
        sustainRaid(house);
        return;
      }
    }

    if(shouldContestMid){
      const partySize = ruled >= 2 ? Math.max(5, Math.floor(active.length*0.52)) : Math.max(4, Math.floor(active.length*0.42));
      const party = [...active]
        .sort((a,b)=>dist(a.x,a.y,uncappedObjective.x,uncappedObjective.y)-dist(b.x,b.y,uncappedObjective.x,uncappedObjective.y))
        .slice(0, partySize);

      assignParty(party, 'move', uncappedObjective);

      for(const s of active.filter(x=>!party.includes(x))){
        setOrder(s,{type:'defend',x:house.castle.x+rand(-70,70),y:house.castle.y+rand(-70,70),manual:true});
      }
      return;
    }

    if(lootTarget){
      const partySize = ruled >= 2 ? Math.max(3, Math.floor(active.length*0.24)) : Math.max(3, Math.floor(active.length*0.20));
      const party = [...active]
        .sort((a,b)=>dist(a.x,a.y,lootTarget.obj.x,lootTarget.obj.y)-dist(b.x,b.y,lootTarget.obj.x,lootTarget.obj.y))
        .slice(0, partySize);

      assignParty(party, lootTarget.kind==='ground' ? 'groundLoot' : 'box', { ...lootTarget.obj, kind:lootTarget.kind });

      for(const s of active.filter(x=>!party.includes(x))){
        setOrder(s,{type:'defend',x:house.castle.x+rand(-80,80),y:house.castle.y+rand(-80,80),manual:true});
      }
      return;
    }

    for(const s of active){
      setOrder(s,{type:'defend',x:house.castle.x+rand(-75,75),y:house.castle.y+rand(-75,75),manual:true});
    }
  }

  function tryTriggerTrap(s){
    for(const t of game.traps){
      if(!t.alive || t.controller===s.controller) continue;
      if(dist(s.x,s.y,t.x,t.y) < 12){
        t.alive = false;
        s.trappedUntil = game.time + 18;
        log(`<span style="color:${getHouse(s.controller).color}">${s.name}</span> is trapped.`);
        for(let i=0;i<7;i++) addParticle({x:s.x,y:s.y,c:'#f2d25a',vx:rand(-38,38),vy:rand(-38,38),t:.4,r:2.2});
      }
    }
  }

  function handleGroundLootPickup(s){
    for(const g of game.groundLoot){
      if(!g.alive) continue;
      if(dist(s.x,s.y,g.x,g.y) < 14){
        g.alive = false;
        const house = getHouse(s.controller);
        house.stockpile[g.item] = (house.stockpile[g.item]||0) + 1;
        if(s.controller==='player') renderStockSummary();
        refreshEquipButtons();
        log(`<span style="color:${house.color}">${house.name}</span> recovers <b>${g.item}</b>.`);
        return true;
      }
    }
    return false;
  }

  function clearFlagCapture(standard){
    if(!standard)return;
    const student=game.students.find(s=>s.id===standard.captureStudentId);
    if(student){student.flagCaptureId=null;student.flagCaptureProgress=0;}
    standard.captureStudentId=null;standard.captureController=null;standard.captureProgress=0;
    standard.captureDuration=FLAG_CAPTURE_DURATION;standard.captureContested=false;
  }

  function interruptFlagCapture(student,reason='interrupted'){
    const standard=getStandard(student.flagCaptureId);
    if(standard&&standard.captureStudentId===student.id){
      standard.captureInterruptedUntil=game.time+1;
      clearFlagCapture(standard);
    }
    if(reason==='order')student.flagCaptureBlockedId=student.flagCaptureId||standard?.houseId||null;
    student.flagCaptureId=null;student.flagCaptureProgress=0;
    student.flagCaptureRetryAt=game.time+(reason==='damage'?.3:0);
  }

  function startFlagCapture(student,standard){
    if(!student||student.state==='knocked'||student.carryingStandard||standard.carriedBy)return false;
    if(standard.controller===student.controller&&!standard.dropped)return false;
    if(dist(student.x,student.y,standard.x,standard.y)>FLAG_CAPTURE_RADIUS)return false;
    if(student.flagCaptureBlockedId===standard.houseId||(student.flagCaptureRetryAt||0)>game.time)return false;
    if(standard.captureStudentId&&standard.captureStudentId!==student.id)return false;
    if(student.flagCaptureId&&student.flagCaptureId!==standard.houseId)interruptFlagCapture(student,'replace');
    if(!standard.captureStudentId){
      standard.captureStudentId=student.id;standard.captureController=student.controller;
      standard.captureProgress=0;standard.captureDuration=FLAG_CAPTURE_DURATION;
      standard.captureDamageSerial=student.damageSerial||0;
      student.flagCaptureId=standard.houseId;student.flagCaptureProgress=0;
      cancelAttackAction(student);
    }
    standard.captureContested=game.students.some(s=>s.state!=='knocked'&&s.controller!==student.controller&&dist(s.x,s.y,standard.x,standard.y)<=FLAG_CONTEST_RADIUS);
    return true;
  }

  function updateFlagCaptures(dt){
    if(game.paused||game.gameOver)return;
    for(const standard of game.standards){
      const student=game.students.find(s=>s.id===standard.captureStudentId);
      if(!student){standard.captureContested=false;continue;}
      if(student.state==='knocked'||student.controller!==standard.captureController||student.carryingStandard||standard.carriedBy||(standard.controller===student.controller&&!standard.dropped)||dist(student.x,student.y,standard.x,standard.y)>FLAG_CAPTURE_RADIUS){
        interruptFlagCapture(student,'leaving');continue;
      }
      if((student.damageSerial||0)!==(standard.captureDamageSerial||0)){
        interruptFlagCapture(student,'damage');continue;
      }
      standard.captureContested=game.students.some(s=>s.state!=='knocked'&&s.controller!==student.controller&&dist(s.x,s.y,standard.x,standard.y)<=FLAG_CONTEST_RADIUS);
      if(standard.captureContested){
        if(standard.captureProgress>0)standard.captureInterruptedUntil=game.time+1;
        standard.captureProgress=0;student.flagCaptureProgress=0;continue;
      }
      standard.captureProgress=Math.min(FLAG_CAPTURE_DURATION,standard.captureProgress+dt);
      student.flagCaptureProgress=standard.captureProgress;
      if(standard.captureProgress+1e-8>=FLAG_CAPTURE_DURATION){
        clearFlagCapture(standard);
        captureBanner(student,standard);
      }
    }
  }

  function handleBannerPickup(s){
    if(s.flagCaptureBlockedId){
      const blocked=getStandard(s.flagCaptureBlockedId);
      if(!blocked||dist(s.x,s.y,blocked.x,blocked.y)>FLAG_CAPTURE_RADIUS+12)s.flagCaptureBlockedId=null;
    }
    for(const standard of game.standards){
      if(standard.carriedBy)continue;
      if(dist(s.x,s.y,standard.x,standard.y)>FLAG_CAPTURE_RADIUS)continue;
      if(standard.controller!==s.controller||standard.dropped)return startFlagCapture(s,standard);
    }
    return false;
  }

  function completeManualOrderIfReached(s){
    const near = dist(s.x,s.y,s.tx,s.ty) < 16;
    if(!near) return;
    if(['move','attackMove'].includes(s.order.type)){
      s.order = {type:'idle', x:s.x, y:s.y, targetId:null, targetType:null, manual:false};
      s.state = 'idle';
      if(controlMode==='attackmove') controlMode='move';
    }
    if(s.order.type==='defend'){
      s.order = {type:'defend', x:s.x, y:s.y, targetId:null, targetType:null, manual:false};
      s.state = 'idle';
    }
  }

  function updateBlacksmith(s, dt){
    if(s.weapon==='None' || s.state==='knocked' || s.weaponLevel>=3){
      s.smithTimer = 0; s.smithingAt = null; return;
    }
    let inside = null;
    for(const f of game.blacksmiths){
      if(s.x>f.x-f.w/2 && s.x<f.x+f.w/2 && s.y>f.y-f.h/2 && s.y<f.y+f.h/2){ inside = f; break; }
    }
    const moved = dist(s.x,s.y,s.lastPosX,s.lastPosY) > 5;
    const bonusForge = objectiveBuffsFor(s.controller).forge;
    const needed = bonusForge ? 12 : 18;

    if(inside && !moved && s.attackCd<=0.1){
      if(s.smithingAt !== inside.id){ s.smithTimer = 0; s.smithingAt = inside.id; }
      s.smithTimer += dt;
      if(s.smithTimer >= needed){
        s.weaponLevel++;
        s.smithTimer = 0;
        applyLoadout(s);
        log(`<span style="color:${getHouse(s.controller).color}">${s.name}</span> upgrades ${s.weapon} to level <b>${s.weaponLevel}</b>.`);
      }
    } else {
      s.smithTimer = 0; s.smithingAt = null;
    }
  }

  function maybeRepath(s, targetPoint){
    if(game.time - s.lastPathAt < 0.5) return;
    const destination=resolveDestination(targetPoint.x,targetPoint.y,s.radius||13);
    s.tx = destination.x;
    s.ty = destination.y;
    s.path = pathfind(s.x,s.y,s.tx,s.ty);
    s.pathIndex = 0;
    s.lastPathAt = game.time;
  }

  function getEngagementMeleePoint(s, target){
    const attackers = game.students
      .filter(a =>
        a.state !== 'knocked' &&
        a.controller === s.controller &&
        a.weapon !== 'Bow' &&
        a.weapon !== 'Longbow' &&
        (
          a.engageId === target.id ||
          ((a.order.type === 'attack' || a.order.type === 'capture' || a.order.type === 'attackMove') && a.order.targetId === target.id)
        )
      )
      .sort((a,b)=>a.id.localeCompare(b.id));

    const idx = Math.max(0, attackers.findIndex(a=>a.id === s.id));
    let ring = 0;
    let remaining = idx;
    let ringCap = 6;
    while(remaining >= ringCap){
      remaining -= ringCap;
      ring++;
      ringCap += 6;
    }

    const ringRadius = ring===0?Math.min(target.radius+22+((hashId(s.id)%3)*2),attackReach(s,target)-1):target.radius+22+ring*13+((hashId(s.id)%3)*2);
    const angleOffset = (hashId(target.id + '|' + s.controller) % 628) / 100;
    const angle = angleOffset + (remaining / ringCap) * Math.PI * 2;

    return {
      x: target.x + Math.cos(angle) * ringRadius,
      y: target.y + Math.sin(angle) * ringRadius
    };
  }

  function getRangedCombatPoint(s, target){
    const dx = s.x - target.x;
    const dy = s.y - target.y;
    const baseAngle = Math.atan2(dy, dx);
    const side = (hashId(s.id) % 2 === 0) ? 1 : -1;
    const tangent = baseAngle + side * Math.PI / 2;
    const desired = s.weapon === 'Longbow' ? 180 : 138;
    const lateral = 22 + (hashId(s.id) % 3) * 8;

    return {
      x: target.x + Math.cos(baseAngle) * desired + Math.cos(tangent) * lateral,
      y: target.y + Math.sin(baseAngle) * desired + Math.sin(tangent) * lateral
    };
  }

  function computeSeparation(s, fightTarget){
    let sepX=0, sepY=0;
    const inCombat = !!fightTarget || !!s.engageId || s.order.type === 'attack' || s.order.type === 'capture' || s.order.type === 'attackMove';

    for(const a of game.students){
      if(a===s || a.state==='knocked') continue;
      let dx = s.x - a.x;
      let dy = s.y - a.y;
      let d = Math.hypot(dx,dy);
      if(d<.001){const angle=(hashId([s.id,a.id].sort().join('|'))%628)/100,side=s.id<a.id?1:-1;dx=Math.cos(angle)*side;dy=Math.sin(angle)*side;d=1;}

      const ally = a.controller===s.controller;
      const body=(s.radius||13)+(a.radius||13)+2;
      let desired = ally ? body+(inCombat?7:11) : body;

      if(d < desired){
        const strength = ally ? 4 : 3;
        const push = (desired - d) * strength;
        sepX += (dx/d) * push;
        sepY += (dy/d) * push;
      }
    }

    const magnitude=Math.hypot(sepX,sepY);
    if(magnitude>95){sepX*=95/magnitude;sepY*=95/magnitude;}
    return {x:sepX, y:sepY};
  }

  function moveWithAvoidance(s,dx,dy,speed,dt,sep){
    const length=Math.hypot(dx,dy),dirX=length>1.5?dx/length:0,dirY=length>1.5?dy/length:0;
    let vx=dirX*speed+sep.x,vy=dirY*speed+sep.y;
    if(length>12){
      for(const other of game.students){
        if(other===s||other.state==='knocked'||other.controller!==s.controller)continue;
        const rx=other.x-s.x,ry=other.y-s.y,distance=Math.hypot(rx,ry);
        if(distance<1||distance>75)continue;
        const forward=(rx*dirX+ry*dirY)/distance;
        const cross=dirX*ry-dirY*rx;
        if(forward>.25&&Math.abs(cross)<(s.radius+other.radius+10)){
          const side=Math.abs(cross)>2?-Math.sign(cross):(hashId(s.id)%2?1:-1);
          const push=speed*.9*(1-distance/80);
          vx+=-dirY*side*push;vy+=dirX*side*push;
        }
      }
    }
    const magnitude=Math.hypot(vx,vy),limit=Math.max(70,speed*1.12);
    if(magnitude>limit){vx*=limit/magnitude;vy*=limit/magnitude;}
    let nx=s.x+vx*dt,ny=s.y+vy*dt;
    const radius=s.radius||13;
    if(!terrainClear(nx,ny,radius)){
      if(terrainClear(nx,s.y,radius))ny=s.y;
      else if(terrainClear(s.x,ny,radius))nx=s.x;
      else{nx=s.x;ny=s.y;}
    }
    for(let pass=0;pass<2;pass++)for(const other of game.students){
      if(other===s||other.state==='knocked')continue;
      let rx=nx-other.x,ry=ny-other.y,distance=Math.hypot(rx,ry);
      const minimum=radius+(other.radius||13)+1;
      if(distance<minimum){
        if(distance<.001){const angle=(hashId([s.id,other.id].sort().join('|'))%628)/100,side=s.id<other.id?1:-1;rx=Math.cos(angle)*side;ry=Math.sin(angle)*side;distance=1;}
        const px=other.x+rx/distance*minimum,py=other.y+ry/distance*minimum;
        if(terrainClear(px,py,radius)){nx=px;ny=py;}
        else{nx=s.x;ny=s.y;}
      }
    }
    const before=dist(s.x,s.y,s.tx,s.ty);
    if(terrainClear(nx,ny,radius)){s.x=nx;s.y=ny;}
    const progress=before-dist(s.x,s.y,s.tx,s.ty);
    if(length>15&&progress<speed*dt*.07)s.stuckFor=(s.stuckFor||0)+dt;
    else s.stuckFor=Math.max(0,(s.stuckFor||0)-dt*2);
    if(s.stuckFor>1.2 && game.time-(s.lastStuckRepath||0)>1.2){
      const avoid=new Set();
      for(const other of game.students)if(other!==s&&other.state!=='knocked'&&dist(s.x,s.y,other.x,other.y)<180)avoid.add(keyXY(Math.floor(other.x/TILE),Math.floor(other.y/TILE)));
      s.path=pathfind(s.x,s.y,s.tx,s.ty,avoid);s.pathIndex=0;s.lastPathAt=game.time;s.lastStuckRepath=game.time;s.stuckFor=0;
    }
  }

  function update(dt){
    if(game.gameOver || game.paused) return;
    game.time += dt;

    updateObjectives(dt);

    if(game.time >= game.nextLootSpawnAt){
      let spot = null;
      if(game.earlyBaseLootRemaining > 0){
        const shuffled = [...game.houses].sort(()=>Math.random()-0.5);
        for(const h of shuffled){ spot = randomLootSpawnNearHouse(h, 100, 225); if(spot) break; }
        if(spot){
          spawnLootBoxAt(spot.x, spot.y, Math.random()<0.12, false);
          game.earlyBaseLootRemaining--;
          log(`A nearby supply box appears beside a house base.`);
        }
        game.nextLootSpawnAt = game.time + rand(4.6, 6.8);
      }else{
        spot = randomLootSpawnPoint(false);
        if(spot){
          spawnLootBoxAt(spot.x, spot.y, Math.random()<0.25, false);
          log(`A new loot box appears on the field.`);
        }
        game.nextLootSpawnAt = game.time + rand(7, 11);
      }
    }

    if(game.time >= game.nextBigMidLootAt){
      const spot = randomLootSpawnPoint(true);
      if(spot){
        spawnLootBoxAt(spot.x, spot.y, true, true);
        log(`<b style="color:#d8bd66">A great loot crate appears near the center!</b>`);
      }
      game.nextBigMidLootAt = game.time + rand(20, 30);
    }

    for(const h of game.houses){
      if(h.id==='player') continue;
      if(game.time >= h.ai.thinkAt){
        const ruled = controlledHouseCount(h.id);
        const thinkMultiplier=game.difficulty==='relaxed'?1.35:game.difficulty==='veteran'?.85:1;
        const thinkMin = (ruled >= 2 ? 0.75 : 1.0)*thinkMultiplier;
        const thinkMax = (ruled >= 2 ? 1.25 : 1.6)*thinkMultiplier;
        h.ai.thinkAt = game.time + rand(thinkMin, thinkMax);
        aiThink(h);
      }
    }

    for(const s of game.students){
      if(s.state==='knocked' && game.time >= s.koUntil) respawnStudent(s);
    }

    for(const s of game.students){
      if(s.state==='knocked' || s.item!=='Medkit' || s.order.manual) continue;
      let hurt = null, best = 99999;
      for(const a of game.students){
        if(a===s || a.state==='knocked' || a.controller!==s.controller || a.hp >= a.maxHp-1) continue;
        const d = dist(s.x,s.y,a.x,a.y);
        if(d < best){ best=d; hurt=a; }
      }
      if(hurt && game.time - s.lastPathAt > 0.7){
        maybeRepath(s, {x:hurt.x, y:hurt.y});
      }
    }

    const houseHealBuffs = {};
    for(const h of game.houses) houseHealBuffs[h.id] = objectiveBuffsFor(h.id).heal;

    for(const s of game.students){
      if(s.state==='knocked') continue;
      if(s.item==='Medkit'){
        for(const a of game.students){
          if(a.state==='knocked' || a.controller!==s.controller || a===s) continue;
          if(dist(s.x,s.y,a.x,a.y) < 46) a.hp = Math.min(a.maxHp, a.hp + (5 + houseHealBuffs[s.controller])*dt);
        }
      }
      if(s.burnUntil > game.time){
        const burner=game.students.find(e=>e.controller!==s.controller&&e.state!=='knocked'&&dist(e.x,e.y,s.x,s.y)<120)||{controller:s.controller};
        applyStudentDamage(s,4*dt,burner);
        if(Math.random()<0.22) addParticle({x:s.x+rand(-4,4),y:s.y-4,c:'#ff8c3a',vx:rand(-10,10),vy:rand(-16,-6),t:.18,r:2.0});
        if(s.state==='knocked')continue;
      }
    }

    updateAttackActions(dt);
    updateProjectiles(dt);
    updateFlagCaptures(dt);

    for(const s of game.students){ s.lastPosX = s.x; s.lastPosY = s.y; }

    for(const s of game.students){
      if(s.state==='knocked') continue;
      if(s.attackCd>0) s.attackCd-=dt;
      if(s.order.type==='idle'&&!s.engageId){s.tx=s.order.x;s.ty=s.order.y;s.path=[];s.pathIndex=0;}
      if(s.swing>0) s.swing-=dt;
      if(s.draw>0) s.draw-=dt;
      tryTriggerTrap(s);

      if(!s.carryingStandard){
        handleGroundLootPickup(s);
        handleBannerPickup(s);
      }

      if(s.carryingStandard){
        const st = getStandard(s.carryingStandard);
        if(st) { st.x = s.x; st.y = s.y - 20; }
        const home = getHouse(s.controller).castle;
        if(dist(s.x,s.y,home.x,home.y) < 56){
          if(st) secureReturnedBanner(s, st);
        }
      }

      if(!isCommandLocked(s) && !s.carryingStandard && !s.flagCaptureId && s.order.type!=='heal' && s.order.type!=='buildBarricade' && s.order.type!=='buildTrap'){
        const aggro = nearestEnemyInAggro(s);
        if(aggro) s.engageId = aggro.id;
        else if(s.engageId){
          const t = game.students.find(x=>x.id===s.engageId);
          if(!t || t.state==='knocked' || !enemies(s,t) || dist(s.x,s.y,t.x,t.y) > s.aggro*1.6) s.engageId = null;
        }
      } else if(s.order.type!=='attackMove') {
        s.engageId = null;
      }

      let targetPoint = null;
      let fightTarget = null;
      let boxTarget = null;
      let barricadeTarget = null;
      let groundTarget = null;

      if(s.order.type==='attackMove'){
        if(s.engageId){
          const engaged = game.students.find(x=>x.id===s.engageId && x.state!=='knocked' && enemies(s,x));
          if(engaged && dist(s.x,s.y,engaged.x,engaged.y) <= s.aggro*1.7){
            fightTarget = engaged;
          }else{
            s.engageId = null;
          }
        }
        if(!fightTarget){
          const seek = nearestEnemyWithin(s, s.aggro + 45);
          if(seek){
            s.engageId = seek.id;
            fightTarget = seek;
          }
        }
      } else if(s.engageId){
        fightTarget = game.students.find(x=>x.id===s.engageId);
      } else if(s.order.targetType==='student' && (s.order.type==='attack' || s.order.type==='heal' || s.order.type==='escort')){
        fightTarget = game.students.find(x=>x.id===s.order.targetId);
      } else if(s.order.targetType==='box'){
        boxTarget = game.lootBoxes.find(x=>x.id===s.order.targetId && x.alive);
      } else if(s.order.targetType==='barricade'){
        barricadeTarget = game.barricades.find(x=>x.id===s.order.targetId && x.alive);
      } else if(s.order.targetType==='ground'){
        groundTarget = game.groundLoot.find(x=>x.id===s.order.targetId && x.alive);
      }

      if(s.order.type==='heal'){
        const ally = game.students.find(x=>x.id===s.order.targetId && x.state!=='knocked');
        if(!ally || ally.hp >= ally.maxHp){
          s.order = {type:'idle', x:s.x, y:s.y, targetId:null, targetType:null, manual:false};
        } else {
          targetPoint = {x:ally.x, y:ally.y};
          if(dist(s.x,s.y,ally.x,ally.y) < 42){
            ally.hp = Math.min(ally.maxHp, ally.hp + 12*dt);
          }
        }
      } else if(fightTarget && fightTarget.state!=='knocked' && enemies(s, fightTarget)){
        const d = dist(s.x,s.y,fightTarget.x,fightTarget.y);

        if(s.weapon==='Bow' || s.weapon==='Longbow'){
          targetPoint = getRangedCombatPoint(s, fightTarget);
          if(d <= attackReach(s,fightTarget)) attackTarget(s, fightTarget);
        } else {
          targetPoint = getEngagementMeleePoint(s, fightTarget);
          if(d <= attackReach(s,fightTarget)) attackTarget(s, fightTarget);
        }

        if(s.order.type==='attackMove' && fightTarget.state==='knocked'){
          s.engageId = null;
          targetPoint = {x:s.tx, y:s.ty};
        }
      } else if(groundTarget){
        targetPoint = {x:groundTarget.x, y:groundTarget.y};
        if(!groundTarget.alive || dist(s.x,s.y,groundTarget.x,groundTarget.y) < 14){
          handleGroundLootPickup(s);
          s.order = {type:'idle', x:s.x, y:s.y, targetId:null, targetType:null, manual:false};
        }
      } else if(boxTarget){
        targetPoint = {x:boxTarget.x, y:boxTarget.y};
        if(dist(s.x,s.y,boxTarget.x,boxTarget.y) <= s.atkRange+6) attackBox(s, boxTarget);
        if(!boxTarget.alive) s.order = {type:'idle', x:s.x, y:s.y, targetId:null, targetType:null, manual:false};
      } else if(barricadeTarget){
        targetPoint = {x:barricadeTarget.x, y:barricadeTarget.y};
        if(dist(s.x,s.y,barricadeTarget.x,barricadeTarget.y) <= s.atkRange+8) attackBarricade(s, barricadeTarget);
        if(!barricadeTarget.alive) s.order = {type:'idle', x:s.x, y:s.y, targetId:null, targetType:null, manual:false};
      } else {
        targetPoint = {x:s.tx,y:s.ty};
      }

      if(s.order.type==='attack'){
        const tgt = game.students.find(x=>x.id===s.order.targetId && x.state!=='knocked' && enemies(s,x));
        if(tgt){
          fightTarget = tgt;
          if(s.weapon==='Bow' || s.weapon==='Longbow') targetPoint = getRangedCombatPoint(s, tgt);
          else targetPoint = getEngagementMeleePoint(s, tgt);
        } else {
          s.order = {type:'idle', x:s.x, y:s.y, targetId:null, targetType:null, manual:false};
          s.state='idle';
          targetPoint = {x:s.x, y:s.y};
        }
      }

      if(s.order.type==='capture' && s.order.targetId){
        const standard=getStandard(s.order.targetId);
        if(standard && (standard.controller!==s.controller || standard.dropped || standard.carriedBy)){
          targetPoint={x:standard.x,y:standard.y};
          if(standard.carriedBy){
            const carrier=game.students.find(a=>a.id===standard.carriedBy&&a.state!=='knocked');
            if(carrier && carrier.controller===s.controller){
              setOrder(s,{type:'escort',x:carrier.x,y:carrier.y,targetId:carrier.id,targetType:'student',manual:true});
            }else if(carrier){
              setOrder(s,{type:'attack',x:carrier.x,y:carrier.y,targetId:carrier.id,targetType:'student',manual:true});
            }
          }
        }else{
          s.order={type:'idle',x:s.x,y:s.y,targetId:null,targetType:null,manual:false};
          targetPoint={x:s.x,y:s.y};
        }
      }

      if(s.carryingStandard){
        const home=getHouse(s.controller).castle;
        targetPoint = {x:home.x,y:home.y};
      }

      if(s.order.type==='escort' && s.order.targetType==='student'){
        const car = game.students.find(x=>x.id===s.order.targetId && x.state!=='knocked');
        if(car){const angle=(hashId(s.id)%628)/100;targetPoint = {x:car.x + Math.cos(angle)*46, y:car.y + Math.sin(angle)*46};}
      }

      if(s.order.type==='buildBarricade'){
        targetPoint = {x:s.order.x, y:s.order.y};
        if(dist(s.x,s.y,s.order.x,s.order.y) < 18){
          s.buildProgress += dt;
          if(s.buildProgress >= 2.0){
            if(s.engineerCdUntil <= game.time){
              game.barricades.push({
                id:'bar_'+Math.random().toString(36).slice(2),
                x:s.order.x, y:s.order.y, w:44, h:18,
                hp:140, maxHp:140, alive:true, controller:s.controller
              });
              rebuildWalkableGrid();
              s.buildProgress = 0;
              s.engineerCdUntil = game.time + 12;
              s.order = {type:'idle', x:s.x, y:s.y, targetId:null, targetType:null, manual:false};
              log(`<span style="color:${getHouse(s.controller).color}">${s.name}</span> builds a barricade.`);
            }
          }
        }
      }

      if(s.order.type==='buildTrap'){
        targetPoint = {x:s.order.x, y:s.order.y};
        if(dist(s.x,s.y,s.order.x,s.order.y) < 18){
          s.buildProgress += dt;
          if(s.buildProgress >= 1.5){
            if(s.engineerCdUntil <= game.time){
              game.traps.push({ id:'trap_'+Math.random().toString(36).slice(2), x:s.order.x, y:s.order.y, alive:true, controller:s.controller });
              s.buildProgress = 0;
              s.engineerCdUntil = game.time + 12;
              s.order = {type:'idle', x:s.x, y:s.y, targetId:null, targetType:null, manual:false};
              log(`<span style="color:${getHouse(s.controller).color}">${s.name}</span> places a trap.`);
            }
          }
        }
      }

      if(targetPoint && dist(s.x,s.y,targetPoint.x,targetPoint.y)>8 && (dist(targetPoint.x,targetPoint.y,s.tx,s.ty) > 18 || s.pathIndex >= s.path.length)){
        maybeRepath(s, targetPoint);
      }

      let px = s.tx, py = s.ty;
      if(s.path.length && s.pathIndex < s.path.length){
        const last=Math.min(s.path.length-1,s.pathIndex+5);
        for(let look=last;look>s.pathIndex;look--)if(segmentClear(s.x,s.y,s.path[look].x,s.path[look].y,s.radius||13)){s.pathIndex=look;break;}
        const p = s.path[s.pathIndex];
        px = p.x; py = p.y;
        if(dist(s.x,s.y,p.x,p.y) < 12){s.pathIndex++;if(s.pathIndex>=s.path.length&&segmentClear(s.x,s.y,s.tx,s.ty,s.radius||13)){px=s.tx;py=s.ty;}}
      }

      let hornBonus = 0;
      for(const a of game.students){
        if(a===s || a.state==='knocked' || a.controller!==s.controller || a.item!=='WarHorn') continue;
        if(dist(s.x,s.y,a.x,a.y) < 78){ hornBonus = 8; break; }
      }

      const sep = computeSeparation(s, fightTarget);

      if(s.trappedUntil <= game.time){
        let dx = px - s.x;
        let dy = py - s.y;
        const dd = Math.hypot(dx,dy);
        const slow = riverSlowFactor(s.x, s.y);
        const attackSlow=s.attackAction?.phase==='windup'?.12:s.attackAction?.phase==='release'?.6:1;
        const moveSpeedNow = (s.moveSpeed + hornBonus) * slow * (s.bracedUntil>game.time?.55:1)*attackSlow;
        if(dd>1.5&&!s.attackAction)setFacingTowardPoint(s,px,py);
        if(!s.flagCaptureId)moveWithAvoidance(s,dx,dy,dd>1.5?moveSpeedNow:0,dt,sep);
        s.state=s.flagCaptureId?'idle':fightTarget?'fight':dd>1.5?'move':'idle';
      }

      s.x = clamp(s.x, 20, WORLD_W-20);
      s.y = clamp(s.y, 20, WORLD_H-20);
      completeManualOrderIfReached(s);
      updateBlacksmith(s, dt);
      s.justRespawned = false;
    }

    for(let i=game.particles.length-1;i>=0;i--){
      const p=game.particles[i];
      p.t -= dt;
      p.x += p.vx*dt;
      p.y += p.vy*dt;
      if(p.t<=0) game.particles.splice(i,1);
    }

    const rect = canvas.getBoundingClientRect();
    const vw = rect.width, vh = rect.height;
    const panSpeed = 520 * dt;
    if(keysDown.has('ArrowLeft')) game.cam.x -= panSpeed;
    if(keysDown.has('ArrowRight')) game.cam.x += panSpeed;
    if(keysDown.has('ArrowUp')) game.cam.y -= panSpeed;
    if(keysDown.has('ArrowDown')) game.cam.y += panSpeed;

    if(game.followMode && game.followTargetIds.length){
      let targets = game.followTargetIds.map(id=>game.students.find(s=>s.id===id && s.state!=='knocked' && s.controller==='player')).filter(Boolean);
      if(targets.length){
        const anchor=targets.includes(game.selectedOne)?game.selectedOne:targets[0];
        targets=targets.filter(s=>dist(s.x,s.y,anchor.x,anchor.y)<650);
        const cx = targets.reduce((n,s)=>n+s.x,0)/targets.length;
        const cy = targets.reduce((n,s)=>n+s.y,0)/targets.length;
        game.cam.x = lerp(game.cam.x, clamp(cx-vw/2,0,WORLD_W-vw), 0.12);
        game.cam.y = lerp(game.cam.y, clamp(cy-vh/2,0,WORLD_H-vh), 0.12);
      }
    }

    game.cam.x = clamp(game.cam.x,0,WORLD_W-vw);
    game.cam.y = clamp(game.cam.y,0,WORLD_H-vh);

    for(let i=game.combatEvents.length-1;i>=0;i--){
      const e=game.combatEvents[i];e.ttl-=dt;e.y-=dt*12;
      if(e.ttl<=0) game.combatEvents.splice(i,1);
    }
    for(let i=game.hitEffects.length-1;i>=0;i--){game.hitEffects[i].ttl-=dt;if(game.hitEffects[i].ttl<=0)game.hitEffects.splice(i,1);}
    if(game.time-lastUIAt>.12){lastUIAt=game.time;refreshUI();}
  }

  function drawGround(){
    ctx.fillStyle='#25402f';
    ctx.fillRect(0,0,WORLD_W,WORLD_H);

    const vr = visibleRect(80);
    const startX = Math.max(0, Math.floor(vr.x / TILE));
    const endX = Math.min(COLS-1, Math.ceil((vr.x+vr.w)/TILE));
    const startY = Math.max(0, Math.floor(vr.y / TILE));
    const endY = Math.min(ROWS-1, Math.ceil((vr.y+vr.h)/TILE));

    for(let y=startY;y<=endY;y++){
      for(let x=startX;x<=endX;x++){
        const noise = ((x*13 + y*7) % 11) / 11;
        ctx.fillStyle = noise > .65 ? 'rgba(255,255,255,.02)' : noise > .35 ? 'rgba(0,0,0,.012)' : 'rgba(0,0,0,.025)';
        ctx.fillRect(x*TILE,y*TILE,TILE,TILE);
      }
    }

    for(const h of game.terrain.hills){
      if(!inView(h.x,h.y,h.r+40)) continue;
      const g = ctx.createRadialGradient(h.x,h.y,h.r*0.18,h.x,h.y,h.r);
      g.addColorStop(0,'rgba(180,160,120,.13)');
      g.addColorStop(1,'rgba(180,160,120,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(h.x,h.y,h.r,0,Math.PI*2); ctx.fill();
    }

    for(const d of game.terrain.dirt){
      if(!inView(d.x,d.y,d.r+40)) continue;
      const g = ctx.createRadialGradient(d.x,d.y,d.r*0.18,d.x,d.y,d.r);
      g.addColorStop(0,'rgba(138,111,71,.34)');
      g.addColorStop(1,'rgba(138,111,71,0)');
      ctx.fillStyle=g;
      ctx.beginPath(); ctx.arc(d.x,d.y,d.r,0,Math.PI*2); ctx.fill();
    }

    for(const w of game.terrain.waters){
      if(!inView(w.x,w.y,Math.max(w.rx,w.ry)+40)) continue;
      const g = ctx.createRadialGradient(w.x,w.y,15,w.x,w.y,Math.max(w.rx,w.ry));
      g.addColorStop(0,'rgba(100,170,220,.85)');
      g.addColorStop(1,'rgba(58,121,176,.96)');
      ctx.fillStyle=g;
      ctx.beginPath();
      ctx.ellipse(w.x,w.y,w.rx,w.ry,0,0,Math.PI*2);
      ctx.fill();
      ctx.strokeStyle='rgba(220,245,255,.22)';
      ctx.lineWidth=3;
      ctx.stroke();
    }

    for(const river of game.terrain.rivers){
      ctx.save();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(66,140,196,.88)';
      ctx.lineWidth = river.width;
      ctx.beginPath(); ctx.moveTo(river.points[0].x, river.points[0].y);
      for(let i=1;i<river.points.length;i++) ctx.lineTo(river.points[i].x, river.points[i].y);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(210,240,255,.20)';
      ctx.lineWidth = Math.max(8, river.width * 0.22);
      ctx.beginPath(); ctx.moveTo(river.points[0].x, river.points[0].y);
      for(let i=1;i<river.points.length;i++) ctx.lineTo(river.points[i].x, river.points[i].y);
      ctx.stroke();
      ctx.restore();
    }

    for(const f of game.terrain.forestRects){
      if(f.x > vr.x + vr.w || f.y > vr.y + vr.h || f.x+f.w < vr.x || f.y+f.h < vr.y) continue;
      ctx.fillStyle='rgba(24,68,35,.22)';
      ctx.fillRect(f.x,f.y,f.w,f.h);
      for(let yy=f.y+12; yy<f.y+f.h; yy+=26){
        for(let xx=f.x+12; xx<f.x+f.w; xx+=26){
          if(!inView(xx,yy,12)) continue;
          ctx.fillStyle='rgba(19,78,40,.9)';
          ctx.beginPath(); ctx.arc(xx+((yy+xx)%9),yy+((xx)%7),10,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='rgba(11,48,23,.9)';
          ctx.fillRect(xx-2,yy+6,4,8);
        }
      }
    }

    for(const s of game.terrain.stones){
      if(!inView(s.x,s.y,12)) continue;
      ctx.fillStyle='rgba(125,132,135,.35)';
      ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill();
    }

    for(const smith of game.blacksmiths){
      if(!inView(smith.x,smith.y,100)) continue;
      ctx.save();
      ctx.translate(smith.x,smith.y);
      ctx.fillStyle='rgba(92,168,255,.08)';
      ctx.fillRect(-smith.w/2,-smith.h/2,smith.w,smith.h);
      ctx.strokeStyle='rgba(216,189,102,.65)';
      ctx.lineWidth=2;
      ctx.strokeRect(-smith.w/2,-smith.h/2,smith.w,smith.h);
      ctx.fillStyle='#d8bd66'; ctx.fillRect(-22,-16,44,28);
      ctx.fillStyle='#2a2a2a'; ctx.fillRect(-12,6,24,6);
      ctx.fillStyle='#ff8c3a'; ctx.fillRect(-8,-2,16,8);
      ctx.restore();
    }

    for(const o of game.objectives){
      if(!inView(o.x,o.y,150)) continue;
      ctx.save();
      ctx.translate(o.x,o.y);
      ctx.strokeStyle = o.controller ? getHouse(o.controller).color : 'rgba(255,255,255,.32)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0,0,o.r,0,Math.PI*2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.04)';
      ctx.beginPath(); ctx.arc(0,0,o.r,0,Math.PI*2); ctx.fill();
      const col = o.type==='forge' ? '#5ca8ff' : o.type==='rally' ? '#d8bd66' : o.type==='arsenal' ? '#ff8c3a' : '#56cf88';
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(0,0,14,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px Inter,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(o.type[0].toUpperCase(), 0, 3);
      ctx.restore();
    }
  }

  function drawCastles(){
    for(const h of game.houses){
      if(!inView(h.castle.x,h.castle.y,120)) continue;
      ctx.save();
      ctx.translate(h.castle.x,h.castle.y);
      ctx.fillStyle='rgba(255,255,255,.10)';
      ctx.fillRect(-52,-44,104,88);
      ctx.fillStyle=h.color;
      ctx.fillRect(-38,-30,76,60);
      ctx.strokeStyle='#12161e'; ctx.lineWidth=2; ctx.strokeRect(-38,-30,76,60);
      ctx.fillStyle=h.color; ctx.fillRect(-16,-52,32,16);
      ctx.fillStyle='#fff'; ctx.font='bold 12px Inter,sans-serif'; ctx.textAlign='center';
      ctx.fillText(h.name.split(' ')[1],0,66);
      ctx.restore();
    }

    const playerCastle = getPlayerHouse().castle;
    const knocked = game.students.filter(s=>s.controller==='player' && s.state==='knocked').sort((a,b)=>a.koUntil-b.koUntil);
    if(knocked.length && inView(playerCastle.x,playerCastle.y,120)){
      const next = knocked[0];
      const remain = Math.max(0, next.koUntil - game.time);
      const fill = clamp(1 - remain/16, 0, 1);
      ctx.fillStyle='rgba(10,14,20,.9)';
      ctx.fillRect(playerCastle.x-44, playerCastle.y-72, 88, 9);
      ctx.fillStyle='#7eb3ff';
      ctx.fillRect(playerCastle.x-44, playerCastle.y-72, 88*fill, 9);
      ctx.strokeStyle='rgba(255,255,255,.3)';
      ctx.strokeRect(playerCastle.x-44, playerCastle.y-72, 88, 9);
    }
  }

  function drawStandards(){
    for(const st of game.standards){
      if(!inView(st.x,st.y,40)) continue;
      ctx.save();
      ctx.translate(st.x,st.y);
      ctx.strokeStyle='#ecf2ff';
      ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(0,13); ctx.lineTo(0,-12); ctx.stroke();
      ctx.fillStyle=getHouse(st.homeOwner).color;
      ctx.beginPath(); ctx.moveTo(0,-12); ctx.lineTo(18,-6); ctx.lineTo(0,0); ctx.closePath(); ctx.fill();
      if(st.dropped){
        ctx.strokeStyle='#ffd08a';
        ctx.beginPath(); ctx.arc(0,0,16,0,Math.PI*2); ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawBoxes(){
    for(const b of game.lootBoxes){
      if(!b.alive || !inView(b.x,b.y,40)) continue;
      ctx.save();
      ctx.translate(b.x,b.y);
      ctx.fillStyle=b.big ? '#c59a2a' : (b.rare ? '#9c7b2e' : '#8f6f3d');
      const sz = b.big ? 34 : 28;
      ctx.fillRect(-16,-16,sz,sz);
      ctx.strokeStyle='#2b2010'; ctx.lineWidth=2; ctx.strokeRect(-16,-16,sz,sz);
      ctx.fillStyle='#111'; ctx.font='bold 10px Inter,sans-serif'; ctx.textAlign='center';
      ctx.fillText(b.big ? 'BIG' : (b.rare ? 'R' : 'L'), 0, 4);
      ctx.fillStyle='rgba(10,14,20,.85)';
      ctx.fillRect(-16,22,32,4);
      ctx.fillStyle='#d3b86b';
      ctx.fillRect(-16,22,32*(b.hp/b.maxHp),4);
      ctx.restore();
    }
  }

  function drawGroundLoot(){
    for(const g of game.groundLoot){
      if(!g.alive || !inView(g.x,g.y,20)) continue;
      ctx.save();
      ctx.translate(g.x,g.y);
      ctx.fillStyle='#d8bd66';
      ctx.beginPath(); ctx.arc(0,0,8,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#111'; ctx.font='bold 9px Inter,sans-serif'; ctx.textAlign='center';
      ctx.fillText(g.item[0],0,3);
      ctx.restore();
    }
  }

  function drawBarricadesAndTraps(){
    for(const b of game.barricades){
      if(!b.alive || !inView(b.x,b.y,40)) continue;
      ctx.save();
      ctx.translate(b.x,b.y);
      ctx.fillStyle='#7a5936';
      ctx.fillRect(-b.w/2,-b.h/2,b.w,b.h);
      ctx.strokeStyle='#2e2317'; ctx.lineWidth=2;
      ctx.strokeRect(-b.w/2,-b.h/2,b.w,b.h);
      ctx.restore();
    }

    for(const t of game.traps){
      if(!t.alive || t.controller!=='player' || !inView(t.x,t.y,18)) continue;
      ctx.save();
      ctx.translate(t.x,t.y);
      ctx.strokeStyle='rgba(242,210,90,.6)';
      ctx.beginPath(); ctx.arc(0,0,8,0,Math.PI*2); ctx.stroke();
      ctx.restore();
    }
  }

  function getOrderVisual(s){
    if(!s || s.state==='knocked') return null;

    let tx = s.tx, ty = s.ty;
    let color = '#7fb2ff';
    let pulse = false;
    let targetEntity = null;

    if(s.order.type==='attack'){
      targetEntity = game.students.find(e=>e.id===s.order.targetId && e.state!=='knocked');
      if(targetEntity){ tx = targetEntity.x; ty = targetEntity.y; }
      color = '#ff6e6e';
      pulse = true;
    }else if(s.order.type==='attackMove'){
      if(s.engageId){
        targetEntity = game.students.find(e=>e.id===s.engageId && e.state!=='knocked');
        if(targetEntity){ tx = targetEntity.x; ty = targetEntity.y; }
      }
      color = '#ffb347';
    }else if(s.order.type==='capture'){
      const st = getStandard(s.order.targetId || s.order.targetType==='standard' ? s.order.targetId : null);
      if(st){ tx = st.x; ty = st.y; }
      color = '#f3f0ff';
    }else if(s.order.type==='defend'){
      color = '#d8bd66';
    }else if(s.order.type==='escort'){
      const car = game.students.find(e=>e.id===s.order.targetId && e.state!=='knocked');
      if(car){ tx = car.x; ty = car.y; targetEntity = car; }
      color = '#56cf88';
    }else if(s.order.type==='box'){
      const b = game.lootBoxes.find(x=>x.id===s.order.targetId && x.alive);
      if(b){ tx = b.x; ty = b.y; }
      color = '#d8bd66';
    }else if(s.order.type==='groundLoot'){
      const g = game.groundLoot.find(x=>x.id===s.order.targetId && x.alive);
      if(g){ tx = g.x; ty = g.y; }
      color = '#d8bd66';
    }else if(s.order.type==='attackBarricade'){
      const b = game.barricades.find(x=>x.id===s.order.targetId && x.alive);
      if(b){ tx = b.x; ty = b.y; }
      color = '#ff7f7f';
    }else if(s.order.type==='buildBarricade' || s.order.type==='buildTrap'){
      color = '#f2d25a';
    }

    return {tx,ty,color,pulse,targetEntity};
  }

  function drawCommandMarker(x,y,color,pulse=false){
    const t = pulse ? (0.75 + Math.sin(game.time * 10) * 0.25) : 1;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.arc(x,y,10*t,0,Math.PI*2);
    ctx.stroke();
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.arc(x,y,17*t,0,Math.PI*2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(x-7,y); ctx.lineTo(x+7,y);
    ctx.moveTo(x,y-7); ctx.lineTo(x,y+7);
    ctx.stroke();
    ctx.restore();
  }

  function drawCommandTelegraphs(){
    const selectedUnits = getSelectedUnits().filter(s=>s.state!=='knocked');
    if(!selectedUnits.length) return;

    const highlightedEnemyIds = new Set();

    for(const s of selectedUnits){
      const vis = getOrderVisual(s);
      if(!vis) continue;

      const shouldShow =
        s.order.type!=='idle' ||
        s.engageId ||
        dist(s.x,s.y,s.tx,s.ty) > 22;

      if(!shouldShow) continue;

      ctx.save();
      ctx.strokeStyle = vis.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.75;
      ctx.setLineDash(s.order.type==='attackMove' ? [10,8] : [8,6]);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(vis.tx, vis.ty);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      drawCommandMarker(vis.tx, vis.ty, vis.color, vis.pulse);

      if(s.order.type==='attack' && s.order.targetId){
        highlightedEnemyIds.add(s.order.targetId);
      }
    }

    for(const enemyId of highlightedEnemyIds){
      const e = game.students.find(s=>s.id===enemyId && s.state!=='knocked');
      if(!e) continue;
      const pulse = 1 + Math.sin(game.time * 10) * 0.12;
      ctx.save();
      ctx.fillStyle = 'rgba(255,80,80,.12)';
      ctx.beginPath();
      ctx.arc(e.x,e.y,e.radius+12*pulse,0,Math.PI*2);
      ctx.fill();
      ctx.strokeStyle = '#ff5858';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x,e.y,e.radius+10*pulse,0,Math.PI*2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawRoleCircle(x,y,segs){
    ctx.save();
    ctx.translate(x,y);
    if(segs.length===1){
      ctx.fillStyle=segs[0];
      ctx.beginPath(); ctx.arc(0,0,5,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#0f1117'; ctx.lineWidth=1; ctx.stroke();
    }else{
      ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,5,-Math.PI/2,Math.PI/2); ctx.closePath(); ctx.fillStyle=segs[0]; ctx.fill();
      ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,5,Math.PI/2,3*Math.PI/2); ctx.closePath(); ctx.fillStyle=segs[1]; ctx.fill();
      ctx.strokeStyle='#0f1117'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(0,0,5,0,Math.PI*2); ctx.stroke();
    }
    ctx.restore();
  }

  function drawWeaponAttack(s){
    if(s.swing<=0 || s.weapon==='Bow' || s.weapon==='Longbow') return;
    const progress = 1 - (s.swing / 0.28);
    const arcBase = s.facingDir==='right' ? 0 : s.facingDir==='left' ? Math.PI : -Math.PI/2;
    const start = arcBase + s.swingSide * -0.9;
    const end = arcBase + s.swingSide * (progress*1.8 - 0.9);
    ctx.strokeStyle=getWeaponColor(s.weaponLevel);
    ctx.lineWidth=s.weapon==='Spear' ? 2 : 3;
    ctx.beginPath();
    ctx.arc(s.x, s.y-2, s.weapon==='Spear'?24:16, start, end, s.swingSide<0);
    ctx.stroke();
  }

  function drawStudents(){
    for(const s of game.students){
      if(s.state==='knocked' || !inView(s.x,s.y,44)) continue;
      const h = getHouse(s.controller);

      if(game.selected.has(s.id)){
        ctx.strokeStyle='#d6e6ff';
        ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(s.x,s.y,s.radius+7,0,Math.PI*2); ctx.stroke();
      }

      ctx.fillStyle='rgba(0,0,0,.22)';
      ctx.beginPath(); ctx.ellipse(s.x,s.y+12,8,4,0,0,Math.PI*2); ctx.fill();

      drawRoleCircle(s.x, s.y-32, getRoleSegments(s));
      drawWeaponAttack(s);

      ctx.fillStyle = h.color;
      ctx.fillRect(s.x-5, s.y-5, 10, 14);
      ctx.fillStyle = '#f1d2b4';
      ctx.beginPath(); ctx.arc(s.x, s.y-9, 5, 0, Math.PI*2); ctx.fill();

      if(s.weapon==='Bow' || s.weapon==='Longbow'){
        ctx.strokeStyle=getWeaponColor(s.weaponLevel);
        ctx.lineWidth=2;
        ctx.beginPath();
        ctx.arc(s.x+8,s.y-1, s.weapon==='Longbow' ? 6 : 5, -1.2,1.2);
        ctx.stroke();
      }else if(s.weapon==='Sword' || s.weapon==='Spear'){
        ctx.strokeStyle=getWeaponColor(s.weaponLevel);
        ctx.lineWidth=s.weapon==='Spear'?2:3;
        const len = s.weapon==='Spear' ? 20 : 13;
        let ex=s.x, ey=s.y;
        if(s.facingDir==='right'){ ex += len; ey -= 2; }
        else if(s.facingDir==='left'){ ex -= len; ey -= 2; }
        else { ey -= len; }
        ctx.beginPath(); ctx.moveTo(s.x, s.y-1); ctx.lineTo(ex, ey); ctx.stroke();
      }

      if(s.item==='Shield'){
        ctx.fillStyle='rgba(235,220,170,.9)';
        if(s.facingDir === 'left') ctx.fillRect(s.x-10, s.y-2, 5, 8);
        else ctx.fillRect(s.x+5, s.y-2, 5, 8);
      }
      if(s.item==='WarHorn'){
        ctx.fillStyle='#d8bd66';
        ctx.fillRect(s.x-8, s.y-2, 4, 8);
      }
      if(s.item==='FireOil'){
        ctx.fillStyle='#ff8c3a';
        ctx.beginPath(); ctx.arc(s.x-7,s.y+1,3,0,Math.PI*2); ctx.fill();
      }
      if(s.mount){
        ctx.strokeStyle='rgba(180,140,90,.7)';
        ctx.beginPath(); ctx.ellipse(s.x,s.y+5,11,6,0,0,Math.PI*2); ctx.stroke();
      }

      ctx.fillStyle='#1a2230';
      ctx.fillRect(s.x-12,s.y-22,24,4);
      ctx.fillStyle=s.hp>55?'#58d37f':s.hp>25?'#e0ae50':'#e26666';
      ctx.fillRect(s.x-12,s.y-22,24*(s.hp/s.maxHp),4);

      if(isEngineer(s)){
        const remain = Math.max(0, s.engineerCdUntil - game.time);
        ctx.fillStyle='rgba(10,14,20,.8)';
        ctx.fillRect(s.x-12, s.y-28, 24, 3);
        ctx.fillStyle=remain>0 ? '#dfad5a' : '#56cf88';
        ctx.fillRect(s.x-12, s.y-28, 24*(remain>0 ? (1 - remain/12) : 1), 3);
      }

      if(s.smithTimer > 0 && s.weapon!=='None' && s.weaponLevel < 3){
        ctx.fillStyle='rgba(10,14,20,.8)';
        ctx.fillRect(s.x-12, s.y-34, 24, 3);
        ctx.fillStyle='#5ca8ff';
        const bonusForge = objectiveBuffsFor(s.controller).forge;
        const needed = bonusForge ? 12 : 18;
        ctx.fillRect(s.x-12, s.y-34, 24*(s.smithTimer/needed), 3);
      }

      if(s.burnUntil > game.time){
        ctx.strokeStyle='#ff8c3a';
        ctx.beginPath(); ctx.arc(s.x,s.y-9,9,0,Math.PI*2); ctx.stroke();
      }

      if(s.carryingStandard){
        ctx.fillStyle='#fff';
        ctx.font='10px Inter,sans-serif';
        ctx.fillText('⚑',s.x+10,s.y-12);
      }
    }
  }

  function drawProjectilesAndParticles(){
    for(const p of game.projectiles){
      if(!inView((p.x1+p.x2)/2,(p.y1+p.y2)/2,100)) continue;
      ctx.strokeStyle = p.blocked ? '#ffe79e' : getHouse(p.controller).color;
      ctx.lineWidth = p.blocked ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(p.x1,p.y1);
      ctx.lineTo(p.x2,p.y2);
      ctx.stroke();
    }
    for(const p of game.particles){
      if(!inView(p.x,p.y,20)) continue;
      ctx.globalAlpha = Math.max(0,p.t/0.5);
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r || 2.2,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=1;
    }
  }

  function drawDrag(){
    if(!game.drag?.active) return;
    const d=game.drag;
    ctx.strokeStyle='#8ab7ff';
    ctx.lineWidth=1.4;
    ctx.setLineDash([6,4]);
    ctx.strokeRect(d.x0,d.y0,d.x1-d.x0,d.y1-d.y0);
    ctx.setLineDash([]);
  }

  function drawPlacementGhost(){
    if(!placementMode) return;
    const x = mouseWorld.x, y = mouseWorld.y;
    ctx.save();
    ctx.globalAlpha = 0.7;
    if(placementMode==='barricade'){
      ctx.strokeStyle='#f2d25a'; ctx.lineWidth = 2;
      ctx.strokeRect(x-22,y-9,44,18);
      ctx.fillStyle='rgba(242,210,90,.15)';
      ctx.fillRect(x-22,y-9,44,18);
    } else if(placementMode==='trap'){
      ctx.strokeStyle='#f2d25a';
      ctx.beginPath(); ctx.arc(x,y,8,0,Math.PI*2); ctx.stroke();
      ctx.fillStyle='rgba(242,210,90,.15)';
      ctx.beginPath(); ctx.arc(x,y,8,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  function drawLootIndicators(){
    const rect = canvas.getBoundingClientRect();
    const vw = rect.width;
    const vh = rect.height;
    const cx = game.cam.x + vw/2;
    const cy = game.cam.y + vh/2;
    const margin = 34;

    const nearby = game.lootBoxes
      .filter(b=>b.alive)
      .map(b=>({box:b, d:dist(b.x,b.y,cx,cy)}))
      .filter(entry=>{
        const b = entry.box;
        const offscreen = b.x < game.cam.x+20 || b.x > game.cam.x+vw-20 || b.y < game.cam.y+20 || b.y > game.cam.y+vh-20;
        return offscreen && entry.d < 950;
      })
      .sort((a,b)=>a.d-b.d)
      .slice(0, 6);

    for(const entry of nearby){
      const b = entry.box;
      const ang = Math.atan2(b.y - cy, b.x - cx);
      const ex = vw/2 + Math.cos(ang) * (vw/2 - margin);
      const ey = vh/2 + Math.sin(ang) * (vh/2 - margin);

      ctx.save();
      ctx.translate(ex, ey);
      ctx.fillStyle = 'rgba(12,18,28,.88)';
      ctx.beginPath(); ctx.arc(0,0,18,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle = b.big ? '#d8bd66' : (b.rare ? '#c79c3f' : '#cfd7ea');
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0,0,18,0,Math.PI*2); ctx.stroke();
      ctx.fillStyle = b.big ? '#c59a2a' : (b.rare ? '#9c7b2e' : '#8f6f3d');
      ctx.fillRect(-7,-7,14,14);
      ctx.strokeStyle = '#20170d'; ctx.lineWidth = 1.5; ctx.strokeRect(-7,-7,14,14);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 9px Inter,sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(b.big ? 'B' : 'L', 0, 3);
      ctx.restore();
    }
  }

  function render(){
    if(window.AcademyDraw){window.AcademyDraw(api);return;}
    const rect = canvas.getBoundingClientRect();
    const vw = rect.width, vh = rect.height;
    ctx.clearRect(0,0,vw,vh);
    ctx.save();
    ctx.translate(-game.cam.x, -game.cam.y);

    drawGround();
    drawBoxes();
    drawGroundLoot();
    drawBarricadesAndTraps();
    drawCastles();
    drawStandards();
    drawCommandTelegraphs();
    drawStudents();
    drawProjectilesAndParticles();
    drawPlacementGhost();
    drawDrag();

    if(game.gameOver){
      ctx.fillStyle='rgba(0,0,0,.42)';
      ctx.fillRect(game.cam.x, game.cam.y, vw, vh);
      ctx.fillStyle='#fff';
      ctx.textAlign='center';
      ctx.font='900 42px Inter,sans-serif';
      ctx.fillText(getPlayerHouse().controller==='player' ? 'VICTORY' : 'DEFEAT', game.cam.x+vw/2, game.cam.y+vh/2-10);
      ctx.font='500 16px Inter,sans-serif';
      ctx.fillText('Press Restart to begin another trial.', game.cam.x+vw/2, game.cam.y+vh/2+20);
      ctx.textAlign='left';
    }

    ctx.restore();
    drawLootIndicators();
  }

  function frame(ts){
    if(!game.last) game.last = ts;
    const dt = Math.min(0.033, (ts - game.last)/1000);
    game.last = ts;
    if(!game.paused)update(dt);
    else{
      const horizontal=(keysDown.has('ArrowRight')?1:0)-(keysDown.has('ArrowLeft')?1:0);
      const vertical=(keysDown.has('ArrowDown')?1:0)-(keysDown.has('ArrowUp')?1:0);
      if(horizontal||vertical){
        const view=canvas.getBoundingClientRect();
        game.cam.x=clamp(game.cam.x+horizontal*520*dt,0,Math.max(0,WORLD_W-view.width));
        game.cam.y=clamp(game.cam.y+vertical*520*dt,0,Math.max(0,WORLD_H-view.height));
        if(ts-lastCameraUIAt>80){lastCameraUIAt=ts;refreshUI();}
      }
    }
    render();
    requestAnimationFrame(frame);
  }

  const api={
    game,canvas,ctx,DPR,TILE,COLS,ROWS,WORLD_W,WORLD_H,HOUSE_DEFS,LOOT_KEYS,FLAG_CAPTURE_DURATION,
    getHouse,getStandard,getPlayerHouse,objectiveBuffsFor,getSelectedUnits,
    selectUnits,selectSquad,saveSquad,resetSquad,getSquadUnits,getSquadName,getRole,
    issueFormationOrder,setOrder,issueBuildOrder,applyLoadout,refreshUI,resize,
    init,restart:init,setPaused,getPaused:()=>game.paused,setDifficulty,exportSave,importSave,
    equipPreset,autoEquipSelected,equipItemOn,spendLootOnSelected,
    focusParty,focusHome,centerCamera,setFollowTargets,
    setMode,getMode:()=>controlMode,getPlacementMode:()=>placementMode,
    setFormation,stopSelected,
    recall:()=>document.getElementById('recall').click(),
    focusFlag:()=>document.getElementById('focusFlag').click(),
    log,combatMatchup,housePower,startFlagCapture,updateFlagCaptures,updateAttackActions,updateProjectiles,
    hitStudent,hitBox,hitGroundLoot,hitStandard,hitBarricade,
    inView,visibleRect,dist,clamp,lerp,hashId,facingVector,screenToWorld,
    drawGround,drawBoxes,drawGroundLoot,drawBarricadesAndTraps,drawCastles,
    drawStandards,drawCommandTelegraphs,drawStudents,drawProjectilesAndParticles,
    drawPlacementGhost,drawDrag,drawLootIndicators,
    update,render,
    getMouseWorld:()=>({...mouseWorld}),
    getCounters:()=>[
      {name:'Spears stop cavalry',detail:'75% more spear damage against mounted students and a brief slow.'},
      {name:'Shields face arrows',detail:'Frontal shots have the highest shield-block chance. Flank to avoid it.'},
      {name:'Flank heavy infantry',detail:'Rear attacks ignore much of heavy armor and deal 20% more damage.'},
      {name:'Cavalry hunts archers',detail:'Mounted fighters deal 30% more damage to bow users. Keep spears nearby.'}
    ]
  };
  window.Academy=api;
  window.AcademyTest={updateObjectives,combatMatchup,handleBannerPickup,captureBanner,secureReturnedBanner,transferHouse,checkVictory,attackTarget,performBowShot,attackBox,attackBarricade,tryShieldBlock,knockOut,respawnStudent,autoEquipAI,terrainClear,segmentClear,resolveDestination,pathfind,rebuildWalkableGrid,startFlagCapture,updateFlagCaptures,interruptFlagCapture,applyStudentDamage,beginAttack,resolveAttack,updateAttackActions,updateProjectiles,cancelAttackAction,update,init};

  init();
  requestAnimationFrame(frame);
})();

