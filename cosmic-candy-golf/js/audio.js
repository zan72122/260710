/* ============================================================
   audio.js — Web Audio だけで作る BGM + 効果音
   音源ファイル不要。iOSでは最初のタッチで ctx.resume() する。
   ============================================================ */
"use strict";

const SND = {
  ctx: null,
  master: null,
  musicGain: null,
  sfxGain: null,
  muted: false,
  _bgmTimer: null,
  _bgmName: null,
  _step: 0,
  _nextTime: 0,

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.32;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.85;
    this.sfxGain.connect(this.master);
    this.muted = U.store.get("ccg_mute", false);
    this.master.gain.value = this.muted ? 0 : 1;
  },

  resume() {
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  },

  toggleMute() {
    this.muted = !this.muted;
    U.store.set("ccg_mute", this.muted);
    if (this.master) this.master.gain.value = this.muted ? 0 : 1;
    return this.muted;
  },

  midi(n) { return 440 * Math.pow(2, (n - 69) / 12); },

  /* ---------- 汎用トーン ---------- */
  tone(opt) {
    if (!this.ctx || this.muted) return;
    const t0 = opt.at || this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = opt.type || "sine";
    o.frequency.setValueAtTime(opt.f0 || 440, t0);
    if (opt.f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, opt.f1), t0 + (opt.dur || 0.2));
    const v = opt.vol || 0.2;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + (opt.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (opt.dur || 0.2));
    o.connect(g);
    g.connect(opt.music ? this.musicGain : this.sfxGain);
    o.start(t0);
    o.stop(t0 + (opt.dur || 0.2) + 0.05);
  },

  noise(opt) {
    if (!this.ctx || this.muted) return;
    const t0 = opt.at || this.ctx.currentTime;
    const dur = opt.dur || 0.15;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const flt = this.ctx.createBiquadFilter();
    flt.type = opt.filter || "highpass";
    flt.frequency.value = opt.freq || 4000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(opt.vol || 0.15, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(flt); flt.connect(g);
    g.connect(opt.music ? this.musicGain : this.sfxGain);
    src.start(t0);
  },

  /* ---------- 効果音 ---------- */
  shoot(power) { // 発射「ポーン」
    this.tone({ type: "triangle", f0: 320 + power * 320, f1: 720 + power * 500, dur: 0.22, vol: 0.3 });
    this.noise({ dur: 0.1, freq: 2500, vol: 0.1 });
  },
  pop(comboLevel) { // ターゲットヒット「ポン!」 コンボで音程UP
    const base = 480 * Math.pow(1.12, Math.min(comboLevel || 0, 10));
    this.tone({ type: "square", f0: base, f1: base * 1.6, dur: 0.13, vol: 0.22 });
    this.tone({ type: "sine", f0: base * 2, f1: base * 3, dur: 0.18, vol: 0.16 });
  },
  sparkle() { // 「キラーン」
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    [1046, 1318, 1568, 2093].forEach((f, i) =>
      this.tone({ type: "sine", f0: f, dur: 0.35, vol: 0.12, at: t + i * 0.05 }));
  },
  boing() {
    this.tone({ type: "sine", f0: 150, f1: 500, dur: 0.25, vol: 0.3 });
  },
  bump() { // 壁コツン
    this.tone({ type: "triangle", f0: 200, f1: 90, dur: 0.09, vol: 0.18 });
  },
  bumper() { // バンパー「ビヨン!」
    this.tone({ type: "square", f0: 220, f1: 660, dur: 0.15, vol: 0.25 });
    this.tone({ type: "sine", f0: 880, f1: 1320, dur: 0.2, vol: 0.12 });
  },
  whoops() { // 落下(やさしく)
    this.tone({ type: "sine", f0: 600, f1: 180, dur: 0.5, vol: 0.22 });
  },
  giggle() { // ターゲットの笑い声風
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 3; i++)
      this.tone({ type: "sine", f0: 700 + i * 120, f1: 900 + i * 140, dur: 0.09, vol: 0.12, at: t + i * 0.08 });
  },
  breakBlock() {
    this.noise({ dur: 0.25, freq: 900, filter: "lowpass", vol: 0.3 });
    this.tone({ type: "triangle", f0: 160, f1: 60, dur: 0.2, vol: 0.25 });
  },
  ability(kind) { // 能力ゲット共通ファンファーレ + 種類別
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    [523, 659, 784, 1046].forEach((f, i) =>
      this.tone({ type: "triangle", f0: f, dur: 0.22, vol: 0.2, at: t + i * 0.06 }));
    if (kind === "rocket") this.noise({ dur: 0.5, freq: 1200, filter: "lowpass", vol: 0.22, at: t + 0.2 });
    if (kind === "drill") this.tone({ type: "sawtooth", f0: 90, f1: 130, dur: 0.5, vol: 0.15, at: t + 0.2 });
    if (kind === "rainbow") [1046, 1318, 1568, 2093, 2637].forEach((f, i) =>
      this.tone({ type: "sine", f0: f, dur: 0.3, vol: 0.1, at: t + 0.25 + i * 0.06 }));
  },
  goalAppear() { // 最後のターゲットがゴールに変身!
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    [392, 523, 659, 784, 1046, 1318].forEach((f, i) =>
      this.tone({ type: "triangle", f0: f, dur: 0.4, vol: 0.2, at: t + i * 0.09 }));
    this.sparkle();
  },
  suck() { // ゴール吸い込み
    this.tone({ type: "sine", f0: 900, f1: 120, dur: 0.6, vol: 0.25 });
  },
  fanfare() { // ステージクリア
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const seq = [[523, 0], [523, 0.14], [523, 0.28], [659, 0.42], [784, 0.7], [659, 0.9], [784, 1.05]];
    seq.forEach(([f, dt]) => {
      this.tone({ type: "square", f0: f, dur: 0.25, vol: 0.16, at: t + dt });
      this.tone({ type: "triangle", f0: f * 2, dur: 0.25, vol: 0.12, at: t + dt });
    });
  },
  starDing(i) { // クリア画面の星
    this.tone({ type: "sine", f0: 880 * Math.pow(1.25, i), f1: 1200 * Math.pow(1.25, i), dur: 0.35, vol: 0.25 });
  },
  firework() {
    this.noise({ dur: 0.4, freq: 3000, vol: 0.14 });
    this.tone({ type: "sine", f0: U.rand(600, 1400), f1: 200, dur: 0.35, vol: 0.1 });
  },
  click() {
    this.tone({ type: "sine", f0: 700, f1: 1000, dur: 0.08, vol: 0.2 });
  },
  bossHit() {
    this.tone({ type: "square", f0: 300, f1: 700, dur: 0.2, vol: 0.28 });
    this.noise({ dur: 0.2, freq: 1800, vol: 0.15 });
  },
  bossStomp() {
    this.tone({ type: "sine", f0: 90, f1: 40, dur: 0.4, vol: 0.4 });
    this.noise({ dur: 0.3, freq: 400, filter: "lowpass", vol: 0.3 });
  },
  snore() {
    this.tone({ type: "sine", f0: 220, f1: 150, dur: 0.5, vol: 0.06 });
  },

  /* ============================================================
     BGM シーケンサー
     16分音符ステップの簡易パターン。0 = 休符, 数字 = MIDIノート
     ============================================================ */
  songs: {
    // メニュー: ゆったりオルゴール風
    menu: {
      bpm: 92,
      mel: [72, 0, 76, 0, 79, 0, 76, 0, 74, 0, 77, 0, 74, 0, 72, 0,
            71, 0, 74, 0, 79, 0, 74, 0, 72, 0, 0, 0, 0, 0, 0, 0],
      bass: [48, 0, 0, 0, 43, 0, 0, 0, 50, 0, 0, 0, 43, 0, 0, 0,
             45, 0, 0, 0, 43, 0, 0, 0, 48, 0, 0, 0, 43, 0, 0, 0],
      arp: [64, 67, 72, 67, 64, 67, 72, 67, 65, 69, 74, 69, 65, 69, 74, 69,
            62, 66, 71, 66, 62, 66, 71, 66, 64, 67, 72, 67, 64, 67, 72, 67],
      hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0,
            0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
    },
    // おもちゃの国 (ステージ1-2): 元気なマーチ
    toy: {
      bpm: 120,
      mel: [72, 0, 72, 74, 76, 0, 72, 0, 79, 0, 76, 0, 72, 0, 0, 0,
            74, 0, 74, 76, 77, 0, 74, 0, 81, 0, 77, 0, 74, 0, 0, 0,
            76, 0, 76, 77, 79, 0, 76, 0, 84, 0, 81, 0, 79, 0, 76, 0,
            77, 76, 74, 0, 72, 0, 74, 0, 72, 0, 0, 0, 0, 0, 0, 0],
      bass: [48, 0, 55, 0, 48, 0, 55, 0, 48, 0, 55, 0, 48, 0, 55, 0,
             50, 0, 57, 0, 50, 0, 57, 0, 50, 0, 57, 0, 50, 0, 57, 0,
             52, 0, 59, 0, 52, 0, 59, 0, 52, 0, 59, 0, 52, 0, 59, 0,
             53, 0, 60, 0, 55, 0, 62, 0, 48, 0, 55, 0, 48, 0, 0, 0],
      arp: [],
      hat: [1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0,
            1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0,
            1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0,
            1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0],
    },
    // そら (ステージ3-4): ちょっと不思議で浮遊感
    sky: {
      bpm: 108,
      mel: [76, 0, 0, 79, 0, 0, 83, 0, 81, 0, 79, 0, 76, 0, 0, 0,
            74, 0, 0, 77, 0, 0, 81, 0, 79, 0, 77, 0, 74, 0, 0, 0,
            72, 0, 0, 76, 0, 0, 79, 0, 84, 0, 83, 0, 79, 0, 76, 0,
            77, 0, 79, 0, 74, 0, 76, 0, 72, 0, 0, 0, 0, 0, 0, 0],
      bass: [45, 0, 0, 0, 52, 0, 0, 0, 41, 0, 0, 0, 48, 0, 0, 0,
             43, 0, 0, 0, 50, 0, 0, 0, 45, 0, 0, 0, 52, 0, 0, 0,
             45, 0, 0, 0, 52, 0, 0, 0, 41, 0, 0, 0, 48, 0, 0, 0,
             43, 0, 0, 0, 50, 0, 0, 0, 48, 0, 0, 0, 48, 0, 0, 0],
      arp: [69, 72, 76, 72, 69, 72, 76, 72, 65, 69, 72, 69, 65, 69, 72, 69,
            67, 71, 74, 71, 67, 71, 74, 71, 69, 72, 76, 72, 69, 72, 76, 72,
            69, 72, 76, 72, 69, 72, 76, 72, 65, 69, 72, 69, 65, 69, 72, 69,
            67, 71, 74, 71, 67, 71, 74, 71, 72, 76, 79, 76, 72, 76, 79, 76],
      hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1,
            0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1,
            0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1,
            0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 1, 1],
    },
    // ボス: ドキドキ(でも怖すぎない)
    boss: {
      bpm: 138,
      mel: [69, 0, 69, 0, 72, 0, 69, 0, 74, 0, 72, 0, 69, 0, 67, 0,
            69, 0, 69, 0, 72, 0, 74, 0, 76, 0, 74, 0, 72, 0, 69, 0],
      bass: [45, 45, 0, 45, 45, 0, 45, 45, 43, 43, 0, 43, 43, 0, 43, 43,
             41, 41, 0, 41, 41, 0, 41, 41, 43, 43, 0, 43, 43, 0, 43, 43],
      arp: [],
      hat: [1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0,
            1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1],
    },
    // エンドレス: ノリノリ
    endless: {
      bpm: 128,
      mel: [76, 0, 74, 0, 76, 0, 79, 0, 76, 0, 74, 0, 72, 0, 0, 0,
            74, 0, 72, 0, 74, 0, 77, 0, 74, 0, 72, 0, 71, 0, 0, 0,
            72, 0, 76, 0, 79, 0, 84, 0, 83, 0, 79, 0, 76, 0, 74, 0,
            72, 0, 74, 0, 76, 0, 74, 0, 72, 0, 0, 0, 0, 0, 0, 0],
      bass: [48, 0, 48, 55, 48, 0, 48, 55, 48, 0, 48, 55, 48, 0, 48, 55,
             43, 0, 43, 50, 43, 0, 43, 50, 43, 0, 43, 50, 43, 0, 43, 50,
             45, 0, 45, 52, 45, 0, 45, 52, 45, 0, 45, 52, 45, 0, 45, 52,
             41, 0, 41, 48, 43, 0, 43, 50, 48, 0, 48, 55, 48, 0, 0, 0],
      arp: [],
      hat: [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1,
            1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1,
            1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1,
            1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    },
  },

  playBgm(name) {
    if (!this.ctx) return;
    if (this._bgmName === name) return;
    this.stopBgm();
    const song = this.songs[name];
    if (!song) return;
    this._bgmName = name;
    this._step = 0;
    this._nextTime = this.ctx.currentTime + 0.1;
    const stepDur = () => 60 / song.bpm / 4;
    const tick = () => {
      if (!this.ctx || this._bgmName !== name) return;
      // 0.35秒先までスケジュール
      while (this._nextTime < this.ctx.currentTime + 0.35) {
        const t = this._nextTime;
        const len = song.mel.length;
        const i = this._step % len;
        const m = song.mel[i];
        if (m) this.tone({ type: "triangle", f0: this.midi(m), dur: stepDur() * 2.4, vol: 0.16, at: t, music: true });
        const b = song.bass[i % song.bass.length];
        if (b) this.tone({ type: "sine", f0: this.midi(b), dur: stepDur() * 1.8, vol: 0.2, at: t, music: true });
        if (song.arp.length) {
          const a = song.arp[i % song.arp.length];
          if (a) this.tone({ type: "sine", f0: this.midi(a + 12), dur: stepDur() * 1.1, vol: 0.05, at: t, music: true });
        }
        if (song.hat[i % song.hat.length]) this.noise({ dur: 0.04, freq: 6000, vol: 0.05, at: t, music: true });
        this._nextTime += stepDur();
        this._step++;
      }
    };
    tick();
    this._bgmTimer = setInterval(tick, 120);
  },

  stopBgm() {
    if (this._bgmTimer) clearInterval(this._bgmTimer);
    this._bgmTimer = null;
    this._bgmName = null;
  },
};
