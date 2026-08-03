// First-person hands: one camera-space illustration anchored to the bottom of
// the viewport, swapped whole by held item (the art includes the item), with
// a subtle walk sway. Slots: hands_empty / hands_flashlight / hands_knife /
// hands_pin. If the art is missing entirely, the overlay just hides.
import * as THREE from 'three';
import { TEX } from './assets.js';

const POSE = {
  none: 'hands_empty',
  flashlight: 'hands_flashlight',
  knife: 'hands_knife',
  rolling_pin: 'hands_pin',
};
const BOTTOM = -0.56;   // just below the view edge at z=-0.7 (classic FP crop)

export class Hands {
  constructor(camera) {
    this.group = new THREE.Group();
    camera.add(this.group);
    this.swayT = 0;

    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0, 0.5, 0);                  // bottom pivot
    this.plane = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.5, depthTest: false }));
    this.plane.renderOrder = 40;
    this.plane.position.set(0, BOTTOM, -0.7);
    this.group.add(this.plane);
    this.setHeld(null);
  }

  // slot: 'knife' | 'rolling_pin' | 'flashlight' | null
  setHeld(slot) {
    const tex = TEX[POSE[slot ?? 'none']] || TEX[POSE.none];
    if (!tex) { this.plane.visible = false; return; }
    this.plane.visible = true;
    const mat = this.plane.material;
    if (mat.map !== tex) { mat.map = tex; mat.needsUpdate = true; }
    const h = 0.3;
    this.plane.scale.set(h * (tex.userData.aspect || 1.9), h, 1);
  }

  update(dt, moving) {
    this.swayT += dt * (moving ? 7 : 1.6);
    this.plane.position.y = BOTTOM + Math.sin(this.swayT) * (moving ? 0.014 : 0.004);
    this.plane.position.x = Math.cos(this.swayT / 2) * (moving ? 0.01 : 0.003);
  }
}
