// Keyboard + mouse controls. Movement is WASD or arrows; the mouse aims
// the skiff and holding the button (or Space) fires. Shift dashes, P
// pauses, R restarts, M mutes, C continues after a win, and 1/2/3 pick an
// upgrade card. Actions are edge-triggered and consumed once.

export const ACT_CONFIRM = 1;
export const ACT_PAUSE = 2;
export const ACT_RESTART = 4;
export const ACT_DASH = 8;
export const ACT_MUTE = 16;
export const ACT_CONTINUE = 32;
export const ACT_PICK1 = 64;
export const ACT_PICK2 = 128;
export const ACT_PICK3 = 256;

const VECTORS = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

const PRESS_ACTIONS = {
  Space: ACT_CONFIRM,
  Enter: ACT_CONFIRM,
  KeyP: ACT_PAUSE,
  Escape: ACT_PAUSE,
  KeyR: ACT_RESTART,
  ShiftLeft: ACT_DASH,
  ShiftRight: ACT_DASH,
  KeyM: ACT_MUTE,
  KeyC: ACT_CONTINUE,
  Digit1: ACT_PICK1,
  Digit2: ACT_PICK2,
  Digit3: ACT_PICK3,
  Numpad1: ACT_PICK1,
  Numpad2: ACT_PICK2,
  Numpad3: ACT_PICK3,
};

export function createControls(canvas) {
  const held = new Set();
  let queued = 0;
  let pointerX = 0;
  let pointerY = 0;
  let pointerMoved = false;
  let pointerDown = false;
  let trigger = false;
  let clickX = null;
  let clickY = null;

  function onKeyDown(event) {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
    if (!event.repeat) queued |= PRESS_ACTIONS[event.code] ?? 0;
    held.add(event.code);
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  function trackPointer(event) {
    const rect = canvas.getBoundingClientRect();
    pointerX = ((event.clientX - rect.left) / rect.width) * canvas.width;
    pointerY = ((event.clientY - rect.top) / rect.height) * canvas.height;
    pointerMoved = true;
  }

  function onPointerDown(event) {
    trackPointer(event);
    pointerDown = true;
    trigger = true;
    clickX = pointerX;
    clickY = pointerY;
    queued |= ACT_CONFIRM;
  }

  function onPointerUp() {
    pointerDown = false;
    trigger = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', trackPointer);
  canvas.addEventListener('mousedown', onPointerDown);
  window.addEventListener('mouseup', onPointerUp);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** Normalised movement vector from the held keys. */
    direction() {
      let x = 0;
      let y = 0;
      for (const code of held) {
        const v = VECTORS[code];
        if (!v) continue;
        x += v[0];
        y += v[1];
      }
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    },
    /** Aim point in canvas backing pixels, plus whether the mouse moved yet. */
    aim() {
      return { x: pointerX, y: pointerY, moved: pointerMoved };
    },
    get firing() {
      return trigger || held.has('Space');
    },
    get mouseDown() {
      return pointerDown;
    },
    /** The last click point (canvas backing pixels), consumed once. */
    takeClick() {
      if (clickX === null) return null;
      const point = { x: clickX, y: clickY };
      clickX = null;
      clickY = null;
      return point;
    },
    /** Edge-triggered actions since the last call; consuming clears them. */
    takeActions() {
      const taken = queued;
      queued = 0;
      return taken;
    },
  };
}
