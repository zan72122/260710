/* ============================================================
   Renderer — ぜんぶ手描きのCanvasレンダラー
   ダンジョンの石壁 × ミニゴルフの芝生 × あたたかい松明の光
   ============================================================ */
const Renderer = {
  cv: null, ctx: null,
  dpr: 1, W: 0, H: 0,           // CSSピクセル
  view: { scale: 60, ox: 0, oy: 0 },
  floorCache: null,
  TP: 64,                        // ベイク解像度(px/セル)
  torches: [],
  waterSegs: [],                 // {y,x0,x1} 波ハイライト用
  shoreEdges: [],                // {x,y,side} 泡用
  motes: [],
  trauma: 0,
  flash: 0,

  init(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    for (let i = 0; i < 46; i++) {
      this.motes.push({
        x: Math.random(), y: Math.random(),
        s: 1 + Math.random() * 2.4,
        sp: 0.008 + Math.random() * 0.02,
        ph: Math.random() * Math.PI * 2,
        drift: (Math.random() - 0.5) * 0.01,
      });
    }
    this.resize();
  },

  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.cv.width = Math.round(this.W * this.dpr);
    this.cv.height = Math.round(this.H * this.dpr);
    if (Main && Main.level) this.fitView(Main.level);
  },

  fitView(level) {
    const marginX = Math.max(16, this.W * 0.03);
    const marginTop = Math.max(70, this.H * 0.10);
    const marginBot = Math.max(20, this.H * 0.04);
    const availW = this.W - marginX * 2;
    const availH = this.H - marginTop - marginBot;
    const scale = Math.min(availW / level.w, availH / level.h);
    this.view.scale = scale;
    this.view.ox = (this.W - level.w * scale) / 2;
    this.view.oy = marginTop + (availH - level.h * scale) / 2;
  },

  screenToWorld(px, py) {
    return {
      x: (px - this.view.ox) / this.view.scale,
      y: (py - this.view.oy) / this.view.scale,
    };
  },

  shake(amount) { this.trauma = Math.min(1, this.trauma + amount); },
  flashScreen() { this.flash = 0.55; },

  /* ============================================================
     レベルのベイク(床・壁は1回だけ描く)
     ============================================================ */
  setLevel(level) {
    this.fitView(level);
    this.torches = [];
    this.waterSegs = [];
    this.shoreEdges = [];

    const P = this.TP;
    const cache = document.createElement('canvas');
    cache.width = level.w * P;
    cache.height = level.h * P;
    const c = cache.getContext('2d');

    const solid = (x, y) => level.isSolid(x, y);
    const open = (x, y) => !solid(x, y);

    // --- 1. 床タイル ---
    for (let y = 0; y < level.h; y++) {
      for (let x = 0; x < level.w; x++) {
        const t = level.tiles[y][x];
        if (t === TILE.VOID || t === TILE.WALL) continue;
        if (t === TILE.WATER) this.bakeWater(c, x, y, P);
        else if (t === TILE.SAND) this.bakeSand(c, x, y, P);
        else this.bakeGrass(c, x, y, P);
      }
    }

    // --- 2. 環境遮蔽(壁ぎわの影) ---
    for (let y = 0; y < level.h; y++) {
      for (let x = 0; x < level.w; x++) {
        if (!open(x, y)) continue;
        const px = x * P, py = y * P;
        const sh = 'rgba(25,15,50,0.32)';
        const D = P * 0.38;
        if (solid(x, y - 1)) {
          const g = c.createLinearGradient(0, py, 0, py + D);
          g.addColorStop(0, sh); g.addColorStop(1, 'rgba(25,15,50,0)');
          c.fillStyle = g; c.fillRect(px, py, P, D);
        }
        if (solid(x, y + 1)) {
          const g = c.createLinearGradient(0, py + P, 0, py + P - D * 0.6);
          g.addColorStop(0, 'rgba(25,15,50,0.2)'); g.addColorStop(1, 'rgba(25,15,50,0)');
          c.fillStyle = g; c.fillRect(px, py + P - D * 0.6, P, D * 0.6);
        }
        if (solid(x - 1, y)) {
          const g = c.createLinearGradient(px, 0, px + D * 0.7, 0);
          g.addColorStop(0, 'rgba(25,15,50,0.24)'); g.addColorStop(1, 'rgba(25,15,50,0)');
          c.fillStyle = g; c.fillRect(px, py, D * 0.7, P);
        }
        if (solid(x + 1, y)) {
          const g = c.createLinearGradient(px + P, 0, px + P - D * 0.7, 0);
          g.addColorStop(0, 'rgba(25,15,50,0.24)'); g.addColorStop(1, 'rgba(25,15,50,0)');
          c.fillStyle = g; c.fillRect(px + P - D * 0.7, py, D * 0.7, P);
        }
      }
    }

    // --- 3. 壁 ---
    for (let y = 0; y < level.h; y++) {
      for (let x = 0; x < level.w; x++) {
        if (level.tiles[y][x] !== TILE.WALL) continue;
        this.bakeWall(c, level, x, y, P);
      }
    }

    // --- 4. 水の波セグメントと海岸 ---
    for (let y = 0; y < level.h; y++) {
      let segStart = -1;
      for (let x = 0; x <= level.w; x++) {
        const isW = x < level.w && level.tiles[y][x] === TILE.WATER;
        if (isW && segStart < 0) segStart = x;
        if (!isW && segStart >= 0) {
          this.waterSegs.push({ y, x0: segStart, x1: x });
          segStart = -1;
        }
      }
    }
    for (let y = 0; y < level.h; y++) {
      for (let x = 0; x < level.w; x++) {
        if (level.tiles[y][x] !== TILE.WATER) continue;
        const nb = [[0, -1, 'n'], [0, 1, 's'], [-1, 0, 'w'], [1, 0, 'e']];
        for (const [dx, dy, side] of nb) {
          const t = level.tileAt(x + dx + 0.5, y + dy + 0.5);
          if (t !== TILE.WATER && t !== TILE.VOID) this.shoreEdges.push({ x, y, side });
        }
      }
    }

    // --- 5. 水ぎわの深み(暗いふち)をベイク ---
    for (const e of this.shoreEdges) {
      const px = e.x * P, py = e.y * P;
      const D = P * 0.30;
      let g;
      if (e.side === 'n') g = c.createLinearGradient(0, py, 0, py + D);
      if (e.side === 's') g = c.createLinearGradient(0, py + P, 0, py + P - D);
      if (e.side === 'w') g = c.createLinearGradient(px, 0, px + D, 0);
      if (e.side === 'e') g = c.createLinearGradient(px + P, 0, px + P - D, 0);
      g.addColorStop(0, 'rgba(15,35,95,0.45)');
      g.addColorStop(1, 'rgba(15,35,95,0)');
      c.fillStyle = g;
      if (e.side === 'n') c.fillRect(px, py, P, D);
      if (e.side === 's') c.fillRect(px, py + P - D, P, D);
      if (e.side === 'w') c.fillRect(px, py, D, P);
      if (e.side === 'e') c.fillRect(px + P - D, py, D, P);
    }

    this.floorCache = cache;
  },

  bakeGrass(c, x, y, P) {
    const px = x * P, py = y * P;
    const check = (x + y) % 2 === 0;
    c.fillStyle = check ? '#7cc35e' : '#72b954';
    c.fillRect(px, py, P, P);
    // 芝の質感
    const n = 5;
    for (let i = 0; i < n; i++) {
      const r1 = tRand(x, y, i * 3);
      const r2 = tRand(x, y, i * 3 + 1);
      const r3 = tRand(x, y, i * 3 + 2);
      const gx = px + r1 * P, gy = py + r2 * P;
      if (r3 < 0.5) {
        // 草のふさ
        c.strokeStyle = check ? '#6bb04d' : '#63a846';
        c.lineWidth = P * 0.03;
        c.lineCap = 'round';
        for (let b = 0; b < 3; b++) {
          c.beginPath();
          c.moveTo(gx + (b - 1) * P * 0.045, gy);
          c.lineTo(gx + (b - 1) * P * 0.075, gy - P * (0.07 + r2 * 0.05));
          c.stroke();
        }
      }
    }
    // ときどきお花
    const fr = tRand(x, y, 77);
    if (fr < 0.09) {
      const fx = px + (0.25 + tRand(x, y, 78) * 0.5) * P;
      const fy = py + (0.25 + tRand(x, y, 79) * 0.5) * P;
      const col = fr < 0.045 ? '#ffffff' : '#ffd9ec';
      c.fillStyle = col;
      for (let pt = 0; pt < 5; pt++) {
        const a = (pt / 5) * Math.PI * 2;
        c.beginPath();
        c.arc(fx + Math.cos(a) * P * 0.045, fy + Math.sin(a) * P * 0.045, P * 0.033, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = '#ffd23e';
      c.beginPath(); c.arc(fx, fy, P * 0.032, 0, Math.PI * 2); c.fill();
    }
  },

  bakeSand(c, x, y, P) {
    const px = x * P, py = y * P;
    c.fillStyle = (x + y) % 2 === 0 ? '#eed6a0' : '#e8ce96';
    c.fillRect(px, py, P, P);
    for (let i = 0; i < 7; i++) {
      const r1 = tRand(x, y, i * 2 + 10), r2 = tRand(x, y, i * 2 + 11);
      c.fillStyle = i % 2 ? '#dcbe82' : '#f6e4b8';
      c.beginPath();
      c.arc(px + r1 * P, py + r2 * P, P * (0.015 + r1 * 0.02), 0, Math.PI * 2);
      c.fill();
    }
    // 熊手のあと
    if (tRand(x, y, 55) < 0.5) {
      c.strokeStyle = 'rgba(190,155,95,0.5)';
      c.lineWidth = P * 0.025;
      c.beginPath();
      const yy = py + (0.3 + tRand(x, y, 56) * 0.4) * P;
      c.moveTo(px + P * 0.1, yy);
      c.quadraticCurveTo(px + P * 0.5, yy + P * 0.1 * (tRand(x, y, 57) - 0.5), px + P * 0.9, yy);
      c.stroke();
    }
  },

  bakeWater(c, x, y, P) {
    const px = x * P, py = y * P;
    const g = c.createLinearGradient(px, py, px, py + P);
    g.addColorStop(0, '#3d7ad2');
    g.addColorStop(1, '#3a70c4');
    c.fillStyle = g;
    c.fillRect(px, py, P, P);
    for (let i = 0; i < 4; i++) {
      const r1 = tRand(x, y, i + 30), r2 = tRand(x, y, i + 34);
      c.fillStyle = 'rgba(255,255,255,0.06)';
      c.beginPath();
      c.arc(px + r1 * P, py + r2 * P, P * 0.07, 0, Math.PI * 2);
      c.fill();
    }
  },

  bakeWall(c, level, x, y, P) {
    const px = x * P, py = y * P;
    const southOpen = !level.isSolid(x, y + 1);
    const topH = southOpen ? P * 0.62 : P;

    // まわりの床にかぶさる影(下方向)
    if (southOpen) {
      c.fillStyle = 'rgba(20,12,40,0.28)';
      c.fillRect(px, py + P, P, P * 0.10);
    }

    // 上面
    const j = (tRand(x, y, 1) - 0.5) * 14;
    c.fillStyle = `rgb(${125 + j | 0},${107 + j | 0},${150 + j | 0})`;
    c.fillRect(px, py, P, topH);
    // 上面の石ディテール
    c.strokeStyle = 'rgba(70,55,100,0.45)';
    c.lineWidth = P * 0.035;
    c.lineCap = 'round';
    const detail = tRand(x, y, 2);
    if (detail < 0.55) {
      const lx = px + P * (0.2 + tRand(x, y, 3) * 0.4);
      const ly = py + topH * (0.25 + tRand(x, y, 4) * 0.5);
      c.beginPath();
      c.moveTo(lx, ly);
      c.lineTo(lx + P * 0.2, ly + P * 0.08 * (tRand(x, y, 5) - 0.5));
      c.stroke();
    }
    // 目地(れんが風)
    c.strokeStyle = 'rgba(60,45,90,0.30)';
    c.lineWidth = P * 0.03;
    if (!level.isSolid(x + 1, y) === false) { // 右も壁なら縦目地
      c.beginPath(); c.moveTo(px + P, py + topH * 0.15); c.lineTo(px + P, py + topH * 0.85); c.stroke();
    }

    // ふち
    if (!level.isSolid(x, y - 1)) {
      c.fillStyle = 'rgba(200,180,230,0.5)';
      c.fillRect(px, py, P, P * 0.06);
    }
    if (!level.isSolid(x - 1, y)) {
      c.fillStyle = 'rgba(200,180,230,0.28)';
      c.fillRect(px, py, P * 0.05, topH);
    }
    if (!level.isSolid(x + 1, y)) {
      c.fillStyle = 'rgba(40,28,70,0.45)';
      c.fillRect(px + P * 0.95, py, P * 0.05, topH);
    }

    // 前面(南が開いている時)
    if (southOpen) {
      const fg = c.createLinearGradient(0, py + topH, 0, py + P);
      fg.addColorStop(0, '#57487450');
      fg.addColorStop(0, '#574874');
      fg.addColorStop(1, '#3d3158');
      c.fillStyle = fg;
      c.fillRect(px, py + topH, P, P - topH);
      // れんがの目地
      c.strokeStyle = 'rgba(30,22,55,0.5)';
      c.lineWidth = P * 0.028;
      c.beginPath();
      c.moveTo(px, py + topH + (P - topH) * 0.5);
      c.lineTo(px + P, py + topH + (P - topH) * 0.5);
      c.stroke();
      const off = (x % 2) * P * 0.5;
      c.beginPath();
      c.moveTo(px + P * 0.25 + off * 0.5, py + topH);
      c.lineTo(px + P * 0.25 + off * 0.5, py + topH + (P - topH) * 0.5);
      c.moveTo(px + P * 0.7 + off * 0.3, py + topH + (P - topH) * 0.5);
      c.lineTo(px + P * 0.7 + off * 0.3, py + P);
      c.stroke();
      // 上面との境目ハイライト
      c.fillStyle = 'rgba(190,170,225,0.35)';
      c.fillRect(px, py + topH, P, P * 0.035);

      // 松明の設置
      if ((x * 7 + y * 13) % 5 === 0) {
        this.torches.push({ x: x + 0.5, y: y + 0.80, ph: tRand(x, y, 9) * 6.28 });
        // 受け皿
        c.fillStyle = '#2c2145';
        c.beginPath();
        c.moveTo(px + P * 0.38, py + P * 0.72);
        c.lineTo(px + P * 0.62, py + P * 0.72);
        c.lineTo(px + P * 0.5, py + P * 0.92);
        c.closePath();
        c.fill();
        c.fillStyle = '#8a7550';
        c.fillRect(px + P * 0.36, py + P * 0.70, P * 0.28, P * 0.05);
      }
    }
  },

  /* ============================================================
     フレーム描画
     ============================================================ */
  frame(t, dt, level, input) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.drawBackdrop(ctx, t, dt);

    if (level && this.floorCache) {
      // 画面ゆれ
      this.trauma = Math.max(0, this.trauma - dt * 2.2);
      const sh = this.trauma * this.trauma * 9;
      const shx = (Math.sin(t * 91) + Math.sin(t * 47)) * 0.5 * sh;
      const shy = (Math.cos(t * 83) + Math.sin(t * 59)) * 0.5 * sh;

      ctx.save();
      ctx.translate(this.view.ox + shx, this.view.oy + shy);
      ctx.scale(this.view.scale, this.view.scale);

      // 台座の影(レベル全体の下に落ちる影)
      ctx.fillStyle = 'rgba(10,5,25,0.45)';
      rr(ctx, -0.15, -0.1, level.w + 0.3, level.h + 0.45, 0.5);
      ctx.fill();

      // ベイク済みの床と壁
      ctx.drawImage(this.floorCache, 0, 0, level.w, level.h);

      this.drawWater(ctx, t, level);
      this.drawBoostPads(ctx, t, level);
      this.drawHole(ctx, t, level);
      this.drawPortals(ctx, t, level);
      this.drawStars(ctx, t, level);
      this.drawBumpers(ctx, t, level);
      this.drawBogeys(ctx, t, level);
      this.drawBall(ctx, t, level, input);
      if (input && input.aiming && level.canShoot()) this.drawAim(ctx, t, level, input);
      Particles.draw(ctx);
      this.drawTorches(ctx, t);

      ctx.restore();
    } else {
      Particles.draw(ctx); // タイトルでは使わないが念のため
    }

    this.drawVignette(ctx);

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,245,220,${this.flash * 0.6})`;
      ctx.fillRect(0, 0, this.W, this.H);
      this.flash = Math.max(0, this.flash - dt * 2.4);
    }
  },

  /* ---------------- 背景 ---------------- */
  drawBackdrop(ctx, t, dt) {
    const g = ctx.createLinearGradient(0, 0, 0, this.H);
    g.addColorStop(0, '#241543');
    g.addColorStop(0.55, '#1c1038');
    g.addColorStop(1, '#150b2b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);

    const rg = ctx.createRadialGradient(
      this.W * 0.5, this.H * 0.38, 0,
      this.W * 0.5, this.H * 0.38, Math.max(this.W, this.H) * 0.7);
    rg.addColorStop(0, 'rgba(120,85,190,0.16)');
    rg.addColorStop(1, 'rgba(120,85,190,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, this.W, this.H);

    // ただよう光の粒
    for (const m of this.motes) {
      m.y -= m.sp * dt;
      m.x += m.drift * dt;
      if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); }
      if (m.x < -0.02) m.x = 1.02;
      if (m.x > 1.02) m.x = -0.02;
      const a = 0.10 + 0.10 * Math.sin(t * 0.8 + m.ph);
      ctx.fillStyle = `rgba(255,225,160,${a})`;
      ctx.beginPath();
      ctx.arc(m.x * this.W, m.y * this.H, m.s, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  drawVignette(ctx) {
    const R = Math.max(this.W, this.H);
    const g = ctx.createRadialGradient(
      this.W / 2, this.H / 2, R * 0.35,
      this.W / 2, this.H / 2, R * 0.78);
    g.addColorStop(0, 'rgba(10,5,25,0)');
    g.addColorStop(1, 'rgba(10,5,25,0.5)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);
  },

  /* ---------------- 水 ---------------- */
  drawWater(ctx, t, level) {
    // 波のハイライト
    ctx.save();
    ctx.lineCap = 'round';
    for (const seg of this.waterSegs) {
      for (let band = 0; band < 2; band++) {
        ctx.strokeStyle = band === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(180,225,255,0.12)';
        ctx.lineWidth = 0.06;
        ctx.beginPath();
        const yy = seg.y + 0.32 + band * 0.4;
        for (let x = seg.x0 + 0.1; x <= seg.x1 - 0.1; x += 0.22) {
          const wy = yy + Math.sin(x * 2.6 + t * 1.7 + seg.y * 1.3 + band * 2) * 0.07;
          if (x <= seg.x0 + 0.1) ctx.moveTo(x, wy); else ctx.lineTo(x, wy);
        }
        ctx.stroke();
      }
    }
    // きらめき
    for (const seg of this.waterSegs) {
      const n = Math.ceil((seg.x1 - seg.x0) * 0.7);
      for (let i = 0; i < n; i++) {
        const sx = seg.x0 + tRand(seg.x0 + i, seg.y, 91) * (seg.x1 - seg.x0);
        const sy = seg.y + tRand(seg.x0 + i, seg.y, 92);
        const tw = Math.sin(t * 2.4 + sx * 9 + sy * 7);
        if (tw > 0.55) {
          ctx.fillStyle = `rgba(255,255,255,${(tw - 0.55) * 0.8})`;
          ctx.beginPath();
          ctx.arc(sx, sy, 0.035 * tw, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // 岸の泡
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 0.045;
    for (const e of this.shoreEdges) {
      const wob = Math.sin(t * 2 + e.x * 3 + e.y * 5) * 0.02;
      ctx.beginPath();
      if (e.side === 'n') { ctx.moveTo(e.x + 0.08, e.y + 0.06 + wob); ctx.lineTo(e.x + 0.92, e.y + 0.06 - wob); }
      if (e.side === 's') { ctx.moveTo(e.x + 0.08, e.y + 0.94 + wob); ctx.lineTo(e.x + 0.92, e.y + 0.94 - wob); }
      if (e.side === 'w') { ctx.moveTo(e.x + 0.06 + wob, e.y + 0.08); ctx.lineTo(e.x + 0.06 - wob, e.y + 0.92); }
      if (e.side === 'e') { ctx.moveTo(e.x + 0.94 + wob, e.y + 0.08); ctx.lineTo(e.x + 0.94 - wob, e.y + 0.92); }
      ctx.stroke();
    }
    ctx.restore();
  },

  /* ---------------- ブーストパッド ---------------- */
  drawBoostPads(ctx, t, level) {
    for (const key in level.boostDir) {
      const [x, y] = key.split(',').map(Number);
      const d = level.boostDir[key];
      ctx.save();
      ctx.translate(x + 0.5, y + 0.5);
      ctx.rotate(Math.atan2(d.y, d.x));
      // パッド本体
      ctx.fillStyle = 'rgba(120,80,200,0.85)';
      rr(ctx, -0.42, -0.42, 0.84, 0.84, 0.16);
      ctx.fill();
      ctx.strokeStyle = 'rgba(200,170,255,0.7)';
      ctx.lineWidth = 0.04;
      rr(ctx, -0.42, -0.42, 0.84, 0.84, 0.16);
      ctx.stroke();
      // 流れる山形(シェブロン)
      ctx.save();
      ctx.beginPath();
      ctx.rect(-0.38, -0.38, 0.76, 0.76);
      ctx.clip();
      const flow = (t * 1.4) % 0.5;
      for (let i = -2; i <= 2; i++) {
        const cx = i * 0.5 + flow - 0.25;
        const a = 0.85 - Math.abs(cx) * 1.2;
        if (a <= 0) continue;
        ctx.strokeStyle = `rgba(240,225,255,${a})`;
        ctx.lineWidth = 0.09;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - 0.12, -0.2);
        ctx.lineTo(cx + 0.08, 0);
        ctx.lineTo(cx - 0.12, 0.2);
        ctx.stroke();
      }
      ctx.restore();
      ctx.restore();
    }
  },

  /* ---------------- ホール(カップ) ---------------- */
  drawHole(ctx, t, level) {
    const h = level.hole;
    if (!h) return;
    const locked = level.holeLocked();

    // うっすら光る輪
    if (!locked) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
      ctx.strokeStyle = `rgba(255,220,110,${0.25 + pulse * 0.3})`;
      ctx.lineWidth = 0.05 + pulse * 0.03;
      ctx.beginPath();
      ctx.arc(h.x, h.y, 0.52 + pulse * 0.06, 0, Math.PI * 2);
      ctx.stroke();
    }

    // カップ
    ctx.fillStyle = '#1d1430';
    ctx.beginPath();
    ctx.ellipse(h.x, h.y, 0.40, 0.40, 0, 0, Math.PI * 2);
    ctx.fill();
    const ig = ctx.createRadialGradient(h.x, h.y - 0.1, 0.02, h.x, h.y, 0.42);
    ig.addColorStop(0, 'rgba(0,0,0,0.9)');
    ig.addColorStop(0.7, 'rgba(30,20,55,0.4)');
    ig.addColorStop(1, 'rgba(60,45,95,0.5)');
    ctx.fillStyle = ig;
    ctx.beginPath();
    ctx.ellipse(h.x, h.y, 0.40, 0.40, 0, 0, Math.PI * 2);
    ctx.fill();
    // ふちの明るいリップ
    ctx.strokeStyle = 'rgba(255,250,230,0.5)';
    ctx.lineWidth = 0.045;
    ctx.beginPath();
    ctx.arc(h.x, h.y, 0.41, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();

    if (locked || level.unlockAnimT >= 0 && level.unlockAnimT < 0.6) {
      this.drawHoleCover(ctx, t, level, h);
    }

    // 旗
    if (!locked) {
      const sway = Math.sin(t * 2.1) * 0.06;
      ctx.strokeStyle = '#f3ead8';
      ctx.lineWidth = 0.06;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(h.x + 0.02, h.y - 0.02);
      ctx.quadraticCurveTo(h.x + 0.04, h.y - 0.6, h.x + 0.03 + sway * 0.3, h.y - 1.05);
      ctx.stroke();
      // ペナント
      const fx = h.x + 0.03 + sway * 0.3, fy = h.y - 1.05;
      ctx.fillStyle = '#ff5f6e';
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.quadraticCurveTo(fx + 0.28 + sway, fy + 0.02 + sway * 0.5, fx + 0.52 + sway * 2, fy + 0.14);
      ctx.quadraticCurveTo(fx + 0.28 + sway, fy + 0.2 + sway * 0.5, fx, fy + 0.30);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffe9a8';
      drawStarPath(ctx, fx + 0.17, fy + 0.15, 0.07, 0.032, 5);
      ctx.fill();
      // 旗のてっぺんの玉
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.arc(fx, fy - 0.02, 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  drawHoleCover(ctx, t, level, h) {
    const anim = level.unlockAnimT;
    let k = 0;
    if (anim >= 0) k = Math.min(1, anim / 0.6);
    const bob = Math.sin(t * 3) * 0.015;
    ctx.save();
    ctx.translate(h.x, h.y + bob - k * 0.5);
    ctx.globalAlpha = 1 - k;
    ctx.rotate(k * 1.4);
    const s = 1 + k * 0.4;
    ctx.scale(s, s);
    // 木のふた
    ctx.fillStyle = '#9a6b3f';
    ctx.beginPath();
    ctx.arc(0, 0, 0.46, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7a5230';
    ctx.lineWidth = 0.04;
    for (let i = -1; i <= 1; i++) {
      const half = Math.sqrt(Math.max(0.01, 0.46 * 0.46 - (i * 0.3) * (i * 0.3)));
      ctx.beginPath();
      ctx.moveTo(-half, i * 0.3);
      ctx.lineTo(half, i * 0.3);
      ctx.stroke();
    }
    ctx.strokeStyle = '#5d3e22';
    ctx.lineWidth = 0.05;
    ctx.beginPath();
    ctx.arc(0, 0, 0.44, 0, Math.PI * 2);
    ctx.stroke();
    // 南京錠
    ctx.fillStyle = '#ffd23e';
    rr(ctx, -0.13, -0.06, 0.26, 0.22, 0.05);
    ctx.fill();
    ctx.strokeStyle = '#c9971b';
    ctx.lineWidth = 0.055;
    ctx.beginPath();
    ctx.arc(0, -0.07, 0.09, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = '#8a6410';
    ctx.beginPath();
    ctx.arc(0, 0.03, 0.035, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  /* ---------------- ポータル ---------------- */
  drawPortals(ctx, t, level) {
    for (const p of level.portals) {
      const hue = p.id === 1 ? '126,224,255' : '255,157,224';
      ctx.save();
      ctx.translate(p.x, p.y);
      // 光
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.75);
      g.addColorStop(0, `rgba(${hue},0.35)`);
      g.addColorStop(1, `rgba(${hue},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, 0.75, 0, Math.PI * 2); ctx.fill();
      // くらい中心
      const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.40);
      cg.addColorStop(0, 'rgba(18,10,40,0.95)');
      cg.addColorStop(0.75, 'rgba(30,18,60,0.75)');
      cg.addColorStop(1, 'rgba(40,25,75,0)');
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.arc(0, 0, 0.40, 0, Math.PI * 2); ctx.fill();
      // ふちのリング
      ctx.strokeStyle = `rgba(${hue},0.55)`;
      ctx.lineWidth = 0.05;
      ctx.beginPath(); ctx.arc(0, 0, 0.38, 0, Math.PI * 2); ctx.stroke();
      // うずまき
      ctx.rotate(t * 2.2 + p.phase);
      for (let arm = 0; arm < 2; arm++) {
        ctx.rotate(Math.PI);
        ctx.strokeStyle = `rgba(${hue},0.9)`;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let a = 0; a < 2.4; a += 0.18) {
          const r = 0.08 + a * 0.14;
          const x = Math.cos(a * 1.8) * r, y = Math.sin(a * 1.8) * r;
          if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.lineWidth = 0.075;
        ctx.stroke();
      }
      // まわる粒
      for (let i = 0; i < 3; i++) {
        const a = t * 3 + (i / 3) * Math.PI * 2 + p.phase;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 0.42, Math.sin(a) * 0.42, 0.04, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  },

  /* ---------------- ほし ---------------- */
  drawStars(ctx, t, level) {
    for (const s of level.stars) {
      if (s.taken) continue;
      const bob = Math.sin(t * 2.2 + s.phase) * 0.06;
      const rot = Math.sin(t * 1.4 + s.phase) * 0.22;
      // 影
      ctx.fillStyle = 'rgba(25,15,50,0.25)';
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + 0.30, 0.16 - bob * 0.3, 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
      // 光
      const g = ctx.createRadialGradient(s.x, s.y + bob, 0, s.x, s.y + bob, 0.55);
      g.addColorStop(0, 'rgba(255,215,80,0.35)');
      g.addColorStop(1, 'rgba(255,215,80,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(s.x, s.y + bob, 0.55, 0, Math.PI * 2); ctx.fill();
      // 本体
      ctx.save();
      ctx.translate(s.x, s.y + bob);
      ctx.rotate(rot);
      ctx.fillStyle = '#f5a821';
      drawStarPath(ctx, 0.012, 0.02, 0.26, 0.115, 5);
      ctx.fill();
      ctx.fillStyle = '#ffd23e';
      drawStarPath(ctx, 0, 0, 0.26, 0.115, 5);
      ctx.fill();
      ctx.fillStyle = '#fff3b0';
      drawStarPath(ctx, -0.02, -0.03, 0.14, 0.06, 5);
      ctx.fill();
      ctx.restore();
      // ときどききらっ
      const tw = Math.sin(t * 3 + s.phase * 3);
      if (tw > 0.92) {
        ctx.fillStyle = `rgba(255,255,255,${(tw - 0.92) * 9})`;
        drawStarPath(ctx, s.x + 0.18, s.y + bob - 0.18, 0.07, 0.028, 4);
        ctx.fill();
      }
    }
  },

  /* ---------------- キノコバンパー ---------------- */
  drawBumpers(ctx, t, level) {
    for (const m of level.bumpers) {
      const since = level.time - m.hitT;
      const pop = since < 0.4 ? Math.exp(-since * 8) * Math.sin(since * 28) * 0.16 : 0;
      const breathe = Math.sin(t * 1.8 + m.x * 3 + m.y) * 0.02;
      const sx = 1 + pop + breathe, sy = 1 - pop * 0.8 + breathe * 0.5;
      // 影
      ctx.fillStyle = 'rgba(25,15,50,0.30)';
      ctx.beginPath();
      ctx.ellipse(m.x, m.y + 0.30, 0.36, 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.scale(sx, sy);
      // じく
      ctx.fillStyle = '#f6ecd8';
      rr(ctx, -0.14, 0.05, 0.28, 0.26, 0.09);
      ctx.fill();
      ctx.fillStyle = 'rgba(180,150,110,0.4)';
      rr(ctx, -0.14, 0.2, 0.28, 0.09, 0.045);
      ctx.fill();
      // かさ
      const capG = ctx.createRadialGradient(-0.1, -0.18, 0.05, 0, -0.05, 0.48);
      capG.addColorStop(0, '#ff8080');
      capG.addColorStop(0.55, '#ee5555');
      capG.addColorStop(1, '#cc3a3a');
      ctx.fillStyle = capG;
      ctx.beginPath();
      ctx.ellipse(0, -0.04, 0.42, 0.33, 0, Math.PI * 0.97, Math.PI * 0.03);
      ctx.fill();
      // 白いドット
      ctx.fillStyle = 'rgba(255,248,238,0.95)';
      const dots = [[-0.18, -0.14, 0.07], [0.12, -0.2, 0.055], [0.05, -0.02, 0.045], [-0.02, -0.26, 0.04], [0.26, -0.06, 0.05]];
      for (const [dx, dy, dr] of dots) {
        ctx.beginPath();
        ctx.ellipse(dx, dy, dr, dr * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // つや
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(-0.16, -0.2, 0.12, 0.06, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  },

  /* ---------------- ボギー ---------------- */
  drawBogeys(ctx, t, level) {
    for (const g of level.bogeys) {
      if (!g.alive) continue;
      const walk = Math.sin(t * 9 + g.phase);
      const squish = 1 + walk * 0.05;
      const wob = g.wobble > 0 ? Math.sin(t * 40) * 0.04 : 0;
      const facing = g.dx !== 0 ? Math.sign(g.dx) : 0;
      // 影
      ctx.fillStyle = 'rgba(25,15,50,0.30)';
      ctx.beginPath();
      ctx.ellipse(g.x, g.y + 0.32, 0.30, 0.10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(g.x + wob, g.y + Math.abs(walk) * -0.045);
      ctx.scale(1 / squish, squish);
      // あし
      ctx.fillStyle = '#33305c';
      ctx.beginPath();
      ctx.ellipse(-0.14, 0.32 + walk * 0.03, 0.09, 0.055, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0.14, 0.32 - walk * 0.03, 0.09, 0.055, 0, 0, Math.PI * 2);
      ctx.fill();
      // からだ
      const bg = ctx.createRadialGradient(-0.1, -0.14, 0.04, 0, 0, 0.45);
      bg.addColorStop(0, '#6d68a8');
      bg.addColorStop(0.6, '#524d88');
      bg.addColorStop(1, '#403b6e');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.ellipse(0, 0, 0.34, 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      // つの
      ctx.fillStyle = '#e8d5a8';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * 0.16, -0.24);
        ctx.quadraticCurveTo(s * 0.30, -0.42, s * 0.20, -0.46);
        ctx.quadraticCurveTo(s * 0.14, -0.38, s * 0.08, -0.28);
        ctx.closePath();
        ctx.fill();
      }
      // め(おこりんぼ)
      const ex = facing * 0.05;
      for (const s of [-1, 1]) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(s * 0.12 + ex, -0.05, 0.088, 0.10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2a2440';
        ctx.beginPath();
        ctx.arc(s * 0.12 + ex + facing * 0.03, -0.04, 0.045, 0, Math.PI * 2);
        ctx.fill();
        // まゆ
        ctx.strokeStyle = '#2a2440';
        ctx.lineWidth = 0.045;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s * 0.05 + ex, -0.17);
        ctx.lineTo(s * 0.19 + ex, -0.13 - 0.06 * 1);
        ctx.stroke();
      }
      // くち(むすっ)
      ctx.strokeStyle = '#2a2440';
      ctx.lineWidth = 0.045;
      ctx.beginPath();
      if (g.wobble > 0) {
        ctx.arc(ex, 0.16, 0.06, 0, Math.PI * 2); // びっくり口
      } else {
        ctx.moveTo(ex - 0.09, 0.15);
        ctx.quadraticCurveTo(ex, 0.10, ex + 0.09, 0.15);
      }
      ctx.stroke();
      ctx.restore();
    }
  },

  /* ---------------- ボール(主人公) ---------------- */
  drawBall(ctx, t, level, input) {
    const b = level.ball;
    if (level.state === 'won') return;
    const r = b.r * (b.scale || 1);
    if (r <= 0.01) return;

    // 軌跡
    for (const p of b.trail) {
      const k = 1 - p.age / 0.3;
      ctx.fillStyle = `rgba(255,250,238,${k * 0.22})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, b.r * (0.4 + k * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }

    // 影
    ctx.fillStyle = 'rgba(25,15,50,0.30)';
    ctx.beginPath();
    ctx.ellipse(b.x, b.y + b.r * 0.75, r * 0.9, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(b.x, b.y);
    if (b.squash > 0.02) {
      ctx.rotate(b.squashA);
      ctx.scale(1 - b.squash * 0.3, 1 + b.squash * 0.3);
      ctx.rotate(-b.squashA);
    }

    // からだ
    const bodyG = ctx.createRadialGradient(-r * 0.4, -r * 0.45, r * 0.1, 0, 0, r * 1.35);
    bodyG.addColorStop(0, '#ffffff');
    bodyG.addColorStop(0.6, '#fff6e8');
    bodyG.addColorStop(1, '#e3c49b');
    ctx.fillStyle = bodyG;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // ゴルフボールのディンプル(回転が見えるように)
    ctx.fillStyle = 'rgba(160,130,95,0.18)';
    for (let i = 0; i < 4; i++) {
      const a = b.spin + (i / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.10, 0, Math.PI * 2);
      ctx.fill();
    }

    // ハイライト
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.38, -r * 0.42, r * 0.22, r * 0.15, -0.6, 0, Math.PI * 2);
    ctx.fill();

    // ---- かお ----
    let lookX = b.lookX, lookY = b.lookY;
    if (input && input.aiming && level.canShoot()) {
      const aim = input.getAim();
      if (aim && aim.power > 0.5) { lookX = aim.dirX; lookY = aim.dirY; }
    }
    const exOff = lookX * r * 0.22, eyOff = lookY * r * 0.20;
    const eyeY = -r * 0.05 + eyOff;
    const face = b.face;
    const blink = b.blink > 0;

    for (const s of [-1, 1]) {
      const ex = s * r * 0.36 + exOff;
      if (face === 'happy') {
        // にっこり目 ∪
        ctx.strokeStyle = '#3a2f45';
        ctx.lineWidth = r * 0.14;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(ex, eyeY, r * 0.17, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      } else if (blink) {
        ctx.strokeStyle = '#3a2f45';
        ctx.lineWidth = r * 0.12;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ex - r * 0.14, eyeY);
        ctx.lineTo(ex + r * 0.14, eyeY);
        ctx.stroke();
      } else {
        const big = face === 'surprised' ? 1.35 : 1;
        ctx.fillStyle = '#3a2f45';
        ctx.beginPath();
        ctx.arc(ex, eyeY, r * 0.155 * big, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex - r * 0.05, eyeY - r * 0.06, r * 0.05 * big, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ほっぺ
    ctx.fillStyle = 'rgba(247,160,150,0.75)';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(s * r * 0.62 + exOff * 0.5, r * 0.22 + eyOff * 0.5, r * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }

    // くち
    ctx.strokeStyle = '#3a2f45';
    ctx.lineWidth = r * 0.11;
    ctx.lineCap = 'round';
    const my = r * 0.33 + eyOff * 0.4;
    ctx.beginPath();
    if (face === 'surprised') {
      ctx.fillStyle = '#3a2f45';
      ctx.beginPath();
      ctx.ellipse(exOff * 0.6, my, r * 0.13, r * 0.17, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (face === 'happy' || face === 'go') {
      ctx.beginPath();
      ctx.arc(exOff * 0.6, my - r * 0.08, r * 0.26, Math.PI * 0.18, Math.PI * 0.82);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(exOff * 0.6, my - r * 0.05, r * 0.17, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
    }

    ctx.restore();
  },

  /* ---------------- ねらいのUI ---------------- */
  drawAim(ctx, t, level, input) {
    const aim = input.getAim();
    if (!aim || aim.power < 0.5) return;
    const b = level.ball;
    const frac = aim.power / PHYS.MAX_POWER;

    // ゴムひも(うしろに引っぱる)
    const pullLen = Math.min(aim.pullLen, 1.7);
    const px = b.x - aim.dirX * pullLen, py = b.y - aim.dirY * pullLen;
    const perpX = -aim.dirY * b.r * 0.75, perpY = aim.dirX * b.r * 0.75;
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.moveTo(b.x + perpX, b.y + perpY);
    ctx.lineTo(px, py);
    ctx.lineTo(b.x - perpX, b.y - perpY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 0.05;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(b.x + perpX, b.y + perpY);
    ctx.lineTo(px, py);
    ctx.lineTo(b.x - perpX, b.y - perpY);
    ctx.stroke();
    // 引っぱりハンドル
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(px, py, 0.11, 0, Math.PI * 2);
    ctx.fill();

    // 軌道の点々
    const pts = level.previewPath(aim.dirX, aim.dirY, aim.power);
    for (let i = 0; i < pts.length; i++) {
      const k = 1 - i / pts.length;
      const rr2 = 0.075 * (0.45 + k * 0.55);
      ctx.fillStyle = `rgba(255,255,255,${0.25 + k * 0.65})`;
      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y, rr2, 0, Math.PI * 2);
      ctx.fill();
    }

    // パワーリング
    const hue = 120 - frac * 115;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 0.075;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 0.55, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `hsl(${hue},85%,60%)`;
    ctx.lineWidth = 0.095;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 0.55, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    ctx.stroke();

    // 矢じるし
    ctx.save();
    ctx.translate(b.x + aim.dirX * 0.85, b.y + aim.dirY * 0.85);
    ctx.rotate(Math.atan2(aim.dirY, aim.dirX));
    ctx.fillStyle = `hsl(${hue},85%,65%)`;
    ctx.beginPath();
    ctx.moveTo(0.16, 0);
    ctx.lineTo(-0.08, -0.14);
    ctx.lineTo(-0.03, 0);
    ctx.lineTo(-0.08, 0.14);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  /* ---------------- 松明 ---------------- */
  drawTorches(ctx, t) {
    for (const tc of this.torches) {
      const f1 = Math.sin(t * 11 + tc.ph) * 0.5 + Math.sin(t * 17 + tc.ph * 2) * 0.3;
      const f2 = Math.sin(t * 13 + tc.ph * 1.7) * 0.5;
      const h = 0.22 + f1 * 0.04;

      // 灯り(加算)
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const gr = 1.35 + f1 * 0.12;
      const g = ctx.createRadialGradient(tc.x, tc.y, 0, tc.x, tc.y, gr);
      g.addColorStop(0, 'rgba(255,160,60,0.20)');
      g.addColorStop(0.5, 'rgba(255,130,40,0.08)');
      g.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(tc.x, tc.y, gr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 炎(3層)
      ctx.save();
      ctx.translate(tc.x + f2 * 0.02, tc.y);
      ctx.fillStyle = 'rgba(255,120,40,0.85)';
      ctx.beginPath();
      ctx.ellipse(0, -h * 0.4, 0.10 + f1 * 0.012, h, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,185,70,0.9)';
      ctx.beginPath();
      ctx.ellipse(f2 * 0.015, -h * 0.32, 0.065, h * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,240,180,0.95)';
      ctx.beginPath();
      ctx.ellipse(0, -h * 0.2, 0.032, h * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 火の粉
      if (Math.random() < 0.05) {
        Particles.add({
          x: tc.x + (Math.random() - 0.5) * 0.1,
          y: tc.y - 0.25,
          vx: (Math.random() - 0.5) * 0.4,
          vy: -0.6 - Math.random() * 0.7,
          life: 0.7 + Math.random() * 0.5,
          size: 0.028 + Math.random() * 0.02,
          color: ['#ffb347', '#ff8c3a', '#ffe9a8'][(Math.random() * 3) | 0],
          drag: 1, grav: -0.3,
        });
      }
    }
  },
};

/* ---------------- 共有ヘルパ ---------------- */
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function tRand(x, y, s) {
  const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return v - Math.floor(v);
}
