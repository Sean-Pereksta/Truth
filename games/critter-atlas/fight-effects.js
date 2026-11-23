import { REGIONS, SPECIES, getForm } from './catalog.js';
import { spriteAtlas } from './art.js';
import { FIGHT_ICONS, fightIcon, abilityIconKey, auraIconKey, hazardIconKey } from './fight-icons.js';

// Draw effects on a low-resolution plane. The creature actors themselves keep their
// original painted sprites and are positioned in percentages for responsive boards.
const WIDTH = 420;
const TAU = 2 * Math.PI;
const PALETTES = [
  ['#50874c','#a5e986','#f5ffbd'], ['#387580','#77e6d0','#d5fff0'],
  ['#8759bb','#d5a8ff','#f5e8ff'], ['#307eb5','#7ee1fb','#ebffff'],
  ['#6698bf','#b9e7ff','#ffffff'], ['#b04339','#ff9955','#fff1a4'],
  ['#a77b35','#efbb66','#fff7ba'], ['#7162b8','#b29bff','#fff0ff']
];
const GOLD = ['#a06331','#ffbf5b','#ffffbb'];
const MINT = ['#368e76','#8deab4','#edffbc'];
const ROSE = ['#954653','#ff987f','#ffe6b4'];
const VIOLET = ['#78518e','#dda4ff','#fff6dd'];
const BLUE = ['#4e82aa','#9bdcfe','#f1fffc'];
const SUPPORT_TONES = { power: GOLD, ward: BLUE, haste: ROSE, cleanse: VIOLET, regen: MINT };
const artRegion = region => REGIONS[region]?.artRegion ?? region;
const atlases = new Map();
const poseAtlases = new Map();
function warmPose(speciesId) {
  const sheet = spriteAtlas(speciesId)?.sheet;
  if (!sheet || typeof Image === 'undefined') return;
  if (!poseAtlases.has(sheet)) {
    const img=new Image();
    try { img.src=new URL('./assets/poses-'+sheet+'.webp',import.meta.url).href; }
    catch { return; }
    poseAtlases.set(sheet,img);
  }
  return poseAtlases.get(sheet);
}
const clamp = (n,lo=0,hi=1) => Math.max(lo, Math.min(hi,n));
const mix = (a,b,t) => a + (b-a)*t;
const part = (t,start,end) => clamp((t-start)/(end-start));
const ease = t => t*t*(3-2*t);
const wave = t => Math.sin(clamp(t)*Math.PI);
const between = (a,b,t) => ({x:mix(a.x,b.x,t), y:mix(a.y,b.y,t)});

function atlas(name) {
  if (!atlases.has(name) && typeof Image !== 'undefined') {
    const img = new Image();
    img.src = new URL('./assets/fight-fx-'+name+'.webp',import.meta.url).href;
    atlases.set(name,img);
  }
  return atlases.get(name);
}

export function warmFightEffects(units = []) {
  atlas('actions');
  atlas('regions');
  for (const unit of units) warmPose(unit.member.speciesId);
}

function paintFrame(ctx, name, row, t, point, size, facing=1) {
  const img = atlas(name);
  if (!img?.complete || !img.naturalWidth) return;
  const w = img.naturalWidth / 4, h = img.naturalHeight / 8;
  const frame = Math.min(3,Math.floor(clamp(t)*4));
  ctx.save();
  ctx.translate(Math.round(point.x),Math.round(point.y));
  ctx.scale(facing,1);
  ctx.drawImage(img,frame*w,row*h,w,h,-size/2,-size/2,size,size);
  ctx.restore();
}

function dot(ctx,x,y,size,color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x),Math.round(y),size,size);
}

function sparkle(ctx,x,y,size,palette) {
  ctx.fillStyle=palette[1];
  ctx.fillRect(Math.round(x-size),Math.round(y),size*2+1,1);
  ctx.fillRect(Math.round(x),Math.round(y-size),1,size*2+1);
  dot(ctx,x,y,1,palette[2]);
}

function line(ctx,points,color,width=1) {
  if (!points.length) return;
  ctx.strokeStyle=color; ctx.lineWidth=width;
  ctx.beginPath();
  ctx.moveTo(Math.round(points[0].x),Math.round(points[0].y));
  for (const p of points.slice(1)) ctx.lineTo(Math.round(p.x),Math.round(p.y));
  ctx.stroke();
}

function ring(ctx,p,r,palette,flat=.48,angle=0) {
  const steps=12;
  const points=Array.from({length:steps+1},(_,i) => {
    const a=i/steps*TAU+angle;
    return {x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r*flat};
  });
  line(ctx,points,palette[0],3);
  line(ctx,points,palette[1],1);
  for (let i=0;i<steps;i+=3) dot(ctx,points[i].x,points[i].y,2,palette[2]);
}

function burst(ctx,p,t,palette,count=10,radius=24) {
  if (t<=0 || t>=1) return;
  ctx.save(); ctx.globalAlpha*=1-t**2;
  for (let i=0;i<count;i++) {
    const a=TAU*i/count+i*.18, distance=radius*(.2+.8*t)*(.65+(i%3)*.16);
    const x=p.x+Math.cos(a)*distance, y=p.y+Math.sin(a)*distance*.83+t*t*5;
    line(ctx,[{x:x-Math.cos(a)*3,y:y-Math.sin(a)*3},{x,y}],palette[i%2],2);
    if (i%3===0) sparkle(ctx,x,y,2,palette);
    else dot(ctx,x,y,2,palette[2]);
  }
  ctx.restore();
}

function streak(ctx,source,target,t,palette,arc=0) {
  const pointAt = u => {
    const p=between(source,target,u); p.y-=wave(u)*arc; return p;
  };
  const points=Array.from({length:7},(_,i)=>pointAt(clamp(t-(6-i)*.035)));
  line(ctx,points,palette[0],5); line(ctx,points.slice(2),palette[1],3);
  line(ctx,points.slice(-3),palette[2]);
  const head=points.at(-1);
  sparkle(ctx,head.x,head.y,2,palette);
  return head;
}

// Each signature keeps its physical motion across evolutions. For example, a quill
// travels as a volley, a voice expands as a wave, and a stone attack splits the floor.
const SIGNATURE_MOTIONS = [
  ['slash','rush','cloud','volley','bind','fracture','shower'],
  ['fracture','lance','wave','volley','bind','rush','wave'],
  ['slash','wave','wave','fracture','wave','fracture','lance'],
  ['bind','slash','cloud','volley','rush','shower','wave'],
  ['fracture','volley','slash','wave','rush','lance','rush'],
  ['rush','volley','rush','lance','cloud','rush','fracture'],
  ['volley','shower','sigil','lance','volley','rush','sigil'],
  ['slash','cloud','bind','rush','volley','sigil','wave'],
  ['cloud','slash','fracture','volley','rush'],
  ['rush','slash','bind','wave','lance'],
  ['wave','rush','fracture','bind','shower'],
  ['rush','cloud','sigil','sigil','rush'],
  ['moondust','chord','broadside','peal','eclipse']
].flat();
const WONDER_TONES = {
  moondust: ['#476770','#a1f5bc','#ffe59b'],
  chord: ['#9259ac','#ffc3eb','#fff2ff'],
  broadside: ['#355d84','#8affdb','#edfaff'],
  peal: ['#77352b','#ff952c','#fff3a1'],
  eclipse: ['#3c2865','#d0a0ff','#ffe897']
};
const SPECIAL_MOTIONS = { 'Pinning Shot':'bind', Feint:'slash', Faultline:'fracture', Sightline:'lance', Crosscut:'slash' };

function drawMotion(ctx,motion,src,p,t,tone,dir,apex) {
  if (!motion || t<=0 || t>=1) return;
  const size=apex?25:19;
  ctx.save(); ctx.globalAlpha*=Math.min(1,1.35*(1-t));
  switch (motion) {
    case 'moondust':
      for (let i=0;i<6;i++) {
        const angle=(i-2.5)*.38, reach=(.32+t)*size;
        const x=p.x+dir*Math.cos(angle)*reach, y=p.y+Math.sin(angle)*reach;
        line(ctx,[{x:x-dir*4,y:y-3},{x:x-dir*5,y},{x:x-dir*2,y:y+3},{x:x+dir*2,y:y+2}],tone[i%2+1],2);
        sparkle(ctx,x-dir*7,y-4,1,tone);
      }
      break;
    case 'chord':
      for (let i=0;i<3;i++) {
        const rise=(1+t)*i*4, width=size*(.25+.55*t);
        ring(ctx,{x:p.x,y:p.y-rise},width+i*2,tone,.34);
        sparkle(ctx,p.x+(i-1)*8,p.y-size*t-rise,2,tone);
      }
      break;
    case 'broadside':
      for (let i=-1;i<=1;i++) {
        const f=clamp(t*1.35-Math.abs(i)*.16);
        const a={x:src.x,y:src.y+i*5}, b={x:p.x+dir*i*4,y:p.y+i*7};
        const shot=streak(ctx,a,b,f,tone,6-i*3);
        ring(ctx,shot,3+f*3,tone,.55,t*2);
      }
      break;
    case 'peal':
      for (let i=0;i<3;i++) {
        const radius=(i+t+.3)*size*.42;
        const pts=[{x:p.x-radius,y:p.y},{x:p.x,y:p.y-radius*.58},{x:p.x+radius,y:p.y},
          {x:p.x,y:p.y+radius*.58},{x:p.x-radius,y:p.y}];
        line(ctx,pts,tone[(i+1)%3],2);
        sparkle(ctx,p.x+radius,p.y,2,tone);
      }
      break;
    case 'eclipse': {
      const head={x:p.x,y:p.y-size*.56};
      const radius=size*(.24+.2*t);
      ctx.fillStyle=tone[0];ctx.beginPath();ctx.arc(head.x,head.y,radius,0,TAU);ctx.fill();
      ring(ctx,head,radius,tone,1,t);
      const prisms=['#adeefa','#b4efb1','#ffe395','#ffb9cf','#b6abff','#8ad3ee'];
      prisms.forEach((color,i)=>{
        const x=(i-2.5)*size*.37, top={x:head.x+x*.55,y:head.y+radius};
        const tip={x:p.x+x,y:p.y+2+t*size*.74-Math.abs(x)*.25};
        line(ctx,[top,tip,{x:tip.x-dir*2,y:tip.y-5}],color,2);
      });
      break;
    }
    case 'wave':
    case 'bind':
      for(let i=0;i<3;i++) {
        const radius=(motion==='wave'?5+(i+t)*size*.49:7+(i+1-t)*size*.32);
        ring(ctx,{x:p.x,y:p.y+i*2},radius,tone,motion === 'wave' ? 0.70 : 0.36,t*1.8);
      }
      break;
    case 'sigil': {
      ring(ctx,p,size,tone,.86,t*.9);
      const star=Array.from({length:6},(_,i)=>{
        const angle=t*.9+TAU*i*2/5;
        return {x:p.x+Math.cos(angle)*size,y:p.y+Math.sin(angle)*size*.86};
      });
      line(ctx,star,tone[1]); break;
    }
    case 'fracture':
      for (let i=0;i<4;i++) {
        const side=i%2?1:-1, run=(6+size*t)*(1+Math.floor(i/2)*.3);
        const a={x:p.x,y:p.y+8}, b={x:p.x+side*run*.36,y:p.y+10+(i<2?2:-3)};
        const c={x:b.x+side*3,y:b.y+(i<2?4:-4)};
        const d={x:p.x+side*run,y:c.y+(i<2?2:-2)};
        line(ctx,[a,b,c,d],tone[0],3);line(ctx,[a,b,c,d],tone[2]);
      }
      break;
    case 'shower':
    case 'volley':
      for(let i=0;i<5;i++) {
        const f=clamp(t*1.4-i*.095), x=(i-2)*6;
        const from=motion==='shower'?{x:p.x+x-dir*7,y:p.y-27-i*2}:{x:src.x,y:src.y+(i-2)*3};
        const to={x:p.x+x*.62,y:p.y+Math.sin(i)*5};
        const q=between(from,to,f), tail=between(from,to,clamp(f-.13));
        line(ctx,[tail,q],tone[1],2);dot(ctx,q.x,q.y,2,tone[2]);
      }
      break;
    case 'cloud':
      for(let i=0;i<13;i++) {
        const angle=i*2.43+t*2, r=(6+size*.7*t)*(.6+i%4*.12);
        const x=p.x+Math.cos(angle)*r, y=p.y+Math.sin(angle)*r*.62-t*8;
        dot(ctx,x-1,y,3,tone[i%2]);dot(ctx,x,y-1,2,tone[2]);
      }
      break;
    case 'lance':
      line(ctx,[between(src,p,.28),p],tone[0],5);
      line(ctx,[between(src,p,.43),p],tone[1],3);
      line(ctx,[between(src,p,.61),p],tone[2]); break;
    case 'rush':
    case 'slash':
      for(let i=0;i<3;i++) {
        const y=(i-1)*6, rise=motion==='slash'?12*(i%2?1:-1):2;
        const x=p.x+dir*(t-.5)*size*.7;
        line(ctx,[{x:x-dir*(size+i*2),y:p.y+y+rise},{x:x+dir*5,y:p.y+y}],tone[1],2);
      }
      break;
  }
  ctx.restore();
}

function badgeInfo(e) {
  switch(e.type) {
    case 'move': return [];
    case 'attack': return [['damage','−'+e.amount],...e.modifiers.map(m=>[m,FIGHT_ICONS[m].label])];
    case 'heal': return [[e.aura ? auraIconKey(e.aura) : e.buff ?? 'heal','+'+e.amount]];
    case 'support': return [[e.buff,FIGHT_ICONS[e.buff].label + (e.recipients.length > 1 ? ' ×' + e.recipients.length : '')]];
    case 'guard': return [['guard','Guard']];
    case 'wait': return [['wait','Wait']];
    case 'capture': return [[e.success?'caught':'escaped',e.success?'Caught!':'Escaped']];
    case 'faint': return [['faint','Fainted']];
    case 'hazard': return [[hazardIconKey(e.region),e.name + (e.amount?' −'+e.amount:'')]];
    case 'status': {
      const name=FIGHT_ICONS[e.effect]?.label ?? e.effect;
      return [[e.effect,e.phase==='expire'?name+' ended':e.phase==='skip'?'Turn skipped':name]];
    }
    case 'recovery': return [['cooldown',e.phase==='expire'?'Ability ready':'Cooling down']];
    case 'outcome': return [[{won:'victory',lost:'defeat',fled:'retreat'}[e.result],{won:'Victory',lost:'Defeat',fled:'Retreated'}[e.result]]];
    default: return [];
  }
}

function makeLabel(layer, entries) {
  if (!entries.length) return null;
  const label = layer.ownerDocument.createElement('span');
  label.className='cfx-label';
  for (const [key,text] of entries) {
    const item=layer.ownerDocument.createElement('span');
    item.className='cfx-pill';
    item.dataset.effect=key;
    item.innerHTML=fightIcon(key,'');
    item.append(layer.ownerDocument.createTextNode(text));
    label.append(item);
  }
  layer.append(label);
  return label;
}

function createScene(board, battle, sprite) {
  const rect=board.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const scale=WIDTH/rect.width;
  const h=Math.round(rect.height*scale);
  const doc=board.ownerDocument;
  const layer=doc.createElement('div');
  layer.className='cfx-layer'; layer.setAttribute('aria-hidden','true');
  const canvas=doc.createElement('canvas');
  canvas.className='cfx-canvas'; canvas.width=WIDTH; canvas.height=h;
  const ctx=canvas.getContext('2d');
  if (!ctx) return null;
  layer.append(canvas);
  board.append(layer);
  board.classList.add('cfx-playing');
  ctx.imageSmoothingEnabled=false;
  const points=new Map(), ghosts=new Map(), originals=new Set();
  const center={x:WIDTH/2,y:h/2};
  function point(key) {
    if (!Number.isInteger(key)) return center;
    if (!points.has(key)) {
      const cell=board.querySelector('[data-cell="'+key+'"]');
      if (!cell) return center;
      const r=cell.getBoundingClientRect();
      points.set(key,{x:(r.left-rect.left+r.width*.5)*scale,y:(r.top-rect.top+r.height*.46)*scale});
    }
    return points.get(key);
  }
  function actor(id,key) {
    if (!Number.isInteger(id)) return null;
    if (ghosts.has(id)) return ghosts.get(id);
    const cell=board.querySelector('[data-cell="'+key+'"]');
    const orig=cell?.querySelector('.cb-creature');
    const unit=battle?.units[id];
    if (!orig && !unit) return null;
    const visual=doc.createElement('span'); visual.className='cfx-avatar';
    const face=doc.createElement('span'); face.className='cfx-facing';
    if (unit && sprite) face.innerHTML=sprite(unit.member.speciesId,getForm(unit.member).stage);
    else if (orig) face.innerHTML=orig.innerHTML;
    const r=orig?.getBoundingClientRect();
    const cr=cell?.getBoundingClientRect();
    const w=r?.width || (cr?.width || rect.width/7.5)*.8;
    const height=r?.height || (cr?.height || rect.height/4)*.71;
    visual.style.width=w/rect.width*100+'%';
    visual.style.height=height/rect.height*100+'%';
    visual.append(face); layer.append(visual);
    if (cell && orig) { originals.add(cell); cell.classList.add('cfx-replaced'); }
    const homeFacing=unit?.team==='wild'||cell?.classList.contains('cb-wild')?-1:1;
    const species=unit && SPECIES[unit.member.speciesId];
    const poseAtlas=species && warmPose(species.id);
    const ghost={
      element:visual, facing:homeFacing, species,
      pose(p,opts={}) {
        visual.style.left=p.x/WIDTH*100+'%'; visual.style.top=p.y/h*100+'%';
        visual.style.transform='translate(-50%, -50%) rotate('+(opts.rotate||0)+'deg) scale('+(opts.sx??1)+','+(opts.sy??1)+')';
        visual.style.opacity=String(opts.opacity??1);
        visual.style.filter=opts.light?'drop-shadow(0 2px 1px #11221bab) brightness('+opts.light+')':'';
        face.style.transform='scaleX('+(opts.face || homeFacing)+')';
        visual.classList.toggle('cf-strike-pose',!!(opts.strike && poseAtlas?.complete && poseAtlas.naturalWidth));
      }
    };
    ghost.pose(point(key)); ghosts.set(id,ghost);
    return ghost;
  }
  return {
    ctx,layer,h,center,point,actor,battle,
    placeLabel(el,p,opacity=1) {
      if (!el) return;
      el.style.left=clamp(p.x/WIDTH*100,11,89)+'%';
      el.style.top=clamp(p.y/h*100,6,94)+'%';
      el.style.opacity=String(opacity);
    },
    close() {
      layer.remove(); board.classList.remove('cfx-playing');
      originals.forEach(cell=>cell.classList.remove('cfx-replaced'));
    }
  };
}

const DURATIONS={attack:530,heal:540,support:510,capture:770,guard:310,wait:260,faint:400,hazard:360,status:235,recovery:185,outcome:330};

function playEvent(scene,e,reduced) {
  const {ctx,layer}=scene;
  const src=scene.point(e.from), dest=scene.point(e.to);
  const actor=scene.actor(e.actorId,e.from), target=scene.actor(e.targetId,e.to);
  const species=actor?.species, dir=Math.sign(dest.x-src.x)||actor?.facing||1;
  const affinityRegion=REGIONS.find(area => area.biome === e.affinity)?.id;
  const region=affinityRegion ?? artRegion(species?.region ?? e.region);
  const isSignature=e.skillId==='signature'||e.skillId==='apex';
  const isApex=e.skillId==='apex';
  const motion=isSignature && species ? SIGNATURE_MOTIONS[species.baseSpeciesId ?? species.id] : SPECIAL_MOTIONS[e.skillName];
  const palette=WONDER_TONES[motion]??PALETTES[region]??GOLD;
  const heavy = species?.role === 'defender';
  const attackImpact = e.style === 'ranged' ? 0.58 : 0.44;
  const feedbackAt = {capture: 0.72, attack: attackImpact, heal: 0.53, support: 0.43, hazard: 0.19}[e.type] ?? 0.06;
  const duration=e.type==='move'?135+Math.max(0,e.path.length-1)*116:(DURATIONS[e.type]??180);
  const label=makeLabel(layer,badgeInfo(e));
  const bar=Number.isFinite(e.hpAfter) ? layer.parentElement.querySelector('[data-cell="'+e.to+'"] .cb-hp > b') : null;
  const maxHp=scene.battle?.units[e.targetId]?.stats.maxHp;
  let hpChanged=false;
  const skillIcon=e.skillName && abilityIconKey({id:e.skillId,name:e.skillName,kind:e.type,buff:e.buff,range:e.style==='ranged'?3:1},species);
  const cast=e.skillName?makeLabel(layer,[[skillIcon,e.skillName]]):null;
  if (cast) cast.classList.add('cfx-cast');
  const witnesses = e.type === 'outcome' && !reduced
    ? (scene.battle?.units ?? []).filter(u => u.hp > 0 && !u.caught && u.team === (e.result === 'lost' ? 'wild' : 'you'))
    : [];
  layer.dataset.event=e.type;

  function render(t) {
    ctx.clearRect(0,0,WIDTH,scene.h);
    const tagAt=e.type==='outcome'?scene.center:dest;
    if (bar && maxHp && !hpChanged && (reduced || t >= feedbackAt)) {
      hpChanged=true;
      bar.style.width=clamp(e.hpAfter/maxHp)*100+'%';
    }
    const lt=reduced?1:part(t,feedbackAt,feedbackAt+.12);
    scene.placeLabel(label,{x:tagAt.x,y:tagAt.y-14-(reduced?0:4*t)},lt);
    if (cast) scene.placeLabel(cast,{x:src.x,y:src.y+17},reduced?1:1-part(t,.50,.82));

    if (reduced) return;
    switch(e.type) {
      case 'move': {
        const nodes=e.path;
        if (nodes.length<2) break;
        const progress=t*(nodes.length-1);
        const leg=Math.min(nodes.length-2,Math.floor(progress)), u=clamp(progress-leg);
        const a=scene.point(nodes[leg]), b=scene.point(nodes[leg+1]);
        const pos=between(a,b,ease(u)), bounce=wave(u);
        const face=Math.sign(b.x-a.x)||dir;
        const flying=species?.role==='healer';
        const hop=heavy?3.2:flying?6:4.5;
        ctx.save();ctx.globalAlpha=.2;ctx.fillStyle='#122323';ctx.beginPath();
        ctx.ellipse(pos.x,pos.y+11,10-bounce*2,2.5,0,0,TAU);ctx.fill();ctx.restore();
        actor?.pose({x:pos.x,y:pos.y-hop*bounce},{face,rotate:face*bounce*(flying?3:7),sx:1+.05*bounce,sy:1-.04*bounce});
        burst(ctx,{x:a.x,y:a.y+12},u,['#796850','#d2b984','#e6d3a0'],4,8);
        break;
      }
      case 'attack': {
        const ranged=e.style==='ranged';
        const hit=attackImpact;
        const wind=wave(part(t,0,.21));
        const strike=t<hit?ease(part(t,.17,hit)):1-ease(part(t,hit,.91));
        const pre={x:src.x-dir*3*wind,y:src.y+wind*1.5};
        const a=ranged?{x:pre.x-dir*strike*2,y:pre.y-strike*2}:between(pre,dest,strike*(heavy ? 0.74 : 0.66));
        if (!ranged) a.y-=wave(strike)*4;
        actor?.pose(a,{face:dir,strike:t>.19&&t<.76,rotate:dir*(-9*wind+strike*(ranged?-4:9)),sx:1+.08*strike,sy:1-.08*wind});
        if (ranged && t>.17 && t<hit) {
          const flight=part(t,.17,hit);
          const arch=region===6?1:region===3?8:region===7?13:5;
          const shot=streak(ctx,src,dest,flight,palette,arch);
          if (isSignature) paintFrame(ctx,'regions',region,flight,shot,isApex?24:18,dir);
          if (isApex) for (const off of [-1,1]) {
            const mid={x:shot.x-dir*4,y:shot.y+off*wave(flight)*7};
            sparkle(ctx,mid.x,mid.y,2,palette);
          }
        }
        const impact=part(t,hit,1), recoil=wave(part(t,hit,hit+.30));
        target?.pose({x:dest.x+dir*recoil*4,y:dest.y-recoil*2},{rotate:dir*recoil*10,light:1+recoil*.65});
        if(t>=hit) {
          const reach=isApex?69:(heavy?57:48);
          const flank=e.modifiers.includes('flank');
          const color=isSignature || e.affinity ? palette : ROSE;
          burst(ctx,dest,impact,color,flank||isApex?13:8,reach*.46);
          paintFrame(ctx,'actions',flank?7:ranged?1:0,impact,dest,reach,dir);
          if (isSignature) paintFrame(ctx,'regions',region,impact,{x:dest.x-dir*5,y:dest.y-5},reach*.83,dir);
          drawMotion(ctx,motion,src,dest,impact,isSignature?palette:color,dir,isApex);
          if (e.modifiers.some(modifier => ['guard','cover','ward','resisted',auraIconKey('bulwark')].includes(modifier))) {
            paintFrame(ctx,'actions',3,impact,{x:dest.x-dir*7,y:dest.y+2},34,dir);
          }
          if (e.modifiers.includes('effective')) ring(ctx,{x:dest.x,y:dest.y+7},6+16*impact,color,.55);
        }
        break;
      }
      case 'heal': {
        const u=part(t,.12,.55), glow=wave(t);
        if (!e.aura && (actor!==target || t<=.36)) actor?.pose({x:src.x,y:src.y-glow*3},{face:dir,strike:t>.14&&t<.63,light:1+glow*.30});
        if (u>0 && u<1) streak(ctx,src,dest,u,MINT,12);
        const bloom=part(t,.36,1);
        if (bloom>0) {
          target?.pose({x:dest.x,y:dest.y-wave(bloom)*3},{strike:actor===target&&t>.14&&t<.63,light:1+wave(bloom)*.42});
          paintFrame(ctx,'actions',2,bloom,dest,e.skillId==='specialty'?68:55);
          if (isSignature) {
            paintFrame(ctx,'regions',region,bloom,dest,isApex?55:38,dir);
            drawMotion(ctx,motion,src,dest,bloom,palette,dir,isApex);
          }
          ring(ctx,{x:dest.x,y:dest.y+10},6+15*bloom,MINT,.28);
          for (let i=0;i<5;i++) {
            const a=t*4+i*TAU/5;
            sparkle(ctx,dest.x+Math.cos(a)*12,dest.y+7-i*3-bloom*13,1+(i%2),MINT);
          }
        }
        break;
      }
      case 'support': {
        const color = SUPPORT_TONES[e.buff];
        const castProgress = part(t,.08,.43), pulse = part(t,.38,1);
        actor?.pose({x:src.x,y:src.y-wave(t)*3},{face:dir,strike:t>.12&&t<.68,light:1+wave(t)*.35});
        for (const recipient of e.recipients) {
          const point = scene.point(recipient.key);
          if (e.actorId !== recipient.id && castProgress > 0 && castProgress < 1) streak(ctx,src,point,castProgress,color,9);
          if (pulse <= 0) continue;
          const ally = scene.actor(recipient.id,recipient.key);
          ally?.pose({x:point.x,y:point.y-wave(pulse)*2},{light:1+wave(pulse)*.36});
          ring(ctx,{x:point.x,y:point.y+9},8+14*pulse,color,.32);
          if (e.buff === 'ward') paintFrame(ctx,'actions',3,pulse,{x:point.x,y:point.y+1},42);
          else if (e.buff === 'regen') paintFrame(ctx,'actions',2,pulse,point,42);
          else burst(ctx,point,pulse,color,e.buff === 'cleanse' ? 12 : 7,20);
        }
        break;
      }
      case 'capture': {
        const flight=part(t,.05,.38);
        if (flight<1) {
          const orb=streak(ctx,src,dest,flight,GOLD,17);
          ring(ctx,orb,4,GOLD,1,t*4);
          actor?.pose({x:src.x-dir*wave(flight)*2,y:src.y-wave(flight)},{face:dir,rotate:dir*wave(flight)*8});
        }
        if (t>=.38) {
          const cinch=part(t,.38,.72), release=part(t,.72,1);
          target?.pose({x:dest.x+(e.success?0:Math.sin(release*TAU*2)*wave(release)*3),y:dest.y-cinch*2},
            {sx:e.success?1-.88*cinch:1-.34*wave(cinch),sy:e.success?1-.85*cinch:1-.22*wave(cinch),opacity:e.success?1-cinch:1,light:1+wave(cinch)*.7});
          if (release===0) {
            paintFrame(ctx,'actions',4,cinch,dest,61);
            for (let i=0;i<2;i++) ring(ctx,{x:dest.x,y:dest.y+(i-.5)*6},22-16*cinch,GOLD,.44+i*.22,cinch*TAU+i);
          } else {
            paintFrame(ctx,'actions',e.success?4:5,release,dest,53);
            burst(ctx,dest,release,e.success?GOLD:ROSE,e.success?12:9,e.success?18:26);
          }
        }
        break;
      }
      case 'faint': {
        const fall=ease(t);
        target?.pose({x:dest.x,y:dest.y+fall*8},{rotate:dir*fall*12,sx:1-fall*.22,sy:1-fall*.26,opacity:1-fall,light:1+wave(t)*.45});
        paintFrame(ctx,'actions',6,t,dest,52);
        burst(ctx,dest,t,['#598099','#b6c7db','#eef3dc'],7,17);
        break;
      }
      case 'guard': {
        const brace=wave(t);
        actor?.pose({x:src.x,y:src.y+2*brace},{sx:1+.07*brace,sy:1-.1*brace});
        paintFrame(ctx,'actions',3,t,{x:src.x+(actor?.facing||1)*7,y:src.y+2},49,actor?.facing);
        ring(ctx,{x:src.x,y:src.y+11},10+3*brace,BLUE,.3);
        break;
      }
      case 'hazard': {
        const hazardRegion=artRegion(e.region), tone=PALETTES[hazardRegion]??ROSE;
        paintFrame(ctx,'regions',hazardRegion,t,dest,54);
        ring(ctx,{x:dest.x,y:dest.y+10},5+17*t,tone,.35);
        burst(ctx,dest,t,tone,7,18);
        target?.pose({x:dest.x+wave(t)*2,y:dest.y-wave(t)*2},{light:1+wave(t)*.5});
        break;
      }
      case 'status': {
        const color=SUPPORT_TONES[e.effect]??(e.effect==='slow'?BLUE:e.effect==='guard'?MINT:e.effect==='exposed'?ROSE:VIOLET);
        if (e.phase==='expire') {
          burst(ctx,dest,t,color,5,14);
        } else if (e.effect==='stun') {
          for (let i=0;i<3;i++) {
            const a=t*3+i*TAU/3;
            sparkle(ctx,dest.x+Math.cos(a)*10,dest.y-10+Math.sin(a)*3,2,color);
          }
        } else if (e.effect==='slow') {
          for (let i=0;i<3;i++) ring(ctx,{x:dest.x,y:dest.y+10-i*3},12-i*2+wave(t)*2,color,.30,t);
        } else {
          for (let i=0;i<4;i++) {
            const a=i*TAU/4+Math.PI*.25,r=18-4*wave(t);
            line(ctx,[{x:dest.x+Math.cos(a)*r,y:dest.y+Math.sin(a)*r},{x:dest.x+Math.cos(a)*(r-5),y:dest.y+Math.sin(a)*(r-5)}],color[1],2);
          }
        }
        break;
      }
      case 'wait':
      case 'recovery': {
        const p={x:src.x,y:src.y+10}, color=e.type==='wait'?GOLD:BLUE;
        ring(ctx,p,9+3*wave(t),color,.42,t*1.6);
        if (e.type==='wait') actor?.pose({x:src.x,y:src.y-2*wave(t)});
        break;
      }
      case 'outcome': {
        for (const [i,unit] of witnesses.entries()) {
          const ally=scene.actor(unit.id,unit.key), home=scene.point(unit.key);
          const step=part(t,i*.06,.94);
          if (e.result==='fled') {
            ally?.pose({x:home.x-24*ease(step),y:home.y-3*Math.abs(Math.sin(step*TAU))},
              {face:-1,opacity:1-step});
          } else {
            const hop=wave(step);
            ally?.pose({x:home.x,y:home.y-hop*5},{sx:1+.04*hop,sy:1+.05*hop});
          }
        }
        const c=e.result==='won'?GOLD:e.result==='lost'?VIOLET:BLUE;
        ring(ctx,scene.center,6+25*ease(t),c,.50);
        burst(ctx,scene.center,t,c,16,34);
        break;
      }
    }
  }
  return {duration:reduced?Math.min(135,duration):duration,render,finish(){label?.remove();cast?.remove();}};
}

// The UI commits the rules first, plays the resolved events against the old visible
// board, then redraws. Aborts and hidden tabs always release that transaction.
export async function playFightEffects(board,events,{battle,sprite,signal,speed=1,onEvent}={}) {
  if (!board || !events?.length || signal?.aborted) return;
  const doc=board.ownerDocument, win=doc?.defaultView;
  if (!win?.requestAnimationFrame || doc.hidden) return;
  warmFightEffects();
  let scene;
  try {
    scene=createScene(board,battle,sprite);
    if (!scene) return;
    const reduced=win.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
    let interrupted=false;
    let cancelFrame=()=>{};
    const stop=()=>{interrupted=true;cancelFrame();};
    const visibility=()=>{if(doc.hidden) stop();};
    signal?.addEventListener('abort',stop,{once:true});
    doc.addEventListener('visibilitychange',visibility);
    try {
      for (const event of events) {
        if (interrupted || signal?.aborted || !board.isConnected) break;
        const fx=playEvent(scene,event,reduced);
        onEvent?.(event);
        await new Promise(resolve=>{
          let frame=0, start;
          const finish=()=>{win.cancelAnimationFrame(frame);resolve();};
          cancelFrame=finish;
          const tick=now=>{
            if (interrupted || !board.isConnected) {finish();return;}
            if (start===undefined) start=now;
            const t=clamp((now-start)*clamp(speed,1,3)/fx.duration);
            try { fx.render(t); } catch { finish();return; }
            if(t>=1) finish();
            else frame=win.requestAnimationFrame(tick);
          };
          frame=win.requestAnimationFrame(tick);
        });
        fx.finish();
      }
    } finally {
      signal?.removeEventListener('abort',stop);
      doc.removeEventListener('visibilitychange',visibility);
    }
  } catch {
    // A browser without a usable graphics context can still advance its board.
  } finally {
    scene?.close();
  }
}
