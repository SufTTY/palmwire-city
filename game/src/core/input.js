// Keyboard + mouse state with per-frame "pressed" edges and pointer lock for mouse look.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressedNow = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this.buttons = [false, false, false];
    this.clicked = [false, false, false];
    this.locked = false;
    this.enabled = true;
    this.onLockChange = null;

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (!this.down.has(e.code)) this.pressedNow.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => {
      this.down.clear();
      this.buttons = [false, false, false];
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button < 3) {
        this.buttons[e.button] = true;
        this.clicked[e.button] = true;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button < 3) this.buttons[e.button] = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    });
    window.addEventListener('wheel', (e) => {
      this.wheel += Math.sign(e.deltaY);
    }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (this.onLockChange) this.onLockChange(this.locked);
    });
  }

  requestLock() {
    if (!this.locked && this.canvas.requestPointerLock) {
      try {
        const p = this.canvas.requestPointerLock();
        if (p && p.catch) p.catch(() => {});
      } catch (err) { /* pointer lock is optional (headless, iframes) */ }
    }
  }
  releaseLock() {
    if (this.locked) document.exitPointerLock();
  }

  isDown(code) { return this.enabled && this.down.has(code); }
  pressed(code) { return this.enabled && this.pressedNow.has(code); }
  axis(neg, pos) { return (this.isDown(pos) ? 1 : 0) - (this.isDown(neg) ? 1 : 0); }
  mouseHeld(b) { return this.enabled && this.buttons[b]; }
  mouseClicked(b) { return this.enabled && this.clicked[b]; }

  /** Call once per frame after every system has read input. */
  endFrame() {
    this.pressedNow.clear();
    this.clicked = [false, false, false];
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
  }
}
