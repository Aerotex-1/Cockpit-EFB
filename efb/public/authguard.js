// Läuft die Kopplung ab (PIN bei jedem Öffnen), führt jede abgewiesene Anfrage zur PIN-Seite
'use strict';
(function () {
  const f = window.fetch.bind(window);
  let going = false;
  const go = () => { if (going) return; going = true; location.replace('/pair.html'); };
  window.fetch = function (...a) {
    return f(...a).then((r) => { if (r.status === 401 && !/\/api\/pair/.test(String(a[0]))) go(); return r; });
  };
  // Kommt die Seite aus dem Hintergrund zurück, einmal prüfen
  document.addEventListener('visibilitychange', () => { if (!document.hidden) f('/api/auth/status', { cache: 'no-store' }).then((r) => { if (r.status === 401) go(); }).catch(() => {}); });
})();
