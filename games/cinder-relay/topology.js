/* Seeded floor plans. Each footprint defines which sites can connect. The
   planner chooses a connected tunnel network, a dead-end key branch, and an
   isolated terminal, then cuts and furnishes the individual chambers. */
(() => {
  'use strict';
  const schemes = [
    ['Dispatch Yards', ['###','###']],
    ['Bellmouth Junction', ['####','####']],
    ['Switchback Depot', ['###.','.###','..##']],
    ['Divided Exchange', ['##.##','#####','.###.']],
    ['Three Lanterns', ['.###','####','##.#']],
    ['Relay Quays', ['####.','.####']],
    ['Broken Meridian', ['##.#','####','.###']],
    ['Trestle Station', ['#####','##.##']],
    ['Crescent Workshops', ['####','##..','####','..##']],
    ['Twin Reservoirs', ['##.##','#####','##.##']],
    ['Signal Narrows', ['###.','####','..##']],
    ['Hourglass Works', ['###.','.##.','.###']],
    ['Blindside Terminal', ['.####','###.#','..###']],
    ['North Chain', ['####','##.#','##.#']],
    ['Three Bridges', ['####','.#.#','####']],
    ['Latchkey Basin', ['##..','####','.###','..##']],
    ['Helix Galleries', ['.###','##.#','####']],
    ['Service Cloister', ['####','#.##','####']],
    ['Crosswind Shafts', ['.###.','#####','.###.']],
    ['Rookery Passage', ['##..','####','.#.#','.###']],
    ['Relay Delta', ['##..','###.','.###','..##']],
    ['Broken Spoke', ['##.#','####','##.#','.###']],
    ['Counterweight Bay', ['#..##','#####','###..']],
    ['Needlepoint Lock', ['.###','##.#','###.']],
    ['Long Reach', ['#####','###.#']],
    ['Underpass Nine', ['###.','##.#','####']],
    ['Saddlepoint', ['###..','.####','..###']],
    ['Double Helix', ['##.','###','.##','###']],
    ['Mothlight Court', ['##.##','.####','###.#']],
    ['Hinge Galleries', ['####','..##','.###','##..']],
    ['Sunken Turnpike', ['###.#','.####','..###']],
    ['Last Meridian', ['#.###','#####','.###.']]
  ];
  const roomNames = [
    ['Freight lift','Sorting hall','Bonded stores','Repair annex','Drain exchange','Inspection gallery','Transfer chamber','Weighbridge','Shunting office','East quay','Cargo bypass'],
    ['Upper intake','Intake rotunda','Isolation vault','Instrument bay','Lower transfer','Bypass gallery','Terminal well','Root nursery','Grafting bay','Spore bank','Irrigation works'],
    ['Press lift','Foundry floor','Pattern vault','Tool crib','Cooling works','Annealing gallery','Casting chamber','Slag hopper','Smelter bay','Mold exchange','Heat recovery'],
    ['Phase lift','Spindle gallery','Control archive','Calibration alcove','Crossover','Upper manifold','Extraction court','Tuning chamber','Receiver bank','Delay line','Antenna gallery'],
    ['Docking collar','Gyroscope hall','Telemetry vault','Service cradle','Orbit exchange','Lens gallery','Observatory','Suit airlock','Attitude works','Flight archive','Transit lock'],
    ['Ballast lift','Transit concourse','Pressure vault','Pump annex','Overflow basin','Tide gallery','Floodgate','Filtration works','Pressure pot','Float hall','Turbine bypass'],
    ['Canopy lift','Seed chamber','Specimen stores','Culture bay','Collector basin','Orchard gallery','Pollen terminal','Root gallery','Spore archive','Growing bench','Amber nursery'],
    ['Hoist platform','Stamping hall','Casting stores','Machine shop','Slag exchange','Coking gallery','Crown furnace','Crucible works','Roller press','Sinter chamber','Upper kiln'],
    ['Relay lift','Switching hall','Frequency archive','Alignment bay','Carrier exchange','Sampling gallery','Receiver court','Phase lock','Monitor bay','Transmission hall','Quiet chamber'],
    ['Landing ramp','Crane turntable','Sealed stores','Survey annex','Flux exchange','Western gantry','Departure bay','Courier office','Hull dock','Engine bay','Cargo loop'],
    ['Lantern lift','Lamp foundry','Fuel reserve','Manifold annex','Pressure hub','Lightwell gallery','Reserve chamber','Pilot chamber','Filament works','Upper reservoir','Gaugehouse']
  ];
  function mix(n) {
    n=Math.imul(n^(n>>>16),0x21f0aaad);
    n=Math.imul(n^(n>>>15),0x735a2d97);
    return (n^(n>>>15))>>>0;
  }
  function numbers(seed) {
    return (lo,hi) => {seed=(seed+0x9e3779b9)>>>0;return lo+mix(seed)%(hi-lo+1);};
  }
  function shuffle(items,roll) {
    const copy=items.slice();
    for(let i=copy.length-1;i>0;i--){const j=roll(0,i);[copy[i],copy[j]]=[copy[j],copy[i]];}
    return copy;
  }
  function fromMask(mask) {
    const sites=[],links=[];
    for(let y=0;y<mask.length;y++)for(let x=0;x<mask[y].length;x++)if(mask[y][x]==='#'){
      const i=sites.length;sites.push({x,y});
      for(let j=0;j<i;j++)if(Math.abs(sites[j].x-x)+Math.abs(sites[j].y-y)===1)links.push([j,i]);
    }
    return {sites,links};
  }
  function distances(sites,links,start,skip=-1) {
    const d=Array(sites.length).fill(-1),q=[start];d[start]=0;
    for(let i=0;i<q.length;i++)for(const [a,b] of links){
      const n=a===q[i]?b:b===q[i]?a:-1;
      if(n!==-1&&n!==skip&&d[n]===-1){d[n]=d[q[i]]+1;q.push(n);}
    }
    return d;
  }
  function network(mask,roll) {
    const {sites,links}=fromMask(mask),maxX=Math.max(...sites.map(n=>n.x));
    const sitesInOrder=shuffle(sites.map((_,i)=>i),roll);
    const entry=sitesInOrder.find(i=>sites[i].x===0&&sites.some(n=>n.x===1&&n.y===sites[i].y));
    const first=sites.findIndex(n=>n.x===1&&n.y===sites[entry].y);
    const anchor=sitesInOrder.find(i=>sites[i].x===maxX&&i!==first);
    const fromEntry=distances(sites,links,entry);
    // Removing this branch before cutting the network guarantees one physical
    // access to the key. Prefer a site remote from the launch platform.
    const eligible=sitesInOrder.filter(i=>{
      if([entry,first,anchor].includes(i))return false;
      const d=distances(sites,links,entry,i);
      return d.filter(n=>n>=0).length===sites.length-1;
    });
    const spareCycles=i=>links.filter(e=>!e.includes(i)).length-(sites.length-2);
    eligible.sort((a,b)=>Math.sign(spareCycles(b))-Math.sign(spareCycles(a))||fromEntry[b]-fromEntry[a]);
    const key=eligible[0];
    const parent=sites.map((_,i)=>i),find=i=>{while(parent[i]!==i)i=parent[i];return i;};
    const tunnels=[[entry,first]],extras=[];parent[first]=entry;
    for(const [a,b] of shuffle(links,roll)){
      if([a,b].includes(key)||(a===entry&&b===first)||(b===entry&&a===first))continue;
      const fa=find(a),fb=find(b);
      if(fa===fb)extras.push([a,b]);else{parent[fa]=fb;tunnels.push([a,b]);}
    }
    const extraCount=extras.length?roll(1,Math.min(3,extras.length)):0;
    tunnels.push(...extras.slice(0,extraCount));
    const keyLinks=shuffle(links.filter(e=>e.includes(key)),roll);
    tunnels.push(keyLinks[0]);
    return {sites,tunnels,entry,first,key,anchor,maxX,sitesInOrder};
  }
  function orient(cols,rows,flipX,flipY,transpose) {
    const point=([x,y])=>{
      const xx=flipX?cols-1-x:x,yy=flipY?rows-1-y:y;
      return transpose?[yy,xx]:[xx,yy];
    };
    const box=([x,y,w,h])=>{
      const [a,b]=point([x,y]),[e,f]=point([x+w-1,y+h-1]);
      return [Math.min(a,e),Math.min(b,f),Math.abs(a-e)+1,Math.abs(b-f)+1];
    };
    return {point,box};
  }
  function regionalPlan(route,seed,run,stage,room,intro,boss) {
    const roll=numbers(seed),rooms=[],halls=[],piers=[],sites=new Map();
    const variant=roll(0,2);
    function chamber(id,name,x,y,w,h,ambush=false) {
      const r={x,y,w,h,center:[x+Math.floor(w/2),y+Math.floor(h/2)]};
      rooms.push([id,name,x,y,w,h,+ambush]);
      sites.set(id,r);
      return r;
    }
    function tunnel(points,width=3) {halls.push({points,width});}
    function across(a,b,y,width) {
      const p=sites.get(a).center,q=sites.get(b).center;
      tunnel([p,[p[0],y],[q[0],y],q],width);
    }
    function down(a,b,x,width) {
      const p=sites.get(a).center,q=sites.get(b).center;
      tunnel([p,[x,p[1]],[x,q[1]],q],width);
    }
    function columns(id,width,height) {
      const {x,y,w}=sites.get(id);
      piers.push([x+3,y+3,width,height],[x+w-3-width,y+3,width,height]);
    }

    let name,terminal,approach;
    if(route===11){
      // Parallel galleries reconnect beyond the sealed stacks. The key and
      // supply room draw pilots toward opposite sides of the circuit.
      const upper=roll(3,6),lower=roll(45,48),middle=roll(22,24),reach=roll(-2,2);
      name=['Specular Stack Ring','Facet Gallery Circuit','Twin Index Galleries'][variant];
      chamber('entry','Receiving dais',3,middle+2,12,12);
      chamber('hall','Refraction hall',20,middle-1,16,18,true);
      chamber('key','Master index alcove',4,upper,12,11);
      chamber('cache','Restoration stores',4,lower+1,12,10);
      chamber('loop','Lens reading gallery',23,upper,17,12);
      chamber('gallery','Index reading gallery',23,lower,17,13);
      chamber('annex-1','Polished stacks',49+reach,upper+1,16,12,variant!==2);
      chamber('annex-2','Dark stacks',49+reach,lower-1,16,13,variant===2);
      chamber('annex-3','Index junction',61+reach,middle-1,14,19);
      across('entry','hall',middle+8,5);
      down('hall','loop',30,5);
      down('hall','gallery',30,5);
      across('key','loop',upper+5);
      across('cache','gallery',lower+6);
      across('loop','annex-1',upper+6,5);
      across('gallery','annex-2',lower+6,5);
      down('annex-1','annex-3',62+reach,5);
      down('annex-2','annex-3',62+reach,5);
      for(const id of ['hall','loop','gallery','annex-1','annex-2'])columns(id,2,3);
      terminal='Facet chamber';approach=sites.get('annex-3');
    }else{
      // The dry channels snake around sealed basins. A relief line and a
      // lower catwalk offer different approaches to the discharge pump.
      const shift=roll(0,2),elbow=roll(0,3),baffle=roll(0,2);
      name=['Siphon Cut','Nine Pump Bypass','Settling Channel'][variant];
      chamber('entry','Dry intake',3,5,12,10);
      chamber('hall','Check-valve room',21,4,15,13,true);
      chamber('key','Governor sump',3,49+shift,12,10);
      chamber('cache','Tool float',48+elbow,4,12,10);
      chamber('loop','Settling basin',5,28+shift,18,13);
      chamber('gallery','Raised catwalk',35+elbow,40+shift,15,14,true);
      chamber('annex-1','Relief manifold',48+elbow,22+baffle,13,11);
      chamber('annex-2','Discharge pump',66,27+shift,14,15);
      across('entry','hall',10);
      across('hall','cache',9);
      const inlet=sites.get('hall').center,basin=sites.get('loop').center;
      tunnel([inlet,[inlet[0],20+baffle],[basin[0],20+baffle],basin]);
      down('loop','key',10);
      const catwalk=sites.get('gallery').center;
      const bend=26+elbow;
      tunnel([basin,[bend,basin[1]],[bend,catwalk[1]],catwalk]);
      const relief=sites.get('annex-1').center,pump=sites.get('annex-2').center;
      tunnel([catwalk,[catwalk[0],34+baffle],[relief[0],34+baffle],relief]);
      across('annex-1','annex-2',28+baffle);
      const bypass=55+elbow;
      tunnel([catwalk,[bypass,catwalk[1]],[bypass,39+shift],[pump[0],39+shift],pump]);
      for(const id of ['loop','gallery','annex-2'])columns(id,3,3);
      terminal='Backflow chamber';approach=sites.get('annex-2');
    }

    const [approachX,approachY]=approach.center;
    const exitW=boss?roll(30,32):roll(14,18),exitH=boss?roll(19,22):roll(13,16);
    const exit=chamber('exit',boss?terminal+' core':terminal,approach.x+approach.w+6,
      approachY-Math.floor(exitH/2),exitW,exitH,!boss);
    // This hall is exactly three tiles wide where the bulkhead spans it.
    tunnel([[approachX,approachY],[exit.x+4,approachY]]);
    const cols=exit.x+exit.w+2,rows=Math.max(...rooms.map(([, , ,y, ,h])=>y+h))+2;
    const flipX=!intro&&!!roll(0,1),flipY=!!roll(0,1),transpose=!intro&&!boss&&roll(0,2)===0;
    const {point,box}=orient(cols,rows,flipX,flipY,transpose);
    const [startX,startY]=sites.get('entry').center;
    return {name,identity:'regional-1-'+route+'-'+run.toString(36)+'-'+stage+'-'+room,
      scheme:variant,seed,boss,intro,cycles:1,cols:transpose?rows:cols,rows:transpose?cols:rows,
      rooms:rooms.map(([id,n,x,y,w,h,ambush])=>[id,n,...box([x,y,w,h]),ambush]),
      halls:halls.map(h=>h.points.map(point)),hallWidths:halls.map(h=>h.width),piers:piers.map(box),
      door:[...point([exit.x-3,approachY]),transpose?'y':'x'],start:point([startX+2,startY]),
      key:point(sites.get('key').center),cache:point(sites.get('cache').center),
      gate:point([exit.x+exit.w-4,approachY]),bossEntry:point([exit.x+5,approachY]),
      bossSpawn:point([exit.x+exit.w-8,approachY])};
  }
  function make(g) {
    const stage=Math.max(1,Math.floor(g.stage||1)),room=Math.max(0,Math.floor(g.room||0));
    const route=Math.max(0,Math.floor(g.mapId||0)),run=Number(g.runSeed??g.seed??0)>>>0;
    const ordinal=(stage-1)*4+((room+route)%4),deck=mix(run^0xa0d75e03);
    // A coprime stride yields a full cycle of 32 distinct floor names before
    // repeating any one. Later cycles still cut new rooms and tunnel networks.
    const scheme=(deck+ordinal*(1+2*((deck>>>6)%16)))&31;
    const seed=mix(run^Math.imul(stage,0x6c8e9cf5)^Math.imul(room+1,0x27d4eb2d)^Math.imul(route+1,0x165667b1));
    const intro=stage===1&&room===0,boss=room===3&&(stage<=5||stage%5===0);
    if(route===11||route===12)return regionalPlan(route,seed,run,stage,room,intro,boss);
    const roll=numbers(seed),[name,footprint]=schemes[scheme],names=roomNames[route%roomNames.length];
    let mask=intro?['###','###']:footprint;
    if(boss&&mask[0].length>4)mask=Array.from({length:mask[0].length},(_,i)=>mask.map(row=>row[i]).join(''));
    const {sites,tunnels,entry,first,key,anchor,maxX,sitesInOrder}=network(mask,roll);
    const maxY=Math.max(...sites.map(n=>n.y)),exitW=boss?roll(30,32):intro?13:roll(14,19);
    const exitH=boss?roll(19,22):intro?10:roll(11,16);
    const maxPitchX=Math.floor((110-exitW-9)/(maxX+1)),maxPitchY=Math.floor((70-(boss?4:0))/(maxY+1));
    const pitchX=intro?15:roll(Math.min(16,maxPitchX),Math.min(21,maxPitchX));
    const pitchY=intro?13:roll(Math.min(15,maxPitchY),Math.min(20,maxPitchY));
    const ds=distances(sites,tunnels,entry),free=sitesInOrder.filter(i=>![entry,first,key].includes(i));
    const cache=free.find(i=>i!==anchor&&tunnels.filter(e=>e.includes(i)).length===1)??free.find(i=>i!==anchor);
    const other=free.filter(i=>i!==cache).sort((a,b)=>ds[a]-ds[b]);
    const ids=Object.assign(Array(sites.length),{[entry]:'entry',[first]:'hall',[key]:'key',[cache]:'cache'});
    other.forEach((i,j)=>{ids[i]=['loop','gallery'][j]||'annex-'+(j-1);});
    const roles=['entry','hall','key','cache','loop','gallery','exit'];
    const rooms=[],piers=[],halls=[];
    const secondary=(!intro&&sites.length>=9)?other[other.length-1]:-1;
    for(let i=0;i<sites.length;i++){
      const n=sites[i],id=ids[i],fight=i===first||i===secondary,role=roles.indexOf(id);
      const w=roll(Math.min(pitchX-3,fight?14:10),pitchX-3);
      const h=roll(Math.min(pitchY-3,fight?11:8),pitchY-3);
      const x=3+n.x*pitchX+roll(0,pitchX-w-3),y=5+n.y*pitchY+roll(0,pitchY-h-3);
      const detail=role>=0?role:7+(+id.slice(6)-1)%4;
      n.cx=x+Math.floor(w/2);n.cy=y+Math.floor(h/2);n.w=w;n.h=h;n.left=x;n.top=y;
      const tuple=[id,names[detail],x,y,w,h,+fight];
      tuple.detail=detail;rooms.push(tuple);
      if(w>=14&&h>=11&&i!==entry&&i!==key&&i!==cache&&roll(0,3)!==0){
        piers.push([x+(roll(0,1)?2:w-4),y+(roll(0,1)?2:h-4),2,2]);
      }
    }
    for(const [a,b] of tunnels){
      const n=sites[a],m=sites[b];
      // Portals move independently along the sides of their chambers. Bends
      // lie in the service gap between slots and cannot trespass into another.
      if(n.y===m.y){
        const [l,r]=n.x<m.x?[n,m]:[m,n],bend=Math.floor((l.left+l.w+r.left-1)/2);
        const y1=l.cy+roll(-1,1),y2=r.cy+roll(-1,1);
        halls.push([[l.cx,y1],[bend,y1],[bend,y2],[r.cx,y2]]);
      }else{
        const [t,b]=n.y<m.y?[n,m]:[m,n],bend=Math.floor((t.top+t.h+b.top-1)/2);
        const x1=t.cx+roll(-1,1),x2=b.cx+roll(-1,1);
        halls.push([[x1,t.cy],[x1,bend],[x2,bend],[x2,b.cy]]);
      }
    }
    const last=sites[anchor],startSite=sites[entry],keySite=sites[key],cacheSite=sites[cache];
    const rightEdge=Math.max(...sites.map(n=>n.left+n.w));
    const ex=rightEdge+(intro?4:roll(5,7)),ey=Math.max(2,Math.min(73-exitH,last.cy-Math.floor(exitH/2)));
    const exitPortalY=last.cy,gateX=ex+exitW-4,gateY=ey+Math.floor(exitH/2);
    rooms.push(['exit',boss?names[6]+' core':names[6],ex,ey,exitW,exitH,+!boss]);
    halls.push([[last.cx,exitPortalY],[ex+4,exitPortalY]]);
    // Keep the full turning radius for heavy enemies where a hall meets a
    // chamber. An otherwise harmless corner pier can pinch an offset portal.
    const clearPiers=piers.filter(([x,y,w,h])=>!halls.some(hall=>hall.some(([ax,ay],i)=>{
      if(!i)return false;
      const [bx,by]=hall[i-1];
      return Math.min(ax,bx)-2<x+w&&Math.max(ax,bx)+2>=x&&Math.min(ay,by)-2<y+h&&Math.max(ay,by)+2>=y;
    })));
    let cols=ex+exitW+2,rows=Math.max(ey+exitH+2,...sites.map(n=>n.top+n.h+2));
    const lockX=ex-3;
    const flipX=!intro&&!!roll(0,1),flipY=!!roll(0,1);
    const transpose=!intro&&!boss&&cols<=75&&!!roll(0,1);
    const {point:transform,box}=orient(cols,rows,flipX,flipY,transpose);
    const finalRooms=rooms.map(([id,n,x,y,w,h,f])=>[id,n,...box([x,y,w,h]),f]);
    const roleOrder=id=>{const i=roles.indexOf(id);return i===6?999:i===-1?7+Number(id.slice(6)):i;};
    finalRooms.sort((a,b)=>roleOrder(a[0])-roleOrder(b[0]));
    return {name,identity:'2-'+run.toString(36)+'-'+stage+'-'+room+'-'+route+'-'+scheme,scheme,seed,
      cols:transpose?rows:cols,rows:transpose?cols:rows,rooms:finalRooms,piers:clearPiers.map(box),
      halls:halls.map(h=>h.map(transform)),door:[...transform([lockX,exitPortalY]),transpose?'y':'x'],
      start:transform([startSite.cx+2,startSite.cy]),key:transform([keySite.cx,keySite.cy]),
      cache:transform([cacheSite.cx,cacheSite.cy]),gate:transform([gateX,gateY]),
      boss,bossEntry:transform([ex+5,gateY]),bossSpawn:transform([ex+exitW-8,gateY]),
      intro,cycles:tunnels.length-sites.length+1};
  }
  window.LevelTopology={make,names:schemes.map(s=>s[0])};
})();
