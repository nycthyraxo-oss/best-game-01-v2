// NOVA HARVEST v2 — everything the player sees. A pre-rendered nebula
// backdrop, the field entities, a HUD, the upgrade draft, and the title /
// pause / victory / game-over screens, all painted on a fixed 1280x720
// logical field scaled to the canvas.

import { ARENA, COLORS, DISPLAY_FACE, FINAL_WAVE, FOES, GEM, SHIP, TYPEFACE } from './tuning.js';
import { cardBox } from './upgrades.js';

export const VIEW_TITLE = 'title';
export const VIEW_PLAY = 'play';
export const VIEW_PAUSED = 'paused';
export const VIEW_OVER = 'over';
export const VIEW_WIN = 'win';
export const VIEW_UPGRADE = 'upgrade';

function paintBackdrop(rng) {
  const canvas = document.createElement('canvas');
  canvas.width = ARENA.w;
  canvas.height = ARENA.h;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, ARENA.w, ARENA.h);
  grad.addColorStop(0, COLORS.space);
  grad.addColorStop(0.5, COLORS.deep);
  grad.addColorStop(1, '#0a0618');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, ARENA.w, ARENA.h);
  const clouds = [
    { x: 320, y: 560, r: 360, color: COLORS.nebulaC },
    { x: 1080, y: 520, r: 300, color: COLORS.nebulaB },
    { x: 620, y: 140, r: 340, color: COLORS.nebulaA },
    { x: 90, y: 180, r: 220, color: COLORS.nebulaB },
  ];
  for (const c of clouds) {
    const radial = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
    radial.addColorStop(0, `${c.color}55`);
    radial.addColorStop(1, `${c.color}00`);
    ctx.fillStyle = radial;
    ctx.fillRect(c.x - c.r, c.y - c.r, c.r * 2, c.r * 2);
  }
  // Four star layers, far to near, a few of them gold.
  const layers = [
    { count: 130, size: 1, alpha: 0.5 },
    { count: 110, size: 1.5, alpha: 0.75 },
    { count: 60, size: 2.1, alpha: 0.95 },
    { count: 18, size: 3, alpha: 1 },
  ];
  for (const layer of layers) {
    for (let i = 0; i < layer.count; i += 1) {
      ctx.globalAlpha = layer.alpha * rng.range(0.4, 1);
      ctx.fillStyle = rng.next() < 0.1 ? COLORS.gem : COLORS.star;
      ctx.beginPath();
      ctx.arc(rng.range(0, ARENA.w), rng.range(0, ARENA.h), layer.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  return canvas;
}

function gemShape(ctx, x, y, spin, pulse) {
  const size = GEM.radius * (0.85 + pulse * 0.15);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.shadowColor = COLORS.gem;
  ctx.shadowBlur = 12;
  ctx.fillStyle = COLORS.gem;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.62, 0);
  ctx.lineTo(0, size);
  ctx.lineTo(-size * 0.62, 0);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.gemCore;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.45);
  ctx.lineTo(size * 0.28, 0);
  ctx.lineTo(0, size * 0.45);
  ctx.lineTo(-size * 0.28, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function shipShape(ctx, x, y, angle, invuln, dashing, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  if (invuln > 0 && Math.floor(time * 14) % 2 === 0) ctx.globalAlpha = 0.45;
  // Twin engine flames.
  const flame = 12 + Math.sin(time * 31) * 5 + (dashing ? 14 : 0);
  for (const side of [-6, 6]) {
    const fg = ctx.createLinearGradient(-12, side, -12 - flame, side);
    fg.addColorStop(0, '#ffb347');
    fg.addColorStop(1, 'rgba(255, 92, 92, 0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-10, side - 3);
    ctx.lineTo(-12 - flame, side);
    ctx.lineTo(-10, side + 3);
    ctx.closePath();
    ctx.fill();
  }
  // Hull: a swept arrow with side wings and a glass canopy.
  ctx.shadowColor = COLORS.ship;
  ctx.shadowBlur = 16;
  ctx.fillStyle = COLORS.ship;
  ctx.beginPath();
  ctx.moveTo(24, 0);
  ctx.lineTo(-8, -8);
  ctx.lineTo(-18, -16);
  ctx.lineTo(-12, -4);
  ctx.lineTo(-14, 0);
  ctx.lineTo(-12, 4);
  ctx.lineTo(-18, 16);
  ctx.lineTo(-8, 8);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.shipCore;
  ctx.beginPath();
  ctx.ellipse(5, 0, 8, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(234, 252, 255, 0.85)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(24, 0);
  ctx.lineTo(-8, -8);
  ctx.lineTo(-18, -16);
  ctx.lineTo(-12, -4);
  ctx.lineTo(-14, 0);
  ctx.lineTo(-12, 4);
  ctx.lineTo(-18, 16);
  ctx.lineTo(-8, 8);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function foeShape(ctx, foe, time) {
  const spec = FOES[foe.kind];
  ctx.save();
  ctx.translate(foe.x, foe.y);
  ctx.shadowColor = spec.color;
  ctx.shadowBlur = foe.kind === 'herald' ? 26 : 12;
  ctx.fillStyle = foe.flash > 0 ? '#ffffff' : spec.color;
  ctx.lineWidth = 2;
  if (foe.kind === 'mite') {
    ctx.rotate(foe.angle);
    ctx.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      const r = i % 2 === 0 ? foe.radius : foe.radius * 0.42;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#2a0a12';
    ctx.beginPath();
    ctx.arc(0, 0, foe.radius * 0.42, 0, Math.PI * 2);
    ctx.fill();
  } else if (foe.kind === 'weaver') {
    ctx.rotate(foe.angle);
    ctx.beginPath();
    ctx.moveTo(foe.radius + 4, 0);
    ctx.lineTo(-foe.radius * 0.7, foe.radius * 0.85);
    ctx.lineTo(-foe.radius * 0.35, 0);
    ctx.lineTo(-foe.radius * 0.7, -foe.radius * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(2, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (foe.kind === 'spitter') {
    ctx.rotate(foe.angle);
    ctx.beginPath();
    ctx.arc(0, 0, foe.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#3a1503';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, foe.radius * 0.55, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = COLORS.gemCore;
    ctx.beginPath();
    ctx.arc(foe.radius * 0.45, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // The Void Herald: a great rotating hex with a burning core.
    ctx.rotate(foe.angle);
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      const px = Math.cos(a) * foe.radius;
      const py = Math.sin(a) * foe.radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = COLORS.gemCore;
    ctx.beginPath();
    ctx.arc(0, 0, 12 + Math.sin(time * 6) * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = spec.color;
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (foe.maxHp > 2 && foe.hp < foe.maxHp) {
    const w = foe.radius * 2;
    ctx.fillStyle = 'rgba(10, 14, 34, 0.8)';
    ctx.fillRect(foe.x - w / 2, foe.y - foe.radius - 14, w, 5);
    ctx.fillStyle = '#ff5d73';
    ctx.fillRect(foe.x - w / 2, foe.y - foe.radius - 14, w * (foe.hp / foe.maxHp), 5);
  }
}

function drawHud(ctx, g, best) {
  const ship = g.ship;
  ctx.save();
  ctx.fillStyle = COLORS.panel;
  ctx.fillRect(0, 0, ARENA.w, 56);
  ctx.fillStyle = COLORS.ink;
  ctx.font = `700 26px ${DISPLAY_FACE}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`SCORE  ${g.score.toLocaleString('en-US')}`, 20, 29);
  ctx.fillStyle = COLORS.dim;
  ctx.font = `600 15px ${TYPEFACE}`;
  ctx.fillText(`BEST ${Math.max(best, g.score).toLocaleString('en-US')}`, 20, 48);
  ctx.fillStyle = COLORS.ink;
  ctx.font = `700 22px ${DISPLAY_FACE}`;
  ctx.textAlign = 'center';
  ctx.fillText(`WAVE ${Math.max(g.wave, 1)} / ${FINAL_WAVE}`, ARENA.w / 2, 24);
  ctx.fillStyle = COLORS.dim;
  ctx.font = `600 13px ${TYPEFACE}`;
  ctx.fillText(g.endless ? 'ENDLESS MODE' : 'CLEAR WAVE 10 TO WIN', ARENA.w / 2, 46);
  // Hull as diamonds, top right.
  ctx.textAlign = 'right';
  for (let i = 0; i < ship.maxHull; i += 1) {
    const x = ARENA.w - 30 - i * 30;
    const y = 28;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = i < ship.hull ? COLORS.hull : COLORS.hullLost;
    ctx.shadowColor = COLORS.hull;
    ctx.shadowBlur = i < ship.hull ? 8 : 0;
    ctx.fillRect(-7, -7, 14, 14);
    ctx.restore();
  }
  // Combo + dash, lower left.
  if (g.combo >= 3) {
    const mult = 1 + Math.min(g.combo, 20) * 0.1;
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.gold;
    ctx.font = `800 24px ${DISPLAY_FACE}`;
    ctx.fillText(`COMBO x${mult.toFixed(1)}  (${g.combo})`, 20, ARENA.h - 52);
    ctx.fillStyle = 'rgba(255, 209, 102, 0.35)';
    ctx.fillRect(20, ARENA.h - 40, 160, 6);
    ctx.fillStyle = COLORS.gold;
    ctx.fillRect(20, ARENA.h - 40, 160 * Math.max(0, g.comboLeft / 3), 6);
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = ship.dashIn <= 0 ? '#4de8ff' : COLORS.dim;
  ctx.font = `700 14px ${TYPEFACE}`;
  ctx.fillText(ship.dashIn <= 0 ? 'DASH READY  [SHIFT]' : 'DASH CHARGING…', 20, ARENA.h - 20);
  ctx.fillStyle = 'rgba(77, 232, 255, 0.3)';
  ctx.fillRect(20, ARENA.h - 14, 160, 5);
  ctx.fillStyle = '#4de8ff';
  ctx.fillRect(20, ARENA.h - 14, 160 * (1 - Math.max(0, ship.dashIn) / SHIP.dashRecharge), 5);
  // Shard tally + upgrades taken, lower right.
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.gem;
  ctx.font = `700 18px ${TYPEFACE}`;
  ctx.fillText(`◆ ${g.gems} shards   ✦ ${g.kills} kills`, ARENA.w - 20, ARENA.h - 20);
  if (g.chosen.length > 0) {
    ctx.fillStyle = COLORS.good;
    ctx.font = `600 13px ${TYPEFACE}`;
    ctx.fillText(`UPGRADES: ${g.chosen.length}`, ARENA.w - 20, ARENA.h - 42);
  }
  // Wave banner.
  if (g.bannerLeft > 0 && g.banner) {
    ctx.globalAlpha = Math.min(1, g.bannerLeft);
    ctx.textAlign = 'center';
    ctx.font = `800 40px ${DISPLAY_FACE}`;
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 18;
    ctx.fillStyle = COLORS.gold;
    ctx.fillText(g.banner, ARENA.w / 2, 150);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawUpgradeDraft(ctx, g) {
  ctx.fillStyle = 'rgba(5, 8, 20, 0.66)';
  ctx.fillRect(0, 0, ARENA.w, ARENA.h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORS.gold;
  ctx.font = `800 44px ${DISPLAY_FACE}`;
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 18;
  ctx.fillText('WAVE CLEARED — CHOOSE AN UPGRADE', ARENA.w / 2, 200);
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.ink;
  ctx.font = `400 20px ${TYPEFACE}`;
  ctx.fillText('Press 1, 2 or 3 — or click a card. The next wave starts right after.', ARENA.w / 2, 248);
  g.choices.forEach((choice, i) => {
    const box = cardBox(i);
    ctx.save();
    ctx.fillStyle = 'rgba(16, 22, 48, 0.92)';
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(box.x, box.y, box.w, box.h, 14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = COLORS.gold;
    ctx.font = '400 44px sans-serif';
    ctx.fillText(choice.icon, box.x + box.w / 2, box.y + 48);
    ctx.fillStyle = COLORS.ink;
    ctx.font = `800 20px ${DISPLAY_FACE}`;
    ctx.fillText(choice.name, box.x + box.w / 2, box.y + 96);
    ctx.fillStyle = COLORS.dim;
    ctx.font = `400 15px ${TYPEFACE}`;
    wrapText(ctx, choice.desc, box.x + box.w / 2, box.y + 132, box.w - 36, 21);
    ctx.fillStyle = COLORS.dim;
    ctx.font = `700 15px ${TYPEFACE}`;
    ctx.fillText(`[ ${i + 1} ]`, box.x + box.w / 2, box.y + box.h - 28);
    ctx.restore();
  });
}

function wrapText(ctx, text, cx, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  const lines = [''];
  for (const word of words) {
    const trial = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${word}` : word;
    if (ctx.measureText(trial).width > maxWidth && lines[lines.length - 1]) lines.push(word);
    else lines[lines.length - 1] = trial;
  }
  lines.forEach((line, i) => ctx.fillText(line, cx, y + i * lineHeight));
}

function overlay(ctx, title, lines, accent) {
  ctx.fillStyle = 'rgba(5, 8, 20, 0.62)';
  ctx.fillRect(0, 0, ARENA.w, ARENA.h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 24;
  ctx.fillStyle = accent;
  ctx.font = `800 64px ${DISPLAY_FACE}`;
  ctx.fillText(title, ARENA.w / 2, 218);
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.ink;
  ctx.font = `400 21px ${TYPEFACE}`;
  lines.forEach((line, i) => {
    ctx.fillText(line, ARENA.w / 2, 292 + i * 34);
  });
}

export function createPainter(canvas, rng) {
  const ctx = canvas.getContext('2d');
  const backdrop = paintBackdrop(rng);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = ARENA.w * dpr;
  canvas.height = ARENA.h * dpr;
  canvas.style.aspectRatio = `${ARENA.w} / ${ARENA.h}`;

  function draw(g, view, best) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const shake = g.shake > 0 ? g.shake * 9 : 0;
    const ox = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    const oy = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.drawImage(backdrop, 0, 0);

    for (const p of g.drops) {
      if (!p) continue;
      const pulse = 0.5 + Math.sin(g.time * 6) * 0.5;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.shadowColor = p.kind === 'repair' ? '#7dffb0' : '#4de8ff';
      ctx.shadowBlur = 14;
      ctx.fillStyle = p.kind === 'repair' ? '#7dffb0' : '#4de8ff';
      ctx.globalAlpha = 0.55 + pulse * 0.45;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#071018';
      ctx.font = '800 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.kind === 'repair' ? '+' : 'A', 0, 1);
      ctx.restore();
    }

    for (const s of g.gemsArr) {
      const pulse = 0.5 + Math.sin(g.time * 5 + s.spin) * 0.5;
      ctx.globalAlpha = Math.min(1, s.life / 2 + 0.35);
      gemShape(ctx, s.x, s.y, s.spin, pulse);
      ctx.globalAlpha = 1;
    }

    for (const foe of g.foes) foeShape(ctx, foe, g.time);
    for (const b of g.foeShots) {
      ctx.save();
      ctx.shadowColor = '#ff5d73';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#ff8fa0';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.strokeStyle = COLORS.shot;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.shadowColor = COLORS.shot;
    ctx.shadowBlur = 8;
    for (const b of g.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();

    if (g.ship.alive && view !== VIEW_TITLE) {
      shipShape(ctx, g.ship.x, g.ship.y, g.ship.aim, g.ship.invuln, g.ship.dashLeft > 0, g.time);
      if (g.ship.invuln > 3) {
        ctx.save();
        ctx.strokeStyle = 'rgba(77, 232, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(g.ship.x, g.ship.y, SHIP.radius + 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    for (const p of g.motes) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    ctx.font = `700 17px ${TYPEFACE}`;
    for (const t of g.texts) {
      ctx.globalAlpha = Math.min(1, t.life);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;

    if (g.flash > 0) {
      ctx.fillStyle = `rgba(255, 60, 80, ${g.flash * 0.55})`;
      ctx.fillRect(-20, -20, ARENA.w + 40, ARENA.h + 40);
    }
    ctx.restore();

    if (view === VIEW_PLAY || view === VIEW_PAUSED || view === VIEW_UPGRADE) drawHud(ctx, g, best);

    if (view === VIEW_TITLE) {
      overlay(ctx, 'NOVA HARVEST', [
        'Pilot the skiff Kestrel. Harvest the starshards. Break the Void.',
        '',
        'WASD / ARROWS — fly      MOUSE — aim      CLICK / SPACE — fire      SHIFT — dash',
        'Clear a wave, then pick 1 of 3 upgrades. Clear all 10 waves to win the sector.',
        '',
        'CLICK OR PRESS SPACE TO LAUNCH',
        best > 0 ? `BEST SCORE  ${best.toLocaleString('en-US')}` : 'NO RUNS YET — THE SECTOR AWAITS',
      ], '#4de8ff');
    } else if (view === VIEW_UPGRADE) {
      drawUpgradeDraft(ctx, g);
    } else if (view === VIEW_PAUSED) {
      overlay(ctx, 'PAUSED', ['P or ESC — resume', 'R — restart the run', 'M — mute sound'], '#eef2ff');
    } else if (view === VIEW_OVER) {
      const accuracy = g.shots > 0 ? Math.round((g.hits / g.shots) * 100) : 0;
      overlay(ctx, 'THE VOID TAKES YOU', [
        `SCORE  ${g.score.toLocaleString('en-US')}    BEST  ${Math.max(best, g.score).toLocaleString('en-US')}`,
        `WAVE ${g.wave}  •  ${g.kills} VOIDBORN DOWN  •  ${g.gems} SHARDS  •  ${accuracy}% ACCURACY`,
        '',
        'PRESS SPACE OR CLICK TO FLY AGAIN',
      ], '#ff5d73');
    } else if (view === VIEW_WIN) {
      overlay(ctx, 'SECTOR CLEARED!', [
        `SCORE  ${g.score.toLocaleString('en-US')}    BEST  ${Math.max(best, g.score).toLocaleString('en-US')}`,
        `ALL 10 WAVES BROKEN  •  ${g.kills} VOIDBORN DOWN  •  ${g.gems} SHARDS HARVESTED`,
        g.chosen.length > 0 ? `UPGRADES TAKEN: ${g.chosen.length}` : '',
        'C — KEEP FLYING IN ENDLESS MODE      SPACE — FLY IT AGAIN',
      ], '#7dffb0');
    }
  }

  return { draw };
}
