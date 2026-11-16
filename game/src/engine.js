// NOVA HARVEST v2 — the simulation. A plain object holds the whole run:
// the skiff, the live entities, the wave director and the upgrade state.
// It advances in fixed ticks and reports what happened as a bitmask, so the
// boot loop and the screenshot stager share exactly the same rules.
//
// Phases: 'intro' (breather before a wave) → 'fight' → 'upgrade' (pick 1
// of 3, then back to 'intro') → … → 'won' when wave 10 clears.

import { ARENA, COMBO, DIRECTOR, FINAL_WAVE, FOES, GEM, SHIP, TICK } from './tuning.js';
import { rollChoices } from './upgrades.js';

export const EV_HIT = 1;
export const EV_OVER = 2;
export const EV_CLEAR = 4;
export const EV_WIN = 8;
export const EV_PICKUP = 16;
export const EV_BOSS = 32;
export const EV_UPGRADE = 64;

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

export function createGame(rng) {
  const game = {
    rng,
    time: 0,
    score: 0,
    best: 0,
    combo: 0,
    comboLeft: 0,
    kills: 0,
    gems: 0,
    shots: 0,
    hits: 0,
    wave: 0,
    phase: 'intro',
    phaseLeft: 1.2,
    queue: [],
    spawnIn: 0,
    banner: '',
    bannerLeft: 0,
    shake: 0,
    flash: 0,
    victory: false,
    endless: false,
    ship: null,
    mods: null,
    choices: [],
    chosen: [],
    boss: null,
    bullets: [],
    foeShots: [],
    foes: [],
    gemsArr: [],
    motes: [],
    texts: [],
    drops: [],
  };

  function freshShip() {
    return {
      x: ARENA.w / 2, y: ARENA.h / 2, vx: 0, vy: 0, aim: -Math.PI / 2,
      hull: SHIP.hull, maxHull: SHIP.hull, fireIn: 0,
      dashLeft: 0, dashIn: 0, dashX: 0, dashY: 0, invuln: 0, alive: true,
    };
  }

  function freshMods() {
    return { fire: 1, spread: 1, dashCd: 1, magnet: 1, gemValue: 1, shotSpeed: 1 };
  }

  function reset() {
    game.time = 0;
    game.score = 0;
    game.combo = 0;
    game.comboLeft = 0;
    game.kills = 0;
    game.gems = 0;
    game.shots = 0;
    game.hits = 0;
    game.wave = 0;
    game.phase = 'intro';
    game.phaseLeft = 1.2;
    game.queue = [];
    game.spawnIn = 0;
    game.banner = '';
    game.bannerLeft = 0;
    game.shake = 0;
    game.flash = 0;
    game.victory = false;
    game.endless = false;
    game.ship = freshShip();
    game.mods = freshMods();
    game.choices = [];
    game.chosen = [];
    game.boss = null;
    game.bullets = [];
    game.foeShots = [];
    game.foes = [];
    game.gemsArr = [];
    game.motes = [];
    game.texts = [];
    game.drops = [];
  }

  function mote(x, y, color, count, speed, size = 3) {
    for (let i = 0; i < count; i += 1) {
      const a = rng.range(0, Math.PI * 2);
      const v = rng.range(speed * 0.3, speed);
      game.motes.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: rng.range(0.3, 0.8), max: 0.8, size: rng.range(size * 0.5, size * 1.4), color,
      });
    }
    if (game.motes.length > 500) game.motes.splice(0, game.motes.length - 500);
  }

  function say(x, y, text, color) {
    // Once the sector is cleared the victory screen is showing: no new
    // floating score text, so nothing can drift over its summary lines.
    if (game.phase === 'won') return;
    game.texts.push({ x, y, text, life: 1.1, color });
    if (game.texts.length > 40) game.texts.shift();
  }

  function bank(base, x, y) {
    const mult = 1 + Math.min(game.combo, COMBO.cap) * COMBO.perKill;
    const gained = Math.round(base * mult);
    game.score += gained;
    if (x !== undefined) say(x, y, `+${gained}`, mult > 1.4 ? '#ffd166' : '#eef2ff');
    return gained;
  }

  function edgePoint() {
    const m = 40;
    switch (rng.int(0, 3)) {
      case 0: return { x: rng.range(m, ARENA.w - m), y: m };
      case 1: return { x: rng.range(m, ARENA.w - m), y: ARENA.h - m };
      case 2: return { x: m, y: rng.range(m, ARENA.h - m) };
      default: return { x: ARENA.w - m, y: rng.range(m, ARENA.h - m) };
    }
  }

  function spawnFoe(kind) {
    if (game.foes.length >= 48) return;
    const spec = FOES[kind];
    const p = edgePoint();
    const foe = {
      kind, x: p.x, y: p.y, vx: 0, vy: 0,
      hp: spec.hp + (kind === 'herald' ? Math.floor(game.wave / 5) * 8 : Math.floor(game.wave / 4)),
      radius: spec.radius, score: spec.score, gems: spec.gems,
      speed: spec.speed + game.wave * 4,
      angle: rng.range(0, Math.PI * 2), phase: rng.range(0, Math.PI * 2),
      shootIn: rng.range(1.2, 2.4), flash: 0,
    };
    foe.maxHp = foe.hp;
    game.foes.push(foe);
    if (kind === 'herald') game.boss = foe;
  }

  function buildQueue(n) {
    const queue = [];
    const budget = 5 + n * 4;
    let spent = 0;
    let heraldUsed = false;
    while (spent < budget) {
      const roll = rng.next();
      let kind = 'mite';
      let cost = 1;
      if (n >= 2 && roll < 0.3) { kind = 'weaver'; cost = 2; }
      else if (n >= 3 && roll < 0.48) { kind = 'spitter'; cost = 2; }
      else if (n >= 5 && roll < 0.55 && !heraldUsed) { kind = 'herald'; cost = 6; heraldUsed = true; }
      queue.push(kind);
      spent += cost;
    }
    // The Herald only headlines waves 5 and 10; other waves stay a swarm.
    if (n !== 5 && n !== FINAL_WAVE) {
      for (let i = 0; i < queue.length; i += 1) if (queue[i] === 'herald') queue[i] = 'weaver';
    }
    return queue;
  }

  function startWave(n) {
    game.wave = n;
    game.queue = buildQueue(n);
    game.phase = 'fight';
    game.spawnIn = 0.4;
    game.banner = n === 1 ? 'WAVE 1 — HARVEST THE SHARDS' : `WAVE ${n}`;
    game.bannerLeft = 2.2;
    if (n === 5 || n === FINAL_WAVE) game.banner = `WAVE ${n} — THE VOID HERALD AWAKENS`;
  }

  /** Offer the upgrade choice and freeze the fight until one is picked. */
  function openUpgrades() {
    game.choices = rollChoices(rng, game);
    game.phase = 'upgrade';
    game.banner = 'WAVE CLEARED — CHOOSE AN UPGRADE';
    game.bannerLeft = 0;
  }

  /** Apply choice i (0–2) and open the breather before the next wave. */
  function chooseUpgrade(i) {
    const choice = game.choices[i];
    if (!choice || game.phase !== 'upgrade') return false;
    choice.apply(game);
    game.chosen.push(choice.id);
    game.choices = [];
    say(game.ship.x, game.ship.y - 30, `${choice.name} INSTALLED`, '#7dffb0');
    mote(game.ship.x, game.ship.y, '#7dffb0', 24, 220);
    game.phase = 'intro';
    game.phaseLeft = DIRECTOR.betweenWaves;
    return true;
  }

  function dropGems(x, y, count) {
    for (let i = 0; i < count; i += 1) {
      if (game.gemsArr.length >= 160) return;
      const a = rng.range(0, Math.PI * 2);
      game.gemsArr.push({
        x, y, vx: Math.cos(a) * rng.range(40, 140), vy: Math.sin(a) * rng.range(40, 140),
        life: GEM.life, spin: rng.range(0, Math.PI * 2),
      });
    }
  }

  function dropPickup(x, y) {
    if (game.drops.length >= 8) return;
    game.drops.push({
      kind: game.ship.hull < game.ship.maxHull && rng.next() < 0.6 ? 'repair' : 'shield',
      x, y, life: 10,
    });
  }

  function killFoe(foe) {
    game.foes.splice(game.foes.indexOf(foe), 1);
    game.kills += 1;
    game.combo += 1;
    game.comboLeft = COMBO.window;
    bank(foe.score, foe.x, foe.y - foe.radius - 8);
    mote(foe.x, foe.y, FOES[foe.kind].color, foe.kind === 'herald' ? 46 : 16, foe.kind === 'herald' ? 320 : 220);
    dropGems(foe.x, foe.y, foe.gems);
    if (foe.kind === 'herald') {
      game.boss = null;
      game.shake = Math.max(game.shake, 0.5);
      game.flash = 0.25;
      say(foe.x, foe.y - 60, 'HERALD DOWN  +1000', '#7dffb0');
      if (rng.next() < 0.8) dropPickup(foe.x, foe.y);
    } else if (rng.next() < 0.05) {
      dropPickup(foe.x, foe.y);
    }
  }

  function hurtShip() {
    const ship = game.ship;
    if (ship.invuln > 0 || ship.dashLeft > 0 || !ship.alive) return 0;
    ship.hull -= 1;
    ship.invuln = SHIP.graceAfterHit;
    game.combo = 0;
    game.comboLeft = 0;
    game.shake = Math.max(game.shake, 0.45);
    game.flash = 0.3;
    mote(ship.x, ship.y, '#ff5d73', 22, 280);
    if (ship.hull <= 0) {
      ship.alive = false;
      // Same as the victory screen: clear floating score texts so none
      // shows through the game-over overlay over the summary lines.
      game.texts = [];
      mote(ship.x, ship.y, '#4de8ff', 60, 380, 4);
      return EV_HIT | EV_OVER;
    }
    return EV_HIT;
  }

  function fireShot(angle) {
    if (game.bullets.length >= 128) return;
    const ship = game.ship;
    const speed = SHIP.shotSpeed * game.mods.shotSpeed;
    game.bullets.push({
      x: ship.x + Math.cos(angle) * (SHIP.radius + 6),
      y: ship.y + Math.sin(angle) * (SHIP.radius + 6),
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.9,
    });
    game.shots += 1;
  }

  function fireFoeShot(x, y, angle) {
    if (game.foeShots.length >= 96) return;
    game.foeShots.push({ x, y, vx: Math.cos(angle) * 210, vy: Math.sin(angle) * 210, life: 4 });
  }

  function tickFx(dt) {
    for (const p of game.motes) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.exp(-2 * dt);
      p.vy *= Math.exp(-2 * dt);
    }
    game.motes = game.motes.filter((p) => p.life > 0);
    for (const t of game.texts) {
      t.life -= dt;
      t.y -= 34 * dt;
    }
    game.texts = game.texts.filter((t) => t.life > 0);
  }

  /**
   * Advance one fixed tick. `ctl` is {mx, my, aim, fire, dash}; `attract`
   * runs the ambient title-screen drift with no threats. Returns an event
   * bitmask.
   */
  function step(dt, ctl, attract) {
    game.time += dt;
    let events = 0;
    const ship = game.ship;

    if (game.comboLeft > 0) {
      game.comboLeft -= dt;
      if (game.comboLeft <= 0) game.combo = 0;
    }
    if (game.bannerLeft > 0) game.bannerLeft -= dt;
    if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 1.4);
    if (game.flash > 0) game.flash = Math.max(0, game.flash - dt);
    if (ship.invuln > 0) ship.invuln -= dt;
    if (ship.dashIn > 0) ship.dashIn -= dt;

    // Ambient title drift: gems wander in so the title sits over live play.
    if (attract) {
      if (game.gemsArr.length < 14 && rng.next() < 0.02) {
        game.gemsArr.push({
          x: rng.range(60, ARENA.w - 60), y: rng.range(80, ARENA.h - 80),
          vx: rng.range(-24, 24), vy: rng.range(-24, 24),
          life: GEM.life, spin: rng.range(0, Math.PI * 2),
        });
      }
      for (const g of game.gemsArr) {
        g.x += g.vx * dt;
        g.y += g.vy * dt;
        g.spin += dt * 4;
      }
      tickFx(dt);
      return 0;
    }

    // During the upgrade choice the world holds still: motes drift, nothing else moves.
    if (game.phase === 'upgrade') {
      tickFx(dt);
      return 0;
    }

    // Wave director.
    if (game.phase === 'intro') {
      game.phaseLeft -= dt;
      if (game.phaseLeft <= 0) startWave(game.wave + 1);
    } else if (game.phase === 'fight') {
      if (game.queue.length > 0) {
        game.spawnIn -= dt;
        if (game.spawnIn <= 0) {
          spawnFoe(game.queue.shift());
          game.spawnIn = Math.max(0.18, DIRECTOR.spawnGap - game.wave * 0.03);
        }
      } else if (game.foes.length === 0) {
        const bonus = DIRECTOR.clearBonus * game.wave;
        game.score += bonus;
        game.banner = `WAVE ${game.wave} CLEARED  +${bonus}`;
        game.bannerLeft = 2.4;
        events |= EV_CLEAR;
        if (game.wave === FINAL_WAVE && !game.endless) {
          game.victory = true;
          game.phase = 'won';
          // Clear leftover floating score texts from the final kills: they
          // would otherwise show through the victory overlay and sit on
          // top of the SCORE / BEST summary line.
          game.texts = [];
          events |= EV_WIN;
        } else {
          if (game.wave % 3 === 0 && ship.maxHull < SHIP.maxHullCap) {
            ship.maxHull += 1;
            ship.hull = Math.min(ship.maxHull, ship.hull + 1);
            say(ship.x, ship.y - 30, 'HULL REINFORCED', '#7dffb0');
          }
          openUpgrades();
          events |= EV_UPGRADE;
        }
      }
    }

    // The skiff: thrust, dash, aim, fire.
    if (ship.alive) {
      if (ctl.dash && ship.dashIn <= 0 && ship.dashLeft <= 0 && (ctl.mx !== 0 || ctl.my !== 0)) {
        ship.dashLeft = SHIP.dashLength;
        ship.dashIn = SHIP.dashRecharge * game.mods.dashCd;
        ship.dashX = ctl.mx;
        ship.dashY = ctl.my;
        mote(ship.x, ship.y, '#4de8ff', 10, 160);
      }
      if (ship.dashLeft > 0) {
        ship.dashLeft -= dt;
        ship.vx = ship.dashX * SHIP.dashSpeed;
        ship.vy = ship.dashY * SHIP.dashSpeed;
      } else {
        ship.vx += ctl.mx * SHIP.thrust * dt;
        ship.vy += ctl.my * SHIP.thrust * dt;
        const speed = Math.hypot(ship.vx, ship.vy);
        if (speed > SHIP.topSpeed) {
          ship.vx = (ship.vx / speed) * SHIP.topSpeed;
          ship.vy = (ship.vy / speed) * SHIP.topSpeed;
        }
        const drag = Math.exp(-SHIP.drag * dt);
        ship.vx *= drag;
        ship.vy *= drag;
      }
      ship.x = Math.min(ARENA.w - SHIP.radius, Math.max(SHIP.radius, ship.x + ship.vx * dt));
      ship.y = Math.min(ARENA.h - SHIP.radius, Math.max(SHIP.radius, ship.y + ship.vy * dt));
      ship.aim = ctl.aim;
      ship.fireIn -= dt;
      if (ctl.fire && ship.fireIn <= 0) {
        ship.fireIn = SHIP.fireGap * game.mods.fire;
        const spread = game.mods.spread;
        const fan = 0.09;
        for (let i = 0; i < spread; i += 1) {
          const offset = spread === 1 ? 0 : (i - (spread - 1) / 2) * fan;
          fireShot(ship.aim + offset);
        }
      }
      if (Math.hypot(ship.vx, ship.vy) > 60 && rng.next() < 0.5) {
        game.motes.push({
          x: ship.x - Math.cos(ship.aim) * 18, y: ship.y - Math.sin(ship.aim) * 18,
          vx: -ship.vx * 0.12 + rng.range(-20, 20), vy: -ship.vy * 0.12 + rng.range(-20, 20),
          life: 0.35, max: 0.35, size: rng.range(2, 4), color: '#2fb9d8',
        });
      }
    }

    // Player shots vs foes.
    for (const b of [...game.bullets]) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > ARENA.w + 20 || b.y < -20 || b.y > ARENA.h + 20) {
        game.bullets.splice(game.bullets.indexOf(b), 1);
        continue;
      }
      for (const foe of [...game.foes]) {
        if (dist(b.x, b.y, foe.x, foe.y) < foe.radius + 4) {
          game.bullets.splice(game.bullets.indexOf(b), 1);
          foe.hp -= SHIP.shotDamage;
          foe.flash = 0.08;
          game.hits += 1;
          mote(b.x, b.y, '#aef3ff', 4, 120, 2);
          if (foe.hp <= 0) killFoe(foe);
          break;
        }
      }
    }

    // Foe shots vs the skiff.
    for (const b of [...game.foeShots]) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > ARENA.w + 20 || b.y < -20 || b.y > ARENA.h + 20) {
        game.foeShots.splice(game.foeShots.indexOf(b), 1);
        continue;
      }
      if (ship.alive && dist(b.x, b.y, ship.x, ship.y) < SHIP.radius + 5) {
        game.foeShots.splice(game.foeShots.indexOf(b), 1);
        events |= hurtShip();
      }
    }

    // Foes: each kind flies its own way.
    for (const foe of [...game.foes]) {
      if (foe.flash > 0) foe.flash -= dt;
      const dx = ship.x - foe.x;
      const dy = ship.y - foe.y;
      const d = Math.hypot(dx, dy) || 1;
      const nx = dx / d;
      const ny = dy / d;
      if (foe.kind === 'mite') {
        foe.vx += nx * foe.speed * 2.4 * dt;
        foe.vy += ny * foe.speed * 2.4 * dt;
        const s = Math.hypot(foe.vx, foe.vy);
        if (s > foe.speed) {
          foe.vx = (foe.vx / s) * foe.speed;
          foe.vy = (foe.vy / s) * foe.speed;
        }
        foe.angle = Math.atan2(foe.vy, foe.vx);
      } else if (foe.kind === 'weaver') {
        foe.phase += dt * 3;
        const perp = Math.atan2(dy, dx) + Math.PI / 2;
        foe.vx = nx * foe.speed + Math.cos(perp + foe.phase) * 90;
        foe.vy = ny * foe.speed + Math.sin(perp + foe.phase) * 90;
        foe.angle += dt * 2;
      } else if (foe.kind === 'spitter') {
        const want = 260;
        const toward = d > want + 40 ? 1 : d < want - 40 ? -1 : 0;
        foe.vx = nx * foe.speed * toward;
        foe.vy = ny * foe.speed * toward;
        foe.angle = Math.atan2(dy, dx);
        foe.shootIn -= dt;
        if (foe.shootIn <= 0 && d < 560 && ship.alive) {
          foe.shootIn = 2.1;
          fireFoeShot(foe.x, foe.y, Math.atan2(dy, dx));
        }
      } else {
        // The Herald drifts in and fires radial bursts, spawning mites.
        foe.vx = nx * foe.speed;
        foe.vy = ny * foe.speed;
        foe.angle += dt * 0.7;
        foe.shootIn -= dt;
        if (foe.shootIn <= 0 && ship.alive) {
          foe.shootIn = 2.6;
          for (let i = 0; i < 10; i += 1) fireFoeShot(foe.x, foe.y, (i / 10) * Math.PI * 2 + foe.angle);
          spawnFoe('mite');
          spawnFoe('mite');
        }
      }
      foe.x += foe.vx * dt;
      foe.y += foe.vy * dt;
      foe.x = Math.min(ARENA.w - foe.radius, Math.max(foe.radius, foe.x));
      foe.y = Math.min(ARENA.h - foe.radius, Math.max(foe.radius, foe.y));
      if (ship.alive && dist(foe.x, foe.y, ship.x, ship.y) < foe.radius + SHIP.radius - 4) {
        if (foe.kind !== 'herald') killFoe(foe);
        events |= hurtShip();
        if (events & EV_OVER) return events;
      }
    }

    // Starshards: drift, get magnetised, get collected.
    for (const g of [...game.gemsArr]) {
      g.life -= dt;
      if (g.life <= 0) {
        game.gemsArr.splice(game.gemsArr.indexOf(g), 1);
        continue;
      }
      g.spin += dt * 4;
      if (ship.alive) {
        const d = dist(g.x, g.y, ship.x, ship.y);
        const reach = SHIP.magnetReach * game.mods.magnet;
        if (d < reach) {
          const pull = 1 - d / reach;
          g.vx += ((ship.x - g.x) / (d || 1)) * 900 * pull * dt;
          g.vy += ((ship.y - g.y) / (d || 1)) * 900 * pull * dt;
        }
        if (d < SHIP.pickupReach) {
          game.gemsArr.splice(game.gemsArr.indexOf(g), 1);
          game.gems += 1;
          bank(Math.round(GEM.value * game.mods.gemValue), g.x, g.y);
          mote(g.x, g.y, '#ffd166', 5, 120, 2);
          events |= EV_PICKUP;
          continue;
        }
      }
      g.vx *= Math.exp(-1.5 * dt);
      g.vy *= Math.exp(-1.5 * dt);
      g.x += g.vx * dt;
      g.y += g.vy * dt;
    }

    // Pickups: repair hull or grant an Aegis shield.
    for (const p of [...game.drops]) {
      p.life -= dt;
      if (p.life <= 0) {
        game.drops.splice(game.drops.indexOf(p), 1);
        continue;
      }
      if (ship.alive && dist(p.x, p.y, ship.x, ship.y) < SHIP.radius + 14) {
        game.drops.splice(game.drops.indexOf(p), 1);
        if (p.kind === 'repair') {
          ship.hull = Math.min(ship.maxHull, ship.hull + 1);
          say(ship.x, ship.y - 30, 'HULL +1', '#7dffb0');
        } else {
          ship.invuln = Math.max(ship.invuln, 4);
          say(ship.x, ship.y - 30, 'AEGIS SHIELD 4s', '#4de8ff');
        }
        game.score += 50;
        events |= EV_PICKUP;
      }
    }

    tickFx(dt);
    return events;
  }

  reset();
  return { game, reset, step, startWave, chooseUpgrade, TICK };
}
