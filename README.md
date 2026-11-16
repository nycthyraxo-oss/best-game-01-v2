# Nova Harvest

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/nycthyraxo-oss/best-game-01-v2/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/nycthyraxo-oss/best-game-01-v2/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

A complete, original twin-stick arena shooter for the web, built for the
make.fun **best-game-01** bounty ("Make the best game").

Pilot the skiff **Kestrel** through a neon sector overrun by the Voidborn.
Harvest starshards, chain kills into combos, and clear all **10 waves** —
including the Void Herald on waves 5 and 10 — to win the sector. Lose all
hull and the Void takes you. Then fly it again.

## Play

Open `game/index.html` in a desktop browser (or run `node serve.ts` and
open http://localhost:8080). No build step, no network requests, no assets
to download: every visual is drawn in code and every sound is synthesised
with the Web Audio API.

| Input | Action |
| --- | --- |
| WASD / arrow keys | Fly |
| Mouse | Aim |
| Click / Space | Fire |
| Shift | Dash (brief invulnerability, 2.4 s cooldown) |
| 1 / 2 / 3 or click | Pick an upgrade after a cleared wave |
| P / Esc | Pause |
| R | Restart the run |
| C | Continue in endless mode (after winning) |
| M | Mute |

## Rules

- **Goal:** clear wave 10 to win; endless mode continues after that.
- **Score:** destroying Voidborn and collecting starshards. Kills build a
  combo multiplier (up to x3) that decays after 3 seconds without a kill.
- **Upgrades:** after every cleared wave, pick 1 of 3 upgrades — reinforced
  hull, rapid fire, spread shot, swifter dash, magnet coil, richer harvest,
  overdrive rounds, or Aegis plating. Each stacks up to its cap.
- **Hull:** 3 hits, with brief invulnerability after each one. Repair and
  Aegis-shield pickups drop from fallen enemies; hull is reinforced every
  3rd wave cleared.
- **Enemies:** mites chase you, weavers strafe in sine patterns, spitters
  keep their distance and shoot, and the Void Herald (waves 5 and 10)
  fires radial bursts and spawns mites.
- **Best score** is kept in the browser between visits.

## Layout

- `game/` — the playable game as static files (`index.html` + ES modules
  under `game/src/`). No libraries, no network.
- `game/src/tuning.js` — all tuning numbers and colours.
- `game/src/engine.js` — the simulation: skiff, enemies, waves, upgrades.
- `game/src/upgrades.js` — the between-wave upgrade pool and card layout.
- `game/src/painter.js` — all drawing: nebula backdrop, HUD, upgrade draft, screens.
- `game/src/sound.js` — synthesised sound effects.
- `game/src/controls.js` — keyboard + mouse.
- `game/src/scenes.js` — the staged screenshot scenes (`?shot=title|play|win|over|action`).
- `main.ts` — the make.fun entrypoint: copies `game/` and `screenshots/`
  to `/output` and writes `dossier.json` with the vendored library.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.
- `screenshots/` — 3–4 real renders of the game's own code (see `shots.json`).
- `serve.ts` — a tiny static server for local play-testing.

## Screenshots

Taken headless in desktop Chrome from the game's own code:

1. `1-action.jpg` — wave-5 boss fight, the busiest action shot with the full HUD (`?shot=action&seed=7`)
2. `2-title.jpg` — title screen (`?shot=title&seed=7`)
3. `3-win.jpg` — victory screen after clearing wave 10 (`?shot=win&seed=7`)
4. `4-over.jpg` — game-over screen (`?shot=over&seed=7`)

## License

MIT — see `LICENSE`.
