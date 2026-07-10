/* ================================================================
   main.js — 起動とメインループ
   ================================================================ */
"use strict";

(function () {
  const canvas = document.getElementById("game");

  Renderer.init(canvas);
  Game.init();

  function onResize() {
    Renderer.resize();
    if (Game.level) Renderer.computeView(Game.level);
  }
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", () => setTimeout(onResize, 60));
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", onResize);
  }

  /* iOSでのダブルタップズームなどを止める */
  document.addEventListener("gesturestart", (e) => e.preventDefault());
  document.addEventListener("dblclick", (e) => e.preventDefault());

  let last = performance.now();
  function loop(now) {
    /* タブ復帰などで dt が暴れないように上限を設ける */
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    Game.update(dt);
    Renderer.drawFrame(Game, dt);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
