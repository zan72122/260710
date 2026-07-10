/* ============================================================
   main.js — 起動
   ============================================================ */
"use strict";

window.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("gameCanvas");
  GAME.boot(canvas);
  UI.init();

  // タブが隠れたらBGM停止、もどったら再開
  let bgmBefore = null;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      bgmBefore = SND._bgmName;
      SND.stopBgm();
    } else if (bgmBefore && SND.ctx) {
      SND.playBgm(bgmBefore);
    }
  });

  // iOSのダブルタップ拡大・長押しメニューをふせぐ
  document.addEventListener("dblclick", e => e.preventDefault());
  document.addEventListener("contextmenu", e => e.preventDefault());
  document.addEventListener("gesturestart", e => e.preventDefault());
});
