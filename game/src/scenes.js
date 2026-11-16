// The screenshot scenes behind ?shot=title|play|win|over. Each one plays
// the real rules forward from a fresh game for a fixed number of ticks,
// steered by a simple autopilot (chase the nearest gem, keep the nearest
// foe in the sights, dash out when one closes in), so every frame is what
// a real game looks like and the same seed always gives the same frame.
// The play scene stops on the upgrade draft after wave 1 clears, showing
// the v2 feature; the win scene picks the first offered upgrade each wave.

import { ARENA, SHIP, TICK } from './tuning.js';
import { EV_OVER, EV_WIN } from './engine.js';
import { VIEW_OVER, VIEW_PLAY, VIEW_TITLE, VIEW_UPGRADE, VIEW_WIN } from './painter.js';

const TITLE_SECONDS = 6;
const PLAY_LIMIT_SECONDS = 300;
const WIN_LIMIT_SECONDS = 900;
const OVER_LIMIT_SECONDS = 300;
const ACTION_LIMIT_SECONDS = 600;

/** Fight forward until the wave-5 boss fight is at its busiest, then freeze. */
function playToBossFight(sim) {
  const steps = Math.floor(ACTION_LIMIT_SECONDS / TICK);
  for (let i = 0; i < steps; i += 1) {
    const g = sim.game;
    if (g.phase === 'upgrade') {
      sim.chooseUpgrade(0);
      continue;
    }
    const events = sim.step(TICK, autopilot(g), false);
    if (events & (EV_OVER | EV_WIN)) return events;
    // The Herald is out, its radial burst is in flight, the swarm is
    // thick and the skiff is firing: the busiest honest frame of the game.
    if (
      g.wave === 5 && g.phase === 'fight' && g.boss &&
      g.foes.length >= 8 && g.foeShots.length >= 8 && g.bullets.length >= 3
    ) {
      return 'action';
    }
  }
  return 0;
}

function nearestOf(list, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const item of list) {
    const d = Math.hypot(item.x - x, item.y - y);
    if (d < bestD) {
      bestD = d;
      best = item;
    }
  }
  return { item: best, distance: bestD };
}

function autopilot(g) {
  const ship = g.ship;
  const { item: foe, distance: foeD } = nearestOf(g.foes, ship.x, ship.y);
  const { item: gem } = nearestOf(g.gemsArr, ship.x, ship.y);
  let tx = ARENA.w / 2;
  let ty = ARENA.h / 2;
  let dash = false;
  if (foe && foeD < 110) {
    // Too close: break away from the threat first, gems can wait.
    const dx = ship.x - foe.x;
    const dy = ship.y - foe.y;
    const d = Math.hypot(dx, dy) || 1;
    tx = ship.x + (dx / d) * 220;
    ty = ship.y + (dy / d) * 220;
    dash = foeD < 70;
  } else if (gem) {
    tx = gem.x;
    ty = gem.y;
  } else if (foe) {
    // Hold a firing distance of about 260 from the nearest foe.
    const dx = ship.x - foe.x;
    const dy = ship.y - foe.y;
    const d = Math.hypot(dx, dy) || 1;
    tx = foe.x + (dx / d) * 260;
    ty = foe.y + (dy / d) * 260;
  }
  const dx = tx - ship.x;
  const dy = ty - ship.y;
  const d = Math.hypot(dx, dy);
  const move = d < 12 ? { x: 0, y: 0 } : { x: dx / d, y: dy / d };
  const aim = foe ? Math.atan2(foe.y - ship.y, foe.x - ship.x) : ship.aim;
  return { mx: move.x, my: move.y, aim, fire: Boolean(foe), dash };
}

/** Run the game forward for up to `seconds`, steered by the autopilot. */
function playForward(sim, seconds, idle, pickUpgrades) {
  const steps = Math.floor(seconds / TICK);
  for (let i = 0; i < steps; i += 1) {
    const g = sim.game;
    if (g.phase === 'upgrade') {
      if (pickUpgrades) sim.chooseUpgrade(0);
      else return 'upgrade';
    }
    const ctl = idle
      ? { mx: 0, my: 0, aim: g.ship.aim, fire: false, dash: false }
      : autopilot(g);
    const events = sim.step(TICK, ctl, false);
    if (events & (EV_OVER | EV_WIN)) return events;
    if (g.phase === 'upgrade' && !pickUpgrades) return 'upgrade';
  }
  return 0;
}

/**
 * Set `sim` to the named scene (title, play, win or over; any other name is
 * title) and return the view to draw over it and the best score to show.
 */
export function stageScene(name, sim) {
  sim.reset();
  const g = sim.game;
  if (name === 'title') {
    // Drift the ambient world a little so the title sits over live starfield.
    for (let i = 0; i < TITLE_SECONDS / TICK; i += 1) {
      sim.step(TICK, { mx: 0, my: 0, aim: -Math.PI / 2, fire: false, dash: false }, true);
    }
    return { view: VIEW_TITLE, best: 1250 };
  }
  if (name === 'play') {
    // Clear wave 1 with the autopilot, then stop on the upgrade draft.
    g.ship.maxHull = 5;
    g.ship.hull = 5;
    sim.startWave(1);
    playForward(sim, PLAY_LIMIT_SECONDS, false, false);
    return { view: VIEW_UPGRADE, best: 1250 };
  }
  if (name === 'action') {
    // The cover frame: fight waves 1-4 with the autopilot (taking the
    // first offered upgrade each time, like the win scene), then freeze
    // mid-combat in the wave-5 boss fight — full HUD, Herald, swarm,
    // radial burst, bullets, motes and gems all on screen at once.
    g.ship.maxHull = 5;
    g.ship.hull = 5;
    sim.startWave(1);
    playToBossFight(sim);
    return { view: VIEW_PLAY, best: Math.max(1250, g.score) };
  }
  if (name === 'win') {
    // The victory scene plays all ten waves; the pilot flies a reinforced
    // hull (the same reinforcement the game grants every third wave) and
    // takes the first offered upgrade each time, so a long staged run
    // survives to the win screen.
    g.ship.maxHull = 5;
    g.ship.hull = 5;
    sim.startWave(1);
    const events = playForward(sim, WIN_LIMIT_SECONDS, false, true);
    return { view: events === EV_WIN || (events & EV_WIN) ? VIEW_WIN : VIEW_PLAY, best: Math.max(1250, g.score) };
  }
  // Over: the pilot idles, so the swarm catches the skiff quickly.
  sim.startWave(1);
  playForward(sim, OVER_LIMIT_SECONDS, true, false);
  return { view: VIEW_OVER, best: Math.max(1250, g.score) };
}
