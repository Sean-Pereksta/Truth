import assert from 'node:assert/strict';
import {Game} from '../../core.js';
import {LAND_MAPS,generateLands,isPassableTile} from '../../lands.js';

let cases=0;
const test=(name,fn)=>{fn();cases++;console.log('PASS '+name);};
const additions=['twin-lakes','mountain-crown','four-rivers'];
function terrain(landscape,W=112,H=96,seed=44277){
  const g={W,H,config:{landscape,seed},tiles:[],random(){throw Error('Map generation must not consume combat randomness.');}};
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)g.tiles.push({x,y,terrain:x===0||y===0||x===W-1||y===H-1?'water':'grass',height:0,value:1});
  generateLands(g);return g;
}

test('The map chooser includes three additional battlefield designs with distinct strategic descriptions',()=>{
  assert.equal(LAND_MAPS.length,9);
  for(const id of additions){const map=LAND_MAPS.find(m=>m.id===id);assert.ok(map&&map.label&&map.description.length>80);}
});

test('Twin Lakes places substantial water on both flanks while leaving the central lane open',()=>{
  const g=terrain('twin-lakes'),water=(x0,x1)=>g.tiles.filter(t=>t.x>=x0&&t.x<=x1&&t.y>g.H*.27&&t.y<g.H*.73&&t.terrain==='water'&&!isPassableTile(t)).length;
  assert.ok(water(g.W*.12,g.W*.38)>160);assert.ok(water(g.W*.62,g.W*.88)>160);
  assert.ok(g.landmarks.some(l=>l.name==='Westmere Causeway'));assert.ok(g.landmarks.some(l=>l.name==='Eastmere Causeway'));
  assert.ok(g.tiles.filter(t=>t.x>g.W*.44&&t.x<g.W*.56&&t.y>2&&t.y<g.H-3).every(isPassableTile));
});

test('Mountain Crown encircles a clear valley with peaks and named passageways',()=>{
  const g=terrain('mountain-crown'),mountains=g.tiles.filter(t=>t.terrain==='mountain'&&!isPassableTile(t));
  assert.ok(mountains.length>300);assert.ok(mountains.some(t=>t.x<g.W/2));assert.ok(mountains.some(t=>t.x>g.W/2));assert.ok(mountains.some(t=>t.y<g.H/2));assert.ok(mountains.some(t=>t.y>g.H/2));
  assert.ok(g.landmarks.filter(l=>/Crown Gate/.test(l.name)).length>=3);assert.ok(g.landsStats.passes>20);
});

test('Four Rivers has four independently named bridge approaches to its central arena',()=>{
  const g=terrain('four-rivers');
  for(const direction of ['North','South','West','East'])assert.ok(g.landmarks.some(l=>l.name===direction+' River Bridge'),direction);
  const arms=[t=>Math.abs(t.x-g.W*.5)<g.W*.15&&t.y<g.H*.38,t=>Math.abs(t.x-g.W*.5)<g.W*.15&&t.y>g.H*.62,t=>Math.abs(t.y-g.H*.5)<5&&t.x<g.W*.38,t=>Math.abs(t.y-g.H*.5)<5&&t.x>g.W*.62];
  for(const region of arms)assert.ok(g.tiles.filter(t=>t.terrain==='water'&&region(t)).length>40,'Every outer arm retains its water barrier between the clear opening fields.');
});

test('New battlefields retain an unobstructed central objective area at every scale and seed',()=>{
  for(const landscape of additions)for(const [W,H]of [[112,96],[160,128],[224,176]])for(const seed of [1,44277,914553]){
    const g=terrain(landscape,W,H,seed),radius=Math.min(W,H)*.09;
    for(const tile of g.tiles)if((tile.x+.5-W*.5)**2+(tile.y+.5-H*.5)**2<=radius*radius)assert.ok(isPassableTile(tile),`${landscape} ${W} central tile ${tile.x},${tile.y}`);
  }
});

test('Real four-army and sixteen-house campaigns retain sparse ruins, safe openings and reachable objectives',()=>{
  for(const landscape of additions)for(const scale of ['standard','epic','continent'])for(const enemies of [3,15]){
    const g=new Game({landscape,scale,enemies,mode:'conquest',seed:44277});
    assert.equal(g.teams.length,enemies+1);assert.equal(g.castles.filter(c=>c.ruined).length,{standard:3,epic:5,continent:6}[scale],landscape+' '+scale);
    for(const s of g.teams){assert.ok(g.group(s.id).length>=60);assert.ok(g.group(s.id).every(u=>g.isWalkable(u.x,u.y)),'Opening soldiers must stand on usable land.');}
    for(const objective of [...g.objectives,...g.castles.filter(c=>c.ruined)])assert.ok(g.navigation.route(g.teams[0].home,objective).reachable,landscape+' '+scale+' objective');
  }
});

console.log(`${cases} battlefield variety checks passed.`);
