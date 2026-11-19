// SUNFALL CITY — boot, input, screen/state machine and the main loop.
// Owns the renderer, sky and lights; wires the start / pause / busted /
// wasted screens; exposes window.SF.state and SF.startDemo() for tooling.
(function () {
  'use strict';
  var U = SF.U, CFG = SF.CFG, G = SF.G;

  // ---------- renderer / scene ----------
  var renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  document.getElementById('app').appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  scene.fog = new THREE.Fog(CFG.FOG, 130, 780);
  var camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 3000);
  camera.position.set(0, 40, 190);
  G.camera = camera;
  G.renderer = renderer;

  // Sky dome: vertical gradient painted on a canvas.
  (function buildSky() {
    var cv = document.createElement('canvas');
    cv.width = 16; cv.height = 256;
    var g = cv.getContext('2d');
    var grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.0, '#2f6db3');
    grad.addColorStop(0.42, '#7fb0d8');
    grad.addColorStop(0.52, '#ffb36b');
    grad.addColorStop(0.60, '#ffe3ae');
    grad.addColorStop(0.68, '#e8a56b');
    grad.addColorStop(1.0, '#8a6a52');
    g.fillStyle = grad; g.fillRect(0, 0, 16, 256);
    var tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    var dome = new THREE.Mesh(
      new THREE.SphereGeometry(1400, 20, 12),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false })
    );
    dome.renderOrder = -10;
    scene.add(dome);
    // Sun glow sprite.
    var sc = document.createElement('canvas');
    sc.width = sc.height = 128;
    var sg = sc.getContext('2d');
    var rg = sg.createRadialGradient(64, 64, 4, 64, 64, 64);
    rg.addColorStop(0, 'rgba(255,240,200,1)');
    rg.addColorStop(0.25, 'rgba(255,205,120,0.75)');
    rg.addColorStop(1, 'rgba(255,180,90,0)');
    sg.fillStyle = rg; sg.fillRect(0, 0, 128, 128);
    var sunTex = new THREE.CanvasTexture(sc);
    var sun = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sunTex, blending: THREE.AdditiveBlending, fog: false, depthWrite: false, transparent: true
    }));
    sun.position.set(-620, 210, -880);
    sun.scale.set(560, 560, 1);
    scene.add(sun);
  })();

  var hemi = new THREE.HemisphereLight(0xffe7c4, 0x54606e, 0.65);
  scene.add(hemi);
  var sunLight = new THREE.DirectionalLight(CFG.SUN, 1.05);
  sunLight.position.set(-180, 130, -260);
  scene.add(sunLight);

  // ---------- world ----------
  SF.City.build(scene);
  SF.Cars.init(scene);
  SF.Peds.spawn(scene);
  SF.Player.build(scene);
  SF.Missions.init(scene);
  SF.HUD.init();

  // ---------- screens ----------
  function $(id) { return document.getElementById(id); }
  var startScreen = $('startScreen'), pauseScreen = $('pauseScreen'), endScreen = $('endScreen');
  var endTitle = $('endTitle'), endText = $('endText');
  if (SF.Save.exists()) $('btnContinue').style.display = '';

  function show(el, on) { el.style.display = on ? 'flex' : 'none'; }
  function lockPointer() {
    try {
      var p = renderer.domElement.requestPointerLock();
      if (p && p.catch) p.catch(function () { /* no gesture (demo mode) — drag camera still works */ });
    } catch (e) { /* headless etc. */ }
  }
  function unlockPointer() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  function startGame(fromSave) {
    SF.AU.init();
    SF.Police.clearAll();
    SF.Wanted.clear();
    SF.Missions.reset();
    G.cash = 250;
    G.storyDone = false;
    SF.Player.setHealth(100);
    var spot = SF.City.spots.spawn;
    SF.Player.respawn(spot.x, spot.z);
    G.camYaw = Math.PI;
    G.camPitch = 0.34;
    if (fromSave) {
      var data = SF.Save.load();
      if (data) {
        G.cash = data.cash;
        SF.Missions.setProgress(data.missions);
        G.storyDone = !!data.storyDone;
        SF.Player.respawn(data.x, data.z);
        if (typeof data.heading === 'number') {
          SF.Player.setHeading(data.heading);
          G.camYaw = data.heading;
        }
        SF.HUD.showBanner('WELCOME BACK', 'Sunfall City missed you');
      }
    } else {
      SF.HUD.dialogue([
        { who: 'Marisol', text: 'Rio — gold beacon on your map. Come see me at Café del Sol, south beach.' }
      ]);
    }
    G.mode = 'playing';
    G.started = true;
    show(startScreen, false); show(pauseScreen, false); show(endScreen, false);
    lockPointer();
  }

  function pauseGame() {
    if (G.mode !== 'playing') return;
    G.mode = 'paused';
    SF.Save.save();
    show(pauseScreen, true);
    unlockPointer();
  }
  function resumeGame() {
    if (G.mode !== 'paused') return;
    G.mode = 'playing';
    show(pauseScreen, false);
    lockPointer();
  }
  function quitToMenu() {
    G.mode = 'menu';
    show(pauseScreen, false); show(endScreen, false);
    show(startScreen, true);
    if (SF.Save.exists()) $('btnContinue').style.display = '';
    unlockPointer();
  }

  SF.Game = {
    onBusted: function () {
      if (G.mode !== 'playing') return;
      G.mode = 'busted';
      var fine = Math.min(G.cash, 120 + SF.Wanted.stars() * 40);
      G.cash -= fine;
      SF.Police.clearAll();
      SF.AU.sting(true);
      endTitle.textContent = 'BUSTED';
      endTitle.className = 'busted';
      endText.textContent = 'The Sunfall PD walked you out of the game. Fine paid: $' + fine + '.';
      show(endScreen, true);
      unlockPointer();
      SF.Save.save();
    },
    onWasted: function () {
      if (G.mode !== 'playing') return;
      G.mode = 'wasted';
      var bill = Math.min(G.cash, 200);
      G.cash -= bill;
      SF.Police.clearAll();
      SF.AU.sting(true);
      endTitle.textContent = 'WASTED';
      endTitle.className = 'wasted';
      endText.textContent = 'You woke up outside Sunfall General with a hospital bill of $' + bill + '.';
      show(endScreen, true);
      unlockPointer();
      SF.Save.save();
    }
  };

  function respawnFromEnd() {
    var spot = G.mode === 'wasted' ? SF.City.spots.respawn : SF.City.spots.plaza;
    SF.Player.respawn(spot.x, spot.z);
    show(endScreen, false);
    G.mode = 'playing';
    lockPointer();
  }

  $('btnNew').addEventListener('click', function () { this.blur(); SF.AU.click(); startGame(false); });
  $('btnContinue').addEventListener('click', function () { this.blur(); SF.AU.click(); startGame(true); });
  $('btnResume').addEventListener('click', function () { this.blur(); SF.AU.click(); resumeGame(); });
  $('btnRestart').addEventListener('click', function () { this.blur(); SF.AU.click(); SF.Save.clear(); startGame(false); });
  $('btnMenu').addEventListener('click', function () { this.blur(); SF.AU.click(); quitToMenu(); });
  $('btnRespawn').addEventListener('click', function () { this.blur(); SF.AU.click(); respawnFromEnd(); });

  // ---------- input ----------
  window.addEventListener('keydown', function (e) {
    G.keys[e.code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) >= 0) e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'KeyM') {
      SF.AU.setMuted(!G.muted);
      SF.HUD.toast(G.muted ? 'Sound off' : 'Sound on');
    }
    if (G.mode === 'playing') {
      if (e.code === 'KeyE') SF.Player.enterExit();
      if (e.code === 'KeyF') SF.Player.shoot();
      if (e.code === 'KeyR') SF.Player.startReload();
      if (e.code === 'KeyP' || e.code === 'Escape') pauseGame();
    } else if (G.mode === 'paused' && (e.code === 'KeyP' || e.code === 'Escape')) {
      resumeGame();
    }
  });
  window.addEventListener('keyup', function (e) { G.keys[e.code] = false; });
  window.addEventListener('blur', function () { G.keys = {}; });

  var dragging = false, lastMX = 0, lastMY = 0;
  renderer.domElement.addEventListener('mousedown', function (e) {
    SF.AU.init();
    if (G.mode !== 'playing') return;
    if (!G.pointerLocked) {
      lockPointer();
      dragging = true; lastMX = e.clientX; lastMY = e.clientY;
    } else if (e.button === 0) {
      SF.Player.shoot();
    }
  });
  window.addEventListener('mouseup', function () { dragging = false; });
  window.addEventListener('mousemove', function (e) {
    if (G.mode !== 'playing') return;
    var dx = 0, dy = 0;
    if (G.pointerLocked) { dx = e.movementX || 0; dy = e.movementY || 0; }
    else if (dragging) { dx = e.clientX - lastMX; dy = e.clientY - lastMY; lastMX = e.clientX; lastMY = e.clientY; }
    else return;
    if (dx || dy) {
      G.camYaw -= dx * 0.0026;
      G.camPitch = U.clamp(G.camPitch + dy * 0.0021, 0.05, 1.25);
      G.lastMouseT = G.time;
    }
  });
  document.addEventListener('pointerlockchange', function () {
    G.pointerLocked = document.pointerLockElement === renderer.domElement;
    if (!G.pointerLocked && G.mode === 'playing' && !dragging) {
      // Esc (or the browser) dropped the lock mid-game: treat as pause.
      pauseGame();
    }
    dragging = false;
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && G.mode === 'playing') pauseGame();
  });
  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---------- debug / screenshot API ----------
  SF.startDemo = function () { startGame(false); };
  SF.teleport = function (x, z) {
    if (G.inCar) G.inCar.group.position.set(x, 0, z);
    else SF.Player.group.position.set(x, 0, z);
  };
  SF.setWanted = function (n) { SF.Wanted.setPoints(n * 34); };

  function syncState() {
    var p = SF.Player.group.position;
    SF.state.mode = G.mode;
    SF.state.playerPos.x = Math.round(p.x * 10) / 10;
    SF.state.playerPos.y = Math.round(p.y * 10) / 10;
    SF.state.playerPos.z = Math.round(p.z * 10) / 10;
    SF.state.wanted = Math.round(SF.Wanted.points());
    SF.state.stars = SF.Wanted.stars();
    SF.state.missionIndex = SF.Missions.completed;
    SF.state.cash = G.cash;
    SF.state.health = Math.round(SF.Player.getHealth());
    SF.state.inCar = !!G.inCar;
    document.body.dataset.mode = G.mode;
  }

  // ---------- main loop ----------
  var clock = new THREE.Clock();
  var menuAngle = 0.6;
  function frame() {
    requestAnimationFrame(frame);
    var dt = Math.min(clock.getDelta(), 0.05);
    var mode = G.mode;
    if (mode !== 'paused') G.time += dt;

    if (mode === 'menu') {
      menuAngle += dt * 0.045;
      camera.position.set(Math.sin(menuAngle) * 165, 46, Math.cos(menuAngle) * 165);
      camera.lookAt(0, 6, 0);
      SF.Cars.update(dt);
      SF.Peds.update(dt);
      SF.City.update(dt);
      SF.AU.update(dt, {});
      SF.HUD.update(dt);
    } else if (mode === 'playing') {
      SF.Player.update(dt);
      SF.Cars.update(dt);
      SF.Peds.update(dt);
      SF.Police.update(dt);
      SF.Missions.update(dt);
      SF.City.update(dt);
      SF.Player.updateCamera(dt);
      SF.HUD.update(dt);
      SF.AU.update(dt, {
        engineSpeed: G.inCar ? G.inCar.speed : null,
        sirenDist: SF.Wanted.stars() > 0 ? SF.Police.nearestDist() : null
      });
      G.saveTimer += dt;
      if (G.saveTimer > 25) { G.saveTimer = 0; SF.Save.save(); }
    } else if (mode === 'busted' || mode === 'wasted') {
      SF.Cars.update(dt);
      SF.Peds.update(dt);
      SF.City.update(dt);
      SF.AU.update(dt, {});
      SF.HUD.update(dt);
    }
    syncState();
    renderer.render(scene, camera);
  }
  frame();
})();
