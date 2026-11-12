/* ============================================================================
   game/game.js — rules and state of a running game: round order, scoring,
   timers, missed-country flow, final stats. Drives the camera and the screens.
   ========================================================================== */

let G = null;   // = S.game (persisted between sessions)

const now = () => performance.now();
const gt = () => G.t + (G.run ? Date.now() - G.ts : 0);   // game time excludes pauses
const hold = () => { if (G && G.run) { G.t += Date.now() - G.ts; G.run = false } };
const unhold = () => { if (G && !G.run) { G.ts = Date.now(); G.run = true } };

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Every country `reps` times, as `reps` shuffled rounds. A round never starts with
   the country that ended the previous one, so the same country is never asked twice in a row. */
function buildOrder(ids, reps) {
  const n = ids.length, out = [];
  if (n < 2) reps = 1;
  for (let r = 0; r < reps; r++) {
    const round = shuffle(ids.slice());
    if (out.length && round[0] === out[out.length - 1]) {
      const j = 1 + Math.floor(Math.random() * (n - 1));
      [round[0], round[j]] = [round[j], round[0]];
    }
    out.push(...round);
  }
  return out;
}

function newGame() {
  const s = S.set;
  if (curMap !== s.map) loadMap(s.map);
  const regs = s.regs.slice(), ids = DATA.filter(c => inReg(c.id, regs)).map(c => c.id);
  G = S.game = {
    regs, reps: s.reps, u: ids.length, swr: !!s.swr, mode: s.mode, n: s.n, show: s.show,
    keep: !s.hard, map: s.map, order: buildOrder(ids, s.reps), i: 0, done: {},
    left: s.n, pool: s.n, errors: 0, score: 0, first: 0, t: 0, ts: Date.now(), run: true,
    cs: 0, wr: 0, fin: false, t0: null
  };
  save();
  show('');
  paint();
  go(viewOf(viewFor(G.regs)), true);
  next(true);
}

const cid = () => G.order[G.i];

/* Repaint the colours of every country (also clears leftover highlight classes). */
function paint() {
  for (const id in els) {
    els[id].forEach(e => e.classList.remove('hint', 'bad', 'okf', 'skf', 'fo'));
    state(id);
  }
}

function state(id) {
  // keep=false (hard mode): found countries look normal and stay clickable
  const k = G && G.keep !== false;
  const s = !G || !inReg(id, G.regs) ? 'off' : k && G.done[id] === 1 ? 'ok' : k && G.done[id] === 0 ? 'skip' : 'on';
  els[id].forEach(e => e.dataset.s = s);
}

function next(first) {
  if (G.i >= G.order.length) return finish();
  if (!first && G.u && G.i % G.u === 0) { G.done = {}; paint() }   // a new round starts: colours are reset
  if (G.mode === 'per') G.left = G.n;
  G.wr = 0;
  G.cs = gt();
  render();
  if (!first) save();
}

const id_done = id => G.done[id] !== undefined;

function render() {
  const id = cid(), sh = G.show;
  $('task').innerHTML = (sh !== 'name' ? flag(id) : '') + (sh !== 'flag' ? `<span class="nm">${nm(id)}</span>` : '');
  $('sc').textContent = G.score;
  $('prog').textContent = G.i + ' / ' + G.order.length;
  const inf = !G.n, v = G.mode === 'per' ? G.left : G.pool;
  $('att').innerHTML = inf
    ? '<b>∞</b>'
    : Array.from({length: G.n}, (_, i) => `<span class="pip ${i < v ? '' : 'x'}"></span>`).join('')
      + `<span class="mute">&nbsp;${t(G.mode === 'per' ? 'per' : 'glob')}</span>`;
}

/* Floating text at the click. cls='neg' = the big yellow mistake pill. */
function pop(txt, col, e, cls) {
  const p = document.createElement('div');
  p.id = 'pop';
  p.textContent = txt;
  p.style.color = col;
  p.style.left = (e ? e.clientX : innerWidth / 2) + 'px';
  p.style.top = (e ? e.clientY : 120) + 'px';
  document.body.appendChild(p);
  if (cls === 'neg') {
    p.className = 'neg';
    p.style.fontSize = ({s: 17, m: 24, l: 32})[S.set.popSize || 'm'] + 'px';
    setTimeout(() => p.remove(), 2500);   // big yellow pill, stays ~2 s (CSS animation)
    return;
  }
  p.style.transform = 'translateX(-50%)';
  requestAnimationFrame(() => { p.style.transform = 'translate(-50%,-40px)'; p.style.opacity = 0 });
  setTimeout(() => p.remove(), 1000);
}

const ft = {};
/* Green appears instantly, then fades back over 1 s (.okf has no transition, .fo adds a 1 s one). */
function flashFade(id, cls) {
  const L = els[id];
  (ft[id] || []).forEach(clearTimeout);
  L.forEach(e => { e.classList.remove('fo'); e.classList.add(cls) });
  ft[id] = [
    setTimeout(() => L.forEach(e => { e.classList.remove(cls); e.classList.add('fo') }), 60),
    setTimeout(() => L.forEach(e => e.classList.remove('fo')), 1100)
  ];
}

function flash(id, cls, ms) {
  els[id].forEach(e => e.classList.add(cls));
  if (ms) setTimeout(() => els[id].forEach(e => e.classList.remove(cls)), ms);
}

function onClick(id, e) {
  if (!G || G.fin || !G.run || G.lost || !inReg(id, G.regs)) return;   // G.lost = out of tries, waiting for Continue / Restart
  if (id !== cid() && id_done(id) && G.keep !== false) return;         // normal mode: found countries are inert
  // Hard mode falls through and a re-click on a found country counts as a wrong try.
  if (G.t0 === null) G.t0 = gt();   // first click: the reported game time starts here (t0===undefined = old save: whole time counts)
  if (id === cid()) {
    const bonus = Math.round(BONUS * Math.max(0, 1 - (gt() - G.cs) / BTIME));
    const gain = Math.max(0, BASE - PEN * G.wr + bonus);
    G.score += gain;
    if (G.wr === 0) G.first++;
    G.done[id] = 1;
    state(id);
    if (G.keep === false) flashFade(id, 'okf');
    pop('+' + gain, '#3aa874', e);
    if (S.set.camReset) go(viewOf(viewFor(G.regs)));
    G.i++;
    next();
  } else {
    G.errors++;
    G.wr++;
    flash(id, 'bad', 450);
    if (G.n) { if (G.mode === 'per') G.left--; else G.pool-- }
    const pen = Math.min(PEN, G.score);
    G.score -= pen;
    pop('−' + PEN + (G.swr ? ' ' + nm(id) : ''), '#ffd447', e, 'neg');
    render();
    save();
    if (G.n && (G.mode === 'per' ? G.left : G.pool) <= 0) exhaust();
  }
}

/* Fly to the country the player just lost. */
function focusOn(id) {
  const c = byId[id], [x0, y0, x1, y1] = c.b || [c.c[0] - 20, c.c[1] - 20, c.c[0] + 20, c.c[1] + 20];
  const bx = box();
  const w = Math.max(x1 - x0, 40), h = Math.max(y1 - y0, 40), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const k = Math.min(Math.min(bx.width / w, bx.height / h) * .55, K0 * 60);
  go({k, x: bx.width / 2 - k * cx, y: bx.height * .45 - k * cy});
}

/* Out of tries for the current country: show the "It was X" panel. */
function exhaust() {
  G.lost = true;
  // setting: the timer stops while the panel is open (default) or keeps running
  if (S.set.tmStop === false) unhold(); else hold();
  const id = cid();
  flash(id, 'hint');
  focusOn(id);
  $('mT').textContent = t('itwas');
  $('mC').innerHTML = flag(id) + `<span style="font:600 22px Georgia,serif">${nm(id)}</span>`;
  $('miss').classList.add('show');
  save();
}

$('mCont').onclick = () => {
  const id = cid();
  els[id].forEach(e => e.classList.remove('hint'));
  G.lost = false;
  G.done[id] = 0;
  state(id);
  G.i++;
  $('miss').classList.remove('show');
  unhold();
  if (G.mode === 'glob' && G.n && G.pool <= 0) finish(); else next();
};
$('mRst').onclick = () => { $('miss').classList.remove('show'); paint(); newGame() };

function finish() {
  hold();
  G.fin = true;
  const tot = G.order.length;
  // reported time = from the first click to the end, pauses excluded
  // (t0 === undefined = save from an older version: the whole time counts)
  const used = G.t0 === undefined ? G.t : G.t - (G.t0 === null ? G.t : G.t0);
  const rec = {regs: G.regs, score: G.score, time: used, err: G.errors, pct: Math.round(100 * G.first / tot), d: Date.now()};
  S.recent = [rec, ...S.recent].slice(0, 5);
  save();
  const f = ms => { const s = Math.round(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') };
  $('eT').textContent = t('done') + ' — ' + regLabel(G.regs);
  $('eTab').innerHTML = [
    [t('time'), f(used)], [t('pts'), G.score], [t('err'), G.errors],
    [t('first'), rec.pct + '% (' + G.first + '/' + tot + ')']
  ].map(r => `<tr><td>${r[0]}</td><td><b>${r[1]}</b></td></tr>`).join('')
    + `<tr><td colspan=2 class="mute" style="padding-top:12px">${t('last')}</td></tr>`
    + S.recent.slice(1).map(r => `<tr><td class="mute">${regLabel(r.regs || [r.reg])}</td><td class="mute">${r.score} · ${f(r.time)}</td></tr>`).join('');
  show('end');
}

$('eAgain').onclick = () => newGame();
$('eChg').onclick = () => { G = S.game = null; save(); paint(); show('start'); ui() };
