// SUNFALL CITY — the story: five jobs for fixer Marisol Vega, run by a
// small step machine (go-to markers, a marked car to steal, checkpoint
// runs, an escape, and a timed finale under a four-star floor).
(function () {
  'use strict';
  var U = SF.U;

  var completed = 0;        // missions finished (also the save progress)
  var active = null;        // active mission runtime {def, steps, idx}
  var offerMarker = null;   // {group, ring, beam} shared marker visuals
  var markerColor = 0xffc93a;
  var timerText = '';
  var targetCar = null;     // mission 2's coupe

  // ---------- marker visuals ----------
  function makeMarker() {
    var group = new THREE.Group();
    var beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.15, 30, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffc93a, transparent: true, opacity: 0.30,
        side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending
      })
    );
    beam.position.y = 15;
    group.add(beam);
    var ring = new THREE.Mesh(
      new THREE.RingGeometry(1.7, 2.4, 28),
      new THREE.MeshBasicMaterial({ color: 0xffc93a, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    group.add(ring);
    group.visible = false;
    return { group: group, beam: beam, ring: ring };
  }
  function setMarker(x, z, color) {
    if (!offerMarker) return;
    offerMarker.group.position.set(x, 0, z);
    offerMarker.group.visible = true;
    offerMarker.beam.material.color.setHex(color);
    offerMarker.ring.material.color.setHex(color);
    markerColor = color;
  }
  function hideMarker() { if (offerMarker) offerMarker.group.visible = false; }
  function markerPos() {
    return offerMarker && offerMarker.group.visible ? offerMarker.group.position : null;
  }

  // ---------- mission definitions ----------
  function S() { return SF.City.spots; }

  var DEFS = [
    {
      title: 'First Run', reward: 300,
      startAt: function () { return S().cafe; },
      intro: [
        { who: 'Marisol', text: 'Rio! You actually came to Sunfall City.' },
        { who: 'Marisol', text: 'First job is simple: a package waits at the plaza fountain. Grab it and take it to my friend at the pier.' }
      ],
      outro: [{ who: 'Marisol', text: 'Clean work. This city pays people who show up.' }],
      steps: function () {
        return [
          { text: 'Pick up the package at the plaza fountain', x: 0, z: 9, r: 5.5, color: 0xffc93a,
            arrive: function () { SF.AU.chime(); } },
          { text: 'Deliver the package to the pier', x: 150, z: 186, r: 7, color: 0xffc93a }
        ];
      }
    },
    {
      title: 'Borrowed Wheels', reward: 450,
      startAt: function () { return S().garage; },
      intro: [
        { who: 'Marisol', text: 'A collector wants one specific magenta coupe, parked up on the north-west side.' },
        { who: 'Marisol', text: 'Take it — gently — and bring it to my garage.' }
      ],
      outro: [{ who: 'Marisol', text: 'Beautiful. The collector wires your cut tonight.' }],
      steps: function () {
        return [
          {
            text: 'Steal the magenta coupe', color: 0xff3fd4,
            start: function () {
              targetCar = SF.Cars.makeCar({ x: -75.5, z: -54, heading: 0, kind: 'parked', color: 0xd83fd0 });
            },
            marker: function () { return targetCar ? targetCar.group.position : null; },
            check: function () { return SF.G.inCar === targetCar; }
          },
          {
            text: 'Deliver the coupe to Marisol’s garage', color: 0xffc93a,
            dynamicText: function () {
              return SF.G.inCar === targetCar
                ? 'Deliver the coupe to Marisol’s garage'
                : 'Get back in the coupe!';
            },
            x: S().garage.x, z: S().garage.z, r: 11,
            check: function (step) {
              if (SF.G.inCar !== targetCar) return false;
              var pp = SF.Player.group.position;
              return U.dist2D(pp.x, pp.z, step.x, step.z) < step.r;
            },
            finish: function () {
              if (targetCar && targetCar.kind !== 'player') targetCar.kind = 'parked';
            }
          }
        ];
      }
    },
    {
      title: 'Checkpoint Run', reward: 600,
      startAt: function () { return { x: -24, z: 81 }; },
      intro: [
        { who: 'Marisol', text: 'My drivers bet you can’t run the boulevard beacons.' },
        { who: 'Marisol', text: 'Hit every checkpoint before the clock dies. Prove them wrong.' }
      ],
      outro: [{ who: 'Marisol', text: 'Fastest courier in Sunfall. The bets are settled — in your favour.' }],
      steps: function () {
        return [{
          text: 'Hit the checkpoints!', color: 0x3fd4ff, checkpoints: true,
          points: [
            { x: -27, z: 27 }, { x: 27, z: -27 }, { x: 81, z: -27 },
            { x: 81, z: 81 }, { x: 27, z: 135 }, { x: -81, z: 81 }
          ],
          time: 115, sub: 0
        }];
      }
    },
    {
      title: 'Heat', reward: 800,
      startAt: function () { return S().garage; },
      intro: [
        { who: 'Marisol', text: 'One pickup at the garage. No questions.' },
        { who: 'Marisol', text: 'The second you grab it, every badge in the city lights up. Lose them, then get to Casa Sol.' }
      ],
      outro: [{ who: 'Marisol', text: 'You ghosted the whole department. I’m impressed.' }],
      steps: function () {
        return [
          { text: 'Pick up the parcel at the garage', x: S().garageDoor.x, z: S().garageDoor.z, r: 6.5, color: 0xffc93a,
            arrive: function () {
              SF.Wanted.setPoints(102); // exactly 3 stars
              SF.AU.chime();
              SF.HUD.showBanner('THE HEAT IS ON', 'Lose the police!');
            } },
          {
            text: 'Lose the heat!', color: 0xff5a3c, phase: 0,
            marker: function () { return S().safehouse; },
            dynamicText: function (step) {
              return step.phase === 0 ? 'Lose the heat!' : 'Get to Casa Sol — the safehouse';
            },
            check: function (step) {
              if (step.phase === 0) {
                if (SF.Wanted.stars() === 0) { step.phase = 1; SF.AU.chime(); }
                return false;
              }
              var pp = SF.Player.group.position;
              return U.dist2D(pp.x, pp.z, S().safehouse.x, S().safehouse.z) < 7.5;
            }
          }
        ];
      }
    },
    {
      title: 'The Briefcase', reward: 1500,
      startAt: function () { return S().garage; },
      intro: [
        { who: 'Marisol', text: 'Last job, Rio. The briefcase by the garage door.' },
        { who: 'Marisol', text: 'Half the city will chase you for it. The pier. Two minutes. Go.' }
      ],
      outro: [{ who: 'Marisol', text: 'That’s the whole story, courier. Sunfall City is yours now.' }],
      steps: function () {
        return [
          { text: 'Grab the briefcase at the garage', x: S().garageDoor.x, z: S().garageDoor.z, r: 6.5, color: 0xffc93a,
            arrive: function () {
              SF.Wanted.setFloor(136); // 4 stars, held while carrying
              SF.Wanted.setPoints(Math.max(SF.Wanted.points(), 136));
              SF.AU.chime();
            } },
          { text: 'Deliver the briefcase to the pier — don’t stop!', x: 150, z: 186, r: 8, color: 0xffc93a,
            time: 130 }
        ];
      }
    }
  ];

  // ---------- runner ----------
  function currentDef() { return completed < DEFS.length ? DEFS[completed] : null; }

  function beginMission() {
    var def = currentDef();
    if (!def) return;
    active = { def: def, steps: def.steps(), idx: 0 };
    SF.HUD.dialogue(def.intro);
    SF.HUD.showBanner('JOB STARTED', def.title);
    SF.AU.beep();
    primeStep();
  }

  function primeStep() {
    var step = active.steps[active.idx];
    step.started = true;
    if (step.time) step.timeLeft = step.time;
    if (step.start) step.start();
    SF.HUD.setObjective(step.text);
  }

  function stepPos(step) {
    if (step.marker) { var p = step.marker(); return p ? { x: p.x, z: p.z } : null; }
    if (step.checkpoints) { var cp = step.points[step.sub]; return { x: cp.x, z: cp.z }; }
    return { x: step.x, z: step.z };
  }

  function advance() {
    var step = active.steps[active.idx];
    if (step.arrive) step.arrive();
    if (step.finish) step.finish();
    active.idx++;
    if (active.idx >= active.steps.length) { completeMission(); return; }
    primeStep();
  }

  function completeMission() {
    var def = active.def;
    active = null;
    hideMarker();
    SF.G.cash += def.reward;
    SF.AU.cash();
    SF.HUD.showBanner('JOB COMPLETE', def.title + '  ·  +$' + def.reward);
    SF.HUD.dialogue(def.outro);
    SF.HUD.setObjective('');
    completed++;
    if (completed >= DEFS.length) {
      SF.G.storyDone = true;
      setTimeout(function () {
        SF.HUD.showBanner('STORY COMPLETE', 'Sunfall City is yours — free roam');
        SF.AU.sting(false);
      }, 2600);
    }
    if (SF.Save) SF.Save.save();
  }

  function failMission(reason) {
    if (!active) return;
    var def = active.def;
    active = null;
    hideMarker();
    SF.Wanted.setFloor(0);
    SF.HUD.showBanner('JOB FAILED', reason || def.title);
    SF.HUD.setObjective('');
    SF.AU.sting(true);
    timerText = '';
  }

  function update(dt) {
    timerText = '';
    var pp = SF.Player && SF.Player.group ? SF.Player.group.position : null;
    if (!pp) return;
    // Marker pulse.
    if (offerMarker && offerMarker.group.visible) {
      var sc = 1 + Math.sin(SF.G.time * 4) * 0.12;
      offerMarker.ring.scale.set(sc, sc, 1);
    }
    if (!active) {
      var def = currentDef();
      if (def && SF.G.mode === 'playing') {
        var at = def.startAt();
        setMarker(at.x, at.z, 0xffc93a);
        SF.HUD.setObjective('New job: head to the gold beacon — ' + def.title);
        if (U.dist2D(pp.x, pp.z, at.x, at.z) < 5) beginMission();
      } else {
        hideMarker();
      }
      return;
    }
    var step = active.steps[active.idx];
    if (step.dynamicText) SF.HUD.setObjective(step.dynamicText(step));
    var pos = stepPos(step);
    if (pos) setMarker(pos.x, pos.z, step.color || 0xffc93a);

    if (step.timeLeft !== undefined && step.timeLeft !== null) {
      step.timeLeft -= dt;
      timerText = '⏱ ' + Math.max(0, Math.ceil(step.timeLeft)) + 's';
      if (step.timeLeft <= 0) { failMission('Out of time'); return; }
    }
    if (step.checkpoints) {
      timerText = '⏱ ' + Math.max(0, Math.ceil(step.timeLeft)) + 's  ·  Checkpoint ' +
        (step.sub + 1) + '/' + step.points.length;
      var cp = step.points[step.sub];
      if (U.dist2D(pp.x, pp.z, cp.x, cp.z) < 8) {
        SF.AU.beep();
        step.sub++;
        step.timeLeft += 6; // small bonus per gate
        if (step.sub >= step.points.length) { advance(); }
      }
      return;
    }
    var done = false;
    if (step.check) done = step.check(step);
    else if (pos) done = U.dist2D(pp.x, pp.z, pos.x, pos.z) < (step.r || 6);
    if (done) advance();
  }

  function init(scene) {
    offerMarker = makeMarker();
    scene.add(offerMarker.group);
  }

  function reset() {
    active = null;
    completed = 0;
    hideMarker();
    timerText = '';
    if (targetCar) targetCar = null;
  }

  function setProgress(n) {
    completed = U.clamp(n, 0, DEFS.length);
    if (completed >= DEFS.length) SF.G.storyDone = true;
  }

  SF.Missions = {
    init: init,
    update: update,
    reset: reset,
    setProgress: setProgress,
    fail: failMission,
    get completed() { return completed; },
    get active() { return active; },
    get timerText() { return timerText; },
    get markerPos() { return markerPos(); },
    total: DEFS.length
  };
})();
