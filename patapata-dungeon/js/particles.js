/* ============================================================
   Particles — ワールド座標(セル単位)のパーティクルシステム
   きらきら・けむり・しぶき・かみふぶき・波紋 など
   ============================================================ */
const Particles = {
  list: [],

  clear() { this.list = []; },

  add(p) {
    // 既定値
    p.age = 0;
    p.life = p.life || 0.8;
    p.size = p.size || 0.1;
    p.vx = p.vx || 0;
    p.vy = p.vy || 0;
    p.grav = p.grav !== undefined ? p.grav : 0;
    p.drag = p.drag !== undefined ? p.drag : 1.5;
    p.rot = p.rot || 0;
    p.vr = p.vr || 0;
    p.shape = p.shape || 'circle';
    p.color = p.color || '#ffffff';
    p.fade = p.fade !== undefined ? p.fade : true;
    p.shrink = p.shrink !== undefined ? p.shrink : true;
    if (this.list.length < 900) this.list.push(p);
  },

  /* ---------- スポーンヘルパ ---------- */
  burst(x, y, opts = {}) {
    const n = opts.n || 12;
    const colors = opts.colors || ['#ffd23e', '#ffef9e', '#ffffff'];
    for (let i = 0; i < n; i++) {
      const a = (opts.angle !== undefined)
        ? opts.angle + (Math.random() - 0.5) * (opts.spread || Math.PI * 2)
        : Math.random() * Math.PI * 2;
      const sp = (opts.speed || 3.5) * (0.4 + Math.random() * 0.8);
      this.add({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: (opts.life || 0.7) * (0.6 + Math.random() * 0.7),
        size: (opts.size || 0.09) * (0.6 + Math.random() * 0.9),
        color: colors[(Math.random() * colors.length) | 0],
        grav: opts.grav || 0,
        drag: opts.drag !== undefined ? opts.drag : 2.5,
        shape: opts.shape || 'circle',
        vr: (Math.random() - 0.5) * 10,
      });
    }
  },

  starBurst(x, y) {
    this.burst(x, y, { n: 14, speed: 4, size: 0.13, shape: 'star',
      colors: ['#ffd23e', '#ffb62e', '#fff3b0'], grav: 2, drag: 2, life: 0.9 });
    this.burst(x, y, { n: 10, speed: 2.4, size: 0.07,
      colors: ['#ffffff', '#fff3b0'], drag: 2, life: 0.55 });
    this.ring(x, y, '#ffe27a');
  },

  poof(x, y) {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 2;
      this.add({
        x: x + Math.cos(a) * 0.1, y: y + Math.sin(a) * 0.1,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.6,
        life: 0.7 + Math.random() * 0.4,
        size: 0.18 + Math.random() * 0.14,
        color: ['#cfc3e6', '#b9aed6', '#e8e0f5'][(Math.random() * 3) | 0],
        drag: 3.5, shrink: false, grow: 0.35, shape: 'circle',
      });
    }
    this.burst(x, y, { n: 5, speed: 3.6, size: 0.12, shape: 'star',
      colors: ['#ffd23e', '#fff3b0'], grav: 3, life: 0.8 });
  },

  splash(x, y) {
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1.2 + Math.random() * 3.2;
      this.add({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - 2.2,
        life: 0.5 + Math.random() * 0.35,
        size: 0.07 + Math.random() * 0.08,
        color: ['#9fd4f7', '#cfeafd', '#6fb7ec'][(Math.random() * 3) | 0],
        grav: 9, drag: 0.6, shape: 'drop',
      });
    }
    this.ripple(x, y);
    this.ripple(x, y, 0.15);
  },

  ripple(x, y, delay) {
    this.add({ x, y, shape: 'ring', life: 0.8, size: 0.15, growTo: 0.85,
      color: 'rgba(255,255,255,0.75)', delay: delay || 0, shrink: false });
  },

  ring(x, y, color) {
    this.add({ x, y, shape: 'ring', life: 0.45, size: 0.2, growTo: 0.9,
      color: color || 'rgba(255,255,255,0.8)', shrink: false });
  },

  confetti(x, y, n) {
    const colors = ['#ff8fb2', '#ffd23e', '#79d06e', '#7ec8f7', '#c9a0f5', '#ff9d5c'];
    for (let i = 0; i < (n || 40); i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const sp = 3 + Math.random() * 6;
      this.add({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 1.6 + Math.random() * 1.2,
        size: 0.09 + Math.random() * 0.09,
        color: colors[(Math.random() * colors.length) | 0],
        grav: 5.5, drag: 1.1,
        shape: Math.random() < 0.5 ? 'rect' : 'circle',
        vr: (Math.random() - 0.5) * 16,
        sway: Math.random() * Math.PI * 2,
        shrink: false,
      });
    }
  },

  grassKick(x, y, dir) {
    for (let i = 0; i < 6; i++) {
      const a = dir + Math.PI + (Math.random() - 0.5) * 1.1;
      const sp = 1 + Math.random() * 2;
      this.add({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.8,
        life: 0.4 + Math.random() * 0.25,
        size: 0.05 + Math.random() * 0.05,
        color: ['#5da344', '#79c05e', '#8ed072'][(Math.random() * 3) | 0],
        grav: 8, drag: 1.5, shape: 'rect', vr: (Math.random() - 0.5) * 14,
      });
    }
  },

  sparkleTrail(x, y) {
    this.add({
      x: x + (Math.random() - 0.5) * 0.25,
      y: y + (Math.random() - 0.5) * 0.25,
      life: 0.45, size: 0.05 + Math.random() * 0.05,
      color: ['#ffffff', '#fff3b0', '#ffe27a'][(Math.random() * 3) | 0],
      shape: 'star', vr: 6, drag: 3,
    });
  },

  /* ---------- 更新 ---------- */
  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.age += dt;
      if (p.age >= p.life) { L.splice(i, 1); continue; }
      p.vy += (p.grav || 0) * dt;
      const dr = Math.exp(-(p.drag || 0) * dt);
      p.vx *= dr; p.vy *= dr;
      if (p.sway !== undefined) {
        p.sway += dt * 7;
        p.vx += Math.sin(p.sway) * 2.2 * dt;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
  },

  /* ---------- 描画 (ワールド変換済みctx) ---------- */
  draw(ctx) {
    for (const p of this.list) {
      if (p.delay > 0) continue;
      const k = p.age / p.life;
      let alpha = p.fade ? (1 - k) : 1;
      let size = p.size;
      if (p.growTo) size = p.size + (p.growTo - p.size) * k;
      else if (p.grow) size = p.size + p.grow * k;
      else if (p.shrink) size = p.size * (1 - k * 0.7);
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      switch (p.shape) {
        case 'rect':
          ctx.fillRect(-size, -size * 0.6, size * 2, size * 1.2);
          break;
        case 'ring':
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 0.045 * (1 - k * 0.6);
          ctx.beginPath();
          ctx.arc(0, 0, size, 0, Math.PI * 2);
          ctx.stroke();
          break;
        case 'star':
          drawStarPath(ctx, 0, 0, size, size * 0.45, 5);
          ctx.fill();
          break;
        case 'drop':
          ctx.beginPath();
          ctx.ellipse(0, 0, size * 0.7, size, 0, 0, Math.PI * 2);
          ctx.fill();
          break;
        default:
          ctx.beginPath();
          ctx.arc(0, 0, size, 0, Math.PI * 2);
          ctx.fill();
      }
      ctx.restore();
    }
  },
};

/* 星型パス(共有ヘルパ) */
function drawStarPath(ctx, cx, cy, outer, inner, points) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}
