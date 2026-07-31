// DOM overlay: timer, hints, checklist, interact button, toast, minimap, screens.
import * as MAP from './map.js';

const $ = (id) => document.getElementById(id);
let toastTimer = null;

export function bindScreens(cb) {
  $('beginBtn').addEventListener('click', cb.onBegin);
  $('retryBtn').addEventListener('click', cb.onRetry);
  $('againBtn').addEventListener('click', cb.onAgain);
  $('interactBtn').addEventListener('click', cb.onInteract);
  $('tasksBtn').addEventListener('click', () => $('checklist').classList.toggle('hidden'));
}

export function showScreen(name) {
  $(name).classList.remove('hidden');
  if (name !== 'hud') $('hud').classList.add('hidden');
}
export function hideScreens() {
  for (const s of ['title', 'gameover', 'victory']) $(s).classList.add('hidden');
  $('hud').classList.remove('hidden');
}

export function setTimer(text, danger) {
  const t = $('timer');
  t.textContent = text;
  t.classList.toggle('danger', !!danger);
}
export function setHint(text) { $('hint').textContent = text; }

export function setChecklist(tasks, currentIdx) {
  const ol = $('taskList');
  ol.innerHTML = '';
  tasks.forEach((t, i) => {
    const li = document.createElement('li');
    li.textContent = t.label;
    if (t.done) li.className = 'done';
    else if (i === currentIdx) li.className = 'current';
    ol.appendChild(li);
  });
}

export function showInteract(label) {
  const b = $('interactBtn');
  b.textContent = label + (('ontouchstart' in window) ? '' : '  (E)');
  b.classList.remove('hidden');
}
export function hideInteract() { $('interactBtn').classList.add('hidden'); }

export function toast(msg, ms = 3500) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
}

export function setVignette(v) {
  $('vignette').style.boxShadow = `inset 0 0 ${120 * v}px ${50 * v}px rgba(150,0,0,${0.55 * v})`;
}

export function lockHint(show) { $('lockHint').classList.toggle('hidden', !show); }

// ---- minimap ------------------------------------------------------------
const SCALE = 5;
export function showMinimap(on) { $('minimap').classList.toggle('hidden', !on); }

export function drawMinimap(player, betty, chasing) {
  const cv = $('minimap');
  if (cv.classList.contains('hidden')) return;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, cv.width, cv.height);
  for (let r = 0; r < MAP.H; r++) for (let c = 0; c < MAP.W; c++) {
    const ch = MAP.GRID[r][c];
    if (ch === '#') g.fillStyle = '#171015';
    else if (ch === 'h') g.fillStyle = '#3a3430';
    else if (ch === 'D') {
      const d = MAP.doorAt(c, r);
      g.fillStyle = d && d.openF > 0.5 ? '#5a8a4a' : '#a04438';
    } else g.fillStyle = '#4a3a2c';
    g.fillRect(c * SCALE, r * SCALE, SCALE, SCALE);
  }
  const px = (player.pos.x / MAP.CELL) * SCALE, pz = (player.pos.z / MAP.CELL) * SCALE;
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(px, pz, 2.4, 0, 7); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(px, pz);
  g.lineTo(px - Math.sin(player.yaw) * 6, pz - Math.cos(player.yaw) * 6);
  g.stroke();
  if (chasing && betty) {
    g.fillStyle = '#ff3030';
    g.beginPath(); g.arc((betty.pos.x / MAP.CELL) * SCALE, (betty.pos.z / MAP.CELL) * SCALE, 2.6, 0, 7);
    g.fill();
  }
}
