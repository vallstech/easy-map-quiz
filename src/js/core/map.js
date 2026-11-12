/* ============================================================================
   core/map.js — SVG construction for the embedded maps.
   Also owns els / dots, the per-country element lists that the game logic
   colours (els[id] = array of elements of that country).
   ========================================================================== */

const NS = 'http://www.w3.org/2000/svg';
let els = {}, dots = [];

function mk(tag, at, par) {
  const e = document.createElementNS(NS, tag);
  for (const k in at) e.setAttribute(k, at[k]);
  par.appendChild(e);
  return e;
}

/* (Re)builds the SVG for one of the embedded maps. Called on boot and when the
   map detail is changed on the start screen. */
function loadMap(key) {
  curMap = key;
  DATA = MAPS[key];
  byId = {};
  els = {};
  dots = [];
  $('land').innerHTML = '';
  $('dots').innerHTML = '';
  DATA.forEach(c => byId[c.id] = c);
  DATA.forEach(c => {
    els[c.id] = [];
    if (c.d) {
      const p = mk('path', {d: c.d, class: 'c', 'data-id': c.id}, $('land'));
      els[c.id].push(p);
    }
    if (c.a < 6 || !c.d) {
      // micro-state: visible dot + oversized invisible hit area (like Seterra)
      const g = {cx: c.c[0], cy: c.c[1]};
      const dot = mk('circle', {...g, class: 'dot'}, $('dots'));
      const hit = mk('circle', {...g, class: 'hit', 'data-id': c.id}, $('dots'));
      dots.push({dot, hit});
      els[c.id].push(dot, hit);
    }
  });
  draw();
}
