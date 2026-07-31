// Loads real assets when present, otherwise hands back placeholders.
// All game textures live in TEX after preloadTextures() resolves (null = missing).
import * as THREE from 'three';
import { MANIFEST } from '../assets/manifest.js';

export const TEX = {};

export function loadTexture(slot) {
  return new Promise((resolve) => {
    const url = MANIFEST.images[slot];
    if (!url) return resolve(null);
    new THREE.TextureLoader().load(
      url,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.magFilter = THREE.NearestFilter;     // crisp pixel art
        t.userData.aspect = t.image.width / t.image.height;
        resolve(t);
      },
      undefined,
      () => resolve(null),
    );
  });
}

let preloading = null;
export function preloadTextures() {
  preloading ??= Promise.all(
    Object.keys(MANIFEST.images).map(async (slot) => { TEX[slot] = await loadTexture(slot); }),
  ).then(() => TEX);
  return preloading;
}

// seamless tile: repeat set from the world-space size of the mesh it covers
export function tileTexture(slot, worldW, worldH, unitsPerTile) {
  const base = TEX[slot];
  if (!base) return null;
  const t = base.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(worldW / unitsPerTile, worldH / unitsPerTile);
  t.needsUpdate = true;
  return t;
}

// transparent-PNG cutout material (sprites, props, portraits, windows, doors)
export function cutoutMaterial(slot, opts = {}) {
  const t = TEX[slot];
  if (!t) return null;
  return new THREE.MeshLambertMaterial({
    map: t, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, ...opts,
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
