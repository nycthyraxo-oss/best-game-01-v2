// Synthesised sound effects through the Web Audio API — no audio files, no
// network. The context is created on the first user gesture (browsers block
// audio before one). Every effect is a short table of notes or a noise burst
// played through one master gain.

const MELODIES = {
  waveClear: [523, 659, 784, 1047],
  win: [523, 659, 784, 1047, 1319],
  gameOver: [392, 330, 262, 196],
};

export function createSound() {
  let context = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') void context.resume();
      return context;
    }
    const AudioContext = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContext) return null;
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = 0.32;
    master.connect(context.destination);
    return context;
  }

  function tone(from, to, duration, type = 'sine', volume = 0.5, delay = 0) {
    if (muted) return;
    const ctx = ensure();
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), start + duration);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  function noise(duration, volume = 0.4, lowpass = 1200, delay = 0) {
    if (muted) return;
    const ctx = ensure();
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(gain).connect(master);
    source.start(start);
  }

  function melody(name, step = 0.09, duration = 0.22, volume = 0.25) {
    MELODIES[name].forEach((freq, i) => tone(freq, freq, duration, 'triangle', volume, i * step));
  }

  return {
    /** Call from any click/keydown so the context exists before play starts. */
    unlock() { ensure(); },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    get muted() { return muted; },
    shoot() { tone(880, 320, 0.09, 'square', 0.14); },
    hit() { noise(0.08, 0.2, 2400); },
    explode(big = false) {
      noise(big ? 0.55 : 0.28, big ? 0.5 : 0.32, big ? 700 : 1400);
      tone(big ? 160 : 220, 40, big ? 0.5 : 0.25, 'sawtooth', 0.25);
    },
    shard() { tone(1180, 1760, 0.09, 'sine', 0.2); },
    hurt() {
      tone(300, 70, 0.35, 'sawtooth', 0.4);
      noise(0.2, 0.3, 900);
    },
    dash() { noise(0.16, 0.22, 3200); },
    waveClear() { melody('waveClear'); },
    upgrade() { melody('waveClear', 0.07, 0.18, 0.22); },
    win() { melody('win', 0.11, 0.3, 0.28); },
    gameOver() { melody('gameOver', 0.16, 0.34, 0.28); },
  };
}
