/* ============================================================
   game.js — コズミックキャンディゴルフ 本体
   Babylon.js シーン / 自作ころころ物理 / 8つの能力 /
   ターゲット全部あつめ → 最後の1つがゴールに変身 / ボス戦
   ============================================================ */
"use strict";

/* ---------- 能力の定義 ---------- */
const ABILITIES = {
  drill:   { emoji: "🔨", color: "#a1887f", dur: 6 },
  rocket:  { emoji: "🚀", color: "#ff7b7b", dur: 3 },
  tornado: { emoji: "🌪️", color: "#7fe3c3", dur: 5 },
  jumbo:   { emoji: "🍄", color: "#ffb457", dur: 8 },
  slow:    { emoji: "🐢", color: "#b79bff", dur: 5 },
  magnet:  { emoji: "🧲", color: "#ff9ecf", dur: 6 },
  bounce:  { emoji: "🏀", color: "#8ee08a", dur: 8 },
  rainbow: { emoji: "🌈", color: "#ffe066", dur: 8 },
};

/* ---------- ボールの模様(スキン) ---------- */
const SKINS = [
  { id: "classic", emoji: "🔴", cost: 0, paint: (c, s) => {
      c.fillStyle = "#ffffff"; c.fillRect(0, 0, s, s);
      c.fillStyle = "#ff5a5a"; c.fillRect(0, 0, s, s * 0.45);
      c.fillStyle = "#ffd93b"; starPath(c, s * 0.5, s * 0.62, s * 0.13); c.fill();
    } },
  { id: "soccer", emoji: "⚽", cost: 4, paint: (c, s) => {
      c.fillStyle = "#ffffff"; c.fillRect(0, 0, s, s);
      c.fillStyle = "#333";
      for (let i = 0; i < 8; i++) { c.beginPath(); c.arc((i % 4) * s / 4 + s / 8 + (i > 3 ? s / 8 : 0), i > 3 ? s * 0.66 : s * 0.33, s * 0.09, 0, 7); c.fill(); }
    } },
  { id: "ladybug", emoji: "🐞", cost: 8, paint: (c, s) => {
      c.fillStyle = "#ff5a5a"; c.fillRect(0, 0, s, s);
      c.fillStyle = "#222";
      for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(U.rand(s * 0.1, s * 0.9), U.rand(s * 0.15, s * 0.85), s * 0.07, 0, 7); c.fill(); }
    } },
  { id: "melon", emoji: "🍉", cost: 12, paint: (c, s) => {
      c.fillStyle = "#7ed957"; c.fillRect(0, 0, s, s);
      c.strokeStyle = "#3f9b3f"; c.lineWidth = s * 0.06;
      for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(i * s / 5, 0); c.bezierCurveTo(i * s / 5 + s * 0.08, s * 0.3, i * s / 5 - s * 0.08, s * 0.7, i * s / 5, s); c.stroke(); }
    } },
  { id: "paw", emoji: "🐾", cost: 16, paint: (c, s) => {
      c.fillStyle = "#ffd9ec"; c.fillRect(0, 0, s, s);
      c.fillStyle = "#ff8fbf";
      for (let i = 0; i < 5; i++) {
        const x = U.rand(s * 0.12, s * 0.88), y = U.rand(s * 0.12, s * 0.88), r = s * 0.055;
        c.beginPath(); c.arc(x, y + r, r * 1.5, 0, 7); c.fill();
        for (let j = 0; j < 3; j++) { c.beginPath(); c.arc(x + (j - 1) * r * 1.4, y - r * 0.9, r * 0.7, 0, 7); c.fill(); }
      }
    } },
  { id: "planet", emoji: "🪐", cost: 22, paint: (c, s) => {
      const bands = ["#ffd9a1", "#ffb457", "#ffe6c4", "#f0975a", "#ffd9a1", "#c97a3d"];
      bands.forEach((col, i) => { c.fillStyle = col; c.fillRect(0, i * s / 6, s, s / 6 + 1); });
    } },
  { id: "star", emoji: "🌟", cost: 28, paint: (c, s) => {
      c.fillStyle = "#3d3b8f"; c.fillRect(0, 0, s, s);
      c.fillStyle = "#ffe066";
      for (let i = 0; i < 9; i++) { starPath(c, U.rand(s * 0.08, s * 0.92), U.rand(s * 0.08, s * 0.92), s * 0.06); c.fill(); }
    } },
  { id: "rainbow", emoji: "🌈", cost: 36, paint: (c, s) => {
      const cols = ["#ff7b7b", "#ffb457", "#ffe066", "#8ee08a", "#7db8ff", "#b79bff"];
      cols.forEach((col, i) => { c.fillStyle = col; c.fillRect(0, i * s / 6, s, s / 6 + 1); });
    } },
];

function starPath(c, x, y, r) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    c[i === 0 ? "moveTo" : "lineTo"](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
}

/* ---------- 空のプリセット ---------- */
const SKIES = {
  morning: { top: "#7ec8ff", bottom: "#fff6d9", fog: "#cfeaff", stars: false },
  candy:   { top: "#ffb3dd", bottom: "#d3f2ff", fog: "#ffd9ec", stars: false },
  sky:     { top: "#6db9ff", bottom: "#e8fff2", fog: "#c9e8ff", stars: false },
  sunset:  { top: "#ff9e7d", bottom: "#ffe9f2", fog: "#ffd0b8", stars: false },
  space:   { top: "#4a3f8f", bottom: "#a8c4ff", fog: "#8d90d8", stars: true },
};

/* ============================================================ */
const GAME = {
  engine: null, scene: null, camera: null, glow: null,
  shadowGen: null, sun: null, hemi: null,
  mode: "none",            // none | play | clearing
  level: null, levelIndex: 0, isEndless: false, islandIndex: 0,
  courseRoot: null, skyDome: null, skyMat: null, decorRoot: null,

  ball: null,              // { mesh, face, faceTex, faceState, vel, r, baseR, skinTex }
  colliders: [],           // {mesh, he:Vector3, kind, e, breakable, bumper?, vel:Vector3, prevPos}
  bumpers: [], movers: [],
  targets: [],             // {mesh, face?, kind, x,y,z, alive, bobT, respawn}
  goal: null,              // {root, pos, r, active}
  boss: null,

  shots: 0, combo: 0, comboTimer: 0,
  ability: null,           // {kind, t, dur}
  timeScale: 1,
  dragging: false, dragStart: null, dragVec: { x: 0, y: 0 }, power: 0,
  aimArrow: null, aimDots: [],
  lastSafe: null, restTimer: 0, idleTimer: 0, sleeping: false,
  shakeT: 0, shakeAmp: 0,
  trailPS: null, sparklePS: null,
  camCenter: null, camSize: { w: 20, d: 30 },
  pendingEvents: [],
  fragments: [],           // こわれたブロックの破片
  projectiles: [],         // ボスの投げるやわらかボール
  _accum: 0, _faceBlink: 0,

  /* ============================================================
     起動
     ============================================================ */
  boot(canvas) {
    this.canvas = canvas;
    this.engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: false, stencil: false }, false);
    this.engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2));
    const scene = this.scene = new BABYLON.Scene(this.engine);
    scene.clearColor = new BABYLON.Color4(0.6, 0.8, 1, 1);
    scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    scene.fogDensity = 0.003;

    // 色をあざやかに + やわらかいビネット
    const ipc = scene.imageProcessingConfiguration;
    ipc.contrast = 1.3;
    ipc.exposure = 1.12;
    ipc.vignetteEnabled = true;
    ipc.vignetteWeight = 1.4;
    ipc.vignetteColor = new BABYLON.Color4(0.35, 0.22, 0.5, 0);
    ipc.vignetteBlendMode = BABYLON.ImageProcessingConfiguration.VIGNETTEMODE_MULTIPLY;

    this.camera = new BABYLON.ArcRotateCamera("cam", -Math.PI / 2, 1.02, 40, new BABYLON.Vector3(0, 0, 0), scene);
    this.camera.minZ = 0.5; this.camera.maxZ = 400;
    this.camCenter = new BABYLON.Vector3(0, 0, 0);

    this.hemi = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0.2, 1, 0.1), scene);
    this.hemi.intensity = 0.75;
    this.hemi.groundColor = U.c3("#b493e0");

    this.sun = new BABYLON.DirectionalLight("sun", new BABYLON.Vector3(-0.45, -1, 0.35), scene);
    this.sun.position = new BABYLON.Vector3(25, 42, -20);
    this.sun.intensity = 1.1;
    this.shadowGen = new BABYLON.ShadowGenerator(1024, this.sun);
    this.shadowGen.usePoissonSampling = true;
    this.shadowGen.darkness = 0.5;

    this.glow = new BABYLON.GlowLayer("glow", scene);
    this.glow.intensity = 0.7;

    this._makeSky();
    this._makeBall();
    this._makeAimHelpers();
    this._makeParticleTextures();
    this._bindInput();

    this.engine.runRenderLoop(() => {
      const dtMs = Math.min(this.engine.getDeltaTime(), 50);
      this.update(dtMs / 1000);
      scene.render();
    });
    window.addEventListener("resize", () => { this.engine.resize(); this._fitCamera(); });
  },

  /* ============================================================
     空・背景
     ============================================================ */
  _makeSky() {
    const dome = BABYLON.MeshBuilder.CreateSphere("sky", { diameter: 500, segments: 12, sideOrientation: BABYLON.Mesh.BACKSIDE }, this.scene);
    const mat = new BABYLON.StandardMaterial("skyMat", this.scene);
    mat.backFaceCulling = false;
    mat.disableLighting = true;
    mat.specularColor = BABYLON.Color3.Black();
    this.skyTex = new BABYLON.DynamicTexture("skyTex", { width: 32, height: 256 }, this.scene, false);
    mat.emissiveTexture = this.skyTex;
    dome.material = mat;
    dome.isPickable = false;
    dome.applyFog = false;
    this.skyDome = dome; this.skyMat = mat;
  },

  _paintSky(preset) {
    const ctx = this.skyTex.getContext();
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, preset.top);
    g.addColorStop(0.62, preset.bottom);
    g.addColorStop(1, preset.bottom);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 256);
    if (preset.stars) {
      ctx.fillStyle = "rgba(255,255,240,0.9)";
      for (let i = 0; i < 40; i++) { const r = Math.random() * 0.9 + 0.3; ctx.beginPath(); ctx.arc(Math.random() * 32, Math.random() * 110, r, 0, 7); ctx.fill(); }
    }
    this.skyTex.update();
    this.scene.fogColor = U.c3(preset.fog);
    this.scene.clearColor = BABYLON.Color4.FromColor3(U.c3(preset.bottom));
  },

  /* ============================================================
     ボール
     ============================================================ */
  _makeBall() {
    const r = 0.48;
    const mesh = BABYLON.MeshBuilder.CreateSphere("ball", { diameter: r * 2, segments: 24 }, this.scene);
    const mat = new BABYLON.StandardMaterial("ballMat", this.scene);
    this.ballSkinTex = new BABYLON.DynamicTexture("ballSkin", { width: 256, height: 256 }, this.scene, true);
    mat.diffuseTexture = this.ballSkinTex;
    mat.specularColor = new BABYLON.Color3(0.35, 0.35, 0.35);
    mesh.material = mat;
    this.shadowGen.addShadowCaster(mesh);

    // 顔(いつもカメラを向くビルボード)
    const face = BABYLON.MeshBuilder.CreatePlane("ballFace", { size: r * 1.7 }, this.scene);
    face.billboardMode = BABYLON.AbstractMesh.BILLBOARDMODE_ALL;
    const faceMat = new BABYLON.StandardMaterial("ballFaceMat", this.scene);
    this.ballFaceTex = new BABYLON.DynamicTexture("ballFaceTex", { width: 128, height: 128 }, this.scene, true);
    this.ballFaceTex.hasAlpha = true;
    faceMat.diffuseTexture = this.ballFaceTex;
    faceMat.emissiveColor = new BABYLON.Color3(1, 1, 1);
    faceMat.disableLighting = true;
    faceMat.useAlphaFromDiffuseTexture = true;
    face.material = faceMat;
    face.isPickable = false;

    this.ball = {
      mesh, face, r, baseR: r,
      vel: new BABYLON.Vector3(0, 0, 0),
      grounded: false, groundCollider: null,
      faceState: "",
    };
    this.setSkin(U.store.get("ccg_skin", "classic"));
    this._setFace("happy");
  },

  setSkin(id) {
    const skin = SKINS.find(s => s.id === id) || SKINS[0];
    const ctx = this.ballSkinTex.getContext();
    skin.paint(ctx, 256);
    this.ballSkinTex.update();
    U.store.set("ccg_skin", skin.id);
    this.currentSkin = skin.id;
  },

  _setFace(state) {
    if (this.ball.faceState === state) return;
    this.ball.faceState = state;
    const c = this.ballFaceTex.getContext();
    c.clearRect(0, 0, 128, 128);
    c.strokeStyle = "#4a3524"; c.fillStyle = "#4a3524";
    c.lineWidth = 6; c.lineCap = "round";
    const eye = (x, open) => {
      if (open) { c.beginPath(); c.arc(x, 52, 9, 0, 7); c.fill(); }
      else { c.beginPath(); c.moveTo(x - 10, 52); c.quadraticCurveTo(x, 60, x + 10, 52); c.stroke(); }
    };
    if (state === "happy") { eye(42, true); eye(86, true); c.beginPath(); c.arc(64, 76, 16, 0.2, Math.PI - 0.2); c.stroke(); }
    if (state === "blink") { eye(42, false); eye(86, false); c.beginPath(); c.arc(64, 76, 16, 0.2, Math.PI - 0.2); c.stroke(); }
    if (state === "wee") { // ビューン!
      c.beginPath(); c.moveTo(30, 44); c.lineTo(52, 52); c.stroke();
      c.beginPath(); c.moveTo(98, 44); c.lineTo(76, 52); c.stroke();
      c.beginPath(); c.arc(64, 78, 18, 0, Math.PI); c.fill();
    }
    if (state === "effort") { // ひっぱり中 むむむ
      c.beginPath(); c.moveTo(32, 46); c.lineTo(52, 50); c.stroke();
      c.beginPath(); c.moveTo(96, 46); c.lineTo(76, 50); c.stroke();
      c.beginPath(); c.arc(64, 80, 9, 0, 7); c.stroke();
    }
    if (state === "sleep") {
      eye(42, false); eye(86, false);
      c.beginPath(); c.arc(64, 82, 8, 0, 7); c.stroke();
      c.font = "26px serif"; c.fillText("💤", 88, 36);
    }
    this.ballFaceTex.update();
  },

  /* ============================================================
     ねらいの矢印 + 予測ドット
     ============================================================ */
  _makeAimHelpers() {
    const shaft = BABYLON.MeshBuilder.CreateCylinder("aimShaft", { height: 1, diameter: 0.34 }, this.scene);
    const head = BABYLON.MeshBuilder.CreateCylinder("aimHead", { height: 0.9, diameterBottom: 0.95, diameterTop: 0 }, this.scene);
    const mat = new BABYLON.StandardMaterial("aimMat", this.scene);
    mat.emissiveColor = U.c3("#7ed957");
    mat.diffuseColor = BABYLON.Color3.Black();
    mat.alpha = 0.9;
    shaft.material = mat; head.material = mat;
    shaft.isPickable = head.isPickable = false;
    shaft.setEnabled(false); head.setEnabled(false);
    this.aimArrow = { shaft, head, mat };

    const dotMat = new BABYLON.StandardMaterial("dotMat", this.scene);
    dotMat.emissiveColor = U.c3("#ffffff");
    dotMat.diffuseColor = BABYLON.Color3.Black();
    dotMat.alpha = 0.85;
    for (let i = 0; i < 18; i++) {
      const dot = BABYLON.MeshBuilder.CreateSphere("aimDot" + i, { diameter: 0.26, segments: 8 }, this.scene);
      dot.material = dotMat;
      dot.isPickable = false;
      dot.setEnabled(false);
      this.aimDots.push(dot);
    }
  },

  /* ============================================================
     パーティクル用テクスチャ
     ============================================================ */
  _makeParticleTextures() {
    const make = (draw) => {
      const dt = new BABYLON.DynamicTexture("pt" + Math.random(), { width: 64, height: 64 }, this.scene, false);
      dt.hasAlpha = true;
      const c = dt.getContext();
      c.clearRect(0, 0, 64, 64);
      draw(c);
      dt.update();
      return dt;
    };
    this.texCircle = make(c => {
      const g = c.createRadialGradient(32, 32, 2, 32, 32, 30);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    });
    this.texStar = make(c => {
      c.fillStyle = "#ffffff"; starPath(c, 32, 32, 26); c.fill();
    });
  },

  /* 星がはじけるバースト */
  burst(pos, colorHex, count, opts) {
    opts = opts || {};
    const ps = new BABYLON.ParticleSystem("burst", count, this.scene);
    ps.particleTexture = opts.star ? this.texStar : this.texCircle;
    ps.emitter = pos.clone();
    ps.minEmitBox = new BABYLON.Vector3(-0.2, -0.2, -0.2);
    ps.maxEmitBox = new BABYLON.Vector3(0.2, 0.2, 0.2);
    const c = U.c3(colorHex);
    ps.color1 = new BABYLON.Color4(c.r, c.g, c.b, 1);
    ps.color2 = new BABYLON.Color4(1, 1, 1, 1);
    ps.colorDead = new BABYLON.Color4(c.r, c.g, c.b, 0);
    ps.minSize = opts.minSize || 0.25; ps.maxSize = opts.maxSize || 0.7;
    ps.minLifeTime = 0.35; ps.maxLifeTime = opts.life || 0.9;
    ps.emitRate = 0;
    ps.manualEmitCount = count;
    ps.gravity = new BABYLON.Vector3(0, opts.gravity !== undefined ? opts.gravity : -7, 0);
    ps.direction1 = new BABYLON.Vector3(-1, 0.4, -1);
    ps.direction2 = new BABYLON.Vector3(1, 1.6, 1);
    ps.minEmitPower = opts.power0 || 3; ps.maxEmitPower = opts.power1 || 7;
    ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    ps.disposeOnStop = true;
    ps.targetStopDuration = 0.15;
    ps.start();
  },

  firework(pos) {
    const colors = ["#ff7b7b", "#ffe066", "#8ee08a", "#7db8ff", "#ff9ecf", "#b79bff"];
    this.burst(pos, U.pick(colors), 60, { star: true, power0: 6, power1: 12, life: 1.4, gravity: -4, maxSize: 0.9 });
    SND.firework();
  },

  /* ボールのトレイル(能力中) */
  _startTrail(colorHex) {
    this._stopTrail();
    const ps = new BABYLON.ParticleSystem("trail", 350, this.scene);
    ps.particleTexture = this.texCircle;
    ps.emitter = this.ball.mesh;
    ps.minEmitBox = new BABYLON.Vector3(-0.1, -0.1, -0.1);
    ps.maxEmitBox = new BABYLON.Vector3(0.1, 0.1, 0.1);
    const c = U.c3(colorHex);
    ps.color1 = new BABYLON.Color4(c.r, c.g, c.b, 0.9);
    ps.color2 = new BABYLON.Color4(1, 1, 1, 0.9);
    ps.colorDead = new BABYLON.Color4(c.r, c.g, c.b, 0);
    ps.minSize = 0.2; ps.maxSize = 0.55;
    ps.minLifeTime = 0.25; ps.maxLifeTime = 0.55;
    ps.emitRate = 90;
    ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    ps.gravity = new BABYLON.Vector3(0, 0, 0);
    ps.direction1 = new BABYLON.Vector3(-0.5, 0.2, -0.5);
    ps.direction2 = new BABYLON.Vector3(0.5, 0.8, 0.5);
    ps.minEmitPower = 0.3; ps.maxEmitPower = 1;
    ps.start();
    this.trailPS = ps;
  },
  _stopTrail() {
    if (this.trailPS) { this.trailPS.stop(); this.trailPS.disposeOnStop = true; this.trailPS = null; }
  },

  /* ============================================================
     コースの組み立て
     ============================================================ */
  _mat(colorHex, opts) {
    opts = opts || {};
    const m = new BABYLON.StandardMaterial("m" + Math.random(), this.scene);
    m.diffuseColor = U.c3(colorHex);
    m.specularColor = new BABYLON.Color3(0.08, 0.08, 0.08);
    if (opts.emissive) m.emissiveColor = U.c3(opts.emissive);
    return m;
  },

  _box(o, kind, parent) {
    const mesh = BABYLON.MeshBuilder.CreateBox("box", { width: o.w, height: o.h, depth: o.d }, this.scene);
    mesh.position.set(o.x, o.y, o.z);
    if (o.rx) mesh.rotation.x = o.rx;
    if (o.ry) mesh.rotation.y = o.ry;
    if (o.rz) mesh.rotation.z = o.rz;
    mesh.material = this._mat(o.color);
    mesh.receiveShadows = true;
    if (parent) mesh.parent = parent;
    if (kind === "wall" || kind === "break") this.shadowGen.addShadowCaster(mesh);
    mesh.computeWorldMatrix(true);
    const col = {
      mesh, kind,
      he: new BABYLON.Vector3(o.w / 2, o.h / 2, o.d / 2),
      e: kind === "wall" ? 0.55 : 0.25,
      breakable: kind === "break",
      move: o.move || null,
      basePos: mesh.position.clone(),
      vel: new BABYLON.Vector3(0, 0, 0),
      alive: true,
    };
    this.colliders.push(col);
    if (col.move) this.movers.push(col);
    return col;
  },

  /* 市松もようの床キャップ */
  _checkerCap(o, parent) {
    const dt = new BABYLON.DynamicTexture("chk" + Math.random(), { width: 256, height: 256 }, this.scene, false);
    const c = dt.getContext();
    // ベース色と、白を混ぜた明るい色の2色市松(くっきりかわいく)
    const base = o.color;
    const bc = U.c3(base);
    const light = "rgb(" +
      Math.round((bc.r * 0.45 + 0.55) * 255) + "," +
      Math.round((bc.g * 0.45 + 0.55) * 255) + "," +
      Math.round((bc.b * 0.45 + 0.55) * 255) + ")";
    const nx = Math.max(2, Math.round(o.w / 2.2)), nz = Math.max(2, Math.round(o.d / 2.2));
    for (let ix = 0; ix < nx; ix++) for (let iz = 0; iz < nz; iz++) {
      c.fillStyle = (ix + iz) % 2 === 0 ? base : light;
      c.fillRect(ix * 256 / nx, iz * 256 / nz, 256 / nx + 1, 256 / nz + 1);
    }
    dt.update();
    const cap = BABYLON.MeshBuilder.CreateGround("cap", { width: o.w - 0.06, height: o.d - 0.06 }, this.scene);
    cap.position.set(o.x, o.y + o.h / 2 + 0.015, o.z);
    const m = new BABYLON.StandardMaterial("capM" + Math.random(), this.scene);
    m.diffuseTexture = dt;
    m.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    cap.material = m;
    cap.receiveShadows = true;
    cap.isPickable = false;
    if (parent) cap.parent = parent;
    return cap;
  },

  _makeBumper(b, parent) {
    const topY = b.topY || 0;
    const mesh = BABYLON.MeshBuilder.CreateCylinder("bumper", { height: 1.1, diameter: 1.7 }, this.scene);
    mesh.position.set(b.x, topY + 0.55, b.z);
    const m = this._mat("#ff9ecf", { emissive: "#66284a" });
    mesh.material = m;
    if (parent) mesh.parent = parent;
    this.shadowGen.addShadowCaster(mesh);
    const cap = BABYLON.MeshBuilder.CreateCylinder("bumperCap", { height: 0.18, diameter: 1.9 }, this.scene);
    cap.position.set(b.x, topY + 1.12, b.z);
    cap.material = this._mat("#ffffff");
    if (parent) cap.parent = parent;
    this.bumpers.push({ mesh, cap, x: b.x, z: b.z, topY, r: 0.85, pulse: 0 });
  },

  /* ---------- ターゲット ---------- */
  _makeTarget(t, parent) {
    const topY = t.topY || 0;
    const y = topY + (t.floatY || 0) + 0.85;
    const root = new BABYLON.TransformNode("tgt", this.scene);
    root.position.set(t.x, y, t.z);
    if (parent) root.parent = parent;

    const isSuper = t.kind !== "normal";
    let body;
    if (isSuper) {
      body = BABYLON.MeshBuilder.CreateBox("tb", { width: 1.15, height: 1.15, depth: 1.15 }, this.scene);
      const m = this._mat(ABILITIES[t.kind].color, { emissive: ABILITIES[t.kind].color });
      m.emissiveColor = m.emissiveColor.scale(0.35);
      body.material = m;
    } else {
      body = BABYLON.MeshBuilder.CreateSphere("tb", { diameter: 1.25, segments: 16 }, this.scene);
      body.scaling.y = 1.12;
      const col = U.pick([U.palette.red, U.palette.orange, U.palette.yellow, U.palette.green, U.palette.blue, U.palette.purple, U.palette.pink]);
      const m = this._mat(col, { emissive: col });
      m.emissiveColor = m.emissiveColor.scale(0.18);
      body.material = m;
    }
    body.parent = root;
    this.shadowGen.addShadowCaster(body);

    // 顔 or 能力アイコンのビルボード(毎フレーム、カメラ側に押し出して埋まらないようにする)
    const plane = BABYLON.MeshBuilder.CreatePlane("tf", { size: isSuper ? 1.1 : 0.95 }, this.scene);
    plane.billboardMode = BABYLON.AbstractMesh.BILLBOARDMODE_ALL;
    plane.parent = parent || null;
    plane.isPickable = false;
    const dt = new BABYLON.DynamicTexture("tft" + Math.random(), { width: 128, height: 128 }, this.scene, true);
    dt.hasAlpha = true;
    const c = dt.getContext();
    c.clearRect(0, 0, 128, 128);
    if (isSuper) {
      c.font = "92px serif"; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(ABILITIES[t.kind].emoji, 64, 70);
    } else {
      c.fillStyle = "#4a3524"; c.strokeStyle = "#4a3524"; c.lineWidth = 6; c.lineCap = "round";
      c.beginPath(); c.arc(44, 54, 8, 0, 7); c.fill();
      c.beginPath(); c.arc(84, 54, 8, 0, 7); c.fill();
      c.beginPath(); c.arc(64, 74, 14, 0.25, Math.PI - 0.25); c.stroke();
    }
    dt.update();
    const pm = new BABYLON.StandardMaterial("tfm" + Math.random(), this.scene);
    pm.diffuseTexture = dt; pm.emissiveColor = new BABYLON.Color3(1, 1, 1);
    pm.disableLighting = true; pm.useAlphaFromDiffuseTexture = true;
    plane.material = pm;

    this.targets.push({
      root, body, plane, kind: t.kind,
      x: t.x, y, z: t.z,
      baseY: y, bobT: Math.random() * 6.28,
      faceLift: isSuper ? 1.05 : 0,
      alive: true, isSuper,
      respawn: !!t.respawn, respawnT: 0,
      def: t,
    });
  },

  /* ---------- レベルの読み込み ---------- */
  loadLevel(lv, opts) {
    opts = opts || {};
    this._clearCourse();
    this.level = lv;
    this.isEndless = !!lv.endless;
    this.mode = "play";
    this.shots = 0;
    this.combo = 0; this.comboTimer = 0;
    this.timeScale = 1;
    this._endAbility(true);
    this.goal = null;
    this.boss = null;
    this.sleeping = false; this.idleTimer = 0;

    const root = this.courseRoot = new BABYLON.TransformNode("course", this.scene);
    this._paintSky(SKIES[lv.sky] || SKIES.morning);

    // コースの広がりを測ってカメラに教える
    let minX = 99, maxX = -99, minZ = 99, maxZ = -99;
    for (const p of lv.platforms) {
      minX = Math.min(minX, p.x - p.w / 2); maxX = Math.max(maxX, p.x + p.w / 2);
      minZ = Math.min(minZ, p.z - p.d / 2); maxZ = Math.max(maxZ, p.z + p.d / 2);
      const col = this._box(p, "ground", root);
      col.e = 0.2;
      if (p.check && !p.rx) this._checkerCap(p, root);
    }
    this.camSize = { w: maxX - minX, d: maxZ - minZ };
    this.camCenter = new BABYLON.Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2);

    for (const w of lv.walls) this._box(w, "wall", root);
    for (const b of lv.breaks) this._box(b, "break", root);
    for (const b of lv.bumpers) this._makeBumper(b, root);
    for (const t of lv.targets) this._makeTarget(t, root);
    this._makeDecor(lv, root, minX, maxX, minZ, maxZ);

    if (lv.boss) this._makeBoss(root);

    // ボールをスタートへ
    const bs = lv.ballStart;
    this.ball.mesh.position.set(bs.x, (bs.topY || 0) + this.ball.r + 0.05, bs.z);
    this.ball.vel.set(0, 0, 0);
    this.ball.r = this.ball.baseR;
    this.ball.mesh.scaling.setAll(1);
    this.lastSafe = this.ball.mesh.position.clone();
    this._setFace("happy");

    this._fitCamera();
    this.camera.target.copyFrom(this.camCenter);

    SND.playBgm(lv.bgm);
    if (window.UI) {
      if (lv.boss) UI.onTargetsChanged(this.boss.total - this.boss.hits, this.boss.total);
      else UI.onTargetsChanged(this._targetsLeft(), this._targetsTotal());
      UI.onShot(this.shots, lv.par);
      UI.enterGame(lv);
    }
  },

  _clearCourse() {
    if (this.courseRoot) { this.courseRoot.dispose(false, true); this.courseRoot = null; }
    this.colliders = [];
    this.bumpers = [];
    this.movers = [];
    this.targets = [];
    this.fragments.forEach(f => f.mesh.dispose());
    this.fragments = [];
    this.projectiles.forEach(p => p.mesh.dispose());
    this.projectiles = [];
    this.driftClouds = [];
    this.balloons = [];
    this.floaties = [];
    this._stopTrail();
  },

  /* ---------- かざり(雲・気球・つみき) ---------- */
  _makeDecor(lv, root, minX, maxX, minZ, maxZ) {
    const rng = makeRng(lv.decorSeed || 1);
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    const spread = Math.max(maxX - minX, maxZ - minZ) * 1.6 + 22;
    // 雲
    for (let i = 0; i < 10; i++) {
      const cloud = new BABYLON.TransformNode("cloud", this.scene); cloud.parent = root;
      const n = 2 + Math.floor(rng() * 3);
      for (let j = 0; j < n; j++) {
        const s = BABYLON.MeshBuilder.CreateSphere("c", { diameter: 2.6 + rng() * 2.4, segments: 8 }, this.scene);
        s.position.set((j - n / 2) * 1.7, rng() * 0.6, rng() * 1.2);
        s.scaling.y = 0.6;
        const m = this._mat("#ffffff"); m.alpha = 0.92; m.emissiveColor = new BABYLON.Color3(0.25, 0.25, 0.3);
        s.material = m;
        s.isPickable = false;
        s.parent = cloud;
      }
      const ang = rng() * Math.PI * 2;
      cloud.position.set(cx + Math.cos(ang) * spread * (0.5 + rng() * 0.5), -3 + rng() * 14, cz + Math.sin(ang) * spread * (0.5 + rng() * 0.5));
      cloud.driftSpeed = 0.2 + rng() * 0.4;
      if (!this.driftClouds) this.driftClouds = [];
      this.driftClouds.push(cloud);
    }
    // 気球
    for (let i = 0; i < 4; i++) {
      const bl = new BABYLON.TransformNode("balloon", this.scene); bl.parent = root;
      const b = BABYLON.MeshBuilder.CreateSphere("bb", { diameter: 2.4, segments: 10 }, this.scene);
      b.material = this._mat(U.pick([U.palette.red, U.palette.yellow, U.palette.blue, U.palette.pink]));
      b.parent = bl;
      const basket = BABYLON.MeshBuilder.CreateBox("bk", { width: 0.7, height: 0.55, depth: 0.7 }, this.scene);
      basket.position.y = -1.9; basket.material = this._mat(U.palette.wood);
      basket.parent = bl;
      const ang = rng() * Math.PI * 2;
      bl.position.set(cx + Math.cos(ang) * (spread * 0.7), 5 + rng() * 8, cz + Math.sin(ang) * (spread * 0.7));
      bl.bobPhase = rng() * 6.28;
      if (!this.balloons) this.balloons = [];
      this.balloons.push(bl);
    }
    // まわりに浮かぶ大きなつみき
    const shapes = ["box", "cyl", "star"];
    for (let i = 0; i < 8; i++) {
      let m;
      const kind = shapes[Math.floor(rng() * shapes.length)];
      if (kind === "box") m = BABYLON.MeshBuilder.CreateBox("db", { size: 1.6 + rng() * 1.6 }, this.scene);
      else if (kind === "cyl") m = BABYLON.MeshBuilder.CreateCylinder("dc", { height: 1.6 + rng() * 1.4, diameter: 1.4 + rng() * 1.2 }, this.scene);
      else m = BABYLON.MeshBuilder.CreateTorus("dt", { diameter: 2 + rng(), thickness: 0.5 }, this.scene);
      const mat = this._mat(U.pick([U.palette.red, U.palette.orange, U.palette.yellow, U.palette.green, U.palette.blue, U.palette.purple, U.palette.pink]));
      mat.emissiveColor = mat.diffuseColor.scale(0.12);
      m.material = mat;
      const ang = rng() * Math.PI * 2;
      m.position.set(cx + Math.cos(ang) * (spread * 0.55 + rng() * 8), -6 + rng() * 6, cz + Math.sin(ang) * (spread * 0.55 + rng() * 8));
      m.rotation.set(rng() * 3, rng() * 3, rng() * 3);
      m.parent = root;
      m.isPickable = false;
      m.spinSpeed = (rng() - 0.5) * 0.6;
      if (!this.floaties) this.floaties = [];
      this.floaties.push(m);
    }
  },

  /* ============================================================
     ボス: ブロックキング
     ============================================================ */
  _makeBoss(root) {
    const node = new BABYLON.TransformNode("boss", this.scene);
    node.parent = root;
    node.position.set(0, 0, 11);

    const body = BABYLON.MeshBuilder.CreateBox("bossBody", { width: 4.4, height: 3.6, depth: 3 }, this.scene);
    body.position.y = 2.2;
    body.material = this._mat("#7db8ff");
    body.parent = node;
    const head = BABYLON.MeshBuilder.CreateBox("bossHead", { width: 3.2, height: 2.4, depth: 2.4 }, this.scene);
    head.position.y = 5.2;
    head.material = this._mat("#ffe066");
    head.parent = node;
    const crown = BABYLON.MeshBuilder.CreateCylinder("crown", { height: 1.2, diameterBottom: 2.2, diameterTop: 1.4 }, this.scene);
    crown.position.y = 7;
    const cm = this._mat("#ffd93b", { emissive: "#7a5b00" });
    crown.material = cm;
    crown.parent = node;
    [body, head, crown].forEach(m => this.shadowGen.addShadowCaster(m));

    // 顔
    const faceTex = new BABYLON.DynamicTexture("bossFace", { width: 256, height: 256 }, this.scene, true);
    faceTex.hasAlpha = true;
    const facePlane = BABYLON.MeshBuilder.CreatePlane("bossFaceP", { size: 2.4 }, this.scene);
    facePlane.parent = node;
    facePlane.position.set(0, 5.2, -1.25);
    facePlane.rotation.y = Math.PI; // -Z(プレイヤー側)を向く
    const fm = new BABYLON.StandardMaterial("bossFaceM", this.scene);
    fm.diffuseTexture = faceTex; fm.emissiveColor = new BABYLON.Color3(1, 1, 1);
    fm.disableLighting = true; fm.useAlphaFromDiffuseTexture = true;
    facePlane.material = fm;

    // よわいところ(まわる的) 6こ
    const weakpoints = [];
    for (let i = 0; i < 6; i++) {
      const w = BABYLON.MeshBuilder.CreateSphere("weak", { diameter: 1.5, segments: 12 }, this.scene);
      const m = this._mat("#ffe066", { emissive: "#8f7a00" });
      w.material = m;
      w.parent = node;
      const dt = new BABYLON.DynamicTexture("wf" + i, { width: 64, height: 64 }, this.scene, true);
      dt.hasAlpha = true;
      const c = dt.getContext(); c.clearRect(0, 0, 64, 64);
      c.font = "44px serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("⭐", 32, 36);
      dt.update();
      const p = BABYLON.MeshBuilder.CreatePlane("wfp", { size: 1 }, this.scene);
      p.billboardMode = BABYLON.AbstractMesh.BILLBOARDMODE_ALL;
      const pm2 = new BABYLON.StandardMaterial("wfm" + i, this.scene);
      pm2.diffuseTexture = dt; pm2.emissiveColor = new BABYLON.Color3(1, 1, 1);
      pm2.disableLighting = true; pm2.useAlphaFromDiffuseTexture = true;
      p.material = pm2;
      p.parent = w;
      weakpoints.push({ mesh: w, icon: p, alive: true, angle: i * Math.PI / 3, h: 0.9 + (i % 3) * 0.6, speed: 0.7 + (i % 2) * 0.4 });
    }

    this.boss = {
      node, body, head, crown, faceTex, facePlane,
      weakpoints, hits: 0, total: 6,
      stompT: 4, t: 0, state: "idle", // idle | stomp | dizzy | done
      wobble: 0, flash: 0,
    };
    this._bossFace("normal");
    if (window.UI) UI.onTargetsChanged(6, 6);
  },

  _bossFace(state) {
    const c = this.boss.faceTex.getContext();
    c.clearRect(0, 0, 256, 256);
    c.fillStyle = "#4a3524"; c.strokeStyle = "#4a3524"; c.lineWidth = 12; c.lineCap = "round";
    if (state === "normal") {
      c.beginPath(); c.arc(88, 100, 16, 0, 7); c.fill();
      c.beginPath(); c.arc(168, 100, 16, 0, 7); c.fill();
      c.beginPath(); c.moveTo(96, 168); c.lineTo(160, 168); c.stroke();
    } else if (state === "angry") {
      c.beginPath(); c.moveTo(60, 76); c.lineTo(108, 96); c.stroke();
      c.beginPath(); c.moveTo(196, 76); c.lineTo(148, 96); c.stroke();
      c.beginPath(); c.arc(88, 112, 13, 0, 7); c.fill();
      c.beginPath(); c.arc(168, 112, 13, 0, 7); c.fill();
      c.beginPath(); c.arc(128, 180, 22, Math.PI, 0); c.stroke();
    } else if (state === "dizzy") {
      c.font = "56px serif"; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText("😵", 128, 120);
    } else if (state === "happy") {
      c.beginPath(); c.arc(88, 100, 5, 0, 7); c.stroke();
      c.beginPath(); c.arc(88, 100, 16, -0.5, Math.PI + 0.5); c.stroke();
      c.beginPath(); c.arc(168, 100, 16, -0.5, Math.PI + 0.5); c.stroke();
      c.beginPath(); c.arc(128, 160, 30, 0.2, Math.PI - 0.2); c.stroke();
    }
    this.boss.faceTex.update();
  },

  _bossUpdate(dt) {
    const boss = this.boss;
    if (!boss || boss.state === "done") return;
    boss.t += dt;

    // よわいところ、ぐるぐる
    for (const w of boss.weakpoints) {
      if (!w.alive) continue;
      w.angle += dt * w.speed;
      const r = 5.2;
      w.mesh.position.set(Math.cos(w.angle) * r, w.h + Math.sin(boss.t * 2 + w.angle) * 0.6, Math.sin(w.angle) * r * 0.75 - 1.5);
      // ボールにあたった?
      const wp = BABYLON.Vector3.TransformCoordinates(w.mesh.position, boss.node.getWorldMatrix());
      // 星アイコンが球体に埋まらないよう、カメラ側に押し出す
      w.icon.position.copyFrom(this.camera.position.subtract(wp).normalize().scale(0.85));
      const d = BABYLON.Vector3.Distance(wp, this.ball.mesh.position);
      if (d < this.ball.r + 1.0) this._hitWeakpoint(w, wp);
    }

    if (boss.state === "dizzy") {
      boss.wobble += dt;
      boss.node.rotation.z = Math.sin(boss.wobble * 10) * 0.12;
      return;
    }

    // ときどきストンプ → やわらかボールを転がす
    boss.stompT -= dt;
    if (boss.stompT < 0.8 && boss.state !== "stomp") { boss.state = "stomp"; this._bossFace("angry"); }
    if (boss.stompT <= 0) {
      boss.stompT = 5 + Math.random() * 2.5;
      boss.state = "idle";
      this._bossFace("normal");
      SND.bossStomp();
      this.shake(0.5, 0.5);
      this.burst(boss.node.position.add(new BABYLON.Vector3(0, 0.5, -2)), "#ffffff", 24, { power0: 4, power1: 9 });
      if (this.projectiles.length < 2) this._spawnProjectile();
    }
    // ストンプ前はジャンプのため気持ちしゃがむ&とぶ
    const squash = boss.state === "stomp" ? 1 - Math.max(0, boss.stompT) * 0.18 : 1;
    boss.node.scaling.y = U.lerp(boss.node.scaling.y || 1, squash, 0.2);
    if (boss.flash > 0) {
      boss.flash -= dt;
      const on = Math.sin(boss.flash * 40) > 0;
      boss.body.material.emissiveColor = on ? U.c3("#ff5a5a") : BABYLON.Color3.Black();
    }
  },

  _spawnProjectile() {
    const boss = this.boss;
    const mesh = BABYLON.MeshBuilder.CreateSphere("proj", { diameter: 1.4, segments: 12 }, this.scene);
    const m = this._mat("#b79bff", { emissive: "#3d2b66" });
    mesh.material = m;
    mesh.parent = this.courseRoot;
    const start = boss.node.position.add(new BABYLON.Vector3(0, 1, -2.5));
    mesh.position.copyFrom(start);
    const toBall = this.ball.mesh.position.subtract(start);
    toBall.y = 0; toBall.normalize();
    this.shadowGen.addShadowCaster(mesh);
    this.projectiles.push({ mesh, vel: toBall.scale(6.5), r: 0.7, life: 14 });
  },

  _hitWeakpoint(w, worldPos) {
    const boss = this.boss;
    w.alive = false;
    w.mesh.dispose();
    boss.hits++;
    SND.bossHit(); SND.pop(this.combo);
    this.combo++;
    this.comboTimer = 4;
    this.burst(worldPos, "#ffe066", 30, { star: true });
    this.shake(0.35, 0.35);
    boss.flash = 0.5;
    if (window.UI) { UI.onTargetsChanged(boss.total - boss.hits, boss.total); UI.showCombo(this.combo); }
    if (boss.hits >= boss.total) this._bossDefeated();
    else if (boss.hits === Math.ceil(boss.total / 2)) { this._bossFace("angry"); }
  },

  _bossDefeated() {
    const boss = this.boss;
    boss.state = "dizzy";
    this._bossFace("dizzy");
    SND.goalAppear();
    if (window.UI) UI.splash("🎊");
    // 2秒ふらふら → ポン!と消えて 王座が巨大ゴールに
    setTimeout(() => {
      if (!this.boss) return;
      const pos = boss.node.position.clone();
      this.burst(pos.add(new BABYLON.Vector3(0, 3, 0)), "#ffe066", 80, { star: true, power0: 6, power1: 14, life: 1.5 });
      this._bossFace("happy");
      boss.state = "done";
      boss.node.setEnabled(false);
      this.projectiles.forEach(p => p.mesh.dispose());
      this.projectiles = [];
      this._makeGoal(new BABYLON.Vector3(pos.x, 0, pos.z - 2), 2.1);
      this.shake(0.6, 0.5);
    }, 2000);
  },

  /* ============================================================
     ゴール(最後のターゲットが変身!)
     ============================================================ */
  _makeGoal(pos, radius) {
    const root = new BABYLON.TransformNode("goal", this.scene);
    root.parent = this.courseRoot;
    root.position.copyFrom(pos);

    const ring = BABYLON.MeshBuilder.CreateTorus("goalRing", { diameter: radius * 2, thickness: 0.3, tessellation: 32 }, this.scene);
    ring.position.y = 0.18;
    const rm = this._mat("#ffe066", { emissive: "#b89400" });
    ring.material = rm;
    ring.parent = root;

    const disc = BABYLON.MeshBuilder.CreateDisc("goalDisc", { radius: radius * 0.92, tessellation: 32 }, this.scene);
    disc.rotation.x = Math.PI / 2;
    disc.position.y = 0.1;
    const dm = new BABYLON.StandardMaterial("goalDiscM", this.scene);
    dm.emissiveColor = U.c3("#3d2b66");
    dm.diffuseColor = BABYLON.Color3.Black();
    disc.material = dm;
    disc.parent = root;

    // 光の柱
    const beam = BABYLON.MeshBuilder.CreateCylinder("beam", { height: 14, diameterBottom: radius * 1.5, diameterTop: radius * 0.4 }, this.scene);
    beam.position.y = 7;
    const bm = new BABYLON.StandardMaterial("beamM", this.scene);
    bm.emissiveColor = U.c3("#fff3b0");
    bm.diffuseColor = BABYLON.Color3.Black();
    bm.alpha = 0.22;
    bm.disableLighting = true;
    beam.material = bm;
    beam.isPickable = false;
    beam.parent = root;

    // 旗
    const pole = BABYLON.MeshBuilder.CreateCylinder("pole", { height: 3.4, diameter: 0.14 }, this.scene);
    pole.position.set(radius * 0.8, 1.7, 0);
    pole.material = this._mat("#ffffff");
    pole.parent = root;
    const flag = BABYLON.MeshBuilder.CreatePlane("flag", { width: 1.4, height: 0.9 }, this.scene);
    flag.position.set(radius * 0.8 + 0.72, 3, 0);
    const flm = this._mat("#ff7b7b", { emissive: "#661f1f" });
    flm.backFaceCulling = false;
    flag.material = flm;
    flag.parent = root;

    this.goal = { root, ring, beam, pos: root.position.clone(), r: radius, t: 0, active: true };
    SND.goalAppear();
    if (window.UI) UI.splash("⛳");
    this.burst(pos.add(new BABYLON.Vector3(0, 1, 0)), "#ffe066", 40, { star: true });
  },

  /* ============================================================
     入力(ひっぱって発射)
     ============================================================ */
  _bindInput() {
    const el = this.canvas;
    el.addEventListener("pointerdown", (e) => {
      SND.init(); SND.resume();
      this.idleTimer = 0;
      if (this.sleeping) { this.sleeping = false; this._setFace("happy"); }
      if (this.mode !== "play") return;
      if (this.ball.vel.length() > 2.4) return; // はやく動いている間はためられない
      this.dragging = true;
      this.dragStart = { x: e.clientX, y: e.clientY };
      this.dragVec = { x: 0, y: 0 };
      this._setFace("effort");
      if (window.UI) UI.hideHint();
    });
    window.addEventListener("pointermove", (e) => {
      if (!this.dragging) return;
      this.dragVec = { x: e.clientX - this.dragStart.x, y: e.clientY - this.dragStart.y };
    });
    window.addEventListener("pointerup", () => {
      if (!this.dragging) return;
      this.dragging = false;
      this._hideAim();
      // パワーはフレームに依存せず、はなした瞬間のドラッグ量から計算する
      const raw = Math.hypot(this.dragVec.x, this.dragVec.y);
      const p = U.clamp(raw / (Math.min(window.innerWidth, window.innerHeight) * 0.38), 0, 1);
      this.power = 0;
      if (p > 0.07 && this.mode === "play") this._launch(p);
      else this._setFace("happy");
    });
    window.addEventListener("pointercancel", () => { this.dragging = false; this._hideAim(); this.power = 0; });
  },

  _dragDir() {
    // 画面のドラッグ → ワールドの向き(カメラ基準)
    const cam = this.camera;
    const fwd = cam.getDirection(new BABYLON.Vector3(0, 0, 1)); fwd.y = 0; fwd.normalize();
    const right = cam.getDirection(new BABYLON.Vector3(1, 0, 0)); right.y = 0; right.normalize();
    const dx = this.dragVec.x, dy = this.dragVec.y;
    const v = right.scale(-dx).add(fwd.scale(dy));
    const len = v.length();
    if (len < 1) return null;
    return v.scale(1 / len);
  },

  _launch(power) {
    const dir = this._dragDir();
    if (!dir) { this._setFace("happy"); return; }
    const speed = 7.5 + power * 21;
    this.ball.vel.copyFrom(dir.scale(speed));
    this.ball.vel.y = 2.2 + power * 5.2;
    this.shots++;
    this.combo = 0;
    SND.shoot(power);
    this._setFace("wee");
    this.burst(this.ball.mesh.position, "#ffffff", 10, { power0: 1, power1: 3, life: 0.4 });
    if (window.UI) UI.onShot(this.shots, this.level.par);
  },

  _updateAim(dt) {
    const drag = this.dragging;
    const arrow = this.aimArrow;
    if (!drag || this.mode !== "play") { this._hideAim(); return; }
    const dir = this._dragDir();
    const raw = Math.hypot(this.dragVec.x, this.dragVec.y);
    const norm = U.clamp(raw / (Math.min(window.innerWidth, window.innerHeight) * 0.38), 0, 1);
    this.power = norm;
    if (!dir || norm < 0.05) { this._hideAim(); return; }

    const bp = this.ball.mesh.position;
    const len = 1.2 + norm * 4.5;
    arrow.shaft.setEnabled(true); arrow.head.setEnabled(true);
    arrow.shaft.scaling.y = len;
    // シリンダーはY軸方向 → 向きを合わせる
    const yaw = Math.atan2(dir.x, dir.z);
    arrow.shaft.rotation.set(Math.PI / 2, yaw, 0);
    arrow.head.rotation.set(Math.PI / 2, yaw, 0);
    arrow.shaft.position.copyFrom(bp.add(dir.scale(len / 2 + 0.6)));
    arrow.shaft.position.y = bp.y + 0.15;
    arrow.head.position.copyFrom(bp.add(dir.scale(len + 1.0)));
    arrow.head.position.y = bp.y + 0.15;
    // 色: みどり → ピンク
    const c0 = U.c3("#7ed957"), c1 = U.c3("#ff5a8f");
    arrow.mat.emissiveColor = BABYLON.Color3.Lerp(c0, c1, norm);

    // 予測ドット(かんたん弾道シミュレーション)
    const pos = bp.clone();
    const vel = dir.scale(7.5 + norm * 21); vel.y = 2.2 + norm * 5.2;
    const sdt = 1 / 40;
    let di = 0;
    for (let i = 0; i < 100 && di < this.aimDots.length; i++) {
      vel.y -= 22 * sdt;
      pos.addInPlace(vel.scale(sdt));
      this._collideStatic(pos, vel, this.ball.r, true);
      if (i % 5 === 0) {
        const dot = this.aimDots[di++];
        dot.setEnabled(true);
        dot.position.copyFrom(pos);
        dot.scaling.setAll(1 - di * 0.035);
      }
      if (pos.y < -6) break;
    }
    for (let i = di; i < this.aimDots.length; i++) this.aimDots[i].setEnabled(false);

    // ひっぱり中、ボールがちょっと後ろにかたむく(ゴムかん)
    this.ball.mesh.position.y = Math.max(this.ball.mesh.position.y, 0);
  },

  _hideAim() {
    this.aimArrow.shaft.setEnabled(false);
    this.aimArrow.head.setEnabled(false);
    for (const d of this.aimDots) d.setEnabled(false);
  },

  /* ============================================================
     物理
     ============================================================ */
  _collideStatic(pos, vel, r, ghost) {
    // pos/vel を直接書きかえる。ghost=true なら音や破壊なし(予測用)
    let groundedOn = null;
    for (const col of this.colliders) {
      if (!col.alive) continue;
      const inv = col._inv || (col._inv = new BABYLON.Matrix());
      if (col._invDirty !== false || col.move) {
        col.mesh.computeWorldMatrix(true).invertToRef(inv);
        col._invDirty = false;
      }
      const lp = BABYLON.Vector3.TransformCoordinates(pos, inv);
      const he = col.he;
      const cx = U.clamp(lp.x, -he.x, he.x);
      const cy = U.clamp(lp.y, -he.y, he.y);
      const cz = U.clamp(lp.z, -he.z, he.z);
      let dx = lp.x - cx, dy = lp.y - cy, dz = lp.z - cz;
      let dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      let nLocal;
      if (dist > 1e-6) {
        if (dist >= r) continue;
        nLocal = new BABYLON.Vector3(dx / dist, dy / dist, dz / dist);
      } else {
        // 中に入ってしまった → いちばん近い面から出す
        const px = he.x - Math.abs(lp.x), py = he.y - Math.abs(lp.y), pz = he.z - Math.abs(lp.z);
        if (px < py && px < pz) nLocal = new BABYLON.Vector3(Math.sign(lp.x) || 1, 0, 0);
        else if (py < pz) nLocal = new BABYLON.Vector3(0, Math.sign(lp.y) || 1, 0);
        else nLocal = new BABYLON.Vector3(0, 0, Math.sign(lp.z) || 1);
        dist = 0;
      }
      const wm = col.mesh.getWorldMatrix();
      const n = BABYLON.Vector3.TransformNormal(nLocal, wm).normalize();

      // こわせるブロック?
      if (col.breakable && !ghost) {
        const canBreak = this.ability && (this.ability.kind === "drill" || this.ability.kind === "rainbow" ||
          (this.ability.kind === "jumbo" && vel.length() > 6));
        if (canBreak) { this._breakBlock(col); continue; }
      }

      pos.addInPlace(n.scale(r - dist));
      const vn = BABYLON.Vector3.Dot(vel, n);
      if (vn < 0) {
        let e = col.e;
        if (this.ability && this.ability.kind === "bounce" && n.y > 0.5) e = 1.02;
        vel.subtractInPlace(n.scale((1 + e) * vn));
        if (!ghost) {
          if (n.y > 0.6) {
            // 着地
            if (-vn > 4 && this.ability && this.ability.kind === "bounce") { SND.boing(); this._squash(); }
          } else if (-vn > 3.5) {
            SND.bump();
            this.burst(pos.clone(), "#ffffff", 6, { power0: 1, power1: 2.5, life: 0.3 });
          }
        }
      }
      if (n.y > 0.62) groundedOn = col;
    }
    return groundedOn;
  },

  _breakBlock(col) {
    col.alive = false;
    col.mesh.setEnabled(false);
    SND.breakBlock();
    this.shake(0.25, 0.3);
    const p = col.mesh.position;
    this.burst(p.clone(), "#ffffff", 14, { power0: 2, power1: 6 });
    // 破片
    for (let i = 0; i < 5; i++) {
      const f = BABYLON.MeshBuilder.CreateBox("frag", { size: 0.35 + Math.random() * 0.3 }, this.scene);
      f.material = col.mesh.material;
      f.position.copyFrom(p);
      f.parent = this.courseRoot;
      this.fragments.push({
        mesh: f, t: 1.4,
        vel: new BABYLON.Vector3(U.rand(-4, 4), U.rand(3, 8), U.rand(-4, 4)),
        rot: new BABYLON.Vector3(U.rand(-6, 6), U.rand(-6, 6), U.rand(-6, 6)),
      });
    }
  },

  _squash() {
    const m = this.ball.mesh;
    m.scaling.set(1.25, 0.7, 1.25);
  },

  _physStep(dt) {
    const ball = this.ball;
    const pos = ball.mesh.position;
    const vel = ball.vel;

    let g = 22;
    if (this.ability && this.ability.kind === "rocket") g = 13;
    vel.y -= g * dt;

    // 能力: トルネード/レインボー = ちかくのターゲットへ曲がる
    if (this.ability && (this.ability.kind === "tornado" || this.ability.kind === "rainbow")) {
      const t = this._nearestTarget(pos);
      if (t && vel.length() > 2) {
        const to = new BABYLON.Vector3(t.x - pos.x, 0, t.z - pos.z);
        const d = to.length();
        if (d > 0.5 && d < 18) {
          to.normalize();
          const steer = this.ability.kind === "tornado" ? 26 : 14;
          vel.x += to.x * steer * dt;
          vel.z += to.z * steer * dt;
        }
      }
    }

    pos.addInPlace(vel.scale(dt));

    const groundedOn = this._collideStatic(pos, vel, ball.r, false);
    ball.grounded = !!groundedOn;
    ball.groundCollider = groundedOn;

    // ころがりまさつ
    if (ball.grounded) {
      const f = Math.pow(0.45, dt); // 1秒で55%減速くらい
      vel.x *= f; vel.z *= f;
      // うごく床にのっているときはいっしょに動く
      if (groundedOn && groundedOn.move) {
        pos.x += groundedOn.vel.x * dt;
        pos.z += groundedOn.vel.z * dt;
      }
      // 安全な場所をおぼえる(リスポーン用)
      if (vel.length() < 6) this.lastSafe = pos.clone();
    } else {
      const f = Math.pow(0.92, dt);
      vel.x *= f; vel.z *= f;
    }

    // バンパー
    for (const b of this.bumpers) {
      const dx = pos.x - b.x, dz = pos.z - b.z;
      const d = Math.hypot(dx, dz);
      if (d < b.r + ball.r && pos.y < b.topY + 1.4 && pos.y > b.topY - 0.5) {
        const nx = dx / (d || 1), nz = dz / (d || 1);
        pos.x = b.x + nx * (b.r + ball.r);
        pos.z = b.z + nz * (b.r + ball.r);
        const sp = Math.max(vel.length() * 0.9, 13);
        vel.x = nx * sp; vel.z = nz * sp;
        vel.y = Math.max(vel.y, 3);
        SND.bumper();
        b.pulse = 1;
        this.burst(pos.clone(), "#ff9ecf", 12, { power0: 2, power1: 5 });
        this.combo = Math.max(this.combo, 0);
        this.shake(0.15, 0.2);
      }
    }

    // ボスの投げたボール
    for (const pr of this.projectiles) {
      const d = BABYLON.Vector3.Distance(pr.mesh.position, pos);
      if (d < pr.r + ball.r) {
        const n = pos.subtract(pr.mesh.position).normalize();
        const sp = Math.max(vel.length(), 9);
        vel.copyFrom(n.scale(sp)); vel.y = Math.max(vel.y, 3.5);
        SND.boing();
        this._squash();
      }
    }

    // マグネット / レインボー: ターゲットがすいよせられる
    if (this.ability && (this.ability.kind === "magnet" || this.ability.kind === "rainbow")) {
      const rad = this.ability.kind === "magnet" ? 8 : 5.5;
      for (const t of this.targets) {
        if (!t.alive) continue;
        const to = pos.subtract(t.root.position);
        const d = to.length();
        if (d < rad && d > 0.1) {
          to.normalize();
          t.root.position.addInPlace(to.scale(dt * (10 - d)));
          t.x = t.root.position.x; t.z = t.root.position.z;
        }
      }
    }

    // ターゲットにあたった?
    const hitR = ball.r + 0.85;
    for (const t of this.targets) {
      if (!t.alive) continue;
      const d = BABYLON.Vector3.Distance(t.root.position, pos);
      if (d < hitR) this._collectTarget(t);
    }

    // ゴールイン?
    if (this.goal && this.goal.active && this.mode === "play") {
      const gp = this.goal.pos;
      const d = U.dist2d(pos.x, pos.z, gp.x, gp.z);
      if (d < this.goal.r * 0.85 && pos.y < gp.y + 1.6) this._goalIn();
    }

    // おちた → やさしくもどす
    if (pos.y < -9) this._respawn();
  },

  _nearestTarget(pos) {
    let best = null, bd = 1e9;
    for (const t of this.targets) {
      if (!t.alive) continue;
      const d = U.dist2d(pos.x, pos.z, t.x, t.z);
      if (d < bd) { bd = d; best = t; }
    }
    // ボス戦: よわいところをねらう
    if (!best && this.boss && this.boss.state !== "done") {
      for (const w of this.boss.weakpoints) {
        if (!w.alive) continue;
        const wp = BABYLON.Vector3.TransformCoordinates(w.mesh.position, this.boss.node.getWorldMatrix());
        const d = U.dist2d(pos.x, pos.z, wp.x, wp.z);
        if (d < bd) { bd = d; best = { x: wp.x, z: wp.z }; }
      }
    }
    if (this.goal && this.goal.active) {
      const d = U.dist2d(pos.x, pos.z, this.goal.pos.x, this.goal.pos.z);
      if (d < bd) best = { x: this.goal.pos.x, z: this.goal.pos.z };
    }
    return best;
  },

  _respawn() {
    const pos = this.ball.mesh.position;
    SND.whoops();
    this.burst(pos.clone(), "#7db8ff", 16, { power0: 2, power1: 5 });
    pos.copyFrom(this.lastSafe || new BABYLON.Vector3(this.level.ballStart.x, 1, this.level.ballStart.z));
    pos.y += 1.2;
    this.ball.vel.set(0, 0, 0);
    this._setFace("happy");
    if (window.UI) UI.splash("😅");
  },

  /* ---------- ターゲットゲット! ---------- */
  _collectTarget(t) {
    t.alive = false;
    this.combo++;
    this.comboTimer = 4;
    const pos = t.root.position.clone();
    SND.pop(this.combo);
    if (Math.random() < 0.4) SND.giggle();
    const color = t.isSuper ? ABILITIES[t.kind].color : "#ffe066";
    this.burst(pos, color, t.isSuper ? 34 : 20, { star: true });
    t.root.setEnabled(false);
    t.plane.setEnabled(false);

    if (window.UI) {
      UI.addWalletStar(1);
      UI.showCombo(this.combo);
    }

    if (t.isSuper) this._activateAbility(t.kind);

    if (t.respawn) {
      // ボス戦の能力ターゲットはしばらくすると復活
      t.respawnT = 6;
    }

    const left = this._targetsLeft();
    if (window.UI && !this.level.boss) UI.onTargetsChanged(left, this._targetsTotal());

    if (!this.level.boss && !this.goal) {
      if (left === 1) {
        // のこり1つ → ゴールに変身!!
        const last = this.targets.find(x => x.alive);
        if (last) {
          last.alive = false;
          last.root.setEnabled(false);
          last.plane.setEnabled(false);
          this._makeGoal(new BABYLON.Vector3(last.x, (last.def.topY || 0), last.z), 1.35);
          if (window.UI) UI.onTargetsChanged(0, this._targetsTotal());
        }
      } else if (left === 0) {
        // 最後のひとつを直接とった場合もゴール出現(その場に)
        this._makeGoal(new BABYLON.Vector3(pos.x, (t.def.topY || 0), pos.z), 1.35);
      }
    }
  },

  _targetsTotal() { return this.targets.filter(t => !t.respawn).length; },
  _targetsLeft() { return this.targets.filter(t => t.alive && !t.respawn).length; },

  /* ---------- 能力 ---------- */
  _activateAbility(kind) {
    const wasActive = !!this.ability;
    this._endAbility(true);
    const a = ABILITIES[kind];
    this.ability = { kind, t: a.dur, dur: a.dur };
    SND.ability(kind);
    if (window.UI) {
      UI.abilityStart(kind, a.dur);
      UI.splash(a.emoji + (wasActive ? "⚡" : ""));
    }
    this._startTrail(a.color);

    const ball = this.ball;
    if (kind === "rocket") {
      let dir = ball.vel.clone(); dir.y = 0;
      if (dir.length() < 1) dir = this.camera.getDirection(new BABYLON.Vector3(0, 0, 1));
      dir.y = 0; dir.normalize();
      ball.vel.x = dir.x * 24; ball.vel.z = dir.z * 24;
      ball.vel.y = Math.max(ball.vel.y, 2);
      this.shake(0.3, 0.3);
    }
    if (kind === "jumbo") { /* update内でスケール */ }
    if (kind === "slow") this.timeScale = 0.45;
    if (kind === "bounce") { ball.vel.y = Math.max(ball.vel.y, 8); }
    if (kind === "rainbow") { document.body.classList.add("rainbowEdge"); }
  },

  _endAbility(silent) {
    if (!this.ability) return;
    const kind = this.ability.kind;
    this.ability = null;
    this.timeScale = 1;
    document.body.classList.remove("rainbowEdge");
    this._stopTrail();
    if (window.UI) UI.abilityEnd();
  },

  /* ---------- ゴールイン演出 ---------- */
  _goalIn() {
    if (this.mode !== "play") return;
    this.mode = "clearing";
    this.goal.active = false;
    this._endAbility(true);
    this._hideAim();
    this.dragging = false;
    SND.suck();
    this._setFace("wee");

    const ball = this.ball;
    const gp = this.goal.pos.clone();
    const startPos = ball.mesh.position.clone();
    let t = 0;
    const spin = () => {
      t += this.engine.getDeltaTime() / 1000;
      const k = Math.min(t / 0.9, 1);
      const ang = k * Math.PI * 5;
      const rad = (1 - k) * Math.max(0.3, BABYLON.Vector3.Distance(startPos, gp) * 0.5);
      ball.mesh.position.x = gp.x + Math.cos(ang) * rad;
      ball.mesh.position.z = gp.z + Math.sin(ang) * rad;
      ball.mesh.position.y = U.lerp(startPos.y, gp.y + 0.2, k);
      ball.mesh.scaling.setAll(1 - k * 0.8);
      if (k < 1) requestAnimationFrame(spin);
      else this._cleared();
    };
    requestAnimationFrame(spin);
  },

  _cleared() {
    SND.fanfare();
    // はなび!
    const c = this.camCenter;
    for (let i = 0; i < 7; i++) {
      setTimeout(() => {
        if (this.mode !== "clearing" && this.mode !== "cleared") return;
        this.firework(new BABYLON.Vector3(c.x + U.rand(-8, 8), 6 + U.rand(0, 6), c.z + U.rand(-8, 8)));
      }, 250 + i * 330);
    }

    if (this.isEndless) {
      if (window.UI) UI.onIslandCleared(this.islandIndex);
      setTimeout(() => {
        this.islandIndex++;
        this.loadLevel(generateIsland(this.islandIndex));
        if (window.UI) UI.showIslandBanner();
      }, 1700);
    } else {
      const par = this.level.par;
      const stars = this.shots <= par ? 3 : this.shots <= par + 2 ? 2 : 1;
      this.mode = "cleared";
      setTimeout(() => { if (window.UI) UI.showClear(this.levelIndex, stars); }, 1100);
    }
  },

  shake(amp, dur) { this.shakeAmp = amp; this.shakeT = dur; },

  /* ============================================================
     メインループ
     ============================================================ */
  update(rawDt) {
    if (this.mode === "none") return;
    const dt = rawDt * this.timeScale;

    /* --- うごく床 --- */
    for (const col of this.movers) {
      if (!col.alive) continue;
      const mv = col.move;
      mv._t = (mv._t || 0) + dt * mv.speed;
      const off = Math.sin(mv._t + (mv.phase || 0)) * mv.range;
      const prev = col.mesh.position.clone();
      const np = col.basePos.clone();
      np[mv.axis] += off;
      col.mesh.position.copyFrom(np);
      col.mesh.computeWorldMatrix(true);
      col._invDirty = true;
      if (dt > 0) col.vel.copyFrom(np.subtract(prev).scale(1 / dt));
    }

    /* --- 物理(サブステップ) --- */
    if (this.mode === "play") {
      this._accum += dt;
      const step = 1 / 120;
      let n = 0;
      while (this._accum >= step && n < 8) {
        this._physStep(step);
        this._accum -= step;
        n++;
      }
    }

    const ball = this.ball;

    /* --- ボールの見た目 --- */
    // ころがり回転
    const sp = Math.hypot(ball.vel.x, ball.vel.z);
    if (sp > 0.1) {
      const axis = new BABYLON.Vector3(ball.vel.z, 0, -ball.vel.x).normalize();
      ball.mesh.rotate(axis, (sp * rawDt) / ball.r, BABYLON.Space.WORLD);
    }
    // スケールもどし(スカッシュ&ジャンボ)
    const targetScale = this.ability && this.ability.kind === "jumbo" ? 2.2 : 1;
    ball.mesh.scaling.x = U.lerp(ball.mesh.scaling.x, targetScale, Math.min(1, rawDt * 6));
    ball.mesh.scaling.y = U.lerp(ball.mesh.scaling.y, targetScale, Math.min(1, rawDt * 6));
    ball.mesh.scaling.z = U.lerp(ball.mesh.scaling.z, targetScale, Math.min(1, rawDt * 6));
    ball.r = ball.baseR * ball.mesh.scaling.x;
    // 顔の位置(カメラ側にちょっと出す)
    const camDir = this.camera.position.subtract(ball.mesh.position).normalize();
    ball.face.position.copyFrom(ball.mesh.position.add(camDir.scale(ball.r * 1.18)));
    ball.face.scaling.setAll(ball.mesh.scaling.x);

    // 顔の表情
    if (this.mode === "play" && !this.dragging) {
      if (sp > 9) this._setFace("wee");
      else if (this.sleeping) this._setFace("sleep");
      else {
        this._faceBlink -= rawDt;
        if (this._faceBlink < 0) {
          this._setFace(this.ball.faceState === "blink" ? "happy" : "blink");
          this._faceBlink = this.ball.faceState === "blink" ? 0.15 : U.rand(1.5, 4);
        }
      }
    }

    /* --- おひるね(アイドル) --- */
    if (this.mode === "play" && sp < 0.5 && !this.dragging) {
      this.idleTimer += rawDt;
      if (this.idleTimer > 7 && !this.sleeping) {
        this.sleeping = true;
        this._setFace("sleep");
        SND.snore();
        if (window.UI) UI.showHint();
      }
    } else {
      this.idleTimer = 0;
    }

    /* --- コンボ --- */
    if (this.combo > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0 || (sp < 0.4 && ball.grounded)) {
        this.combo = 0;
        if (window.UI) UI.showCombo(0);
      }
    }

    /* --- 能力タイマー --- */
    if (this.ability) {
      this.ability.t -= rawDt;
      if (window.UI) UI.abilityTick(this.ability.t / this.ability.dur);
      if (this.ability.t <= 0) this._endAbility();
    }

    /* --- ターゲットのゆらゆら & 復活 --- */
    const time = performance.now() / 1000;
    const camPos = this.camera.position;
    for (const t of this.targets) {
      if (t.alive) {
        t.bobT += dt * 2.2;
        t.root.position.y = t.baseY + Math.sin(t.bobT) * 0.18;
        t.root.rotation.y += dt * (t.isSuper ? 1.4 : 0.4);
        // 顔/アイコンをボディの手前(カメラ側)に出す
        const toCam = camPos.subtract(t.root.position).normalize();
        t.plane.position.copyFrom(t.root.position
          .add(toCam.scale(0.78))
          .add(new BABYLON.Vector3(0, t.faceLift, 0)));
      } else if (t.respawn && this.mode === "play") {
        t.respawnT -= dt;
        if (t.respawnT <= 0) {
          t.alive = true;
          t.root.setEnabled(true);
          t.plane.setEnabled(true);
          t.root.position.set(t.def.x, t.baseY, t.def.z);
          t.x = t.def.x; t.z = t.def.z;
          this.burst(t.root.position.clone(), "#ffffff", 10, { power0: 1, power1: 3 });
        }
      }
    }

    /* --- ゴールのくるくる --- */
    if (this.goal) {
      this.goal.t += dt;
      this.goal.ring.rotation.y += dt * 1.5;
      this.goal.beam.material.alpha = 0.16 + Math.sin(this.goal.t * 3) * 0.07;
      this.goal.ring.scaling.setAll(1 + Math.sin(this.goal.t * 3) * 0.05);
    }

    /* --- バンパーのぷるん --- */
    for (const b of this.bumpers) {
      if (b.pulse > 0) {
        b.pulse -= dt * 3;
        const s = 1 + Math.max(0, b.pulse) * 0.35;
        b.mesh.scaling.set(s, 1, s);
      }
    }

    /* --- 破片 --- */
    for (let i = this.fragments.length - 1; i >= 0; i--) {
      const f = this.fragments[i];
      f.t -= dt;
      f.vel.y -= 20 * dt;
      f.mesh.position.addInPlace(f.vel.scale(dt));
      f.mesh.rotation.addInPlace(f.rot.scale(dt));
      f.mesh.scaling.setAll(Math.max(0.01, Math.min(1, f.t)));
      if (f.t <= 0) { f.mesh.dispose(); this.fragments.splice(i, 1); }
    }

    /* --- ボスの投げボール --- */
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.vel.y -= 18 * dt;
      p.mesh.position.addInPlace(p.vel.scale(dt));
      this._collideStatic(p.mesh.position, p.vel, p.r, true);
      p.mesh.rotate(new BABYLON.Vector3(p.vel.z, 0, -p.vel.x).normalize(), p.vel.length() * dt / p.r, BABYLON.Space.WORLD);
      if (p.life <= 0 || p.mesh.position.y < -9) { p.mesh.dispose(); this.projectiles.splice(i, 1); }
    }

    /* --- ボス --- */
    if (this.boss) this._bossUpdate(dt);

    /* --- かざりのアニメ --- */
    if (this.driftClouds) for (const c of this.driftClouds) { if (!c.isDisposed()) c.position.x += c.driftSpeed * rawDt; }
    if (this.balloons) for (const b of this.balloons) { if (!b.isDisposed()) b.position.y += Math.sin(time + b.bobPhase) * 0.15 * rawDt; }
    if (this.floaties) for (const f of this.floaties) { if (!f.isDisposed()) { f.rotation.y += f.spinSpeed * rawDt; f.rotation.x += f.spinSpeed * 0.6 * rawDt; } }

    /* --- ねらい --- */
    this._updateAim(rawDt);

    /* --- カメラ --- */
    this._updateCamera(rawDt);
  },

  _fitCamera() {
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const fov = this.camera.fov; // 縦方向 rad (デフォルト 0.8)
    const halfW = this.camSize.w / 2 + 3.5;
    const halfD = this.camSize.d / 2 + 3;
    const rW = halfW / (Math.tan(fov / 2) * aspect);
    const rD = halfD / Math.tan(fov / 2) * 0.72;
    this.camera.radius = Math.max(rW, rD, 15) * 1.12;
    this.camera.beta = aspect < 0.8 ? 0.92 : 1.04; // 縦画面は少し上から
  },

  _updateCamera(dt) {
    if (!this.level) return;
    const bp = this.ball.mesh.position;
    // ボール6:コース中心4 のあいだを見る
    const want = new BABYLON.Vector3(
      bp.x * 0.55 + this.camCenter.x * 0.45,
      Math.max(0, bp.y * 0.3),
      bp.z * 0.55 + this.camCenter.z * 0.45
    );
    const k = Math.min(1, dt * 3.5);
    this.camera.target.x = U.lerp(this.camera.target.x, want.x, k);
    this.camera.target.y = U.lerp(this.camera.target.y, want.y, k);
    this.camera.target.z = U.lerp(this.camera.target.z, want.z, k);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeAmp * (this.shakeT > 0 ? this.shakeT : 0) * 2;
      this.camera.target.x += U.rand(-a, a);
      this.camera.target.y += U.rand(-a, a) * 0.5;
    }
  },

  /* ============================================================
     外から呼ぶAPI
     ============================================================ */
  startStage(index) {
    this.levelIndex = index;
    this.isEndless = false;
    this.loadLevel(LEVELS[index]());
  },
  startEndless() {
    this.islandIndex = U.store.get("ccg_islandReached", 0);
    this.loadLevel(generateIsland(this.islandIndex));
  },
  stopToMenu() {
    this.mode = "none";
    this._clearCourse();
    this._endAbility(true);
    this._hideAim();
    this.dragging = false;
    SND.playBgm("menu");
  },
};
