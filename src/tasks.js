// The 10 tasks, their objects in the world, and the interact system
// (which also handles doors). Mostly sequential, but flexible: any active
// object can be used out of order.
import * as THREE from 'three';
import * as MAP from './map.js';
import { makeLabelSprite } from './assets.js';
import * as hud from './hud.js';

const REACH = 2.3;

export function createTasks(game, scene) {
  const T = [
    { label: 'Find the key & escape the bedroom', hint: "You're LOCKED IN. Find the key somewhere in this bedroom." },
    { label: 'Grab a snack from the kitchen', hint: 'Sneak to the KITCHEN (north hall) and grab a snack for energy.' },
    { label: 'Turn off the oven', hint: 'The cookies are burning! Turn OFF the oven in the kitchen.' },
    { label: 'Find the mansion map in the library', hint: 'The LIBRARY (center of the house) hides a map of the mansion.' },
    { label: 'Get the old key from the attic trunk', hint: 'Full lap! The ATTIC trunk (through Attic Stairs, center-east) hides the front-door key.' },
    { label: "Steal a cookie off Betty's tray", hint: "Steal a cookie from Betty's tray in the KITCHEN. Don't get caught…" },
    { label: 'Unlock the back gate (garden room)', hint: 'Unlock the BACK GATE in the Garden Room (south-east). Your escape route.' },
    { label: 'Grab the flashlight from the basement', hint: 'Get the FLASHLIGHT from the Basement (south-west). The halls go dark soon.' },
    { label: 'Prop open the escape-path doors', hint: 'Prop open the KITCHEN hall door and the GARDEN hall door (green wedges in the halls).' },
    { label: 'STEAL THE KNIFE & ESCAPE!', hint: "TIME'S UP — BETTY HUNTS. Grab her knife from the KITCHEN, then OUT THE BACK GATE!", finale: true },
  ].map((t) => ({ ...t, done: false }));

  const S = { cookieStolen: false, gateUnlocked: false, hasKnife: false, dirty: true };
  const inter = [];

  function makeItem(text, color, c, r, h = 0.5) {
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.55, h, 0.55), new THREE.MeshLambertMaterial({ color }));
    box.position.y = h / 2;
    const label = makeLabelSprite(text, { scale: 0.9 });
    label.position.y = h + 0.55;
    g.add(box, label);
    const { x, z } = MAP.cellToWorld(c, r);
    g.position.set(x, 0, z);
    scene.add(g);
    return g;
  }

  function done(i, msg) {
    if (T[i].done) return;
    T[i].done = true; S.dirty = true;
    game.audio.chime();
    hud.toast(msg);
  }

  function add(text, color, c, r, opts) {
    const mesh = makeItem(text, color, c, r, opts.h ?? 0.5);
    inter.push({ c, r, mesh, prompt: opts.prompt, active: opts.active, act: opts.act, keep: opts.keep });
  }

  const bedroomDoor = MAP.doorAt(3, 5);
  const kitchenDoor = MAP.doorAt(11, 5);
  const gardenDoor = MAP.doorAt(24, 16);

  add('Key', 0xd9b64a, 2, 2, {
    prompt: 'Take the key', active: () => !T[0].done,
    act: () => { bedroomDoor.locked = false; bedroomDoor.mesh.material = bedroomDoor.mats.doorMat; done(0, 'You found the key! The bedroom door is unlocked.'); },
  });
  add('Snack', 0x69a84f, 9, 3, {
    prompt: 'Grab the snack', active: () => !T[1].done,
    act: () => done(1, 'Snack! You feel ready to outrun Betty later.'),
  });
  add('Oven', 0x333333, 14, 2, {
    prompt: 'Turn off the oven', active: () => !T[2].done, keep: true, h: 1.1,
    act: () => { done(2, 'Oven off. The cookies are (mostly) saved.'); game.stopAlarm(); },
  });
  add('Map', 0x4f6fa8, 6, 10, {
    prompt: 'Take the mansion map', active: () => !T[3].done,
    act: () => { done(3, 'You found the mansion map! (Check the corner of your screen.)'); hud.showMinimap(true); },
  });
  add('Old Trunk', 0x6b4a2a, 22, 10, {
    prompt: 'Open the trunk', active: () => !T[4].done, keep: true, h: 0.8,
    act: () => done(4, 'An old key, deep in the trunk. That lap was worth it.'),
  });
  add("Betty's Tray", 0xd884b0, 12, 1, {
    prompt: 'Steal a cookie', active: () => !T[5].done, keep: true, h: 0.9,
    act: () => { S.cookieStolen = true; done(5, "You stole a cookie! Betty will stop to count them later…"); },
  });
  add('Back Gate', 0x8a8a8a, 24, 19, {
    prompt: 'Unlock the back gate', active: () => !T[6].done, keep: true, h: 2.2,
    act: () => { S.gateUnlocked = true; done(6, 'Back gate unlocked. Your escape route is ready.'); },
  });
  add('Flashlight', 0xe8d84a, 3, 18, {
    prompt: 'Take the flashlight', active: () => !T[7].done,
    act: () => { game.hasFlashlight = true; done(7, 'Flashlight! It switches on when the lights die.'); },
  });
  const props = { a: false, b: false };
  add('Wedge', 0x5a8a3a, 11, 6, {
    prompt: 'Prop the kitchen door open', active: () => !props.a, keep: true, h: 0.3,
    act: () => {
      props.a = true; kitchenDoor.propped = true; kitchenDoor.mesh.material = kitchenDoor.mats.propMat;
      game.audio.creak();
      if (props.b) done(8, 'Escape path propped open!'); else { hud.toast('Kitchen door propped. One more: the garden door.'); S.dirty = true; }
    },
  });
  add('Wedge', 0x5a8a3a, 24, 15, {
    prompt: 'Prop the garden door open', active: () => !props.b, keep: true, h: 0.3,
    act: () => {
      props.b = true; gardenDoor.propped = true; gardenDoor.mesh.material = gardenDoor.mats.propMat;
      game.audio.creak();
      if (props.a) done(8, 'Escape path propped open!'); else { hud.toast('Garden door propped. One more: the kitchen door.'); S.dirty = true; }
    },
  });
  add('KNIFE', 0xc8ccd4, 10, 1, {
    prompt: 'TAKE THE KNIFE', active: () => game.finale && !S.hasKnife, keep: true,
    act: () => {
      S.hasKnife = true; S.dirty = true;
      game.player.speedMul = 1.1;
      game.audio.chime();
      hud.toast('YOU HAVE THE KNIFE — RUN! OUT THE BACK GATE!', 5000);
    },
  });
  add('Front Door', 0x50331c, 11, 19, {
    prompt: 'Try the front door', active: () => true, keep: true, h: 2.4,
    act: () => { game.audio.thud(); hud.toast("Nailed shut. Betty's rules. The BACK GATE is the way out."); },
  });

  const gatePos = MAP.cellToWorld(24, 19);

  function currentIndex() {
    for (let i = 0; i < T.length; i++) {
      if (T[i].done) continue;
      if (T[i].finale && !game.finale) return i === 9 && !game.finale ? -1 : i;
      return i;
    }
    return -1;
  }

  let target = null;

  function update() {
    const p = game.player.pos;

    // nearest active interactable or door in reach
    target = null;
    let bestD = REACH;
    for (const it of inter) {
      if (!it.active()) continue;
      const { x, z } = MAP.cellToWorld(it.c, it.r);
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bestD) { bestD = d; target = { prompt: it.prompt, act: () => useItem(it) }; }
    }
    for (const d of MAP.doors) {
      if (d.propped) continue;
      const { x, z } = MAP.cellToWorld(d.c, d.r);
      const dist = Math.hypot(p.x - x, p.z - z);
      if (dist < bestD) {
        bestD = dist;
        const prompt = d.locked ? 'Locked door' : d.target > 0.5 ? 'Close the door' : 'Open the door';
        target = { prompt, act: () => MAP.toggleDoor(d, game.audio, hud.toast) };
      }
    }
    if (target) hud.showInteract(target.prompt); else hud.hideInteract();

    // escaping through the gate wins
    if (game.finale && S.hasKnife && S.gateUnlocked &&
        Math.hypot(p.x - gatePos.x, p.z - gatePos.z) < 2.4) {
      T[9].done = true; S.dirty = true;
      game.victory();
    }

    if (S.dirty) {
      S.dirty = false;
      hud.setChecklist(T, currentIndex());
      const ci = currentIndex();
      hud.setHint(ci >= 0 ? T[ci].hint : 'All tasks done — survive until the finale!');
    }
  }

  function useItem(it) {
    it.act();
    if (!it.keep) { scene.remove(it.mesh); it.active = () => false; }
  }

  function tryInteract() { target?.act(); }

  return { list: T, state: S, update, tryInteract, markDirty: () => { S.dirty = true; } };
}
