// Floating painted house crests are cosmetic. Only the supplied, currently visible army
// is grouped; no remembered units, orders, supply counts or gameplay RNG is read.
const BANNER_HW=28,BANNER_HH=14,BANNER_TAU=Math.PI*2;
const crestTroopHeights={giant:58,trebuchet:55,lance_champion:56,hornhill_halberdier:52,sun_horse_archer:49,cavalry:37,storm_rider:41,thorn_lancer:41};
const bannerPoint=(x,y)=>({x:(x-y)*BANNER_HW,y:(x+y)*BANNER_HH});
const bannerDirections=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
const bannerClamp=(value,low,high)=>Math.max(low,Math.min(high,value));

export function collectFormationBanners(units,teams,options={}){
  const zoom=options.zoom??1;if(zoom<.42)return [];
  const distance=options.linkDistance??3.2,cellSize=distance/Math.SQRT2;
  const minimum=options.minimum??6,maximum=options.maximum??(options.lowDetail?10:20),perHouse=options.perHouse??3;
  const visible=options.visible,bounds=options.bounds,selected=options.selected,buckets=new Map();
  for(const unit of units||[]){
    if(!(unit.hp>0)||!Number.isFinite(unit.x)||!Number.isFinite(unit.y)||!teams[unit.team]||teams[unit.team].alive===false||visible&&!visible(unit))continue;
    const p=bannerPoint(unit.x,unit.y);
    if(bounds&&(p.x<bounds.left-90||p.x>bounds.right+90||p.y<bounds.top-65||p.y>bounds.bottom+65))continue;
    const bx=Math.floor(unit.x/cellSize),by=Math.floor(unit.y/cellSize),key=`${unit.team}:${bx}:${by}`;
    let bucket=buckets.get(key);
    if(!bucket){bucket={index:buckets.size,team:unit.team,bx,by,count:0,x:0,y:0,id:unit.id??0,selected:false,height:0,members:options.includeMembers?[]:null,extremes:Array(8).fill(null),scores:Array(8).fill(-Infinity)};buckets.set(key,bucket);}
    bucket.members?.push(unit);
    bucket.height=Math.max(bucket.height,options.troopHeight?.(unit)??crestTroopHeights[unit.type]??35);
    bucket.count++;bucket.x+=unit.x;bucket.y+=unit.y;bucket.id=Math.min(bucket.id,unit.id??0);bucket.selected||=!!selected?.has(unit.id);
    // All points in one cell are at most linkDistance apart. Eight extremal
    // representatives bound the work between neighboring cells even when
    // thousands of overlapping troops share one square.
    for(let k=0;k<8;k++){const direction=bannerDirections[k],score=unit.x*direction[0]+unit.y*direction[1];if(score>bucket.scores[k]){bucket.scores[k]=score;bucket.extremes[k]=unit;}}
  }
  const cells=[...buckets.values()],parents=cells.map((_,i)=>i);
  const find=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
  const join=(a,b)=>{a=find(a);b=find(b);if(a!==b)parents[Math.max(a,b)]=Math.min(a,b);};
  const distance2=distance*distance;
  for(const cell of cells){
    for(let dy=0;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
      if(dy===0&&dx<=0)continue;
      const other=buckets.get(`${cell.team}:${cell.bx+dx}:${cell.by+dy}`);if(!other||find(cell.index)===find(other.index))continue;
      let connected=false;
      for(const a of cell.extremes){for(const b of other.extremes)if((a.x-b.x)**2+(a.y-b.y)**2<=distance2){connected=true;break;}if(connected)break;}
      if(connected)join(cell.index,other.index);
    }
  }
  const groups=new Map();
  for(const cell of cells){
    const key=find(cell.index);let group=groups.get(key);
    if(!group){group={team:cell.team,id:cell.id,count:0,x:0,y:0,selected:false,height:0,...(options.includeMembers?{members:[]}: {})};groups.set(key,group);}
    if(group.members)for(const member of cell.members)group.members.push(member);
    group.height=Math.max(group.height,cell.height);group.id=Math.min(group.id,cell.id);group.count+=cell.count;group.x+=cell.x;group.y+=cell.y;group.selected||=cell.selected;
  }
  const candidates=[];
  for(const group of groups.values()){
    if(group.count<minimum)continue;
    group.x/=group.count;group.y/=group.count;const p=bannerPoint(group.x,group.y);
    // A concave visible formation can have an unseen centroid. Do not place a
    // crest marker in that gap, and never infer where an unseen part of it extends.
    if(visible&&!visible({x:group.x,y:group.y,team:group.team}))continue;
    if(bounds&&(p.x<bounds.left-18||p.x>bounds.right+18||p.y<bounds.top||p.y>bounds.bottom+55))continue;
    group.key=`${group.team}:${group.id}`;candidates.push(group);
  }
  candidates.sort((a,b)=>Number(b.selected)-Number(a.selected)||b.count-a.count||a.team-b.team||a.id-b.id);
  const counts=new Map(),result=[];
  for(const group of candidates){const count=counts.get(group.team)||0;if(count>=perHouse)continue;counts.set(group.team,count+1);result.push(group);if(result.length>=maximum)break;}
  return result;
}

export class FormationBannerLayer{
  constructor(){this.anchors=new Map();this.source=null;this.groups=[];this.groupedAt=-Infinity;this.groupKey=null;this.rebuilds=0;}
  reset(){this.anchors.clear();this.source=null;this.groups=[];this.groupedAt=-Infinity;this.groupKey=null;}
  draw(context,units,teams,options={}){
    if(options.source&&options.source!==this.source){this.reset();this.source=options.source;}
    const zoom=options.zoom??1,time=options.time??0,active=new Set(),bounds=options.bounds;
    // Only the exact painted atlas crest supplied by the renderer is allowed.
    // No procedural badge, pole, cloth or text fallback may replace it.
    if(!options.drawCrest||zoom<.42){this.anchors.clear();return [];}
    const key=[units?.length,units?.[0]?.id,units?.at(-1)?.id,options.lowDetail,bounds?Math.floor(bounds.left/64):0,bounds?Math.floor(bounds.top/32):0].join(':');
    // Spatial linking is the expensive part. Rebuild at10Hz; current members,
    // their moving centroids and fog visibility are still checked EVERY frame.
    if(key!==this.groupKey||time<this.groupedAt||time-this.groupedAt>=.1){
      this.groups=collectFormationBanners(units,teams,{...options,includeMembers:true});this.groupedAt=time;this.groupKey=key;this.rebuilds++;
    }
    const groups=[];
    for(const cached of this.groups){
      let count=0,x=0,y=0,height=0,selected=false;
      if(teams[cached.team]?.alive===false)continue;
      for(const member of cached.members){
        if(!(member.hp>0)||options.visible&&!options.visible(member))continue;
        const p=bannerPoint(member.x,member.y);if(bounds&&(p.x<bounds.left||p.x>bounds.right||p.y<bounds.top||p.y>bounds.bottom))continue;
        count++;x+=member.x;y+=member.y;height=Math.max(height,options.troopHeight?.(member)??crestTroopHeights[member.type]??35);selected||=!!options.selected?.has(member.id);
      }
      if(count<(options.minimum??6))continue;x/=count;y/=count;
      if(options.visible&&!options.visible({x,y,team:cached.team}))continue;
      groups.push({...cached,count,x,y,height,selected});
    }
    const size=options.crestSize??17,scale=1/zoom;
    // Crests stay small and a fixed screen size, fading at strategic zoom.
    const opacity=bannerClamp((zoom-.42)/.2,0,1)*.92;
    for(const group of groups){
      active.add(group.key);let anchor=this.anchors.get(group.key);
      if(!anchor){anchor={x:group.x,y:group.y,time};this.anchors.set(group.key,anchor);}
      const elapsed=time-anchor.time,blend=elapsed<0||elapsed>.6?1:1-Math.exp(-Math.max(0,elapsed)*10);
      anchor.x+=(group.x-anchor.x)*blend;anchor.y+=(group.y-anchor.y)*blend;anchor.time=time;
      // Smoothing must never move an enemy marker through unseen ground.
      if(options.visible&&!options.visible({x:anchor.x,y:anchor.y,team:group.team})){anchor.x=group.x;anchor.y=group.y;}
      const p=bannerPoint(anchor.x,anchor.y),team=teams[group.team];
      // Keep the bottom of the crest nine screen pixels above the formation's
      // tallest troop, instead of attaching a flag to each soldier.
      const y=p.y-group.height-(9+size/2)/zoom;
      context.save();context.translate(p.x,y);context.scale(scale,scale);context.globalAlpha*=opacity;
      if(group.selected){
        context.strokeStyle='rgba(249,230,173,.72)';context.lineWidth=.8;
        context.beginPath();context.ellipse(0,0,size*.62,size*.66,0,0,BANNER_TAU);context.stroke();
      }
      options.drawCrest(context,team,0,0,size);
      context.restore();
    }
    for(const key of this.anchors.keys())if(!active.has(key))this.anchors.delete(key);
    return groups;
  }
}
