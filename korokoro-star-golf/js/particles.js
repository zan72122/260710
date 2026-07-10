/* ================================================================
   particles.js — パーティクル（きらきら・ほし・かみふぶき・もじ）
   座標はワールド座標（タイル単位）。描画時に変換される。
   ================================================================ */
"use strict";

const Particles = (() => {
  let list = [];

  function spawn(p) {
    list.push(Object.assign({
      x: 0, y: 0, vx: 0, vy: 0,
      life: 0, maxLife: 0.6,
      size: 0.12, color: "#fff",
      type: "circle",           /* circle | star | heart | confetti | ring | text | drop */
      rot: Math.random() * TAU, vr: randRange(-4, 4),
      grav: 0, drag: 0.5,
      text: "", fontScale: 1,
    }, p));
  }

  /* --- よく使うエフェクトのプリセット --- */

  function burst(x, y, color, n, speed, size) {
    for (let i = 0; i < (n || 8); i++) {
      const a = Math.random() * TAU;
      const s = randRange(0.3, 1) * (speed || 4);
      spawn({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        maxLife: randRange(0.3, 0.7), size: randRange(0.5, 1.2) * (size || 0.1),
        color, drag: 3,
      });
    }
  }

  function starBurst(x, y, n) {
    for (let i = 0; i < (n || 7); i++) {
      const a = Math.random() * TAU;
      const s = randRange(2.5, 7);
      spawn({
        type: "star", x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2,
        maxLife: randRange(0.6, 1.1), size: randRange(0.14, 0.3),
        color: pick(["#ffd93d", "#ffe98a", "#ffab4c", "#fff"]),
        grav: 7, drag: 1.2,
      });
    }
  }

  function popRing(x, y, color) {
    spawn({ type: "ring", x, y, maxLife: 0.35, size: 0.15, color });
  }

  function hearts(x, y, n) {
    for (let i = 0; i < (n || 3); i++) {
      spawn({
        type: "heart", x: x + randRange(-0.2, 0.2), y,
        vx: randRange(-0.6, 0.6), vy: randRange(-2.4, -1.2),
        maxLife: randRange(0.7, 1.1), size: randRange(0.14, 0.24),
        color: pick(["#ff8ec6", "#ff5fa8", "#ffb3d9"]), drag: 0.6,
      });
    }
  }

  function splash(x, y) {
    for (let i = 0; i < 14; i++) {
      const a = randRange(-Math.PI * 0.85, -Math.PI * 0.15);
      const s = randRange(2, 7);
      spawn({
        type: "drop", x, y,
        vx: Math.cos(a) * s * 0.7, vy: Math.sin(a) * s,
        maxLife: randRange(0.4, 0.8), size: randRange(0.06, 0.14),
        color: pick(["#8fd3ff", "#5db8ff", "#cdeeff"]),
        grav: 16, drag: 0.4,
      });
    }
    popRing(x, y, "rgba(180,225,255,.9)");
  }

  function dust(x, y, dirX, dirY) {
    for (let i = 0; i < 4; i++) {
      spawn({
        x, y,
        vx: dirX * randRange(0.5, 2) + randRange(-0.8, 0.8),
        vy: dirY * randRange(0.5, 2) + randRange(-0.8, 0.8),
        maxLife: randRange(0.25, 0.5), size: randRange(0.05, 0.12),
        color: "rgba(255,255,255,.85)", drag: 3,
      });
    }
  }

  function trail(x, y, hue) {
    spawn({
      x: x + randRange(-0.1, 0.1), y: y + randRange(-0.1, 0.1),
      vx: randRange(-0.3, 0.3), vy: randRange(-0.3, 0.3),
      maxLife: randRange(0.3, 0.55), size: randRange(0.06, 0.14),
      color: hsl(hue, 90, 70), drag: 2,
    });
  }

  function confettiBurst(x, y, n) {
    for (let i = 0; i < (n || 24); i++) {
      const a = randRange(-Math.PI * 0.9, -Math.PI * 0.1);
      const s = randRange(3, 10);
      spawn({
        type: "confetti", x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        maxLife: randRange(1.2, 2.2), size: randRange(0.1, 0.2),
        color: hsl(randRange(0, 360), 85, 62),
        grav: 6, drag: 1.4, vr: randRange(-10, 10),
      });
    }
  }

  function firework(x, y) {
    const hue = randRange(0, 360);
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * TAU + randRange(-0.1, 0.1);
      const s = randRange(3.4, 5.2);
      spawn({
        type: Math.random() < 0.4 ? "star" : "circle",
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        maxLife: randRange(0.8, 1.4), size: randRange(0.08, 0.2),
        color: hsl(hue + randRange(-24, 24), 90, randRange(58, 75)),
        grav: 3.5, drag: 1.5,
      });
    }
  }

  function floatText(x, y, text, color, scale, life) {
    spawn({
      type: "text", x, y, vy: -1.6,
      maxLife: life || 1.0, text, color: color || "#fff",
      fontScale: scale || 1, drag: 1.5,
    });
  }

  function update(dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life += dt;
      if (p.life >= p.maxLife) { list.splice(i, 1); continue; }
      p.vy += p.grav * dt;
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d; p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
  }

  /* toScreen(x,y) → {x,y}, unit = 1タイルのピクセル数 */
  function draw(ctx, toScreen, unit) {
    for (const p of list) {
      const t = p.life / p.maxLife;
      const alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      const s = toScreen(p.x, p.y);
      const size = p.size * unit;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(s.x, s.y);

      switch (p.type) {
        case "star":
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          traceStar(ctx, 0, 0, size, size * 0.5, 5, 0);
          ctx.fill();
          break;
        case "heart":
          ctx.fillStyle = p.color;
          traceHeart(ctx, 0, 0, size);
          ctx.fill();
          break;
        case "confetti": {
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          const wobble = 0.35 + 0.65 * Math.abs(Math.sin(p.life * 9 + p.rot));
          ctx.fillRect(-size, -size * 0.6 * wobble, size * 2, size * 1.2 * wobble);
          break;
        }
        case "ring": {
          const r = size + t * unit * 0.9;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(1.5, unit * 0.06 * (1 - t));
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, TAU);
          ctx.stroke();
          break;
        }
        case "text": {
          const pop = t < 0.25 ? easeOutBack(t / 0.25) : 1;
          ctx.scale(pop, pop);
          ctx.font = `900 ${Math.round(unit * 0.62 * p.fontScale)}px "Hiragino Maru Gothic ProN", sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.lineWidth = unit * 0.14 * p.fontScale;
          ctx.strokeStyle = "rgba(49,52,75,.55)";
          ctx.lineJoin = "round";
          ctx.strokeText(p.text, 0, 0);
          ctx.fillStyle = p.color;
          ctx.fillText(p.text, 0, 0);
          break;
        }
        case "drop":
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.ellipse(0, 0, size * 0.7, size, Math.atan2(p.vy, p.vx) + Math.PI / 2, 0, TAU);
          ctx.fill();
          break;
        default:
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(0, 0, size * (1 - t * 0.5), 0, TAU);
          ctx.fill();
      }
      ctx.restore();
    }
  }

  function clear() { list = []; }

  return {
    burst, starBurst, popRing, hearts, splash, dust, trail,
    confettiBurst, firework, floatText,
    update, draw, clear,
    get count() { return list.length; },
  };
})();
