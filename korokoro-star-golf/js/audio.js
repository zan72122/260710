/* ================================================================
   audio.js — 効果音とBGM（すべてWebAudioで合成。音声ファイル不要）
   ================================================================ */
"use strict";

const AudioSys = (() => {
  let ctx = null;
  let master = null, sfxBus = null, bgmBus = null;
  let noiseBuf = null;
  let enabled = true;
  let bgmPlaying = false;
  let bgmNextTime = 0;
  let bgmStep = 0;
  let bgmTimer = null;

  try {
    enabled = localStorage.getItem("korokoroGolfSound") !== "off";
  } catch (e) { /* プライベートブラウズ等 */ }

  function ensure() {
    if (ctx) {
      if (ctx.state === "suspended") ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = enabled ? 1 : 0;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.9;
    sfxBus.connect(master);
    bgmBus = ctx.createGain();
    bgmBus.gain.value = 0.34;
    bgmBus.connect(master);

    /* ノイズバッファ（スプラッシュ・シュッという音に使う） */
    const len = ctx.sampleRate * 1.2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return true;
  }

  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }

  /* 単音を鳴らす基本部品 */
  function tone(opt) {
    if (!ctx) return;
    const t0 = opt.at !== undefined ? opt.at : ctx.currentTime;
    const dur = opt.dur || 0.15;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opt.type || "sine";
    osc.frequency.setValueAtTime(opt.freq, t0);
    if (opt.slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opt.slideTo), t0 + dur);
    }
    if (opt.wobble) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = opt.wobble;
      lg.gain.value = opt.freq * 0.12;
      lfo.connect(lg); lg.connect(osc.frequency);
      lfo.start(t0); lfo.stop(t0 + dur);
    }
    const vol = opt.vol !== undefined ? opt.vol : 0.2;
    const atk = opt.attack !== undefined ? opt.attack : 0.005;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(opt.bus || sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise(opt) {
    if (!ctx || !noiseBuf) return;
    const t0 = opt.at !== undefined ? opt.at : ctx.currentTime;
    const dur = opt.dur || 0.2;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = opt.filterType || "lowpass";
    filt.frequency.setValueAtTime(opt.freq || 1200, t0);
    if (opt.slideTo) filt.frequency.exponentialRampToValueAtTime(Math.max(40, opt.slideTo), t0 + dur);
    const g = ctx.createGain();
    const vol = opt.vol !== undefined ? opt.vol : 0.2;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + (opt.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt); filt.connect(g); g.connect(opt.bus || sfxBus);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  /* ---------------- 効果音 ---------------- */
  const sfx = {
    tap()   { tone({ freq: 660, type: "triangle", dur: 0.08, vol: 0.18 });
              tone({ freq: 990, type: "triangle", dur: 0.1, vol: 0.12, at: ctx && ctx.currentTime + 0.05 }); },

    shoot(power) { /* power: 0〜1 */
      noise({ freq: 900 + power * 2200, slideTo: 300, dur: 0.22, vol: 0.16, filterType: "bandpass" });
      tone({ freq: 220 + power * 340, slideTo: 90, type: "triangle", dur: 0.2, vol: 0.14 });
    },

    bounce(strength) { /* 壁に当たった「ぽよん」 */
      const s = clamp(strength, 0, 1);
      tone({ freq: 260 + s * 240, slideTo: 90, type: "triangle", dur: 0.14 + s * 0.1, vol: 0.1 + s * 0.14, wobble: 22 });
    },

    boing() { /* バンパー・きのこ */
      tone({ freq: 160, slideTo: 640, type: "square", dur: 0.16, vol: 0.1 });
      tone({ freq: 420, slideTo: 1200, type: "triangle", dur: 0.24, vol: 0.16, wobble: 30 });
    },

    pop(combo) { /* 敵をポン！ comboで音程が上がる */
      const base = 520 * Math.pow(1.13, clamp(combo || 0, 0, 8));
      noise({ freq: 2600, dur: 0.06, vol: 0.16, filterType: "highpass" });
      tone({ freq: base, slideTo: base * 2.1, type: "square", dur: 0.13, vol: 0.13 });
      tone({ freq: base * 1.5, type: "triangle", dur: 0.2, vol: 0.12, at: ctx && ctx.currentTime + 0.06 });
    },

    star() { /* フルーツ・星の回収 */
      const t = ctx ? ctx.currentTime : 0;
      tone({ freq: midi(88), type: "triangle", dur: 0.1, vol: 0.14, at: t });
      tone({ freq: midi(93), type: "triangle", dur: 0.16, vol: 0.14, at: t + 0.07 });
      tone({ freq: midi(96), type: "sine", dur: 0.25, vol: 0.1, at: t + 0.14 });
    },

    splash() {
      noise({ freq: 1400, slideTo: 220, dur: 0.5, vol: 0.24 });
      tone({ freq: 300, slideTo: 60, type: "sine", dur: 0.4, vol: 0.16 });
      const t = ctx ? ctx.currentTime : 0;
      noise({ freq: 3000, dur: 0.12, vol: 0.1, filterType: "highpass", at: t + 0.18 });
    },

    bubble() { /* 水から戻るときの「ぽこっ」 */
      tone({ freq: 180, slideTo: 700, type: "sine", dur: 0.16, vol: 0.16 });
    },

    boost() {
      noise({ freq: 700, slideTo: 3400, dur: 0.25, vol: 0.1, filterType: "bandpass" });
      tone({ freq: 500, slideTo: 1100, type: "sawtooth", dur: 0.18, vol: 0.05 });
    },

    goalAppear() {
      const t = ctx ? ctx.currentTime : 0;
      [76, 80, 83, 88].forEach((n, i) => {
        tone({ freq: midi(n), type: "triangle", dur: 0.3, vol: 0.14, at: t + i * 0.09 });
      });
      noise({ freq: 4000, dur: 0.5, vol: 0.05, filterType: "highpass", at: t });
    },

    goalIn() { /* 吸い込まれる音 */
      tone({ freq: 900, slideTo: 120, type: "sine", dur: 0.5, vol: 0.16, wobble: 14 });
      noise({ freq: 2400, slideTo: 200, dur: 0.5, vol: 0.08 });
    },

    fanfare() {
      const t = ctx ? ctx.currentTime : 0;
      const seq = [
        [72, 0.00, 0.16], [76, 0.14, 0.16], [79, 0.28, 0.16], [84, 0.42, 0.4],
        [83, 0.72, 0.12], [84, 0.86, 0.7],
      ];
      seq.forEach(([n, dt, dur]) => {
        tone({ freq: midi(n), type: "square", dur, vol: 0.09, at: t + dt });
        tone({ freq: midi(n) * 2, type: "triangle", dur, vol: 0.1, at: t + dt });
      });
      /* きらきら */
      for (let i = 0; i < 6; i++) {
        tone({ freq: midi(91 + ((i * 5) % 12)), type: "sine", dur: 0.2, vol: 0.05, at: t + 0.9 + i * 0.08 });
      }
    },

    giggle() {
      const t = ctx ? ctx.currentTime : 0;
      [0, 0.09, 0.18].forEach((dt, i) => {
        tone({ freq: 620 + i * 120, slideTo: 900 + i * 120, type: "triangle", dur: 0.08, vol: 0.12, at: t + dt });
      });
    },

    unlock() {
      const t = ctx ? ctx.currentTime : 0;
      tone({ freq: midi(79), type: "triangle", dur: 0.12, vol: 0.13, at: t });
      tone({ freq: midi(84), type: "triangle", dur: 0.3, vol: 0.13, at: t + 0.1 });
    },
  };

  /* ---------------- BGM（かんたんシーケンサー） ---------------- */

  const BPM = 112;
  const STEP = 60 / BPM / 2;               /* 8分音符1つぶん */
  /* 8小節ループ（8分音符 x 64ステップ）。0は休符 */
  const MELODY = [
    72, 0, 76, 0, 79, 0, 76, 0,   81, 0, 79, 0, 76, 0, 0, 0,
    74, 0, 76, 0, 77, 0, 74, 0,   76, 0, 74, 0, 72, 0, 0, 0,
    72, 0, 76, 0, 79, 0, 76, 0,   81, 0, 81, 0, 79, 0, 0, 0,
    79, 0, 76, 0, 74, 0, 76, 0,   72, 0, 0, 0, 0, 0, 0, 0,
  ];
  const BASS = [
    48, 0, 0, 0, 55, 0, 0, 0,     45, 0, 0, 0, 52, 0, 0, 0,
    50, 0, 0, 0, 57, 0, 0, 0,     43, 0, 0, 0, 48, 0, 0, 0,
    48, 0, 0, 0, 55, 0, 0, 0,     45, 0, 0, 0, 52, 0, 0, 0,
    43, 0, 0, 0, 50, 0, 0, 0,     48, 0, 0, 0, 55, 0, 0, 0,
  ];

  function scheduleBgm() {
    if (!ctx || !bgmPlaying) return;
    const ahead = 0.35;
    while (bgmNextTime < ctx.currentTime + ahead) {
      const i = bgmStep % MELODY.length;
      const m = MELODY[i];
      if (m) tone({ freq: midi(m), type: "triangle", dur: STEP * 1.7, vol: 0.16, at: bgmNextTime, bus: bgmBus });
      const b = BASS[i];
      if (b) tone({ freq: midi(b), type: "square", dur: STEP * 1.4, vol: 0.07, at: bgmNextTime, bus: bgmBus, attack: 0.01 });
      if (i % 4 === 2) noise({ freq: 6000, dur: 0.05, vol: 0.03, filterType: "highpass", at: bgmNextTime, bus: bgmBus });
      bgmNextTime += STEP;
      bgmStep++;
    }
  }

  function startBgm() {
    if (!ensure() || bgmPlaying) return;
    bgmPlaying = true;
    bgmStep = 0;
    bgmNextTime = ctx.currentTime + 0.1;
    bgmTimer = setInterval(scheduleBgm, 120);
  }

  function stopBgm() {
    bgmPlaying = false;
    if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
  }

  function play(name, arg) {
    if (!enabled) return;
    if (!ensure()) return;
    if (sfx[name]) sfx[name](arg);
  }

  function setEnabled(on) {
    enabled = on;
    try { localStorage.setItem("korokoroGolfSound", on ? "on" : "off"); } catch (e) {}
    if (master) master.gain.value = on ? 1 : 0;
  }

  return {
    ensure, play, startBgm, stopBgm, setEnabled,
    get enabled() { return enabled; },
  };
})();
