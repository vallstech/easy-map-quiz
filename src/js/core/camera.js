/* ============================================================================
   core/camera.js — view transform (pan / zoom), easing, and all input that
   moves it. The Interface panel overrides window.draw (see ui/panel.js).
   ========================================================================== */

const cur = {k: 1, x: 0, y: 0};
const tgt = {k: 1, x: 0, y: 0};
let K0 = 1;                 // world-fit scale: the zoom-out limit is K0 * 0.9
let DRAGT = 8;              // px the mouse must travel before a press becomes a camera drag (Interface panel)
let DRAGT_CLICK = 18;       // stricter limit when the press started on a country: protects the answer

const box = () => $('map').getBoundingClientRect();

function fitWorld() {
  const b = box();
  const w = (VIEWS.World[2] - VIEWS.World[0]) * S_, h = (VIEWS.World[3] - VIEWS.World[1]) * S_;
  // K0 = the scale at which the whole world window fits the viewport; it is the zoom-out
  // limit (K0 * .9). "Reset view" then shows exactly the Whole World box (Pacific-centred).
  K0 = Math.min(b.width / w, b.height / h);
  return viewOf(VIEWS.World);
}

function viewOf(v) {
  const b = box();
  const x0 = (v[0] + 180) * S_, x1 = (v[2] + 180) * S_, y0 = (90 - v[3]) * S_, y1 = (90 - v[1]) * S_;
  const k = Math.min(b.width / (x1 - x0), b.height / (y1 - y0)) * .92;
  return {k, x: b.width / 2 - k * (x0 + x1) / 2, y: b.height / 2 - k * (y0 + y1) / 2};
}

function go(v, instant) {
  if (S.set.lockCam && !instant) return;   // locked: only game start / resize may place the view
  Object.assign(tgt, v);
  if (instant || S.set.lockCam) Object.assign(cur, v);
  last = 0;
  raf();
}

let anim = 0, last = 0;
function raf() {
  // with the camera locked there is nothing to animate: land on the target at once
  if (S.set.lockCam) { Object.assign(cur, tgt); last = 0; draw(); return }
  if (!anim) anim = requestAnimationFrame(step);
}

/* Camera easing used by EVERYTHING that moves the view (wheel, drag, +/−, reset,
   zoom to region, focus on a missed country, camera return): each frame the view
   covers a fraction of the way to its target, independent of the refresh rate.
   Strength = "Camera smoothness" setting (0 = instant … 10 = very floaty). */
const smoothF = () => { const v = S.set.smooth; return v === 0 ? 1 : Math.max(.03, .5 * Math.pow(.78, v)) };

function step(ts) {
  anim = 0;
  // Camera lock: nothing may move the view. Snap to the target and stop the loop, so no
  // easing frames keep running (and no *.mv view simplification is left switched on).
  if (S.set.lockCam) { Object.assign(cur, tgt); last = 0; draw(); return }
  const f = smoothF(), dt = last ? Math.min(ts - last, 50) / 16.667 : 1;
  const al = f >= 1 ? 1 : 1 - Math.pow(1 - f, dt);
  last = ts;
  let m = 0;
  for (const q of ['k', 'x', 'y']) {
    const d = tgt[q] - cur[q];
    cur[q] += d * al;
    m = Math.max(m, Math.abs(d) / (q === 'k' ? cur.k : 1));
  }
  if (m < .001 || f >= 1) Object.assign(cur, tgt);
  draw();
  if (cur.k !== tgt.k || cur.x !== tgt.x || cur.y !== tgt.y) raf();
  else last = 0;
}

/* Base draw: apply the transform and size the micro-state dots.
   The Interface panel replaces this with a faster version (one CSS variable per frame). */
function draw() {
  $('w').setAttribute('transform', `translate(${cur.x} ${cur.y}) scale(${cur.k})`);
  const r = 5 / cur.k;
  dots.forEach(o => { o.dot.setAttribute('r', r); o.hit.setAttribute('r', r * 2.4) });
}

function zoomAt(f, px, py) {
  if (S.set.lockCam) return;
  const k = Math.min(Math.max(tgt.k * f, K0 * .9), K0 * 60), r = k / tgt.k;
  tgt.x = px - (px - tgt.x) * r;
  tgt.y = py - (py - tgt.y) * r;
  tgt.k = k;
  raf();
}

/* ---- input ---- */
const M = $('map');
let drag = null, dragged = false, downId = null;

M.addEventListener('wheel', e => {
  if (S.set.lockCam) return;                        // locked: swallow the wheel entirely, no view change
  e.preventDefault();
  const b = box();
  zoomAt(Math.exp(-e.deltaY * .0016), e.clientX - b.left, e.clientY - b.top);
}, {passive: false});

M.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  downId = (e.target.dataset && e.target.dataset.id) || null;
  // with the camera locked a press can only be a click: no pan state is even created
  drag = S.set.lockCam ? null : {x: e.clientX, y: e.clientY, tx: tgt.x, ty: tgt.y, onCountry: !!downId};
  dragged = false;
});

addEventListener('mousemove', e => {
  if (!drag) return;
  if (S.set.lockCam) return;                        // locked: a press never becomes a pan
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!dragged) {
    // Below the threshold the camera does NOT move at all (the press still counts as a click).
    // A press that STARTED ON A COUNTRY gets the stricter limit: the player is aiming at that
    // country, and a 2-pixel hand tremor must never turn their answer into a camera pan.
    const lim = drag.onCountry ? Math.max(DRAGT, DRAGT_CLICK) : DRAGT;
    if (Math.hypot(dx, dy) <= lim) return;
    dragged = true;
    M.classList.add('drag');
  }
  // the view follows the target with the same easing (glides a bit after release)
  tgt.x = drag.tx + dx;
  tgt.y = drag.ty + dy;
  raf();
});

/* A country is picked on mouse UP, for the country under the spot where the press
   STARTED, so a little hand jitter or sliding over a border can't lose the click. */
addEventListener('mouseup', e => {
  // a click is a press that never became a pan — with the camera locked `drag` was never
  // created, which is exactly "never became a pan", so the country under the press still counts
  if (e.button === 0 && !dragged && downId) onClick(downId, e);
  drag = null; dragged = false; downId = null;
  M.classList.remove('drag');
});

// no browser menu on right click (but keep it inside text fields)
addEventListener('contextmenu', e => {
  if (!(e.target.closest && e.target.closest('textarea,input[type=text]'))) e.preventDefault();
});

$('zi').onclick = () => { const b = box(); zoomAt(1.6, b.width / 2, b.height / 2) };
$('zo').onclick = () => { const b = box(); zoomAt(1 / 1.6, b.width / 2, b.height / 2) };
$('zr').onclick = () => go(fitWorld());
$('zg').onclick = () => go(viewOf(viewFor((G && G.regs) || S.set.regs)));
