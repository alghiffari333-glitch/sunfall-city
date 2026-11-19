// SUNFALL CITY — localStorage save: cash, story progress, position.
// One slot, written on mission completion, pause, bust/waste and a timer.
(function () {
  'use strict';

  function exists() {
    try { return !!window.localStorage.getItem(SF.CFG.SAVE_KEY); }
    catch (e) { return false; }
  }

  function save() {
    if (!SF.Player || !SF.Player.group) return;
    var p = SF.Player.group.position;
    var data = {
      v: 1,
      cash: SF.G.cash,
      missions: SF.Missions ? SF.Missions.completed : 0,
      storyDone: !!SF.G.storyDone,
      x: Math.round(p.x * 10) / 10,
      z: Math.round(p.z * 10) / 10,
      heading: SF.Player.getHeading()
    };
    try { window.localStorage.setItem(SF.CFG.SAVE_KEY, JSON.stringify(data)); }
    catch (e) { /* private mode etc. — saving is best-effort */ }
  }

  function load() {
    try {
      var raw = window.localStorage.getItem(SF.CFG.SAVE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || typeof data.cash !== 'number' || typeof data.x !== 'number') return null;
      return data;
    } catch (e) { return null; }
  }

  function clear() {
    try { window.localStorage.removeItem(SF.CFG.SAVE_KEY); }
    catch (e) { /* ignore */ }
  }

  SF.Save = { exists: exists, save: save, load: load, clear: clear };
})();
