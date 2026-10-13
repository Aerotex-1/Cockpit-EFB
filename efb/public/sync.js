// Gemeinsamer Checklisten-Stand: PC-App (Copilot) und iPad sehen dieselben Haken.
// Schreibt jede Änderung von 'cl.*' an den Server und übernimmt Änderungen anderer Geräte.
(function () {
  const ID = (store.get('deviceId', '') || (() => { const v = Math.random().toString(36).slice(2, 10); store.set('deviceId', v); return v; })());
  window.EFB_ID = ID;
  const raw = store.set.bind(store);
  const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {});
  window.efbPost = post;
  store.set = function (k, v) {
    raw(k, v);
    if (/^cl\./.test(k) && v && typeof v === 'object') post('/api/cl', { k, v, from: ID });
  };
  // beim Start: Stand des Servers übernehmen (was dort fehlt, schicken wir hin)
  fetch('/api/cl').then((r) => r.json()).then((srv) => {
    let changed = false;
    Object.keys(srv || {}).forEach((k) => { try { if (JSON.stringify(store.get(k, null)) !== JSON.stringify(srv[k])) { raw(k, srv[k]); changed = true; } } catch { /* egal */ } });
    Object.keys(localStorage).filter((k) => /^efb\.cl\./.test(k)).forEach((k) => { const kk = k.slice(4); if (!(kk in (srv || {}))) { const v = store.get(kk, null); if (v) post('/api/cl', { k: kk, v, from: ID }); } });
    if (changed && typeof renderChecklists === 'function' && app.tab === 'check') renderChecklists();
  }).catch(() => {});
  window.onEfbEvent = function (name, d) {
    if (name === 'cl' && d.from !== ID) {
      raw(d.k, d.v);
      if (typeof renderChecklists === 'function' && app.tab === 'check') renderChecklists();
      if (window.Copilot && window.Copilot.onRemoteTick) window.Copilot.onRemoteTick(d.k);
    }
    if (window.Copilot && window.Copilot.onEvent) window.Copilot.onEvent(name, d);
  };
})();
