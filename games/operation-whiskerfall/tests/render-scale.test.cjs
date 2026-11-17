'use strict';
const assert = require('node:assert/strict');
global.window = {OW: {}};
global.devicePixelRatio = 1;
require('../js/world/renderer.js');
const viewport = {width:1920, height:1080};
const renderer = Object.assign(Object.create(window.OW.Renderer.prototype), {
  game: {settings:{resolution:'auto', quality:'high'}},
  canvas: {getBoundingClientRect:()=>viewport}, ctx:{}
});
function frames(duration, ms, active=true){
  for(let time=0;time<duration;time+=ms)renderer.updateRenderScale(ms, active);
}
renderer.resize();
assert.equal(renderer.canvas.width,1920);
frames(1000,33);
assert.equal(renderer.canvas.width,1920);
frames(25000,33);
assert.equal(renderer.canvas.width,1280);
assert.equal(renderer.width,1920);
assert.equal(renderer.height,1080);
frames(30000,16.7,false);
assert.equal(renderer.canvas.width,1280);
frames(70000,16.7);
assert.equal(renderer.canvas.width,1920);
renderer.game.settings.resolution='1280';
renderer.resize();
frames(20000,16.7);
assert.equal(renderer.canvas.width,1280);
assert.equal(renderer.canvas.height,720);
viewport.width=960;viewport.height=540;renderer.resize();
assert.equal(renderer.canvas.width,960);
renderer.game.settings.resolution='auto';renderer.resize();
frames(30000,40);
assert.equal(renderer.canvas.width,960);
console.log('PASS · fixed resolution, sustained frame pacing, recovery, pause and CSS-space camera dimensions');
