// SUNFALL CITY — HUD: cash, wanted stars, health, weapon, speed, bust
// meter, objective line, banners, dialogue box, hints — and the circular
// minimap (roads, water, blips for traffic / police / mission markers).
(function () {
  'use strict';
  var U = SF.U, CFG = SF.CFG;

  var el = {};
  var bannerTimer = null;
  var dlgQueue = [];
  var dlgT = 0;
  var lastObjective = null;
  var lastCash = null, lastStars = -1, lastHealth = -1, lastWeapon = '', lastSpeed = '';

  function byId(id) { return document.getElementById(id); }

  function init() {
    ['hud', 'minimap', 'cashVal', 'stars', 'healthFill', 'weaponVal', 'speedWrap',
     'speedVal', 'objective', 'timerVal', 'banner', 'bannerTitle', 'bannerSub',
     'dialogue', 'dlgWho', 'dlgText', 'bustWrap', 'bustFill', 'hint', 'dmg', 'toast'
    ].forEach(function (id) { el[id] = byId(id); });
  }

  function showBanner(title, sub) {
    if (!el.banner) return;
    el.bannerTitle.textContent = title || '';
    el.bannerSub.textContent = sub || '';
    el.banner.classList.add('show');
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { el.banner.classList.remove('show'); }, 2700);
  }

  function toast(text) {
    if (!el.toast) return;
    el.toast.textContent = text;
    el.toast.classList.add('show');
    setTimeout(function () { el.toast.classList.remove('show'); }, 1400);
  }

  function dialogue(lines) {
    for (var i = 0; i < lines.length; i++) dlgQueue.push(lines[i]);
    if (el.dialogue && !el.dialogue.classList.contains('show') && dlgQueue.length) {
      nextDialogue();
    }
  }
  function nextDialogue() {
    var line = dlgQueue.shift();
    if (!line) { el.dialogue.classList.remove('show'); return; }
    el.dlgWho.textContent = line.who;
    el.dlgText.textContent = line.text;
    el.dialogue.classList.add('show');
    dlgT = 3.6;
  }

  function setObjective(text) {
    if (text === lastObjective) return;
    lastObjective = text;
    if (el.objective) el.objective.textContent = text || '';
  }

  // ---------- minimap ----------
  function drawMinimap() {
    var cv = el.minimap;
    if (!cv || !SF.Player || !SF.Player.group) return;
    var g = cv.getContext('2d');
    var W = cv.width, H = cv.height, cx = W / 2, cy = H / 2;
    var pp = SF.Player.group.position;
    var S = 1.0; // px per metre; view radius ~96 m
    function mx(wx) { return cx + (wx - pp.x) * S; }
    function mz(wz) { return cy + (wz - pp.z) * S; }
    g.save();
    g.beginPath(); g.arc(cx, cy, cx - 2, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#232d38'; g.fillRect(0, 0, W, H);
    // Sand + water (south).
    g.fillStyle = '#c9b183';
    g.fillRect(0, mz(CFG.BEACH_Z), W, mz(CFG.WATER_Z) - mz(CFG.BEACH_Z));
    g.fillStyle = '#2f7d9e';
    g.fillRect(0, mz(CFG.WATER_Z), W, H - mz(CFG.WATER_Z));
    // Blocks.
    g.fillStyle = '#39434e';
    SF.City.blocks.forEach(function (b) {
      g.fillRect(mx(b.minX), mz(b.minZ), (b.maxX - b.minX) * S, (b.maxZ - b.minZ) * S);
    });
    // Roads.
    g.fillStyle = '#5b6672';
    CFG.ROAD_CENTERS.forEach(function (c) {
      g.fillRect(mx(c) - 7 * S, mz(CFG.CITY_MIN), 14 * S, (CFG.CITY_MAX - CFG.CITY_MIN) * S);
      g.fillRect(mx(CFG.CITY_MIN), mz(c) - 7 * S, (CFG.CITY_MAX - CFG.CITY_MIN) * S, 14 * S);
    });
    // Named spots.
    var spots = SF.City.spots;
    function spotDot(p, color, size) {
      if (!p) return;
      g.fillStyle = color;
      g.fillRect(mx(p.x) - size / 2, mz(p.z) - size / 2, size, size);
    }
    spotDot(spots.garage, '#f07f2e', 6);
    spotDot(spots.hospital, '#ffffff', 6);
    spotDot(spots.safehouse, '#59b06a', 6);
    spotDot(spots.cafe, '#f2c94c', 5);
    // Traffic.
    g.fillStyle = '#e8e4da';
    SF.Cars.list.forEach(function (car) {
      if (car.kind !== 'traffic' && car.kind !== 'parked') return;
      var d = U.dist2D(pp.x, pp.z, car.group.position.x, car.group.position.z);
      if (d > 100) return;
      g.fillRect(mx(car.group.position.x) - 1.5, mz(car.group.position.z) - 1.5, 3, 3);
    });
    // Police (flashing).
    SF.Police.cars.forEach(function (car) {
      var d = U.dist2D(pp.x, pp.z, car.group.position.x, car.group.position.z);
      if (d > 110) return;
      g.fillStyle = Math.floor(SF.G.time * 5) % 2 ? '#ff4040' : '#4080ff';
      g.fillRect(mx(car.group.position.x) - 2.5, mz(car.group.position.z) - 2.5, 5, 5);
    });
    // Mission marker.
    var mp = SF.Missions.markerPos;
    if (mp) {
      var pulse = 4.5 + Math.sin(SF.G.time * 5) * 1.2;
      g.fillStyle = '#ffc93a';
      g.save();
      g.translate(mx(mp.x), mz(mp.z));
      g.rotate(Math.PI / 4);
      g.fillRect(-pulse / 2, -pulse / 2, pulse, pulse);
      g.restore();
    }
    // Player arrow. On the north-up map a world heading h (forward =
    // (sin h, cos h) in x/z) points at screen angle PI - h.
    var hd = SF.G.inCar ? SF.G.inCar.heading : SF.Player.getHeading();
    g.save();
    g.translate(cx, cy);
    g.rotate(Math.PI - hd);
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#14202c'; g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(0, -7); g.lineTo(5, 5); g.lineTo(0, 2.4); g.lineTo(-5, 5); g.closePath();
    g.fill(); g.stroke();
    g.restore();
    g.restore();
    // Rim.
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2;
    g.beginPath(); g.arc(cx, cy, cx - 2, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.font = 'bold 10px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText('N', cx, 13);
  }
  function update(dt) {
    if (!el.hud) return;
    var playing = SF.G.mode === 'playing' || SF.G.mode === 'paused';
    el.hud.style.display = playing ? 'block' : 'none';
    if (!playing) return;

    var cash = SF.G.cash;
    if (cash !== lastCash) {
      lastCash = cash;
      el.cashVal.textContent = '$' + cash.toLocaleString('en-US');
    }
    var st = SF.Wanted.stars();
    if (st !== lastStars) {
      lastStars = st;
      var s = '';
      for (var i = 0; i < 5; i++) s += i < st ? '★' : '☆';
      el.stars.textContent = s;
      el.stars.style.opacity = st ? '1' : '0.25';
    }
    var hp = Math.round(SF.Player.getHealth());
    if (hp !== lastHealth) {
      lastHealth = hp;
      el.healthFill.style.width = hp + '%';
      el.healthFill.style.background = hp > 50 ? '#59d06a' : (hp > 25 ? '#f2c94c' : '#e8574a');
    }
    var wp = SF.Player.isReloading() ? 'RELOADING…'
      : (SF.G.inCar ? '—' : 'PISTOL · ' + SF.Player.getAmmo());
    if (wp !== lastWeapon) { lastWeapon = wp; el.weaponVal.textContent = wp; }
    if (SF.G.inCar) {
      el.speedWrap.style.display = 'block';
      var sp = Math.round(Math.abs(SF.G.inCar.speed) * 3.6) + ' km/h';
      if (sp !== lastSpeed) { lastSpeed = sp; el.speedVal.textContent = sp; }
    } else {
      el.speedWrap.style.display = 'none';
    }
    el.timerVal.textContent = SF.Missions.timerText || '';
    el.hint.textContent = SF.G.hint || '';
    el.hint.style.opacity = SF.G.hint ? '1' : '0';
    var bust = SF.Police.bustAmount();
    el.bustWrap.style.display = bust > 0.02 ? 'block' : 'none';
    if (bust > 0.02) el.bustFill.style.width = Math.round(bust * 100) + '%';
    // Dialogue timing.
    if (el.dialogue.classList.contains('show')) {
      dlgT -= dt;
      if (dlgT <= 0) nextDialogue();
    }
    // Damage vignette decay.
    SF.G.damageFlash = Math.max(0, SF.G.damageFlash - dt * 1.7);
    el.dmg.style.opacity = String(SF.G.damageFlash * 0.85);
    drawMinimap();
  }

  SF.HUD = {
    init: init,
    update: update,
    showBanner: showBanner,
    toast: toast,
    dialogue: dialogue,
    setObjective: setObjective
  };
})();
