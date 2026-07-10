/* ============================================================
   ui.js — 文字なし・アイコンだけのUI
   タイトル / ステージえらび / クローゼット / HUD / クリア
   ============================================================ */
"use strict";

const UI = {
  wallet: 0,
  bestStars: {},        // {stageIndex: 1..3}
  clearedIsland: -1,

  el(id) { return document.getElementById(id); },

  init() {
    this.wallet = U.store.get("ccg_wallet", 0);
    this.bestStars = U.store.get("ccg_bestStars", {});

    /* ---- 画面遷移ボタン ---- */
    this.el("btnPlay").addEventListener("click", () => { this._click(); this.show("stageSelect"); });
    this.el("btnCloset").addEventListener("click", () => { this._click(); this.buildCloset(); this.show("closet"); });
    document.querySelectorAll(".backBtn").forEach(b =>
      b.addEventListener("click", () => { this._click(); this.show("title"); }));

    this.el("btnHome").addEventListener("click", () => { this._click(); this.toMenu(); });
    this.el("btnClearHome").addEventListener("click", () => { this._click(); this.toMenu(); });
    this.el("btnReplay").addEventListener("click", () => {
      this._click();
      this.el("clear").classList.add("hidden");
      GAME.startStage(GAME.levelIndex);
    });
    this.el("btnNext").addEventListener("click", () => {
      this._click();
      this.el("clear").classList.add("hidden");
      const next = GAME.levelIndex + 1;
      if (next < LEVELS.length) GAME.startStage(next);
      else { this.toMenu(); this.show("stageSelect"); }
    });

    /* ---- ミュート ---- */
    const syncMute = () => {
      const icon = SND.muted ? "🔇" : "🔊";
      this.el("btnMute").textContent = icon;
      this.el("btnMute2").textContent = icon;
    };
    const toggle = () => { SND.init(); SND.toggleMute(); syncMute(); };
    this.el("btnMute").addEventListener("click", toggle);
    this.el("btnMute2").addEventListener("click", toggle);

    /* ---- 最初のタッチで音を起こす ---- */
    const wake = () => {
      SND.init(); SND.resume(); syncMute();
      if (!this.el("title").classList.contains("hidden")) SND.playBgm("menu");
      window.removeEventListener("pointerdown", wake);
    };
    window.addEventListener("pointerdown", wake);

    this.buildStageSelect();
    this.updateWallet();
    this.show("title");
  },

  _click() { SND.init(); SND.resume(); SND.click(); },

  /* ---------- 画面の切りかえ ---------- */
  show(id) {
    ["title", "stageSelect", "closet", "hud", "clear"].forEach(s =>
      this.el(s).classList.toggle("hidden", s !== id));
    if (id === "title" || id === "stageSelect" || id === "closet") {
      if (SND.ctx) SND.playBgm("menu");
    }
    if (id === "stageSelect") this.buildStageSelect(); // 星の表示を更新
  },

  toMenu() {
    GAME.stopToMenu();
    this.hideHint();
    this.el("clear").classList.add("hidden");
    this.show("title");
    this.updateWallet();
  },

  enterGame(lv) {
    this.show("hud");
    this.el("comboRow").textContent = "";
    this.abilityEnd();
    this.showHint(); // 「ひっぱってね」の指マーク。さわったら消える
  },

  /* ---------- ステージえらび ---------- */
  buildStageSelect() {
    const grid = this.el("selGrid");
    grid.innerHTML = "";
    LEVELS.forEach((mk, i) => {
      const lv = mk();
      const tile = document.createElement("button");
      tile.className = "selTile" + (lv.boss ? " boss" : "");
      const stars = this.bestStars[i] || 0;
      tile.innerHTML = `<span>${lv.icon}</span><span class="stars">` +
        [1, 2, 3].map(n => `<span class="${n <= stars ? "" : "dim"}">⭐</span>`).join("") + "</span>";
      tile.addEventListener("click", () => { this._click(); GAME.startStage(i); });
      grid.appendChild(tile);
    });
    // エンドレス
    const endless = document.createElement("button");
    endless.className = "selTile endless";
    const best = U.store.get("ccg_bestIsland", 0);
    endless.innerHTML = `<span>♾️</span><span class="stars">${best > 0 ? "🏝️×" + best : "🏝️"}</span>`;
    endless.addEventListener("click", () => { this._click(); GAME.startEndless(); });
    grid.appendChild(endless);
  },

  /* ---------- クローゼット(ボールのきせかえ) ---------- */
  buildCloset() {
    const grid = this.el("skinGrid");
    grid.innerHTML = "";
    SKINS.forEach(skin => {
      const unlocked = this.wallet >= skin.cost;
      const tile = document.createElement("button");
      tile.className = "skinTile" + (unlocked ? "" : " locked") +
        (GAME.currentSkin === skin.id ? " selected" : "");
      tile.innerHTML = `<span>${skin.emoji}</span>` +
        (unlocked ? "" : `<span class="cost">🔒⭐${skin.cost}</span>`);
      tile.addEventListener("click", () => {
        if (!unlocked) { SND.init(); SND.bump(); return; }
        this._click(); SND.sparkle();
        GAME.setSkin(skin.id);
        this.buildCloset();
      });
      grid.appendChild(tile);
    });
    this.el("closetStars").textContent = "⭐ " + this.wallet;
  },

  updateWallet() {
    this.el("titleTotalStars").textContent = "⭐ " + this.wallet;
  },

  addWalletStar(n) {
    this.wallet += n;
    U.store.set("ccg_wallet", this.wallet);
  },

  /* ---------- HUD ---------- */
  onShot(shots, par) {
    const el = this.el("shotDots");
    let s = "";
    for (let i = 0; i < Math.max(par, Math.min(shots, 9)); i++) s += i < shots ? "🟡" : "⚪";
    if (shots > 9) s += "…";
    el.textContent = s;
  },

  onTargetsChanged(left, total) {
    this.el("targetCount").textContent = "🎯 " + left;
  },

  showCombo(n) {
    const el = this.el("comboRow");
    if (n < 2) { el.textContent = ""; return; }
    el.innerHTML = "";
    const show = Math.min(n, 6);
    for (let i = 0; i < show; i++) {
      const sp = document.createElement("span");
      sp.textContent = "⭐";
      sp.style.animationDelay = (i * 0.04) + "s";
      el.appendChild(sp);
    }
    if (n > 6) {
      const sp = document.createElement("span");
      sp.textContent = "🌟";
      el.appendChild(sp);
    }
  },

  abilityStart(kind, dur) {
    const b = this.el("abilityBubble");
    b.classList.remove("hidden");
    this.el("abilityIcon").textContent = ABILITIES[kind].emoji;
    this.el("abilityRing").style.stroke = ABILITIES[kind].color;
    this.abilityTick(1);
  },
  abilityTick(frac) {
    this.el("abilityRing").style.strokeDashoffset = String(119.4 * (1 - U.clamp(frac, 0, 1)));
  },
  abilityEnd() {
    this.el("abilityBubble").classList.add("hidden");
  },

  splash(emoji) {
    const el = this.el("bigSplash");
    el.classList.remove("hidden");
    el.textContent = emoji;
    // アニメを最初から
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
    clearTimeout(this._splashT);
    this._splashT = setTimeout(() => el.classList.add("hidden"), 950);
  },

  showHint() {
    this.el("hintHand").classList.remove("hidden");
  },
  hideHint() {
    this.el("hintHand").classList.add("hidden");
  },

  /* ---------- クリア画面 ---------- */
  showClear(levelIndex, stars) {
    const prev = this.bestStars[levelIndex] || 0;
    if (stars > prev) {
      this.bestStars[levelIndex] = stars;
      U.store.set("ccg_bestStars", this.bestStars);
    }
    this.addWalletStar(stars * 2);
    this.updateWallet();

    const isBoss = LEVELS[levelIndex]().boss;
    this.el("clearEmoji").textContent = isBoss ? "🏆" : U.pick(["🎉", "🥳", "🎊"]);
    const spans = this.el("clearStars").querySelectorAll("span");
    spans.forEach(s => s.classList.remove("on"));
    this.el("clear").classList.remove("hidden");
    for (let i = 0; i < stars; i++) {
      setTimeout(() => {
        spans[i].classList.add("on");
        SND.starDing(i);
      }, 500 + i * 480);
    }
  },

  /* ---------- エンドレス ---------- */
  onIslandCleared(islandIndex) {
    const reached = islandIndex + 1;
    U.store.set("ccg_islandReached", reached);
    const best = U.store.get("ccg_bestIsland", 0);
    if (reached > best) U.store.set("ccg_bestIsland", reached);
  },

  showIslandBanner() {
    const el = this.el("islandBanner");
    el.classList.remove("hidden");
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => el.classList.add("hidden"), 1650);
  },
};

// game.js からの `window.UI` ガード参照用(トップレベルconstはwindowに載らないため明示的に公開)
window.UI = UI;
