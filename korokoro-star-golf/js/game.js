/* ================================================================
   game.js — ゲーム本体（じょうたい・ぶつり・そうさ・UI）
   ================================================================ */
"use strict";

const Game = (() => {
  /* ---------- 定数 ---------- */
  const BALL_R = 0.34;
  const MAX_SPEED = 18;
  const WALL_REST = 0.72;
  const FRICTION = { ".": 4.2, ">": 2.0, "<": 2.0, "^": 2.0, "v": 2.0, s: 14, i: 1.0, w: 4.2 };

  /* ---------- 状態 ---------- */
  const game = {
    state: "title",         /* title | map | play | clear */
    phase: "aim",           /* aim | rolling | sinking | goal */
    level: null,
    levelIndex: 0,
    shots: 0,
    combo: 0,
    bumperHits: 0,
    fruitsGot: 0,
    goalActive: false,
    goalAnim: 0,
    goalT: 0,
    sinkT: 0,
    shake: 0,
    ballHidden: false,
    aiming: false,
    aimPower: 0,
    aimAngle: 0,
    idleT: 0,
    clearFxT: 0,
    BALL_R,
    ball: {
      x: 2, y: 2, vx: 0, vy: 0,
      mood: "happy", lookX: 0, lookY: 0,
      squashX: 1, squashY: 1, scale: 1, roll: 0,
      blinkT: 0, nextBlink: 2,
    },
    shotStart: { x: 2, y: 2 },
  };

  let save = { unlocked: 0, stars: new Array(LEVELS.length).fill(0) };
  try {
    const raw = localStorage.getItem("korokoroGolfSave");
    if (raw) {
      const s = JSON.parse(raw);
      if (typeof s.unlocked === "number") save.unlocked = clamp(s.unlocked, 0, LEVELS.length - 1);
      if (Array.isArray(s.stars)) s.stars.forEach((v, i) => { if (i < save.stars.length) save.stars[i] = v | 0; });
    }
  } catch (e) {}

  function persist() {
    try { localStorage.setItem("korokoroGolfSave", JSON.stringify(save)); } catch (e) {}
  }

  /* ---------- DOMヘルパー ---------- */
  const $ = (id) => document.getElementById(id);
  const screens = {
    title: $("title-screen"), map: $("map-screen"),
    clear: $("clear-screen"), hud: $("hud"),
  };

  function setVisible(el, on) { el.classList.toggle("hidden", !on); }

  function goTitle() {
    game.state = "title";
    setVisible(screens.title, true);
    setVisible(screens.map, false);
    setVisible(screens.clear, false);
    setVisible(screens.hud, false);
  }

  function goMap() {
    game.state = "map";
    buildMap();
    setVisible(screens.title, false);
    setVisible(screens.map, true);
    setVisible(screens.clear, false);
    setVisible(screens.hud, false);
  }

  /* ---------- マップ画面 ---------- */
  function buildMap() {
    const wrap = $("map-worlds");
    wrap.innerHTML = "";
    WORLDS.forEach((wld, wi) => {
      const card = document.createElement("div");
      card.className = "world-card";
      const name = document.createElement("div");
      name.className = "world-name";
      name.textContent = `${wld.emoji} ${wld.name}`;
      card.appendChild(name);
      const grid = document.createElement("div");
      grid.className = "world-levels";
      LEVELS.forEach((lv, i) => {
        if (lv.world !== wi) return;
        const btn = document.createElement("button");
        const locked = i > save.unlocked;
        btn.className = "level-btn" + (locked ? " locked" : "");
        if (locked) {
          btn.innerHTML = `<span class="level-num">🔒</span>`;
        } else {
          const stars = save.stars[i] || 0;
          const starsHtml = [1, 2, 3].map((k) =>
            `<span class="${k <= stars ? "on" : "off"}">★</span>`).join("");
          btn.innerHTML = `<span class="level-num">${i + 1}</span><span class="level-stars">${starsHtml}</span>`;
        }
        btn.addEventListener("click", () => {
          if (locked) { AudioSys.play("giggle"); return; }
          AudioSys.play("tap");
          startLevel(i);
        });
        grid.appendChild(btn);
      });
      card.appendChild(grid);
      wrap.appendChild(card);
    });
  }

  /* ---------- レベル開始 ---------- */
  function startLevel(index) {
    game.levelIndex = index;
    game.level = parseLevel(index);
    game.state = "play";
    game.phase = "aim";
    game.shots = 0;
    game.combo = 0;
    game.fruitsGot = 0;
    game.goalActive = false;
    game.goalAnim = 0;
    game.shake = 0;
    game.ballHidden = false;
    game.aiming = false;
    game.idleT = 0;

    const b = game.ball;
    b.x = game.level.start.x; b.y = game.level.start.y;
    b.vx = 0; b.vy = 0;
    b.mood = "happy"; b.squashX = 1; b.squashY = 1; b.scale = 1;
    game.shotStart = { x: b.x, y: b.y };

    Particles.clear();
    Renderer.computeView(game.level);
    Renderer.buildDeco(game.level);

    setVisible(screens.title, false);
    setVisible(screens.map, false);
    setVisible(screens.clear, false);
    setVisible(screens.hud, true);
    $("hud-level").textContent = `レベル ${index + 1}`;
    buildEnemyHud();
    showHint(true);

    /* コースのなまえをふわっと表示 */
    Particles.floatText(game.level.w / 2, 1.2, game.level.name, "#fff", 1.5, 2.0);
    AudioSys.play("tap");
  }

  function buildEnemyHud() {
    const wrap = $("hud-enemies");
    wrap.innerHTML = "";
    game.level.enemies.forEach((e, i) => {
      const dot = document.createElement("span");
      dot.className = "hud-enemy";
      dot.style.background = hsl(e.hue, 80, 62);
      dot.dataset.idx = i;
      wrap.appendChild(dot);
    });
  }

  function markEnemyHud(idx) {
    const dot = $("hud-enemies").querySelector(`[data-idx="${idx}"]`);
    if (dot) dot.classList.add("popped");
  }

  function showHint(on) {
    setVisible($("hint"), on);
  }

  /* ---------- ショット ---------- */
  function shoot() {
    const b = game.ball;
    const speed = 3 + game.aimPower * (MAX_SPEED - 3);
    b.vx = Math.cos(game.aimAngle) * speed;
    b.vy = Math.sin(game.aimAngle) * speed;
    game.phase = "rolling";
    game.shots++;
    game.combo = 0;
    game.bumperHits = 0;
    game.shotStart = { x: b.x, y: b.y };
    b.mood = "roll";
    b.squashX = 1.25; b.squashY = 0.75;
    AudioSys.play("shoot", game.aimPower);
    Particles.dust(b.x, b.y, -Math.cos(game.aimAngle), -Math.sin(game.aimAngle));
    showHint(false);
    game.idleT = 0;
  }

  /* ---------- 敵ポン！ ---------- */
  const POP_WORDS = ["ポン！", "コンボ！", "すごーい！", "やるね！", "さいこう！"];
  function popEnemy(e, idx) {
    e.alive = false;
    game.combo++;
    const word = POP_WORDS[clamp(game.combo - 1, 0, POP_WORDS.length - 1)];
    AudioSys.play("pop", game.combo);
    Particles.starBurst(e.x, e.y, 8 + game.combo * 2);
    Particles.popRing(e.x, e.y, hsl(e.hue, 90, 70));
    Particles.floatText(e.x, e.y - 0.5, word, "#ffe36e", 1 + game.combo * 0.12);
    game.shake = Math.min(0.5, 0.22 + game.combo * 0.05);
    markEnemyHud(idx);

    if (game.level.enemies.every((en) => !en.alive)) {
      /* ぜんぶポン！ → ゴールとうじょう */
      setTimeout(() => {
        if (game.state !== "play") return;
        game.goalActive = true;
        game.goalAnim = 0;
        AudioSys.play("goalAppear");
        Particles.confettiBurst(game.level.goal.x, game.level.goal.y, 18);
        Particles.floatText(game.level.goal.x, game.level.goal.y - 1, "ゴールが でたよ！", "#fff", 1.1, 1.6);
      }, 350);
    }
  }

  /* ---------- クリア ---------- */
  function ratingFor() {
    const par = game.level.par;
    if (game.shots <= par) return 3;
    if (game.shots <= par + 2) return 2;
    return 1;
  }

  function onGoalIn() {
    game.phase = "goal";
    game.goalT = 0;
    game.aiming = false;
    AudioSys.play("goalIn");
  }

  function showClear() {
    game.state = "clear";
    game.clearFxT = 0;
    game.ballHidden = true;
    const stars = ratingFor();
    save.stars[game.levelIndex] = Math.max(save.stars[game.levelIndex] || 0, stars);
    const isNewUnlock = game.levelIndex === save.unlocked && game.levelIndex < LEVELS.length - 1;
    if (isNewUnlock) save.unlocked = game.levelIndex + 1;
    persist();

    AudioSys.play("fanfare");
    Particles.confettiBurst(game.level.goal.x, game.level.goal.y - 1, 40);

    $("clear-title").textContent = pick(["クリア！", "やったー！", "できたね！"]);
    const msgs = { 3: "パーフェクト！ ⭐", 2: "すごいね！", 1: "クリアしたよ！" };
    let msg = msgs[stars];
    const totalFruits = game.level.fruits.length;
    if (totalFruits > 0) msg += `　🍎 ${game.fruitsGot}/${totalFruits}`;
    $("clear-msg").textContent = msg;

    const starEls = screens.clear.querySelectorAll(".clear-star");
    starEls.forEach((el) => { el.classList.remove("on", "pop"); });
    setVisible(screens.clear, true);
    starEls.forEach((el, i) => {
      if (i < stars) {
        setTimeout(() => {
          el.classList.add("on", "pop");
          AudioSys.play("star");
        }, 500 + i * 380);
      }
    });
    $("btn-next").style.display = game.levelIndex < LEVELS.length - 1 ? "" : "none";
  }

  /* ---------- ぶつり ---------- */
  function frictionAt(tx, ty) {
    const c = tileAt(game.level, tx, ty);
    return FRICTION[c] !== undefined ? FRICTION[c] : 4.2;
  }

  let bounceCd = 0, boostCd = 0;

  function stepPhysics(dt) {
    const b = game.ball;
    const lv = game.level;
    let speed = Math.hypot(b.vx, b.vy);
    if (speed <= 0) return;

    const steps = Math.max(1, Math.ceil((speed * dt) / 0.12));
    const sdt = dt / steps;

    for (let s = 0; s < steps; s++) {
      b.x += b.vx * sdt;
      b.y += b.vy * sdt;

      /* --- かべ（コースの外・しげみ） --- */
      const minX = Math.floor(b.x - BALL_R), maxX = Math.floor(b.x + BALL_R);
      const minY = Math.floor(b.y - BALL_R), maxY = Math.floor(b.y + BALL_R);
      for (let ty = minY; ty <= maxY; ty++) {
        for (let tx = minX; tx <= maxX; tx++) {
          if (!isSolidTile(tileAt(lv, tx, ty))) continue;
          const nx = clamp(b.x, tx, tx + 1);
          const ny = clamp(b.y, ty, ty + 1);
          let dx = b.x - nx, dy = b.y - ny;
          let d2 = dx * dx + dy * dy;
          if (d2 >= BALL_R * BALL_R) continue;
          let d = Math.sqrt(d2);
          if (d < 0.0001) { dx = 0; dy = -1; d = 1; }
          const ux = dx / d, uy = dy / d;
          b.x = nx + ux * BALL_R;
          b.y = ny + uy * BALL_R;
          const vn = b.vx * ux + b.vy * uy;
          if (vn < 0) {
            b.vx -= (1 + WALL_REST) * vn * ux;
            b.vy -= (1 + WALL_REST) * vn * uy;
            const impact = -vn;
            if (impact > 1.2 && bounceCd <= 0) {
              AudioSys.play("bounce", impact / MAX_SPEED);
              bounceCd = 0.08;
              b.squashX = 1 + clamp(impact / MAX_SPEED, 0, 0.5) * 0.7;
              b.squashY = 2 - b.squashX;
              Particles.dust(nx, ny, ux, uy);
              if (impact > 8) { game.shake = Math.max(game.shake, 0.3); b.mood = "dizzy"; }
            }
          }
        }
      }

      /* --- バンパーきのこ --- */
      for (const bp of lv.bumpers) {
        const dx = b.x - bp.x, dy = b.y - bp.y;
        const rr = BALL_R + 0.36;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const ux = dx / d, uy = dy / d;
        b.x = bp.x + ux * rr;
        b.y = bp.y + uy * rr;
        const sp = Math.hypot(b.vx, b.vy);
        /* 何度も連続で当たっているときは弱めて、永遠に跳ね続けないように */
        game.bumperHits++;
        const out = game.bumperHits > 6
          ? sp * 0.8
          : clamp(Math.max(sp * 1.06, 9.5), 0, 22);
        b.vx = ux * out; b.vy = uy * out;
        bp.squish = 1;
        AudioSys.play("boing");
        Particles.burst(bp.x + ux * 0.4, bp.y + uy * 0.4, "#ffdf7e", 8, 4, 0.09);
        Particles.floatText(bp.x, bp.y - 0.8, "ぽよん！", "#ffb3c8", 0.9);
        game.shake = Math.max(game.shake, 0.25);
        b.squashX = 1.3; b.squashY = 0.7;
        b.mood = "wow";
      }

      /* --- てき --- */
      lv.enemies.forEach((e, i) => {
        if (!e.alive) return;
        const rr = BALL_R + 0.3;
        const dx = b.x - e.x, dy = b.y - e.y;
        if (dx * dx + dy * dy < rr * rr) {
          popEnemy(e, i);
          b.vx *= 0.82; b.vy *= 0.82;
        }
      });

      /* --- フルーツ --- */
      for (const f of lv.fruits) {
        if (f.taken) continue;
        const dx = b.x - f.x, dy = b.y - f.y;
        if (dx * dx + dy * dy < 0.45 * 0.45) {
          f.taken = true;
          game.fruitsGot++;
          AudioSys.play("star");
          Particles.starBurst(f.x, f.y, 6);
          Particles.hearts(f.x, f.y - 0.2, 3);
          Particles.floatText(f.x, f.y - 0.5, "おいしい！", "#ffd6e8", 0.85);
        }
      }

      /* --- ゴール --- */
      if (game.goalActive) {
        const gx = lv.goal.x, gy = lv.goal.y;
        const gd = dist(b.x, b.y, gx, gy);
        if (gd < 1.15) {
          /* すいこまれる */
          const pull = 9 * sdt / Math.max(gd, 0.2);
          b.vx += (gx - b.x) * pull;
          b.vy += (gy - b.y) * pull;
        }
        if (gd < 0.5) { onGoalIn(); return; }
      }

      /* --- みず --- */
      if (tileAt(lv, Math.floor(b.x), Math.floor(b.y)) === "w") {
        game.phase = "sinking";
        game.sinkT = 0;
        b.mood = "sad";
        AudioSys.play("splash");
        Particles.splash(b.x, b.y);
        game.shake = Math.max(game.shake, 0.2);
        return;
      }
    }

    /* --- ブーストやじるし --- */
    const tileC = tileAt(lv, Math.floor(b.x), Math.floor(b.y));
    const boostDir = { ">": [1, 0], "<": [-1, 0], "^": [0, -1], "v": [0, 1] }[tileC];
    if (boostDir) {
      b.vx += boostDir[0] * 30 * dt;
      b.vy += boostDir[1] * 30 * dt;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 23) { b.vx *= 23 / sp; b.vy *= 23 / sp; }
      if (boostCd <= 0) { AudioSys.play("boost"); boostCd = 0.5; }
      Particles.trail(b.x, b.y, 52);
      b.mood = "wow";
    }

    /* --- まさつ --- */
    speed = Math.hypot(b.vx, b.vy);
    if (speed > 0) {
      const dec = frictionAt(Math.floor(b.x), Math.floor(b.y)) * dt;
      const ns = Math.max(0, speed - dec);
      if (ns <= 0.42 && !boostDir) {
        b.vx = 0; b.vy = 0;
        endShot();
      } else {
        b.vx *= ns / speed;
        b.vy *= ns / speed;
      }
    }
  }

  function endShot() {
    game.phase = "aim";
    game.combo = 0;
    const b = game.ball;
    b.mood = "happy";
    game.idleT = 0;
    /* ゴールのすぐそばで止まったら、ころんと吸い込む */
  }

  /* ---------- 毎フレーム更新 ---------- */
  function update(dt) {
    bounceCd -= dt; boostCd -= dt;
    game.shake = Math.max(0, game.shake - dt * 1.6);
    if (game.goalActive) game.goalAnim = Math.min(1, game.goalAnim + dt * 2.4);
    for (const bp of (game.level ? game.level.bumpers : [])) {
      bp.squish = Math.max(0, bp.squish - dt * 5);
    }

    const b = game.ball;

    /* まばたき */
    b.blinkT -= dt;
    b.nextBlink -= dt;
    if (b.nextBlink <= 0) { b.blinkT = 0.13; b.nextBlink = randRange(1.8, 4.5); }

    /* ぷにぷに（スケールばね） */
    b.squashX += (1 - b.squashX) * Math.min(1, dt * 8);
    b.squashY += (1 - b.squashY) * Math.min(1, dt * 8);

    if (game.state !== "play" && game.state !== "clear") {
      Particles.update(dt);
      return;
    }

    /* てきのゆらゆら */
    for (const e of game.level.enemies) {
      if (!e.alive) continue;
      const t = performance.now() / 1000;
      e.x = e.baseX + Math.sin(t * 0.9 + e.phase) * 0.16;
      e.y = e.baseY + Math.cos(t * 0.7 + e.phase * 1.3) * 0.1;
      e.wobble = Math.max(0, e.wobble - dt * 4);
    }

    if (game.state === "clear") {
      game.clearFxT -= dt;
      if (game.clearFxT <= 0) {
        game.clearFxT = 0.55;
        Particles.firework(
          randRange(1, game.level.w - 1),
          randRange(0.5, game.level.h * 0.45)
        );
      }
      Particles.update(dt);
      return;
    }

    switch (game.phase) {
      case "aim": {
        game.idleT += dt;
        if (game.idleT > 8) { showHint(true); game.idleT = 0; }
        /* アイドル時のぷかぷか */
        b.scale = 1 + Math.sin(performance.now() / 400) * 0.025;
        if (game.aiming) {
          b.mood = "aim";
          b.lookX = Math.cos(game.aimAngle);
          b.lookY = Math.sin(game.aimAngle);
        } else if (b.mood === "aim") {
          b.mood = "happy";
          b.lookX = 0; b.lookY = 0;
        }
        /* 止まったところがゴールのそばなら吸い込み */
        if (game.goalActive) {
          const gd = dist(b.x, b.y, game.level.goal.x, game.level.goal.y);
          if (gd < 1.0) {
            b.vx = (game.level.goal.x - b.x) * 3;
            b.vy = (game.level.goal.y - b.y) * 3;
            game.phase = "rolling";
          }
        }
        break;
      }

      case "rolling": {
        stepPhysics(dt);
        const sp = Math.hypot(b.vx, b.vy);
        b.roll += (sp / BALL_R) * dt * 0.35;
        b.lookX = sp > 0.5 ? b.vx / Math.max(sp, 0.01) : 0;
        b.lookY = sp > 0.5 ? b.vy / Math.max(sp, 0.01) : 0;
        if (b.mood !== "dizzy" && b.mood !== "wow") b.mood = sp > 12 ? "wow" : "roll";
        /* にじいろのしっぽ */
        if (sp > 10) Particles.trail(b.x, b.y, (performance.now() / 4) % 360);
        else if (sp > 3 && Math.random() < 0.3) {
          const c = tileAt(game.level, Math.floor(b.x), Math.floor(b.y));
          if (c === "s") Particles.dust(b.x, b.y + 0.2, -b.lookX, 0);
        }
        break;
      }

      case "sinking": {
        game.sinkT += dt;
        b.scale = Math.max(0, 1 - game.sinkT * 1.6);
        b.vx = 0; b.vy = 0;
        if (game.sinkT > 0.95) {
          /* もどってくる */
          b.x = game.shotStart.x; b.y = game.shotStart.y;
          b.scale = 1;
          b.mood = "happy";
          b.squashX = 1.3; b.squashY = 0.7;
          game.phase = "aim";
          game.idleT = 0;
          AudioSys.play("bubble");
          Particles.popRing(b.x, b.y, "#bfe6ff");
          Particles.floatText(b.x, b.y - 0.7, "もういっかい！", "#dff3ff", 0.9);
        }
        break;
      }

      case "goal": {
        game.goalT += dt;
        const t = Math.min(1, game.goalT / 0.9);
        const g = game.level.goal;
        /* くるくるまわりながら すいこまれる */
        const ang = t * 9;
        const rad = (1 - t) * 0.8;
        b.x = g.x + Math.cos(ang) * rad;
        b.y = g.y + Math.sin(ang) * rad * 0.6;
        b.scale = 1 - t * 0.85;
        b.roll += dt * 14;
        b.mood = "joy";
        if (t >= 1) showClear();
        break;
      }
    }

    Particles.update(dt);
  }

  /* ---------- 入力 ---------- */
  let pointerId = null;
  let aimStartX = 0, aimStartY = 0;

  function onDown(e) {
    AudioSys.ensure();
    if (game.state !== "play") return;
    if (pointerId !== null) return;
    if (game.phase === "aim") {
      pointerId = e.pointerId;
      aimStartX = e.clientX; aimStartY = e.clientY;
      game.aiming = true;
      game.aimPower = 0;
      showHint(false);
    } else if (game.phase === "rolling") {
      /* ころがってるあいだのタップはキラキラ */
      const w = Renderer.toWorld(e.clientX, e.clientY);
      Particles.starBurst(w.x, w.y, 4);
      AudioSys.play("tap");
    }
  }

  function onMove(e) {
    if (e.pointerId !== pointerId || !game.aiming) return;
    const dx = aimStartX - e.clientX;
    const dy = aimStartY - e.clientY;
    const len = Math.hypot(dx, dy);
    const maxLen = Math.min(Renderer.width, Renderer.height) * 0.3;
    game.aimPower = clamp(len / maxLen, 0, 1);
    if (len > 4) game.aimAngle = Math.atan2(dy, dx);
  }

  function onUp(e) {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    if (!game.aiming) return;
    game.aiming = false;
    if (game.aimPower > 0.07) {
      shoot();
    } else {
      game.aimPower = 0;
      game.ball.mood = "happy";
    }
  }

  /* ---------- UIボタン ---------- */
  function updateSoundIcons() {
    const icon = AudioSys.enabled ? "🔊" : "🔇";
    $("btn-sound").textContent = icon;
    $("btn-map-sound").textContent = icon;
  }

  function toggleSound() {
    AudioSys.setEnabled(!AudioSys.enabled);
    updateSoundIcons();
    if (AudioSys.enabled) { AudioSys.ensure(); AudioSys.play("tap"); AudioSys.startBgm(); }
  }

  function bindUI() {
    $("btn-start").addEventListener("click", () => {
      AudioSys.ensure();
      AudioSys.play("tap");
      AudioSys.startBgm();
      goMap();
    });

    $("title-char").addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      AudioSys.ensure();
      AudioSys.play("giggle");
      const el = $("title-char");
      el.classList.remove("jump");
      void el.offsetWidth; /* アニメをリスタート */
      el.classList.add("jump");
    });

    $("btn-home").addEventListener("click", () => { AudioSys.play("tap"); goMap(); });
    $("btn-retry").addEventListener("click", () => { AudioSys.play("tap"); startLevel(game.levelIndex); });
    $("btn-sound").addEventListener("click", toggleSound);
    $("btn-map-sound").addEventListener("click", toggleSound);
    $("btn-map-title").addEventListener("click", () => { AudioSys.play("tap"); goTitle(); });

    $("btn-again").addEventListener("click", () => { AudioSys.play("tap"); startLevel(game.levelIndex); });
    $("btn-next").addEventListener("click", () => {
      AudioSys.play("unlock");
      if (game.levelIndex < LEVELS.length - 1) startLevel(game.levelIndex + 1);
      else goMap();
    });
    $("btn-clear-map").addEventListener("click", () => { AudioSys.play("tap"); goMap(); });

    const canvas = $("game");
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    canvas.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });

    updateSoundIcons();
  }

  function init() {
    bindUI();
    goTitle();
  }

  return Object.assign(game, { init, update, startLevel, goMap, goTitle });
})();
