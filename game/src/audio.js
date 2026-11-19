// SUNFALL CITY — all sound is synthesized with WebAudio. No audio files.
// Engine hum, two-tone siren, gunshots, chimes and a slow synth pad loop.
(function () {
  'use strict';
  var U = SF.U;

  var ctx = null;
  var master = null;
  var engineOsc = null, engineOsc2 = null, engineGain = null, engineFilter = null;
  var sirenOsc = null, sirenGain = null;
  var musicOn = false;
  var musicTimer = 0;
  var chordStep = 0;
  var noiseBuf = null;

  // Am — F — C — G pad progression with a soft bass (original loop).
  var CHORDS = [
    [110.00, 220.00, 261.63, 329.63],  // Am
    [87.31, 174.61, 220.00, 261.63],   // F
    [130.81, 196.00, 261.63, 329.63],  // C
    [98.00, 196.00, 246.94, 293.66]    // G
  ];

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = SF.G.muted ? 0 : 0.55;
    master.connect(ctx.destination);

    // Shared noise buffer for shots / thuds / hats.
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    var data = noiseBuf.getChannelData(0);
    for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    // Engine: two detuned saws through a lowpass, gain driven by speed.
    engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth';
    engineOsc2 = ctx.createOscillator(); engineOsc2.type = 'square';
    engineFilter = ctx.createBiquadFilter(); engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 300; engineFilter.Q.value = 2;
    engineGain = ctx.createGain(); engineGain.gain.value = 0;
    engineOsc.connect(engineFilter); engineOsc2.connect(engineFilter);
    engineFilter.connect(engineGain); engineGain.connect(master);
    engineOsc.start(); engineOsc2.start();

    // Siren: square osc whose frequency is flipped in update().
    sirenOsc = ctx.createOscillator(); sirenOsc.type = 'triangle';
    sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain); sirenGain.connect(master);
    sirenOsc.start();

    musicOn = true;
  }

  function tone(freq, dur, type, vol, when, slideTo) {
    if (!ctx) return;
    var t = ctx.currentTime + (when || 0);
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(dur, vol, filterFreq, when, type) {
    if (!ctx) return;
    var t = ctx.currentTime + (when || 0);
    var src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    var f = ctx.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = filterFreq;
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur + 0.05);
  }

  function shot() {
    noise(0.16, 0.5, 2600);
    tone(150, 0.12, 'square', 0.25, 0, 40);
  }
  function dryFire() { tone(1200, 0.04, 'square', 0.08); }
  function reload() { tone(500, 0.05, 'square', 0.12); tone(700, 0.05, 'square', 0.12, 0.12); }
  function thud(big) { noise(0.14, big ? 0.5 : 0.28, 300); tone(70, 0.16, 'sine', big ? 0.4 : 0.2, 0, 38); }
  function spark() { noise(0.07, 0.16, 5200, 0, 'highpass'); }
  function chime() { tone(880, 0.14, 'sine', 0.2); tone(1318, 0.22, 'sine', 0.2, 0.09); }
  function cash() {
    tone(988, 0.09, 'square', 0.12); tone(1319, 0.12, 'square', 0.12, 0.07);
    tone(1568, 0.2, 'square', 0.12, 0.14);
  }
  function click() { tone(660, 0.05, 'sine', 0.15); }
  function beep() { tone(1046, 0.1, 'sine', 0.18); }
  function sting(bad) {
    if (bad) { tone(196, 0.5, 'sawtooth', 0.2, 0, 98); tone(185, 0.6, 'sawtooth', 0.16, 0.08, 92); }
    else { tone(523, 0.16, 'triangle', 0.2); tone(659, 0.16, 'triangle', 0.2, 0.12); tone(784, 0.3, 'triangle', 0.22, 0.24); }
  }
  function door() { tone(220, 0.07, 'square', 0.14, 0, 160); tone(180, 0.06, 'square', 0.1, 0.09, 120); }

  // One pad chord (called on a slow step timer from update()).
  function playChord() {
    if (!ctx || !musicOn) return;
    var notes = CHORDS[chordStep % CHORDS.length];
    chordStep++;
    var dur = 3.6;
    for (var i = 1; i < notes.length; i++) {
      var o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = 'triangle'; o.frequency.value = notes[i];
      o.detune.value = (i - 2) * 4;
      f.type = 'lowpass'; f.frequency.value = 900;
      var t = ctx.currentTime;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.045, t + 0.8);
      g.gain.linearRampToValueAtTime(0.0008, t + dur);
      o.connect(f); f.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + 0.1);
    }
    tone(notes[0], dur * 0.9, 'sine', 0.07);
    tone(notes[0] * 2, dur * 0.5, 'sine', 0.02, dur * 0.45);
  }

  // Called every frame: engine by speed, siren by nearest police, music steps.
  function update(dt, opts) {
    if (!ctx) return;
    var t = ctx.currentTime;
    if (engineGain) {
      var target = 0, rpm = 0;
      if (opts.engineSpeed !== null && opts.engineSpeed !== undefined) {
        var sp = Math.abs(opts.engineSpeed);
        rpm = 55 + sp * 4.2;
        target = 0.05 + Math.min(0.1, sp * 0.004);
      }
      engineGain.gain.setTargetAtTime(target, t, 0.08);
      if (rpm) {
        engineOsc.frequency.setTargetAtTime(rpm, t, 0.05);
        engineOsc2.frequency.setTargetAtTime(rpm * 0.5 + 2, t, 0.05);
        engineFilter.frequency.setTargetAtTime(240 + Math.abs(opts.engineSpeed) * 26, t, 0.1);
      }
    }
    if (sirenGain) {
      var sg = 0;
      if (opts.sirenDist !== null && opts.sirenDist !== undefined && opts.sirenDist < 70) {
        sg = 0.075 * (1 - opts.sirenDist / 70);
        sirenOsc.frequency.setValueAtTime(Math.floor(SF.G.time * 2.6) % 2 ? 720 : 955, t);
      }
      sirenGain.gain.setTargetAtTime(sg, t, 0.1);
    }
    if (musicOn && (SF.G.mode === 'playing' || SF.G.mode === 'menu')) {
      musicTimer -= dt;
      if (musicTimer <= 0) { playChord(); musicTimer = 3.4; }
    }
  }

  function setMuted(m) {
    SF.G.muted = m;
    if (master) master.gain.value = m ? 0 : 0.55;
  }

  SF.AU = {
    init: init,
    update: update,
    setMuted: setMuted,
    shot: shot,
    dryFire: dryFire,
    reload: reload,
    thud: thud,
    spark: spark,
    chime: chime,
    cash: cash,
    click: click,
    beep: beep,
    sting: sting,
    door: door,
    ready: function () { return !!ctx; }
  };
})();
