/* ============================================================
   UI — 画面(タイトル/レベルせんたく/HUD/クリア)と進捗保存
   ============================================================ */
const UI = {
  els: {},
  progress: { stars: [] },   // レベルごとのベスト星数(-1=未クリア)
  soundOn: true,

  init() {
    const $ = (id) => document.getElementById(id);
    this.els = {
      title: $('title-screen'),
      select: $('level-select'),
      grid: $('level-grid'),
      hud: $('hud'),
      win: $('win-overlay'),
      strokeNum: $('stroke-num'),
      hudStars: Array.from(document.querySelectorAll('.hud-star')),
      winStars: Array.from(document.querySelectorAll('.win-star')),
      winStrokes: document.querySelector('.win-strokes'),
      toast: $('level-toast'),
      hint: $('hint'),
    };

    this.load();

    $('btn-play').addEventListener('click', () => { this.tap(); this.showSelect(); });
    $('btn-select-home').addEventListener('click', () => { this.tap(); this.showTitle(); });
    $('btn-home').addEventListener('click', () => { this.tap(); Main.quitToSelect(); });
    $('btn-retry').addEventListener('click', () => { this.tap(); Main.restartLevel(); });
    $('btn-win-retry').addEventListener('click', () => { this.tap(); this.hideWin(); Main.restartLevel(); });
    $('btn-win-home').addEventListener('click', () => { this.tap(); this.hideWin(); Main.quitToSelect(); });
    $('btn-win-next').addEventListener('click', () => { this.tap(); this.hideWin(); Main.nextLevel(); });

    const bindSound = (id) => {
      const btn = $(id);
      if (!btn) return;
      btn.addEventListener('click', () => {
        AudioMan.unlock();
        this.soundOn = !this.soundOn;
        AudioMan.setEnabled(this.soundOn);
        this.updateSoundButtons();
        this.save();
      });
    };
    bindSound('btn-sound-title');
    bindSound('btn-sound-select');
    this.updateSoundButtons();
  },

  tap() { AudioMan.unlock(); AudioMan.tap(); },

  updateSoundButtons() {
    for (const id of ['btn-sound-title', 'btn-sound-select']) {
      const btn = document.getElementById(id);
      if (btn) btn.textContent = this.soundOn ? '🔊' : '🔇';
    }
  },

  /* ---------------- 進捗 ---------------- */
  load() {
    try {
      const d = JSON.parse(localStorage.getItem('ppd_progress') || '{}');
      if (Array.isArray(d.stars)) this.progress.stars = d.stars;
      if (d.soundOn === false) { this.soundOn = false; AudioMan.enabled = false; }
    } catch (e) { /* こわれていたら初期化 */ }
  },

  save() {
    try {
      localStorage.setItem('ppd_progress', JSON.stringify({
        stars: this.progress.stars,
        soundOn: this.soundOn,
      }));
    } catch (e) { /* プライベートモードなどは無視 */ }
  },

  isCleared(i) { return this.progress.stars[i] !== undefined && this.progress.stars[i] !== null && this.progress.stars[i] >= 0; },
  isUnlocked(i) { return i === 0 || this.isCleared(i - 1); },

  recordClear(i, stars) {
    const prev = this.progress.stars[i];
    if (prev === undefined || prev === null || stars > prev) this.progress.stars[i] = stars;
    this.save();
  },

  /* ---------------- 画面切りかえ ---------------- */
  showTitle() {
    this.els.title.classList.remove('hidden');
    this.els.select.classList.add('hidden');
    this.els.hud.classList.add('hidden');
    this.els.win.classList.add('hidden');
    Main.state = 'title';
    Main.startDemo();
  },

  showSelect() {
    this.buildGrid();
    this.els.title.classList.add('hidden');
    this.els.select.classList.remove('hidden');
    this.els.hud.classList.add('hidden');
    this.els.win.classList.add('hidden');
    Main.state = 'select';
    Main.startDemo();
  },

  buildGrid() {
    const grid = this.els.grid;
    grid.innerHTML = '';
    LEVELS.forEach((lv, i) => {
      const card = document.createElement('button');
      card.className = 'level-card';
      const unlocked = this.isUnlocked(i);
      if (!unlocked) {
        card.classList.add('locked');
        card.innerHTML = `<div class="lv-lock">🔒</div>`;
      } else {
        const got = this.progress.stars[i];
        const starsHtml = [0, 1, 2].map(k =>
          `<span class="${(got !== undefined && got !== null && got > k) ? 'on' : 'off'}">★</span>`).join('');
        card.innerHTML = `
          <div class="lv-num">${i + 1}</div>
          <div class="lv-name">${lv.name}</div>
          <div class="lv-stars">${starsHtml}</div>`;
        card.addEventListener('click', () => { this.tap(); Main.startLevel(i); });
      }
      grid.appendChild(card);
    });
  },

  showPlay(level) {
    this.els.title.classList.add('hidden');
    this.els.select.classList.add('hidden');
    this.els.win.classList.add('hidden');
    this.els.hud.classList.remove('hidden');
    this.updateHUD(level);

    // レベル名トースト
    const toast = this.els.toast;
    toast.textContent = `${level.index + 1}. ${level.name}`;
    toast.classList.remove('hidden');
    toast.style.animation = 'none';
    void toast.offsetWidth; // アニメ再スタート
    toast.style.animation = '';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.add('hidden'), 2500);

    // さいしょのレベルだけ操作ヒント
    if (level.index === 0 && !this.isCleared(0)) {
      this.els.hint.classList.remove('hidden');
    } else {
      this.els.hint.classList.add('hidden');
    }
  },

  onShot() { this.els.hint.classList.add('hidden'); },

  updateHUD(level) {
    this.els.strokeNum.textContent = level.strokes;
    this.els.hudStars.forEach((el, i) => {
      el.classList.toggle('on', i < level.collected);
    });
  },

  /* ---------------- クリア画面 ---------------- */
  showWin(level) {
    const stars = level.collected;
    this.recordClear(level.index, stars);
    this.els.hint.classList.add('hidden');

    this.els.winStrokes.textContent =
      `⛳ ${level.strokes}かい で ゴール！`;

    this.els.winStars.forEach((el) => {
      el.classList.remove('on', 'pop');
    });
    this.els.win.classList.remove('hidden');

    // 星がひとつずつポンッと出る
    this.els.winStars.forEach((el, i) => {
      if (i < stars) {
        setTimeout(() => {
          el.classList.add('on', 'pop');
          AudioMan.pickup(i);
        }, 450 + i * 380);
      }
    });

    // つぎのレベルがなければ「つぎへ」を隠す
    const nextBtn = document.getElementById('btn-win-next');
    nextBtn.style.display = level.index + 1 < LEVELS.length ? '' : 'none';
  },

  hideWin() { this.els.win.classList.add('hidden'); },
};
