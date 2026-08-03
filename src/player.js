// First-person player: WASD + pointer lock on desktop; on touch, left half of
// the screen is a virtual move stick and the right half drags to look.
import * as THREE from 'three';
import { blockedCircle } from './map.js';

const SPEED = 4.2, RADIUS = 0.45, EYE = 1.6;
export const IS_TOUCH = 'ontouchstart' in window;

export class Player {
  constructor(camera, canvas, startX, startZ, startYaw) {
    this.camera = camera;
    this.pos = new THREE.Vector3(startX, EYE, startZ);
    this.yaw = startYaw; this.pitch = 0;
    this.speedMul = 1;
    this.enabled = true;

    this.keys = new Set();
    this.lookDX = 0; this.lookDY = 0;
    this.moveTouch = null; this.lookTouch = null;
    this.onInteractKey = null;

    this.#bind(canvas);
  }

  #bind(canvas) {
    // every listener is tied to this controller so dispose() detaches them all —
    // otherwise each retry stacks another full set of handlers
    this.ac = new AbortController();
    const sig = { signal: this.ac.signal };

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') e.preventDefault();
      this.keys.add(e.code);
      if (e.code === 'KeyE') this.onInteractKey?.();
    }, sig);
    window.addEventListener('keyup', (e) => this.keys.delete(e.code), sig);

    if (!IS_TOUCH) {
      canvas.addEventListener('click', () => {
        if (this.enabled && document.pointerLockElement !== canvas) {
          canvas.requestPointerLock?.().catch?.(() => {});
        }
      }, sig);
      canvas.addEventListener('mousedown', () => {
        if (document.pointerLockElement === canvas) this.onInteractKey?.();
      }, sig);
      window.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement === canvas) {
          this.lookDX += e.movementX * 0.0023;
          this.lookDY += e.movementY * 0.0023;
        }
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

  moveVector() {
    let mx = 0, mz = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) mz -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) mz += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) mx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) mx += 1;
    if (this.moveTouch) {
      mx += (this.moveTouch.x - this.moveTouch.ox) / 55;
      mz += (this.moveTouch.y - this.moveTouch.oy) / 55;
    }
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    return { mx, mz };
  }

  update(dt) {
    if (!this.enabled) { this.lookDX = this.lookDY = 0; return; }
    this.yaw -= this.lookDX;
    this.pitch = Math.max(-1.15, Math.min(1.15, this.pitch - this.lookDY));
    this.lookDX = this.lookDY = 0;

    const { mx, mz } = this.moveVector();
    this.moving = Math.hypot(mx, mz) > 0.1;   // Betty's hearing keys off this
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
