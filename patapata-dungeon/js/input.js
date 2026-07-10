/* ============================================================
   Input — どこをさわってもOKのスリングショット操作
   ひっぱって、はなすと反対方向へ飛ぶ(4歳児むけ:超かんたん)
   ============================================================ */
const Input = {
  aiming: false,
  pointerId: null,
  sx: 0, sy: 0,   // 押した場所(スクリーン)
  cx: 0, cy: 0,   // いまの場所

  init(canvas) {
    canvas.addEventListener('pointerdown', (e) => this.down(e), { passive: false });
    window.addEventListener('pointermove', (e) => this.move(e), { passive: false });
    window.addEventListener('pointerup', (e) => this.up(e), { passive: false });
    window.addEventListener('pointercancel', (e) => this.cancel(e), { passive: false });
    // iOSのダブルタップズーム・ピンチを防ぐ
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  },

  down(e) {
    AudioMan.unlock();
    if (Main.state !== 'play' || !Main.level) return;
    if (this.pointerId !== null) return;
    if (!Main.level.canShoot()) return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    this.aiming = true;
    this.sx = this.cx = e.clientX;
    this.sy = this.cy = e.clientY;
  },

  move(e) {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();
    this.cx = e.clientX;
    this.cy = e.clientY;
  },

  up(e) {
    if (e.pointerId !== this.pointerId) return;
    this.cx = e.clientX;
    this.cy = e.clientY;
    const aim = this.getAim();
    this.aiming = false;
    this.pointerId = null;
    if (!Main.level || Main.state !== 'play') return;
    if (aim && aim.power > 1.1) {
      Main.level.shoot(aim.dirX, aim.dirY, aim.power);
      UI.onShot();
    }
  },

  cancel(e) {
    if (e.pointerId !== this.pointerId) return;
    this.aiming = false;
    this.pointerId = null;
  },

  /* ひっぱりベクトル→発射方向とパワー(ワールド単位) */
  getAim() {
    if (!this.aiming) return null;
    const s = Renderer.view.scale;
    const dx = (this.cx - this.sx) / s;   // ひっぱった向き
    const dy = (this.cy - this.sy) / s;
    const len = Math.hypot(dx, dy);
    if (len < 0.01) return { dirX: 0, dirY: 0, power: 0, pullLen: 0 };
    const power = Math.min(len * PHYS.PULL_GAIN, PHYS.MAX_POWER);
    return {
      dirX: -dx / len,
      dirY: -dy / len,
      power,
      pullLen: Math.min(len, 2.2),
    };
  },
};
