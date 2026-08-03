// First-person hands, screen-space at the bottom of the view.
// Art is now single RIGHT-hand images (backs of hands); the left hand is
// hands_empty mirrored horizontally. Rules: hidden at idle with empty hands ·
// both hands swing while walking (opposite phase, ~1.5Hz, slight bob) · a
// held item pins the right hand with that variant, left joins only while
// walking · show/hide slides in ~200ms.
import * as THREE from 'three';
import { TEX } from './assets.js';

const POSE = {
  none: 'hands_empty',
  key: 'hands_key',
  flashlight: 'hands_flashlight',
  knife: 'hands_knife',
  rolling_pin: 'hands_pin',
};
// SHOWN_Y is low enough that at the sway's highest point the sprite's flat
// bottom edge stays >=40px below the viewport edge (fov 75, plane at z=-0.7:
// view bottom is y=-0.537; peak bottom here is -0.62+0.012=-0.608)
const SHOWN_Y = -0.62, HIDDEN_Y = -0.95;
const EASE_T = 0.2, SWING_HZ = 1.5, W = 0.2; // fixed hand width; item art extends upward
const SWAY_AMP = 0.012;
const smooth = (t) => t * t * (3 - 2 * t);

// the art is a LEFT hand (thumb on the image's right): unmirrored art goes on
// the screen-left; the right hand mirrors it so both thumbs point inside
const mirrorCache = new Map();
function mirroredTex(slot) {
  if (mirrorCache.has(slot)) return mirrorCache.get(slot);
  const base = TEX[slot];
  if (!base) return null;
  const t = base.clone();
  t.repeat.x = -1;
  t.offset.x = 1;
  t.needsUpdate = true;
  t.userData = { aspect: base.userData.aspect || 0.93 };
  mirrorCache.set(slot, t);
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
        // blend for softness, with a mild alphaTest to trim the magenta matte fringe
        transparent: true, alphaTest: 0.3, depthTest: false, depthWrite: false,
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

  #apply(mesh, tex) {
    if (!tex) return false;
    const mat = mesh.material;
    if (mat.map !== tex) { mat.map = tex; mat.needsUpdate = true; }
    const a = tex.userData.aspect || 0.9;
    mesh.scale.set(W, W / a, 1);               // fixed width; height grows with the item
    return true;
  }

  // slot: 'knife' | 'rolling_pin' | 'flashlight' | 'key' | null
  setHeld(slot) {
    this.heldSlot = slot;
    // item variant rides the RIGHT hand (mirrored left-hand art);
    // the off-hand is plain hands_empty, unmirrored, at screen-left
    const pose = POSE[slot ?? 'none'];
    const okR = this.#apply(this.right, mirroredTex(pose) || mirroredTex(POSE.none));
    const okL = this.#apply(this.left, TEX[POSE.none]);
    this.noArt = !okR || !okL;
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

    this.left.position.y = lift(this.showL) + swing * SWAY_AMP;          // opposite phase
    this.right.position.y = lift(this.showR) - swing * SWAY_AMP;
    this.left.position.x = -0.3 + sway;
    this.right.position.x = 0.3 + sway;
    this.left.visible = this.showL > 0.01;
    this.right.visible = this.showR > 0.01;
  }
}
