// SUNFALL CITY — pedestrians: stylized low-poly people who stroll the
// sidewalks around each block, stroll the beach promenade, flee from
// danger, and go down when hit — then get up and run.
(function () {
  'use strict';
  var U = SF.U, CFG = SF.CFG;

  var list = [];
  var hitMeshes = [];
  var sceneRef = null;

  var SKIN = [0xf2c49b, 0xd9a066, 0xa86f3c, 0x7a4a26, 0xffe0bd];
  var SHIRT = [0xe8574a, 0x3f8fbf, 0xf2c94c, 0x59b06a, 0xe8e4da, 0x7458a8, 0x3fb0a8, 0xf07f2e, 0xef8fb8];
  var PANTS = [0x2e3440, 0x4a5a75, 0x6b4a2f, 0x3a3f46, 0x7a8288];

  var legGeo = new THREE.BoxGeometry(0.36, 0.52, 0.22);
  var torsoGeo = new THREE.BoxGeometry(0.46, 0.62, 0.25);
  var headGeo = new THREE.BoxGeometry(0.27, 0.29, 0.27);

  function makePed() {
    var group = new THREE.Group();
    var legs = new THREE.Mesh(legGeo, new THREE.MeshLambertMaterial({ color: U.choice(PANTS) }));
    legs.position.y = 0.26;
    group.add(legs);
    var torso = new THREE.Mesh(torsoGeo, new THREE.MeshLambertMaterial({ color: U.choice(SHIRT) }));
    torso.position.y = 0.83;
    group.add(torso);
    var head = new THREE.Mesh(headGeo, new THREE.MeshLambertMaterial({ color: U.choice(SKIN) }));
    head.position.y = 1.3;
    group.add(head);
    var ped = {
      group: group, legs: legs, torso: torso, head: head,
      state: 'walk', stateT: 0, phase: U.rand(0, 6),
      speed: U.rand(1.1, 1.7), heading: 0,
      path: null, s: 0, dirSign: 1,
      fleeX: 0, fleeZ: 1, downCause: null
    };
    torso.userData.ped = ped;
    head.userData.ped = ped;
    hitMeshes.push(torso, head);
    if (sceneRef) sceneRef.add(group);
    list.push(ped);
    return ped;
  }

  // A rectangular walking loop inset from a block's edges (the sidewalk).
  function blockPath(block) {
    var cx = (block.minX + block.maxX) / 2, cz = (block.minZ + block.maxZ) / 2;
    var hx = (block.maxX - block.minX) / 2 - 1.8, hz = (block.maxZ - block.minZ) / 2 - 1.8;
    return { type: 'rect', cx: cx, cz: cz, hx: hx, hz: hz, len: 4 * (hx + hz) };
  }
  function rectPoint(path, s) {
    // Perimeter walk, s in [0, len). Sides: +x edge, +z edge, -x edge, -z edge.
    var hx = path.hx, hz = path.hz;
    var sideA = hx * 2, sideB = hz * 2;
    s = ((s % (2 * sideA + 2 * sideB)) + 2 * sideA + 2 * sideB) % (2 * sideA + 2 * sideB);
    if (s < sideA) return { x: path.cx - hx + s, z: path.cz - hz, hx: 1, hz: 0 };
    s -= sideA;
    if (s < sideB) return { x: path.cx + hx, z: path.cz - hz + s, hx: 0, hz: 1 };
    s -= sideB;
    if (s < sideA) return { x: path.cx + hx - s, z: path.cz + hz, hx: -1, hz: 0 };
    s -= sideA;
    return { x: path.cx - hx, z: path.cz + hz - s, hx: 0, hz: -1 };
  }

  function assignBlockPath(ped) {
    var block = U.choice(SF.City.blocks);
    ped.path = blockPath(block);
    ped.s = U.rand(0, 130);
    ped.dirSign = U.chance(0.5) ? 1 : -1;
  }

  function spawn(scene) {
    sceneRef = scene;
    for (var i = 0; i < CFG.PED_COUNT; i++) {
      var ped = makePed();
      if (i < 6) { // promenade strollers
        ped.path = { type: 'line', z: 171.5 };
        ped.s = U.rand(-150, 150);
        ped.dirSign = U.chance(0.5) ? 1 : -1;
        ped.group.position.set(ped.s, 0, 171.5);
      } else {
        assignBlockPath(ped);
        var pt = rectPoint(ped.path, ped.s);
        ped.group.position.set(pt.x, 0, pt.z);
      }
    }
  }

  function panicAt(x, z, radius) {
    for (var i = 0; i < list.length; i++) {
      var ped = list[i];
      if (ped.state === 'down') continue;
      var p = ped.group.position;
      var d = U.dist2D(p.x, p.z, x, z);
      if (d < radius) {
        ped.state = 'flee';
        ped.stateT = U.rand(2, 3.6);
        var dx = p.x - x, dz = p.z - z;
        var m = Math.sqrt(dx * dx + dz * dz) || 1;
        ped.fleeX = dx / m + U.rand(-0.3, 0.3);
        ped.fleeZ = dz / m + U.rand(-0.3, 0.3);
      }
    }
  }

  function knockDown(ped, cause) {
    if (ped.state === 'down') return;
    ped.state = 'down';
    ped.stateT = cause === 'car' ? 5 : 6.5;
    ped.downCause = cause;
    ped.group.rotation.x = -Math.PI / 2;
    ped.group.position.y = 0.28;
  }

  function updatePed(ped, dt) {
    var p = ped.group.position;
    ped.phase += dt * (ped.state === 'flee' ? 11 : 6.5);
    if (ped.state === 'down') {
      ped.stateT -= dt;
      if (ped.stateT <= 0) {
        ped.group.rotation.x = 0;
        ped.group.position.y = 0;
        ped.state = 'flee';
        ped.stateT = 2.2;
        ped.fleeX = Math.sin(ped.heading); ped.fleeZ = Math.cos(ped.heading);
      }
      return;
    }
    if (ped.state === 'flee') {
      ped.stateT -= dt;
      var fl = Math.sqrt(ped.fleeX * ped.fleeX + ped.fleeZ * ped.fleeZ) || 1;
      p.x += (ped.fleeX / fl) * 4.3 * dt;
      p.z += (ped.fleeZ / fl) * 4.3 * dt;
      ped.heading = Math.atan2(ped.fleeX / fl, ped.fleeZ / fl);
      U.resolveCircle(p, 0.35, SF.City.colliders);
      p.x = U.clamp(p.x, -CFG.BOUND_X, CFG.BOUND_X);
      p.z = U.clamp(p.z, CFG.BOUND_Z_MIN, CFG.BOUND_Z_MAX);
      if (ped.stateT <= 0) {
        ped.state = 'walk';
        assignBlockPath(ped);
        // Snap the loop parameter to the closest point so the ped rejoins smoothly.
        var bestS = 0, bestD = 1e9;
        for (var s = 0; s < 146; s += 4) {
          var pt = rectPoint(ped.path, s);
          var d = U.dist2D(p.x, p.z, pt.x, pt.z);
          if (d < bestD) { bestD = d; bestS = s; }
        }
        ped.s = bestS;
      }
    } else { // walk
      if (ped.path.type === 'line') {
        ped.s += ped.dirSign * ped.speed * dt;
        if (ped.s > 155) ped.dirSign = -1;
        if (ped.s < -155) ped.dirSign = 1;
        p.x = ped.s; p.z = ped.path.z + Math.sin(ped.s * 0.05) * 0.4;
        ped.heading = ped.dirSign > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        ped.s += ped.dirSign * ped.speed * dt;
        var pt2 = rectPoint(ped.path, ped.s);
        p.x = pt2.x; p.z = pt2.z;
        ped.heading = Math.atan2(pt2.hx * ped.dirSign, pt2.hz * ped.dirSign);
      }
    }
    ped.group.rotation.y = ped.heading;
    p.y = Math.abs(Math.sin(ped.phase)) * 0.05;
    ped.legs.rotation.x = Math.sin(ped.phase) * 0.45;
  }

  function update(dt) {
    for (var i = 0; i < list.length; i++) updatePed(list[i], dt);
    // The player's car running someone down.
    var car = SF.G.inCar;
    if (car && Math.abs(car.speed) > 3) {
      var cp = car.group.position;
      for (var j = 0; j < list.length; j++) {
        var ped = list[j];
        if (ped.state === 'down') continue;
        var p = ped.group.position;
        if (U.dist2D(p.x, p.z, cp.x, cp.z) < 2.7) {
          knockDown(ped, 'car');
          if (SF.Wanted) SF.Wanted.addCrime('pedHit');
          if (SF.AU) SF.AU.thud(false);
          car.speed *= 0.82;
          panicAt(p.x, p.z, 14);
        }
      }
    }
  }

  // Spawn one extra pedestrian at a spot (e.g. a driver bailing out).
  function spawnOne(x, z) {
    var ped = makePed();
    assignBlockPath(ped);
    ped.group.position.set(x, 0, z);
    return ped;
  }

  SF.Peds = {
    list: list,
    hitMeshes: hitMeshes,
    spawn: spawn,
    spawnOne: spawnOne,
    update: update,
    panicAt: panicAt,
    knockDown: knockDown
  };
})();
