// SUNFALL CITY — the player: Rio, a courier in a teal shirt. Third-person
// on-foot movement with an orbit camera, jumping, car theft/entry, pistol
// combat with tracers, health and respawning.
(function () {
  'use strict';
  var U = SF.U, CFG = SF.CFG;

  var group = null, legs = null, armR = null;
  var heading = Math.PI;
  var vy = 0, grounded = true;
  var health = 100;
  var lastDamageT = -99;
  var ammo = 12, reloading = 0, fireCd = 0;
  var phase = 0;
  var effects = [];   // {obj, ttl} tracers & flashes
  var sceneRef = null;
  var raycaster = null;
  var flashMat = null;

  function build(scene) {
    sceneRef = scene;
    raycaster = new THREE.Raycaster();
    group = new THREE.Group();
    legs = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.54, 0.23),
      new THREE.MeshLambertMaterial({ color: 0x27324a })
    );
    legs.position.y = 0.27;
    group.add(legs);
    var torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.64, 0.26),
      new THREE.MeshLambertMaterial({ color: 0x17a398 })
    );
    torso.position.y = 0.86;
    group.add(torso);
    armR = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.5, 0.13),
      new THREE.MeshLambertMaterial({ color: 0x17a398 })
    );
    armR.position.set(0.32, 0.92, 0.05);
    group.add(armR);
    var head = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.3, 0.28),
      new THREE.MeshLambertMaterial({ color: 0xd9a066 })
    );
    head.position.y = 1.34;
    group.add(head);
    var cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.1, 0.42),
      new THREE.MeshLambertMaterial({ color: 0xd84f35 })
    );
    cap.position.set(0, 1.52, 0.04);
    group.add(cap);
    // Blob shadow.
    var shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 1.1),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    shadow.name = 'blob';
    group.add(shadow);
    group.position.set(SF.City.spots.spawn.x, 0, SF.City.spots.spawn.z);
    scene.add(group);
    flashMat = new THREE.SpriteMaterial({ color: 0xffcf6a, transparent: true, opacity: 0.95 });
  }

  function onPier(x, z) { return Math.abs(x - 150) < 2.9 && z > 182; }

  function clampToWorld(p) {
    p.x = U.clamp(p.x, -CFG.BOUND_X, CFG.BOUND_X);
    var zMax = onPier(p.x, p.z) ? 207 : CFG.BOUND_Z_MAX;
    p.z = U.clamp(p.z, CFG.BOUND_Z_MIN, zMax);
  }

  // ---------- entering / leaving cars ----------
  function enterExit() {
    if (SF.G.mode !== 'playing') return;
    if (SF.G.inCar) {
      var car = SF.G.inCar;
      var fx = Math.sin(car.heading), fz = Math.cos(car.heading);
      // Step out on the left side; fall back to the right if blocked.
      var lx = car.group.position.x + fz * 2.3, lz = car.group.position.z - fx * 2.3;
      if (U.pointInColliders(lx, lz, SF.City.colliders, 0.5)) {
        lx = car.group.position.x - fz * 2.3; lz = car.group.position.z + fx * 2.3;
      }
      group.position.set(lx, 0, lz);
      clampToWorld(group.position);
      heading = car.heading;
      group.rotation.y = heading;
      group.visible = true;
      car.kind = 'parked';
      car.speed = 0;
      SF.G.inCar = null;
      SF.AU.door();
      return;
    }
    var near = SF.Cars.nearestCar(group.position, 3.6);
    if (!near) return;
    if (near.hp <= 5) { SF.G.hint = 'That car is wrecked'; return; }
    var wasTraffic = near.kind === 'traffic';
    if (!near.stolen) {
      near.stolen = true;
      if (SF.Wanted) SF.Wanted.addCrime('theft');
    }
    if (wasTraffic && SF.Peds) {
      // The driver bails out and runs.
      var ped = SF.Peds.spawnOne(
        near.group.position.x + Math.cos(near.heading) * 1.6,
        near.group.position.z - Math.sin(near.heading) * 1.6
      );
      ped.state = 'flee'; ped.stateT = 3;
      ped.fleeX = group.position.x - ped.group.position.x;
      ped.fleeZ = group.position.z - ped.group.position.z;
      SF.Peds.panicAt(near.group.position.x, near.group.position.z, 7);
    }
    near.kind = 'player';
    near.nav = null;
    SF.G.inCar = near;
    group.visible = false;
    SF.G.camYaw = near.heading;
    SF.AU.door();
  }

  // ---------- combat ----------
  function startReload() {
    if (reloading > 0 || ammo === 12 || SF.G.inCar) return;
    reloading = 1.1;
    SF.AU.reload();
  }

  function addEffect(obj, ttl) {
    sceneRef.add(obj);
    effects.push({ obj: obj, ttl: ttl });
  }

  function shoot() {
    if (SF.G.mode !== 'playing' || SF.G.inCar || fireCd > 0) return;
    if (reloading > 0) return;
    if (ammo <= 0) { SF.AU.dryFire(); startReload(); return; }
    ammo--;
    fireCd = 0.22;
    SF.AU.shot();
    if (SF.Wanted) SF.Wanted.addCrime('gunfire');
    if (SF.Peds) SF.Peds.panicAt(group.position.x, group.position.z, 15);

    var cam = SF.G.camera;
    raycaster.setFromCamera({ x: 0, y: 0 }, cam);
    raycaster.far = 85;
    var targets = SF.Peds.hitMeshes.concat(SF.Cars.hitMeshes);
    var hits = raycaster.intersectObjects(targets, false);
    var muzzle = new THREE.Vector3(
      group.position.x + Math.sin(heading) * 0.45,
      1.28,
      group.position.z + Math.cos(heading) * 0.45
    );
    var end;
    if (hits.length) {
      var hit = hits[0];
      end = hit.point;
      if (hit.object.userData.ped) {
        var ped = hit.object.userData.ped;
        SF.Peds.knockDown(ped, 'shot');
        if (SF.Wanted) SF.Wanted.addCrime('assault');
      } else if (hit.object.userData.car) {
        var car = hit.object.userData.car;
        car.hp -= 14;
        SF.Cars.tintDamage(car);
        SF.AU.spark();
        if (car.kind === 'police' && SF.Wanted) SF.Wanted.addCrime('policeHit');
        if (car.driverPed && SF.Peds) SF.Peds.panicAt(car.group.position.x, car.group.position.z, 9);
      }
    } else {
      end = raycaster.ray.at(85, new THREE.Vector3());
    }
    // Tracer.
    var geo = new THREE.BufferGeometry().setFromPoints([muzzle, end]);
    var line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: 0xffe9a0, transparent: true, opacity: 0.9
    }));
    addEffect(line, 0.06);
    // Muzzle flash sprite.
    var flash = new THREE.Sprite(flashMat);
    flash.position.copy(muzzle);
    flash.scale.set(0.55, 0.55, 1);
    addEffect(flash, 0.045);
    // Arm kick.
    armR.rotation.x = -1.25;
  }

  function takeDamage(n, cause) {
    if (SF.G.mode !== 'playing' || n <= 0) return;
    health -= n;
    lastDamageT = SF.G.time;
    SF.G.damageFlash = Math.min(1, SF.G.damageFlash + 0.5);
    if (cause === 'crash') SF.AU.thud(false);
    if (health <= 0) {
      health = 0;
      if (SF.Game && SF.Game.onWasted) SF.Game.onWasted();
    }
  }

  function respawn(x, z) {
    if (SF.G.inCar) {
      SF.G.inCar.kind = 'parked';
      SF.G.inCar.speed = 0;
      SF.G.inCar = null;
    }
    group.visible = true;
    group.position.set(x, 0, z);
    health = 100;
    vy = 0;
    SF.G.camYaw = Math.PI;
  }

  // ---------- per-frame ----------
  function update(dt) {
    fireCd -= dt;
    if (reloading > 0) {
      reloading -= dt;
      if (reloading <= 0) { ammo = 12; SF.AU.click(); }
    }
    // Health regen after 6 quiet seconds.
    if (health > 0 && health < 100 && SF.G.time - lastDamageT > 6) {
      health = Math.min(100, health + 4.5 * dt);
    }
    // Effects decay.
    for (var i = effects.length - 1; i >= 0; i--) {
      effects[i].ttl -= dt;
      if (effects[i].ttl <= 0) {
        sceneRef.remove(effects[i].obj);
        if (effects[i].obj.geometry) effects[i].obj.geometry.dispose();
        effects.splice(i, 1);
      }
    }
    armR.rotation.x = U.damp(armR.rotation.x, reloading > 0 ? -0.5 : 0, 14, dt);

    if (SF.G.inCar) {
      var car = SF.G.inCar;
      group.position.copy(car.group.position);
      SF.Cars.updatePlayerCar(car, dt);
      return;
    }

    var k = SF.G.keys;
    var f = { x: Math.sin(SF.G.camYaw), z: Math.cos(SF.G.camYaw) };
    var r = { x: -f.z, z: f.x }; // right = forward x up
    var mx = 0, mz = 0;
    if (k['KeyW'] || k['ArrowUp']) { mx += f.x; mz += f.z; }
    if (k['KeyS'] || k['ArrowDown']) { mx -= f.x; mz -= f.z; }
    if (k['KeyD'] || k['ArrowRight']) { mx += r.x; mz += r.z; }
    if (k['KeyA'] || k['ArrowLeft']) { mx -= r.x; mz -= r.z; }
    var moving = (mx !== 0 || mz !== 0);
    var sprint = k['ShiftLeft'] || k['ShiftRight'];
    if (moving) {
      var m = Math.sqrt(mx * mx + mz * mz);
      mx /= m; mz /= m;
      var speed = sprint ? 8.6 : 5.3;
      group.position.x += mx * speed * dt;
      group.position.z += mz * speed * dt;
      heading = U.turnToward(heading, Math.atan2(mx, mz), 13 * dt);
      phase += dt * (sprint ? 12 : 9);
      // Camera drifts behind the player when the mouse is idle.
      if (SF.G.time - (SF.G.lastMouseT || 0) > 2.5) {
        SF.G.camYaw = U.angleLerp(SF.G.camYaw, heading, dt * 0.9);
      }
    }
    // Jump / gravity.
    if ((k['Space']) && grounded) { vy = 8.6; grounded = false; }
    if (!grounded) {
      group.position.y += vy * dt;
      vy -= CFG.GRAVITY * dt;
      if (group.position.y <= 0) {
        if (vy < -13) takeDamage((-vy - 13) * 1.6, 'fall');
        group.position.y = 0; vy = 0; grounded = true;
      }
    }
    U.resolveCircle(group.position, 0.45, SF.City.colliders);
    // Cars are solid on foot.
    for (var i = 0; i < SF.Cars.list.length; i++) {
      var cp = SF.Cars.list[i].group.position;
      var d = U.dist2D(group.position.x, group.position.z, cp.x, cp.z);
      if (d < 2.05 && d > 0.001) {
        var push = (2.05 - d);
        group.position.x += (group.position.x - cp.x) / d * push;
        group.position.z += (group.position.z - cp.z) / d * push;
      }
    }
    clampToWorld(group.position);
    group.rotation.y = heading;
    group.position.y = grounded ? Math.abs(Math.sin(phase)) * (moving ? 0.055 : 0) : group.position.y;
    legs.rotation.x = moving ? Math.sin(phase) * 0.55 : 0;

    // Context hint.
    var near = SF.Cars.nearestCar(group.position, 3.6);
    SF.G.hint = near ? (near.hp <= 5 ? 'That car is wrecked' : 'E — Enter car') : '';
  }

  function updateCamera(dt) {
    var cam = SF.G.camera;
    if (!cam) return;
    var target, dist;
    if (SF.G.inCar) {
      var car = SF.G.inCar;
      target = new THREE.Vector3(car.group.position.x, 1.8, car.group.position.z);
      dist = 10.5 + Math.abs(car.speed) * 0.06;
      if (SF.G.time - (SF.G.lastMouseT || 0) > 2) {
        SF.G.camYaw = U.angleLerp(SF.G.camYaw, car.heading, dt * 2.4);
      }
      SF.G.hint = 'E — Exit car';
    } else {
      target = new THREE.Vector3(group.position.x, group.position.y + 1.7, group.position.z);
      dist = 7.4;
    }
    var yaw = SF.G.camYaw, pitch = SF.G.camPitch;
    var desired = new THREE.Vector3(
      target.x - Math.sin(yaw) * Math.cos(pitch) * dist,
      target.y + Math.sin(pitch) * dist,
      target.z - Math.cos(yaw) * Math.cos(pitch) * dist
    );
    // Pull the camera in before it enters a building.
    var steps = 10, chosen = desired;
    for (var s = 1; s <= steps; s++) {
      var t = s / steps;
      var px = target.x + (desired.x - target.x) * t;
      var pz = target.z + (desired.z - target.z) * t;
      if (U.pointInColliders(px, pz, SF.City.colliders, 0.4)) {
        var bt = Math.max(0.12, (s - 1) / steps);
        chosen = new THREE.Vector3(
          target.x + (desired.x - target.x) * bt,
          target.y + (desired.y - target.y) * bt,
          target.z + (desired.z - target.z) * bt
        );
        break;
      }
    }
    chosen.y = Math.max(0.7, chosen.y);
    if (!cam.position.lengthSq()) cam.position.copy(chosen);
    cam.position.x = U.damp(cam.position.x, chosen.x, 14, dt);
    cam.position.y = U.damp(cam.position.y, chosen.y, 14, dt);
    cam.position.z = U.damp(cam.position.z, chosen.z, 14, dt);
    var look = new THREE.Vector3(
      target.x + Math.sin(yaw) * 3,
      target.y + 0.2,
      target.z + Math.cos(yaw) * 3
    );
    cam.lookAt(look);
  }

  SF.Player = {
    build: build,
    update: update,
    updateCamera: updateCamera,
    enterExit: enterExit,
    shoot: shoot,
    startReload: startReload,
    takeDamage: takeDamage,
    respawn: respawn,
    group: null, // set in build via getter below
    getHealth: function () { return health; },
    setHealth: function (v) { health = v; },
    getAmmo: function () { return ammo; },
    isReloading: function () { return reloading > 0; },
    getHeading: function () { return heading; },
    setHeading: function (v) { heading = v; }
  };
  Object.defineProperty(SF.Player, 'group', {
    get: function () { return group; }
  });
})();
