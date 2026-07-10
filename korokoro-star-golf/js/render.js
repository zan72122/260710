/* ================================================================
   render.js — 描画（そら・うかぶコース・キャラクター・エフェクト）
   ================================================================ */
"use strict";

const Renderer = (() => {
  let canvas = null, ctx = null;
  let W = 0, H = 0, dpr = 1;
  let time = 0;

  /* ワールドごとのテーマカラー */
  const THEMES = [
    { /* くさはら */
      skyTop: "#4fb3f5", skyBot: "#d9f3ff",
      grassA: "#82db58", grassB: "#6fce46", edge: "#4ca43c",
      side: "#9c6b3f", sideDark: "#7a4f2c",
      sand: "#f6d98c", sandB: "#efcf7c",
      deco: "flower", sunHue: 48,
    },
    { /* うみべ */
      skyTop: "#38a7e8", skyBot: "#ffe7bb",
      grassA: "#abe26a", grassB: "#98d656", edge: "#6cb23e",
      side: "#e5bd77", sideDark: "#c99c56",
      sand: "#fce3a0", sandB: "#f5d88c",
      deco: "shell", sunHue: 34,
    },
    { /* おそら */
      skyTop: "#8b7bf7", skyBot: "#ffd9f1",
      grassA: "#a4ecd9", grassB: "#8ce0ca", edge: "#5dbfa9",
      side: "#f0a8da", sideDark: "#d288be",
      sand: "#f9d9ef", sandB: "#f2cbe6",
      deco: "candy", sunHue: 300,
    },
  ];

  const view = { unit: 60, ox: 0, oy: 0 };
  let clouds = [];
  let bgStars = [];
  let deco = [];          /* レベルごとの飾り */
  let islands = [];       /* 背景に浮かぶ小島 */

  function init(cv) {
    canvas = cv;
    ctx = canvas.getContext("2d");
    /* 雲は常に流れている */
    for (let i = 0; i < 7; i++) {
      clouds.push({
        x: Math.random(), y: 0.05 + Math.random() * 0.55,
        s: randRange(0.5, 1.3), v: randRange(0.006, 0.02),
      });
    }
    for (let i = 0; i < 26; i++) {
      bgStars.push({ x: Math.random(), y: Math.random() * 0.6, p: Math.random() * TAU, s: randRange(1, 2.6) });
    }
    for (let i = 0; i < 3; i++) {
      islands.push({ x: 0.12 + i * 0.36 + randRange(-0.05, 0.05), y: 0.68 + randRange(-0.06, 0.1), s: randRange(0.5, 1) });
    }
    resize();
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* コース全体が画面に収まるよう表示倍率を決める（縦横どちらでもOK） */
  function computeView(level) {
    /* 背の低い画面（iPhone横向きなど）では余白を詰めてコースを大きく */
    const compact = H < 520;
    const safeT = compact ? 72 : 96, safeB = compact ? 34 : 84, safeS = compact ? 12 : 18;
    const availW = W - safeS * 2;
    const availH = H - safeT - safeB;
    const depth = 0.7; /* 島の側面ぶん */
    view.unit = Math.min(availW / level.w, availH / (level.h + depth), 120);
    view.ox = (W - level.w * view.unit) / 2;
    view.oy = safeT + (availH - (level.h + depth) * view.unit) / 2;
  }

  function toScreen(x, y) {
    return { x: view.ox + x * view.unit, y: view.oy + y * view.unit };
  }
  function toWorld(sx, sy) {
    return { x: (sx - view.ox) / view.unit, y: (sy - view.oy) / view.unit };
  }

  /* レベルの飾り（花・かい・キャンディ）を決定的に配置 */
  function buildDeco(level) {
    deco = [];
    const rng = mulberry32(level.index * 1000 + 77);
    const theme = THEMES[level.world];
    const avoid = [];
    avoid.push(level.start, level.goal);
    level.enemies.forEach((e) => avoid.push(e));
    level.fruits.forEach((f) => avoid.push(f));
    level.bumpers.forEach((b) => avoid.push(b));

    for (let y = 0; y < level.h; y++) {
      for (let x = 0; x < level.w; x++) {
        if (level.tiles[y][x] !== ".") continue;
        if (rng() > 0.16) continue;
        const px = x + 0.2 + rng() * 0.6;
        const py = y + 0.2 + rng() * 0.6;
        if (avoid.some((a) => dist(a.x, a.y, px, py) < 1.0)) continue;
        deco.push({
          x: px, y: py, kind: theme.deco,
          hue: [340, 48, 200, 20, 280][Math.floor(rng() * 5)],
          s: 0.5 + rng() * 0.5, phase: rng() * TAU,
        });
      }
    }
  }

  /* ================= そら ================= */

  function drawSky(worldIdx) {
    const th = THEMES[clamp(worldIdx, 0, 2)];
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, th.skyTop);
    g.addColorStop(1, th.skyBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    /* おひさま */
    const sx = W * 0.85, sy = H * 0.13, sr = Math.min(W, H) * 0.07;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(time * 0.15);
    ctx.fillStyle = hsl(th.sunHue, 100, 78, 0.55);
    for (let i = 0; i < 12; i++) {
      ctx.rotate(TAU / 12);
      ctx.beginPath();
      ctx.moveTo(sr * 1.15, -sr * 0.16);
      ctx.lineTo(sr * 1.7, 0);
      ctx.lineTo(sr * 1.15, sr * 0.16);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
    sg.addColorStop(0, hsl(th.sunHue, 100, 88));
    sg.addColorStop(1, hsl(th.sunHue, 100, 72));
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, TAU);
    ctx.fill();
    /* おひさまの顔 */
    ctx.fillStyle = "rgba(120,80,20,.55)";
    ctx.beginPath(); ctx.arc(sx - sr * 0.3, sy - sr * 0.1, sr * 0.07, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(sx + sr * 0.3, sy - sr * 0.1, sr * 0.07, 0, TAU); ctx.fill();
    ctx.strokeStyle = "rgba(120,80,20,.55)";
    ctx.lineWidth = sr * 0.08;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(sx, sy + sr * 0.15, sr * 0.28, 0.25, Math.PI - 0.25);
    ctx.stroke();

    /* ワールド3はほしとにじ */
    if (worldIdx === 2) {
      for (const st of bgStars) {
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(time * 1.6 + st.p));
        ctx.fillStyle = `rgba(255,255,255,${0.5 * tw})`;
        traceStar(ctx, st.x * W, st.y * H, st.s * 2.4, st.s, 5, st.p);
        ctx.fill();
      }
      ctx.save();
      ctx.globalAlpha = 0.35;
      const rainbowR = Math.max(W, H) * 0.55;
      const colors = ["#ff6b6b", "#ffab4c", "#ffd93d", "#7ed957", "#5db8ff", "#b28dff"];
      colors.forEach((c, i) => {
        ctx.strokeStyle = c;
        ctx.lineWidth = rainbowR * 0.035;
        ctx.beginPath();
        ctx.arc(W * 0.1, H * 1.05, rainbowR - i * rainbowR * 0.035, -Math.PI * 0.55, -Math.PI * 0.08);
        ctx.stroke();
      });
      ctx.restore();
    }

    /* 背景の小島（ゆっくりただよう） */
    for (const is of islands) {
      const ix = is.x * W;
      const iy = is.y * H + Math.sin(time * 0.5 + is.x * 9) * 6;
      const iw = Math.min(W, H) * 0.09 * is.s;
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = th.sideDark;
      ctx.beginPath();
      ctx.moveTo(ix - iw, iy);
      ctx.quadraticCurveTo(ix, iy + iw * 1.3, ix + iw, iy);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = th.grassA;
      ctx.beginPath();
      ctx.ellipse(ix, iy, iw, iw * 0.35, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    /* くも */
    for (const c of clouds) {
      c.x += c.v * 0.016;
      if (c.x > 1.25) c.x = -0.25;
      const cx = c.x * W, cy = c.y * H;
      const cs = Math.min(W, H) * 0.06 * c.s;
      ctx.fillStyle = "rgba(255,255,255,.85)";
      ctx.beginPath();
      ctx.arc(cx, cy, cs, 0, TAU);
      ctx.arc(cx + cs * 0.9, cy + cs * 0.15, cs * 0.75, 0, TAU);
      ctx.arc(cx - cs * 0.9, cy + cs * 0.2, cs * 0.7, 0, TAU);
      ctx.arc(cx + cs * 0.2, cy - cs * 0.45, cs * 0.65, 0, TAU);
      ctx.fill();
    }
  }

  /* ================= コース ================= */

  function drawCourse(level) {
    const th = THEMES[level.world];
    const u = view.unit;
    const isVoid = (x, y) => tileAt(level, x, y) === " ";

    /* --- 影 --- */
    ctx.save();
    ctx.fillStyle = "rgba(30,50,90,.18)";
    ctx.beginPath();
    for (let y = 0; y < level.h; y++) {
      for (let x = 0; x < level.w; x++) {
        if (isVoid(x, y)) continue;
        const s = toScreen(x, y);
        ctx.rect(s.x + u * 0.3, s.y + u * 1.0, u + 1, u);
      }
    }
    ctx.fill();
    ctx.restore();

    /* --- 島の側面（浮いてる感じ） --- */
    const depth = u * 0.62;
    for (let y = 0; y < level.h; y++) {
      for (let x = 0; x < level.w; x++) {
        if (isVoid(x, y) || !isVoid(x, y + 1)) continue;
        const s = toScreen(x, y + 1);
        const g = ctx.createLinearGradient(0, s.y, 0, s.y + depth);
        g.addColorStop(0, th.side);
        g.addColorStop(1, th.sideDark);
        ctx.fillStyle = g;
        ctx.fillRect(s.x - 0.5, s.y - u * 0.08, u + 1, depth + u * 0.08);
        /* 底の丸み */
        ctx.fillStyle = th.sideDark;
        ctx.beginPath();
        ctx.ellipse(s.x + u / 2, s.y + depth, u / 2 + 0.5, u * 0.1, 0, 0, Math.PI);
        ctx.fill();
      }
    }

    /* --- ゆか --- */
    for (let y = 0; y < level.h; y++) {
      for (let x = 0; x < level.w; x++) {
        const c = tileAt(level, x, y);
        if (c === " ") continue;
        const s = toScreen(x, y);
        const checker = (x + y) % 2 === 0;
        let fill;
        switch (c) {
          case "s": fill = checker ? th.sand : th.sandB; break;
          case "w": fill = checker ? "#4fb0f2" : "#45a6ea"; break;
          case "i": fill = checker ? "#cfeefc" : "#bfe6fa"; break;
          default:  fill = checker ? th.grassA : th.grassB;
        }
        ctx.fillStyle = fill;
        ctx.fillRect(s.x - 0.5, s.y - 0.5, u + 1, u + 1);
      }
    }

    /* --- 水のアニメーション＆すなのてんてん＆こおりのキラッ --- */
    for (let y = 0; y < level.h; y++) {
      for (let x = 0; x < level.w; x++) {
        const c = tileAt(level, x, y);
        const s = toScreen(x, y);
        if (c === "w") {
          ctx.save();
          ctx.beginPath();
          ctx.rect(s.x, s.y, u, u);
          ctx.clip();
          ctx.strokeStyle = "rgba(255,255,255,.35)";
          ctx.lineWidth = u * 0.06;
          ctx.lineCap = "round";
          for (let k = 0; k < 2; k++) {
            const wy = s.y + ((time * 0.35 + k * 0.5 + x * 0.23 + y * 0.11) % 1) * u;
            ctx.beginPath();
            ctx.moveTo(s.x + u * 0.15, wy);
            ctx.quadraticCurveTo(s.x + u * 0.5, wy - u * 0.12, s.x + u * 0.85, wy);
            ctx.stroke();
          }
          ctx.restore();
          /* 岸のあわ */
          ctx.strokeStyle = "rgba(255,255,255,.7)";
          ctx.lineWidth = u * 0.08;
          const foamOff = Math.sin(time * 2 + x + y) * u * 0.02;
          if (tileAt(level, x, y - 1) !== "w" && tileAt(level, x, y - 1) !== " ") {
            ctx.beginPath(); ctx.moveTo(s.x, s.y + u * 0.06 + foamOff); ctx.lineTo(s.x + u, s.y + u * 0.06 + foamOff); ctx.stroke();
          }
          if (tileAt(level, x, y + 1) !== "w" && tileAt(level, x, y + 1) !== " ") {
            ctx.beginPath(); ctx.moveTo(s.x, s.y + u * 0.94 - foamOff); ctx.lineTo(s.x + u, s.y + u * 0.94 - foamOff); ctx.stroke();
          }
          if (tileAt(level, x - 1, y) !== "w" && tileAt(level, x - 1, y) !== " ") {
            ctx.beginPath(); ctx.moveTo(s.x + u * 0.06 + foamOff, s.y); ctx.lineTo(s.x + u * 0.06 + foamOff, s.y + u); ctx.stroke();
          }
          if (tileAt(level, x + 1, y) !== "w" && tileAt(level, x + 1, y) !== " ") {
            ctx.beginPath(); ctx.moveTo(s.x + u * 0.94 - foamOff, s.y); ctx.lineTo(s.x + u * 0.94 - foamOff, s.y + u); ctx.stroke();
          }
        } else if (c === "s") {
          ctx.fillStyle = "rgba(180,140,60,.35)";
          const rng = mulberry32(x * 91 + y * 13);
          for (let k = 0; k < 4; k++) {
            ctx.beginPath();
            ctx.arc(s.x + u * (0.15 + rng() * 0.7), s.y + u * (0.15 + rng() * 0.7), u * 0.035, 0, TAU);
            ctx.fill();
          }
        } else if (c === "i") {
          const tw = Math.abs(Math.sin(time * 1.4 + x * 2.3 + y * 1.7));
          if (tw > 0.75) {
            ctx.fillStyle = `rgba(255,255,255,${(tw - 0.75) * 3})`;
            traceStar(ctx, s.x + u * 0.5, s.y + u * 0.4, u * 0.12, u * 0.05, 4, time);
            ctx.fill();
          }
        } else if (c === ">" || c === "<" || c === "^" || c === "v") {
          /* ブーストやじるし（ながれるシェブロン） */
          const dir = { ">": [1, 0], "<": [-1, 0], "^": [0, -1], "v": [0, 1] }[c];
          ctx.save();
          ctx.translate(s.x + u / 2, s.y + u / 2);
          ctx.rotate(Math.atan2(dir[1], dir[0]));
          ctx.fillStyle = "rgba(255,255,255,.28)";
          traceRoundRect(ctx, -u * 0.42, -u * 0.42, u * 0.84, u * 0.84, u * 0.2);
          ctx.fill();
          const flow = (time * 1.6) % 1;
          for (let k = 0; k < 2; k++) {
            const cxo = -u * 0.3 + ((flow + k * 0.5) % 1) * u * 0.5;
            const alpha = 0.9 * Math.sin(((flow + k * 0.5) % 1) * Math.PI);
            ctx.strokeStyle = `rgba(255,235,90,${alpha})`;
            ctx.lineWidth = u * 0.11;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.beginPath();
            ctx.moveTo(cxo - u * 0.1, -u * 0.2);
            ctx.lineTo(cxo + u * 0.1, 0);
            ctx.lineTo(cxo - u * 0.1, u * 0.2);
            ctx.stroke();
          }
          ctx.restore();
        }
      }
    }

    /* --- しげみのかべ --- */
    for (let y = 0; y < level.h; y++) {
      for (let x = 0; x < level.w; x++) {
        if (tileAt(level, x, y) !== "#") continue;
        const s = toScreen(x, y);
        const sway = Math.sin(time * 1.8 + x * 1.3 + y) * u * 0.015;
        ctx.fillStyle = "rgba(30,50,90,.15)";
        ctx.beginPath();
        ctx.ellipse(s.x + u / 2, s.y + u * 0.85, u * 0.45, u * 0.14, 0, 0, TAU);
        ctx.fill();
        const bg = ctx.createRadialGradient(s.x + u * 0.35, s.y + u * 0.3, u * 0.1, s.x + u / 2, s.y + u / 2, u * 0.62);
        bg.addColorStop(0, "#67c24f");
        bg.addColorStop(1, "#3f9634");
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.arc(s.x + u * 0.32 + sway, s.y + u * 0.5, u * 0.3, 0, TAU);
        ctx.arc(s.x + u * 0.68 + sway, s.y + u * 0.5, u * 0.3, 0, TAU);
        ctx.arc(s.x + u * 0.5 + sway, s.y + u * 0.3, u * 0.3, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.25)";
        ctx.beginPath();
        ctx.arc(s.x + u * 0.42 + sway, s.y + u * 0.24, u * 0.09, 0, TAU);
        ctx.fill();
      }
    }

    /* --- ふち（コースの輪郭） --- */
    ctx.strokeStyle = th.edge;
    ctx.lineWidth = u * 0.1;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let y = 0; y < level.h; y++) {
      for (let x = 0; x < level.w; x++) {
        if (isVoid(x, y)) continue;
        const s = toScreen(x, y);
        if (isVoid(x, y - 1)) { ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + u, s.y); }
        if (isVoid(x, y + 1)) { ctx.moveTo(s.x, s.y + u); ctx.lineTo(s.x + u, s.y + u); }
        if (isVoid(x - 1, y)) { ctx.moveTo(s.x, s.y); ctx.lineTo(s.x, s.y + u); }
        if (isVoid(x + 1, y)) { ctx.moveTo(s.x + u, s.y); ctx.lineTo(s.x + u, s.y + u); }
      }
    }
    ctx.stroke();

    /* --- かざり --- */
    for (const d of deco) {
      const s = toScreen(d.x, d.y);
      const ds = u * 0.14 * d.s;
      const sway = Math.sin(time * 2 + d.phase) * 0.15;
      ctx.save();
      ctx.translate(s.x, s.y);
      if (d.kind === "flower") {
        ctx.rotate(sway);
        ctx.fillStyle = hsl(d.hue, 85, 72);
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * TAU;
          ctx.beginPath();
          ctx.ellipse(Math.cos(a) * ds, Math.sin(a) * ds, ds * 0.75, ds * 0.5, a, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = "#ffd93d";
        ctx.beginPath(); ctx.arc(0, 0, ds * 0.55, 0, TAU); ctx.fill();
      } else if (d.kind === "shell") {
        ctx.rotate(sway * 0.4);
        ctx.fillStyle = hsl(d.hue, 60, 80);
        ctx.beginPath();
        ctx.arc(0, 0, ds * 1.2, Math.PI, TAU);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = hsl(d.hue, 50, 62);
        ctx.lineWidth = ds * 0.16;
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(k * ds * 0.7, -ds * 0.95);
          ctx.stroke();
        }
      } else { /* candy */
        ctx.rotate(d.phase + sway);
        ctx.fillStyle = hsl(d.hue, 90, 74);
        ctx.beginPath(); ctx.arc(0, 0, ds, 0, TAU); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.8)";
        ctx.lineWidth = ds * 0.3;
        ctx.beginPath(); ctx.arc(0, 0, ds * 0.55, 0.3, 2.4); ctx.stroke();
        ctx.fillStyle = hsl(d.hue, 90, 74);
        ctx.beginPath();
        ctx.moveTo(-ds * 1.7, -ds * 0.7); ctx.lineTo(-ds * 0.8, 0); ctx.lineTo(-ds * 1.7, ds * 0.7); ctx.closePath();
        ctx.moveTo(ds * 1.7, -ds * 0.7); ctx.lineTo(ds * 0.8, 0); ctx.lineTo(ds * 1.7, ds * 0.7); ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /* ================= もの ================= */

  function drawFruit(f) {
    if (f.taken) return;
    const u = view.unit;
    const bob = Math.sin(time * 2.4 + f.x * 3) * u * 0.06;
    const s = toScreen(f.x, f.y);
    const r = u * 0.24;
    /* かげ */
    ctx.fillStyle = "rgba(30,50,90,.16)";
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + u * 0.24, r * 0.8, r * 0.3, 0, 0, TAU);
    ctx.fill();
    /* キラキラのわ */
    ctx.strokeStyle = `rgba(255,255,255,${0.3 + 0.25 * Math.sin(time * 3 + f.x)})`;
    ctx.lineWidth = u * 0.04;
    ctx.beginPath();
    ctx.arc(s.x, s.y + bob, r * 1.45, time * 1.2, time * 1.2 + Math.PI * 1.2);
    ctx.stroke();

    ctx.save();
    ctx.translate(s.x, s.y + bob);
    const kinds = [
      { c1: "#ff6b6b", c2: "#e84545" },  /* りんご */
      { c1: "#ffab4c", c2: "#f28c1b" },  /* みかん */
      { c1: "#b28dff", c2: "#9464f0" },  /* ぶどう */
      { c1: "#ffd93d", c2: "#f0b400" },  /* ほしキャンディ */
    ];
    const k = kinds[f.kind];
    if (f.kind === 3) {
      ctx.fillStyle = k.c1;
      ctx.strokeStyle = k.c2;
      ctx.lineWidth = u * 0.04;
      traceStar(ctx, 0, 0, r * 1.15, r * 0.55, 5, Math.sin(time * 1.5) * 0.2);
      ctx.fill(); ctx.stroke();
    } else if (f.kind === 2) {
      ctx.fillStyle = k.c1;
      for (const [gx, gy] of [[-0.4, -0.3], [0.4, -0.3], [0, 0.1], [-0.4, 0.5], [0.4, 0.5], [0, 0.9]]) {
        ctx.beginPath(); ctx.arc(gx * r, gy * r - r * 0.3, r * 0.45, 0, TAU); ctx.fill();
      }
    } else {
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
      g.addColorStop(0, k.c1);
      g.addColorStop(1, k.c2);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      /* はっぱ */
      ctx.fillStyle = "#5cb849";
      ctx.beginPath();
      ctx.ellipse(r * 0.25, -r * 1.05, r * 0.34, r * 0.16, -0.6, 0, TAU);
      ctx.fill();
    }
    /* ハイライト */
    ctx.fillStyle = "rgba(255,255,255,.5)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.35, -r * 0.4, r * 0.22, r * 0.14, -0.6, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawBumper(b) {
    const u = view.unit;
    const s = toScreen(b.x, b.y);
    const sq = 1 + b.squish * 0.5;             /* たたかれると ぺちゃっ */
    const wV = 1 + b.squish * 0.6, hV = 1 - b.squish * 0.45;
    const capR = u * 0.36;
    ctx.fillStyle = "rgba(30,50,90,.18)";
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + u * 0.3, capR * wV, capR * 0.35, 0, 0, TAU);
    ctx.fill();
    /* じく */
    ctx.fillStyle = "#fdf3e0";
    traceRoundRect(ctx, s.x - u * 0.13, s.y - u * 0.05, u * 0.26, u * 0.34, u * 0.1);
    ctx.fill();
    /* かさ */
    ctx.save();
    ctx.translate(s.x, s.y - u * 0.02);
    ctx.scale(wV, hV);
    const g = ctx.createRadialGradient(-capR * 0.3, -capR * 0.5, capR * 0.1, 0, -capR * 0.2, capR * 1.2);
    g.addColorStop(0, "#ff8181");
    g.addColorStop(1, "#e8484f");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-capR, 0);
    ctx.quadraticCurveTo(-capR, -capR * 1.35, 0, -capR * 1.35);
    ctx.quadraticCurveTo(capR, -capR * 1.35, capR, 0);
    ctx.quadraticCurveTo(0, capR * 0.28, -capR, 0);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.9)";
    for (const [dx, dy, dr] of [[-0.45, -0.55, 0.2], [0.3, -0.75, 0.16], [0.05, -0.3, 0.13]]) {
      ctx.beginPath();
      ctx.arc(dx * capR, dy * capR, dr * capR * sq, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawEnemy(e, ballX, ballY) {
    if (!e.alive) return;
    const u = view.unit;
    const s = toScreen(e.x, e.y);
    const r = u * 0.34;
    const bounce = Math.abs(Math.sin(time * 3.2 + e.phase)) * u * 0.05;
    const wob = 1 + e.wobble * 0.4;
    /* かげ */
    ctx.fillStyle = "rgba(30,50,90,.18)";
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + r * 0.9, r * 0.85, r * 0.3, 0, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.translate(s.x, s.y - bounce);
    ctx.scale(wob, 2 - wob);
    /* あしをぱたぱた */
    ctx.fillStyle = hsl(e.hue, 70, 46);
    const step = Math.sin(time * 6 + e.phase) * r * 0.12;
    ctx.beginPath();
    ctx.ellipse(-r * 0.5, r * 0.8 + step, r * 0.32, r * 0.2, 0, 0, TAU);
    ctx.ellipse(r * 0.5, r * 0.8 - step, r * 0.32, r * 0.2, 0, 0, TAU);
    ctx.fill();
    /* からだ */
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.15);
    g.addColorStop(0, hsl(e.hue, 88, 72));
    g.addColorStop(1, hsl(e.hue, 78, 58));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.35)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.34, -r * 0.42, r * 0.3, r * 0.18, -0.7, 0, TAU);
    ctx.fill();
    /* ボールのほうを見る */
    const la = Math.atan2(ballY - e.y, ballX - e.x);
    const lx = Math.cos(la) * r * 0.1, ly = Math.sin(la) * r * 0.1;
    const blink = (Math.sin(time * 1.1 + e.phase * 3) > 0.97);
    ctx.fillStyle = "#31344b";
    if (blink) {
      ctx.strokeStyle = "#31344b";
      ctx.lineWidth = r * 0.1;
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-r * 0.42, -r * 0.1); ctx.lineTo(-r * 0.18, -r * 0.1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r * 0.18, -r * 0.1); ctx.lineTo(r * 0.42, -r * 0.1); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(-r * 0.3 + lx, -r * 0.12 + ly, r * 0.13, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.3 + lx, -r * 0.12 + ly, r * 0.13, 0, TAU); ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(-r * 0.34 + lx, -r * 0.18 + ly, r * 0.045, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.26 + lx, -r * 0.18 + ly, r * 0.045, 0, TAU); ctx.fill();
    }
    /* ほっぺとくち */
    ctx.fillStyle = hsl(e.hue, 90, 80, 0.9);
    ctx.beginPath(); ctx.ellipse(-r * 0.55, r * 0.14, r * 0.14, r * 0.09, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r * 0.55, r * 0.14, r * 0.14, r * 0.09, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#31344b";
    ctx.lineWidth = r * 0.09;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(lx, r * 0.18 + ly, r * 0.16, 0.3, Math.PI - 0.3);
    ctx.stroke();
    ctx.restore();
  }

  function drawGoal(level, goalActive, goalAnim) {
    const u = view.unit;
    const s = toScreen(level.goal.x, level.goal.y);
    if (!goalActive) {
      /* まだかくれてる：うっすら「？」 */
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(time * 2);
      ctx.fillStyle = "#fff";
      ctx.font = `900 ${u * 0.5}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("？", s.x, s.y);
      ctx.restore();
      return;
    }
    const pop = easeOutBack(clamp(goalAnim, 0, 1));
    const r = u * 0.42 * pop;
    /* にじのひかりのはしら */
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.2 * Math.sin(time * 3);
    const beam = ctx.createLinearGradient(0, s.y - u * 3.2, 0, s.y);
    beam.addColorStop(0, "rgba(255,255,255,0)");
    beam.addColorStop(1, "rgba(255,240,150,.55)");
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(s.x - r * 0.5, s.y);
    ctx.lineTo(s.x - r * 1.5, s.y - u * 3.2);
    ctx.lineTo(s.x + r * 1.5, s.y - u * 3.2);
    ctx.lineTo(s.x + r * 0.5, s.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    /* あな */
    ctx.fillStyle = "rgba(30,50,90,.25)";
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + r * 0.15, r * 1.15, r * 0.5, 0, 0, TAU);
    ctx.fill();
    const hg = ctx.createRadialGradient(s.x, s.y, r * 0.1, s.x, s.y, r);
    hg.addColorStop(0, "#2c2f52");
    hg.addColorStop(0.7, "#4a4e86");
    hg.addColorStop(1, "#6d72b8");
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, r, r * 0.55, 0, 0, TAU);
    ctx.fill();
    /* うずまき */
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.scale(1, 0.55);
    ctx.strokeStyle = "rgba(255,255,255,.5)";
    ctx.lineWidth = u * 0.05;
    ctx.beginPath();
    for (let a = 0; a < TAU * 1.6; a += 0.2) {
      const rr = r * 0.85 * (1 - a / (TAU * 1.8));
      const px = Math.cos(a - time * 2.6) * rr;
      const py = Math.sin(a - time * 2.6) * rr;
      if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
    /* まわるほし */
    for (let k = 0; k < 3; k++) {
      const a = time * 2 + (k / 3) * TAU;
      const px = s.x + Math.cos(a) * r * 1.5;
      const py = s.y + Math.sin(a) * r * 0.8 - u * 0.15;
      ctx.fillStyle = "#ffd93d";
      traceStar(ctx, px, py, u * 0.1, u * 0.045, 5, a);
      ctx.fill();
    }
  }

  /* ボール（ぷにまる）を画面座標で描く */
  function drawBallAt(sx, sy, r, o) {
    const mood = o.mood || "happy";
    const lookX = o.lookX || 0, lookY = o.lookY || 0;
    const sqX = o.squashX || 1, sqY = o.squashY || 1;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(sqX, sqY);

    /* からだ */
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.12, 0, 0, r * 1.2);
    g.addColorStop(0, "#ffc0e0");
    g.addColorStop(0.55, "#ff9ecf");
    g.addColorStop(1, "#f470ae");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();

    /* ころがりの模様（回転がわかるハイライト） */
    ctx.save();
    ctx.rotate(o.roll || 0);
    ctx.strokeStyle = "rgba(255,255,255,.45)";
    ctx.lineWidth = r * 0.16;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.72, -1.9, -0.7);
    ctx.stroke();
    ctx.fillStyle = "rgba(244,112,174,.5)";
    ctx.beginPath();
    ctx.arc(r * 0.5, r * 0.35, r * 0.14, 0, TAU);
    ctx.fill();
    ctx.restore();

    /* かお */
    const ex = clamp(lookX, -1, 1) * r * 0.14;
    const ey = clamp(lookY, -1, 1) * r * 0.12;
    const eyeH = (o.blink ? 0.06 : 0.3) * r;
    ctx.fillStyle = "#31344b";
    if (mood === "joy") {
      /* にっこり目 */
      ctx.strokeStyle = "#31344b";
      ctx.lineWidth = r * 0.11;
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(-r * 0.3 + ex, -r * 0.12 + ey, r * 0.16, Math.PI, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(r * 0.3 + ex, -r * 0.12 + ey, r * 0.16, Math.PI, TAU); ctx.stroke();
    } else if (mood === "dizzy") {
      ctx.strokeStyle = "#31344b";
      ctx.lineWidth = r * 0.09;
      ctx.lineCap = "round";
      for (const dx of [-0.3, 0.3]) {
        ctx.beginPath(); ctx.moveTo(dx * r - r * 0.11, -r * 0.22); ctx.lineTo(dx * r + r * 0.11, -r * 0.02); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(dx * r + r * 0.11, -r * 0.22); ctx.lineTo(dx * r - r * 0.11, -r * 0.02); ctx.stroke();
      }
    } else {
      ctx.beginPath(); ctx.ellipse(-r * 0.3 + ex, -r * 0.12 + ey, r * 0.115, eyeH, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(r * 0.3 + ex, -r * 0.12 + ey, r * 0.115, eyeH, 0, 0, TAU); ctx.fill();
      if (!o.blink) {
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.ellipse(-r * 0.33 + ex, -r * 0.2 + ey, r * 0.045, r * 0.07, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(r * 0.27 + ex, -r * 0.2 + ey, r * 0.045, r * 0.07, 0, 0, TAU); ctx.fill();
      }
    }
    /* ほっぺ */
    ctx.fillStyle = "rgba(255,111,165,.85)";
    ctx.beginPath(); ctx.ellipse(-r * 0.58, r * 0.12, r * 0.15, r * 0.1, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r * 0.58, r * 0.12, r * 0.15, r * 0.1, 0, 0, TAU); ctx.fill();
    /* くち */
    ctx.strokeStyle = "#31344b";
    ctx.lineWidth = r * 0.09;
    ctx.lineCap = "round";
    if (mood === "wow" || mood === "roll") {
      ctx.fillStyle = "#31344b";
      ctx.beginPath();
      ctx.ellipse(ex, r * 0.28 + ey, r * 0.13, r * 0.16, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#ff8aa8";
      ctx.beginPath();
      ctx.ellipse(ex, r * 0.33 + ey, r * 0.07, r * 0.07, 0, 0, TAU);
      ctx.fill();
    } else if (mood === "sad") {
      ctx.beginPath();
      ctx.arc(ex, r * 0.42 + ey, r * 0.16, Math.PI + 0.4, TAU - 0.4);
      ctx.stroke();
    } else if (mood === "aim") {
      ctx.beginPath();
      ctx.moveTo(-r * 0.12 + ex, r * 0.28 + ey);
      ctx.lineTo(r * 0.12 + ex, r * 0.28 + ey);
      ctx.stroke();
    } else if (mood === "joy") {
      ctx.fillStyle = "#31344b";
      ctx.beginPath();
      ctx.arc(ex, r * 0.22 + ey, r * 0.2, 0.15, Math.PI - 0.15);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ff8aa8";
      ctx.beginPath();
      ctx.ellipse(ex, r * 0.34 + ey, r * 0.1, r * 0.06, 0, 0, TAU);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(ex, r * 0.2 + ey, r * 0.16, 0.3, Math.PI - 0.3);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBall(game) {
    const b = game.ball;
    const u = view.unit;
    const s = toScreen(b.x, b.y);
    const r = u * game.BALL_R;
    /* かげ */
    ctx.fillStyle = "rgba(30,50,90,.2)";
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + r * 0.85, r * 0.9 * b.squashX, r * 0.32, 0, 0, TAU);
    ctx.fill();
    drawBallAt(s.x, s.y - r * 0.1, r * b.scale, {
      mood: b.mood,
      lookX: b.lookX, lookY: b.lookY,
      squashX: b.squashX, squashY: b.squashY,
      roll: b.roll, blink: b.blinkT > 0,
    });
  }

  function drawAim(game) {
    if (!game.aiming || game.aimPower <= 0.02) return;
    const b = game.ball;
    const u = view.unit;
    const s = toScreen(b.x, b.y);
    const p = game.aimPower;                    /* 0〜1 */
    const ang = game.aimAngle;
    const hue = lerp(130, 0, p);                /* みどり→あか */

    /* パワーリング */
    ctx.strokeStyle = hsl(hue, 85, 55, 0.9);
    ctx.lineWidth = u * 0.12;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(s.x, s.y, u * 0.55, -Math.PI / 2, -Math.PI / 2 + p * TAU);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.35)";
    ctx.lineWidth = u * 0.12;
    ctx.beginPath();
    ctx.arc(s.x, s.y, u * 0.55, -Math.PI / 2 + p * TAU, -Math.PI / 2 + TAU);
    ctx.stroke();

    /* てんてんの矢印 */
    const len = u * (0.9 + p * 3.4);
    const n = Math.max(3, Math.round(3 + p * 8));
    const march = (time * 2.2) % 1;
    for (let i = 0; i < n; i++) {
      const t = (i + march) / n;
      const px = s.x + Math.cos(ang) * len * t;
      const py = s.y + Math.sin(ang) * len * t;
      const dotR = u * (0.05 + 0.075 * t) * (0.8 + p * 0.5);
      ctx.fillStyle = hsl(hue, 90, 60, 0.55 + 0.45 * t);
      ctx.beginPath();
      ctx.arc(px, py, dotR, 0, TAU);
      ctx.fill();
    }
    /* やじるしの先 */
    const hx = s.x + Math.cos(ang) * (len + u * 0.28);
    const hy = s.y + Math.sin(ang) * (len + u * 0.28);
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(ang);
    ctx.fillStyle = hsl(hue, 90, 58);
    ctx.strokeStyle = "rgba(255,255,255,.9)";
    ctx.lineWidth = u * 0.05;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(u * 0.3, 0);
    ctx.lineTo(-u * 0.16, -u * 0.24);
    ctx.lineTo(-u * 0.05, 0);
    ctx.lineTo(-u * 0.16, u * 0.24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /* ================= フレーム ================= */

  function drawFrame(game, dt) {
    time += dt;
    const state = game.state;

    if (state === "title" || state === "map") {
      drawSky(state === "map" ? 0 : 0);
      /* タイトルでは飾りの星がふわふわ */
      Particles.update(dt);
      Particles.draw(ctx, (x, y) => ({ x: x * 60, y: y * 60 }), 60);
      return;
    }

    const level = game.level;
    if (!level) return;
    drawSky(level.world);

    ctx.save();
    if (game.shake > 0.001) {
      ctx.translate(
        (Math.random() - 0.5) * game.shake * view.unit * 0.3,
        (Math.random() - 0.5) * game.shake * view.unit * 0.3
      );
    }

    drawCourse(level);
    drawGoal(level, game.goalActive, game.goalAnim);
    for (const f of level.fruits) drawFruit(f);
    for (const bp of level.bumpers) drawBumper(bp);
    for (const e of level.enemies) drawEnemy(e, game.ball.x, game.ball.y);
    if (!game.ballHidden) drawBall(game);
    Particles.draw(ctx, toScreen, view.unit);
    drawAim(game);

    ctx.restore();
  }

  return {
    init, resize, computeView, toScreen, toWorld, buildDeco,
    drawFrame, drawBallAt,
    get width() { return W; },
    get height() { return H; },
    get unit() { return view.unit; },
  };
})();
