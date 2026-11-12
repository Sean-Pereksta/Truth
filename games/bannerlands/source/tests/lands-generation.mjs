import assert from 'node:assert/strict';
import {LAND_MAPS,generateLands,isPassableTile,tileTravelCost} from '../../lands.js';

let cases=0;
const test=(name,fn)=>{fn();cases++;console.log(`PASS ${name}`);};
const make=(landscape='crownlands',W=112,H=96,seed=44277)=>{
  const game={W,H,config:{landscape,seed},tiles:[]};
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)game.tiles.push({x,y,terrain:x===0||y===0||x===W-1||y===H-1?'water':'grass',owner:-1,claim:-1,capture:0,value:1,height:0,variation:.5});
  const homes=[];for(let j=0;j<4;j++)for(let i=0;i<5;i++)homes.push({x:Math.round(8+(W-16)*i/4)+.5,y:Math.round(8+(H-16)*j/3)+.5});
  generateLands(game,homes);return {...game,homes};
};
const connected=g=>{
  const start=g.tiles.findIndex(isPassableTile),seen=new Uint8Array(g.tiles.length),queue=[start];seen[start]=1;
  for(let i=0;i<queue.length;i++){const t=g.tiles[queue[i]];for(const [dx,dy]of [[1,0],[0,1],[-1,0],[0,-1]]){const x=t.x+dx,y=t.y+dy,index=y*g.W+x;if(x>=0&&y>=0&&x<g.W&&y<g.H&&!seen[index]&&isPassableTile(g.tiles[index])){seen[index]=1;queue.push(index);}}}
  return {seen,count:queue.length};
};
const snapshot=g=>g.tiles.map(t=>[t.terrain,t.feature,t.featureAxis].join(':')).join('|');

test('Nine landscapes expose meaningful campaign descriptions',()=>{
  assert.equal(LAND_MAPS.length,9);assert.equal(new Set(LAND_MAPS.map(m=>m.id)).size,9);
  for(const map of LAND_MAPS)assert.ok(map.label.length>3&&map.description.length>30);
});

test('Every landscape is deterministic and a different campaign seed changes the terrain',()=>{
  for(const map of LAND_MAPS.filter(m=>m.id!=='open')){
    const a=make(map.id),b=make(map.id),c=make(map.id,112,96,9137);
    assert.equal(snapshot(a),snapshot(b),map.id);assert.deepEqual(a.landmarks,b.landmarks);
    assert.notEqual(snapshot(a),snapshot(c),map.id);
  }
});

test('All usable land and every capital remain connected on every map size and several seeds',()=>{
  for(const map of LAND_MAPS)for(const [W,H]of [[112,96],[160,128],[224,176]])for(const seed of [1,44277,914553]){
    const g=make(map.id,W,H,seed),reach=connected(g);
    assert.equal(reach.count,g.playable,`${map.id} ${W} seed ${seed}`);
    for(const home of g.homes)assert.equal(reach.seen[Math.floor(home.y)*W+Math.floor(home.x)],1,`${map.id} capital ${home.x},${home.y}`);
    assert.ok(g.playable>W*H*.58,`${map.id} retains ample buildable land`);
  }
});

test('All twenty starting reservations have an equal clear seven-tile mustering field',()=>{
  for(const map of LAND_MAPS.filter(m=>m.id!=='open')){
    const g=make(map.id);
    for(const p of g.homes)for(const t of g.tiles)if(t.x>0&&t.y>0&&t.x<g.W-1&&t.y<g.H-1&&(t.x+.5-p.x)**2+(t.y+.5-p.y)**2<=49){assert.equal(t.terrain,'grass',`${map.id} ${t.x},${t.y}`);assert.equal(t.feature,null);}
  }
});

test('The eight designed lands differ structurally and expose crossings, roads and mountain passes',()=>{
  const signatures=new Set();
  for(const map of LAND_MAPS.filter(m=>m.id!=='open')){
    const g=make(map.id);signatures.add(snapshot(g));
    assert.ok(g.landsStats.water>100,map.id+' has actual water barriers');
    assert.ok(g.landsStats.bridges>0,map.id+' has usable bridges');
    assert.ok(g.landsStats.roads>60,map.id+' has a real road network');
    assert.ok(g.landmarks.some(l=>l.kind==='bridge'),map.id+' names its bridge crossings');
    for(const l of g.landmarks)assert.ok(l.x>0&&l.x<g.W-1&&l.y>0&&l.y<g.H-1);
  }
  assert.equal(signatures.size,8);
  const highlands=make('highlands');assert.ok(highlands.landsStats.mountains>500);assert.ok(highlands.landsStats.passes>0);assert.ok(highlands.landmarks.some(l=>l.kind==='pass'));
  assert.ok(make('riverlands').landsStats.fords>0);
  assert.ok(make('kingsroad').landsStats.roads>make('crownlands').landsStats.roads);
});

test('Water and mountains block troops while their bridges, fords and passes allow crossing',()=>{
  assert.equal(isPassableTile(null),false);
  for(const terrain of ['water','mountain']){assert.equal(isPassableTile({terrain}),false);assert.equal(tileTravelCost({terrain}),Infinity);}
  for(const [terrain,feature]of [['water','bridge'],['water','ford'],['mountain','pass']])assert.ok(isPassableTile({terrain,feature}));
  for(const terrain of ['grass','forest','hill'])assert.ok(isPassableTile({terrain}));
});

test('Designed bridges offer five real walkable lanes across the river and onto both approaches',()=>{
  for(const map of LAND_MAPS.filter(m=>m.id!=='open'))for(const seed of [1,44277,914553]){
    const g=make(map.id,112,96,seed);
    for(const l of g.landmarks.filter(l=>l.kind==='bridge'&&l.name!=='Old Stone Crossing')){
      assert.equal(l.width,5);
      const cx=Math.floor(l.x),cy=Math.floor(l.y),half=Math.ceil(l.length/2)+2;
      for(let lane=-2;lane<=2;lane++)for(let along=-half;along<=half;along++){
        const x=cx+(l.axis==='x'?along:lane),y=cy+(l.axis==='x'?lane:along),t=g.tiles[y*g.W+x];
        assert.ok(isPassableTile(t),`${map.id} seed${seed} ${l.name} lane${lane} step${along}`);
      }
    }
  }
});

test('Roads reward movement and heavy troops pay more for woods, slopes and shallow fords',()=>{
  const grass={terrain:'grass'},road={terrain:'grass',feature:'road'},forest={terrain:'forest'},hill={terrain:'hill'},ford={terrain:'water',feature:'ford'};
  assert.ok(tileTravelCost(road)<tileTravelCost(grass));
  assert.ok(tileTravelCost(forest,'cavalry')>tileTravelCost(forest,'infantry'));
  assert.ok(tileTravelCost(hill,'siege')>tileTravelCost(hill,'infantry'));
  assert.ok(tileTravelCost(ford,'siege')>tileTravelCost(ford,'infantry'));
  assert.ok(tileTravelCost({terrain:'water',feature:'bridge'})<tileTravelCost(ford));
});

test('Open Realm preserves the existing terrain, and invalid map ids safely select Crownlands',()=>{
  const g={W:12,H:12,config:{landscape:'open',seed:2},tiles:[]};
  for(let y=0;y<12;y++)for(let x=0;x<12;x++)g.tiles.push({x,y,terrain:x===0||y===0||x===11||y===11?'water':x%2?'forest':'hill'});
  const before=g.tiles.map(t=>t.terrain);generateLands(g);assert.deepEqual(g.tiles.map(t=>t.terrain),before);assert.equal(g.landmarks.length,0);
  assert.equal(make('unrecognized').landscape.id,'crownlands');
});

console.log(`${cases} lands generation checks passed.`);
