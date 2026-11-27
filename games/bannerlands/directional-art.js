// Rows turn clockwise in the isometric ground plane, starting at screen right.
// Undo the diamond's vertical foreshortening before choosing the nearest octant.
const octantAngle=Math.PI/4;
const facingHoldSlope=Math.tan(.62*octantAngle);
const facingHeadings=[[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1]];

function facingOctant(x,y){
  return Math.atan2(x+y,x-y)/octantAngle;
}

export function facingRow(x=1,y=0){
  return (Math.round(facingOctant(x,y))+8)%8;
}

export function stableFacingRow(x,y,previousRow){
  const front=facingHeadings[previousRow];
  if(front){
    if(!x&&!y)return previousRow;
    // A dot/cross test keeps the common straight march off the trigonometry path.
    const along=x*front[0]+y*front[1],across=x*front[1]-y*front[0];
    if(along>0&&Math.abs(across)<along*facingHoldSlope)return previousRow;
  }
  return facingRow(x,y);
}

export function directionalAnchor(row,angle,col){
  return row.anchors?.[angle]?.[col];
}

export const DRAGON_BREATH_SECONDS=.85;
const dragonRecoveryEnd=DRAGON_BREATH_SECONDS+.2;

export function dragonBreathAge(u,g){
  const attack=u.attackVisual;
  if(attack?.action!=='dragonBreath')return Infinity;
  // The guest presentation interpolates game time between authoritative frames.
  return Number.isFinite(attack.at)&&Number.isFinite(g.time)?g.time-attack.at:attack.elapsed??Infinity;
}

const strikeAge=(attack,g)=>attack?(attack.elapsed??g.time-attack.at):Infinity;

function capturedAttack(u,g){
  const attack=u.attackVisual;
  if(!attack||!Number.isFinite(attack.faceX)||!Number.isFinite(attack.faceY))return;
  const dragon=u.type==='dragon';
  const age=dragon?dragonBreathAge(u,g):strikeAge(attack,g);
  if(age>=0&&age<(dragon?dragonRecoveryEnd:.32))return attack;
}

export function attackFacing(u,g,usual){
  const attack=capturedAttack(u,g);
  return attack?{x:attack.faceX,y:attack.faceY}:usual;
}

export function attackFacingRow(u,g){
  const attack=capturedAttack(u,g);
  if(attack)return facingRow(attack.faceX,attack.faceY);
}

export const engineKits=new Set(['catapult','ballista','trebuchet','firepot']);

// Columns are compact per kit. Only animations the kit uses occupy atlas space.
export function atlasPoses(kit,hero=false){
  const common=['idle','walk0','walk1','walk2','walk3','wind','strike','recover','hit','fall','down'];
  if(engineKits.has(kit))return [...common,'deploy1','deploy2','deployed'];
  const extra=[];
  if(hero||['sword','tower-shield','spear-shield','rider'].includes(kit))extra.push('guard','block');
  if(hero||['spear','pike','glaive','spear-shield','rider','javelin'].includes(kit))extra.push('lower','brace');
  if(hero||['bow','crossbow','horse-bow'].includes(kit))extra.push('aim','load0','load1','load2','load3','load4');
  if(hero)extra.push('carry','carry0','carry1','carry2','carry3','carryWind','carryStrike','kneel','plant','carryFall','carryDown');
  return [...common,...extra];
}

export function atlasPose(u,g,moving,windup=0,phase=u.phase){
  const carry=u.type==='hero'&&u.heroMode!=='signature';
  if(u.hp<=0){
    const early=(g.time||0)-(u.bornAt??0)<.3;
    return carry?(early?'carryFall':'carryDown'):(early?'fall':'down');
  }
  if(u.type==='dragon'){
    const age=dragonBreathAge(u,g);
    if(age>=0&&age<dragonRecoveryEnd)return age<DRAGON_BREATH_SECONDS?'strike':'recover';
    if(windup>0)return 'wind';
    const wing=Math.floor((g.time||0)*(moving?4.6:3.3)+(u.id||0))&3;
    return 'walk'+wing;
  }
  if(u.type==='trebuchet'){
    const state=u.trebuchetState;
    if(state==='settingUp'||state==='takingDown'){
      const t=state==='settingUp'?1-u.trebuchetRemaining/10:u.trebuchetRemaining/5;
      return t<.33?'idle':t<.66?'deploy1':t<.9?'deploy2':'deployed';
    }
    if(!state&&u.setupProgress>0&&u.setupProgress<15)return u.setupProgress<7?'deploy1':'deploy2';
  }
  if(u.standardAction?.phase==='handling'||u.standardVisual?.phase==='abort'&&g.time<u.standardVisual.until){
    const a=u.standardAction||u.standardVisual;
    const progress=(a.progress||0)/(a.duration||1);
    return (a.kind==='pickup'?1-progress:progress)>.52?'plant':'kneel';
  }
  if(u.hitVisual&&g.time>=u.hitVisual.at&&g.time-u.hitVisual.at<.15&&!carry)return u.hitVisual.blocked?'block':'hit';
  const age=strikeAge(u.attackVisual,g);
  if(age>=0&&age<(u.reloading ? .1 : .32)){
    return carry?'carryStrike':age<.14?'strike':'recover';
  }
  if(!moving&&u.reloading&&u.reload){
    const stage=['lower','span','retrieve','seat','raise'].indexOf(u.reload.stage);
    return 'load'+Math.max(0,stage);
  }
  if(!carry&&(u.aiming||u.crossbowAim||u.pendingShot))return 'aim';
  if(windup>0)return carry?'carryWind':'wind';
  if((u.attackAnim||0)>.05)return carry?(u.attackAnim>.65?'carryWind':'carryStrike'):u.attackAnim>.65?'wind':u.attackAnim>.3?'strike':'recover';
  if(u.spearState==='braced')return 'brace';
  if(u.spearState==='lowering'||u.charging&&!moving)return 'lower';
  if(u.shieldGuard==='guard'||u.shieldGuard==='raising')return 'guard';
  if(moving){
    const stride=Math.floor((phase||0)/(Math.PI*2)*4)&3;
    const step=u.backpedaling?3-stride:stride;
    return (carry?'carry':'walk')+step;
  }
  if(u.type==='trebuchet'&&(u.trebuchetState==='deployed'||!u.trebuchetState&&u.setupProgress>=15))return 'deployed';
  return carry?'carry':'idle';
}
