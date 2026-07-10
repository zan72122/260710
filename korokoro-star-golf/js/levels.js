/* ================================================================
   levels.js — コースデータ
   ----------------------------------------------------------------
   記号の意味:
     (空白) コースの外（そら）      #  しげみのかべ
     .  しばふ                     s  すなば（おそくなる）
     w  みず（おっこちる）          i  こおり（つるつる）
     b  バンパーきのこ（ぽよん！）
     ^ v < >  ブーストやじるし（びゅーん！）
     P  スタートいち               G  ゴールのばしょ（てきを全部ポンすると出る）
     E  てき（ちびまるちゃん）      F  フルーツ
   ================================================================ */
"use strict";

const WORLDS = [
  { name: "くさはらワールド", emoji: "🌼" },
  { name: "うみべワールド",   emoji: "🐚" },
  { name: "おそらワールド",   emoji: "🌈" },
];

const LEVELS = [
  /* ============ ワールド1: くさはら ============ */
  {
    name: "はじめのいっぽ", world: 0, par: 1,
    grid: [
      "  ........  ",
      " .......... ",
      "............",
      "..P...E..G..",
      "............",
      " .......... ",
      "  ........  ",
    ],
  },
  {
    name: "まがりみち", world: 0, par: 2,
    grid: [
      "........    ",
      ".P......    ",
      "....F...    ",
      "........    ",
      "............",
      "....F.......",
      ".........EG.",
      "............",
    ],
  },
  {
    name: "すなのにわ", world: 0, par: 2,
    grid: [
      "............",
      ".P..........",
      "......ss....",
      "...F.ssss...",
      "....ssssE...",
      "......ss....",
      "........E.G.",
      "............",
    ],
  },
  {
    name: "ぽよんのもり", world: 0, par: 2,
    grid: [
      "  ........  ",
      " ..b....b.. ",
      "............",
      ".P....b...E.",
      "......b...G.",
      "............",
      " ..b....b.. ",
      "  ...F....  ",
    ],
  },

  /* ============ ワールド2: うみべ ============ */
  {
    name: "うみをこえて", world: 1, par: 2,
    grid: [
      ".....ww......",
      ".....ww......",
      ".P...ww...E..",
      ".....ww......",
      "....F........",
      ".....ww...G..",
      ".....ww......",
      ".....ww......",
    ],
  },
  {
    name: "びゅーんロード", world: 1, par: 2,
    grid: [
      "..............",
      ".P..>>....E...",
      "..............",
      "......ssss....",
      "...>>.....F...",
      "..........G...",
      "..............",
    ],
  },
  {
    name: "かにさんビーチ", world: 1, par: 3,
    grid: [
      "   .......   ",
      " ....sss.... ",
      "..E..sGs..E..",
      ".....sss.....",
      ".P...........",
      "....F...F....",
      "......E......",
      " ........... ",
      "   .......   ",
    ],
  },
  {
    name: "ドーナツじま", world: 1, par: 3,
    grid: [
      "  .........  ",
      " .....E..... ",
      " ..wwwwwww.. ",
      "...wwwwwww...",
      ".E.wwwwwww.F.",
      "...wwwwwww...",
      " ..wwwwwww.. ",
      " .P...G..... ",
      "  .........  ",
    ],
  },

  /* ============ ワールド3: おそら ============ */
  {
    name: "つるつるこおり", world: 2, par: 2,
    grid: [
      ".............",
      ".P.iiiiiii.E.",
      "...iiiiiii...",
      "...iiiiiii...",
      "...iiiFiii...",
      "...iiiiiii.G.",
      ".............",
      ".............",
    ],
  },
  {
    name: "ぽよんぽよんそら", world: 2, par: 3,
    grid: [
      "   .......   ",
      " ..b..b..b.. ",
      "....E...E....",
      " ..b..b..b.. ",
      "......F......",
      " ..b..b..b.. ",
      "....E...G....",
      " ........... ",
      "     .P.     ",
    ],
  },
  {
    name: "そらのかわ", world: 2, par: 3,
    grid: [
      "..............",
      ".P...w....E...",
      "..>>.w........",
      ".....w..iiii..",
      "..............",
      ".....w....F...",
      "..>>.w......G.",
      "..............",
    ],
  },
  {
    name: "スターパレス", world: 2, par: 4,
    grid: [
      "     ....     ",
      "   ....G...   ",
      "  ..b....b..  ",
      " .E........E. ",
      " ...swwwws... ",
      " ...swwwws... ",
      " .F........F. ",
      "  ..b....b..  ",
      "  .E......E.  ",
      "   ...P....   ",
      "     ....     ",
    ],
  },
];

/* グリッド文字列 → 遊べるレベルデータへ変換 */
function parseLevel(index) {
  const def = LEVELS[index];
  const rows = def.grid;
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const tiles = [];
  const enemies = [];
  const fruits = [];
  const bumpers = [];
  let start = { x: 1.5, y: 1.5 };
  let goal = { x: w - 1.5, y: h - 1.5 };

  const ENEMY_HUES = [28, 200, 268, 150, 340, 52];

  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      let c = rows[y][x] || " ";
      const cx = x + 0.5, cy = y + 0.5;
      if (c === "P") { start = { x: cx, y: cy }; c = "."; }
      else if (c === "G") { goal = { x: cx, y: cy }; c = "."; }
      else if (c === "E") {
        enemies.push({
          x: cx, y: cy, baseX: cx, baseY: cy,
          hue: ENEMY_HUES[enemies.length % ENEMY_HUES.length],
          phase: Math.random() * TAU,
          alive: true, wobble: 0,
        });
        c = ".";
      }
      else if (c === "F") { fruits.push({ x: cx, y: cy, taken: false, kind: fruits.length % 4 }); c = "."; }
      else if (c === "b") {
        bumpers.push({ x: cx, y: cy, squish: 0 });
        c = ".";
      }
      row.push(c);
    }
    tiles.push(row);
  }

  return {
    index, name: def.name, world: def.world, par: def.par,
    w, h, tiles, start, goal, enemies, fruits, bumpers,
  };
}

/* タイル判定ヘルパー */
function tileAt(level, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= level.w || ty >= level.h) return " ";
  return level.tiles[ty][tx];
}
function isSolidTile(c) { return c === " " || c === "#"; }
