// The mansion: a cell grid. '#' wall, '.' room floor, 'h' hallway, 'D' door.
// One cell = 2m. Halls form a ring around the center block (library + attic);
// rooms hang off the north and south sides.
import * as THREE from 'three';
import { TEX, tileTexture, cutoutMaterial, makeLabelSprite, bottomPadFraction } from './assets.js';

export const CELL = 2;
export const GRID = [
  '#############################',
  '#......#........#...........#',
  '#......#........#...........#',
  '#......#........#...........#',
  '#......#........#...........#',
  '###D#######D#########D#######',
  '#hhhhhhhhhhhhhhhhhhhhhhhhhhh#',
  '#hhhhhhhhhhhhhhhhhhhhhhhhhhh#',
  '#hh#####D#################hh#',
  '#hh#..........#....#.....#hh#',
  '#hh#..........#....D.....#hh#',
  '#hh#..........#....#.....#hh#',
  '#hh#..........#....#.....#hh#',
  '#hh#####D########D########hh#',
  '#hhhhhhhhhhhhhhhhhhhhhhhhhhh#',
  '#hhhhhhhhhhhhhhhhhhhhhhhhhhh#',
  '###D#######D############D####',
  '#......#.......#............#',
  '#......#.......#............#',
  '#......#.......#............#',
  '#############################',
];
export const W = GRID[0].length, H = GRID.length;
export const WALL_H = 3.2;

export const ROOMS = [
  { name: 'Guest Bedroom', c0: 1,  r0: 1,  c1: 6,  r1: 4 },
  { name: 'Kitchen',       c0: 8,  r0: 1,  c1: 15, r1: 4 },
  { name: 'Dining Room',   c0: 17, r0: 1,  c1: 27, r1: 4 },
  { name: 'Library',       c0: 4,  r0: 9,  c1: 13, r1: 12 },
  { name: 'Attic Stairs',  c0: 15, r0: 9,  c1: 18, r1: 12 },
  { name: 'Attic',         c0: 20, r0: 9,  c1: 24, r1: 12 },
  { name: 'Basement',      c0: 1,  r0: 17, c1: 6,  r1: 19 },
  { name: 'Entry Hall',    c0: 8,  r0: 17, c1: 14, r1: 19 },
  { name: 'Garden Room',   c0: 16, r0: 17, c1: 27, r1: 19 },
];

// Furniture: one entry per piece. `slot` pieces render the illustrated art as
// a floor-standing billboard plane; entries without art (or `box` pieces —
// counters, crates, planters) render as colored volumes. Every piece gets a
// collider and blocks its cell for Betty's pathfinding.
// Placement rules: never on door-approach cells, task-item cells, or spawn.
const FURNITURE = [
  // Guest bedroom — bed; dresser + cabinet + dark-corner chair are key spots
  { slot: 'bed', c: 4, r: 1, h: 1.55, color: 0x4a2e3e },
  { slot: 'dresser', c: 1, r: 2, h: 1.35, color: 0x5a4630 },
  { slot: 'cabinet', c: 6, r: 2, h: 1.8, color: 0x4a3a2a },
  { slot: 'chair', c: 6, r: 4, h: 1.35, color: 0x3a3430 },
  // Kitchen — counters (props sit on them), table + chairs
  { box: 0x6a5a4a, c: 8, r: 1, h: 0.95 }, { box: 0x6a5a4a, c: 9, r: 1, h: 0.95 },
  { box: 0x6a5a4a, c: 10, r: 1, h: 0.95 }, { box: 0x6a5a4a, c: 12, r: 1, h: 0.95 },
  { box: 0x6a5a4a, c: 15, r: 1, h: 0.95 },
  { slot: 'table', c: 11, r: 3, h: 1.4, color: 0x6a4a2a },
  { slot: 'chair', c: 10, r: 3, h: 1.35, color: 0x5a4630 },
  { slot: 'chair', c: 13, r: 3, h: 1.35, color: 0x5a4630 },
  // Dining room — tables, chairs, cabinet
  { slot: 'table', c: 21, r: 2, h: 1.4, color: 0x6a4a2a },
  { slot: 'table', c: 23, r: 2, h: 1.4, color: 0x6a4a2a },
  { slot: 'chair', c: 20, r: 1, h: 1.35, color: 0x5a4630 },
  { slot: 'chair', c: 22, r: 1, h: 1.35, color: 0x5a4630 },
  { slot: 'chair', c: 24, r: 1, h: 1.35, color: 0x5a4630 },
  { slot: 'chair', c: 21, r: 3, h: 1.35, color: 0x5a4630 },
  { slot: 'chair', c: 23, r: 3, h: 1.35, color: 0x5a4630 },
  { slot: 'cabinet', c: 26, r: 2, h: 1.8, color: 0x4a3a2a },
  // Library — shelves, reading table
  { slot: 'bookshelf', c: 5, r: 9, h: 2.1, color: 0x4a3626 },
  { slot: 'bookshelf', c: 6, r: 9, h: 2.1, color: 0x4a3626 },
  { slot: 'bookshelf', c: 10, r: 9, h: 2.1, color: 0x4a3626 },
  { slot: 'bookshelf', c: 12, r: 9, h: 2.1, color: 0x4a3626 },
  { slot: 'bookshelf', c: 5, r: 12, h: 2.1, color: 0x4a3626 },
  { slot: 'bookshelf', c: 11, r: 12, h: 2.1, color: 0x4a3626 },
  { slot: 'bookshelf', c: 12, r: 12, h: 2.1, color: 0x4a3626 },
  { slot: 'table', c: 9, r: 10, h: 1.4, color: 0x6a4a2a },
  { slot: 'chair', c: 9, r: 11, h: 1.35, color: 0x5a4630 },
  // Attic stairs — sparse
  { box: 0x5a4a3a, c: 15, r: 9, h: 0.7 },
  { slot: 'bookshelf', c: 15, r: 12, h: 1.9, color: 0x4a3626 },
  // Attic — crates and junk
  { box: 0x5a4a3a, c: 20, r: 9, h: 0.7 }, { box: 0x5a4a3a, c: 21, r: 9, h: 0.7 },
  { slot: 'bookshelf', c: 24, r: 11, h: 1.9, color: 0x4a3626 },
  { box: 0x3a3430, c: 24, r: 12, h: 0.5 },
  // Basement — abandoned junk (sparse, broken)
  { slot: 'bookshelf', c: 1, r: 17, h: 1.9, color: 0x3a3a42 },
  { box: 0x44403a, c: 6, r: 19, h: 0.6 }, { box: 0x35322e, c: 1, r: 19, h: 0.4 },
  { box: 0x3a3a42, c: 6, r: 17, h: 0.5 },
  // Entry hall
  { slot: 'table', c: 8, r: 17, h: 1.4, color: 0x5a4630 },
  { slot: 'chair', c: 9, r: 19, h: 1.35, color: 0x5a4630 },
  { slot: 'cabinet', c: 14, r: 17, h: 1.8, color: 0x4a3a2a },
  // Garden room — planters
  { box: 0x4a5a3a, c: 17, r: 17, h: 0.6 }, { box: 0x4a5a3a, c: 19, r: 19, h: 0.6 },
  { box: 0x4a5a3a, c: 21, r: 17, h: 0.6 }, { box: 0x4a5a3a, c: 26, r: 18, h: 0.6 },
];
const obstacles = [];              // world-space AABBs for player collision
const furnitureCells = new Set();  // Betty walks around furniture
const furniturePlanes = [];        // textured pieces billboard toward the camera

export function cellChar(c, r) {
  if (r < 0 || r >= H || c < 0 || c >= W) return '#';
  return GRID[r][c];
}
export function cellToWorld(c, r) { return { x: (c + 0.5) * CELL, z: (r + 0.5) * CELL }; }
export function worldToCell(x, z) { return { c: Math.floor(x / CELL), r: Math.floor(z / CELL) }; }
export function isHall(c, r) { const ch = cellChar(c, r); return ch === 'h' || ch === 'D'; }

// ---- Doors --------------------------------------------------------------
export const doors = [];
const doorsByKey = new Map();
export function doorAt(c, r) { return doorsByKey.get(c + ',' + r); }

function makeDoors() {
  doors.length = 0; doorsByKey.clear();
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    if (GRID[r][c] !== 'D') continue;
    const vertical = cellChar(c, r - 1) === '#' && cellChar(c, r + 1) === '#'; // door in a N-S wall
    const d = {
      c, r, vertical,
      locked: (c === 3 && r === 5),                 // guest bedroom starts locked
      propped: false, openT: 0, openF: 0, target: 0, mesh: null,
    };
    doors.push(d); doorsByKey.set(c + ',' + r, d);
  }
}

function solidForPlayer(c, r) {
  const ch = cellChar(c, r);
  if (ch === '#') return true;
  if (ch === 'D') { const d = doorAt(c, r); return d && d.openF < 0.3; }  // blocks until ~30% swung
  return false;
}

export function blockedCircle(x, z, rad) {
  const c0 = Math.floor((x - rad) / CELL), c1 = Math.floor((x + rad) / CELL);
  const r0 = Math.floor((z - rad) / CELL), r1 = Math.floor((z + rad) / CELL);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    if (!solidForPlayer(c, r)) continue;
    const nx = Math.max(c * CELL, Math.min(x, (c + 1) * CELL));
    const nz = Math.max(r * CELL, Math.min(z, (r + 1) * CELL));
    if ((x - nx) ** 2 + (z - nz) ** 2 < rad * rad) return true;
  }
  for (const o of obstacles) {
    const nx = Math.max(o.x0, Math.min(x, o.x1));
    const nz = Math.max(o.z0, Math.min(z, o.z1));
    if ((x - nx) ** 2 + (z - nz) ** 2 < rad * rad) return true;
  }
  return false;
}

// Sample a line; report if a wall or a closed door interrupts it.
export function losBlocked(ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const dist = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(dist / 0.35));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const { c, r } = worldToCell(ax + dx * t, az + dz * t);
    const ch = cellChar(c, r);
    if (ch === '#') return { blocked: true, byDoor: false };
    if (ch === 'D') {
      const d = doorAt(c, r);
      if (d && d.openF < 0.5) return { blocked: true, byDoor: true };
    }
  }
  return { blocked: false, byDoor: false };
}

// ---- Pathfinding (Betty). She cannot pass closed doors. ----------------
export function passableForBetty(c, r) {
  const ch = cellChar(c, r);
  if (ch === '#') return false;
  if (furnitureCells.has(c + ',' + r)) return false;
  if (ch === 'D') { const d = doorAt(c, r); return !d || d.openF > 0.5 || d.propped; }
  return true;
}

export function findPath(c0, r0, c1, r1) {
  if (c0 === c1 && r0 === r1) return [];
  const prev = new Map();
  const key = (c, r) => c + r * W;
  const q = [[c0, r0]];
  prev.set(key(c0, r0), null);
  while (q.length) {
    const [c, r] = q.shift();
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr, k = key(nc, nr);
      if (prev.has(k) || !passableForBetty(nc, nr)) continue;
      prev.set(k, [c, r]);
      if (nc === c1 && nr === r1) {
        const path = [];
        let cur = [nc, nr];
        while (cur) { path.push(cur); cur = prev.get(key(cur[0], cur[1])); }
        path.reverse(); path.shift();
        return path.map(([pc, pr]) => cellToWorld(pc, pr));
      }
      q.push([nc, nr]);
    }
  }
  return null;
}

// ---- Geometry -----------------------------------------------------------
const WALL_EPS = 0.02;   // wall-mounted planes float this far off the wall face

// small plane hung on a wall (windows, portraits, wall props)
export function wallPlane(scene, slot, x, y, z, rotY, h, wOverride) {
  const mat = cutoutMaterial(slot);
  if (!mat) return null;
  const w = wOverride ?? h * (TEX[slot].userData.aspect || 1);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  p.position.set(x, y, z);
  p.rotation.y = rotY;
  scene.add(p);
  return p;
}

export function buildMap(scene) {
  makeDoors();
  const lamps = [];

  // floors: photographic wood everywhere, tiled denser so the boards read real
  const woodTex = tileTexture('floor_wood', W * CELL, H * CELL, 1.0);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W * CELL, H * CELL),
    new THREE.MeshLambertMaterial(woodTex ? { map: woodTex } : { color: 0x2a211b }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(W * CELL / 2, 0, H * CELL / 2);
  scene.add(floor);

  // cutout rugs laid flat over the wood in a few rooms
  if (TEX.carpet_rug) {
    const rugA = TEX.carpet_rug.userData.aspect || 1.5;
    for (const [cx, cz, wRug, rot] of [
      [8, 6.5, 3.4, 0.06],     // guest bedroom
      [18, 21, 3.8, -0.04],    // library, under the reading table
      [45, 6, 4.2, 0.02],      // dining room, under the tables
    ]) {
      const rug = new THREE.Mesh(
        new THREE.PlaneGeometry(wRug, wRug / rugA),
        new THREE.MeshLambertMaterial({ map: TEX.carpet_rug, transparent: true, alphaTest: 0.5 }));
      rug.rotation.x = -Math.PI / 2;
      rug.rotation.z = rot;
      rug.position.set(cx, 0.015, cz);
      scene.add(rug);
    }
  }

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W * CELL, H * CELL),
    new THREE.MeshLambertMaterial({ color: 0x1a1512 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(W * CELL / 2, WALL_H, H * CELL / 2);
  scene.add(ceil);

  for (const rm of ROOMS) {
    const w = (rm.c1 - rm.c0 + 1) * CELL, d = (rm.r1 - rm.r0 + 1) * CELL;
    // the basement floor is a cold, grimy shadow of the wood elsewhere
    if (rm.name === 'Basement') {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
        new THREE.MeshLambertMaterial({ color: 0x1a1c26, transparent: true, opacity: 0.55 }));
      p.rotation.x = -Math.PI / 2;
      p.position.set(rm.c0 * CELL + w / 2, 0.01, rm.r0 * CELL + d / 2);
      scene.add(p);
    }
    const label = makeLabelSprite(rm.name, { color: '#c9b489', scale: 1.15 });
    const ctr = cellToWorld((rm.c0 + rm.c1) / 2, (rm.r0 + rm.r1) / 2);
    label.position.set(ctr.x, 2.85, ctr.z);
    scene.add(label);
    // the basement is abandoned: colder, much dimmer than everywhere else
    const cold = rm.name === 'Basement';
    const lamp = new THREE.PointLight(cold ? 0x9ab8e0 : 0xffd9a0, cold ? 7 : 24, 17, 1.6);
    lamp.position.set(ctr.x, 2.7, ctr.z);
    lamp.userData.base = lamp.intensity;
    scene.add(lamp); lamps.push(lamp);
  }
  // hallway lamps — colder and dimmer than the rooms: halls are dangerous
  for (const [c, r] of [[2, 6.5], [14, 6.5], [26, 6.5], [2, 14.5], [14, 14.5], [26, 14.5], [2, 10.5], [26, 10.5]]) {
    const { x, z } = cellToWorld(c, r);
    const lamp = new THREE.PointLight(0xaebede, 11, 14, 1.6);
    lamp.position.set(x, 2.8, z);
    lamp.userData.base = 11;
    scene.add(lamp); lamps.push(lamp);
  }

  // furniture: illustrated pieces as floor-standing billboard planes, plain
  // volumes elsewhere; all get colliders and block their cell for Betty
  obstacles.length = 0; furnitureCells.clear(); furniturePlanes.length = 0;
  for (const f of FURNITURE) {
    const { x, z } = cellToWorld(f.c, f.r);
    const tex = f.slot && TEX[f.slot];
    if (tex) {
      const h = f.h, w = h * (tex.userData.aspect || 1);
      const geo = new THREE.PlaneGeometry(w, h);
      geo.translate(0, h / 2, 0);
      const mesh = new THREE.Mesh(geo, cutoutMaterial(f.slot));
      mesh.position.set(x, -bottomPadFraction(tex) * h, z);
      scene.add(mesh);
      furniturePlanes.push(mesh);
      const half = Math.min(0.85, w / 2 + 0.1);
      obstacles.push({ x0: x - half, z0: z - half, x1: x + half, z1: z + half });
    } else {
      const fh = f.h, color = f.box ?? f.color;
      const x0 = f.c * CELL + 0.15, x1 = (f.c + 1) * CELL - 0.15;
      const z0 = f.r * CELL + 0.15, z1 = (f.r + 1) * CELL - 0.15;
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(x1 - x0, fh, z1 - z0),
        new THREE.MeshLambertMaterial({ color }));
      box.position.set((x0 + x1) / 2, fh / 2, (z0 + z1) / 2);
      scene.add(box);
      obstacles.push({ x0, z0, x1, z1 });
    }
    furnitureCells.add(f.c + ',' + f.r);
  }

  // walls as one instanced mesh — photographic wallpaper, denser tiling
  const wallCells = [];
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (GRID[r][c] === '#') wallCells.push([c, r]);
  const wallTex = tileTexture('wallpaper', CELL, WALL_H, 1.35);
  const wallGeo = new THREE.BoxGeometry(CELL, WALL_H, CELL);
  const wallMat = new THREE.MeshLambertMaterial(wallTex ? { map: wallTex } : { color: 0x4d3d33 });
  const walls = new THREE.InstancedMesh(wallGeo, wallMat, wallCells.length);
  const m = new THREE.Matrix4();
  wallCells.forEach(([c, r], i) => {
    const { x, z } = cellToWorld(c, r);
    m.setPosition(x, WALL_H / 2, z);
    walls.setMatrixAt(i, m);
  });
  scene.add(walls);

  // door slabs — hinged at one edge of the frame, swinging into the room
  const doorH = WALL_H - 0.3, doorW = CELL * 0.98;
  for (const d of doors) {
    let mats, geo;
    if (TEX.door) {
      mats = {
        doorMat: cutoutMaterial('door'),
        lockedMat: cutoutMaterial('door', { color: 0x8a8ab8 }),
        propMat: cutoutMaterial('door', { color: 0xa8e0a0 }),
      };
      geo = new THREE.PlaneGeometry(doorW, doorH);
    } else {
      mats = {
        doorMat: new THREE.MeshLambertMaterial({ color: 0x6b4a2a }),
        lockedMat: new THREE.MeshLambertMaterial({ color: 0x50331c }),
        propMat: new THREE.MeshLambertMaterial({ color: 0x5a6b3a }),
      };
      geo = new THREE.BoxGeometry(doorW, doorH, 0.15);
    }
    geo.translate(doorW / 2, 0, 0);              // hinge at the local origin
    d.mesh = new THREE.Mesh(geo, d.locked ? mats.lockedMat : mats.doorMat);
    d.mats = mats;
    d.pivot = new THREE.Group();
    const { x, z } = cellToWorld(d.c, d.r);
    if (d.vertical) {
      // slab runs N-S; hinge on the north jamb, swing away from any hallway to the east
      d.pivot.position.set(x, doorH / 2, z - CELL * 0.49);
      d.baseRot = -Math.PI / 2;
      d.swing = cellChar(d.c + 1, d.r) === 'h' ? -1 : 1;
    } else {
      // slab runs E-W; hinge on the west jamb, swing away from the hallway side
      d.pivot.position.set(x - CELL * 0.49, doorH / 2, z);
      d.baseRot = 0;
      d.swing = cellChar(d.c, d.r + 1) === 'h' ? 1 : -1;   // hall south -> swing north
    }
    d.pivot.rotation.y = d.baseRot;
    d.pivot.add(d.mesh);
    scene.add(d.pivot);
  }

  // windows on exterior-facing room walls
  const northZ = CELL + WALL_EPS, southZ = (H - 1) * CELL - WALL_EPS;
  const westX = CELL + WALL_EPS, eastX = (W - 1) * CELL - WALL_EPS;
  for (const [x, z, rotY] of [
    [8, northZ, 0], [24, northZ, 0], [40, northZ, 0], [50, northZ, 0],       // bedroom, kitchen, dining
    [7, southZ, Math.PI], [38, southZ, Math.PI], [52, southZ, Math.PI],      // basement, garden
    [westX, 5, Math.PI / 2], [westX, 37, Math.PI / 2],                       // bedroom W, basement W
    [eastX, 6, -Math.PI / 2], [eastX, 37, -Math.PI / 2],                     // dining E, garden E
  ]) wallPlane(scene, 'window', x, 1.8, z, rotY, 2.0);

  // ancestor portraits down the hallways, irregular spacing + varied heights
  const hallN = 6 * CELL + WALL_EPS;          // north hall's north wall face
  const hallS = 16 * CELL - WALL_EPS;         // south hall's south wall face
  const portraitSpots = [
    ['portrait_1', 11, 1.8, hallN, 0], ['portrait_2', 18.5, 1.95, hallN, 0],
    ['portrait_3', 31, 1.7, hallN, 0], ['portrait_1', 38, 1.85, hallN, 0],
    ['portrait_2', 9.5, 1.75, hallS, Math.PI], ['portrait_3', 19, 1.9, hallS, Math.PI],
    ['portrait_1', 30, 1.65, hallS, Math.PI], ['portrait_2', 39, 1.8, hallS, Math.PI],
  ];
  for (const [slot, x, y, z, rotY] of portraitSpots) wallPlane(scene, slot, x, y, z, rotY, 1.15);
  wallPlane(scene, 'portrait_3', westX, 1.85, 17, Math.PI / 2, 1.15);
  wallPlane(scene, 'portrait_1', westX, 1.7, 23.5, Math.PI / 2, 1.15);
  wallPlane(scene, 'portrait_2', eastX, 1.9, 18.5, -Math.PI / 2, 1.15);
  wallPlane(scene, 'portrait_3', eastX, 1.75, 25, -Math.PI / 2, 1.15);

  return { lamps };
}

// illustrated furniture faces the camera (y-axis only)
export function updateFurniture(camera) {
  for (const m of furniturePlanes) {
    m.rotation.y = Math.atan2(camera.position.x - m.position.x, camera.position.z - m.position.z);
  }
}

const SWING_ANGLE = THREE.MathUtils.degToRad(100);
export function updateDoors(dt) {
  for (const d of doors) {
    const to = d.propped ? 1 : d.target;
    if (Math.abs(d.openT - to) > 0.0005) {
      d.openT += Math.sign(to - d.openT) * Math.min(Math.abs(to - d.openT), dt / 0.4);
      d.openF = 1 - (1 - d.openT) ** 3;          // ease-out on the swing
      d.pivot.rotation.y = d.baseRot + d.swing * SWING_ANGLE * d.openF;
    }
  }
}

export function toggleDoor(d, audio, toast) {
  if (d.locked) { audio?.thud(); toast?.('Locked. There must be a key…'); return; }
  if (d.propped) { toast?.('Propped open — it stays open now.'); return; }
  d.target = d.target > 0.5 ? 0 : 1;
  audio?.creak();
}
