/* ============================================================
   Main — 起動・メインループ・画面ステート
   ============================================================ */
const Main = {
  state: 'title',   // title | select | play
  level: null,      // プレイ中のレベル
  demo: null,       // タイトル裏でうごくデモレベル
  lastT: 0,

  init() {
    const canvas = document.getElementById('game');
    Renderer.init(canvas);
    Input.init(canvas);
    UI.init();

    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.onResize(), 250);
    });
    // iOSのビューポート変化(アドレスバー等)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => this.onResize());
    }

    UI.showTitle();
    requestAnimationFrame((t) => this.frame(t));
  },

  onResize() {
    Renderer.resize();
    const lv = this.activeLevel();
    if (lv) Renderer.fitView(lv);
  },

  activeLevel() { return this.state === 'play' ? this.level : this.demo; },

  /* ---------------- デモ(タイトル背景) ---------------- */
  startDemo() {
    // タイトル/セレクトの後ろでレベル3がのんびり動く
    if (!this.demo) {
      this.demo = new Level(LEVELS[2], 2);
      this.demo.isDemo = true;
    }
    Renderer.setLevel(this.demo);
    Renderer.fitView(this.demo);
  },

  /* ---------------- レベル操作 ---------------- */
  startLevel(i) {
    this.level = new Level(LEVELS[i], i);
    this.state = 'play';
    Particles.clear();
    Renderer.setLevel(this.level);
    UI.showPlay(this.level);
  },

  restartLevel() {
    if (this.level) this.startLevel(this.level.index);
  },

  nextLevel() {
    if (!this.level) return;
    const next = this.level.index + 1;
    if (next < LEVELS.length) this.startLevel(next);
    else this.quitToSelect();
  },

  quitToSelect() {
    this.level = null;
    Particles.clear();
    UI.showSelect();
  },

  /* ---------------- デモ用の自動ショット ---------------- */
  updateDemo(dt) {
    const d = this.demo;
    if (!d) return;
    d.update(dt);
    d.drainEvents();
    // 止まっていたら、たまにランダムに打つ
    this._demoTimer = (this._demoTimer || 0) - dt;
    if (d.canShoot() && this._demoTimer <= 0) {
      const a = Math.random() * Math.PI * 2;
      d.shoot(Math.cos(a), Math.sin(a), 5 + Math.random() * 7);
      d.strokes = 0; // デモなのでカウントしない
      this._demoTimer = 2.5 + Math.random() * 2.5;
    }
    // デモでカップインしたらそっとリセット
    if (d.state === 'won' || d.state === 'capturing') {
      if (d.stateT > 1.2) {
        this.demo = new Level(LEVELS[2], 2);
        this.demo.isDemo = true;
        Renderer.setLevel(this.demo);
      }
    }
  },

  /* ---------------- メインループ ---------------- */
  frame(tMs) {
    const t = tMs / 1000;
    let dt = t - (this.lastT || t);
    this.lastT = t;
    dt = Math.min(dt, 1 / 20); // タブ復帰などの巨大dtを防ぐ

    if (this.state === 'play' && this.level) {
      const lv = this.level;
      lv.update(dt);
      // イベント処理
      for (const ev of lv.drainEvents()) {
        switch (ev.name) {
          case 'star':
          case 'shot':
            UI.updateHUD(lv);
            break;
          case 'thud':
            Renderer.shake(Math.min(0.35, ev.data / 30));
            break;
          case 'bumper':
            Renderer.shake(0.22);
            break;
          case 'bonk':
            Renderer.shake(0.3);
            break;
          case 'unlock':
            Renderer.flashScreen();
            break;
          case 'capture':
            Renderer.flashScreen();
            break;
          case 'won':
            UI.updateHUD(lv);
            setTimeout(() => {
              if (this.state === 'play' && this.level === lv) UI.showWin(lv);
            }, 900);
            break;
        }
      }
    } else {
      this.updateDemo(dt);
    }

    Particles.update(dt);
    Renderer.frame(t, dt, this.activeLevel(), Input);

    requestAnimationFrame((t2) => this.frame(t2));
  },
};

window.addEventListener('DOMContentLoaded', () => Main.init());
