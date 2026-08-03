// First-person player.
// Desktop: tank controls — W/S move, A/D turn (~120°/s), Q/E strafe, F interacts.
// Mouse look via pointer lock (click to engage); if pointer lock errors or is
// unavailable, drag-to-look takes over automatically.
// Touch (unchanged): left half = move stick, right half = look drag.
import * as THREE from 'three';
import { blockedCircle } from './map.js';

const SPEED = 4.2, RADIUS = 0.45, EYE = 1.6;
const TURN_RATE = THREE.MathUtils.degToRad(120);
export const IS_TOUCH = 'ontouchstart' in window;

export class Player {
  constructor(camera, canvas, startX, startZ, startYaw) {
    this.camera = camera;
    this.pos = new THREE.Vector3(startX, EYE, startZ);
    this.yaw = startYaw; this.pitch = 0;
    this.speedMul = 1;
    this.enabled = true;
    this.moving = false;

    this.keys = new Set();
    this.lookDX = 0; this.lookDY = 0;
    this.moveTouch = null; this.lookTouch = null;
    this.drag = null;
    this.lockBroken = false;
    this.onInteractKey = null;
    this.onLockError = null;

    this.#bind(canvas);
  }

  #lockFailed(err) {
    if (this.lockBroken) return;
    this.lockBroken = true;
    console.warn("Pointer lock unavailable — falling back to drag-to-look.", err ?? '');
    this.onLockError?.();
  }

  #bind(canvas) {
    // every listener is tied to this controller so dispose() detaches them all —
    // otherwise each retry stacks another full set of handlers
    this.ac = new AbortController();
    const sig = { signal: this.ac.signal };

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') e.preventDefault();
      this.keys.add(e.code);
      if (e.code === 'KeyF') this.onInteractKey?.();
    }, sig);
    window.addEventListener('keyup', (e) => this.keys.delete(e.code), sig);

    if (!IS_TOUCH) {
      document.addEventListener('pointerlockerror', () => this.#lockFailed(), sig);
      canvas.addEventListener('click', () => {
        if (this.enabled && !this.lockBroken && document.pointerLockElement !== canvas) {
          try {
            const p = canvas.requestPointerLock?.();
            p?.catch?.((e) => this.#lockFailed(e));
          } catch (e) {
            this.#lockFailed(e);
          }
        }
      }, sig);
      canvas.addEventListener('mousedown', (e) => {
        if (document.pointerLockElement === canvas) { this.onInteractKey?.(); return; }
        this.drag = { x: e.clientX, y: e.clientY, moved: 0 };
      }, sig);
      window.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement === canvas) {
          this.lookDX += e.movementX * 0.0023;
          this.lookDY += e.movementY * 0.0023;
        } else if (this.drag) {
          const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
          this.drag.x = e.clientX; this.drag.y = e.clientY;
          this.drag.moved += Math.abs(dx) + Math.abs(dy);
          this.lookDX += dx * 0.0042;
          this.lookDY += dy * 0.0042;
        }
      }, sig);
      window.addEventListener('mouseup', () => {
        // a clean click (no drag) doubles as interact once pointer lock is off the table
        if (this.drag && this.drag.moved < 5 && this.lockBroken) this.onInteractKey?.();
        this.drag = null;
      }, sig);
    } else {
      this.#makeStickUI();
      canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        for (const t of e.changedTouches) {
          if (t.clientX < innerWidth / 2 && !this.moveTouch) {
            this.moveTouch = { id: t.identifier, ox: t.clientX, oy: t.clientY, x: t.clientX, y: t.clientY };
            this.#stickShow(t.clientX, t.clientY);
          } else if (!this.lookTouch) {
            this.lookTouch = { id: t.identifier, x: t.clientX, y: t.clientY };
          }
        }
      }, { passive: false, ...sig });
      canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (const t of e.changedTouches) {
          if (this.moveTouch?.id === t.identifier) {
            this.moveTouch.x = t.clientX; this.moveTouch.y = t.clientY;
            this.#stickKnob(t.clientX, t.clientY);
          } else if (this.lookTouch?.id === t.identifier) {
            this.lookDX += (t.clientX - this.lookTouch.x) * 0.006;
            this.lookDY += (t.clientY - this.lookTouch.y) * 0.006;
            this.lookTouch.x = t.clientX; this.lookTouch.y = t.clientY;
          }
        }
      }, { passive: false, ...sig });
      const end = (e) => {
        for (const t of e.changedTouches) {
          if (this.moveTouch?.id === t.identifier) { this.moveTouch = null; this.#stickHide(); }
          if (this.lookTouch?.id === t.identifier) this.lookTouch = null;
        }
      };
      canvas.addEventListener('touchend', end, sig);
      canvas.addEventListener('touchcancel', end, sig);
    }
  }

  dispose() {
    this.ac.abort();
    this.stickBase?.remove();
    this.stickKnobEl?.remove();
  }

  #makeStickUI() {
    this.stickBase = document.createElement('div');
    this.stickBase.className = 'stick hidden';
    this.stickBase.style.cssText += 'width:110px;height:110px';
    this.stickKnobEl = document.createElement('div');
    this.stickKnobEl.className = 'stick hidden';
    this.stickKnobEl.style.cssText += 'width:48px;height:48px;background:#ffffff2f';
    document.body.append(this.stickBase, this.stickKnobEl);
  }
  #stickShow(x, y) {
    this.stickBase.style.left = x - 55 + 'px'; this.stickBase.style.top = y - 55 + 'px';
    this.stickBase.classList.remove('hidden');
    this.#stickKnob(x, y);
    this.stickKnobEl.classList.remove('hidden');
  }
  #stickKnob(x, y) {
    const dx = x - this.moveTouch.ox, dy = y - this.moveTouch.oy;
    const len = Math.hypot(dx, dy), max = 52;
    const s = len > max ? max / len : 1;
    this.stickKnobEl.style.left = this.moveTouch.ox + dx * s - 24 + 'px';
    this.stickKnobEl.style.top = this.moveTouch.oy + dy * s - 24 + 'px';
  }
  #stickHide() { this.stickBase.classList.add('hidden'); this.stickKnobEl.classList.add('hidden'); }

  #inputs() {
    const k = this.keys;
    const turn = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let mz = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    let mx = (k.has('KeyE') ? 1 : 0) - (k.has('KeyQ') ? 1 : 0);
    if (this.moveTouch) {
      mx += (this.moveTouch.x - this.moveTouch.ox) / 55;
      mz += (this.moveTouch.y - this.moveTouch.oy) / 55;
    }
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    return { mx, mz, turn };
  }

  update(dt) {
    if (!this.enabled) { this.lookDX = this.lookDY = 0; return; }
    const { mx, mz, turn } = this.#inputs();

    this.yaw -= turn * TURN_RATE * dt;          // A/D tank turn
    this.yaw -= this.lookDX;                    // mouse / touch look
    this.pitch = Math.max(-1.15, Math.min(1.15, this.pitch - this.lookDY));
    this.lookDX = this.lookDY = 0;

    this.moving = Math.hypot(mx, mz) > 0.1;     // Betty's hearing keys off this
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const vx = (mx * cos + mz * sin) * SPEED * this.speedMul * dt;
    const vz = (-mx * sin + mz * cos) * SPEED * this.speedMul * dt;

    // axis-separated collision so the player slides along walls
    if (!blockedCircle(this.pos.x + vx, this.pos.z, RADIUS)) this.pos.x += vx;
    if (!blockedCircle(this.pos.x, this.pos.z + vz, RADIUS)) this.pos.z += vz;

    this.camera.position.copy(this.pos);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(this.yaw);
    this.camera.rotateX(this.pitch);
  }
}
