'use strict';
// node tools/profile-combat.cjs [game directory] [1280|1920] [fixed|auto]
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const width = Number(process.argv[3] || 1280);
const mode = process.argv[4] || 'fixed';
if (![1280, 1920].includes(width) || !['fixed', 'auto'].includes(mode)) {
  throw Error('Expected a width of 1280 or 1920 and a mode of fixed or auto.');
}
async function measure() {
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_PATH});
  try {
    const page = await browser.newPage({viewport:{width, height:width * 9 / 16}, deviceScaleFactor:1});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
    await page.waitForFunction(() => window.OW?.game?.ready);
    const sample = await page.evaluate(async ({width, mode}) => {
      const g = window.OW.game;
      if (!g.renderer.images.terrain) throw Error('Terrain artwork did not load.');
      g.frame = () => {}; // The fixture drives the same renderer on browser animation frames.
      g.start({coop:false});
      g.ui.hideMenu();
      let seed = 1839;
      Math.random = () => ((seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296);
      g.settings.resolution = mode === 'auto' ? 'auto' : String(width);
      g.settings.highContrastWarnings = true;
      g.settings.screenShake = false;
      g.settings.damageNumbers = false;
      g.renderer.resize();
      const backing = () => [g.canvas.width, g.canvas.height];
      const initialBacking = backing();
      const point = {x:16500, y:11180};
      g.players.push(g.newPlayer(1, 1));
      for (const p of g.players) {
        g.clearPlayerCombat(p);
        Object.assign(p, point, {level:15, hp:100000, maxHp:100000, ammo:12, reserve:5000, weapon:0, upgrade:3, angle:0});
      }
      g.players[1].y += 76;
      g.bulletPool.reset();
      g.effectPool.reset();
      g.world.activeEnemies = [];
      g.drops = [];
      g.allies = [];
      g.marker = null;
      g.camera = {...point, zoom:.93, shake:0};
      const roles = ['fencer', 'blinkstalker', 'cindermortar', 'prismsentry', 'roller', 'fencer'];
      roles.forEach((role, i) => {
        const type = OW.Content.enemies.findIndex(enemy => enemy.role === role);
        if (type < 0) throw Error('Missing role ' + role);
        const x = point.x + 90 + i*48, y = point.y - 30 + i%2*85;
        const enemy = g.world._createEnemy({id:'frame-fixture-'+i, type, x, y, homeX:x, homeY:y, level:15, region:4, patrol:0});
        g.world.activeEnemies.push(enemy);
        g.ensureEnemyScaling(enemy);
      });
      g.world._rebuildEnemyGrid();
      g.renderer.chunks.clear();
      const intervals = [], submissions = [], activity = [];
      const warmup = 45, frames = 180, dt = 1/60;
      let last;
      for (let i=0; i<warmup+frames; i++) {
        const now = await new Promise(requestAnimationFrame);
        const begin = performance.now(), delta = now-last;
        if (i) g.renderer.updateRenderScale?.(delta, true);
        g.time += dt;
        g.enemyFrame++;
        g.grid.clear();
        for (const e of g.world.activeEnemies) if (e.hp>0) g.grid.insert(e);
        for (const p of g.players) g.updatePlayer(p,{aimX:1, aimY:0, shoot:i%48<22 && !p.shootWasDown},dt);
        g.updateEnemies(dt);
        g.updateProjectiles(dt);
        g.updateEffects(dt);
        g.updateCamera(dt);
        g.renderer.draw(dt);
        g.ui.update();
        const cost = performance.now()-begin;
        if (i>=warmup) {
          intervals.push(delta);
          submissions.push(cost);
          activity.push(g.effects.filter(e=>e.alive).length+g.projectiles.filter(p=>p.alive).length);
        }
        last = now;
      }
      function stats(values) {
        const sorted = [...values].sort((a,b)=>a-b);
        const quantile = n => Number(sorted[Math.floor((sorted.length-1)*n)].toFixed(2));
        return {median:quantile(.5), p95:quantile(.95), max:quantile(1)};
      }
      return {width, height:innerHeight, mode, initialBacking, finalBacking:backing(), warmup, frames,
        point, roles, living:g.world.activeEnemies.filter(e=>e.hp>0).length,
        elapsedFrameMs:stats(intervals), submissionMs:stats(submissions), objects:stats(activity),
        over34ms:intervals.filter(ms=>ms>34).length};
    }, {width, mode});
    if (errors.length) throw Error(errors.join('\n'));
    console.log(JSON.stringify({browser:browser.version(), sample}));
  } finally {
    await browser.close();
  }
}
measure().catch(e=>{console.error(e);process.exitCode=1;});
