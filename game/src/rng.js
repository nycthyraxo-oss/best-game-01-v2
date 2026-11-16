// A small deterministic random source (splitmix32). Every spawn, spread and
// drift in the game draws from one of these, so a fixed seed replays the
// same run — the screenshot scenes depend on it.

export function makeRng(seed) {
  let s = seed >>> 0;
  return {
    /** Next float in [0, 1). */
    next() {
      s = (s + 0x9e3779b9) >>> 0;
      let z = s;
      z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
      z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
      return ((z ^ (z >>> 15)) >>> 0) / 4294967296;
    },
    /** Next float in [min, max). */
    range(min, max) {
      return min + (max - min) * this.next();
    },
    /** Next integer in [min, max]. */
    int(min, max) {
      return min + Math.floor(this.next() * (max - min + 1));
    },
    /** Pick one entry of an array. */
    pick(items) {
      return items[Math.floor(this.next() * items.length)];
    },
  };
}
