/* ============================================================
   util.js — 小さなヘルパー集
   ============================================================ */
"use strict";

const U = {
  clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
  lerp(a, b, t) { return a + (b - a) * t; },
  rand(a, b) { return a + Math.random() * (b - a); },
  randInt(a, b) { return Math.floor(U.rand(a, b + 1)); },
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  dist2d(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.hypot(dx, dz); },

  // 端末が縦画面か
  isPortrait() { return window.innerHeight >= window.innerWidth; },

  // hex "#rrggbb" → BABYLON.Color3
  c3(hex) {
    return BABYLON.Color3.FromHexString(hex);
  },

  // やさしいパステルパレット(おもちゃの国)
  palette: {
    red: "#ff7b7b", orange: "#ffb457", yellow: "#ffe066",
    green: "#8ee08a", mint: "#7fe3c3", blue: "#7db8ff",
    purple: "#b79bff", pink: "#ff9ecf", cream: "#fff3d9",
    wood: "#e8b06f", woodDark: "#c98d4e", white: "#ffffff",
  },

  // localStorage 安全ラッパー(プライベートブラウズ対策)
  store: {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v === null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
    },
  },
};

// シード付き乱数(エンドレスの島生成を再現可能に)
function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
