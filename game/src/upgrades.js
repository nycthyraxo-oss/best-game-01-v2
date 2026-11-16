// Between-wave upgrades — the v2 feature. When a wave is cleared (and the
// run is not won yet) the game pauses the fight and offers three of these;
// the player takes one with keys 1–3 or by clicking its card, then the next
// wave begins. Each upgrade can stack up to its `max`; maxed ones stop
// appearing. The painter and the boot loop share `cardBox` so a click on a
// painted card lands on the same rectangle the player sees.

import { ARENA, SHIP } from './tuning.js';

export const UPGRADE_POOL = [
  {
    id: 'hull', icon: '✚', name: 'REINFORCED HULL', max: 3,
    desc: '+1 max hull and repair 1 hull right now.',
    apply(game) {
      if (game.ship.maxHull < SHIP.maxHullCap) game.ship.maxHull += 1;
      game.ship.hull = Math.min(game.ship.maxHull, game.ship.hull + 1);
    },
  },
  {
    id: 'rapid', icon: '≫', name: 'RAPID CYCLER', max: 4,
    desc: 'Fire 15% faster. Stacks every wave you pick it.',
    apply(game) { game.mods.fire *= 0.85; },
  },
  {
    id: 'spread', icon: '✦', name: 'SPREAD SHOT', max: 2,
    desc: '+1 projectile per volley, fanned out.',
    apply(game) { game.mods.spread += 1; },
  },
  {
    id: 'dash', icon: '➤', name: 'SWIFT DASH', max: 3,
    desc: 'Dash recharges 25% faster.',
    apply(game) { game.mods.dashCd *= 0.75; },
  },
  {
    id: 'magnet', icon: '◎', name: 'MAGNET COIL', max: 3,
    desc: 'Starshards are pulled in from 70% further away.',
    apply(game) { game.mods.magnet *= 1.7; },
  },
  {
    id: 'rich', icon: '◆', name: 'RICH HARVEST', max: 4,
    desc: 'Every starshard is worth 50% more score.',
    apply(game) { game.mods.gemValue *= 1.5; },
  },
  {
    id: 'velocity', icon: '↑', name: 'OVERDRIVE ROUNDS', max: 3,
    desc: 'Shots fly 25% faster.',
    apply(game) { game.mods.shotSpeed *= 1.25; },
  },
  {
    id: 'aegis', icon: '⛨', name: 'AEGIS PLATING', max: 2,
    desc: 'Start the next wave shielded for 4 seconds.',
    apply(game) { game.ship.invuln = Math.max(game.ship.invuln, 4); },
  },
];

/** How many times `id` has already been taken in this run. */
export function stacksOf(game, id) {
  let n = 0;
  for (const taken of game.chosen) if (taken === id) n += 1;
  return n;
}

/** Three distinct upgrades the player may still take, drawn at random. */
export function rollChoices(rng, game) {
  const available = UPGRADE_POOL.filter((u) => stacksOf(game, u.id) < u.max);
  const choices = [];
  while (choices.length < 3 && available.length > 0) {
    const i = Math.floor(rng.next() * available.length);
    choices.push(available.splice(i, 1)[0]);
  }
  return choices;
}

/** Screen rectangle of the i-th upgrade card (0, 1 or 2). */
export function cardBox(i) {
  const w = 340;
  const h = 210;
  const gap = 28;
  const total = w * 3 + gap * 2;
  const x = (ARENA.w - total) / 2 + i * (w + gap);
  return { x, y: 300, w, h };
}
