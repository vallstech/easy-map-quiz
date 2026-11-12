/* ============================================================================
   game/keys.js — restart button + configurable restart key, and the global
   Escape behaviour. Keys are stored as KeyboardEvent.code, so they work on any
   keyboard layout. Default: R.
   ========================================================================== */

let capturing = null;   // id of the key button that is waiting for a key press

const keyLabel = c => c.replace(/^Key|^Digit/, '');

function rkShow() {
  ['rkey', 'rkey2'].forEach(id => {
    $(id).textContent = capturing === id ? '…' : keyLabel(S.set.rkey);
    $(id).title = t('rkTip');
  });
  $('bRestart').textContent = t('restart') + ' (' + keyLabel(S.set.rkey) + ')';
}

/* Restart with the same region(s) and settings as the current game. */
const restart = () => { if (G) newGame() };

$('bRestart').onclick = restart;
$('rkey').onclick = $('rkey2').onclick = ev => { capturing = ev.currentTarget.id; rkShow() };

addEventListener('mousedown', e => {
  if (capturing && !e.target.closest('#rkey,#rkey2')) { capturing = null; rkShow() }
});

addEventListener('keydown', e => {
  if (capturing) {
    e.preventDefault();
    if (/^(Shift|Control|Alt|Meta|OS)/.test(e.code)) return;   // modifiers alone are ignored, Esc cancels
    if (e.code !== 'Escape') { S.set.rkey = e.code; save() }
    capturing = null;
    rkShow();
    return;
  }
  if (e.key === 'Escape') {
    if ($('subs').classList.contains('show')) $('subs').classList.remove('show');
    else if (G && !G.fin && G.run) $('bMenu').click();
    return;
  }
  if (e.code === S.set.rkey && !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat
      && !(e.target.matches && e.target.matches('input[type=number],select,textarea'))) restart();
});
