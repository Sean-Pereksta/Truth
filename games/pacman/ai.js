import { UNIT_DEFS, BUILDING_DEFS } from './engine.js';

// Difficulty changes decisions and coordination, never combat statistics or sight.
const SETTINGS = {
  easy:      { think:1.35, react:.65, produce:4.8, build:25, pacCap:11, ghostCap:30, miners:3, party:4, memory:20, prediction:0,   caution:0.60, scouts:2 },
  normal:    { think:0.78, react:.36, produce:2.6, build:16, pacCap:15, ghostCap:42, miners:5, party:5, memory:42, prediction:1.0, caution:0.78, scouts:3 },
  hard:      { think:0.43, react:.20, produce:1.7, build:12, pacCap:19, ghostCap:50, miners:6, party:6, memory:60, prediction:1.8, caution:0.94, scouts:4 },
  nightmare: { think:0.26, react:.10, produce:1.2, build:9,  pacCap:20, ghostCap:54, miners:7, party:7, memory:80, prediction:2.8, caution:1.05, scouts:5 }
};

const sq = (a,b) => (a.x-b.x)**2+(a.y-b.y)**2;
const distance = (a,b) => Math.sqrt(sq(a,b));
const living = a => a && a.hp > 0;
const completed = b => living(b) && (b.progress === undefined || b.progress >= 1);
const mean = a => a.length ? {x:a.reduce((n,u)=>n+u.x,0)/a.length,y:a.reduce((n,u)=>n+u.y,0)/a.length} : null;

/** A fair-fog computer commander. Commands are identical to the player's commands. */
export class AIController {
  constructor(game, teamId, difficulty='normal') {
    this.game=game;
    this.teamId=teamId;
    this.side=game.teams?.[teamId]?.side ?? (teamId==='ghost'?'ghost':'pac');
    this.home=game.teams?.[teamId]?.start ?? (this.side==='ghost'?game.map.ghostStart:game.map.pacStart);
    this.difficulty=SETTINGS[difficulty] ? difficulty : 'normal';
    this.settings=SETTINGS[this.difficulty];
    this.elapsed=0;
    this.thinkAt=0.15;
    this.produceAt=2;
    this.buildAt=12;
    this.inspectAt=0;
    this.issued=new Map();
    this.memories=new Map();
    this.patrols=new Map();
    this.partyAssignments=new Map();
    this.heroGoal=null;
    this.goalAt=0;
    this.retreating=false;
    this.recovering=new Set();
    this.lastHeroSight=null;
    this.evidence=[];
    this.lastAlertTime=-1;
    this.pelletMemory=null;
    this.decisionCount=0;
    this.seed=((game.seed ?? 9187)+(this.side==='ghost'?4321:1234)+(teamId==='pac2'?7231:teamId==='pac3'?14657:0))>>>0;
    this.lastBuildType=null;
    this.searchCycle=0;
    this.searchVisited=new Map();
    const exterior=(game.map.centers??[]).filter(p=>p.exterior);
    const fallback=(game.map.regions??[]).map(p=>({x:p.x+p.w/2,y:p.y+p.h/2}));
    const unique=new Map((exterior.length?exterior:fallback).map(p=>[Math.floor(p.x)+':'+Math.floor(p.y),p]));
    this.searchPoints=[...unique.values()].map((p,id)=>({x:p.x,y:p.y,pointId:id}));
    this.committed=new Set();
    this.rallySince=null;
    this.lastScoutTrained=-100;
    this.reflexAt=0;
    this.dodging=new Map();
    this.castFirstSeen=new Map();
  }

  random(){
    this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;
    return this.seed/4294967296;
  }

  update(dt){
    if(this.game.paused || this.game.status!=='playing' || this.game.teams?.[this.teamId]?.eliminated || !Number.isFinite(dt) || dt<=0)return;
    this.elapsed+=dt;
    // Telegraph reactions must not wait for a slower economy/strategy tick.
    if(this.side==='pac'&&this.elapsed>=this.reflexAt){
      this.reflexAt=this.elapsed+Math.min(.1,this.settings.react/2);
      this.dodgeTelegraphs();
    }
    if(this.elapsed<this.thinkAt)return;
    this.thinkAt=this.elapsed+this.settings.think;
    this.decisionCount++;
    const allies=this.game.units.filter(u=>this.owns(u)&&living(u));
    const buildings=this.game.buildings.filter(b=>this.owns(b)&&living(b));
    const enemies=this.game.units.filter(u=>u.side!==this.side&&living(u)&&this.sees(u));
    this.observe(enemies);
    if(this.side==='ghost')this.ghostTurn(allies,buildings,enemies);
    else this.pacTurn(allies,buildings,enemies);
    if(this.elapsed>=this.produceAt){
      this.produceAt=this.elapsed+this.settings.produce;
      this.produce(allies,buildings);
    }
    if(this.elapsed>=this.buildAt){
      this.buildAt=this.elapsed+this.settings.build;
      this.expand(allies,buildings,enemies);
    }
  }

  owns(entity){return (entity.teamId??entity.side)===this.teamId;}

  sees(entity){
    if(typeof this.game.isVisible==='function')return !!this.game.isVisible(this.side,entity.x,entity.y);
    const {width,height}=this.game.map,x=Math.floor(entity.x),y=Math.floor(entity.y);
    return x>=0&&y>=0&&x<width&&y<height&&!!this.game.visible?.[this.side]?.[y*width+x];
  }

  observe(enemies){
    for(const enemy of enemies){
      const old=this.memories.get(enemy.id);
      let vx=0,vy=0;
      if(old&&this.elapsed-old.time<3){
        const dt=Math.max(.1,this.elapsed-old.time);
        vx=Math.max(-4,Math.min(4,(enemy.x-old.x)/dt));
        vy=Math.max(-4,Math.min(4,(enemy.y-old.y)/dt));
      }
      const sight={id:enemy.id,teamId:enemy.teamId,type:enemy.type,x:enemy.x,y:enemy.y,hp:enemy.hp,time:this.elapsed,vx,vy};
      this.memories.set(enemy.id,sight);
      if(enemy.type==='hero')this.lastHeroSight=sight;
    }
    for(const [id,memory] of this.memories)if(this.elapsed-memory.time>this.settings.memory||this.game.teams?.[memory.teamId]?.eliminated)this.memories.delete(id);
    if(this.lastHeroSight&&this.game.teams?.[this.lastHeroSight.teamId]?.eliminated)this.lastHeroSight=null;
    if(this.side!=='ghost')return;
    const known=this.game.knownPelletsGhost;
    if(known&&this.elapsed>=this.inspectAt){
      this.inspectAt=this.elapsed+2;
      if(!this.pelletMemory)this.pelletMemory=new Uint8Array(known);
      else{
        const {width}=this.game.map,visible=this.game.visible?.ghost;
        let changed=[];
        for(let i=0;i<known.length;i++){
          if(this.pelletMemory[i]>0&&known[i]===0&&visible?.[i])changed.push({x:i%width+.5,y:Math.floor(i/width)+.5});
          // Store only the information the engine's last-seen map actually provides.
          this.pelletMemory[i]=known[i];
        }
        if(changed.length)this.evidence.push({...mean(changed),time:this.elapsed,kind:'trail'});
      }
    }
    for(const alert of (this.game.alerts??[])){
      if(alert.time>this.game.time)continue;
      if(alert.time<=this.lastAlertTime)continue;
      if(alert.side&&alert.side!=='pac')continue;
      const region=(this.game.map.regions??[]).find(r=>r.id===alert.regionId);
      // Alerts intentionally contain a ward center, not an invisible unit position.
      const p=region?{x:region.x+region.w/2,y:region.y+region.h/2}:{x:alert.x,y:alert.y};
      if(Number.isFinite(p.x)&&Number.isFinite(p.y))this.evidence.push({...p,time:this.elapsed,kind:'alert'});
      this.lastAlertTime=Math.max(this.lastAlertTime,alert.time);
    }
    this.evidence=this.evidence.filter(e=>this.elapsed-e.time<this.settings.memory).slice(-12);
  }

  issue(units,action,x,y,targetId,force=false){
    const list=Array.isArray(units)?units:[units];
    const ids=[];
    for(const unit of list){
      if(!living(unit)||!this.owns(unit))continue;
      // Move/stop/patrol cancel a Binder's stationary channel. Finish the
      // committed cast before reconsidering pursuit, retreat, or formations.
      if(unit.cast?.remaining>0)continue;
      const old=this.issued.get(unit.id),order=unit.order;
      const same=old&&old.action===action&&old.targetId===targetId&&Math.abs((old.x??0)-(x??0))<1.4&&Math.abs((old.y??0)-(y??0))<1.4;
      // Do not reset a mining channel or a valid route on each AI tick.
      if(!force&&action==='harvest'&&order?.type==='harvest'&&(order.progress>0||same))continue;
      if(!force&&same&&this.elapsed-old.time<5&&order?.type===action)continue;
      this.issued.set(unit.id,{action,x,y,targetId,time:this.elapsed});
      ids.push(unit.id);
    }
    if(ids.length)this.game.command(ids,action,x,y,targetId,this.teamId);
  }

  visibleTelegraphs(){
    const casts=[],map=this.game.map,vision=this.game.visible?.[this.side];
    for(const unit of this.game.units){
      if(unit.side===this.side||!living(unit)||!(unit.cast?.remaining>0))continue;
      const c=unit.cast,r=c.radius??2.1;
      let visible=this.sees(unit);
      // Match the player's warning ring: a hidden caster's ring is readable
      // when its ground area overlaps friendly sight. Never use that caster's
      // hidden position for target selection or navigation.
      if(!visible&&vision){
        for(let y=Math.max(0,Math.floor(c.y-r));y<Math.min(map.height,Math.ceil(c.y+r))&&!visible;y++){
          for(let x=Math.max(0,Math.floor(c.x-r));x<Math.min(map.width,Math.ceil(c.x+r));x++){
            if(map.tiles[y*map.width+x]&&vision[y*map.width+x]&&Math.hypot(x+.5-c.x,y+.5-c.y)<=r&&this.game.hasLineOfSight(c.x,c.y,x+.5,y+.5)){visible=true;break;}
          }
        }
      }
      if(visible)casts.push({x:c.x,y:c.y,radius:r,remaining:c.remaining,id:c.id??unit.id});
    }
    return casts;
  }

  walkSpeed(unit){return unit.speed*((unit.powered??0)>0?1.12:1)*((unit.slow??0)>0?.55:1);}

  routePosition(unit,path,budget){
    let p={x:unit.x,y:unit.y};
    for(const q of path){
      const d=distance(p,q);
      if(d>budget)return {x:p.x+(q.x-p.x)*budget/d,y:p.y+(q.y-p.y)*budget/d};
      budget-=d;p=q;
    }
    return p;
  }

  isDodging(unit){return (this.dodging.get(unit.id)?.until??0)>this.elapsed;}

  dodgeTelegraphs(){
    const visible=this.visibleTelegraphs(),live=new Set(visible.map(c=>c.id));
    for(const c of visible)if(!this.castFirstSeen.has(c.id))this.castFirstSeen.set(c.id,this.elapsed);
    for(const id of this.castFirstSeen.keys())if(!live.has(id))this.castFirstSeen.delete(id);
    // A real reaction delay starts when the warning becomes visible. Merely
    // polling less often would still grant an instant response on lucky ticks.
    const casts=visible.filter(c=>this.elapsed-this.castFirstSeen.get(c.id)>=this.settings.react);
    for(const [id,dodge] of this.dodging)if(dodge.until<=this.elapsed)this.dodging.delete(id);
    if(!casts.length)return;
    const allies=this.game.units.filter(u=>this.owns(u)&&living(u));
    const enemies=this.game.units.filter(u=>u.side!==this.side&&living(u)&&this.sees(u));
    for(const unit of allies){
      const speed=this.walkSpeed(unit);
      const relevant=casts.filter(c=>{
        const budget=speed*Math.max(0,c.remaining-(unit.rooted??0));
        return distance(this.routePosition(unit,unit.path??[],budget),c)<c.radius+.38;
      });
      if(!relevant.length)continue;
      const previous=this.dodging.get(unit.id);
      if(previous&&relevant.every(c=>distance(previous,c)>c.radius+.5)&&unit.path?.length)continue;
      const radius=5,cx=Math.floor(unit.x),cy=Math.floor(unit.y),map=this.game.map;
      let best=null,bestScore=-Infinity;
      for(let y=Math.max(1,cy-radius);y<Math.min(map.height-1,cy+radius+1);y++)for(let x=Math.max(1,cx-radius);x<Math.min(map.width-1,cx+radius+1);x++){
        if(!map.tiles[y*map.width+x])continue;
        const p={x:x+.5,y:y+.5},path=this.game.findPath(unit.x,unit.y,p.x,p.y);
        if(!path.length&&distance(unit,p)>.8)continue;
        let length=0,last=unit;
        for(const q of path){length+=distance(last,q);last=q;}
        let margin=Infinity;
        for(const c of casts){
          const projected=this.routePosition(unit,path,speed*Math.max(0,c.remaining-(unit.rooted??0))*.9);
          margin=Math.min(margin,distance(projected,c)-c.radius-.32);
        }
        const danger=enemies.reduce((n,e)=>n+Math.max(0,3-distance(p,e)),0);
        const safe=margin>=0;
        const error=this.difficulty==='easy'?this.random()*6:this.difficulty==='normal'?this.random()*1.5:0;
        const score=(safe?100:margin*25)-length*(safe?2:.25)-danger*1.5+error;
        if(score>bestScore){bestScore=score;best=p;}
      }
      if(best){
        this.dodging.set(unit.id,{...best,until:this.elapsed+Math.max(...relevant.map(c=>c.remaining))+.2});
        this.issue(unit,'move',best.x,best.y,undefined,true);
        if(unit.type==='hero')this.heroGoal=null;
      }
    }
  }

  floor(x,y){
    const map=this.game.map,cx=Math.max(1,Math.min(map.width-2,Math.floor(x))),cy=Math.max(1,Math.min(map.height-2,Math.floor(y)));
    if(map.tiles[cy*map.width+cx])return {x:cx+.5,y:cy+.5};
    for(let r=1;r<Math.max(map.width,map.height);r++){
      let best=null,score=Infinity;
      for(let yy=Math.max(1,cy-r);yy<=Math.min(map.height-2,cy+r);yy++)for(let xx=Math.max(1,cx-r);xx<=Math.min(map.width-2,cx+r);xx++){
        if(Math.abs(xx-cx)!==r&&Math.abs(yy-cy)!==r)continue;
        if(!map.tiles[yy*map.width+xx])continue;
        const d=(xx+.5-x)**2+(yy+.5-y)**2;
        if(d<score){score=d;best={x:xx+.5,y:yy+.5};}
      }
      if(best)return best;
    }
    return {x:cx+.5,y:cy+.5};
  }

  baseFor(unit,buildings,types){
    return buildings.filter(b=>completed(b)&&(!types||types.includes(b.type))).sort((a,b)=>sq(unit,a)-sq(unit,b))[0];
  }

  healerFor(unit,enemies=[]){
    // Allied Sanctuaries serve the entire Pac alliance. Choose a reachable,
    // currently safe healer using only threats this commander can observe.
    const candidates=this.game.buildings.filter(b=>b.side===this.side&&completed(b)&&BUILDING_DEFS[b.type]?.healRate>0&&!enemies.some(e=>distance(e,b)<8)).sort((a,b)=>sq(unit,a)-sq(unit,b));
    return candidates.find(b=>distance(unit,b)<1.5||this.game.findPath(unit.x,unit.y,b.x,b.y).length>0);
  }

  flee(unit,threats,buildings){
    const threat=threats.slice().sort((a,b)=>sq(unit,a)-sq(unit,b))[0];
    if(!threat)return;
    const bases=buildings.filter(b=>completed(b)&&['nest','refuge','sanctuary','lair','tower','spike'].includes(b.type));
    const away={x:unit.x+(unit.x-threat.x)*2,y:unit.y+(unit.y-threat.y)*2};
    const candidates=[this.floor(away.x,away.y)];
    const base=this.baseFor(unit,bases);
    if(base)candidates.push(this.floor(base.x,base.y));
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4;
      candidates.push(this.floor(unit.x+Math.cos(a)*6,unit.y+Math.sin(a)*6));
    }
    let best=candidates[0],score=-Infinity;
    const currentSeparation=Math.min(...threats.map(t=>distance(unit,t)));
    for(const p of candidates){
      const danger=threats.reduce((n,t)=>n+Math.max(0,10-distance(p,t)),0);
      const path=this.game.findPath(unit.x,unit.y,p.x,p.y);
      if(!path.length&&distance(unit,p)>1.5)continue;
      const cover=base?Math.max(0,8-distance(p,base))*.75:0;
      // A far-away room can require running through the pursuer first. Score the
      // opening route as well as its destination, especially during Power.
      const routeSeparation=path.slice(0,10).reduce((n,q)=>Math.min(n,...threats.map(t=>distance(q,t))),currentSeparation);
      const approachPenalty=Math.max(0,currentSeparation-routeSeparation)*13;
      const value=distance(p,threat)*1.8-danger*3-path.length*.22+cover-approachPenalty;
      if(value>score){score=value;best=p;}
    }
    this.issue(unit,'move',best.x,best.y);
  }

  ghostTurn(allies,buildings,enemies){
    const heroes=enemies.filter(u=>u.type==='hero');
    const hero=heroes[0];
    const structures=this.game.buildings.filter(b=>b.side!=='ghost'&&living(b)&&this.sees(b));
    const freshHero=this.lastHeroSight&&this.elapsed-this.lastHeroSight.time<this.settings.memory ? this.lastHeroSight : null;
    const evidence=this.evidence[this.evidence.length-1];
    const home=buildings.find(b=>b.isHQ)??buildings.find(b=>b.type==='lair')??buildings[0]??mean(allies);
    const leads=[...this.memories.values()].filter(m=>m.type==='hero'&&this.elapsed-m.time<this.settings.memory&&!this.game.teams?.[m.teamId]?.eliminated).sort((a,b)=>String(a.teamId??a.id).localeCompare(String(b.teamId??b.id)));
    const homeThreats=home?enemies.filter(u=>distance(u,home)<12):[];
    const defendHome=home?.isHQ&&homeThreats.length>0&&(home.hp<home.maxHp*.97||homeThreats.length>2);
    const focus=(defendHome?mean(homeThreats):null)??hero??freshHero??evidence??home??{x:this.game.map.width/2,y:this.game.map.height/2};
    const scouts=allies.filter(u=>u.type==='scout');
    scouts.forEach((unit,i)=>{
      const contact=heroes.slice().sort((a,b)=>sq(unit,a)-sq(unit,b))[0];
      if(contact&&distance(unit,contact)<9&&this.game.hasLineOfSight(unit.x,unit.y,contact.x,contact.y)){
        // A scout's job is to keep contact for the hunting party, not feed alone
        // into a defended base and consume every future reinforcement budget.
        if((contact.powered??0)>0||distance(unit,contact)<6.5)this.flee(unit,[contact],buildings);
        else if(unit.order?.type!=='stop')this.issue(unit,'stop');
        return;
      }
      const scoutLead=leads.length?leads[i%leads.length]:focus;
      const target=this.scoutTarget(unit,i,scoutLead,leads.length>0||!!evidence);
      this.issue(unit,'move',target.x,target.y);
    });
    const combat=allies.filter(u=>u.type!=='scout');
    const combatIds=new Set(combat.map(u=>u.id));
    for(const id of this.committed)if(!combatIds.has(id))this.committed.delete(id);
    const minimum=Math.max(3,Math.min(5,this.settings.party));
    const reserves=combat.filter(u=>!this.committed.has(u.id));
    if(reserves.length&&this.rallySince===null)this.rallySince=this.elapsed;
    if(reserves.length>=minimum||(reserves.length>=2&&this.rallySince!==null&&this.elapsed-this.rallySince>48)||(hero&&home&&distance(hero,home)<12)){
      reserves.forEach(u=>this.committed.add(u.id));this.rallySince=null;
    }
    // Recover from a failed attack rather than feeding one replacement at a time.
    if(this.elapsed>100&&this.committed.size>0&&this.committed.size<2&&!(hero&&hero.hp/hero.maxHp<.25)){
      for(const unit of combat)if(this.committed.has(unit.id)&&home&&distance(unit,home)<24)this.committed.delete(unit.id);
    }
    for(let i=0;i<combat.length;i++){
      const unit=combat[i],party=Math.floor(i/this.settings.party);
      const localHero=heroes.slice().sort((a,b)=>sq(unit,a)-sq(unit,b))[0];
      const partyFocus=leads.length?leads[party%leads.length]:focus;
      if(unit.cast?.remaining>0)continue;
      if(!this.committed.has(unit.id)&&home){
        this.issue(unit,'move',home.x+3+(i%2),home.y-3+Math.floor(i/2)%3);
        continue;
      }
      const defending=defendHome&&(distance(unit,home)<22||party%2===0);
      const targets=defending?homeThreats:enemies;
      const closest=targets.slice().sort((a,b)=>this.ghostTargetScore(unit,a)-this.ghostTargetScore(unit,b))[0];
      const poweredThreat=heroes.filter(h=>(h.powered??0)>0&&distance(unit,h)<7.5);
      if(poweredThreat.length){this.flee(unit,poweredThreat,buildings);continue;}
      if(unit.type==='binder'){
        this.binderTurn(unit,combat,targets,closest,defending?mean(homeThreats):partyFocus,home);
        continue;
      }
      if(defending&&closest){this.issue(unit,'attack',closest.x,closest.y,closest.id);continue;}
      if(closest&&distance(unit,closest)<(localHero?17:10)){
        if(closest.type==='hero'&&this.settings.prediction>0&&party%3!==0&&distance(unit,closest)>5){
          const seen=this.memories.get(closest.id),lead=this.settings.prediction;
          const intercept=this.floor(closest.x+(seen?.vx??0)*lead,closest.y+(seen?.vy??0)*lead);
          this.issue(unit,'move',intercept.x,intercept.y);
        }else this.issue(unit,'attack',closest.x,closest.y,closest.id);
        continue;
      }
      if(unit.hp/unit.maxHp<.22&&home&&distance(unit,home)<15){this.issue(unit,'move',home.x,home.y);continue;}
      const canRaid=unit.type==='brute'||party%3===2||(!freshHero&&!evidence);
      if(canRaid&&!hero&&!(freshHero&&distance(unit,freshHero)<12)){
        const structure=structures.slice().sort((a,b)=>{
          const priority=t=>t==='well'?-8:t==='refuge'?-4:0;
          return distance(unit,a)+priority(a.type)-distance(unit,b)-priority(b.type);
        })[0];
        if(structure&&distance(unit,structure)<20){
          this.issue(unit,'attack',structure.x,structure.y,structure.id);
          continue;
        }
      }
      const target=this.partyTarget(unit,party,partyFocus,leads.length>0||!!evidence);
      this.issue(unit,'attack',target.x,target.y);
    }
  }

  binderTurn(unit,combat,enemies,target,focus,home){
    if(unit.cast?.remaining>0)return;
    const fronts=combat.filter(u=>u.id!==unit.id&&this.committed.has(u.id)&&['hunter','brute'].includes(u.type));
    const direction=target??focus??home??unit;
    const front=fronts.slice().sort((a,b)=>(distance(unit,a)+distance(a,direction)*.6)-(distance(unit,b)+distance(b,direction)*.6))[0];
    const supported=front&&distance(unit,front)<8;
    const castTargets=enemies.filter(e=>(e.snareImmunity??0)<=0&&distance(unit,e)<=5&&this.game.hasLineOfSight(unit.x,unit.y,e.x,e.y));
    castTargets.sort((a,b)=>{
      const score=e=>(e.type==='hero'?8:0)+(e.order?.type==='harvest'?3:0)+enemies.filter(n=>distance(n,e)<1.8).length*2-((e.snareImmunity??0)>0?12:0);
      return score(b)-score(a);
    });
    if(supported&&castTargets.length&&(unit.snareCooldown??0)<=0&&typeof this.game.castBinder==='function'){
      const victim=castTargets[0];
      const seen=this.memories.get(victim.id),lead=.6+Math.min(.2,this.settings.prediction*.08);
      let aim=this.floor(victim.x+(seen?.vx??0)*lead,victim.y+(seen?.vy??0)*lead);
      // Prediction uses observed motion only; the ground target never follows
      // a runner after the cast begins. Turning/backtracking remains a dodge.
      if(distance(unit,aim)>5||!this.game.hasLineOfSight(unit.x,unit.y,aim.x,aim.y))aim={x:victim.x,y:victim.y};
      const covered=combat.some(u=>u.id!==unit.id&&u.cast?.remaining>0&&distance(u.cast,aim)<(u.cast.radius??2.1)+.7);
      if(!covered&&this.game.castBinder(unit.id,aim.x,aim.y,this.teamId))return;
    }
    // Stay on the rear side of a Hunter/Brute instead of chasing into melee.
    // Ranged attack orders are only issued while already in firing range.
    const ahead=front&&distance(unit,direction)+1<distance(front,direction);
    if(target&&distance(unit,target)<=unit.range&&distance(unit,target)>2.3&&!ahead&&this.game.hasLineOfSight(unit.x,unit.y,target.x,target.y)){
      this.issue(unit,'attack',target.x,target.y,target.id);return;
    }
    if(front){
      const dx=front.x-direction.x,dy=front.y-direction.y,length=Math.hypot(dx,dy)||1;
      const rear=this.floor(front.x+dx/length*2.6,front.y+dy/length*2.6);
      if(distance(unit,rear)>1.3)this.issue(unit,'move',rear.x,rear.y);
      else if(unit.order?.type!=='stop')this.issue(unit,'stop');
    }else if(home)this.issue(unit,'move',home.x+3,home.y-2);
  }

  ghostTargetScore(unit,enemy){
    return distance(unit,enemy)+(enemy.type==='hero'?-24:['miner','engineer','extractor'].includes(enemy.type)?-5:0)+(enemy.powered>0?15:0);
  }

  scoutTarget(unit,index,focus,hasLead){
    if(hasLead&&index<Math.max(1,this.settings.scouts-1))return this.floor(focus.x,focus.y);
    return this.coverageTarget(unit,unit.id);
  }

  coverageTarget(unit,id){
    const old=this.patrols.get(id);
    if(old&&distance(unit,old)<=3){
      if(old.pointId!==undefined)this.searchVisited.set(old.pointId,this.elapsed);
      this.patrols.delete(id);
    }else if(old&&this.elapsed<old.until)return old;
    if(!this.searchPoints.length)return this.floor(this.game.map.width/2,this.game.map.height/2);
    const reserved=new Set([...this.patrols.entries()].filter(([key,p])=>key!==id&&p.until>this.elapsed).map(([,p])=>p.pointId));
    const candidates=this.searchPoints.map(p=>{
      const visited=this.searchVisited.get(p.pointId);
      const recent=visited===undefined?0:Math.max(0,260-(this.elapsed-visited));
      return {p,score:distance(unit,p)+recent+(reserved.has(p.pointId)?160:0)};
    }).sort((a,b)=>a.score-b.score);
    let best=null,bestScore=Infinity,bestLength=0;
    for(const c of candidates.slice(0,8)){
      const p=this.floor(c.p.x,c.p.y),path=this.game.findPath(unit.x,unit.y,p.x,p.y);
      if(!path.length&&distance(unit,p)>2)continue;
      const score=c.score+path.length*.35;
      if(score<bestScore){bestScore=score;best={...p,pointId:c.p.pointId};bestLength=path.length;}
    }
    if(!best)best={...this.floor(candidates[0].p.x,candidates[0].p.y),pointId:candidates[0].p.pointId};
    const target={...best,until:this.elapsed+Math.max(35,bestLength/(unit.speed||2.5)*2+12)};
    this.patrols.set(id,target);
    return target;
  }

  partyTarget(unit,party,focus,hasLead){
    const id='party-'+party;
    if(hasLead){
      if(party===0)return this.floor(focus.x,focus.y);
      const angle=party*Math.PI*.63;
      const spread=party%3===0?9:5;
      return this.floor(focus.x+Math.cos(angle)*spread,focus.y+Math.sin(angle)*spread);
    }
    return this.coverageTarget(unit,id);
  }

  pacTurn(allies,buildings,enemies){
    const hero=allies.find(u=>u.type==='hero');
    if(!hero)return;
    const citadel=this.game.buildings.find(b=>b.side!=='pac'&&b.isHQ&&living(b)&&this.sees(b));
    const seenIds=new Set(enemies.map(u=>u.id));
    const remembered=[...this.memories.values()].filter(m=>!seenIds.has(m.id)&&this.elapsed-m.time<Math.min(18,this.settings.memory));
    const routeThreats=enemies.concat(remembered);
    const close=enemies.filter(e=>distance(hero,e)<8);
    const nearest=close.slice().sort((a,b)=>sq(hero,a)-sq(hero,b))[0];
    const escort=allies.filter(u=>u.type==='guardian'&&distance(hero,u)<7);
    const health=hero.hp/hero.maxHp;
    const danger=close.reduce((n,e)=>n+(e.type==='brute'?2:e.type==='scout'?0.45:1),0);
    const reserve=this.game.getPower?.(this.teamId)??this.game.powerByTeam?.[this.teamId]??{charges:this.game.powerCharges??0,cooldown:this.game.powerCooldown??0};
    const chargeReady=reserve.charges>0&&reserve.cooldown<=0;
    if(chargeReady&&nearest&&distance(hero,nearest)<5.5&&(danger>1.3||health<.65||this.game.collected/this.game.totalPellets>.9))this.game.activatePower(hero.id,this.teamId);
    const powered=(hero.powered??0)>0;
    const threatened=nearest&&distance(hero,nearest)<(4.5+this.settings.caution*1.8)&&!powered&&(danger>escort.length*.8+.7||health<.5);
    if(!this.isDodging(hero)){
    if(threatened){
      this.retreating=true;this.heroGoal=null;this.flee(hero,close,buildings);
    }else{
      const healer=this.healerFor(hero,enemies);
      if((health<.55||(this.retreating&&health<.83))&&healer&&!powered){
        this.retreating=true;
        this.issue(hero,'move',healer.x,healer.y);
      }else{
        this.retreating=false;
        if(powered&&nearest&&distance(hero,nearest)<3&&health>.35)this.issue(hero,'attack',nearest.x,nearest.y,nearest.id);
        else this.heroHarvest(hero,routeThreats);
      }
    }
    }
    for(const unit of allies){
      if(unit.type==='hero')continue;
      if(this.isDodging(unit))continue;
      const threats=enemies.filter(e=>distance(unit,e)<5);
      if(unit.hp<unit.maxHp*.5)this.recovering.add(unit.id);
      if(unit.hp>=unit.maxHp*.85)this.recovering.delete(unit.id);
      if(this.recovering.has(unit.id)&&!threats.length){
        const healer=this.healerFor(unit,enemies);
        if(healer){this.issue(unit,'move',healer.x,healer.y);continue;}
      }
      if(unit.type==='guardian'){
        const partners=this.game.units.filter(u=>u.side===this.side&&living(u)&&!this.owns(u)&&['hero','miner','extractor'].includes(u.type)&&distance(unit,u)<12);
        const vulnerable=allies.concat(partners).filter(u=>['hero','miner','extractor'].includes(u.type)).sort((a,b)=>{
          const da=enemies.reduce((s,e)=>s+Math.max(0,7-distance(a,e)),0),db=enemies.reduce((s,e)=>s+Math.max(0,7-distance(b,e)),0);
          return db-da+(a.type==='hero'?-1:0)-(b.type==='hero'?-1:0);
        })[0]??hero;
        const enemy=enemies.filter(e=>distance(e,vulnerable)<7).sort((a,b)=>sq(unit,a)-sq(unit,b))[0];
        if(enemy)this.issue(unit,'attack',enemy.x,enemy.y,enemy.id);
        else if(citadel&&citadel.hp<citadel.maxHp*.4&&distance(unit,citadel)<22&&allies.filter(u=>u.type==='guardian').length>=3)this.issue(unit,'attack',citadel.x,citadel.y,citadel.id);
        else if(distance(unit,vulnerable)>3)this.issue(unit,'move',vulnerable.x,vulnerable.y);
        continue;
      }
      if(threats.length&&(unit.powered??0)<=0){this.flee(unit,threats,buildings);continue;}
      if(unit.order?.type==='harvest')continue;
      const target=this.choosePellet(unit,routeThreats,unit.type==='extractor');
      if(target)this.issue(unit,'harvest',target.x,target.y);
    }
    const liveIds=new Set(allies.map(u=>u.id));
    for(const id of this.recovering)if(!liveIds.has(id))this.recovering.delete(id);
  }

  heroHarvest(hero,enemies){
    const current=this.heroGoal&&this.game.pellets.has(this.heroGoal.id)?this.heroGoal:null;
    if(current&&this.elapsed<this.goalAt&&!enemies.some(e=>distance(e,current)<7)){
      this.issue(hero,'harvest',current.x,current.y);
      return;
    }
    const target=this.choosePellet(hero,enemies,true);
    if(!target)return;
    this.heroGoal={id:target.id,x:target.x,y:target.y};
    this.goalAt=this.elapsed+6;
    this.issue(hero,'harvest',target.x,target.y);
  }

  choosePellet(unit,enemies,largeBias=false){
    const candidates=[];
    const homes=Object.values(this.game.teams??{}).filter(t=>t.side==='pac'&&!t.eliminated&&t.start);
    const harvesters=this.game.units.filter(u=>u.side===this.side&&u.id!==unit.id&&u.order?.type==='harvest');
    for(const p of this.game.pellets.values()){
      const d=sq(unit,p);
      const threat=enemies.reduce((n,e)=>n+Math.max(0,10-distance(p,e))**2,0);
      const bonus=p.type==='large'?(largeBias?20:7):0;
      const ownDistance=this.home?distance(this.home,p):0;
      const closestHome=homes.reduce((n,t)=>Math.min(n,distance(t.start,p)),ownDistance);
      // Prefer each team's approach to the maze while still taking safe nearby
      // objectives and helping finish the last remaining wards together.
      const territory=Math.max(0,ownDistance-closestHome)*1.7;
      const reserved=harvesters.reduce((n,u)=>n+(Math.hypot((u.order.anchorX??u.order.x??u.x)-p.x,(u.order.anchorY??u.order.y??u.y)-p.y)<2?1:0),0);
      candidates.push({p,score:d+threat*(15*this.settings.caution)-bonus+territory+reserved*18});
    }
    candidates.sort((a,b)=>a.score-b.score);
    let best=null,score=Infinity;
    const sample=unit.type==='hero'?9:4;
    for(const c of candidates.slice(0,sample)){
      const path=this.game.findPath(unit.x,unit.y,c.p.x,c.p.y);
      if(!path.length&&distance(unit,c.p)>1.4)continue;
      const risk=enemies.reduce((n,e)=>n+Math.max(0,8-distance(c.p,e)),0);
      const congestion=this.game.units.filter(u=>u.side===this.side&&u.id!==unit.id&&u.order?.type==='harvest'&&Math.hypot((u.order.x??u.x)-c.p.x,(u.order.y??u.y)-c.p.y)<3).length;
      const value=path.length+risk*12*this.settings.caution+congestion*3-(c.p.type==='large'&&largeBias?5:0);
      if(value<score){score=value;best=c.p;}
    }
    return best;
  }

  produce(allies,buildings){
    const count=type=>allies.filter(u=>u.type===type).length+buildings.reduce((n,b)=>n+(b.queue??[]).filter(q=>(typeof q==='string'?q:q.type)===type).length,0);
    const queued=buildings.reduce((n,b)=>n+(b.queue?.length??0),0);
    const total=allies.length+queued,cap=Math.min(this.game.unitCap?.(this.teamId)??Infinity,this.side==='pac'?this.settings.pacCap:this.settings.ghostCap);
    if(total>=cap)return;
    const producers=buildings.filter(b=>completed(b)&&(this.side==='pac'?['nest','refuge'].includes(b.type):b.type==='lair')).sort((a,b)=>(a.queue?.length??0)-(b.queue?.length??0));
    if(!producers.length||(producers[0].queue?.length??0)>=2)return;
    let priorities;
    if(this.side==='pac'){
      const desiredGuard=this.difficulty==='easy'?2:this.difficulty==='normal'?3:4;
      priorities=[];
      if(count('miner')<this.settings.miners)priorities.push('miner');
      if(count('guardian')<desiredGuard)priorities.push('guardian');
      if(count('engineer')<1)priorities.unshift('engineer');
      if(this.elapsed>90&&count('extractor')<2)priorities.push('extractor');
      priorities.push('guardian','miner');
    }else{
      const hunters=count('hunter'),binders=count('binder'),brutes=count('brute');
      const combat=hunters+binders+brutes;
      // Save for the needed combat unit; falling through to a cheaper scout on
      // every tick would starve rebuilding parties indefinitely after a loss.
      if(hunters<3)priorities=['hunter'];
      else if(binders<Math.max(1,Math.min(6,Math.floor(hunters/3))))priorities=['binder'];
      else if(count('scout')<Math.min(this.settings.scouts,Math.max(1,Math.floor(combat/4)))&&this.elapsed-this.lastScoutTrained>40)priorities=['scout'];
      else if(this.elapsed>80&&brutes<Math.max(1,Math.floor(hunters/5)))priorities=['brute'];
      else priorities=['hunter'];
    }
    for(const type of priorities){
      if(!UNIT_DEFS[type]||this.game.resources[this.teamId]<UNIT_DEFS[type].cost)continue;
      if(this.game.train(type,producers[0].id,this.teamId)){if(type==='scout')this.lastScoutTrained=this.elapsed;return;}
    }
  }

  expand(allies,buildings,enemies){
    const count=type=>buildings.filter(b=>b.type===type).length;
    const cash=this.game.resources[this.teamId];
    const ownBase=buildings.find(b=>b.type===(this.side==='pac'?'nest':'lair'))??buildings[0]??mean(allies);
    if(!ownBase)return;
    let type,anchor=ownBase;
    if(this.side==='pac'){
      const hero=allies.find(u=>u.type==='hero');
      const refuge=hero&&this.baseFor(hero,buildings,['nest','refuge']);
      const healer=hero&&this.healerFor(hero,enemies);
      if(!count('nest')&&!count('refuge')){type='refuge';anchor=hero??ownBase;}
      else if(!count('sanctuary')&&allies.some(u=>u.hp<u.maxHp*.65))type='sanctuary';
      else if(!count('well'))type='well';
      else if(!count('sanctuary'))type='sanctuary';
      else if(hero&&(!refuge||distance(hero,refuge)>17)&&count('refuge')<4){type='refuge';anchor=hero;}
      else if(hero&&(!healer||distance(hero,healer)>22)&&count('sanctuary')<3&&cash>160){type='sanctuary';anchor=refuge??hero;}
      else if(count('well')<Math.min(4,1+Math.floor(this.elapsed/180))&&cash>180)type='well';
      else if(count('tower')<Math.max(1,count('refuge'))&&cash>120){type='tower';anchor=refuge??ownBase;}
      else return;
    }else{
      if(this.elapsed>30&&count('lair')<Math.min(5,2+Math.floor(this.elapsed/120))&&cash>170){
        type='lair';
        const fresh=this.lastHeroSight&&this.elapsed-this.lastHeroSight.time<60?this.lastHeroSight:null;
        const party=allies.filter(u=>u.type!=='scout').sort((a,b)=>a.x+a.y-b.x-b.y);
        anchor=fresh??party[0]??ownBase;
      }else if(count('watch')<3&&cash>150){
        // Relay towers are ordinary local eyes in cleared darkness, not an orb gate.
        const scouts=allies.filter(u=>u.type==='scout');
        const front=scouts[0]??allies[0];
        if(!front||buildings.some(b=>b.type==='watch'&&distance(front,b)<18))return;
        type='watch';anchor=front;
      }
      else if(count('spike')<count('lair')&&cash>160)type='spike';
      else return;
    }
    if(!BUILDING_DEFS[type]||cash<BUILDING_DEFS[type].cost)return;
    // Production remains affordable: the AI does not spend its last resources on scenery.
    if(buildings.length&&cash-BUILDING_DEFS[type].cost<25&&allies.length<7)return;
    const site=this.findBuildSite(type,anchor,enemies);
    if(site&&this.game.build(type,site.x,site.y,this.teamId))this.lastBuildType=type;
  }

  findBuildSite(type,anchor,enemies){
    const map=this.game.map,def=BUILDING_DEFS[type];
    let best=null,score=Infinity;
    const radius=15;
    const cx=Math.floor(anchor.x),cy=Math.floor(anchor.y);
    for(let y=Math.max(2,cy-radius);y<Math.min(map.height-2,cy+radius);y+=2){
      for(let x=Math.max(2,cx-radius);x<Math.min(map.width-2,cx+radius);x+=2){
        if(!map.tiles[y*map.width+x])continue;
        const p={x:x+.5,y:y+.5};
        if(enemies.some(e=>distance(e,p)<9))continue;
        if(!this.game.canBuild(type,p.x,p.y,this.teamId).ok)continue;
        const spacing=this.game.buildings.filter(b=>b.side===this.side).reduce((n,b)=>n+(distance(b,p)<(def.w??3)+2?8:0),0);
        const d=sq(anchor,p)+spacing;
        if(d<score){score=d;best=p;}
      }
    }
    return best;
  }
}
