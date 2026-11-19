// SUNFALL CITY — cars: stylized box-built vehicles, right-hand traffic AI
// that follows the road grid, parked cars, arcade driving physics for the
// player's car, and car-vs-world / car-vs-car collision.
(function () {
  'use strict';
  var U = SF.U, CFG = SF.CFG, C = CFG.ROAD_CENTERS;

  var list = [];       // every car in the world
  var hitMeshes = [];  // body meshes the player's raycast can hit
  var sceneRef = null;

  var COLORS = [0xd84f35, 0x3f7fbf, 0xe8c33a, 0x59b06a, 0xe8e4da, 0x7458a8,
                0xd87fb0, 0x3fb0a8, 0x8a8f96, 0x2e3440, 0xf07f2e, 0xbfd84f];
  var glassMat = new THREE.MeshLambertMaterial({ color: 0x1d2733 });
  var tyreMat = new THREE.MeshLambertMaterial({ color: 0x17181a });
  var shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
  var wheelGeo = new THREE.CylinderGeometry(0.37, 0.37, 0.32, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  var shadowGeo = new THREE.PlaneGeometry(2.7, 5.3);

  function makeCar(opts) {
    opts = opts || {};
    var group = new THREE.Group();
    var color = opts.color !== undefined ? opts.color : U.choice(COLORS);
    var bodyMat = new THREE.MeshLambertMaterial({ color: color });
    var body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, 4.4), bodyMat);
    body.position.y = 0.62;
    group.add(body);
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.55, 2.1), opts.police ? bodyMat : glassMat);
    cabin.position.set(0, 1.18, -0.25);
    group.add(cabin);
    if (!opts.police) {
      var roofPanel = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.07, 2.0), bodyMat);
      roofPanel.position.set(0, 1.49, -0.25);
      group.add(roofPanel);
    }
    // Lights.
    var headMat = new THREE.MeshLambertMaterial({ color: 0xfff2c0, emissive: 0xffdf8a, emissiveIntensity: 0.7 });
    var tailMat = new THREE.MeshLambertMaterial({ color: 0xa01818, emissive: 0xd02020, emissiveIntensity: 0.6 });
    [-0.6, 0.6].forEach(function (lx) {
      var h = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), headMat);
      h.position.set(lx, 0.72, 2.21); group.add(h);
      var t = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), tailMat);
      t.position.set(lx, 0.72, -2.21); group.add(t);
    });
    // Wheels: front pair on steering pivots.
    function wheel(x, z, steer) {
      var pivot = new THREE.Group();
      pivot.position.set(x, 0.37, z);
      var w = new THREE.Mesh(wheelGeo, tyreMat);
      pivot.add(w);
      group.add(pivot);
      return { pivot: pivot, mesh: w };
    }
    var wheels = {
      fl: wheel(-0.88, 1.5, true), fr: wheel(0.88, 1.5, true),
      rl: wheel(-0.88, -1.5, false), rr: wheel(0.88, -1.5, false)
    };
    var shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    group.add(shadow);

    var car = {
      group: group, body: body, bodyMat: bodyMat, tailMat: tailMat, wheels: wheels,
      heading: opts.heading || 0, speed: 0, hp: 100,
      kind: opts.kind || 'traffic',
      color: color, stolen: false, driverPed: null,
      nav: null, targetSpeed: 11, braking: false,
      stuckT: 0, lastX: 0, lastZ: 0, crimeT: 0,
      lightMats: null, baseColor: color
    };
    body.userData.car = car;

    if (opts.police) {
      // Black doors stripe + red/blue light bar.
      var stripe = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.3, 2.2),
        new THREE.MeshLambertMaterial({ color: 0x14161a }));
      stripe.position.set(0, 0.66, -0.2);
      group.add(stripe);
      var redMat = new THREE.MeshLambertMaterial({ color: 0xff2a2a, emissive: 0xff2020, emissiveIntensity: 2 });
      var blueMat = new THREE.MeshLambertMaterial({ color: 0x2a4aff, emissive: 0x2040ff, emissiveIntensity: 0.2 });
      var barBase = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.1, 0.5),
        new THREE.MeshLambertMaterial({ color: 0x22242a }));
      barBase.position.set(0, 1.52, -0.25);
      group.add(barBase);
      var rl = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.42), redMat);
      rl.position.set(-0.34, 1.64, -0.25); group.add(rl);
      var bl = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.42), blueMat);
      bl.position.set(0.34, 1.64, -0.25); group.add(bl);
      car.lightMats = [redMat, blueMat];
    }
    if (opts.taxi) {
      var sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.34),
        new THREE.MeshLambertMaterial({ color: 0xfff6c8, emissive: 0xffe98a, emissiveIntensity: 0.8 }));
      sign.position.set(0, 1.62, -0.25);
      group.add(sign);
    }
    group.position.set(opts.x || 0, 0, opts.z || 0);
    group.rotation.y = car.heading;
    if (sceneRef) sceneRef.add(group);
    list.push(car);
    hitMeshes.push(body);
    return car;
  }

  function removeCar(car) {
    if (sceneRef) sceneRef.remove(car.group);
    var i = list.indexOf(car); if (i >= 0) list.splice(i, 1);
    var j = hitMeshes.indexOf(car.body); if (j >= 0) hitMeshes.splice(j, 1);
  }

  // ---------- traffic navigation ----------
  function nextCenterAlong(coord, dir) {
    var best = null;
    for (var i = 0; i < C.length; i++) {
      if (dir > 0 && C[i] > coord + 1 && (best === null || C[i] < best)) best = C[i];
      if (dir < 0 && C[i] < coord - 1 && (best === null || C[i] > best)) best = C[i];
    }
    return best;
  }
  function laneCross(nav) {
    // Right-hand traffic. Right of travel: +X facing is +Z, +Z facing is -X.
    return nav.axis === 'x' ? nav.road + nav.dir * CFG.LANE_OFF
                            : nav.road - nav.dir * CFG.LANE_OFF;
  }
  function navTarget(nav) {
    var cross = laneCross(nav);
    return nav.axis === 'x' ? { x: nav.next, z: cross } : { x: cross, z: nav.next };
  }
  function freshNav(axis, dir, road, along) {
    var nav = { axis: axis, dir: dir, road: road, next: nextCenterAlong(along, dir) };
    if (nav.next === null) { nav.dir = -dir; nav.next = nextCenterAlong(along, nav.dir); }
    return nav;
  }
  function chooseAtIntersection(car) {
    var nav = car.nav;
    var at = nav.next; // intersection centre along travel axis
    var options = [];
    // Straight on.
    var straightNext = nextCenterAlong(at, nav.dir);
    if (straightNext !== null) options.push({ axis: nav.axis, dir: nav.dir, road: nav.road, next: straightNext, w: 3 });
    // Turns onto the crossing road (road centre = `at`).
    var other = nav.axis === 'x' ? 'z' : 'x';
    var leftDir = nav.axis === 'x' ? -nav.dir : nav.dir;
    var rightDir = -leftDir;
    var alongHere = nav.axis === 'x' ? car.group.position.z : car.group.position.x;
    var ln = nextCenterAlong(alongHere, leftDir);
    if (ln !== null) options.push({ axis: other, dir: leftDir, road: at, next: ln, w: 2 });
    var rn = nextCenterAlong(alongHere, rightDir);
    if (rn !== null) options.push({ axis: other, dir: rightDir, road: at, next: rn, w: 2 });
    if (!options.length) { // dead end: U-turn
      car.nav = freshNav(nav.axis, -nav.dir, nav.road, nav.axis === 'x' ? car.group.position.x : car.group.position.z);
      return;
    }
    var total = 0, i;
    for (i = 0; i < options.length; i++) total += options[i].w;
    var pick = U.rng() * total;
    for (i = 0; i < options.length; i++) { pick -= options[i].w; if (pick <= 0) { car.nav = options[i]; return; } }
    car.nav = options[0];
  }

  function spawnTraffic() {
    for (var i = 0; i < CFG.TRAFFIC_COUNT; i++) {
      var axis = U.chance(0.5) ? 'x' : 'z';
      var road = U.choice(C);
      var dir = U.chance(0.5) ? 1 : -1;
      var along = U.rand(-155, 155);
      var nav = freshNav(axis, dir, road, along);
      var cross = laneCross(nav);
      var x = axis === 'x' ? along : cross;
      var z = axis === 'x' ? cross : along;
      var heading = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
      var car = makeCar({ x: x, z: z, heading: heading, kind: 'traffic', taxi: U.chance(0.14) });
      car.nav = nav;
      car.speed = U.rand(6, 10);
      car.targetSpeed = U.rand(9.5, 12.5);
    }
    // Parked cars along road edges at block middles.
    for (var p = 0; p < CFG.PARKED_COUNT; p++) {
      var vertical = U.chance(0.5);
      var rc = U.choice(C);
      var mid = U.choice([-108, -54, 0, 54, 108]) + U.rand(-6, 6);
      var side = U.chance(0.5) ? 5.7 : -5.7;
      var px = vertical ? rc + side : mid;
      var pz = vertical ? mid : rc + side;
      if (U.pointInColliders(px, pz, SF.City.colliders, 2)) continue;
      var hd = vertical ? (side > 0 ? Math.PI : 0) : (side > 0 ? -Math.PI / 2 : Math.PI / 2);
      makeCar({ x: px, z: pz, heading: hd, kind: 'parked' });
    }
  }

  // ---------- shared car motion ----------
  function moveCar(car, dt) {
    var p = car.group.position;
    p.x += Math.sin(car.heading) * car.speed * dt;
    p.z += Math.cos(car.heading) * car.speed * dt;
    // Building collision via two circles along the body.
    var fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    var hit = 0;
    [1.45, -1.45].forEach(function (off) {
      var c = { x: p.x + fx * off, z: p.z + fz * off };
      var beforeX = c.x, beforeZ = c.z;
      var depth = U.resolveCircle(c, 1.5, SF.City.colliders);
      if (depth > 0) {
        p.x += c.x - beforeX; p.z += c.z - beforeZ;
        if (depth > hit) hit = depth;
      }
    });
    // World bounds.
    if (p.x < -CFG.BOUND_X || p.x > CFG.BOUND_X || p.z < CFG.BOUND_Z_MIN || p.z > CFG.BOUND_Z_MAX) {
      p.x = U.clamp(p.x, -CFG.BOUND_X, CFG.BOUND_X);
      p.z = U.clamp(p.z, CFG.BOUND_Z_MIN, CFG.BOUND_Z_MAX);
      hit = Math.max(hit, 0.4);
    }
    car.group.rotation.y = car.heading;
    // Wheel spin + steering visual.
    var spin = car.speed * dt / 0.37;
    car.wheels.fl.mesh.rotation.x += spin;
    car.wheels.fr.mesh.rotation.x += spin;
    car.wheels.rl.mesh.rotation.x += spin;
    car.wheels.rr.mesh.rotation.x += spin;
    return hit;
  }

  function obstacleAhead(car, dist) {
    var p = car.group.position;
    var fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      if (o === car) continue;
      var dx = o.group.position.x - p.x, dz = o.group.position.z - p.z;
      var ahead = dx * fx + dz * fz;
      if (ahead > 0 && ahead < dist) {
        var lat = Math.abs(dx * fz - dz * fx);
        if (lat < 2.1) return o;
      }
    }
    // The player on foot.
    if (!SF.G.inCar && SF.Player && SF.Player.group) {
      var pp = SF.Player.group.position;
      var pdx = pp.x - p.x, pdz = pp.z - p.z;
      var pa = pdx * fx + pdz * fz;
      if (pa > 0 && pa < dist * 0.8 && Math.abs(pdx * fz - pdz * fx) < 1.6) return 'player';
    }
    return null;
  }

  function updateTrafficCar(car, dt) {
    if (!car.nav) return;
    var p = car.group.position;
    var tgt = navTarget(car.nav);
    var dx = tgt.x - p.x, dz = tgt.z - p.z;
    var distT = Math.sqrt(dx * dx + dz * dz);
    if (distT < 7) { chooseAtIntersection(car); tgt = navTarget(car.nav); dx = tgt.x - p.x; dz = tgt.z - p.z; }
    var desired = Math.atan2(dx, dz);
    var err = U.wrapAngle(desired - car.heading);
    car.heading = U.turnToward(car.heading, desired, (1.5 - Math.min(0.7, Math.abs(car.speed) * 0.03)) * dt);
    var want = car.targetSpeed;
    if (Math.abs(err) > 0.45) want = Math.min(want, 5);
    car.braking = false;
    if (obstacleAhead(car, 10)) { want = 0; car.braking = true; }
    car.speed = U.damp(car.speed, want, want > car.speed ? 1.2 : 5, dt);
    var hit = moveCar(car, dt);
    if (hit > 0.3) car.speed *= 0.4;
    car.tailMat.emissiveIntensity = car.braking ? 2.2 : 0.6;
    // Stuck? Respawn somewhere quiet.
    car.stuckT += dt;
    if (car.stuckT > 3) {
      car.stuckT = 0;
      if (Math.abs(car.speed) < 0.6 && U.dist2D(p.x, p.z, car.lastX, car.lastZ) < 1.2) {
        respawnTraffic(car);
      }
      car.lastX = p.x; car.lastZ = p.z;
    }
  }

  function respawnTraffic(car) {
    var axis = U.chance(0.5) ? 'x' : 'z';
    var road = U.choice(C);
    var dir = U.chance(0.5) ? 1 : -1;
    var along = U.rand(-155, 155);
    car.nav = freshNav(axis, dir, road, along);
    var cross = laneCross(car.nav);
    car.group.position.set(axis === 'x' ? along : cross, 0, axis === 'x' ? cross : along);
    car.heading = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    car.speed = 7;
    // Keep it away from the player.
    if (SF.Player && U.dist2D(car.group.position.x, car.group.position.z,
        SF.Player.group.position.x, SF.Player.group.position.z) < 30) {
      car.group.position.x += 60; car.group.position.z += 60;
    }
  }

  // ---------- the player's car ----------
  function updatePlayerCar(car, dt) {
    var k = SF.G.keys;
    var throttle = (k['KeyW'] || k['ArrowUp']) ? 1 : ((k['KeyS'] || k['ArrowDown']) ? -1 : 0);
    var steer = ((k['KeyA'] || k['ArrowLeft']) ? 1 : 0) + ((k['KeyD'] || k['ArrowRight']) ? -1 : 0);
    var hand = !!k['Space'];
    var MAXF = 36, MAXR = 11;
    if (throttle > 0) car.speed += 14 * dt * (1 - Math.max(0, car.speed) / (MAXF * 1.6));
    else if (throttle < 0) {
      if (car.speed > 0.6) car.speed -= 30 * dt;
      else car.speed = Math.max(-MAXR, car.speed - 9 * dt);
    }
    // Drag + rolling resistance.
    car.speed -= car.speed * 0.32 * dt;
    if (throttle === 0) car.speed = Math.abs(car.speed) < 0.25 ? 0 : car.speed - Math.sign(car.speed) * 1.4 * dt;
    if (hand) car.speed -= car.speed * 2.6 * dt;
    car.speed = U.clamp(car.speed, -MAXR, MAXF);
    var turnAuthority = U.clamp(Math.abs(car.speed) * 0.13, 0, 1.1) * (hand ? 1.5 : 1);
    if (car.speed !== 0) car.heading += steer * turnAuthority * dt * (car.speed < 0 ? -1 : 1);
    car.wheels.fl.pivot.rotation.y = steer * 0.42;
    car.wheels.fr.pivot.rotation.y = steer * 0.42;
    car.braking = throttle < 0 && car.speed > 0.6;
    car.tailMat.emissiveIntensity = car.braking || hand ? 2.2 : 0.6;
    var impactSpeed = Math.abs(car.speed);
    var hit = moveCar(car, dt);
    if (hit > 0.22) {
      if (impactSpeed > 7) {
        SF.AU.thud(impactSpeed > 13);
        car.hp -= (impactSpeed - 6) * 1.6;
        if (SF.Wanted) SF.Wanted.addCrime('crash');
        if (impactSpeed > 15 && SF.Player) SF.Player.takeDamage((impactSpeed - 14) * 1.1, 'crash');
      }
      car.speed *= hit > 0.5 ? -0.28 : 0.55;
    }
    tintDamage(car);
  }

  function tintDamage(car) {
    if (car.hp < 45) {
      var f = 0.45 + car.hp / 100;
      car.bodyMat.color.setHex(car.baseColor).multiplyScalar(f);
    }
  }

  // ---------- car vs car ----------
  function updateCollisions(dt) {
    for (var i = 0; i < list.length; i++) {
      for (var j = i + 1; j < list.length; j++) {
        var a = list[i], b = list[j];
        var pa = a.group.position, pb = b.group.position;
        var dx = pb.x - pa.x, dz = pb.z - pa.z;
        var d2 = dx * dx + dz * dz;
        if (d2 > 20.25 || d2 < 0.0001) continue;
        var d = Math.sqrt(d2), min = 4.3;
        var push = (min - d) / 2;
        var nx = dx / d, nz = dz / d;
        var aPlayer = SF.G.inCar === a, bPlayer = SF.G.inCar === b;
        if (!aPlayer) { pa.x -= nx * push; pa.z -= nz * push; }
        if (!bPlayer) { pb.x += nx * push; pb.z += nz * push; }
        if (aPlayer) { pb.x += nx * push * 2; pb.z += nz * push * 2; }
        if (bPlayer) { pa.x -= nx * push * 2; pa.z -= nz * push * 2; }
        var rel = Math.abs(a.speed - b.speed);
        if (rel > 5) {
          a.hp -= rel * 1.2; b.hp -= rel * 1.2;
          tintDamage(a); tintDamage(b);
          if (aPlayer || bPlayer) {
            SF.AU.thud(rel > 10);
            if (SF.Wanted) {
              if (b.kind === 'police' || a.kind === 'police') SF.Wanted.addCrime('policeHit');
              else SF.Wanted.addCrime('crash');
            }
            if (rel > 13 && SF.Player) SF.Player.takeDamage((rel - 11) * 0.9, 'crash');
            a.speed *= 0.55; b.speed *= 0.55;
          } else {
            a.speed *= 0.7; b.speed *= 0.7;
          }
          if (b.driverPed && SF.Peds) SF.Peds.panicAt(pb.x, pb.z, 10);
          if (a.driverPed && SF.Peds) SF.Peds.panicAt(pa.x, pa.z, 10);
        }
      }
    }
  }

  function nearestCar(pos, maxDist) {
    var best = null, bd = maxDist;
    for (var i = 0; i < list.length; i++) {
      var p = list[i].group.position;
      var d = U.dist2D(pos.x, pos.z, p.x, p.z);
      if (d < bd) { bd = d; best = list[i]; }
    }
    return best;
  }

  function init(scene) {
    sceneRef = scene;
    spawnTraffic();
  }

  function update(dt) {
    for (var i = 0; i < list.length; i++) {
      var car = list[i];
      if (car.kind === 'traffic') updateTrafficCar(car, dt);
    }
    updateCollisions(dt);
  }

  SF.Cars = {
    list: list,
    hitMeshes: hitMeshes,
    init: init,
    update: update,
    makeCar: makeCar,
    removeCar: removeCar,
    updatePlayerCar: updatePlayerCar,
    nearestCar: nearestCar,
    moveCar: moveCar,
    tintDamage: tintDamage
  };
})();
