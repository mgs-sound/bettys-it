// Visual review harness: boots the game headless and captures screenshots at
// fixed checkpoints into review/*.png. Run with `npm run review`, then LOOK
// at every image against the checklist in DESIGN.md / the review issue:
// Betty grounded+imposing, no cutout holes/halos, consistent tile density,
// furnished rooms, readable-but-moody lighting, no z-fighting, legible HUD.
const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 4199;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = path.join(__dirname, '..', 'review');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(BASE + '/index.html')).ok) return; } catch { /* not up yet */ }
    await sleep(200);
  }
  throw new Error('dev server never came up');
}

// teleport the player, aim at a target, and let a few frames render
const stage = (page, px, pz, tx, tz, pitch = -0.05) => page.evaluate(
  ({ px, pz, tx, tz, pitch }) => {
    const g = window.game;
    g.player.pos.set(px, 1.6, pz);
    g.player.yaw = Math.atan2(-(tx - px), -(tz - pz));
    g.player.pitch = pitch;
  }, { px, pz, tx, tz, pitch });

async function beginGame(page) {
  await page.waitForSelector('#beginBtn');
  await page.click('#beginBtn');
  await page.waitForFunction('window.game && window.renderer', { timeout: 15000 });
  await sleep(1200);   // textures/music settle, first frames render
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = spawn('python3', [path.join(__dirname, '..', 'dev_server.py'), String(PORT)], { stdio: 'ignore' });
  let browser;
  try {
    await waitForServer();
    browser = await puppeteer.launch({ args: ['--mute-audio'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    page.on('pageerror', (e) => console.error('[page error]', e.message));
    const shot = async (name) => {
      await sleep(350);
      await page.screenshot({ path: path.join(OUT, name + '.png') });
      console.log('captured', name);
    };

    // 1 — title screen
    await page.goto(BASE, { waitUntil: 'networkidle0' });
    await sleep(800);
    await shot('1-title');

    // 2..6 share one session, staged via ?debug=betty for the hallway shot
    await page.goto(BASE + '/?debug=betty', { waitUntil: 'networkidle0' });
    await beginGame(page);
    await shot('2-hallway-betty');

    // starting bedroom, aimed to show furniture + a hiding spot
    await stage(page, 10.5, 8.5, 3, 3, -0.06);
    await shot('3-bedroom');

    // basement — abandoned, cold, junk
    await stage(page, 11, 37.5, 3, 36, -0.03);
    await shot('4-basement');

    // a task prop up close: the attic trunk
    await stage(page, 43.8, 21.8, 45, 21, -0.18);
    await shot('5-prop-trunk');

    // game over — let her grab us
    await page.evaluate(() => {
      const g = window.game;
      delete g.betty.canSee;
      g.betty.pos.set(g.player.pos.x + 1, 0, g.player.pos.z);
    });
    await page.waitForSelector('#gameover:not(.hidden)', { timeout: 15000 });
    await sleep(400);
    await shot('6-gameover');

    console.log('review complete →', OUT);
  } finally {
    await browser?.close();
    server.kill();
  }
})().catch((e) => { console.error(e); process.exit(1); });
