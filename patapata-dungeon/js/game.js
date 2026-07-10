/* ============================================================
   Game — レベルの状態と物理シミュレーション
   セル単位のワールド座標。ボールはひっぱって発射。
   ============================================================ */
const TILE = { VOID: 0, WALL: 1, FLOOR: 2, SAND: 3, WATER: 4, BOOST: 5 };

const PHYS = {
  BALL_R: 0.30,
  FRICTION: 1.25,       // しばふの減速
  SAND_FRICTION: 4.6,   // すなの減速
  RESTITUTION: 0.72,    // かべの反発
  MAX_POWER: 17,        // 最大初速 (セル/秒)
  PULL_GAIN: 4.2,       // ひっぱり距離→パワー
  STOP_SPEED: 0.18,     // 停止とみなす速さ
  AIM_SPEED: 0.9,       // この速さ以下なら次が撃てる
  HOLE_R: 0.40,         // カップ半径
  CAPTURE_SPEED: 7.5,   // これ以下ならカップイン
  MAGNET_R: 0.95,       // カップの引力範囲
  BUMPER_R: 0.42,
  BUMPER_POWER: 11.5,
  BOGEY_R: 0.36,
  BOGEY_SPEED: 1.5,
  BONK_SPEED: 5.0,      // これ以上でボギーをボンク
  BOOST_ACC: 30,
  BOOST_MAX: 19,
  STAR_R: 0.55,         // ほしの取得半径(おおらかに)
  PORTAL_R: 0.42,
};

class Level {
  constructor(def, index) {
    this.def = def;
    this.index = index;
    this.name = def.name;
    this.par = def.par;
    this.parse(def.map);

    this.state = 'play';       // play | sinking | capturing | won
    this.strokes = 0;
    this.collected = 0;
    this.time = 0;
    this.stateT = 0;
    this.won = false;
    this.unlockAnimT = -1;     // カギが開く演出
    this.captureFrom = null;
    this.events = [];          // レンダラ/メイン向けワンショットイベント
  }

  /* ---------------- パース ---------------- */
  parse(map) {
    this.h = map.length;
    this.w = map[0].length;
    this.tiles = [];
    this.stars = [];
    this.bumpers = [];
    this.bogeys = [];
    this.portals = [];
    this.hole = null;
    this.gated = false;

    for (let y = 0; y < this.h; y++) {
      const row = [];
      for (let x = 0; x < this.w; x++) {
        const c = map[y][x] || ' ';
        const cx = x + 0.5, cy = y + 0.5;
        let t = TILE.FLOOR;
        switch (c) {
          case '#': t = TILE.WALL; break;
          case ' ': t = TILE.VOID; break;
          case ',': t = TILE.SAND; break;
          case '~': t = TILE.WATER; break;
          case '^': case 'v': case '<': case '>': t = TILE.BOOST; break;
          case 'S': this.start = { x: cx, y: cy }; break;
          case 'H': this.hole = { x: cx, y: cy }; break;
          case 'G': this.hole = { x: cx, y: cy }; this.gated = true; break;
          case '*': this.stars.push({ x: cx, y: cy, taken: false, phase: Math.random() * 6 }); break;
          case 'o': this.bumpers.push({ x: cx, y: cy, hitT: -9 }); break;
          case 'b': this.bogeys.push(this.makeBogey(cx, cy, 1, 0)); break;
          case 'd': this.bogeys.push(this.makeBogey(cx, cy, 0, 1)); break;
          case '1': this.portals.push({ x: cx, y: cy, id: 1, phase: 0 }); break;
          case '2': this.portals.push({ x: cx, y: cy, id: 2, phase: Math.PI }); break;
        }
        row.push(t);
      }
      this.tiles.push(row);
    }
    // ブースト方向を別マップで保持
    this.boostDir = {};
    const DIRS = { '^': { x: 0, y: -1 }, 'v': { x: 0, y: 1 }, '<': { x: -1, y: 0 }, '>': { x: 1, y: 0 } };
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const d = DIRS[map[y][x]];
        if (d) this.boostDir[x + ',' + y] = d;
      }
    }

    this.ball = {
      x: this.start.x, y: this.start.y,
      vx: 0, vy: 0,
      r: PHYS.BALL_R,
      scale: 1,
      squash: 0, squashA: 0,   // つぶれ演出
      blink: 0, blinkNext: 1 + Math.random() * 3,
      face: 'normal',
      faceT: 0,
      lookX: 0, lookY: 0,
      spin: 0,
      trail: [],
      dropT: -1,               // リスポーンの落下演出
    };
    this.restPos = { x: this.start.x, y: this.start.y };
  }

  makeBogey(x, y, dx, dy) {
    return {
      x, y, dx, dy,
      alive: true,
      wobble: 0,          // ぶつかられた時のぷるぷる
      phase: Math.random() * 6,
      poofT: -1,
    };
  }

  /* ---------------- ユーティリティ ---------------- */
  tileAt(x, y) {
    const tx = Math.floor(x), ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return TILE.VOID;
    return this.tiles[ty][tx];
  }

  isSolid(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return true;
    const t = this.tiles[ty][tx];
    return t === TILE.WALL || t === TILE.VOID;
  }

  holeLocked() {
    return this.gated && this.bogeys.some(b => b.alive);
  }

  canShoot() {
    if (this.state !== 'play') return false;
    const b = this.ball;
    if (b.dropT >= 0) return false;
    return Math.hypot(b.vx, b.vy) < PHYS.AIM_SPEED;
  }

  emit(name, data) { this.events.push({ name, data }); }
  drainEvents() { const e = this.events; this.events = []; return e; }

  /* ---------------- ショット ---------------- */
  shoot(dirX, dirY, power) {
    if (!this.canShoot()) return false;
    const b = this.ball;
    this.restPos = { x: b.x, y: b.y };
    b.vx = dirX * power;
    b.vy = dirY * power;
    this.strokes++;
    b.face = 'go';
    b.faceT = 0.5;
    Particles.grassKick(b.x, b.y, Math.atan2(dirY, dirX));
    Particles.ring(b.x, b.y, 'rgba(255,255,255,0.7)');
    AudioMan.shoot(power / PHYS.MAX_POWER);
    this.emit('shot');
    return true;
  }

  /* ---------------- 更新 ---------------- */
  update(dt) {
    this.time += dt;
    this.stateT += dt;
    if (this.unlockAnimT >= 0 && this.unlockAnimT < 5) this.unlockAnimT += dt;
    const b = this.ball;

    // まばたき
    b.blinkNext -= dt;
    if (b.blinkNext <= 0) { b.blink = 0.13; b.blinkNext = 1.5 + Math.random() * 3.5; }
    if (b.blink > 0) b.blink -= dt;
    if (b.faceT > 0) { b.faceT -= dt; if (b.faceT <= 0) b.face = 'normal'; }
    if (b.squash > 0) { b.squash -= dt * 4; if (b.squash < 0) b.squash = 0; }

    // ボギー移動
    for (const g of this.bogeys) {
      if (!g.alive) { if (g.poofT >= 0) g.poofT += dt; continue; }
      if (g.wobble > 0) { g.wobble -= dt; continue; }
      const sp = PHYS.BOGEY_SPEED;
      const nx = g.x + g.dx * sp * dt;
      const ny = g.y + g.dy * sp * dt;
      const ahead = { x: nx + g.dx * PHYS.BOGEY_R, y: ny + g.dy * PHYS.BOGEY_R };
      const t = this.tileAt(ahead.x, ahead.y);
      if (t === TILE.WALL || t === TILE.VOID || t === TILE.WATER) {
        g.dx = -g.dx; g.dy = -g.dy;
      } else {
        g.x = nx; g.y = ny;
      }
    }

    // 状態別
    if (this.state === 'sinking') { this.updateSinking(dt); return; }
    if (this.state === 'capturing') { this.updateCapturing(dt); return; }
    if (this.state === 'won') return;

    // リスポーン落下演出
    if (b.dropT >= 0) {
      b.dropT += dt;
      const k = Math.min(1, b.dropT / 0.45);
      b.scale = 1.6 - 0.6 * easeOutBack(k);
      if (k >= 1) { b.dropT = -1; b.scale = 1; }
      return;
    }

    this.updateBall(dt);
  }

  updateBall(dt) {
    const b = this.ball;
    let speed = Math.hypot(b.vx, b.vy);

    // 摩擦
    const tHere = this.tileAt(b.x, b.y);
    const fric = tHere === TILE.SAND ? PHYS.SAND_FRICTION : PHYS.FRICTION;
    const damp = Math.exp(-fric * dt);
    b.vx *= damp; b.vy *= damp;

    // ブースト
    if (tHere === TILE.BOOST) {
      const d = this.boostDir[Math.floor(b.x) + ',' + Math.floor(b.y)];
      if (d) {
        b.vx += d.x * PHYS.BOOST_ACC * dt;
        b.vy += d.y * PHYS.BOOST_ACC * dt;
        const s = Math.hypot(b.vx, b.vy);
        if (s > PHYS.BOOST_MAX) { b.vx *= PHYS.BOOST_MAX / s; b.vy *= PHYS.BOOST_MAX / s; }
        if (Math.random() < dt * 30) Particles.sparkleTrail(b.x, b.y);
        if (!this._boosting) { AudioMan.boost(); this._boosting = true; }
      }
    } else this._boosting = false;

    // カップの引力(ゆっくりの時だけ)
    const hole = this.hole;
    if (!this.holeLocked()) {
      const dx = hole.x - b.x, dy = hole.y - b.y;
      const d = Math.hypot(dx, dy);
      if (d < PHYS.MAGNET_R && speed < PHYS.CAPTURE_SPEED) {
        const pull = (1 - d / PHYS.MAGNET_R) * 10;
        b.vx += (dx / (d || 1)) * pull * dt;
        b.vy += (dy / (d || 1)) * pull * dt;
      }
    }

    speed = Math.hypot(b.vx, b.vy);
    if (speed < PHYS.STOP_SPEED) { b.vx = 0; b.vy = 0; speed = 0; }

    // サブステップ移動+衝突
    const steps = Math.min(8, Math.max(1, Math.ceil((speed * dt) / 0.15)));
    const sdt = dt / steps;
    for (let i = 0; i < steps; i++) {
      b.x += b.vx * sdt;
      b.y += b.vy * sdt;
      this.collideWalls();
      this.collideBumpers();
      this.collideBogeys();
      this.checkPortals();
    }

    // スピン(みため)
    b.spin += speed * dt * 2.2;

    // 軌跡
    if (speed > 2.5) {
      b.trail.push({ x: b.x, y: b.y, age: 0 });
      if (speed > 9 && Math.random() < dt * 20) Particles.sparkleTrail(b.x, b.y);
    }
    for (let i = b.trail.length - 1; i >= 0; i--) {
      b.trail[i].age += dt;
      if (b.trail[i].age > 0.3) b.trail.splice(i, 1);
    }

    // 目線
    if (speed > 0.5) {
      b.lookX += ((b.vx / (speed || 1)) - b.lookX) * dt * 8;
      b.lookY += ((b.vy / (speed || 1)) - b.lookY) * dt * 8;
    } else {
      b.lookX *= 1 - dt * 4; b.lookY *= 1 - dt * 4;
    }

    // ほし
    for (const s of this.stars) {
      if (s.taken) continue;
      if (Math.hypot(s.x - b.x, s.y - b.y) < PHYS.STAR_R) {
        s.taken = true;
        this.collected++;
        Particles.starBurst(s.x, s.y);
        AudioMan.pickup(this.collected - 1);
        this.emit('star', this.collected);
      }
    }

    // みず
    if (this.tileAt(b.x, b.y) === TILE.WATER) {
      this.state = 'sinking';
      this.stateT = 0;
      Particles.splash(b.x, b.y);
      AudioMan.splash();
      b.face = 'surprised'; b.faceT = 1.2;
      this.emit('splash');
      return;
    }

    // カップイン判定
    if (!this.holeLocked()) {
      const d = Math.hypot(hole.x - b.x, hole.y - b.y);
      if (d < PHYS.HOLE_R && speed < PHYS.CAPTURE_SPEED) {
        this.state = 'capturing';
        this.stateT = 0;
        this.captureFrom = { x: b.x, y: b.y, angle: Math.atan2(b.y - hole.y, b.x - hole.x) };
        b.face = 'happy'; b.faceT = 5;
        AudioMan.win();
        this.emit('capture');
        return;
      }
    }
  }

  /* ---------------- 衝突 ---------------- */
  collideWalls() {
    const b = this.ball;
    const tx0 = Math.floor(b.x - b.r), tx1 = Math.floor(b.x + b.r);
    const ty0 = Math.floor(b.y - b.r), ty1 = Math.floor(b.y + b.r);
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (!this.isSolid(tx, ty)) continue;
        // 円 vs AABB
        const cx = Math.max(tx, Math.min(b.x, tx + 1));
        const cy = Math.max(ty, Math.min(b.y, ty + 1));
        let dx = b.x - cx, dy = b.y - cy;
        let d = Math.hypot(dx, dy);
        if (d >= b.r) continue;
        let nx, ny;
        if (d < 1e-6) {
          // 中心がAABB内 — 最短軸で押し出し
          const l = b.x - tx, r = tx + 1 - b.x, t = b.y - ty, bo = ty + 1 - b.y;
          const m = Math.min(l, r, t, bo);
          nx = m === l ? -1 : m === r ? 1 : 0;
          ny = m === t ? -1 : m === bo ? 1 : 0;
          d = 0;
        } else {
          nx = dx / d; ny = dy / d;
        }
        b.x += nx * (b.r - d);
        b.y += ny * (b.r - d);
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) {
          b.vx -= (1 + PHYS.RESTITUTION) * vn * nx;
          b.vy -= (1 + PHYS.RESTITUTION) * vn * ny;
          const impact = -vn;
          if (impact > 1.5) {
            AudioMan.bounce(impact);
            b.squash = Math.min(1, impact / 12);
            b.squashA = Math.atan2(ny, nx);
            if (impact > 5) {
              Particles.burst(b.x - nx * b.r, b.y - ny * b.r,
                { n: 5, speed: 2, size: 0.05, colors: ['#e8e0f5', '#cfc3e6'], life: 0.4 });
              this.emit('thud', impact);
            }
          }
        }
      }
    }
  }

  collideBumpers() {
    const b = this.ball;
    for (const m of this.bumpers) {
      const dx = b.x - m.x, dy = b.y - m.y;
      const d = Math.hypot(dx, dy);
      const minD = b.r + PHYS.BUMPER_R;
      if (d < minD && d > 1e-6) {
        const nx = dx / d, ny = dy / d;
        b.x = m.x + nx * minD;
        b.y = m.y + ny * minD;
        const sp = Math.hypot(b.vx, b.vy);
        const out = Math.min(PHYS.BOOST_MAX, Math.max(PHYS.BUMPER_POWER, sp * 1.05));
        b.vx = nx * out; b.vy = ny * out;
        m.hitT = this.time;
        b.face = 'surprised'; b.faceT = 0.6;
        AudioMan.boing();
        Particles.ring(m.x, m.y, 'rgba(255,180,180,0.9)');
        Particles.burst(b.x, b.y, { n: 6, speed: 2.5, size: 0.06,
          colors: ['#ffd0d0', '#ffffff'], life: 0.4 });
        this.emit('bumper');
      }
    }
  }

  collideBogeys() {
    const b = this.ball;
    for (const g of this.bogeys) {
      if (!g.alive) continue;
      const dx = b.x - g.x, dy = b.y - g.y;
      const d = Math.hypot(dx, dy);
      const minD = b.r + PHYS.BOGEY_R;
      if (d < minD && d > 1e-6) {
        const nx = dx / d, ny = dy / d;
        const sp = Math.hypot(b.vx, b.vy);
        if (sp > PHYS.BONK_SPEED) {
          // ボンク!
          g.alive = false;
          g.poofT = 0;
          b.vx *= 0.55; b.vy *= 0.55;
          Particles.poof(g.x, g.y);
          AudioMan.bonk();
          b.face = 'happy'; b.faceT = 1;
          this.emit('bonk');
          if (this.gated && !this.bogeys.some(o => o.alive)) {
            this.unlockAnimT = 0;
            AudioMan.unlockChime();
            Particles.burst(this.hole.x, this.hole.y, { n: 18, speed: 4, size: 0.1,
              shape: 'star', colors: ['#ffd23e', '#fff3b0', '#ffffff'], grav: 2, life: 1 });
            this.emit('unlock');
          }
        } else {
          // やさしくはねかえされる
          b.x = g.x + nx * minD;
          b.y = g.y + ny * minD;
          const vn = b.vx * nx + b.vy * ny;
          if (vn < 0) {
            b.vx -= 1.7 * vn * nx;
            b.vy -= 1.7 * vn * ny;
          }
          const s2 = Math.hypot(b.vx, b.vy);
          if (s2 < 2) { b.vx = nx * 2; b.vy = ny * 2; }
          g.wobble = 0.5;
          b.face = 'surprised'; b.faceT = 0.7;
          AudioMan.bounce(6);
          this.emit('bogeyBounce');
        }
      }
    }
  }

  checkPortals() {
    if (this.portals.length < 2) return;
    const b = this.ball;
    if (this._portalLock) {
      const near = this.portals.some(p => Math.hypot(p.x - b.x, p.y - b.y) < 0.85);
      if (!near) this._portalLock = false;
      return;
    }
    for (const p of this.portals) {
      if (Math.hypot(p.x - b.x, p.y - b.y) < PHYS.PORTAL_R) {
        const other = this.portals.find(q => q !== p);
        Particles.burst(p.x, p.y, { n: 10, speed: 2.5, size: 0.07,
          colors: ['#7ee0ff', '#ff9de0', '#ffffff'], life: 0.5 });
        b.x = other.x; b.y = other.y;
        this._portalLock = true;
        Particles.burst(other.x, other.y, { n: 12, speed: 3, size: 0.08,
          colors: ['#7ee0ff', '#ff9de0', '#ffffff'], life: 0.6 });
        Particles.ring(other.x, other.y, 'rgba(150,220,255,0.9)');
        AudioMan.teleport();
        b.face = 'surprised'; b.faceT = 0.8;
        this.emit('teleport');
        break;
      }
    }
  }

  /* ---------------- 沈む/カップイン演出 ---------------- */
  updateSinking(dt) {
    const b = this.ball;
    const k = Math.min(1, this.stateT / 0.7);
    b.vx *= Math.exp(-6 * dt); b.vy *= Math.exp(-6 * dt);
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.scale = 1 - easeInQuad(k) * 0.95;
    if (k >= 1) {
      // やさしくもどる(ペナルティなし)
      b.x = this.restPos.x; b.y = this.restPos.y;
      b.vx = 0; b.vy = 0;
      b.scale = 1.6;
      b.dropT = 0;
      b.trail = [];
      this.state = 'play';
      this.stateT = 0;
      Particles.ring(b.x, b.y, 'rgba(255,255,255,0.6)');
    }
  }

  updateCapturing(dt) {
    const b = this.ball;
    const dur = 0.75;
    const k = Math.min(1, this.stateT / dur);
    const a = this.captureFrom.angle + k * 5.2;
    const startD = Math.hypot(this.captureFrom.x - this.hole.x, this.captureFrom.y - this.hole.y);
    const r = startD * (1 - easeInQuad(k));
    b.x = this.hole.x + Math.cos(a) * r;
    b.y = this.hole.y + Math.sin(a) * r;
    b.scale = 1 - easeInQuad(k) * 0.9;
    if (k >= 1 && !this.won) {
      this.won = true;
      this.state = 'won';
      this.stateT = 0;
      Particles.confetti(this.hole.x, this.hole.y, 50);
      Particles.ring(this.hole.x, this.hole.y, 'rgba(255,220,120,1)');
      this.emit('won', { stars: this.collected, strokes: this.strokes });
    }
  }

  /* ---------------- 軌道プレビュー ---------------- */
  // かべ・バンパーだけを考慮した簡易シミュレーション
  previewPath(dirX, dirY, power) {
    const pts = [];
    let x = this.ball.x, y = this.ball.y;
    let vx = dirX * power, vy = dirY * power;
    const r = PHYS.BALL_R;
    const dt = 1 / 60;
    let acc = 0;
    for (let i = 0; i < 90; i++) {
      const tHere = this.tileAt(x, y);
      const fric = tHere === TILE.SAND ? PHYS.SAND_FRICTION : PHYS.FRICTION;
      const damp = Math.exp(-fric * dt);
      vx *= damp; vy *= damp;
      const sp = Math.hypot(vx, vy);
      if (sp < 1.2) break;
      const steps = Math.min(4, Math.max(1, Math.ceil((sp * dt) / 0.15)));
      const sdt = dt / steps;
      for (let s = 0; s < steps; s++) {
        x += vx * sdt; y += vy * sdt;
        // かべ
        const tx0 = Math.floor(x - r), tx1 = Math.floor(x + r);
        const ty0 = Math.floor(y - r), ty1 = Math.floor(y + r);
        for (let ty = ty0; ty <= ty1; ty++) {
          for (let tx = tx0; tx <= tx1; tx++) {
            if (!this.isSolid(tx, ty)) continue;
            const cx = Math.max(tx, Math.min(x, tx + 1));
            const cy = Math.max(ty, Math.min(y, ty + 1));
            let dx = x - cx, dy = y - cy;
            let d = Math.hypot(dx, dy);
            if (d >= r || d < 1e-6) continue;
            const nx = dx / d, ny = dy / d;
            x += nx * (r - d); y += ny * (r - d);
            const vn = vx * nx + vy * ny;
            if (vn < 0) { vx -= (1 + PHYS.RESTITUTION) * vn * nx; vy -= (1 + PHYS.RESTITUTION) * vn * ny; }
          }
        }
        // バンパー
        for (const m of this.bumpers) {
          const dx = x - m.x, dy = y - m.y;
          const d = Math.hypot(dx, dy);
          const minD = r + PHYS.BUMPER_R;
          if (d < minD && d > 1e-6) {
            const nx = dx / d, ny = dy / d;
            x = m.x + nx * minD; y = m.y + ny * minD;
            const sp2 = Math.hypot(vx, vy);
            const out = Math.min(PHYS.BOOST_MAX, Math.max(PHYS.BUMPER_POWER, sp2 * 1.05));
            vx = nx * out; vy = ny * out;
          }
        }
      }
      acc += dt;
      if (acc >= 0.055) {
        acc = 0;
        pts.push({ x, y });
        if (pts.length >= 22) break;
      }
      // みずに入ったらそこで打ち切り(1点だけ置く)
      if (this.tileAt(x, y) === TILE.WATER) { pts.push({ x, y }); break; }
    }
    return pts;
  }
}

/* ---------------- イージング ---------------- */
function easeInQuad(t) { return t * t; }
function easeOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
