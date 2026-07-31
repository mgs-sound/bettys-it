// Betty: roams the hallway ring, chases on sight (or forever once time is up),
// grabs at close range. She can NEVER pass a closed door — closed doors are safe.
import * as THREE from 'three';
import * as MAP from './map.js';
import { loadTexture, makeCanvasTexture } from './assets.js';

const ROAM_SPEED = 2.0, CHASE_SPEED = 3.4;   // player is 4.2 — you win footraces
const SEE_DIST = 13, GRAB_DIST = 1.55;
const WAYPOINTS = [[4, 14], [54, 14], [54, 30], [4, 30]];   // hall ring corners

function placeholderFace(chasing) {
  return makeCanvasTexture(128, 192, (g) => {
    g.fillStyle = chasing ? '#7d1020' : '#b3202a';
    g.beginPath(); g.roundRect(6, 6, 116, 180, 18); g.fill();
    g.fillStyle = '#fff';
    g.beginPath(); g.ellipse(44, 62, 14, chasing ? 18 : 12, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(84, 62, 14, chasing ? 18 : 12, 0, 0, 7); g.fill();
    g.fillStyle = '#000';
    g.beginPath(); g.arc(44, 64, 6, 0, 7); g.fill();
    g.beginPath(); g.arc(84, 64, 6, 0, 7); g.fill();
    g.strokeStyle = '#000'; g.lineWidth = 4; g.beginPath();
    if (chasing) { g.moveTo(34, 100); [46, 58, 70, 82, 94].forEach((x, i) => g.lineTo(x, i % 2 ? 118 : 100)); }
    else { g.moveTo(40, 104); g.quadraticCurveTo(64, 122, 88, 104); }
    g.stroke();
    g.fillStyle = '#fff'; g.font = 'bold 26px Georgia';
    g.textAlign = 'center'; g.fillText('BETTY', 64, 160);
  });
}

export class Betty {
  constructor(scene, camera, audio) {
    this.audio = audio; this.camera = camera;
    this.state = 'roam';
    this.wp = 3;   // spawn at the far corner of the loop, away from the bedroom
    this.pos = new THREE.Vector3(WAYPOINTS[2][0], 0, WAYPOINTS[2][1]);
    this.path = null; this.repath = 0; this.lost = 0;
    this.distracted = 0; this.finale = false;

    this.texRoam = placeholderFace(false);
    this.texChase = placeholderFace(true);
    loadTexture('betty_roam').then((t) => { if (t) { this.texRoam = t; this.#refreshFace(); } });
    loadTexture('betty_chase').then((t) => { if (t) { this.texChase = t; this.#refreshFace(); } });

    this.group = new THREE.Group();
    this.sprite = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, 2.4),
      new THREE.MeshBasicMaterial({ map: this.texRoam, transparent: true, side: THREE.DoubleSide }),
    );
    this.sprite.position.y = 1.25;
    this.group.add(this.sprite);
    this.group.position.copy(this.pos);
    scene.add(this.group);

    audio.attachBetty(this.group);
  }

  #refreshFace() {
    this.sprite.material.map = this.state === 'chase' ? this.texChase : this.texRoam;
    this.sprite.material.needsUpdate = true;
  }

  cell() { return MAP.worldToCell(this.pos.x, this.pos.z); }

  canSee(game) {
    const p = game.player.pos;
    const d = Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
    if (d > SEE_DIST) return false;
    const pc = MAP.worldToCell(p.x, p.z);
    if (!MAP.isHall(pc.c, pc.r) && d > 3) return false;   // rooms are safe-ish
    return !MAP.losBlocked(this.pos.x, this.pos.z, p.x, p.z).blocked;
  }

  startChase() {
    if (this.state === 'chase') return;
    this.state = 'chase';
    this.path = null; this.repath = 0; this.lost = 0;
    this.#refreshFace();
    this.audio.scream();
    this.audio.chaseLoop(true);
  }

  calmDown() {
    this.state = 'roam';
    this.#refreshFace();
    this.audio.chaseLoop(false);
    // BFS back to the nearest ring corner, then resume the loop
    let best = 0, bestD = Infinity;
    WAYPOINTS.forEach(([x, z], i) => {
      const d = (x - this.pos.x) ** 2 + (z - this.pos.z) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    });
    this.wp = best;
    const me = this.cell(), t = MAP.worldToCell(WAYPOINTS[best][0], WAYPOINTS[best][1]);
    this.path = MAP.findPath(me.c, me.r, t.c, t.r) || [];
  }

  onFinale(cookieStolen, trayPos) {
    this.finale = true;
    if (cookieStolen) {
      // She stops to count her cookies — right next to the knife. Head start!
      this.distracted = 8;
      this.pos.set(trayPos.x, 0, trayPos.z);
      this.path = null;
      this.audio.chaseLoop(false);
    } else {
      this.startChase();
    }
  }

  #follow(dt, speed) {
    if (!this.path || !this.path.length) return false;
    const n = this.path[0];
    const dx = n.x - this.pos.x, dz = n.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.25) { this.path.shift(); return this.#follow(dt, speed); }
    const step = Math.min(speed * dt, d);
    this.pos.x += (dx / d) * step;
    this.pos.z += (dz / d) * step;
    return true;
  }

  update(dt, game) {
    const p = game.player.pos;
    const dist = Math.hypot(p.x - this.pos.x, p.z - this.pos.z);

    if (this.distracted > 0) {
      this.distracted -= dt;
      if (this.distracted <= 0) this.startChase();
    } else if (this.state === 'roam') {
      if (this.path?.length) {
        this.#follow(dt, ROAM_SPEED);                 // returning to the ring
      } else {
        const [wx, wz] = WAYPOINTS[this.wp];
        const dx = wx - this.pos.x, dz = wz - this.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.4) this.wp = (this.wp + 1) % WAYPOINTS.length;
        else {
          const step = Math.min(ROAM_SPEED * dt, d);
          this.pos.x += (dx / d) * step; this.pos.z += (dz / d) * step;
        }
      }
      if (this.finale || this.canSee(game)) this.startChase();
    } else if (this.state === 'chase') {
      this.repath -= dt;
      if (this.repath <= 0) {
        this.repath = 0.5;
        const me = this.cell(), pc = MAP.worldToCell(p.x, p.z);
        this.path = MAP.findPath(me.c, me.r, pc.c, pc.r);
      }
      if (this.path === null) {
        // sealed off behind a closed door
        if (!this.finale) { this.lost += dt; if (this.lost > 2.5) this.calmDown(); }
      } else {
        this.lost = 0;
        if (!this.#follow(dt, CHASE_SPEED) && dist > 0.3) {
          // same cell as player — walk straight at them
          this.pos.x += ((p.x - this.pos.x) / dist) * CHASE_SPEED * dt;
          this.pos.z += ((p.z - this.pos.z) / dist) * CHASE_SPEED * dt;
        }
        if (!this.finale) {
          const los = MAP.losBlocked(this.pos.x, this.pos.z, p.x, p.z);
          if (los.blocked && los.byDoor) { this.lost += dt; if (this.lost > 2.5) this.calmDown(); }
        }
      }
      if (dist < GRAB_DIST) game.capture();
    }

    // billboard toward the camera
    this.group.position.copy(this.pos);
    this.group.rotation.y = Math.atan2(this.camera.position.x - this.pos.x, this.camera.position.z - this.pos.z);
  }
}
