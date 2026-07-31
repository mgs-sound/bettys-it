// Loads real assets when present, otherwise hands back placeholders.
import * as THREE from 'three';
import { MANIFEST } from '../assets/manifest.js';

export function loadTexture(slot) {
  return new Promise((resolve) => {
    const url = MANIFEST.images[slot];
    if (!url) return resolve(null);
    new THREE.TextureLoader().load(
      url,
      (t) => { t.colorSpace = THREE.SRGBColorSpace; resolve(t); },
      undefined,
      () => resolve(null),
    );
  });
}

export async function loadAudioBuffer(slot, ctx) {
  const url = MANIFEST.audio[slot];
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await ctx.decodeAudioData(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export function makeCanvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeLabelSprite(text, { color = '#ffeecc', size = 44, scale = 1 } = {}) {
  const tex = makeCanvasTexture(512, 128, (g) => {
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.beginPath(); g.roundRect(4, 24, 504, 80, 16); g.fill();
    g.fillStyle = color;
    g.font = `bold ${size}px Georgia, serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 256, 64);
  });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(2.6 * scale, 0.65 * scale, 1);
  return sp;
}
