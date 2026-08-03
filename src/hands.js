// First-person hands, screen-space at the bottom of the view.
// Rules: hidden at idle with empty hands · both hands swing while walking
// (opposite phase, ~1.5Hz, slight bob) · a held item pins the right hand on
// screen, left joins only while walking · show/hide slides in ~200ms.
// The art slots are single images containing both hands; each plane shows
// one UV half, so the slots stay identical when the art is replaced.
import * as THREE from 'three';
import { TEX } from './assets.js';

const POSE = {
  none: 'hands_empty',
  flashlight: 'hands_flashlight',
  knife: 'hands_knife',
  rolling_pin: 'hands_pin',
};
const SHOWN_Y = -0.55, HIDDEN_Y = -0.8;      // slide up from below the view edge
const EASE_T = 0.2, SWING_HZ = 1.5, H = 0.3;
const smooth = (t) => t * t * (3 - 2 * t);

const halves = new Map();
function halfTex(slot, side) {
  const key = slot + side;
  if (halves.has(key)) return halves.get(key);
  const base = TEX[slot];
  if (!base) return null;
  const t = base.clone();
  t.repeat.x = 0.5;
  t.offset.x = side === 'r' ? 0.5 : 0;
  t.needsUpdate = true;
  t.userData = { aspect: (base.userData.aspect || 1.9) / 2 };
  halves.set(key, t);
  return t;
}

export class Hands {
  constructor(camera) {
    this.group = new THREE.Group();
    camera.add(this.group);
    this.phase = 0;
    this.showL = 0; this.showR = 0;
    this.heldSlot = null;

    const mk = (x) => {
      const geo = new THREE.PlaneGeometry(1, 1);
      geo.translate(0, 0.5, 0);                // bottom pivot
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        transparent: true, depthTest: false, depthWrite: false,   // soft edges for UI sprites
      }));
      m.renderOrder = 40;
      m.position.set(x, HIDDEN_Y, -0.7);
      m.visible = false;
      this.group.add(m);
      return m;
    };
    this.left = mk(-0.3);
    this.right = mk(0.3);
    this.setHeld(null);
  }

  // slot: 'knife' | 'rolling_pin' | 'flashlight' | null
  setHeld(slot) {
    this.heldSlot = slot;
    const pose = POSE[slot ?? 'none'];
    const texL = halfTex(pose, 'l') || halfTex(POSE.none, 'l');
    const texR = halfTex(pose, 'r') || halfTex(POSE.none, 'r');
    this.noArt = !texL || !texR;
    if (this.noArt) return;
    for (const [mesh, tex] of [[this.left, texL], [this.right, texR]]) {
      const mat = mesh.material;
      if (mat.map !== tex) { mat.map = tex; mat.needsUpdate = true; }
      mesh.scale.set(H * tex.userData.aspect, H, 1);
    }
  }

  update(dt, moving) {
    if (this.noArt) { this.left.visible = this.right.visible = false; return; }
    const wantL = moving;
    const wantR = moving || !!this.heldSlot;
    this.showL = Math.min(1, Math.max(0, this.showL + (wantL ? 1 : -1) * dt / EASE_T));
    this.showR = Math.min(1, Math.max(0, this.showR + (wantR ? 1 : -1) * dt / EASE_T));
    if (moving) this.phase += dt * SWING_HZ;   // swing synced to movement

    const swing = Math.sin(2 * Math.PI * this.phase);
    const sway = Math.cos(Math.PI * this.phase) * 0.006;
    const lift = (show) => HIDDEN_Y + (SHOWN_Y - HIDDEN_Y) * smooth(show);

    this.left.position.y = lift(this.showL) + swing * 0.018;             // opposite phase
    this.right.position.y = lift(this.showR) - swing * 0.018;
    this.left.position.x = -0.3 + sway;
    this.right.position.x = 0.3 + sway;
    this.left.visible = this.showL > 0.01;
    this.right.visible = this.showR > 0.01;
  }
}
