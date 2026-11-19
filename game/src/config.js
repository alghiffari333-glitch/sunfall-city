// SUNFALL CITY — configuration and shared game state.
// Every module attaches to the single window.SF namespace. Classic scripts,
// loaded in dependency order from index.html. No network, no modules.
window.SF = window.SF || {};
(function () {
  'use strict';

  // Road centre lines (world units, metres). Blocks of 40 m sit between
  // 14 m-wide roads, giving a 54 m pitch and a city about 340 m across.
  var CENTERS = [-135, -81, -27, 27, 81, 135];

  SF.CFG = {
    ROAD_W: 14,
    BLOCK: 40,
    PITCH: 54,
    ROAD_CENTERS: CENTERS,
    CITY_MIN: -162,
    CITY_MAX: 162,
    BEACH_Z: 168,          // sand starts here (south edge)
    WATER_Z: 200,          // water starts here
    BOUND_X: 182,
    BOUND_Z_MIN: -182,
    BOUND_Z_MAX: 196,
    LANE_OFF: 3.2,         // lane offset from road centre (right-hand traffic)
    TRAFFIC_COUNT: 12,
    PARKED_COUNT: 9,
    PED_COUNT: 38,
    GRAVITY: 26,
    SAVE_KEY: 'sunfall-city-save-v1',
    // Palette — golden hour on a palm coast.
    SKY_TOP: 0x2f6db3,
    SKY_MID: 0xffb36b,
    SKY_LOW: 0xffe3ae,
    FOG: 0xf7c489,
    SUN: 0xffd9a0,
    ASPHALT: '#33373d',
    SIDEWALK: '#939a9e',
    WATER: 0x2f8fae,
    SAND: 0xecd9a0
  };

  // Mutable run-time state shared by all modules.
  SF.G = {
    mode: 'menu', // menu | playing | paused | busted | wasted
    time: 0,
    cash: 250,
    storyDone: false,
    muted: false,
    started: false,
    keys: {},
    mouseDX: 0,
    mouseDY: 0,
    mouseDown: false,
    pointerLocked: false,
    camYaw: Math.PI,   // camera orbit around the player
    camPitch: 0.34,
    damageFlash: 0,
    hint: '',          // contextual prompt, e.g. "E — Enter car"
    inCar: null,       // car object the player is driving, or null
    saveTimer: 0
  };

  // Live snapshot for screenshot automation / debugging (see main.js).
  SF.state = {
    mode: 'menu',
    playerPos: { x: 0, y: 0, z: 0 },
    wanted: 0,
    stars: 0,
    missionIndex: 0,
    cash: 250,
    health: 100,
    inCar: false
  };
})();
