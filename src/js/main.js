/* ============================================================================
   main.js — boot: restore settings, load a map, restore an interrupted game.
   Loaded LAST. Everything else only declares functions and event handlers.
   ========================================================================== */

if (!MAPS[S.set.map]) S.set.map = MKEYS[0];
if (S.game && S.game.map && !MAPS[S.game.map]) S.game = null;   // saved game used a map that is no longer embedded

loadMap(S.game && S.game.map || S.set.map);
go(fitWorld(), true);
ui();

if (S.game && !S.game.fin && S.game.order) {
  G = S.game;
  G.regs = G.regs || [G.reg || 'World'];
  G.u = G.u || G.order.length;
  G.run = false;
  G.lost = false;
  paint();
  go(viewOf(viewFor(G.regs)), true);
  render();
  if (G.n && (G.mode === 'per' ? G.left : G.pool) <= 0) exhaust(); else show('pause');
} else {
  S.game = null;
  paint();
}
