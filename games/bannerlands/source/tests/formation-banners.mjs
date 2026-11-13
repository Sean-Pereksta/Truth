import assert from 'node:assert/strict';
import {collectFormationBanners,FormationBannerLayer} from '../../formation-banners.js';
const teams=Array.from({length:16},(_,id)=>({id,alive:true,color:'#bda36c',sigil:'stag'}));
const company=(n=12,team=0,x=10,y=10,first=1)=>Array.from({length:n},(_,i)=>({id:first+i,team,hp:100,x:x+i%4*.5,y:y+Math.floor(i/4)*.5}));
let checks=0;
const test=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
test('Nearby troops share a house crest marker and isolated scouts remain unmarked',()=>{
  const units=[...company(),...company(1,0,40,40,100)];const banners=collectFormationBanners(units,teams);
  assert.equal(banners.length,1);assert.equal(banners[0].count,12);assert.equal(banners[0].team,0);
});
test('Separated formations and opposing houses receive distinct crest markers',()=>{
  const banners=collectFormationBanners([...company(),...company(12,0,40,40,100),...company(12,1,10,10,200)],teams);
  assert.equal(banners.length,3);assert.equal(new Set(banners.map(b=>b.key)).size,3);
});
test('Only current sight contributes to a crest marker, including its displayed position',()=>{
  const units=[...company(12,0,10,10),...company(20,1,40,40,100)];
  const seen=collectFormationBanners(units,teams,{visible:u=>u.x<20});assert.equal(seen.length,1);assert.equal(seen[0].team,0);
  assert.equal(collectFormationBanners(company(),teams,{visible:u=>Number.isInteger(u.id)}).length,0,'An unseen centroid must not place a marker into fog.');
  assert.equal(collectFormationBanners(company(5),teams).length,0);
});
test('Dead armies, offscreen formations and strategic zoom cannot create crest markers',()=>{
  assert.equal(collectFormationBanners(company().map(u=>({...u,hp:0})),teams).length,0);
  assert.equal(collectFormationBanners(company(),teams,{zoom:.3}).length,0);
  assert.equal(collectFormationBanners(company(),teams,{bounds:{left:-50,right:50,top:-50,bottom:50}}).length,0);
  assert.equal(collectFormationBanners(company(),[{alive:false}]).length,0);
});
test('Grouping stays stable as a company crosses spatial cell boundaries',()=>{
  const a=collectFormationBanners(company(),teams),b=collectFormationBanners(company().map(u=>({...u,x:u.x+2.4,y:u.y+2.4})),teams);
  assert.equal(a.length,1);assert.equal(b.length,1);assert.equal(a[0].key,b[0].key);assert.equal(a[0].count,b[0].count);
});
test('Crest limits prevent marker clutter and selected formations get priority',()=>{
  const units=Array.from({length:16},(_,i)=>company(6,i,i*20,10,i*100+1)).flat();
  const selected=new Set([1501]),banners=collectFormationBanners(units,teams,{maximum:8,selected});
  assert.equal(banners.length,8);assert.equal(banners[0].team,15);
  const sameHouse=Array.from({length:8},(_,i)=>company(6,0,i*20,10,i*100+1)).flat();
  assert.equal(collectFormationBanners(sameHouse,teams).length,3);
});
test('A large dense company groups without changing troop or order data',()=>{
  const units=company(10000),before=JSON.stringify(units),start=performance.now(),banners=collectFormationBanners(units,teams);
  assert.equal(banners.length,1);assert.equal(banners[0].count,10000);assert.equal(JSON.stringify(units),before);
  assert.ok(performance.now()-start<1000,'Dense grouping must remain bounded.');
  const layer=new FormationBannerLayer();layer.anchors.set('old',{});layer.reset();assert.equal(layer.anchors.size,0);
});
test('A crest marker vanishes on lost sight even while paused, and new campaigns clear old anchors',()=>{
  const c={globalAlpha:1};for(const name of ['save','restore','translate','scale','beginPath','moveTo','lineTo','stroke','fill','fillRect','bezierCurveTo','closePath','fillText','arc','ellipse'])c[name]=()=>{};
  const layer=new FormationBannerLayer(),source={},units=company();let crests=0;
  layer.draw(c,units,teams,{source,time:4,drawCrest:()=>crests++});assert.equal(layer.anchors.size,1);assert.equal(crests,1);
  layer.draw(c,units,teams,{source,time:4,visible:()=>false,drawCrest:()=>crests++});assert.equal(layer.anchors.size,0);assert.equal(crests,1);
  layer.draw(c,units,teams,{source,time:4,drawCrest:()=>{}});assert.equal(layer.anchors.size,1);
  layer.draw(c,[],teams,{source:{},time:0});assert.equal(layer.anchors.size,0);
});
test('Only the supplied painted crest is drawn, at a small fixed screen size above the formation',()=>{
  const calls=[],c={globalAlpha:1};
  for(const name of ['save','restore','scale','beginPath','ellipse','stroke'])c[name]=(...args)=>calls.push([name,...args]);
  c.translate=(...args)=>calls.push(['translate',...args]);
  // Any cloth, pole, glyph, badge or fallback drawing is a regression.
  for(const name of ['fill','fillRect','fillText','lineTo','moveTo','bezierCurveTo','arc'])c[name]=()=>{throw new Error('Only the painted crest may be drawn.');};
  const layer=new FormationBannerLayer(),units=company();let crest;
  layer.draw(c,units,teams,{zoom:1,drawCrest:(ctx,team,x,y,size)=>{crest={team,x,y,size};}});
  assert.equal(crest.size,17);assert.equal(crest.team,teams[0]);assert.deepEqual([crest.x,crest.y],[0,0]);
  const first=calls.find(call=>call[0]==='translate'),group=collectFormationBanners(units,teams)[0],ground=(group.x+group.y)*14;assert.equal(first[2]+17/2,ground-group.height-9,'The crest must hover nine pixels above the tallest soldier.');
  calls.length=0;layer.draw(c,units,teams,{zoom:.5,drawCrest:()=>{}});assert.equal(calls.find(call=>call[0]==='scale')[1],2);
  calls.length=0;layer.draw(c,units,teams,{});assert.equal(calls.length,0,'Missing crest art cannot fall back to a procedural flag.');assert.equal(layer.anchors.size,0);
});
test('Cached linking avoids per-frame regrouping while moving centroids and fog checks remain immediate',()=>{
  const c={globalAlpha:1};for(const name of ['save','restore','translate','scale','beginPath','ellipse','stroke'])c[name]=()=>{};
  const layer=new FormationBannerLayer(),units=company(),source={},options={source,time:5,drawCrest:()=>{}};
  let result=layer.draw(c,units,teams,options),x=result[0].x;assert.equal(layer.rebuilds,1);
  for(const unit of units)unit.x+=.1;
  result=layer.draw(c,units,teams,{...options,time:5.03});assert.equal(layer.rebuilds,1);assert.ok(result[0].x>x);
  result=layer.draw(c,units,teams,{...options,time:5.04,visible:u=>u.id==null||u.id>9});assert.equal(result.length,0,'Fewer than six currently visible troops hides a cached crest immediately.');assert.equal(layer.anchors.size,0);
  layer.draw(c,units,teams,{...options,time:5.15});assert.equal(layer.rebuilds,2);
});
console.log(`${checks} formation crest checks passed.`);
