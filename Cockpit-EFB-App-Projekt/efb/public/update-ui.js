// Update aus ZIP installieren (Setup → Info). Nur am PC.
(function () {
  const box = $('#updBox'); if (!box) return;
  if (window.EFBWebExtra) { box.hidden = true; return; }
  const msg = (t, bad) => { const m = $('#updMsg'); m.textContent = t; m.className = 'note' + (bad ? ' bad' : ''); };
  fetch('/api/auth/status').then((r) => r.json()).then((s) => { if (!s.local) box.hidden = true; }).catch(() => {});
  $('#updFile').addEventListener('change', (e) => { $('#updGo').disabled = !e.target.files[0]; msg(''); });
  $('#updGo').addEventListener('click', async () => {
    const f = $('#updFile').files[0]; if (!f) return;
    $('#updGo').disabled = true; msg('Wird installiert …');
    try {
      const r = await fetch('/api/update/install', { method: 'POST', headers: { 'Content-Type': 'application/zip' }, body: f });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Fehler');
      msg(`Version ${j.from} → ${j.to}: ${j.changed} Dateien aktualisiert. Zum Anwenden neu starten.`);
      $('#updRestart').hidden = false;
    } catch (e) { msg(e.message, true); $('#updGo').disabled = false; }
  });
  $('#updRestart').addEventListener('click', async () => {
    const j = await fetch('/api/update/restart', { method: 'POST' }).then((r) => r.json()).catch(() => null);
    if (!j) return msg('Neustart nicht möglich.', true);
    if (!j.managed) return msg('Bitte die EFB jetzt selbst neu starten (Fenster schließen, start.bat öffnen). Das automatische Neustarten klappt nur mit start.bat.');
    msg('Startet neu …');
    const t0 = Date.now();
    const poll = setInterval(async () => {
      if (Date.now() - t0 > 90000) { clearInterval(poll); return msg('Der Neustart dauert ungewöhnlich lang – bitte start.bat prüfen.', true); }
      try { const r = await fetch('/api/info', { cache: 'no-store' }); if (r.ok && Date.now() - t0 > 1500) { clearInterval(poll); location.reload(); } } catch { /* noch down */ }
    }, 1200);
  });
})();
