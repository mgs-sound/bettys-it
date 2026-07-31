// Betty's It — game state machine and main loop.
import * as THREE from 'three';
import * as MAP from './map.js';
import { Player, IS_TOUCH } from './player.js';
import { Betty } from './betty.js';
import { GameAudio } from './audio.js';
import { createTasks } from './tasks.js';
import { preloadTextures } from './assets.js';
import { MANIFEST } from '../assets/manifest.js';
import * as hud from './hud.js';

const TOTAL = 300; // 5:00
const texturesReady = preloadTextures();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.domElement.className = 'game';
document.body.appendChild(renderer.domElement);

// Sophie's title lettering drops in automatically when the file exists
{
  const img = new Image();
  img.onload = () => {
    const t = document.getElementById('titleText');
    t.textContent = ''; img.style.maxWidth = '72vw'; t.appendChild(img);
  };
  img.src = MANIFEST.images.title;
}
// screen art: Betty hero shot on the title, victory pose on game over
for (const [id, slot] of [['heroImg', 'betty_hero'], ['overImg', 'betty_victory']]) {
  const img = document.getElementById(id);
  img.onload = () => img.classList.remove('hidden');
  img.src = MANIFEST.images[slot];
}

class Game {
  constructor() {
    this.state = 'playing';
    this.remaining = TOTAL;
    this.finale = false;
    this.hasFlashlight = false;
    this.alarmOn = false;
    this.alarmPing = 0;
    this.muffleT = 0;
    this.capT = 0;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x000000, 0.022);
    this.camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 100);
    this.scene.add(this.camera);
    this.listener = new THREE.AudioListener();
    this.camera.add(this.listener);

    this.audio = new GameAudio(this.listener);
    this.audio.unlock();

    const { lamps } = MAP.buildMap(this.scene);
    this.lamps = lamps;
    // the textures are dark — keep the base light generous, iPad-in-a-dim-room readable
    this.hemi = new THREE.HemisphereLight(0xa89cc8, 0x3a2a20, 1.25);
    this.scene.add(this.hemi);

    this.flash = new THREE.SpotLight(0xfff2cc, 0, 24, 0.5, 0.4);
    this.flash.position.set(0, 0, 0);
    this.flashTarget = new THREE.Object3D();
    this.flashTarget.position.set(0, 0, -2);
    this.camera.add(this.flash, this.flashTarget);
    this.flash.target = this.flashTarget;

    const start = MAP.cellToWorld(4, 2);
    this.player = new Player(this.camera, renderer.domElement, start.x, start.z, Math.PI);
    this.player.onInteractKey = () => this.interact();

    this.betty = new Betty(this.scene, this.camera, this.audio);
    this.tasks = createTasks(this, this.scene);

    this.audio.startRumble();
    this.audio.startMusic();
    hud.showMinimap(false);
    hud.toast('Betty is IT. Finish your tasks before the timer runs out…', 4500);
  }

  interact() { if (this.state === 'playing') this.tasks.tryInteract(); }

  stopAlarm() { this.alarmOn = false; this.audio.setAlarm(false); }

  startFinale() {
    this.finale = true;
    this.stopAlarm();
    this.tasks.markDirty();
    const tray = MAP.cellToWorld(12, 1);
    this.betty.onFinale(this.tasks.state.cookieStolen, tray);
    hud.toast(this.tasks.state.cookieStolen
      ? "TIME'S UP! Betty is counting her cookies — GO GET THE KNIFE!"
      : "TIME'S UP! BETTY IS HUNTING YOU. Get the knife from the kitchen!", 6000);
  }

  capture() {
    if (this.state !== 'playing') return;
    this.state = 'captured';
    this.capT = 1.2;
    this.player.enabled = false;
    this.betty.onCaptured(this.player.pos);   // attack pose + WHACK effect
    this.audio.scream();
    hud.hideInteract();
  }

  victory() {
    if (this.state !== 'playing') return;
    this.state = 'won';
    this.audio.stopAll();
    this.audio.chime();
    document.exitPointerLock?.();
    hud.showScreen('victory');
  }

  update(dt) {
    if (this.state === 'captured') {
      // the screen-grab moment: yanked to face Betty, red closing in
      this.capT -= dt;
      const b = this.betty.pos;
      this.camera.position.set(
        this.player.pos.x + (Math.random() - 0.5) * 0.06,
        1.6 + (Math.random() - 0.5) * 0.06,
        this.player.pos.z + (Math.random() - 0.5) * 0.06);
      this.camera.lookAt(b.x, 1.5, b.z);
      hud.setVignette(1);
      if (this.capT <= 0) {
        this.state = 'over';
        this.audio.stopAll();
        document.exitPointerLock?.();
        hud.showScreen('gameover');
      }
      return;
    }
    if (this.state !== 'playing') return;

    // timer
    if (!this.finale) {
      this.remaining -= dt;
      if (this.remaining <= 0) { this.remaining = 0; this.startFinale(); }
      const m = Math.floor(this.remaining / 60), s = Math.floor(this.remaining % 60);
      hud.setTimer(`${m}:${String(s).padStart(2, '0')}`, this.remaining < 60);
    } else {
      hud.setTimer('RUN!', true);
    }

    this.player.update(dt);
    this.betty.update(dt, this);
    if (this.state !== 'playing') return; // capture may have fired
    this.tasks.update(dt);
    MAP.updateDoors(dt);

    // smoke-alarm consequence for the burning oven
    const elapsed = TOTAL - this.remaining;
    if (!this.finale && !this.tasks.list[2].done && elapsed > 110 && !this.alarmOn) {
      this.alarmOn = true;
      this.audio.setAlarm(true);
      hud.toast('The smoke alarm is going off — Betty knows where the noise is!', 4500);
    }
    if (this.alarmOn) {
      this.alarmPing -= dt;
      if (this.alarmPing <= 0 && this.betty.state === 'roam') {
        this.alarmPing = 12;
        const me = this.betty.cell(), pc = MAP.worldToCell(this.player.pos.x, this.player.pos.z);
        this.betty.path = MAP.findPath(me.c, me.r, pc.c, pc.r) || [];
      }
    }

    // darkness curve: the last minute (and the finale) go dark
    const darkK = this.finale ? 0.15 : this.remaining > 60 ? 1 : Math.max(0.15, this.remaining / 60);
    for (const l of this.lamps) l.intensity = l.userData.base * darkK;
    this.hemi.intensity = 0.55 * Math.max(darkK, 0.25);
    this.scene.fog.density = 0.028 + (1 - darkK) * 0.045;
    this.flash.intensity = (this.hasFlashlight && darkK < 0.6) ? 60 : 0;

    // Betty's rumble muffles through closed doors and walls
    this.muffleT -= dt;
    if (this.muffleT <= 0) {
      this.muffleT = 0.15;
      const los = MAP.losBlocked(this.betty.pos.x, this.betty.pos.z, this.player.pos.x, this.player.pos.z);
      this.audio.setMuffled(los.blocked, los.byDoor);
    }

    // heartbeat when she's near
    const dist = Math.hypot(this.betty.pos.x - this.player.pos.x, this.betty.pos.z - this.player.pos.z);
    const heart = Math.max(0, Math.min(1, (10 - dist) / 8));
    this.audio.setHeart(heart);
    hud.setVignette(heart * 0.45);
    this.audio.update(dt);

    hud.drawMinimap(this.player, this.betty, this.betty.state === 'chase');
    hud.lockHint(!IS_TOUCH && !document.pointerLockElement);
  }

  dispose() {
    this.audio.stopAll();
    this.scene.traverse((o) => {
      o.geometry?.dispose?.();
      const m = o.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose?.()); else m?.dispose?.();
    });
  }
}

let game = null;

function startRun() {
  game?.dispose();
  hud.hideScreens();
  hud.showMinimap(false);
  game = new Game();
  window.game = game;   // debug handle for playtesting from the console
}

hud.bindScreens({
  onBegin: () => texturesReady.then(startRun),
  onRetry: () => texturesReady.then(startRun),
  onAgain: () => texturesReady.then(startRun),
  onInteract: () => game?.interact(),
});

const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (game) {
    game.update(dt);
    renderer.render(game.scene, game.camera);
  }
}
loop();

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  if (game) {
    game.camera.aspect = innerWidth / innerHeight;
    game.camera.updateProjectionMatrix();
  }
});
document.addEventListener('gesturestart', (e) => e.preventDefault());
