// Betty: roams the hallway ring, chases on sight (or forever once time is up),
// grabs at close range. She can NEVER pass a closed door — closed doors are safe.
// Rendered as one big camera-facing sprite (hand-drawn art via betty_roam slot;
// chase pose reuses it with a forward tilt and a faster bob until its art lands).
// Difficulty ramps with finished tasks: faster patrol, longer hearing.
import * as THREE from 'three';
import * as MAP from './map.js';
import { TEX, makeCanvasTexture, bottomPadFraction } from './assets.js';

const BASE_ROAM = 2.0, BASE_CHASE = 3.4;      // player is 4.2 — you win footraces
const SEE_DIST = 13, GRAB_DIST = 1.55;
const SPRITE_H = 2.65;   // a touch over spec so she genuinely looms in a 3.2m hall
const WAYPOINTS = [[4, 14], [54, 14], [54, 30], [4, 30]];   // hall ring corners
const TRAY_CELL = { c: 12, r: 2 };            // where she stands to count cookies

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
    this.bobT = 0; this.captured = false;
    this.countT = 0; this.goingToCount = false; this.hearT = 0;

    const mk = (t) => t && { t, a: t.userData.aspect || 0.6, pad: bottomPadFraction(t) };
    this.roamView = mk(TEX.betty_roam) || { t: placeholderFace(false), a: 128 / 192, pad: 0 };
    // hand-drawn chase art when it lands; hand-drawn roam reused until then;
    // on pure placeholders, at least switch to the jagged-mouth face
    this.chaseView = mk(TEX.betty_chase)
      || (TEX.betty_roam ? this.roamView : { t: placeholderFace(true), a: 128 / 192, pad: 0 });

    this.group = new THREE.Group();
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0, 0.5, 0);                    // pivot at her feet
    this.sprite = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }),
    );
    this.group.add(this.sprite);
    this.#setView(this.roamView);
    this.group.position.copy(this.pos);
    scene.add(this.group);

    audio.attachBetty(this.group);
  }

  #setView(v) {
    const mat = this.sprite.material;
    if (mat.map !== v.t) { mat.map = v.t; mat.needsUpdate = true; }
    // big: tall with an extra 1.15x width so she fills the hallway
    this.sprite.scale.set(SPRITE_H * v.a * 1.15, SPRITE_H, 1);
    this.view = v;
  }

  #updatePose(dt) {
    if (this.captured) return;                              // lunge pose is pinned
    const chasing = this.state === 'chase' && this.distracted <= 0;
    this.#setView(chasing ? this.chaseView : this.roamView);
    this.bobT += dt * (chasing ? 9 : 4);
    this.sprite.position.y = -(this.view.pad || 0) * SPRITE_H
      + Math.abs(Math.sin(this.bobT)) * (chasing ? 0.12 : 0.05);
    const tilt = chasing ? -0.08 : 0;                       // slight lean; the chase art carries the motion
    this.sprite.rotation.x += (tilt - this.sprite.rotation.x) * Math.min(1, dt * 6);
  }

  onCaptured() {
    this.captured = true;
    this.sprite.rotation.x = -0.28;                         // the lunge
    this.sprite.scale.multiplyScalar(1.12);
  }

  cell() { return MAP.worldToCell(this.pos.x, this.pos.z); }

  // ramped stats: +4% patrol speed per finished task, hearing radius grows
  #done(game) { return game.doneCount(); }
  roamSpeed(game) { return BASE_ROAM * (1 + 0.04 * this.#done(game)); }
  chaseSpeed(game) { return (game.tasks.state.pinStolen ? BASE_CHASE - 0.25 : BASE_CHASE); }
  hearRadius(game) { return 4 + 0.8 * this.#done(game); }

  canSee(game) {
    const p = game.player.pos;
    const d = Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
    if (d > SEE_DIST) return false;
    const pc = MAP.worldToCell(p.x, p.z);
    if (!MAP.isHall(pc.c, pc.r) && d > 3) return false;   // rooms are safe-ish
    return !MAP.losBlocked(this.pos.x, this.pos.z, p.x, p.z).blocked;
  }

  startChase(game) {
    if (this.state === 'chase') return;
    this.state = 'chase';
    this.path = null; this.repath = 0; this.lost = 0;
    this.goingToCount = false;
    // no rolling pin = angrier scream (deeper, meaner)
    this.audio.scream(game?.tasks.state.pinStolen);
    this.audio.chaseLoop(true);
  }

  calmDown() {
    this.state = 'roam';
    this.audio.chaseLoop(false);
    let best = 0, bestD = Infinity;
    WAYPOINTS.forEach(([x, z], i) => {
      const d = (x - this.pos.x) ** 2 + (z - this.pos.z) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    });
    this.wp = best;
    const me = this.cell(), t = MAP.worldToCell(WAYPOINTS[best][0], WAYPOINTS[best][1]);
    this.path = MAP.findPath(me.c, me.r, t.c, t.r) || [];
  }

  onFinale(cookieStolen, trayPos, game) {
    this.finale = true;
    if (cookieStolen) {
      // She stops to count her cookies — right next to the knife. Head start!
      this.distracted = 8;
      this.pos.set(trayPos.x, 0, trayPos.z);
      this.path = null;
      this.audio.chaseLoop(false);
      game.tasks.placePin(this.pos);            // last chance to grab the pin
    } else {
      this.startChase(game);
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
    const S = game.tasks.state;

    if (this.distracted > 0) {
      this.distracted -= dt;
      if (this.distracted <= 0) {
        if (this.finale) this.startChase(game);
        else this.calmDown();
      }
    } else if (this.state === 'roam') {
      // after the cookie theft she periodically returns to count her cookies —
      // that's the window to steal the rolling pin. If the kitchen door is
      // closed (she can't open doors, even her own) she counts just outside it.
      if (S.cookieStolen && !S.pinStolen && !this.goingToCount) {
        this.countT -= dt;
        if (this.countT <= 0) {
          const me = this.cell();
          const path = MAP.findPath(me.c, me.r, TRAY_CELL.c, TRAY_CELL.r)
            || MAP.findPath(me.c, me.r, 11, 6);
          if (path) { this.path = path; this.goingToCount = true; }
          this.countT = 30;
        }
      }
      if (this.path?.length) {
        this.#follow(dt, this.roamSpeed(game));
      } else if (this.goingToCount) {
        this.goingToCount = false;
        this.distracted = 9;                    // counting… one, two, THREE?!
        game.tasks.placePin(this.pos);          // she sets the pin down beside her
      } else {
        const [wx, wz] = WAYPOINTS[this.wp];
        const dx = wx - this.pos.x, dz = wz - this.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.4) this.wp = (this.wp + 1) % WAYPOINTS.length;
        else {
          const step = Math.min(this.roamSpeed(game) * dt, d);
          this.pos.x += (dx / d) * step; this.pos.z += (dz / d) * step;
        }
      }
      // hearing: your footsteps carry further the closer the finale gets
      this.hearT -= dt;
      if (this.hearT <= 0) {
        this.hearT = 1.5;
        if (game.player.moving && dist < this.hearRadius(game) && !this.goingToCount) {
          const me = this.cell(), pc = MAP.worldToCell(p.x, p.z);
          const path = MAP.findPath(me.c, me.r, pc.c, pc.r);
          if (path) this.path = path;           // investigate the noise
        }
      }
      if (this.finale || this.canSee(game)) this.startChase(game);
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
        if (!this.#follow(dt, this.chaseSpeed(game)) && dist > 0.3) {
          // same cell as player — walk straight at them
          this.pos.x += ((p.x - this.pos.x) / dist) * this.chaseSpeed(game) * dt;
          this.pos.z += ((p.z - this.pos.z) / dist) * this.chaseSpeed(game) * dt;
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
