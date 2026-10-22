// Sprachumschaltung der App: Deutsch (Quelltext) und Englisch.
// Wie in der EFB: Für Englisch übersetzt dieses Modul Texte und Attribute anhand eines Wörterbuchs (i18n-en.js).
// Unbekannte Texte bleiben deutsch, nichts geht kaputt. Die Wahl kommt aus den App-Einstellungen
// („Automatisch“ = Sprache von Windows bzw. des Browsers).
'use strict';
(function () {
  let lang = 'de';
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  function tr(s) {
    if (lang !== 'en' || typeof s !== 'string' || !/[A-Za-zÄÖÜäöüß]/.test(s)) return s;
    const lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0], core = norm(s);
    if (!core) return s;
    const d = window.EN_DICT || {};
    if (Object.prototype.hasOwnProperty.call(d, core)) return lead + d[core] + trail;
    for (const [re, fn] of window.EN_PATTERNS || []) {
      const m = core.match(re);
      if (m) return lead + (typeof fn === 'function' ? fn(...m.slice(1), tr) : core.replace(re, fn)) + trail;
    }
    // Mehrere Sätze hintereinander (z. B. „Automatisch gefunden. Das Modul fehlt …“): an einer Satzgrenze teilen
    if (/[.!?] \S/.test(core)) {
      const parts = core.split(/(?<=[.!?]) (?=\S)/);
      for (let i = 1; i < parts.length; i++) {
        const h = parts.slice(0, i).join(' '), r = parts.slice(i).join(' '), th = tr(h), trr = tr(r);
        if (th !== h && trr !== r) return lead + th + ' ' + trr + trail;
      }
      const out = parts.map((x) => tr(x));
      if (out.some((x, i) => x !== parts[i])) return lead + out.join(' ') + trail;
    }
    return s;
  }
  window.t = tr;
  const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  const SKIP = /^(SCRIPT|STYLE|TEXTAREA|CODE|PRE|INPUT)$/;
  const skipEl = (el) => !el || SKIP.test(el.tagName) || (el.closest && el.closest('[data-no-i18n]'));
  function doText(n) { if (skipEl(n.parentElement)) return; const o = n.nodeValue, r = tr(o); if (r !== o) n.nodeValue = r; }
  function doEl(el) {
    if (el.nodeType !== 1) return;
    if (!/^(SCRIPT|STYLE)$/.test(el.tagName) && !(el.closest && el.closest('[data-no-i18n]'))) {
      for (const a of ATTRS) { const v = el.getAttribute(a); if (v) { const r = tr(v); if (r !== v) el.setAttribute(a, r); } }
    }
  }
  function walk(root) {
    if (root.nodeType === 3) return doText(root);
    if (root.nodeType !== 1) return;
    doEl(root);
    if (skipEl(root)) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) doText(n); else doEl(n); }
  }
  let started = false;
  // Einmal aufrufen, sobald die gewählte Sprache bekannt ist ('' = automatisch). Gibt die wirksame Sprache zurück.
  window.I18N = {
    apply(pref) {
      const want = pref === 'en' || pref === 'de' ? pref : (/^de\b/i.test(navigator.language || 'de') ? 'de' : 'en');
      lang = want; document.documentElement.lang = want;
      if (want === 'en' && !started) {
        started = true;
        document.title = tr(document.title);
        walk(document.body);
        new MutationObserver((list) => {
          for (const m of list) {
            if (m.type === 'childList') m.addedNodes.forEach(walk);
            else if (m.type === 'characterData') doText(m.target);
            else if (m.type === 'attributes') doEl(m.target);
          }
        }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
      }
      return want;
    },
    get lang() { return lang; },
  };
})();
