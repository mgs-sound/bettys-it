// All sound. Placeholder SFX are synthesized into AudioBuffers; any real file
// present in assets/ (see manifest) replaces its synth twin.
import * as THREE from 'three';
import { loadAudioBuffer } from './assets.js';

function synth(ctx, dur, fn) {
  const sr = ctx.sampleRate, n = Math.floor(dur * sr);
  const b = ctx.createBuffer(1, n, sr);
  const d = b.getChannelData(0);
  const state = {};
  for (let i = 0; i < n; i++) d[i] = fn(i / sr, state) || 0;
  return b;
}

let musicBuffer = null, musicTried = false;

// Drives any THREE.Audio's volume toward a base level, with a fast dip and a
// slow recovery — reusable for anything that should get out of the scream's
// way (music now; heartbeat/rumble later if the mix wants it).
export class Ducker {
  constructor(audio, { base = 0.4, duckTo = 0.15, duckTime = 0.15, restoreTime = 1 } = {}) {
    this.audio = audio;
    this.base = base; this.duckTo = duckTo;
    this.downRate = (base - duckTo) / duckTime;
    this.upRate = (base - duckTo) / restoreTime;
    this.target = base;
  }

  duck(on) { this.target = on ? this.duckTo : this.base; }

  update(dt) {
    const v = this.audio.getVolume();
    if (Math.abs(this.target - v) < 0.001) return;
    const rate = this.target < v ? this.downRate : this.upRate;
    this.audio.setVolume(v + Math.sign(this.target - v) * Math.min(Math.abs(this.target - v), rate * dt));
  }
}

export class GameAudio {
  constructor(listener) {
    this.listener = listener;
    this.ctx = listener.context;
    this.heartTimer = 0;
    this.heartLevel = 0;
    this.musicDuck = null;
    this.musicFading = false;
    this.#makeBuffers();
  }

  #makeBuffers() {
    const ctx = this.ctx;
    this.bufs = {
      rumble: synth(ctx, 3, (t, s) => {           // brown-noise growl
        s.v = (s.v || 0) + (Math.random() * 2 - 1) * 0.08;
        s.v *= 0.985;
        return s.v * (2.2 + 0.9 * Math.sin(2 * Math.PI * t / 3));
      }),
      scream: synth(ctx, 1.4, (t, s) => {         // falling saw shriek
        const f = 880 - 480 * (t / 1.4) + 35 * Math.sin(t * 28);
        s.p = (s.p || 0) + f / ctx.sampleRate;
        const saw = 2 * (s.p % 1) - 1;
        const env = t < 0.08 ? t / 0.08 : 1 - (t - 0.08) / 1.32;
        return (saw * 0.7 + (Math.random() * 2 - 1) * 0.3) * env * 0.8;
      }),
      chase: synth(ctx, 1.2, (t, s) => {          // pulsing dissonant loop (seamless)
        s.p1 = (s.p1 || 0) + 170 / ctx.sampleRate;
        s.p2 = (s.p2 || 0) + 175 / ctx.sampleRate;
        const saw = (2 * (s.p1 % 1) - 1) + (2 * (s.p2 % 1) - 1);
        return saw * 0.22 * (0.6 + 0.4 * Math.sin(2 * Math.PI * 2.5 * t));
      }),
      heart: synth(ctx, 0.5, (t) => {             // lub-dub
        let v = Math.sin(2 * Math.PI * 52 * t) * Math.exp(-t * 18);
        if (t > 0.22) v += Math.sin(2 * Math.PI * 48 * (t - 0.22)) * Math.exp(-(t - 0.22) * 22) * 0.6;
        return v;
      }),
      chime: synth(ctx, 0.8, (t) => {
        let v = Math.sin(2 * Math.PI * 660 * t) * Math.exp(-t * 4) * 0.4;
        if (t > 0.12) v += Math.sin(2 * Math.PI * 990 * (t - 0.12)) * Math.exp(-(t - 0.12) * 4) * 0.35;
        return v;
      }),
      creak: synth(ctx, 0.6, (t, s) => {
        const f = 130 + 90 * Math.sin(t * 9) + (Math.random() - 0.5) * 8;
        s.p = (s.p || 0) + f / ctx.sampleRate;
        return (2 * (s.p % 1) - 1) * 0.18 * Math.sin(Math.PI * t / 0.6);
      }),
      thud: synth(ctx, 0.3, (t) => Math.sin(2 * Math.PI * 70 * t) * Math.exp(-t * 20) * 0.9),
      colddrone: synth(ctx, 4, (t, s) => {      // abandoned-basement air (seamless 4s loop)
        const hum = Math.sin(2 * Math.PI * 55 * t) + Math.sin(2 * Math.PI * 56.25 * t);
        s.n = ((s.n || 0) * 0.97) + (Math.random() * 2 - 1) * 0.03;
        const breath = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.25 * t);
        return hum * 0.16 + s.n * breath * 1.2;
      }),
      alarm: synth(ctx, 1, (t) => (t % 0.5 < 0.12 ? Math.sign(Math.sin(2 * Math.PI * 900 * t)) * 0.12 : 0)),
    };
    // real files override synth versions when present
    for (const slot of ['rumble', 'scream', 'chase']) {
      loadAudioBuffer(slot, this.ctx).then((b) => { if (b) this.bufs[slot] = b; });
    }
  }

  unlock() { if (this.ctx.state !== 'running') this.ctx.resume(); }

  attachBetty(obj) {
    const mk = (buf, ref, vol, loop) => {
      const a = new THREE.PositionalAudio(this.listener);
      a.setBuffer(buf); a.setRefDistance(ref); a.setRolloffFactor(1.5);
      a.setLoop(loop); a.setVolume(vol);
      obj.add(a);
      return a;
    };
    this.rumble = mk(this.bufs.rumble, 4, 1, true);
    this.rumbleFilter = this.ctx.createBiquadFilter();
    this.rumbleFilter.type = 'lowpass';
    this.rumbleFilter.frequency.value = 900;
    this.rumble.setFilter(this.rumbleFilter);
    this.chaseSnd = mk(this.bufs.chase, 6, 0.9, true);
    this.screamSnd = mk(this.bufs.scream, 8, 1, false);
  }

  startRumble() { if (this.rumble && !this.rumble.isPlaying) this.rumble.play(); }

  setMuffled(blocked, byDoor) {
    if (!this.rumbleFilter) return;
    const target = !blocked ? 900 : byDoor ? 220 : 380;
    const f = this.rumbleFilter.frequency;
    f.setTargetAtTime(target, this.ctx.currentTime, 0.15);
  }

  // angry = she noticed her rolling pin is GONE: deeper, meaner
  scream(angry = false) {
    if (!this.screamSnd) return;
    if (this.screamSnd.isPlaying) this.screamSnd.stop();
    this.screamSnd.setPlaybackRate(angry ? 0.76 : 1);
    this.screamSnd.play();
  }

  // looping positional bed attached to any object (the basement's cold air)
  attachDrone(obj) {
    const a = new THREE.PositionalAudio(this.listener);
    a.setBuffer(this.bufs.colddrone);
    a.setRefDistance(3); a.setRolloffFactor(1.8);
    a.setLoop(true); a.setVolume(0.6);
    obj.add(a);
    a.play();
    this.drone = a;
  }

  chaseLoop(on) {
    if (!this.chaseSnd) return;
    if (on) {
      if (!this.chaseSnd.isPlaying) this.chaseSnd.play();
      if (this.rumble?.isPlaying) this.rumble.pause();
    } else {
      if (this.chaseSnd.isPlaying) this.chaseSnd.stop();
      this.startRumble();
    }
    this.musicDuck?.duck(on);   // the scream owns the mix while she hunts
  }

  #global(buf, vol) {
    const a = new THREE.Audio(this.listener);
    a.setBuffer(buf); a.setVolume(vol); a.play();
  }
  chime() { this.#global(this.bufs.chime, 0.5); }
  creak() { this.#global(this.bufs.creak, 0.6); }
  thud() { this.#global(this.bufs.thud, 0.5); }

  setAlarm(on) {
    if (on && !this.alarmSnd) {
      this.alarmSnd = new THREE.Audio(this.listener);
      this.alarmSnd.setBuffer(this.bufs.alarm);
      this.alarmSnd.setLoop(true); this.alarmSnd.setVolume(0.5);
      this.alarmSnd.play();
    } else if (!on && this.alarmSnd) {
      this.alarmSnd.stop(); this.alarmSnd = null;
    }
  }

  async startMusic() {
    if (!musicTried) { musicTried = true; musicBuffer = await loadAudioBuffer('music', this.ctx); }
    if (!musicBuffer) return;
    this.music = new THREE.Audio(this.listener);
    this.music.setBuffer(musicBuffer);
    this.music.setLoop(true);            // buffer looping is gapless
    this.music.setVolume(0);             // eases up to the bed level via the ducker
    this.music.play();
    this.musicDuck = new Ducker(this.music, { base: 0.4, duckTo: 0.15, duckTime: 0.15, restoreTime: 1 });
  }

  // quick fade for the game-over / victory screens, then a real stop
  fadeOutMusic(seconds = 0.8) {
    if (!this.music?.isPlaying || this.musicFading) return;
    this.musicFading = true;
    this.musicDuck = null;               // hand the volume over to the ramp
    const gain = this.music.gain.gain;
    const now = this.ctx.currentTime;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(0.0001, now + seconds);
    const m = this.music;
    setTimeout(() => { try { if (m.isPlaying) m.stop(); } catch { /* already stopped */ } }, seconds * 1000 + 100);
  }

  setHeart(level) { this.heartLevel = level; }

  update(dt) {
    if (this.heartLevel > 0.02) {
      this.heartTimer -= dt;
      if (this.heartTimer <= 0) {
        this.heartTimer = 1.15 - 0.7 * this.heartLevel;
        this.#global(this.bufs.heart, 0.15 + 0.55 * this.heartLevel);
      }
    }
    this.musicDuck?.update(dt);
  }

  stopAll() {
    for (const a of [this.rumble, this.chaseSnd, this.screamSnd, this.alarmSnd, this.drone]) {
      try { if (a?.isPlaying) a.stop(); } catch { /* already stopped */ }
    }
    this.alarmSnd = null;
    // music: if a fade is running its own stop is scheduled; otherwise cut it
    if (!this.musicFading) { try { if (this.music?.isPlaying) this.music.stop(); } catch { /* fine */ } }
  }
}
