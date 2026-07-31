// The mansion: a cell grid. '#' wall, '.' room floor, 'h' hallway, 'D' door.
// One cell = 2m. Halls form a ring around the center block (library + attic);
// rooms hang off the north and south sides.
import * as THREE from 'three';
import { makeLabelSprite } from './assets.js';

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
      propped: false, openT: 0, target: 0, mesh: null,
    };
    doors.push(d); doorsByKey.set(c + ',' + r, d);
  }
}

function solidForPlayer(c, r) {
  const ch = cellChar(c, r);
  if (ch === '#') return true;
  if (ch === 'D') { const d = doorAt(c, r); return d && d.openT < 0.5; }
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
      if (d && d.openT < 0.5) return { blocked: true, byDoor: true };
    }
  }
  return { blocked: false, byDoor: false };
}

// ---- Pathfinding (Betty). She cannot pass closed doors. ----------------
export function passableForBetty(c, r) {
  const ch = cellChar(c, r);
  if (ch === '#') return false;
  if (ch === 'D') { const d = doorAt(c, r); return !d || d.openT > 0.5 || d.propped; }
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
export function buildMap(scene) {
  makeDoors();
  const lamps = [];

  const floorMat = new THREE.MeshLambertMaterial({ color: 0x2a211b });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W * CELL, H * CELL), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(W * CELL / 2, 0, H * CELL / 2);
  scene.add(floor);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W * CELL, H * CELL),
    new THREE.MeshLambertMaterial({ color: 0x1a1512 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(W * CELL / 2, WALL_H, H * CELL / 2);
  scene.add(ceil);

  // room floor patches so each room reads differently in placeholder-land
  const patchMat = new THREE.MeshLambertMaterial({ color: 0x3a2d22 });
  for (const rm of ROOMS) {
    const w = (rm.c1 - rm.c0 + 1) * CELL, d = (rm.r1 - rm.r0 + 1) * CELL;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), patchMat);
    p.rotation.x = -Math.PI / 2;
    p.position.set(rm.c0 * CELL + w / 2, 0.01, rm.r0 * CELL + d / 2);
    scene.add(p);
    const label = makeLabelSprite(rm.name, { color: '#c9b489', scale: 1.6 });
    const ctr = cellToWorld((rm.c0 + rm.c1) / 2, (rm.r0 + rm.r1) / 2);
    label.position.set(ctr.x, 2.55, ctr.z);
    scene.add(label);
    const lamp = new THREE.PointLight(0xffd9a0, 12, 16, 1.6);
    lamp.position.set(ctr.x, 2.7, ctr.z);
    lamp.userData.base = 12;
    scene.add(lamp); lamps.push(lamp);
  }
  // hallway lamps
  for (const [c, r] of [[2, 6.5], [14, 6.5], [26, 6.5], [2, 14.5], [14, 14.5], [26, 14.5], [2, 10.5], [26, 10.5]]) {
    const { x, z } = cellToWorld(c, r);
    const lamp = new THREE.PointLight(0xd9c9ff, 8, 13, 1.6);
    lamp.position.set(x, 2.8, z);
    lamp.userData.base = 8;
    scene.add(lamp); lamps.push(lamp);
  }

  // walls as one instanced mesh
  const wallCells = [];
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (GRID[r][c] === '#') wallCells.push([c, r]);
  const wallGeo = new THREE.BoxGeometry(CELL, WALL_H, CELL);
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x4d3d33 });
  const walls = new THREE.InstancedMesh(wallGeo, wallMat, wallCells.length);
  const m = new THREE.Matrix4();
  wallCells.forEach(([c, r], i) => {
    const { x, z } = cellToWorld(c, r);
    m.setPosition(x, WALL_H / 2, z);
    walls.setMatrixAt(i, m);
  });
  scene.add(walls);

  // door slabs — slide up into the ceiling when opened
  const doorMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
  const lockedMat = new THREE.MeshLambertMaterial({ color: 0x50331c });
  const propMat = new THREE.MeshLambertMaterial({ color: 0x5a6b3a });
  for (const d of doors) {
    // door in an E-W wall spans X; door in a N-S wall spans Z
    const g = d.vertical
      ? new THREE.BoxGeometry(0.35, WALL_H - 0.3, CELL * 0.98)
      : new THREE.BoxGeometry(CELL * 0.98, WALL_H - 0.3, 0.35);
    d.mesh = new THREE.Mesh(g, d.locked ? lockedMat : doorMat);
    d.mats = { doorMat, propMat, lockedMat };
    const { x, z } = cellToWorld(d.c, d.r);
    d.baseY = (WALL_H - 0.3) / 2;
    d.mesh.position.set(x, d.baseY, z);
    scene.add(d.mesh);
  }

  return { lamps };
}

export function updateDoors(dt, audio) {
  for (const d of doors) {
    const to = d.propped ? 1 : d.target;
    if (Math.abs(d.openT - to) > 0.001) {
      d.openT += Math.sign(to - d.openT) * Math.min(Math.abs(to - d.openT), dt * 1.8);
      d.mesh.position.y = d.baseY + d.openT * (WALL_H - 0.5);
    }
  }
}

export function toggleDoor(d, audio, toast) {
  if (d.locked) { audio?.thud(); toast?.('Locked. There must be a key…'); return; }
  if (d.propped) { toast?.('Propped open — it stays open now.'); return; }
  d.target = d.target > 0.5 ? 0 : 1;
  audio?.creak();
}
