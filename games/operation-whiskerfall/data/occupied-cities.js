/* The freight spur and capital borough extend the original map after seeded generation. */
(function(){
  'use strict';
  const C=window.OW.Content;
  const cities=[
    {id:'city_ironveil',key:'ironveil',name:'Ironveil City',region:6,left:4940,right:9130,top:14560,bottom:17720,
      tram:'Ashford freight tram',town:'town_6',tint:'#335057',roads:'#62646a',blocks:'#494b4c',
      avenues:['Kiln Avenue','Canal Street','Brakeshoe Lane','Civic Parade','Furnace Row','Tin Roof Walk','Glassmakers Way','Union Road'],
      quarters:['Union Market','The Packing Yards','Founders’ Arcade','West Chimneys'],points:[[2,0],[1,3],[6,2],[2,5],[7,5],[0,1]],
      names:['Union station shelter','Printer’s soup window','Bonded freight archive','Kiln roof lookout','Freight dispatch relay','Canal evacuation steps']},
    {id:'city_blackglass',key:'blackglass',name:'Blackglass Borough',region:7,left:175,right:4410,top:14560,bottom:17720,
      tram:'Dawnbridge night tram',town:'town_7',tint:'#243750',roads:'#535969',blocks:'#383f52',
      avenues:['Ministry Walk','Ledger Street','Printer’s Row','Archive Boulevard','Night Post','Crescent Lane','Semaphore Street','West Parade'],
      quarters:['Printer’s Quarter','Embassy Row','Archive Square','The Radio Ward'],points:[[5,0],[1,1],[6,4],[2,5],[7,2],[0,4]],
      names:['Night tram shelter','Lamplighter’s window','Blackglass municipal archive','Roof of the night press','Ministry relay booth','West postern']}
  ];
  const suffixes=['','_witness','_archive','_roof','_relay','_exit'];
  function offset(w,l,dx,dy,minGap=108){
    for(const r of [0,40,80,130,185,245,310])for(let i=0;i<16;i++){
      const a=i*Math.PI/8,x=l.x+dx+Math.cos(a)*r,y=l.y+dy+Math.sin(a)*r;
      if(!w.isBlocked(x,y,22)&&!w.locations.some(q=>q!==l&&Math.hypot(x-q.x,y-q.y)<minGap))return {x,y};
    }
    throw Error('No walkable street stop at '+l.name);
  }
  // Each plate is a street plan. A block letter selects its frontages, courtyard or civic space.
  const plans={
    ironveil:[
      'ASRRTCKA','KFAACSTR','ATRCSMFK','SFRCFASK','KAMCTFRS','FASKRFTA'
    ],
    blackglass:[
      'FSKAPSTA','TASFKFKS','AKFMSTFA','FSMPAAKT','TKFSRASK','ASRKTFAS'
    ]
  };
  const lots={
    ironveil:[8,1,6,10,15,5,12,9,2,14,0,7,4,13,11,3],
    blackglass:[2,5,11,8,14,1,6,10,4,13,7,0,15,9,12,3]
  };
  function generateCity(w,c){
    const iron=c.region===6,X=[175,605,1070,1510,2065,2505,2965,3450,3890].map(x=>c.left+x);
    const Y=(iron?[195,655,1005,1535,1915,2420,2820]:[205,570,1060,1470,1920,2370,2840]).map(y=>c.top+y);
    const at=(i,j)=>({x:X[i],y:Y[j]});
    Object.assign(c,{x:(c.left+c.right)/2,y:(c.top+c.bottom)/2,streetsX:X,streetsY:Y,routes:[],blocks:[],squares:[],canals:[],cover:[]});
    c.sightBlocks=c.cover;
    const grid=(...pairs)=>pairs.map(([i,j])=>at(i,j));
    function route(name,kind,width,points){
      c.routes.push({name,kind,width,points});
      w._route(points,width,'local',name);
    }
    function rect(x,y,width,height){return {x,y,w:width,h:height};}
    function monument(id,key,x,frontY,width,depth,quarter,flip=false){
      const cover=rect(x-width*.44,frontY-depth,width*.88,depth);
      const obj=w._addObject({id:c.id+'_'+id,type:'cityBuilding',x,y:frontY-8,w:width,h:depth*2,visualWidth:width,frontY,cityFootprint:cover,
        cityArt:key,flip,cityKey:c.key,district:quarter,region:c.region,solid:true});
      c.cover.push(cover);return obj;
    }
    function fixture(id,index,x,y,width){
      w._addObject({id:c.id+'_'+id,type:'streetFixture',painting:'civic-'+index,x,y,w:width,h:85,region:c.region});
    }
    // Main routes change direction, width and surface with their function. Shorter streets end in yards.
    const trunk=iron?'Foundry Boulevard':'Ministry Parade';
    route(trunk,'boulevard',iron?125:150,grid([0,3],[3,3],[5,3],[8,3]));
    route(iron?'Union Station Road':'Night Post Drive','street',91,grid([0,0],[8,0]));
    route(iron?'South Wharf Road':'The Embassy Ring','street',83,grid([0,6],[8,6]));
    route(iron?'West Lock Walk':'West Postern Road','quay',76,grid([0,0],[0,6]));
    route(iron?'East Freight Way':'Archive Procession','street',86,grid([8,0],[8,6]));
    route(iron?'Clockmakers’ Cut':'Pressmen’s Lane','street',83,grid([2,0],[2,4],[1,4],[1,6]));
    route(iron?'Founders’ Arcade':'Civic Axis','boulevard',iron?96:138,grid([4,0],[4,6]));
    route(iron?'Packing House Road':'Embassy Crescent','street',83,grid([7,0],[7,2],[6,2],[6,5],[7,5],[7,6]));
    route(iron?'Towpath Tram':'The Night Mail','rail',54,iron?grid([5,0],[5,1],[6,1],[6,3],[7,3],[7,6]):grid([0,2],[3,2],[3,5],[5,5],[5,6]));
    const branchNames=iron?['Coopers’ Rows','Engine Alley','Canal Market','Tinsmith Steps','Hearth Lane']:['Stag Passage','Press Alley','Crescent Mews','Garden Stairs','Chancery Lane'];
    for(const [row,a,b,kind] of [[1,0,4,'street'],[1,4,8,'alley'],[2,0,3,'alley'],[2,3,6,'street'],[2,6,8,'alley'],[4,0,4,'street'],[4,4,8,'alley'],[5,0,3,'alley'],[5,3,8,'street']]){
      route(branchNames[row-1],kind,kind==='street'?69:37,grid([a,row],[b,row]));
    }
    for(const [col,a,b] of [[1,0,4],[2,4,6],[3,0,2],[3,3,6],[5,1,3],[5,3,6],[6,0,2],[6,5,6],[7,2,5]]){
      route(branchNames[col%5],'alley',37,grid([col,a],[col,b]));
    }
    const north=at(c.points[0][0],0);route(c.name+' northern approach','street',85,[{x:north.x,y:c.top-440},north]);
    if(iron){
      const canal=rect(X[3]+106,Y[1]-70,102,Y[5]-Y[1]+180);
      canal.bridges=[1,2,3,4,5].map(j=>rect(canal.x-15,Y[j]-(j===3?56:29),canal.w+30,j===3?112:58));
      c.canals.push(canal);
      for(const x of [canal.x-32,canal.x+canal.w+32])route('Coal Barge Towpath','quay',35,[{x,y:canal.y-25},{x,y:canal.y+canal.h+25}]);
    }
    const plan=plans[c.key],deck=lots[c.key];let nextLandmark=0;
    for(let row=0;row<6;row++)for(let col=0;col<8;col++){
      const n=row*8+col,code=plan[row][col],quarter=(row>=3?2:0)+(col>=4?1:0);
      const x0=X[col]+45,x1=X[col+1]-46,y0=Y[row]+46,y1=Y[row+1]-51;
      let left=x0,right=x1;
      if(iron&&col===3&&row>=1&&row<=4)left=c.canals[0].x+c.canals[0].w+48;
      const span=right-left,mid=(left+right)/2,dy=y1-y0;
      c.blocks.push({...rect(left,y0,span,dy),district:quarter,idx:n});
      const prefix=iron?'iron-front-':'black-front-',visible=prefix+deck[(n+row*5+col*4)%16],rear=prefix+deck[(n+row*7+col*3+7)%16];
      if(code==='M'||code==='P'||(col===c.points[0][0]&&row===0)){
        const kind=code==='P'?'garden':code==='M'?(iron?'market':'ministry'):'station';
        c.squares.push({...rect(left-16,y0-8,span+32,dy+21),kind,name:c.quarters[quarter]});
        const frame=kind==='garden'?10:kind==='station'?(iron?0:11):iron?1:6;
        monument('square_'+n,'urban-landmark-'+frame,mid,y0+dy*.43,Math.min(span*.78,285),dy*.24,quarter);
        fixture('square_clock_'+n,1,left+18,y1-5,48);
        if(kind==='market')fixture('market_stall_'+n,0,right-35,y1-25,97);
        continue;
      }
      if(code==='R'){
        const mark=iron?[2,4,5]:[7,8,9];
        monument('works_'+n,'urban-landmark-'+mark[nextLandmark++%3],left+.53*span,y1-8,span*.86,Math.min(dy*.44,130),quarter);
        fixture('siding_'+n,iron?10:7,left+25,y0+45,iron?95:48);
        route(iron?'Freight siding':'Messenger approach',iron?'rail':'alley',iron?39:32,[{x:X[col],y:y0+61},{x:right-35,y:y0+61},{x:right-18,y:y0+82}]);
        continue;
      }
      if(code==='A'||code==='K'){
        // A through alley with a turn around the rear of two separate building runs.
        const alleyX=left+span*(code==='A'?.44:.56),gap=51;
        const lw=alleyX-gap/2-left,rw=right-alleyX-gap/2;
        const single=(shift)=>'facade-'+((iron?0:8)+(row*3+col+shift)%8);
        monument('court_west_'+n,lw<160?single(0):visible,left+lw/2,y1,lw,Math.min(118,dy*.34),quarter,col%2===0);
        monument('court_east_'+n,rw<160?single(3):rear,right-rw/2,y1-8,rw,Math.min(120,dy*.34),quarter);
        const turn=y0+dy*.50;
        route(branchNames[(row+col)%5],'alley',32,[{x:alleyX,y:Y[row+1]},{x:alleyX,y:turn},{x:X[col+1],y:turn}]);
        if(span>230)monument('rear_'+n,rear,mid,y0+dy*.31,span*.91,Math.min(81,dy*.23),quarter);
      }else{
        const width=span*(code==='T'?.97:.93),center=left+(right-left)*.5;
        monument('frontage_'+n,visible,center,y1,width,Math.min(112,dy*.36),quarter,(col+row)%3===0);
        const sub=code==='F'?'urban-landmark-'+(iron?(n%2?4:2):(n%2?8:9)):rear;
        const rearWidth=Math.min(span*(code==='T'?.70:.54),226);
        monument('upper_'+n,sub,code==='T'?mid:left+rearWidth*.55,y0+dy*.34,rearWidth,Math.min(78,dy*.25),quarter);
      }
      fixture('stoop_'+n,(iron?[2,9,7,5,0,8]:[7,5,3,6,8,0])[(col+row*3)%6],right-22,y1+15,[68,82,64][n%3]);
      if(n%2===0)fixture('arcade_'+n,6,left+15,y1+12,42);
    }
    // Landmarks and patrol posts are points on a route, independent of visual building origins.
    for(const [n,[col,row]] of c.points.entries()){
      const id=c.id+suffixes[n],p=at(col,row);
      w._addLocation({id,type:n?'cityLead':'occupiedCity',name:n?c.names[n]:c.name,description:c.names[n]+' · '+c.quarters[(row>=3?2:0)+(col>=4?1:0)],...p,radius:68,region:c.region,city:c.key,sector:c.region===7?'berlin':null});
      fixture('lead_'+n,[5,7,1,6,9,5][n],p.x-52,p.y-26,71);
    }
    for(const [idx,[col,row]] of [[1,2],[2,2],[3,4],[4,1],[5,3],[6,3],[6,5],[7,4],[1,5],[3,3],[4,5],[7,1]].entries()){
      const p=at(col,row),axis=idx%3===0?'y':'x';
      const sx=idx%2===0?1:-1,sy=idx%3===0?1:-1,corner=at(col+sx,row);
      const watchPath=[p,corner,at(col+sx,row+sy),at(col,row+sy)];
      w._spawn({id:c.id+'_watch_'+idx,type:idx%4===0?1:0,name:idx%4===0?'Night watch corporal':'Lamplight patrol',...p,homeX:p.x,homeY:p.y,region:c.region,level:iron?16:22,boss:false,patrol:idx*.7,cityWatch:c.key,watchRoute:axis,watchPhase:idx*.7,watchPath});
    }
    for(const [idx,[col,row]] of [[1,0],[3,3],[4,2],[6,4],[0,4],[5,6],[8,1],[2,5],[3,1],[7,3]].entries()){
      const p=at(col,row);fixture('light_'+idx,6,p.x+57,p.y+50,43);
      w._addObject({id:c.id+'_resident_'+idx,type:'friendlyCat',...p,homeX:p.x,homeY:p.y,w:108,h:72,role:idx%6,skin:idx%4,phase:idx*.7,streetRoute:[[0,0],[74,0],[112,0]],friendly:true,region:c.region});
    }
    const t=w.getLocation(c.town),stop=offset(w,t,295,-115,122);
    w._addLocation({id:c.id+'_tram',name:c.tram,type:'cityTram',...stop,region:c.region,radius:60,city:c.key,townId:c.town});
    fixture('tram_stop',5,stop.x,stop.y,105);
    w._addLocation({id:c.id+'_return',name:'Return tram to '+t.name,type:'cityTram',x:north.x+150,y:north.y,region:c.region,radius:62,city:c.key});
    fixture('streetcar',10,north.x+150,north.y-25,120);
  }

  function livingTowns(w){
    const large=new Set(['town_6','town_7','town_9','town_4','town_1']);
    const stops=[[0,-30],[100,-30],[155,20],[135,85],[225,90],[295,120],[250,180],[-75,125],[-110,95],[-150,45]];
    for(const d of Object.values(C.townStreets)){
      const t=w.getLocation(d.id),big=large.has(d.id);if(!t||d.small)continue;
      const count=big?11:4;
      for(let i=0;i<count;i++){
        const [dx,dy]=stops[i%stops.length],x=t.x+dx,y=t.y+dy;
        const route=[[0,0]];
        for(const [a,b] of [[65,0],[70,40],[-65,0],[0,-50]]){
          if(w._navigationRay(x,y,x+a,y+b,16))route.push([a,b]);
          if(route.length===3)break;
        }
        if(w.isBlocked(x,y,16)||route.length<2)continue;
        w._addObject({id:t.id+'_street_regular_'+i,type:'friendlyCat',x,y,homeX:x,homeY:y,w:100,h:72,role:(d.index+i)%6,skin:i%4,
          phase:i*1.7,streetRoute:route,region:t.region,friendly:true,locationId:t.id});
      }
      if(big){
        const port=d.key==='crownrest',industry=d.key==='ashford';
        const fixtures=[[port?4:industry?9:2,-388,105,115], [port?11:industry?10:8,340,305,140],[d.key==='dawnbridge'?6:1,145,-72,65]];
        for(const [i,[frame,x,y,width]] of fixtures.entries())w._addObject({id:t.id+'_city_trade_'+i,type:'streetFixture',painting:'civic-'+frame,x:t.x+x,y:t.y+y,w:width,h:100,region:t.region});
        for(let i=0;i<4;i++){
          const side=i%2?1:-1;
          w._addObject({id:t.id+'_rowhouses_'+i,type:'streetFixture',painting:'homes-'+d.index,x:t.x+side*(415+(i>1?125:0)),y:t.y+(i>1?132:-150),w:165,h:120,region:t.region,solid:false});
        }
      }
    }
  }
  C.occupiedCities=cities;
  C.installOccupiedCities=function(w){
    w.cityOldHeight=w.height;w.height=Math.max(w.height,...cities.map(c=>c.bottom+25));
    w.cityZones=cities.map(c=>({...c}));for(const c of w.cityZones)generateCity(w,c);
    livingTowns(w);
    const tavern=w.getLocation('tavern_copper_minnow');
    if(tavern)w._addObject({id:tavern.id+'_door',type:'tavernDoor',locationId:tavern.id,x:tavern.x,y:tavern.y-42,w:174,h:130,region:tavern.region,solid:false});
  };
}());
