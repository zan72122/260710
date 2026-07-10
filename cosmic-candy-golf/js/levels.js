/* ============================================================
   levels.js — コース定義
   座標系: y が上。メインフロアの上面 = y 0 が基準。
   コースは -Z(手前・スタート)から +Z(奥)へ伸びる。
   ============================================================ */
"use strict";

const P = U.palette;

/* 外周の壁(レール)をぐるっと作るヘルパー */
function wallRing(x, z, w, d, topY, color, gap) {
  // gap: {side:'N'|'S'|'E'|'W', from, to} 省略可
  const t = 0.7, h = 1.1;
  const y = topY + h / 2 - 0.1;
  const walls = [];
  const seg = (wx, wz, ww, wd) => walls.push({ x: wx, y, z: wz, w: ww, h, d: wd, color });
  // 北(+Z) / 南(-Z)
  const north = { x, z: z + d / 2 + t / 2, w: w + t * 2, d: t };
  const south = { x, z: z - d / 2 - t / 2, w: w + t * 2, d: t };
  const east = { x: x + w / 2 + t / 2, z, w: t, d };
  const west = { x: x - w / 2 - t / 2, z, w: t, d };
  for (const [side, def] of [["N", north], ["S", south], ["E", east], ["W", west]]) {
    if (gap && gap.side === side) {
      if (side === "N" || side === "S") {
        const g0 = gap.from, g1 = gap.to;
        const leftW = (g0 - (x - w / 2 - t));
        const rightW = ((x + w / 2 + t) - g1);
        if (leftW > 0.2) seg(x - w / 2 - t + leftW / 2, def.z, leftW, t);
        if (rightW > 0.2) seg(x + w / 2 + t - rightW / 2, def.z, rightW, t);
      } else {
        const g0 = gap.from, g1 = gap.to;
        const nearD = (g0 - (z - d / 2));
        const farD = ((z + d / 2) - g1);
        if (nearD > 0.2) seg(def.x, z - d / 2 + nearD / 2, t, nearD);
        if (farD > 0.2) seg(def.x, z + d / 2 - farD / 2, t, farD);
      }
    } else {
      seg(def.x, def.z, def.w, def.d);
    }
  }
  return walls;
}

/* ============================================================
   ステージ 1〜5
   ============================================================ */
const LEVELS = [

  /* ---------- 1: はじめてのつみき ---------- */
  () => {
    const w = 15, d = 30;
    return {
      id: 1, icon: "🧸", sky: "morning", bgm: "toy", par: 3,
      platforms: [{ x: 0, y: -0.75, z: 0, w, h: 1.5, d, color: P.green, check: true }],
      walls: wallRing(0, 0, w, d, 0, P.wood),
      breaks: [],
      bumpers: [{ x: 0, z: 2 }],
      movers: [],
      targets: [
        { x: -4, z: -3, kind: "normal" },
        { x: 4, z: -3, kind: "normal" },
        { x: -4.5, z: 5, kind: "normal" },
        { x: 4.5, z: 5, kind: "rocket" },
        { x: -3, z: 10, kind: "normal" },
        { x: 3, z: 10, kind: "normal" },
        { x: 0, z: 13, kind: "normal" },
      ],
      ballStart: { x: 0, z: -12 },
      decorSeed: 11,
    };
  },

  /* ---------- 2: レールのおか(2階だて) ---------- */
  () => {
    const lv = {
      id: 2, icon: "🚂", sky: "candy", bgm: "toy", par: 4,
      platforms: [
        // 1階
        { x: 0, y: -0.75, z: -8, w: 14, h: 1.5, d: 18, color: P.mint, check: true },
        // スロープ (奥へ上る)  上面 0 → 2
        { x: 4, y: 0.25, z: 3.1, w: 5, h: 1.5, d: 6.6, color: P.wood, rx: -0.31, ramp: true },
        // 2階
        { x: 0, y: 1.25, z: 11, w: 14, h: 1.5, d: 10, color: P.yellow, check: true, topY: 2 },
      ],
      walls: [
        ...wallRing(0, -8, 14, 18, 0, P.wood, { side: "N", from: 1.5, to: 6.5 }),
        ...wallRing(0, 11, 14, 10, 2, P.woodDark, { side: "S", from: 1.5, to: 6.5 }),
        // スロープの레일
        { x: 1.6, y: 1.05, z: 3.1, w: 0.6, h: 1.2, d: 6.6, color: P.woodDark, rx: -0.31 },
        { x: 6.4, y: 1.05, z: 3.1, w: 0.6, h: 1.2, d: 6.6, color: P.woodDark, rx: -0.31 },
      ],
      breaks: [],
      bumpers: [{ x: -3, z: -6 }],
      movers: [],
      targets: [
        { x: -4, z: -10, kind: "normal" },
        { x: 4, z: -12, kind: "normal" },
        { x: -4, z: -3, kind: "bounce" },
        { x: 0, z: -1, kind: "normal" },
        { x: 4, z: 12, topY: 2, kind: "magnet" },
        { x: -4, z: 9, topY: 2, kind: "normal" },
        { x: -1, z: 13, topY: 2, kind: "normal" },
      ],
      ballStart: { x: 0, z: -14 },
      decorSeed: 22,
    };
    return lv;
  },

  /* ---------- 3: こわせるブロックのまち ---------- */
  () => {
    const w = 16, d = 38;
    const bricks = [];
    // 3枚のこわせる壁(すきま付き)
    const wallZ = [-4, 4, 12];
    const cols = [P.red, P.orange, P.purple];
    wallZ.forEach((z, wi) => {
      for (let i = 0; i < 5; i++) {
        const bx = -6 + i * 3;
        if (wi === 1 && i === 2) continue; // 真ん中に穴
        bricks.push({ x: bx, y: 0.8, z, w: 2.5, h: 1.6, d: 1.2, color: cols[wi] });
        bricks.push({ x: bx, y: 2.2, z, w: 2.5, h: 1.2, d: 1.2, color: P.cream });
      }
    });
    return {
      id: 3, icon: "🔨", sky: "sky", bgm: "sky", par: 5,
      platforms: [{ x: 0, y: -0.75, z: 0, w, h: 1.5, d, color: P.pink, check: true }],
      walls: wallRing(0, 0, w, d, 0, P.wood),
      breaks: bricks,
      bumpers: [{ x: -5, z: 8 }, { x: 5, z: 0 }],
      movers: [],
      targets: [
        { x: 0, z: -9, kind: "drill" },
        { x: -5, z: -1, kind: "normal" },
        { x: 5, z: -1, kind: "normal" },
        { x: -5, z: 7, kind: "jumbo" },
        { x: 5, z: 8, kind: "normal" },
        { x: 0, z: 8, kind: "slow" },
        { x: -4, z: 15, kind: "normal" },
        { x: 4, z: 15, kind: "normal" },
        { x: 0, z: 17, kind: "normal" },
      ],
      ballStart: { x: 0, z: -16 },
      decorSeed: 33,
    };
  },

  /* ---------- 4: うごくしまとバンパー ---------- */
  () => {
    return {
      id: 4, icon: "🎠", sky: "sunset", bgm: "sky", par: 5,
      platforms: [
        { x: 0, y: -0.75, z: -12, w: 13, h: 1.5, d: 12, color: P.blue, check: true },
        // 動く橋 2枚
        { x: 0, y: -0.6, z: -3, w: 4.6, h: 1.2, d: 4.6, color: P.yellow, move: { axis: "x", range: 3.6, speed: 0.9, phase: 0 } },
        { x: 0, y: -0.6, z: 3, w: 4.6, h: 1.2, d: 4.6, color: P.orange, move: { axis: "x", range: 3.6, speed: 0.9, phase: Math.PI } },
        { x: 0, y: -0.75, z: 12, w: 15, h: 1.5, d: 13, color: P.mint, check: true },
      ],
      walls: [
        ...wallRing(0, -12, 13, 12, 0, P.wood, { side: "N", from: -3, to: 3 }),
        ...wallRing(0, 12, 15, 13, 0, P.wood, { side: "S", from: -3, to: 3 }),
      ],
      breaks: [],
      bumpers: [{ x: -4, z: 10 }, { x: 4, z: 10 }, { x: 0, z: 14 }],
      movers: [],
      targets: [
        { x: -3.5, z: -14, kind: "normal" },
        { x: 3.5, z: -14, kind: "tornado" },
        { x: 0, z: -9, kind: "rocket" },
        { x: 0, z: -3, kind: "normal", floatY: 1.2 },
        { x: 0, z: 3, kind: "normal", floatY: 1.2 },
        { x: -5, z: 9, kind: "bounce" },
        { x: 5, z: 9, kind: "normal" },
        { x: -4, z: 15, kind: "normal" },
        { x: 4, z: 15, kind: "normal" },
      ],
      ballStart: { x: 0, z: -16 },
      decorSeed: 44,
    };
  },

  /* ---------- 5: ブロックキングのしろ(ボス) ---------- */
  () => {
    return {
      id: 5, icon: "🤖", sky: "space", bgm: "boss", par: 8, boss: true,
      platforms: [{ x: 0, y: -0.75, z: 0, w: 20, h: 1.5, d: 34, color: P.purple, check: true }],
      walls: wallRing(0, 0, 20, 34, 0, P.woodDark),
      breaks: [],
      bumpers: [{ x: -6, z: -2 }, { x: 6, z: -2 }],
      movers: [],
      targets: [
        // ボス戦では respawn する能力ターゲット
        { x: -6, z: -8, kind: "rocket", respawn: true },
        { x: 6, z: -8, kind: "jumbo", respawn: true },
        { x: 0, z: -4, kind: "bounce", respawn: true },
      ],
      ballStart: { x: 0, z: -13 },
      decorSeed: 55,
    };
  },
];

/* ============================================================
   エンドレスモード: 島ジェネレーター
   ============================================================ */
const ENDLESS_SKIES = ["morning", "candy", "sky", "sunset", "space"];
const ABILITY_KINDS = ["drill", "rocket", "tornado", "jumbo", "slow", "magnet", "bounce", "rainbow"];

function generateIsland(index) {
  const rng = makeRng(987654 + index * 7919);
  const diff = Math.min(index, 10); // 難易度 0..10
  const w = 13 + Math.floor(rng() * 5);
  const d = 22 + Math.floor(rng() * 8) + diff;
  const colors = [P.green, P.mint, P.pink, P.yellow, P.blue, P.orange];
  const floor = colors[Math.floor(rng() * colors.length)];

  const lv = {
    id: 100 + index, icon: "♾️", sky: ENDLESS_SKIES[index % ENDLESS_SKIES.length],
    bgm: "endless", par: 4, endless: true, islandIndex: index,
    platforms: [{ x: 0, y: -0.75, z: 0, w, h: 1.5, d, color: floor, check: true }],
    walls: wallRing(0, 0, w, d, 0, P.wood),
    breaks: [], bumpers: [], movers: [], targets: [],
    ballStart: { x: 0, z: -d / 2 + 2.5 },
    decorSeed: 100 + index,
  };

  // こわせるブロックの壁 (難易度で増える)
  const nWalls = Math.min(2, Math.floor(diff / 3));
  for (let i = 0; i < nWalls; i++) {
    const z = -d / 6 + i * (d / 4) + rng() * 2;
    const hole = Math.floor(rng() * 4);
    for (let c = 0; c < 4; c++) {
      if (c === hole) continue;
      const bx = -w / 2 + (c + 0.5) * (w / 4);
      lv.breaks.push({ x: bx, y: 0.8, z, w: w / 4 - 0.4, h: 1.6, d: 1.1, color: U.pick([P.red, P.orange, P.purple, P.blue]) });
    }
  }

  // バンパー
  const nBump = 1 + Math.floor(rng() * 2) + Math.floor(diff / 4);
  for (let i = 0; i < nBump; i++) {
    lv.bumpers.push({ x: (rng() - 0.5) * (w - 5), z: (rng() - 0.3) * (d / 2 - 4) });
  }

  // ターゲット配置(かぶらないように格子から選ぶ)
  const spots = [];
  for (let gx = -1; gx <= 1; gx++)
    for (let gz = 0; gz < 5; gz++)
      spots.push({ x: gx * (w / 3.2) + (rng() - 0.5) * 1.4, z: -d / 2 + 5 + gz * ((d - 8) / 4) + (rng() - 0.5) * 1.5 });
  // シャッフル
  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }
  const nTargets = 4 + Math.floor(rng() * 3) + Math.floor(diff / 3); // 4..9
  const nSuper = 1 + (rng() < 0.5 ? 1 : 0);
  for (let i = 0; i < Math.min(nTargets, spots.length); i++) {
    const kind = i < nSuper ? ABILITY_KINDS[Math.floor(rng() * ABILITY_KINDS.length)] : "normal";
    lv.targets.push({ x: spots[i].x, z: spots[i].z, kind });
  }
  return lv;
}
