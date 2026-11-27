(function (root) {
  'use strict';

  // Simulate each pilot’s deployed creatures, special projectiles and bounded effects.
  function enemyOverlapsSweep(enemy, x, y, angle, radius, halfAngle, enemyRadius) {
    const dx = enemy.x - x;
    const dy = enemy.y - y;
    const distance = Math.hypot(dx, dy);
    if (distance > radius + enemyRadius) return false;
    if (distance <= enemyRadius) return true;
    const facing = (dx * Math.cos(angle) + dy * Math.sin(angle)) / distance;
    const clearance = Math.asin(Math.min(1, enemyRadius / distance));
    return facing >= Math.cos(halfAngle + clearance);
  }

  function segmentHitDistance(enemy, x, y, dx, dy, length, radius) {
    const offsetX = enemy.x - x;
    const offsetY = enemy.y - y;
    const forward = offsetX * dx + offsetY * dy;
    const side = offsetX * dy - offsetY * dx;
    const gap = radius * radius - side * side;
    if (gap < 0) return Infinity;
    const chord = Math.sqrt(gap);
    if (forward + chord < 0 || forward - chord > length) return Infinity;
    return Math.max(0, forward - chord);
  }

  const weaponIds = new Set(['cat-spawner', 'cat-launcher', 'catana', 'unicorn-sniper', 'unicorn-stream', 'rainbow-laser', 'rainbow-exploder']);
  const sweepHalfAngle = Math.PI * 0.39;
  const sweepRadius = 128;
  const catsPerOwner = 4;
  const projectileLimit = 60;
  const effectsLimit = 36;

  class CreatureCombat {
    constructor({ enemies, damageEnemy, clearLine = () => true, movementRay, isAlive = enemy => enemy.hp > 0, radius = enemy => enemy.radius ?? enemy.r ?? 16, limitRay = (_x, _y, _dx, _dy, range) => range }) {
      this.enemies = enemies;
      this.clearLine = clearLine;
      this.movementRay = movementRay || limitRay;
      this.damageEnemy = damageEnemy;
      this.isAlive = isAlive;
      this.radius = radius;
      this.limitRay = limitRay;
      this.reset();
    }

    reset() {
      this.stations = [];
      this.cats = [];
      this.projectiles = [];
      this.effects = [];
      this.beams = new Map();
      this.streamPhase = new Map();
    }

    fire({ id, owner, w, x, y, angle, damage, push, range, speed, penetration = 0, deploy, deployLife = 1, blastScale = 1, first, last, color, firstMark }) {
      if (!weaponIds.has(id)) return false;
      const attack = { id, owner, w, x, y, angle, damage, push, deploy, deployLife, first, last, color, firstMark };
      switch (id) {
        case 'cat-spawner':
          this.deploy(attack);
          break;
        case 'cat-launcher':
          this.addShot(attack, 'cat', speed, 11, range / speed, 0, 46 * blastScale);
          break;
        case 'catana':
          this.sweep(attack);
          this.addShot({ ...attack, damage: damage * 0.42 }, 'cat', speed, 8, range / speed);
          break;
        case 'unicorn-sniper':
          this.trace(attack, range, 5, 3 + Math.max(0, penetration));
          break;
        case 'unicorn-stream': {
          const phase = ((this.streamPhase.get(owner) ?? -1) + 1) % 12;
          this.streamPhase.set(owner, phase);
          this.addShot({ ...attack, angle: angle + Math.sin(phase * Math.PI / 3) * 0.15 }, 'unicorn', speed, 7, range / speed, penetration);
          break;
        }
        case 'rainbow-laser':
          this.trace(attack, range, 12, Infinity);
          break;
        case 'rainbow-exploder':
          this.addShot(attack, 'shell', speed, 10, range / speed, 0, 108 * blastScale);
          break;
      }
      return true;
    }

    deploy(attack) {
      const directionX = Math.cos(attack.angle);
      const directionY = Math.sin(attack.angle);
      const distance = Math.max(0, this.movementRay(attack.x, attack.y, directionX, directionY, 68) - 6);
      const oldStation = this.stations.findIndex(station => station.owner === attack.owner);
      if (oldStation >= 0) this.stations.splice(oldStation, 1);
      const station = { ...attack, x: attack.x + directionX * distance, y: attack.y + directionY * distance, age: 0, nextCat: 0.85, remainingCats: 2 };
      if(attack.deploy && this.canDeploy(attack,attack.deploy)){
        station.x = attack.deploy.x;
        station.y = attack.deploy.y;
      }
      this.stations.push(station);
      this.spawnCat(station);
    }

    canDeploy(from,to) {
      const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy);
      return !length || this.movementRay(from.x,from.y,dx/length,dy/length,length)>=length;
    }

    spawnCat(station) {
      const owned = this.cats.filter(cat => cat.owner === station.owner);
      if (owned.length >= catsPerOwner) this.cats.splice(this.cats.indexOf(owned[0]), 1);
      const angle = station.angle + 0.86 * (station.remainingCats - 1);
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      const distance = this.movementRay(station.x, station.y, dx, dy, 22);
      this.cats.push({
        ...station,
        owner: station.owner, id: station.id, damage: station.damage,
        x: station.x + dx * distance, y: station.y + dy * distance,
        angle, age: 0, bite: 0, retarget: 0, target: null
      });
    }

    sweep(attack) {
      const { x, y, angle } = attack;
      const targets = this.enemies().filter(enemy => this.isAlive(enemy)
        && enemyOverlapsSweep(enemy, x, y, angle, sweepRadius, sweepHalfAngle, this.radius(enemy)) && this.clearLine(attack,enemy));
      for (const enemy of targets) {
        if (!this.isAlive(enemy)) continue;
        this.damageEnemy(enemy, attack.damage * 1.5, attack);
      }
      this.addEffect({ type: 'sweep', x, y, angle, age: 0, life: 0.24 });
    }

    trace(attack, range, width, limit) {
      const { x, y, angle, id } = attack;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      let length = this.limitRay(x, y, dx, dy, range);
      const hits = this.contacts(x, y, dx, dy, length, width);
      if (Number.isFinite(limit)) hits.sort((left, right) => left.distance - right.distance);
      let hitCount = 0;
      for (const { enemy, distance } of hits) {
        if (!this.isAlive(enemy)) continue;
        this.damageEnemy(enemy, attack.damage * (id==='unicorn-sniper' ? .82 ** hitCount : 1), attack);
        if (++hitCount >= limit) {
          length = Math.min(length, distance + width + this.radius(enemy));
          break;
        }
      }
      const effect = { type: id, x, y, dx, dy, angle, length, width, age: 0, life: id === 'rainbow-laser' ? 0.15 : 0.18 };
      if (id === 'rainbow-laser') this.beams.set(attack.owner, effect);
      else this.addEffect(effect);
    }

    addShot(attack, type, speed, radius, life, penetration = 0, blast = 0) {
      if (this.projectiles.length >= projectileLimit) this.projectiles.shift();
      this.projectiles.push({ ...attack, type, speed, radius, life, penetration: Math.max(0, penetration), blast, hit: [], age: 0,
        dx: Math.cos(attack.angle), dy: Math.sin(attack.angle) });
    }

    addEffect(effect) {
      if (this.effects.length >= effectsLimit) this.effects.shift();
      this.effects.push(effect);
    }

    contacts(x, y, dx, dy, length, radius, alreadyHit = []) {
      const hits = [];
      const origin = {x,y};
      for (const enemy of this.enemies()) {
        if (!this.isAlive(enemy) || alreadyHit.includes(enemy)) continue;
        const distance = segmentHitDistance(enemy, x, y, dx, dy, length, radius + this.radius(enemy));
        if (Number.isFinite(distance) && this.clearLine(origin,enemy)) hits.push({ enemy, distance });
      }
      return hits;
    }

    explode(shot, impact) {
      const targets = [];
      for (const enemy of this.enemies()) {
        if (!this.isAlive(enemy) || enemy === impact) continue;
        const distance = Math.hypot(enemy.x - shot.x, enemy.y - shot.y);
        if (distance <= shot.blast + this.radius(enemy) && this.clearLine(shot,enemy)) {
          targets.push({ enemy, strength: Math.max(0.5, 1 - distance / (2 * shot.blast)) });
        }
      }
      for (const { enemy, strength } of targets) {
        if (this.isAlive(enemy)) this.damageEnemy(enemy, shot.damage * strength, shot);
      }
      this.addEffect({ type: shot.type === 'shell' ? 'blast' : 'catImpact', x: shot.x, y: shot.y, radius: shot.blast, life: 0.37, age: 0 });
    }

    moveShot(shot, dt) {
      const travelTime = Math.min(dt, shot.life);
      const travel = shot.speed * travelTime;
      const path = this.limitRay(shot.x, shot.y, shot.dx, shot.dy, travel);
      const hits = this.contacts(shot.x, shot.y, shot.dx, shot.dy, path, shot.radius, shot.hit);
      hits.sort((left, right) => left.distance - right.distance);
      for (const { distance, enemy } of hits) {
        if (!this.isAlive(enemy)) continue;
        this.damageEnemy(enemy, shot.damage, shot);
        if (shot.penetration-- <= 0) {
          shot.x += shot.dx * distance;
          shot.y += shot.dy * distance;
          if (shot.blast) this.explode(shot, enemy);
          return false;
        }
        shot.hit.push(enemy);
      }
      shot.x += shot.dx * path;
      shot.y += shot.dy * path;
      shot.age += travelTime;
      shot.life -= dt;
      if (shot.life > 0 && path >= travel) return true;
      if (shot.type === 'shell') this.explode(shot);
      return false;
    }

    moveCat(cat, dt) {
      cat.age += dt;
      cat.bite -= dt;
      cat.retarget -= dt;
      if (cat.retarget <= 0 || (cat.target && !this.isAlive(cat.target))) {
        let nearest = 430 * 430;
        cat.target = null;
        cat.retarget = 0.16;
        for (const enemy of this.enemies()) {
          if (!this.isAlive(enemy)) continue;
          const square = (cat.x - enemy.x) ** 2 + (cat.y - enemy.y) ** 2;
          if (square >= nearest || !this.clearLine(cat,enemy)) continue;
          cat.target = enemy;
          nearest = square;
        }
      }
      if (!cat.target) return;
      const dx = cat.target.x - cat.x;
      const dy = cat.target.y - cat.y;
      const distance = Math.hypot(dx, dy);
      const biteRange = this.radius(cat.target) + 12;
      if (distance > biteRange) {
        cat.angle = Math.atan2(dy, dx);
        const step = this.movementRay(cat.x, cat.y, dx / distance, dy / distance, Math.min(distance - biteRange, 282 * dt));
        cat.x += dx * step / distance;
        cat.y += dy * step / distance;
      } else if (cat.bite <= 0 && this.clearLine(cat,cat.target)) {
        cat.bite = 0.38;
        this.damageEnemy(cat.target, cat.damage, cat);
      }
    }

    update(dt) {
      for (const station of this.stations) {
        station.age += dt;
        while (station.remainingCats > 0 && station.age >= station.nextCat) {
          station.remainingCats--;
          station.nextCat += 0.85;
          this.spawnCat(station);
        }
      }
      this.stations = this.stations.filter(station => station.age < 4.8 * station.deployLife);
      for (const cat of this.cats) this.moveCat(cat, dt);
      this.cats = this.cats.filter(cat => cat.age < 5.4 * cat.deployLife);
      this.projectiles = this.projectiles.filter(shot => this.moveShot(shot, dt));
      for (const effect of this.effects) effect.age += dt;
      this.effects = this.effects.filter(effect => effect.age < effect.life);
      for (const [owner, effect] of this.beams) {
        effect.age += dt;
        if (effect.age >= effect.life) this.beams.delete(owner);
      }
    }

    draw(ctx, art = root.CinderCreatureArt) {
      if (!art) return;
      for (const station of this.stations) art.drawCatSpawner(ctx, station.x, station.y, 1, station.age * 4);
      for (const cat of this.cats) art.drawCat(ctx, cat.x, cat.y, 0.7, cat.angle, cat.age * 19);
      for (const shot of this.projectiles) {
        if (shot.type === 'cat') art.drawCat(ctx, shot.x, shot.y, shot.radius / 11, shot.angle, shot.age * 25);
        if (shot.type === 'unicorn') art.drawUnicorn(ctx, shot.x, shot.y, 0.62, shot.angle, shot.age * 18);
        if (shot.type === 'shell') art.drawRainbowShell(ctx, shot.x, shot.y, shot.angle, shot.radius);
      }
      for (const effect of this.effects) {
        const progress = effect.age / effect.life;
        const { x, y, angle, length, dx, dy } = effect;
        if (effect.type === 'sweep') art.drawSweep(ctx, x, y, angle, sweepRadius, sweepHalfAngle, progress);
        if (effect.type === 'blast') art.drawBlast(ctx, x, y, effect.radius, progress);
        if (effect.type === 'unicorn-sniper') {
          ctx.save();
          ctx.globalAlpha *= 1 - progress;
          ctx.strokeStyle = '#b9f7ff';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + dx * length, y + dy * length);
          ctx.stroke();
          const boltDistance = Math.min(1, progress * 1.55) * length;
          art.drawSniperBolt(ctx, x + dx * boltDistance, y + dy * boltDistance, angle, 6);
          ctx.restore();
        }
        if (effect.type === 'catImpact') {
          ctx.save();
          ctx.globalAlpha *= 0.9 * (1 - progress);
          ctx.strokeStyle = '#ffbe66';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, effect.radius * (0.25 + 0.75 * progress), 0, 2 * Math.PI);
          ctx.stroke();
          ctx.restore();
        }
      }
      for (const beam of this.beams.values()) {
        art.drawBeam(ctx, beam.x, beam.y, beam.x + beam.dx * beam.length, beam.y + beam.dy * beam.length, 2 * beam.width, 1 - beam.age / beam.life);
      }
    }
  }

  root.CinderCreatureCombat = CreatureCombat;
})(globalThis);
