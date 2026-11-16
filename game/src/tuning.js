// NOVA HARVEST v2 — tuning table. Every number the game balances on lives
// here so the engine, the painter and the upgrade cards all read one source.
// The arena is a fixed 1280x720 logical field; the painter scales it to the
// window, so none of these numbers depends on the screen size.

export const ARENA = { w: 1280, h: 720 };

/** Fixed simulation step: 60 ticks a second whatever the display rate. */
export const TICK = 1 / 60;

/** Clear this many waves and the sector is yours. */
export const FINAL_WAVE = 10;

export const SHIP = {
  radius: 16,
  thrust: 2600,
  topSpeed: 340,
  drag: 5.2,
  hull: 3,
  maxHullCap: 6,
  fireGap: 0.13,
  shotSpeed: 760,
  shotDamage: 1,
  dashSpeed: 980,
  dashLength: 0.16,
  dashRecharge: 2.4,
  graceAfterHit: 1.6,
  magnetReach: 110,
  pickupReach: 26,
};

export const FOES = {
  mite: { radius: 14, hp: 1, speed: 135, score: 50, gems: 1, color: '#ff5d73' },
  weaver: { radius: 16, hp: 2, speed: 105, score: 100, gems: 2, color: '#c77dff' },
  spitter: { radius: 17, hp: 2, speed: 80, score: 150, gems: 2, color: '#ff9f1c' },
  herald: { radius: 52, hp: 46, speed: 46, score: 1000, gems: 12, color: '#ff2e63' },
};

export const GEM = { value: 25, life: 9, radius: 9 };
export const COMBO = { window: 3.0, perKill: 0.1, cap: 20 };
export const DIRECTOR = { betweenWaves: 2.6, clearBonus: 100, spawnGap: 0.55 };

export const LIMITS = { shots: 128, foes: 48, gems: 160, motes: 420, texts: 32, foeShots: 96, drops: 8 };

export const COLORS = {
  space: '#070a18',
  deep: '#0b1030',
  nebulaA: '#1b2a6b',
  nebulaB: '#4a1d6b',
  nebulaC: '#0d3b4d',
  star: '#dfe8ff',
  ship: '#4de8ff',
  shipCore: '#eafcff',
  shot: '#aef3ff',
  gem: '#ffd166',
  gemCore: '#fff3c4',
  hull: '#ff5d73',
  hullLost: '#3a2333',
  ink: '#eef2ff',
  dim: '#9aa7c7',
  panel: 'rgba(10, 14, 34, 0.72)',
  gold: '#ffd166',
  good: '#7dffb0',
};

export const TYPEFACE = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
export const DISPLAY_FACE = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

/** localStorage key for the best score (this browser only). */
export const BEST_KEY = 'nova-harvest.best';
