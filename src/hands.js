// First-person hands: two camera-space planes at the bottom of the view with a
// walk sway. The right hand shows what you're carrying (knife > pin > light).
// Real hand art lands via the 'hands' manifest slot; until then, canvas mitts.
import * as THREE from 'three';
import { TEX, makeCanvasTexture } from './assets.js';

function placeholderMitt() {
  return makeCanvasTexture(128, 128, (g) => {
    g.fillStyle = '#caa287';
    g.beginPath(); g.roundRect(34, 40, 60, 84, 26); g.fill();     // palm
    g.beginPath(); g.ellipse(30, 84, 14, 22, -0.5, 0, 7); g.fill(); // thumb
    g.strokeStyle = '#8a6a52'; g.lineWidth = 3;
    for (const x of [48, 62, 76]) { g.beginPath(); g.moveTo(x, 44); g.lineTo(x, 70); g.stroke(); }
  });
}

function placeholderPin() {
  return makeCanvasTexture(128, 64, (g) => {
    g.fillStyle = '#a2703f';
    g.beginPath(); g.roundRect(20, 22, 88, 20, 10); g.fill();     // roller
    g.fillStyle = '#7a5028';
    g.beginPath(); g.roundRect(2, 26, 20, 12, 6); g.fill();       // handles
    g.beginPath(); g.roundRect(106, 26, 20, 12, 6); g.fill();
  });
}

export class Hands {
  constructor(camera) {
    this.group = new THREE.Group();
    camera.add(this.group);
    this.swayT = 0;

    const tex = TEX.hands || placeholderMitt();
    const mirrored = tex.clone();
    mirrored.repeat.x = -1; mirrored.offset.x = 1; mirrored.needsUpdate = true;

    const mk = (map) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(0.14, 0.14),
        new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: 0.5, depthTest: false }));
      m.renderOrder = 40;
      this.group.add(m);
      return m;
    };
    this.left = mk(mirrored);
    this.right = mk(tex);
    this.left.position.set(-0.3, -0.34, -0.7);
    this.right.position.set(0.3, -0.34, -0.7);
    this.left.rotation.z = 0.3; this.right.rotation.z = -0.3;

    this.held = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.5, depthTest: false, visible: false }));
    this.held.renderOrder = 41;
    this.held.position.set(0.3, -0.26, -0.72);
    this.group.add(this.held);
  }

  // slot: 'knife' | 'rolling_pin' | 'flashlight' | null
  setHeld(slot) {
    if (!slot) { this.held.material.visible = false; return; }
    const tex = TEX[slot] || (slot === 'rolling_pin' ? placeholderPin() : null);
    if (!tex) { this.held.material.visible = false; return; }
    const mat = this.held.material;
    mat.map = tex; mat.visible = true; mat.needsUpdate = true;
    if (slot === 'knife') { mat.alphaTest = 0; mat.depthWrite = false; }   // keep its glow feathered
    else { mat.alphaTest = 0.5; mat.depthWrite = true; }
    const a = tex.userData?.aspect || 1;
    const h = slot === 'rolling_pin' ? 0.16 : 0.24;
    this.held.scale.set(h * a, h, 1);
    this.held.rotation.z = -0.35;
  }

  update(dt, moving) {
    this.swayT += dt * (moving ? 7 : 1.6);
    const bob = Math.sin(this.swayT) * (moving ? 0.014 : 0.004);
    const sway = Math.cos(this.swayT / 2) * (moving ? 0.01 : 0.003);
    this.left.position.y = -0.34 + bob;
    this.right.position.y = -0.34 + bob * 1.15;
    this.left.position.x = -0.3 + sway;
    this.right.position.x = 0.3 + sway;
    this.held.position.y = -0.26 + bob * 1.15;
    this.held.position.x = 0.3 + sway;
  }
}
