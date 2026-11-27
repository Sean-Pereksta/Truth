/* Deployment settings apply to both pilots for the lifetime of an expedition. */
(() => {
  'use strict';
  const difficulties=[
    {id:'scout',name:'Scout',description:'Smaller patrols, lighter armor and 25% less incoming damage.',
      wave:.70,hull:.78,damage:.75,packDelay:1.20,live:.78},
    {id:'standard',name:'Standard',description:'The original enemy strength, wave size and reinforcement timing.',
      wave:1,hull:1,damage:1,packDelay:1,live:1},
    {id:'veteran',name:'Veteran',description:'28% larger waves, tougher enemies and 18% more incoming damage.',
      wave:1.28,hull:1.18,damage:1.18,packDelay:.90,live:1.10},
    {id:'nightmare',name:'Nightmare',description:'58% larger waves, rapid reinforcements and 40% more incoming damage.',
      wave:1.58,hull:1.38,damage:1.40,packDelay:.77,live:1.20}
  ];
  const byId=new Map(difficulties.map(t=>[t.id,t]));
  const difficulty=id=>byId.get(id)||byId.get('standard');
  const gates=[1,2,3,4,5,6,10,15,20,30,50,100].map(id=>({
    id,name:'Gate '+id,description:id===1?'Campaign opening':id<6?'Campaign boss sector':
      id%5===0?'Deep route with a boss sector':'Deep route with field objectives'
  }));
  function normalize(options={}){
    const rawGate=Number(options?.startGate);
    const startGate=Number.isSafeInteger(rawGate)&&rawGate>=1?rawGate:1;
    const rawRegion=options?.startRegion;
    const region=typeof rawRegion==='string'&&/^\d+$/.test(rawRegion)||typeof rawRegion==='number'?Number(rawRegion):-1;
    const startRegion=Number.isInteger(region)&&region>=0&&region<(window.World?.maps.length||0)?region:'auto';
    return {difficulty:difficulty(options?.difficulty).id,startGate,startRegion};
  }
  function start(g,options={}){
    const settings=normalize(options);
    Object.assign(g,settings);
    g.stage=settings.startGate;
    const fixed=settings.startRegion!=='auto';
    if(g.stage<=5&&g.expeditionMode!=='endless'){
      g.mapId=fixed?settings.startRegion:g.stage-1;g.route=null;
      return settings;
    }
    // Roll the usual modifier and reward at the selected depth. A fixed biome
    // draws its objective from the same regional catalogue as later route cards.
    const route=g.route||Progress.routes(g)[0];
    g.route=route;
    if(fixed&&route.mapId!==settings.startRegion){
      const mapId=settings.startRegion,[name,desc,threat,objectives]=Progress.routeMaps[mapId];
      g.route={...route,mapId,name,desc,threat,objective:objectives[Math.floor(g.rng()*objectives.length)]};
    }
    g.mapId=g.route.mapId;
    return settings;
  }
  window.ExpeditionRules={
    difficulties,gates,difficulty,normalize,start,
    get regions(){
      const regions=(window.World?.maps||[]).map((m,id)=>({id,name:m.name,description:m.desc}));
      return [{id:'auto',name:'Automatic',description:'Follow the campaign or roll an endless route.'},...regions];
    }
  };
})();
