/* ============================================================================
   ui/screens.js — overlay screens (start / pause / end), the restart key button
   label, and the whole start-screen + pause-menu wiring.
   ========================================================================== */

function show(n) {
  if (n !== 'pause') $('miss').classList.remove('show');
  ['start', 'pause', 'end'].forEach(s => $(s).classList.toggle('show', s === n));
}

/* Segmented control: opts = [[value, label], …]. */
function seg(id, opts, val, fn) {
  const el = $(id);
  el.innerHTML = '';
  opts.forEach(([v, l]) => {
    const b = document.createElement('button');
    b.textContent = l;
    if (v === val) b.className = 'sel';
    b.onclick = () => { fn(v); save(); ui() };
    el.appendChild(b);
  });
}

/* Region buttons: multi-select toggles. "Whole World" is exclusive, at least one stays selected. */
function regSeg() {
  const el = $('regs'), s = S.set;
  el.innerHTML = '';
  REGS.forEach(r => {
    const b = document.createElement('button');
    b.textContent = t(r);
    if (s.regs.includes(r)) b.className = 'sel';
    b.onclick = () => toggleReg(r);
    el.appendChild(b);
  });
}

function toggleReg(r) {
  const s = S.set;
  let a = s.regs;
  if (r === 'World') a = ['World'];
  else {
    a = a.filter(x => x !== 'World');
    a = a.includes(r) ? a.filter(x => x !== r) : [...a, r];
    if (!a.length) a = [r];
  }
  s.regs = a;
  save();
  ui();
}

/* Sub-region picker (modal): one captioned block per continent, separated by divider lines. */
function subSeg() {
  const s = S.set, body = $('subBody');
  body.innerHTML = '';
  SUBS.forEach(([cont, toks]) => {
    const sec = document.createElement('section');
    sec.className = 'sec';
    sec.innerHTML = '<h2></h2><div class="seg" style="margin-top:8px"></div>';
    sec.firstChild.textContent = t(cont);
    toks.forEach(k => {
      const b = document.createElement('button');
      b.textContent = lab(k);
      if (s.regs.includes(k)) b.className = 'sel';
      b.onclick = () => toggleReg(k);
      sec.lastChild.appendChild(b);
    });
    body.appendChild(sec);
  });
}

/* Full repaint of every label from the language table + rebuild of all controls. */
function ui() {
  document.documentElement.lang = S.lang;
  const s = S.set;
  $('tTitle').textContent = t('title'); $('tSub').textContent = t('sub');
  $('lReg').textContent = t('reg'); $('lMode').textContent = t('mode'); $('lN').textContent = t('n');
  $('lShow').textContent = t('show'); $('lLang').textContent = t('lang');
  $('sGame').textContent = t('sGame'); $('sRules').textContent = t('sRules');
  $('sShow').textContent = t('sShow'); $('sSite').textContent = t('sSite'); $('sCtl').textContent = t('sCtl');
  $('lReps').textContent = t('reps'); $('reps').value = s.reps;
  $('lSwr').textContent = t('swr');
  $('lCam').textContent = t('cam'); $('pCam').textContent = t('cam');
  $('pLock').textContent = t('lock');
  $('lTm').textContent = $('pTm').textContent = t('tm');
  $('lTm').parentNode.title = $('pTm').parentNode.title = t('tmTip');
  $('tm').checked = $('tm2').checked = s.tmStop !== false;
  $('lock2').checked = !!s.lockCam;
  document.body.classList.toggle('camlock', !!s.lockCam);
  $('lSm').textContent = t('smooth'); $('pSm').textContent = t('smooth');
  smShow();
  $('cam').checked = $('cam2').checked = !!s.camReset;
  $('lPop').textContent = t('popSize');
  // clicking a size shows a live preview popup
  seg('popSeg', [['s', t('sizeS')], ['m', t('sizeM')], ['l', t('sizeL')]], s.popSize || 'm', v => {
    s.popSize = v;
    setTimeout(() => {
      const r = $('popSeg').getBoundingClientRect();
      pop('−25', '#ffd447', {clientX: r.left + r.width / 2, clientY: r.top - 8}, 'neg');
    }, 0);
  });
  $('swr').checked = !!s.swr;
  $('lMap').textContent = t('map'); $('mapNote').textContent = t('mapNote');
  $('lHard').textContent = t('hard'); $('lHard').parentNode.title = t('hardTip'); $('hard').checked = !!s.hard;
  $('bGo').textContent = t('go'); $('bMenu').textContent = t('menu');
  $('lRk').textContent = t('rk'); $('pRk').textContent = t('rk');
  rkShow();
  $('lSc').textContent = t('score'); $('zr').textContent = t('reset'); $('zg').textContent = t('zreg');
  $('pT').textContent = t('paused'); $('pRes').textContent = t('res');
  $('pRst').textContent = t('rst'); $('pMenu').textContent = t('chg'); $('pL').textContent = t('lang');
  $('mCont').textContent = t('cont'); $('mRst').textContent = t('rst');
  $('eAgain').textContent = t('again'); $('eChg').textContent = t('chg');
  regSeg();
  subSeg();
  {
    const n = s.regs.filter(x => x.includes(':')).length;
    $('bSub').textContent = t('subs') + (n ? ' · ' + n : '') + ' ›';
    $('bSub').className = n ? 'sel' : '';
    $('subInfo').textContent = n ? regLabel(s.regs.filter(x => x.includes(':'))) : '';
    $('subT').textContent = t('subs'); $('subSub').textContent = t('subSub');
    $('subClear').textContent = t('subClear'); $('subDone').textContent = t('subDone');
  }
  seg('mapSeg', MKEYS.map(k => [k, (k === '110' ? t('mapLow') + ' ' : k === '50' ? t('mapHigh') + ' ' : '') + k + 'm']),
    s.map, v => { s.map = v; loadMap(v); paint() });
  {
    const nU = MAPS[s.map].filter(c => inRegMap(c, s.regs)).length;
    $('stat').textContent = t('count') + ': ' + nU + (s.reps > 1 ? ' × ' + s.reps + ' = ' + nU * s.reps : '');
    $('bGo').disabled = !nU;
  }
  seg('mode', [['per', t('per')], ['glob', t('glob')]], s.mode, v => s.mode = v);
  seg('num', [[1, '1'], [3, '3'], [5, '5'], [0, '∞']], s.n, v => s.n = v);
  seg('show', [['flag', t('flag')], ['name', t('name')], ['both', t('both')]], s.show, v => s.show = v);
  const L = [['en', 'English'], ['ru', 'Русский']], sl = v => { S.lang = v };
  seg('lang', L, S.lang, sl);
  seg('lang2', L, S.lang, sl);
  if (G && !G.fin) render();
}

/* ---- start screen / pause menu controls ---- */
$('reps').onchange = e => {
  S.set.reps = Math.min(10, Math.max(1, Math.round(+e.target.value) || 1));
  save();
  ui();
};

function smShow() {
  const v = S.set.smooth;
  $('smooth').value = $('smooth2').value = v;
  $('smV').textContent = $('smV2').textContent = v ? v : t('off');
}

// the same slider / switches appear on the start screen and in the pause menu
$('smooth').oninput = $('smooth2').oninput = e => { S.set.smooth = +e.target.value; smShow(); save() };
$('tm').onchange = $('tm2').onchange = e => { S.set.tmStop = e.target.checked; save(); ui() };
$('lock2').onchange = e => { S.set.lockCam = e.target.checked; save(); ui() };   // pause menu: camera stays exactly where it is
$('cam').onchange = $('cam2').onchange = e => { S.set.camReset = e.target.checked; save(); ui() };
$('swr').onchange = e => { S.set.swr = e.target.checked; save() };
$('hard').onchange = e => { S.set.hard = e.target.checked; save() };

$('bSub').onclick = () => $('subs').classList.add('show');
$('subDone').onclick = () => $('subs').classList.remove('show');
$('subClear').onclick = () => {
  const s = S.set;
  s.regs = s.regs.filter(x => !x.includes(':'));
  if (!s.regs.length) s.regs = ['World'];
  save();
  ui();
};

$('bGo').onclick = newGame;
$('bMenu').onclick = () => { if (!G || G.fin) return; hold(); show('pause'); save() };
$('pRes').onclick = () => { show(''); if (!$('miss').classList.contains('show') || S.set.tmStop === false) unhold(); save() };
$('pRst').onclick = newGame;
$('pMenu').onclick = () => { G = S.game = null; save(); paint(); show('start'); ui() };

addEventListener('resize', () => go(fitWorld(), true));
