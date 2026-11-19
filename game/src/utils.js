// SUNFALL CITY — small math / RNG / collision helpers (SF.U).
(function () {
  'use strict';

  // Deterministic RNG (mulberry32) so the city is the same on every load.
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rng = mulberry32(20261119);

  function rand(a, b) { return a + rng() * (b - a); }
  function randi(a, b) { return Math.floor(rand(a, b + 1)); }
  function chance(p) { return rng() < p; }
  function choice(arr) { return arr[Math.floor(rng() * arr.length)]; }

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  // Frame-rate independent exponential approach.
  function damp(a, b, lambda, dt) { return lerp(a, b, 1 - Math.exp(-lambda * dt)); }

  function dist2D(ax, az, bx, bz) {
    var dx = ax - bx, dz = az - bz;
    return Math.sqrt(dx * dx + dz * dz);
  }

  // Wrap an angle to [-PI, PI].
  function wrapAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }
  function angleLerp(a, b, t) { return a + wrapAngle(b - a) * t; }
  // Turn `a` toward `b` by at most maxStep radians.
  function turnToward(a, b, maxStep) {
    var d = wrapAngle(b - a);
    if (d > maxStep) d = maxStep;
    if (d < -maxStep) d = -maxStep;
    return a + d;
  }

  // Push a circle (pos = {x,z} object with x/z fields, e.g. a THREE.Vector3)
  // out of every AABB collider it overlaps. Colliders: {minX,maxX,minZ,maxZ}.
  // Returns the largest penetration depth resolved (0 when no hit).
  function resolveCircle(pos, radius, colliders) {
    var worst = 0;
    for (var i = 0; i < colliders.length; i++) {
      var c = colliders[i];
      var nx = clamp(pos.x, c.minX, c.maxX);
      var nz = clamp(pos.z, c.minZ, c.maxZ);
      var dx = pos.x - nx, dz = pos.z - nz;
      var d2 = dx * dx + dz * dz;
      if (d2 > radius * radius) continue;
      if (d2 > 1e-8) {
        var d = Math.sqrt(d2);
        var push = radius - d;
        pos.x += (dx / d) * push;
        pos.z += (dz / d) * push;
        if (push > worst) worst = push;
      } else {
        // Centre inside the box: push out through the nearest face.
        var pl = pos.x - c.minX, pr = c.maxX - pos.x;
        var pt = pos.z - c.minZ, pb = c.maxZ - pos.z;
        var m = Math.min(pl, pr, pt, pb);
        if (m === pl) pos.x = c.minX - radius;
        else if (m === pr) pos.x = c.maxX + radius;
        else if (m === pt) pos.z = c.minZ - radius;
        else pos.z = c.maxZ + radius;
        if (radius > worst) worst = radius;
      }
    }
    return worst;
  }

  // Is a point inside any collider (expanded by r)?
  function pointInColliders(x, z, colliders, r) {
    for (var i = 0; i < colliders.length; i++) {
      var c = colliders[i];
      if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r) return true;
    }
    return false;
  }

  SF.U = {
    rng: rng,
    rand: rand,
    randi: randi,
    chance: chance,
    choice: choice,
    clamp: clamp,
    lerp: lerp,
    damp: damp,
    dist2D: dist2D,
    wrapAngle: wrapAngle,
    angleLerp: angleLerp,
    turnToward: turnToward,
    resolveCircle: resolveCircle,
    pointInColliders: pointInColliders
  };
})();
