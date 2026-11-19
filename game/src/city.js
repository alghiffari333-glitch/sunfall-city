// SUNFALL CITY — the city itself: a procedural grid of pastel blocks and
// palm-lined roads on a golden-hour coast. Builds all static geometry,
// the building collider list, named spots (garage, hospital, safehouse…)
// and the road helpers traffic drives on.
(function () {
  'use strict';
  var U = SF.U, CFG = SF.CFG, C = CFG.ROAD_CENTERS;

  var colliders = [];
  var blocks = [];   // {minX,maxX,minZ,maxZ} for every city block
  var spots = {};
  var waterTex = null, waterTex2 = null;
  var fountainDisc = null;

  // ---------- canvas texture helpers ----------
  function canvasTex(w, h, draw, srgb) {
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    draw(cv.getContext('2d'), w, h);
    var tex = new THREE.CanvasTexture(cv);
    if (srgb !== false) tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 4;
    return tex;
  }

  function windowTexture(base, litRatio) {
    return canvasTex(128, 256, function (g) {
      g.fillStyle = base; g.fillRect(0, 0, 128, 256);
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 0, 128, 10);
      var cols = 8, rows = 14, cw = 128 / cols, ch = 256 / rows;
      for (var y = 0; y < rows; y++) {
        for (var x = 0; x < cols; x++) {
          var lit = U.rng() < litRatio;
          g.fillStyle = lit ? '#ffd98a' : '#2b3d47';
          g.fillRect(x * cw + 3, y * ch + 4, cw - 6, ch - 8);
          if (lit) { g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x * cw + 3, y * ch + 4, cw - 6, 3); }
        }
      }
    });
  }

  function signTexture(text, bg, fg) {
    return canvasTex(512, 112, function (g) {
      g.fillStyle = bg; g.fillRect(0, 0, 512, 112);
      g.fillStyle = fg;
      g.font = 'bold 52px system-ui, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, 256, 58);
    });
  }

  // ---------- ground: one big painted texture for the whole road grid ----------
  function groundTexture() {
    var S = 2048, world = 340, sc = S / world;
    function px(x) { return (x + 170) * sc; }
    return canvasTex(S, S, function (g) {
      g.fillStyle = CFG.SIDEWALK; g.fillRect(0, 0, S, S);
      // Block interiors (sidewalk ring stays as the base colour).
      for (var i = 0; i < 5; i++) {
        for (var j = 0; j < 5; j++) {
          var x0 = C[i] + 7, x1 = C[i + 1] - 7, z0 = C[j] + 7, z1 = C[j + 1] - 7;
          var kind = U.rng();
          var fill = kind < 0.45 ? '#7d9c5c' : (kind < 0.75 ? '#b3a58e' : '#5d6167');
          if (i === 2 && j === 2) fill = '#c2b294';            // plaza
          if (i === 4 && j === 2) fill = '#8b8f94';            // garage concrete
          if (i === 0 && j === 2) fill = '#a9b39b';            // hospital grounds
          g.fillStyle = fill;
          g.fillRect(px(x0 + 3.2), px(z0 + 3.2), (x1 - x0 - 6.4) * sc, (z1 - z0 - 6.4) * sc);
          if (fill === '#5d6167') { // parking stalls
            g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2;
            for (var s = 0; s < 6; s++) {
              g.beginPath();
              g.moveTo(px(x0 + 6 + s * 5.4), px(z0 + 5));
              g.lineTo(px(x0 + 6 + s * 5.4), px(z0 + 12));
              g.stroke();
            }
          }
        }
      }
      // Roads.
      g.fillStyle = CFG.ASPHALT;
      for (var r = 0; r < 6; r++) {
        g.fillRect(px(C[r] - 7), 0, 14 * sc, S);
        g.fillRect(0, px(C[r] - 7), S, 14 * sc);
      }
      // Edge lines + centre dashes.
      for (var e = 0; e < 6; e++) {
        g.fillStyle = 'rgba(240,240,230,0.75)';
        g.fillRect(px(C[e] - 6.5), 0, 0.35 * sc, S); g.fillRect(px(C[e] + 6.2), 0, 0.35 * sc, S);
        g.fillRect(0, px(C[e] - 6.5), S, 0.35 * sc); g.fillRect(0, px(C[e] + 6.2), S, 0.35 * sc);
        g.fillStyle = '#d8b93a';
        for (var d = -168; d < 168; d += 6) {
          g.fillRect(px(C[e] - 0.2), px(d), 0.4 * sc, 3 * sc);
          g.fillRect(px(d), px(C[e] - 0.2), 3 * sc, 0.4 * sc);
        }
      }
      // Intersections repainted plain, then crosswalks.
      for (var a = 0; a < 6; a++) {
        for (var b = 0; b < 6; b++) {
          g.fillStyle = CFG.ASPHALT;
          g.fillRect(px(C[a] - 7), px(C[b] - 7), 14 * sc, 14 * sc);
          g.fillStyle = 'rgba(245,245,240,0.8)';
          for (var s2 = 0; s2 < 5; s2++) {
            var off = -5.6 + s2 * 2.8;
            g.fillRect(px(C[a] + off), px(C[b] - 9.6), 1.4 * sc, 2.2 * sc);
            g.fillRect(px(C[a] + off), px(C[b] + 7.4), 1.4 * sc, 2.2 * sc);
            g.fillRect(px(C[a] - 9.6), px(C[b] + off), 2.2 * sc, 1.4 * sc);
            g.fillRect(px(C[a] + 7.4), px(C[b] + off), 2.2 * sc, 1.4 * sc);
          }
        }
      }
      // South promenade + sand lip.
      g.fillStyle = '#e6cf9a'; g.fillRect(0, px(160), S, px(170) - px(160));
      g.fillStyle = 'rgba(120,90,40,0.25)'; g.fillRect(0, px(163), S, 0.5 * sc);
    });
  }

  // ---------- shared building materials ----------
  var sideMats = [];
  var roofMat = null;
  function buildMaterials() {
    var bases = ['#f2d5b8', '#e8a798', '#a8c8c0', '#f0e0a0', '#d9b8d0', '#f5efe2'];
    for (var i = 0; i < bases.length; i++) {
      sideMats.push(new THREE.MeshLambertMaterial({ map: windowTexture(bases[i], 0.32 + i * 0.05) }));
    }
    roofMat = new THREE.MeshLambertMaterial({ color: 0x55565e });
  }

  function addBuilding(group, cx, cz, w, h, d, mat) {
    var geo = new THREE.BoxGeometry(w, h, d);
    var m = new THREE.Mesh(geo, mat || U.choice(sideMats));
    m.position.set(cx, h / 2, cz);
    group.add(m);
    if (h > 13) {
      var slab = new THREE.Mesh(new THREE.BoxGeometry(w + 0.7, 0.6, d + 0.7), roofMat);
      slab.position.set(cx, h + 0.3, cz);
      group.add(slab);
    }
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
    return m;
  }

  function addSign(group, text, bg, fg, w, pos, rotY) {
    var tex = signTexture(text, bg, fg);
    var m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, w * 112 / 512),
      new THREE.MeshBasicMaterial({ map: tex })
    );
    m.position.copy(pos);
    m.rotation.y = rotY || 0;
    group.add(m);
    return m;
  }

  // ---------- palms & streetlights ----------
  var trunkGeo, frondGeo, trunkMat, frondMat;
  function addPalm(group, x, z) {
    var p = new THREE.Group();
    var trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.rotation.z = U.rand(-0.07, 0.07);
    p.add(trunk);
    var fronds = new THREE.Mesh(frondGeo, frondMat);
    fronds.position.y = 4.9;
    fronds.scale.y = 0.5;
    p.add(fronds);
    p.position.set(x, 0, z);
    p.rotation.y = U.rand(0, Math.PI * 2);
    group.add(p);
  }

  var poleGeo, lampGeo, poleMat, lampMat;
  function addLight(group, x, z) {
    var pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(x, 2.8, z);
    group.add(pole);
    var lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.set(x, 5.7, z);
    group.add(lamp);
  }

  // ---------- main build ----------
  function build(scene) {
    buildMaterials();
    var group = new THREE.Group();
    scene.add(group);

    // Outer grass + painted city ground.
    var grass = new THREE.Mesh(
      new THREE.PlaneGeometry(1700, 1700),
      new THREE.MeshLambertMaterial({ color: 0x77975c })
    );
    grass.rotation.x = -Math.PI / 2; grass.position.y = -0.12;
    group.add(grass);

    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(340, 340),
      new THREE.MeshLambertMaterial({ map: groundTexture() })
    );
    ground.rotation.x = -Math.PI / 2;
    group.add(ground);

    // Beach sand + water.
    var sand = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 56),
      new THREE.MeshLambertMaterial({ color: CFG.SAND })
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, -0.04, 190);
    group.add(sand);

    waterTex = canvasTex(256, 256, function (g) {
      g.fillStyle = '#2f8fae'; g.fillRect(0, 0, 256, 256);
      g.strokeStyle = 'rgba(255,255,255,0.20)'; g.lineWidth = 3;
      for (var i = 0; i < 22; i++) {
        g.beginPath();
        var y = U.rand(0, 256);
        g.moveTo(U.rand(-30, 100), y);
        g.lineTo(U.rand(140, 286), y + U.rand(-6, 6));
        g.stroke();
      }
    });
    waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;
    waterTex.repeat.set(10, 4);
    var water = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 340),
      new THREE.MeshPhongMaterial({ map: waterTex, color: 0x9fd4e8, transparent: true, opacity: 0.88, shininess: 120 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -0.35, 372);
    group.add(water);

    waterTex2 = canvasTex(128, 128, function (g) {
      g.fillStyle = 'rgba(255,255,255,0.0)'; g.clearRect(0, 0, 128, 128);
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2;
      for (var i = 0; i < 10; i++) {
        g.beginPath();
        g.moveTo(U.rand(0, 60), U.rand(0, 128));
        g.lineTo(U.rand(70, 128), U.rand(0, 128));
        g.stroke();
      }
    }, false);
    waterTex2.wrapS = waterTex2.wrapT = THREE.RepeatWrapping;
    waterTex2.repeat.set(14, 1);
    var foam = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 9),
      new THREE.MeshBasicMaterial({ map: waterTex2, transparent: true, opacity: 0.55, depthWrite: false })
    );
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(0, -0.06, 203);
    group.add(foam);

    // Blocks + buildings.
    for (var i = 0; i < 5; i++) {
      for (var j = 0; j < 5; j++) {
        var bx0 = C[i] + 7, bx1 = C[i + 1] - 7, bz0 = C[j] + 7, bz1 = C[j + 1] - 7;
        blocks.push({ minX: bx0, maxX: bx1, minZ: bz0, maxZ: bz1 });
        var cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2;
        if (i === 2 && j === 2) buildPlaza(group, cx, cz);
        else if (i === 4 && j === 2) buildGarage(group, cx, cz);
        else if (i === 0 && j === 2) buildHospital(group, cx, cz);
        else if (i === 0 && j === 4) buildSafehouse(group, cx, cz);
        else buildBlock(group, cx, cz, i, j);
      }
    }

    buildBeach(group);

    // Palms: beach row, plaza, and boulevard sidewalks.
    trunkGeo = new THREE.CylinderGeometry(0.16, 0.3, 5, 5);
    trunkGeo.translate(0, 2.5, 0);
    frondGeo = new THREE.ConeGeometry(2.5, 1.3, 7);
    trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a44 });
    frondMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f });
    var x;
    for (x = -156; x <= 156; x += 15) { if (Math.abs(x % 54) > 9) addPalm(group, x + U.rand(-2, 2), 171 + U.rand(0, 3)); }
    for (var pz = -140; pz <= 140; pz += 37) {
      addPalm(group, -19.5, pz + U.rand(-3, 3));
      addPalm(group, 19.5, pz + U.rand(-3, 3));
    }
    addPalm(group, -14, -14); addPalm(group, 14, -14); addPalm(group, -14, 14); addPalm(group, 14, 14);

    // Streetlights at intersection corners.
    poleGeo = new THREE.CylinderGeometry(0.09, 0.13, 5.6, 5);
    lampGeo = new THREE.SphereGeometry(0.3, 8, 6);
    poleMat = new THREE.MeshLambertMaterial({ color: 0x4c5257 });
    lampMat = new THREE.MeshLambertMaterial({ color: 0xffe2ae, emissive: 0xffb85c, emissiveIntensity: 0.9 });
    for (var a = 0; a < 6; a++) {
      for (var b = 0; b < 6; b++) {
        if ((a + b) % 2 === 0) addLight(group, C[a] + 8.1, C[b] + 8.1);
        else addLight(group, C[a] - 8.1, C[b] - 8.1);
      }
    }

    // Scattered crates near block corners.
    var crateMat = new THREE.MeshLambertMaterial({ color: 0xa9803e });
    var crateGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
    for (var k = 0; k < 14; k++) {
      var blk = U.choice(blocks);
      var kx = U.choice([blk.minX + 1.2, blk.maxX - 1.2]);
      var kz = U.rand(blk.minZ + 2, blk.maxZ - 2);
      if (U.pointInColliders(kx, kz, colliders, 1)) continue;
      var crate = new THREE.Mesh(crateGeo, crateMat);
      crate.position.set(kx, 0.6, kz);
      crate.rotation.y = U.rand(0, 3);
      group.add(crate);
      colliders.push({ minX: kx - 0.7, maxX: kx + 0.7, minZ: kz - 0.7, maxZ: kz + 0.7 });
    }

    spots.spawn = { x: 14, z: 148 };
    return group;
  }

  function buildBlock(group, cx, cz, i, j) {
    var downtown = 1 - Math.min(1, (Math.abs(i - 2) + Math.abs(j - 2)) / 4);
    var layout = U.rng();
    if (layout < 0.34) {
      addBuilding(group, cx, cz, U.rand(17, 24), U.rand(16, 30) + downtown * 30, U.rand(17, 24));
    } else if (layout < 0.67) {
      addBuilding(group, cx - 9, cz, U.rand(13, 16), U.rand(10, 22) + downtown * 16, U.rand(14, 20));
      addBuilding(group, cx + 9, cz + U.rand(-3, 3), U.rand(13, 16), U.rand(8, 18) + downtown * 12, U.rand(14, 20));
    } else {
      var offs = [[-9.5, -9.5], [9.5, -9.5], [-9.5, 9.5], [9.5, 9.5]];
      for (var q = 0; q < 4; q++) {
        if (U.chance(0.85)) {
          addBuilding(group, cx + offs[q][0], cz + offs[q][1], U.rand(11, 15), U.rand(7, 15) + downtown * 8, U.rand(11, 15));
        }
      }
    }
  }

  function buildPlaza(group, cx, cz) {
    var base = new THREE.Mesh(
      new THREE.CylinderGeometry(5, 5.4, 0.9, 18),
      new THREE.MeshLambertMaterial({ color: 0xcfc4ab })
    );
    base.position.set(cx, 0.45, cz);
    group.add(base);
    fountainDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 4.2, 0.3, 18),
      new THREE.MeshPhongMaterial({ color: 0x3f9dbd, shininess: 90 })
    );
    fountainDisc.position.set(cx, 0.95, cz);
    group.add(fountainDisc);
    var pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.7, 2.6, 8),
      new THREE.MeshLambertMaterial({ color: 0xe8e0cc })
    );
    pillar.position.set(cx, 1.8, cz);
    group.add(pillar);
    colliders.push({ minX: cx - 5.4, maxX: cx + 5.4, minZ: cz - 5.4, maxZ: cz + 5.4 });
    var benchMat = new THREE.MeshLambertMaterial({ color: 0x7a5c38 });
    var benchGeo = new THREE.BoxGeometry(2.6, 0.5, 0.7);
    [[-9, 0], [9, 0], [0, -9], [0, 9]].forEach(function (o) {
      var b = new THREE.Mesh(benchGeo, benchMat);
      b.position.set(cx + o[0], 0.3, cz + o[1]);
      if (o[0] === 0) b.rotation.y = Math.PI / 2;
      group.add(b);
    });
    spots.plaza = { x: cx, z: cz + 10 };
  }

  function buildGarage(group, cx, cz) {
    var mat = new THREE.MeshLambertMaterial({ color: 0xd86f2e });
    var b = addBuilding(group, cx, cz - 9, 30, 8, 15, mat);
    b.material = mat;
    // Door + sign on the south face.
    var door = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 5),
      new THREE.MeshLambertMaterial({ color: 0x3c4147 })
    );
    door.position.set(cx, 2.5, cz - 1.4);
    group.add(door);
    addSign(group, "MARISOL'S GARAGE", '#26303a', '#ffb36b', 15, new THREE.Vector3(cx, 7.2, cz - 1.35), 0);
    spots.garage = { x: cx, z: cz + 13 };
    spots.garageDoor = { x: cx, z: cz - 0.5 };
  }

  function buildHospital(group, cx, cz) {
    var white = new THREE.MeshLambertMaterial({ color: 0xf4f6f6 });
    addBuilding(group, cx - 4, cz - 4, 22, 19, 20, white);
    addSign(group, 'HOSPITAL', '#f4f6f6', '#d43a2e', 13, new THREE.Vector3(cx - 4, 15.5, cz + 6.2), 0);
    // Red cross on a white board, south face.
    var crossTex = canvasTex(128, 128, function (g) {
      g.fillStyle = '#f4f6f6'; g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#d43a2e';
      g.fillRect(52, 22, 24, 84); g.fillRect(22, 52, 84, 24);
    });
    var cross = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 5),
      new THREE.MeshBasicMaterial({ map: crossTex })
    );
    cross.position.set(cx - 4, 9, cz + 6.25);
    group.add(cross);
    spots.hospital = { x: cx - 4, z: cz + 13 };
    spots.respawn = { x: cx - 4, z: cz + 20 };
  }

  function buildSafehouse(group, cx, cz) {
    var walls = new THREE.MeshLambertMaterial({ color: 0xf7e8b0 });
    addBuilding(group, cx - 6, cz - 6, 13, 5.5, 11, walls);
    var roof = new THREE.Mesh(
      new THREE.ConeGeometry(10.5, 3.4, 4),
      new THREE.MeshLambertMaterial({ color: 0xb5502e })
    );
    roof.position.set(cx - 6, 7.2, cz - 6);
    roof.rotation.y = Math.PI / 4;
    group.add(roof);
    addSign(group, 'CASA SOL', '#7a4a21', '#ffe9b0', 8, new THREE.Vector3(cx - 6, 4.4, cz - 0.4), 0);
    spots.safehouse = { x: cx - 6, z: cz + 4 };
  }

  function buildBeach(group) {
    // Café pavilion: posts + flat roof + counter.
    var postMat = new THREE.MeshLambertMaterial({ color: 0x8a6a44 });
    var postGeo = new THREE.CylinderGeometry(0.14, 0.14, 3.4, 6);
    [[48, 176], [60, 176], [48, 186], [60, 186]].forEach(function (p) {
      var post = new THREE.Mesh(postGeo, postMat);
      post.position.set(p[0], 1.7, p[1]);
      group.add(post);
    });
    var roof = new THREE.Mesh(
      new THREE.BoxGeometry(15, 0.35, 13),
      new THREE.MeshLambertMaterial({ color: 0xe2725b })
    );
    roof.position.set(54, 3.6, 181);
    group.add(roof);
    var counter = new THREE.Mesh(
      new THREE.BoxGeometry(8, 1.1, 1.2),
      new THREE.MeshLambertMaterial({ color: 0xf2e3c2 })
    );
    counter.position.set(54, 0.55, 178);
    group.add(counter);
    colliders.push({ minX: 49.8, maxX: 58.2, minZ: 177.3, maxZ: 178.7 });
    addSign(group, 'CAFE DEL SOL', '#e2725b', '#fff3d6', 10, new THREE.Vector3(54, 3.1, 174.4), Math.PI);
    spots.cafe = { x: 54, z: 172 };

    // Pier: wooden walkway out over the water.
    var pierMat = new THREE.MeshLambertMaterial({ color: 0x9a7648 });
    var pier = new THREE.Mesh(new THREE.BoxGeometry(6, 0.5, 26), pierMat);
    pier.position.set(150, 0.25, 196);
    group.add(pier);
    var railGeo = new THREE.BoxGeometry(0.18, 0.9, 26);
    [-2.8, 2.8].forEach(function (o) {
      var rail = new THREE.Mesh(railGeo, pierMat);
      rail.position.set(150 + o, 0.95, 196);
      group.add(rail);
    });
    spots.pier = { x: 150, z: 186 };
  }

  function isOnRoad(x, z) {
    for (var i = 0; i < 6; i++) {
      if (Math.abs(x - C[i]) < CFG.ROAD_W / 2 + 0.6) return true;
      if (Math.abs(z - C[i]) < CFG.ROAD_W / 2 + 0.6) return true;
    }
    return false;
  }

  function update(dt) {
    if (waterTex) waterTex.offset.x = (SF.G.time * 0.012) % 1;
    if (waterTex2) waterTex2.offset.x = (-SF.G.time * 0.03) % 1;
    if (fountainDisc) fountainDisc.rotation.y += dt * 0.4;
  }

  SF.City = {
    build: build,
    update: update,
    colliders: colliders,
    blocks: blocks,
    spots: spots,
    isOnRoad: isOnRoad
  };
})();
