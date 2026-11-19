// SUNFALL CITY — the law: a points-based wanted level (0–5 stars), police
// cars that spawn at the city edge and pursue, officer gunfire at high
// heat, and the bust meter that ends a chase when they pin you down.
(function () {
  'use strict';
  var U = SF.U, CFG = SF.CFG;

  var CRIME = {
    theft: 34,      // → 1 star on its own
    pedHit: 55,
    gunfire: 9,
    crash: 8,
    assault: 30,
    policeHit: 45,
    policeKill: 65
  };
  var MAX_POINTS = 170;

  var points = 0;
  var lastCrimeT = -99;
  var gunfireT = 0;      // throttle for repeated gunfire points
  var bust = 0;          // 0..1
  var cars = [];         // police cars in play
  var shootT = 0;
  var floor = 0;         // mission-imposed minimum points (e.g. the finale)

  function stars() {
    if (points <= 0) return 0;
    return Math.min(5, Math.ceil(points / 34));
  }

  function addCrime(kind) {
    if (SF.G.mode !== 'playing') return;
    var v = CRIME[kind] || 5;
    if (kind === 'gunfire') {
      if (SF.G.time - gunfireT < 0.4) return;
      gunfireT = SF.G.time;
    }
    if (kind === 'crash' && SF.G.time - lastCrimeT < 0.5) return;
    points = Math.min(MAX_POINTS, points + v);
    lastCrimeT = SF.G.time;
  }

  function setPoints(v) { points = U.clamp(v, 0, MAX_POINTS); lastCrimeT = SF.G.time; }
  function setFloor(v) { floor = v; }
  function clear() { points = 0; floor = 0; bust = 0; }

  function anySeesPlayer() {
    if (!SF.Player || !SF.Player.group) return false;
    var pp = SF.Player.group.position;
    for (var i = 0; i < cars.length; i++) {
      if (cars[i].hp > 0 && U.dist2D(pp.x, pp.z, cars[i].group.position.x, cars[i].group.position.z) < 48) return true;
    }
    return false;
  }

  function nearestDist() {
    if (!SF.Player || !SF.Player.group || !cars.length) return null;
    var pp = SF.Player.group.position, best = 1e9;
    for (var i = 0; i < cars.length; i++) {
      var d = U.dist2D(pp.x, pp.z, cars[i].group.position.x, cars[i].group.position.z);
      if (d < best) best = d;
    }
    return best;
  }

  var EDGES = [
    { x: -160, z: -135 }, { x: 160, z: -135 }, { x: -160, z: 135 }, { x: 160, z: 135 },
    { x: -27, z: -168 }, { x: 81, z: -168 }, { x: -81, z: 168 }, { x: 27, z: 168 },
    { x: -168, z: -27 }, { x: 168, z: 81 }
  ];
  function spawnCop() {
    var pp = SF.Player.group.position;
    var spot = null;
    for (var tries = 0; tries < 8; tries++) {
      var cand = U.choice(EDGES);
      if (U.dist2D(pp.x, pp.z, cand.x, cand.z) > 65) { spot = cand; break; }
    }
    if (!spot) spot = EDGES[0];
    var car = SF.Cars.makeCar({
      x: spot.x + U.rand(-4, 4), z: spot.z + U.rand(-4, 4),
      heading: Math.atan2(pp.x - spot.x, pp.z - spot.z),
      kind: 'police', color: 0xf2f3f5
    });
    car.speed = 14;
    cars.push(car);
    return car;
  }

  function desiredCount() {
    var s = stars();
    return [0, 1, 2, 3, 4, 6][s] || 0;
  }

  function updateCop(car, dt) {
    var p = car.group.position;
    var pp = SF.Player.group.position;
    // Flash the light bar.
    if (car.lightMats) {
      var phase = Math.floor(SF.G.time * 5) % 2;
      car.lightMats[0].emissiveIntensity = phase ? 2.4 : 0.15;
      car.lightMats[1].emissiveIntensity = phase ? 0.15 : 2.4;
    }
    if (car.hp <= 0) { // wrecked: sits and smoulders
      car.speed = U.damp(car.speed, 0, 4, dt);
      SF.Cars.moveCar(car, dt);
      return;
    }
    var s = stars();
    var tx = pp.x, tz = pp.z;
    if (SF.G.inCar) { // aim a little ahead of a moving player car
      var pc = SF.G.inCar;
      tx += Math.sin(pc.heading) * pc.speed * 0.45;
      tz += Math.cos(pc.heading) * pc.speed * 0.45;
    }
    var desired = Math.atan2(tx - p.x, tz - p.z);
    // Crude building avoidance: if a collider blocks the nose, steer aside.
    var fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    if (U.pointInColliders(p.x + fx * 7, p.z + fz * 7, SF.City.colliders, 1)) {
      desired += 0.9;
    }
    car.heading = U.turnToward(car.heading, desired, (1.35 + s * 0.09) * dt);
    var distP = U.dist2D(p.x, p.z, pp.x, pp.z);
    var topSpeed = 27 + s * 1.6;
    if (!SF.G.inCar && distP < 7) topSpeed = 0; // don't run a cornered player over
    var want = topSpeed;
    var obs = null;
    // Don't pile into other police cars.
    for (var i = 0; i < cars.length; i++) {
      if (cars[i] === car) continue;
      var o = cars[i].group.position;
      var ahead = (o.x - p.x) * fx + (o.z - p.z) * fz;
      var lat = Math.abs((o.x - p.x) * fz - (o.z - p.z) * fx);
      if (ahead > 0 && ahead < 8 && lat < 2.2) { obs = true; break; }
    }
    if (obs) want = Math.min(want, 6);
    car.speed = U.damp(car.speed, want, want > car.speed ? 1.5 : 4.5, dt);
    var hit = SF.Cars.moveCar(car, dt);
    if (hit > 0.35) car.speed *= 0.35;
  }

  function update(dt) {
    // Wanted decay: unseen and quiet → heat bleeds off.
    if (points > floor) {
      if (SF.G.time - lastCrimeT > 6 && !anySeesPlayer()) {
        points = Math.max(floor, points - 4.5 * dt);
      }
    }
    if (floor > 0 && points < floor) points = floor;

    // Fleet size follows the stars.
    var want = desiredCount();
    var alive = cars.filter(function (c) { return c.hp > 0; }).length;
    if (alive < want && SF.G.mode === 'playing') spawnCop();
    // Retire wrecked / far cars and any fleet surplus when heat is gone.
    for (var i = cars.length - 1; i >= 0; i--) {
      var car = cars[i];
      var d = U.dist2D(car.group.position.x, car.group.position.z,
        SF.Player.group.position.x, SF.Player.group.position.z);
      if ((car.hp <= 0 && d > 25) || (stars() === 0 && d > 60) || d > 190) {
        SF.Cars.removeCar(car);
        cars.splice(i, 1);
      }
    }
    for (var j = 0; j < cars.length; j++) updateCop(cars[j], dt);

    // Officer gunfire at 3+ stars when the player is on foot.
    shootT -= dt;
    if (stars() >= 3 && !SF.G.inCar && SF.G.mode === 'playing' && shootT <= 0) {
      var nd = nearestDist();
      if (nd !== null && nd < 34) {
        shootT = 1.3;
        SF.AU.shot();
        var hitChance = U.clamp(0.62 - nd * 0.014, 0.12, 0.6);
        if (U.rng() < hitChance) SF.Player.takeDamage(6, 'shot');
        else SF.AU.spark();
      }
    }

    // Bust meter: pinned by nearby police while slow or on foot.
    var nd2 = nearestDist();
    var slowOrFoot = !SF.G.inCar || Math.abs(SF.G.inCar.speed) < 1.6;
    if (stars() > 0 && nd2 !== null && nd2 < 10.5 && slowOrFoot && SF.G.mode === 'playing') {
      bust += dt / 2.6;
      if (bust >= 1) {
        bust = 0;
        if (SF.Game && SF.Game.onBusted) SF.Game.onBusted();
      }
    } else {
      bust = Math.max(0, bust - dt * 0.7);
    }
  }

  function clearAll() {
    for (var i = 0; i < cars.length; i++) SF.Cars.removeCar(cars[i]);
    cars.length = 0;
    clear();
  }

  SF.Wanted = {
    addCrime: addCrime,
    setPoints: setPoints,
    setFloor: setFloor,
    clear: clear,
    stars: stars,
    points: function () { return points; }
  };
  SF.Police = {
    cars: cars,
    update: update,
    clearAll: clearAll,
    nearestDist: nearestDist,
    bustAmount: function () { return bust; }
  };
})();
