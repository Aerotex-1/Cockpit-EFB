// Sprachumschaltung: Deutsch (Standard) und Englisch.
// Die Oberfläche ist auf Deutsch geschrieben. Für Englisch übersetzt dieses Modul Texte und Attribute
// anhand von Wörterbuch (i18n-en.js) und Mustern. Unbekannte Texte bleiben deutsch, nichts geht kaputt.
'use strict';
(function () {
  let lang = 'de';
  try {
    const s = JSON.parse(localStorage.getItem('efb.lang') || 'null');
    lang = s === 'en' || s === 'de' ? s : (/^de\b/i.test(navigator.language || 'de') ? 'de' : 'en');
  } catch { /* Standard */ }
  window.LANG = lang;
  document.documentElement.lang = lang;

  const dict = () => window.EN_DICT || {};
  const pats = () => window.EN_PATTERNS || [];
  const norm = (s) => s.replace(/\s+/g, ' ').trim();

  function tr(s) {
    if (lang !== 'en' || typeof s !== 'string' || !/[A-Za-zÄÖÜäöüß]/.test(s)) return s;
    const lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0], core = norm(s);
    if (!core) return s;
    const d = dict();
    if (Object.prototype.hasOwnProperty.call(d, core)) return lead + d[core] + trail;
    for (const [re, fn] of pats()) {
      const m = core.match(re);
      if (m) return lead + (typeof fn === 'function' ? fn(...m.slice(1), tr) : core.replace(re, fn)) + trail;
    }
    let out = core, changed = false;
    for (const [re, r] of window.EN_SUBS || []) { const n = out.replace(re, r); if (n !== out) { out = n; changed = true; } }
    return changed ? lead + out + trail : s;
  }
  window.t = tr;
  window.i18n = { lang, t: tr, set(l) { try { localStorage.setItem('efb.lang', JSON.stringify(l)); } catch { /* egal */ } location.reload(); } };
  if (lang !== 'en') return;

  const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  const SKIP = /^(SCRIPT|STYLE|TEXTAREA|CODE|PRE)$/;
  const skipEl = (el) => !el || SKIP.test(el.tagName) || (el.closest && el.closest('[data-no-i18n]'));
  function doText(n) {
    if (skipEl(n.parentElement)) return;
    const o = n.nodeValue, r = tr(o);
    if (r !== o) n.nodeValue = r;
  }
  function doEl(el) {
    if (el.nodeType !== 1 || skipEl(el)) return;
    for (const a of ATTRS) { const v = el.getAttribute(a); if (v) { const r = tr(v); if (r !== v) el.setAttribute(a, r); } }
  }
  function walk(root) {
    if (root.nodeType === 3) return doText(root);
    if (root.nodeType !== 1 || skipEl(root)) return;
    doEl(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) doText(n); else if (!skipEl(n)) doEl(n); }
  }
  // Rückfragen des Browsers
  const _confirm = window.confirm.bind(window);
  window.confirm = (m) => _confirm(tr(m));
  const _prompt = window.prompt.bind(window);
  window.prompt = (m, d) => _prompt(tr(m), d);

  function start() {
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
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
