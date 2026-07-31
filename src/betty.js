// Betty: roams the hallway ring, chases on sight (or forever once time is up),
// grabs at close range. She can NEVER pass a closed door — closed doors are safe.
// Rendered as a camera-facing plane; texture picked per-frame from the angle
// between her facing direction and the camera (8 sectors, side art mirrors).
import * as THREE from 'three';
import * as MAP from './map.js';
import { TEX, makeCanvasTexture } from './assets.js';

const ROAM_SPEED = 2.0, CHASE_SPEED = 3.4;   // player is 4.2 — you win footraces
const SEE_DIST = 13, GRAB_DIST = 1.55;
const SPRITE_H = 2.4;
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
    this.audio = audio; this.camera = camera; this.scene = scene;
    this.state = 'roam';
    this.wp = 3;   // spawn at the far corner of the loop, away from the bedroom
    this.pos = new THREE.Vector3(WAYPOINTS[2][0], 0, WAYPOINTS[2][1]);
    this.path = null; this.repath = 0; this.lost = 0;
    this.distracted = 0; this.finale = false;
    this.facing = 0; this.animT = 0; this.captured = false;

    this.views = this.#buildViews();
    this.group = new THREE.Group();
    this.sprite = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }),
    );
    this.group.add(this.sprite);
    this.#setPose(this.views.front, false);
    this.group.position.copy(this.pos);
    scene.add(this.group);

    audio.attachBetty(this.group);
  }

  #buildViews() {
    const get = (k) => TEX['betty_' + k];
    const mk = (k) => {
      const t = get(k);
      if (!t) return null;
      const m = t.clone();                     // horizontal mirror for left-facing sectors
      m.repeat.x = -1; m.offset.x = 1; m.needsUpdate = true;
      return { t, m, a: t.userData.aspect || 0.6 };
    };
    if (get('front')) {
      const front = mk('front');
      const back = mk('back') || front;
      const walk1 = mk('walk1') || front, walk2 = mk('walk2') || walk1;
      return {
        front,
        f34: mk('34front') || front,
        side: mk('side') || front,
        b34: mk('34back') || back,
        back,
        walk: [walk1, walk2],
        idle: mk('idle') || front,
        attack: mk('attack') || front,
      };
    }
    // no art yet — canvas placeholders everywhere
    const roam = { t: placeholderFace(false), a: 128 / 192 };
    const chase = { t: placeholderFace(true), a: 128 / 192 };
    roam.m = roam.t; chase.m = chase.t;
    return { front: roam, f34: roam, side: roam, b34: roam, back: roam, walk: [chase, chase], idle: roam, attack: chase };
  }

  #setPose(entry, mirror) {
    const map = mirror ? entry.m : entry.t;
    const mat = this.sprite.material;
    if (mat.map !== map) { mat.map = map; mat.needsUpdate = true; }
    this.sprite.scale.set(SPRITE_H * entry.a, SPRITE_H, 1);
    this.sprite.position.y = SPRITE_H / 2;
  }

  // pick a directional view from the angle between facing and the camera
  #directionalPose() {
    const toCam = Math.atan2(this.camera.position.x - this.pos.x, this.camera.position.z - this.pos.z);
    let rel = this.facing - toCam;
    rel = ((rel + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    const s = Math.round(rel / (Math.PI / 4));
    const v = this.views;
    const entry = [v.front, v.f34, v.side, v.b34, v.back][Math.min(Math.abs(s), 4)];
    return { entry, mirror: s > 0 };
  }

  #updatePose(dt) {
    this.animT += dt;
    if (this.captured) return;                                  // attack pose is pinned
    if (this.distracted > 0) { this.#setPose(this.views.idle, false); return; }
    if (this.state === 'chase') {                               // she's coming right at you
      this.#setPose(this.views.walk[Math.floor(this.animT * 4) % 2], false);
      return;
    }
    const { entry, mirror } = this.#directionalPose();
    this.#setPose(entry, mirror);
  }

  onCaptured(playerPos) {
    this.captured = true;
    this.#setPose(this.views.attack, false);
    if (TEX.effect_hit) {                                       // WHACK
      const a = TEX.effect_hit.userData.aspect || 0.83;
      const fx = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5 * a, 1.5),
        new THREE.MeshBasicMaterial({ map: TEX.effect_hit, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }));
      fx.position.set(
        (this.pos.x + playerPos.x) / 2, 1.45, (this.pos.z + playerPos.z) / 2);
      fx.rotation.y = Math.atan2(playerPos.x - this.pos.x, playerPos.z - this.pos.z);
      fx.renderOrder = 20;
      this.scene.add(fx);
    }
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
    this.audio.scream();
    this.audio.chaseLoop(true);
  }

  calmDown() {
    this.state = 'roam';
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
    this.facing = Math.atan2(dx, dz);
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
          this.facing = Math.atan2(dx, dz);
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
          this.facing = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
        }
        if (!this.finale) {
          const los = MAP.losBlocked(this.pos.x, this.pos.z, p.x, p.z);
          if (los.blocked && los.byDoor) { this.lost += dt; if (this.lost > 2.5) this.calmDown(); }
        }
      }
      if (dist < GRAB_DIST) game.capture();
    }

    this.#updatePose(dt);
    // billboard toward the camera
    this.group.position.copy(this.pos);
    this.group.rotation.y = Math.atan2(this.camera.position.x - this.pos.x, this.camera.position.z - this.pos.z);
  }
}
