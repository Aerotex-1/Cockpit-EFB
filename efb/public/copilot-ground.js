// Bodencrew wie im echten Betrieb: meldet sich von selbst („Ground to Cockpit, …“) bei Pushback-Ende,
// Triebwerksstart-Freigabe, Abkoppeln und nach der Landung. Läuft nur im Copilot-Fenster am PC.
(function () {
  const HOST = /[?&]host=1\b/.test(location.search);
  if (!HOST) return;
  const core = () => window.Copilot && window.Copilot._core;
  const on = () => { const c = core(); return !!c && (!c.pref.life || c.pref.life.ground !== false); };
  const ready = () => { const c = core(); return !!c && c.S.on && !c.isMuted() && !c.S.speaking && c.S.mode !== 'gsxMenu'; };
  const sim = () => app.sim || {};
  const gnd = () => (sim().efb || {}).ground || {};
  const F = { prevPush: false, pushSaid: false, engSaid: false, engSince: 0, discSaid: false, flown: false, arrSaid: false, brakeSince: 0 };
  function reset() { core().S.pushAt = 0; F.pushSaid = F.engSaid = F.discSaid = F.arrSaid = false; F.engSince = F.brakeSince = 0; const S = core().S; S.pushDone = S.engCleared = S.discDone = 0; }
  function tick() {
    const c = core(), s = sim(); if (!c || !on() || !s.connected) return;
    const S = c.S, g = gnd(), now = Date.now();
    if (!s.onGround) { if (!F.flown) { F.flown = true; reset(); } F.prevPush = false; return; }
    // Landung → am Stand
    if (F.flown && (s.gs || 0) < 1 && c.brk() !== false && !g.enginesRunning) {
      if (!F.arrSaid && ready()) {
        F.arrSaid = true; F.flown = false;
        c.efbAct && g.chocks === false && c.efbAct('chocks');
        c.call('Welcome. Chocks are in place, ground power is available on request.', ['arrival', 'welcome']);
      }
      return;
    }
    // Pushback beendet (auch ohne GSX): Parkbremse setzen
    if (g.pushback) F.prevPush = true;
    else if (F.prevPush) {
      F.prevPush = false;
      if (!S.pushDone || now - S.pushDone > 30000) { const loud = !c.pushBusy() || c.lifeOn('groundPush'); if (!loud) { S.pushDone = now; S.pushOver = true; } else if (ready()) { S.pushDone = now; S.pushOver = true; c.call('Pushback complete, set parking brake.', ['pushback.done']); } else F.prevPush = true; }
    }
    if ((s.gs || 0) > 3) return;
    // Parkbremse gesetzt nach Pushback → Triebwerke starten
    const pushedAt = S.pushDone && now - S.pushDone < 15 * 60000;
    if (pushedAt && !g.pushback && c.brk() !== false && !g.enginesRunning && !F.engSaid) {
      F.brakeSince = F.brakeSince || now;
      if (now - F.brakeSince > (c.brk() === true ? 3000 : 12000) && ready()) { F.engSaid = true; c.engineClear(false); }
    } else if (c.brk() === false) F.brakeSince = 0;
    // beide Triebwerke laufen → abkoppeln
    if (F.engSaid && g.enginesRunning && !F.discSaid) {
      F.engSince = F.engSince || now;
      if (now - F.engSince > 8000 && ready()) { F.discSaid = true; c.disconnectNow(false); }
    } else if (!g.enginesRunning) F.engSince = 0;
  }
  setInterval(() => { try { tick(); } catch (e) { /* weiter */ } }, 1500);
  window.CopilotGround = { F, tick, reset };
})();
