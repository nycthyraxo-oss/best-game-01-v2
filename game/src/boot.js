// NOVA HARVEST v2 — boot and the one loop: controls are read every frame,
// the game advances in fixed 1/60 s ticks (several in a slow frame, none in
// a fast one), and the painter draws what is there. The game moves between
// six views: title, play, upgrade draft, paused, victory and game over.
//
// ?seed=N fixes the spawn pattern. ?shot=title|play|win|over (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { ARENA, BEST_KEY, SHIP, TICK } from './tuning.js';
import { makeRng } from './rng.js';
import { createSound } from './sound.js';
import { EV_HIT, EV_OVER, EV_PICKUP, EV_UPGRADE, EV_WIN, createGame } from './engine.js';
import { ACT_CONFIRM, ACT_CONTINUE, ACT_DASH, ACT_MUTE, ACT_PAUSE, ACT_PICK1, ACT_PICK2, ACT_PICK3, ACT_RESTART, createControls } from './controls.js';
import { createPainter, VIEW_OVER, VIEW_PAUSED, VIEW_PLAY, VIEW_TITLE, VIEW_UPGRADE, VIEW_WIN } from './painter.js';
import { cardBox } from './upgrades.js';
import { stageScene } from './scenes.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const rng = makeRng(seed);
const sim = createGame(rng);
const painter = createPainter(canvas, rng);
const sound = createSound();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageScene(name, sim);
  let painted = 0;
  function paint() {
    painter.draw(sim.game, scene.view, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const controls = createControls(canvas);
  let view = VIEW_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let dashHeld = false;

  // Screen readers (and anyone watching the page's text) hear the view changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    sim.reset();
    accumulator = 0;
    view = VIEW_PLAY;
    announce(`Playing. ${SHIP.hull} hull. Clear 10 waves to win.`);
  }

  function endGame() {
    view = VIEW_OVER;
    sound.gameOver();
    if (sim.game.score > best) {
      best = sim.game.score;
      saveBest(best);
    }
    announce(`Game over. Score ${sim.game.score}. Best ${best}.`);
  }

  function winGame() {
    view = VIEW_WIN;
    sound.win();
    if (sim.game.score > best) {
      best = sim.game.score;
      saveBest(best);
    }
    announce(`Sector cleared. Score ${sim.game.score}.`);
  }

  function pickUpgrade(i) {
    if (view !== VIEW_UPGRADE) return;
    if (sim.chooseUpgrade(i)) {
      sound.upgrade();
      view = VIEW_PLAY;
      announce('Upgrade installed. Next wave incoming.');
    }
  }

  function handleActions() {
    const actions = controls.takeActions();
    if (actions & ACT_MUTE) {
      const muted = sound.toggleMute();
      announce(muted ? 'Sound muted.' : 'Sound on.');
    }
    if (actions & ACT_CONFIRM) sound.unlock();
    if (view === VIEW_UPGRADE) {
      if (actions & ACT_PICK1) pickUpgrade(0);
      else if (actions & ACT_PICK2) pickUpgrade(1);
      else if (actions & ACT_PICK3) pickUpgrade(2);
      const click = controls.takeClick();
      if (click && view === VIEW_UPGRADE) {
        // Clicks are in canvas backing pixels; the logical field is
        // canvas.width / ARENA.w backing pixels per logical unit.
        const scale = canvas.width / ARENA.w;
        for (let i = 0; i < 3; i += 1) {
          const box = cardBox(i);
          if (
            click.x / scale >= box.x && click.x / scale <= box.x + box.w &&
            click.y / scale >= box.y && click.y / scale <= box.y + box.h
          ) {
            pickUpgrade(i);
            break;
          }
        }
      }
      return;
    }
    if (view === VIEW_TITLE && actions & ACT_CONFIRM) {
      sound.unlock();
      startGame();
    } else if (view === VIEW_OVER && actions & ACT_CONFIRM) {
      startGame();
    } else if (view === VIEW_WIN && actions & ACT_CONFIRM) {
      startGame();
    } else if (view === VIEW_WIN && actions & ACT_CONTINUE) {
      sim.game.endless = true;
      sim.game.victory = false;
      sim.game.phase = 'intro';
      sim.game.phaseLeft = 2.6;
      sim.game.banner = 'ENDLESS MODE — HOW LONG CAN YOU LAST?';
      sim.game.bannerLeft = 2.6;
      view = VIEW_PLAY;
      announce('Endless mode. Good hunting.');
    } else if (actions & ACT_RESTART && (view === VIEW_PLAY || view === VIEW_PAUSED || view === VIEW_OVER || view === VIEW_WIN)) {
      startGame();
    } else if (actions & ACT_PAUSE && view === VIEW_PLAY) {
      view = VIEW_PAUSED;
      announce('Paused.');
    } else if (actions & ACT_PAUSE && view === VIEW_PAUSED) {
      view = VIEW_PLAY;
      announce('Playing.');
    }
    if (actions & ACT_DASH) dashHeld = true;
  }

  function tick() {
    if (view === VIEW_TITLE) {
      // The title screen drifts the ambient world: gems wander in.
      sim.step(TICK, { mx: 0, my: 0, aim: -Math.PI / 2, fire: false, dash: false }, true);
      return;
    }
    const move = controls.direction();
    const aimPoint = controls.aim();
    const ship = sim.game.ship;
    let aimAngle = ship.aim;
    if (aimPoint.moved) {
      // The aim point is in canvas backing pixels; the logical field is
      // canvas.width / ARENA.w backing pixels per logical unit.
      const scale = canvas.width / ARENA.w;
      aimAngle = Math.atan2(aimPoint.y / scale - ship.y, aimPoint.x / scale - ship.x);
    }
    const firing = controls.firing;
    const dashing = dashHeld;
    dashHeld = false;
    const events = sim.step(TICK, { mx: move.x, my: move.y, aim: aimAngle, fire: firing, dash: dashing }, false);
    if (events & EV_WIN) winGame();
    else if (events & EV_OVER) endGame();
    else {
      if (events & EV_HIT) {
        sound.hurt();
        announce(sim.game.ship.hull === 1 ? 'Hull critical. 1 left.' : `Hit. ${sim.game.ship.hull} hull left.`);
      }
      if (events & EV_UPGRADE) {
        sound.waveClear();
        view = VIEW_UPGRADE;
        announce('Wave cleared. Choose an upgrade: press 1, 2 or 3.');
      }
      if (events & EV_PICKUP) sound.shard();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (view === VIEW_TITLE || view === VIEW_PLAY) {
      while (accumulator >= TICK && (view === VIEW_TITLE || view === VIEW_PLAY)) {
        tick();
        accumulator -= TICK;
      }
    } else {
      accumulator = 0;
    }
    painter.draw(sim.game, view, best);
  }

  // Fit the canvas to the window at the field's aspect ratio, centred.
  function fitCanvas() {
    const scale = Math.min(window.innerWidth / ARENA.w, window.innerHeight / ARENA.h);
    canvas.style.width = `${Math.floor(ARENA.w * scale)}px`;
    canvas.style.height = `${Math.floor(ARENA.h * scale)}px`;
  }
  window.addEventListener('resize', fitCanvas);
  fitCanvas();

  // Leaving the tab pauses a running game rather than letting the swarm in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && view === VIEW_PLAY) {
      view = VIEW_PAUSED;
      announce('Paused.');
    }
  });

  // A click anywhere unlocks audio even before the first game starts.
  window.addEventListener('pointerdown', () => sound.unlock(), { once: true });

  announce('Nova Harvest. Press Space or click to launch.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
