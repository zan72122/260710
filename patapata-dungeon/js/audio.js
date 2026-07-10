/* ============================================================
   AudioMan — WebAudioだけで作る効果音とオルゴールBGM
   (外部ファイル不要・iOSは最初のタッチで解錠)
   ============================================================ */
const AudioMan = {
  ctx: null,
  master: null,
  sfxGain: null,
  musicGain: null,
  enabled: true,
  _musicTimer: null,
  _step: 0,
  _nextNoteTime: 0,

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 1 : 0;
      this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.9;
      this.sfxGain.connect(this.master);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.30;
      this.musicGain.connect(this.master);
      this.startMusic();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },

  setEnabled(on) {
    this.enabled = on;
    if (this.master) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(on ? 1 : 0, this.ctx.currentTime + 0.15);
    }
  },

  /* ---------- 低レベルヘルパ ---------- */
  _osc(type, freq, t0, dur, vol, dest, slideTo) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(dest || this.sfxGain);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  },

  _noise(t0, dur, vol, freq, q) {
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq || 900;
    f.Q.value = q || 0.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.sfxGain);
    src.start(t0);
  },

  /* ---------- 効果音 ---------- */
  tap() { if (!this.ctx) return; const t = this.ctx.currentTime;
    this._osc('triangle', 620, t, 0.08, 0.25); },

  shoot(power) { if (!this.ctx) return; const t = this.ctx.currentTime;
    const p = Math.min(1, power);
    this._noise(t, 0.12, 0.35, 500 + 900 * p, 0.7);
    this._osc('triangle', 190 + 200 * p, t, 0.16, 0.35, null, 90); },

  bounce(v) { if (!this.ctx) return; const t = this.ctx.currentTime;
    const s = Math.min(1, v / 12);
    this._osc('triangle', 240 + 160 * s, t, 0.07, 0.10 + 0.22 * s, null, 150);
    this._noise(t, 0.05, 0.12 * s + 0.04, 1800, 1.2); },

  boing() { if (!this.ctx) return; const t = this.ctx.currentTime;
    this._osc('sine', 160, t, 0.30, 0.4, null, 620);
    this._osc('sine', 322, t, 0.30, 0.18, null, 1240); },

  pickup(i) { if (!this.ctx) return; const t = this.ctx.currentTime;
    const base = [660, 784, 988][Math.min(i || 0, 2)];
    this._osc('sine', base, t, 0.22, 0.34);
    this._osc('sine', base * 2, t + 0.06, 0.28, 0.20);
    this._osc('triangle', base * 1.5, t + 0.1, 0.3, 0.12); },

  splash() { if (!this.ctx) return; const t = this.ctx.currentTime;
    this._noise(t, 0.42, 0.4, 700, 0.5);
    this._noise(t + 0.06, 0.3, 0.22, 350, 0.6);
    this._osc('sine', 300, t, 0.28, 0.22, null, 70); },

  bonk() { if (!this.ctx) return; const t = this.ctx.currentTime;
    this._osc('square', 220, t, 0.1, 0.28, null, 110);
    this._noise(t, 0.14, 0.3, 500, 0.8);
    this._osc('sine', 900, t + 0.08, 0.4, 0.14, null, 220); },

  boost() { if (!this.ctx) return; const t = this.ctx.currentTime;
    this._osc('sawtooth', 220, t, 0.22, 0.12, null, 900);
    this._noise(t, 0.2, 0.14, 2200, 1.4); },

  teleport() { if (!this.ctx) return; const t = this.ctx.currentTime;
    this._osc('sine', 300, t, 0.3, 0.24, null, 1400);
    this._osc('sine', 450, t + 0.05, 0.3, 0.18, null, 1900); },

  unlockChime() { if (!this.ctx) return; const t = this.ctx.currentTime;
    this._noise(t, 0.1, 0.3, 2500, 2);
    [523, 659, 784, 1047].forEach((f, i) =>
      this._osc('sine', f, t + 0.1 + i * 0.09, 0.3, 0.26)); },

  win() { if (!this.ctx) return; const t = this.ctx.currentTime;
    const seq = [523, 659, 784, 1047, 784, 1047, 1319];
    seq.forEach((f, i) => {
      this._osc('triangle', f, t + i * 0.11, 0.32, 0.30);
      this._osc('sine', f * 2, t + i * 0.11, 0.26, 0.10);
    });
    this._noise(t + 0.02, 0.5, 0.12, 4000, 1); },

  /* ---------- オルゴール風BGM ---------- */
  // ゆったりしたペンタトニックの子守唄ループ
  startMusic() {
    if (this._musicTimer) return;
    this._step = 0;
    this._nextNoteTime = this.ctx.currentTime + 0.3;
    this._musicTimer = setInterval(() => this._scheduleMusic(), 180);
  },

  _scheduleMusic() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const spb = 60 / 84 / 2; // 8分音符
    // 32ステップ × 2小節相当のかわいいループ (Cペンタトニック)
    const MEL = [
      523, 0, 659, 0, 784, 0, 659, 0, 587, 0, 523, 0, 587, 659, 0, 0,
      523, 0, 659, 0, 880, 0, 784, 0, 659, 0, 587, 0, 523, 0, 0, 0];
    const BASS = [
      131, 0, 0, 0, 196, 0, 0, 0, 147, 0, 0, 0, 196, 0, 0, 0,
      131, 0, 0, 0, 196, 0, 0, 0, 147, 0, 0, 0, 165, 0, 196, 0];
    while (this._nextNoteTime < this.ctx.currentTime + 0.45) {
      const i = this._step % MEL.length;
      const t = this._nextNoteTime;
      if (MEL[i]) {
        this._music_note(MEL[i], t, spb * 3.2, 0.16);
        this._music_note(MEL[i] * 2, t, spb * 2.2, 0.045); // オルゴールの倍音
      }
      if (BASS[i]) this._music_bass(BASS[i], t, spb * 3.8, 0.10);
      this._nextNoteTime += spb;
      this._step++;
    }
  },

  _music_note(f, t0, dur, vol) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.musicGain);
    o.start(t0); o.stop(t0 + dur + 0.05);
  },

  _music_bass(f, t0, dur, vol) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = f;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.musicGain);
    o.start(t0); o.stop(t0 + dur + 0.05);
  },
};
