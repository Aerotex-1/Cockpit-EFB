// Rollweg-Navigation: liest die Rollwege des Flughafens (OpenStreetMap über /api/ground) und bestimmt für die
// eingegebene Rollroute, wo das Flugzeug gerade ist, wo es als Nächstes abbiegen muss und in welche Richtung.
// Wird von der Karte (nur aktueller und nächster Abschnitt) und vom Copilot (Ansagen) genutzt. Reine Anzeige.
'use strict';
window.TaxiNav = (() => {
  const RAD = Math.PI / 180;
  const RWY_RE = /^\d{2}[LRC]?$/;
  const data = {}; // icao -> { lat0, lon0, twy: {REF: [chain,…]}, rwy: [chain,…] }, chain = { pts:[{x,y}], cum:[…], len }
  const progress = {}; // Planschlüssel -> Index des aktuellen Rollwegs
  const loading = {};

  const proj = (d) => ({
    xy: (lat, lon) => ({ x: (lon - d.lon0) * Math.cos(d.lat0 * RAD) * 111320, y: (lat - d.lat0) * 110540 }),
    ll: (p) => [p.y / 110540 + d.lat0, p.x / (111320 * Math.cos(d.lat0 * RAD)) + d.lon0],
  });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const bearing = (a, b) => ((Math.atan2(b.x - a.x, b.y - a.y) / RAD) + 360) % 360; // 0 = Nord, im Uhrzeigersinn
  const mkChain = (pts) => { const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i])); return { pts, cum, len: cum[cum.length - 1] }; };

  // Teilstücke gleicher Bezeichnung zu Linienzügen zusammensetzen (Enden näher als 4 m)
  function merge(lines) {
    const out = lines.map((l) => l.slice());
    for (let again = true; again;) {
      again = false;
      outer: for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
        const a = out[i], b = out[j], T = 4;
        if (dist(a[a.length - 1], b[0]) < T) { out[i] = a.concat(b.slice(1)); out.splice(j, 1); again = true; break outer; }
        if (dist(a[a.length - 1], b[b.length - 1]) < T) { out[i] = a.concat(b.slice().reverse().slice(1)); out.splice(j, 1); again = true; break outer; }
        if (dist(a[0], b[b.length - 1]) < T) { out[i] = b.concat(a.slice(1)); out.splice(j, 1); again = true; break outer; }
        if (dist(a[0], b[0]) < T) { out[i] = b.slice().reverse().concat(a.slice(1)); out.splice(j, 1); again = true; break outer; }
      }
    }
    return out.map(mkChain);
  }
  function build(icao, lat0, lon0, els) {
    const d = { lat0, lon0, twy: {}, rwy: [] }, P = proj(d), raw = {}, rw = [];
    for (const el of els || []) {
      const t = el.tags || {}; if (el.type !== 'way' || !el.geometry || el.geometry.length < 2) continue;
      const pts = el.geometry.map((g) => P.xy(g.lat, g.lon));
      if (t.aeroway === 'taxiway' && t.ref) (raw[String(t.ref).toUpperCase()] = raw[String(t.ref).toUpperCase()] || []).push(pts);
      else if (t.aeroway === 'runway') rw.push({ ref: String(t.ref || ''), pts });
    }
    for (const k of Object.keys(raw)) d.twy[k] = merge(raw[k]);
    d.rwy = rw.map((r) => ({ ref: r.ref, chain: mkChain(r.pts) }));
    d.stands = {};
    for (const el of els || []) { // Standplätze (für den Rollweg ab/bis Stand)
      const t = el.tags || {}, ref = String(t.ref || t.name || '').toUpperCase(); if (!ref || (t.aeroway !== 'parking_position' && t.aeroway !== 'gate')) continue;
      const g0 = el.type === 'node' ? { lat: el.lat, lon: el.lon } : el.geometry && el.geometry[el.geometry.length - 1]; if (g0) d.stands[ref] = P.xy(g0.lat, g0.lon);
    }
    try { d.g = mkGraph(els || [], P); } catch (e) { d.g = null; }
    data[icao] = d; return d;
  }

  // ===================== Wegenetz: alle Rollwege als Kreuzungs-Netz, damit der Weg an Kreuzungen endet und Lücken überbrückt werden =====================
  function mkGraph(els, P) {
    const idx = new Map(), list = [];
    const node = (id, p) => { const k = id != null ? 'n' + id : 's' + Math.round(p.x / 2) + ',' + Math.round(p.y / 2); let i = idx.get(k); if (i === undefined) { i = list.length; idx.set(k, i); list.push({ x: p.x, y: p.y, e: [], refs: new Set() }); } return i; };
    const add = (a, b, ref, lane) => { if (a === b) return; const l = dist(list[a], list[b]); list[a].e.push({ to: b, len: l, ref, lane }); list[b].e.push({ to: a, len: l, ref, lane }); if (ref) { list[a].refs.add(ref); list[b].refs.add(ref); } };
    const ways = [];
    for (const el of els) {
      const t = el.tags || {}; if (el.type !== 'way' || !el.geometry || el.geometry.length < 2 || (t.aeroway !== 'taxiway' && t.aeroway !== 'taxilane')) continue;
      const ids = Array.isArray(el.nodes) && el.nodes.length === el.geometry.length ? el.nodes : null;
      ways.push({ ref: String(t.ref || t.name || '').toUpperCase(), lane: t.aeroway === 'taxilane', v: el.geometry.map((g, i) => ({ p: P.xy(g.lat, g.lon), id: ids ? ids[i] : null })) });
    }
    // Enden, die mitten auf einem anderen Rollweg liegen (ohne gemeinsamen Punkt): dort eine Kreuzung einfügen
    const sc = new Map(), sk = (x, y) => Math.floor(x / 25) + ',' + Math.floor(y / 25);
    ways.forEach((w, wi) => { for (let i = 1; i < w.v.length; i++) { const a = w.v[i - 1].p, b = w.v[i].p; for (let x = Math.floor(Math.min(a.x, b.x) / 25); x <= Math.floor(Math.max(a.x, b.x) / 25); x++) for (let y = Math.floor(Math.min(a.y, b.y) / 25); y <= Math.floor(Math.max(a.y, b.y) / 25); y++) { const k = x + ',' + y; (sc.get(k) || sc.set(k, []).get(k)).push([wi, i]); } } });
    const ins = new Map(); // wi -> [{i (Segment), t, p}]
    ways.forEach((w, wi) => {
      for (const end of [0, w.v.length - 1]) {
        const e = w.v[end], p = e.p; let best = null;
        const cx = Math.floor(p.x / 25), cy = Math.floor(p.y / 25); let linked = false;
        for (let x = cx - 1; x <= cx + 1 && !linked; x++) for (let y = cy - 1; y <= cy + 1 && !linked; y++) for (const [wj, i] of sc.get(x + ',' + y) || []) {
          if (wj === wi) continue; const a = ways[wj].v[i - 1], b = ways[wj].v[i];
          if (dist(a.p, p) < 1 || dist(b.p, p) < 1 || (e.id != null && (a.id === e.id || b.id === e.id))) { linked = true; best = null; break; } // schon verbunden
          const dx = b.p.x - a.p.x, dy = b.p.y - a.p.y, l2 = dx * dx + dy * dy; if (!l2) continue;
          const t = ((p.x - a.p.x) * dx + (p.y - a.p.y) * dy) / l2; if (t <= 0.03 || t >= 0.97) continue;
          const q = { x: a.p.x + t * dx, y: a.p.y + t * dy }, dd = dist(p, q); if (dd < 6 && (!best || dd < best.dd)) best = { wj, i, t, q, dd };
        }
        if (best && !linked) { e.p = best.q; e.id = null; (ins.get(best.wj) || ins.set(best.wj, []).get(best.wj)).push({ i: best.i, t: best.t, p: best.q }); }
      }
    });
    ins.forEach((arr, wj) => { arr.sort((a, b) => b.i - a.i || b.t - a.t); for (const x of arr) ways[wj].v.splice(x.i, 0, { p: x.p, id: null }); });
    for (const w of ways) { let prev = -1; w.v.forEach((q) => { const n = node(q.id, q.p); if (prev >= 0) add(prev, n, w.ref, w.lane); prev = n; }); }
    // lose Enden (Sackgassen) mit einem Knoten bis 10 m Abstand verbinden (ungenau gezeichnete Kreuzungen)
    const cell = new Map(), key = (x, y) => Math.floor(x / 20) + ',' + Math.floor(y / 20);
    list.forEach((n, i) => { const k = key(n.x, n.y); (cell.get(k) || cell.set(k, []).get(k)).push(i); });
    list.forEach((n, i) => {
      if (n.e.length !== 1) return;
      let best = -1, bd = 10; const cx = Math.floor(n.x / 20), cy = Math.floor(n.y / 20);
      for (let a = cx - 1; a <= cx + 1; a++) for (let b = cy - 1; b <= cy + 1; b++) for (const j of cell.get(a + ',' + b) || []) { if (j === i || n.e.some((e) => e.to === j)) continue; const dd = dist(n, list[j]); if (dd < bd) { bd = dd; best = j; } }
      if (best >= 0) add(i, best, '', true);
    });
    const refNodes = new Map(); list.forEach((n, i) => n.refs.forEach((r) => { (refNodes.get(r) || refNodes.set(r, []).get(r)).push(i); }));
    return { list, refNodes };
  }
  function Heap() { const a = []; return { size: () => a.length, push(c, s) { a.push([c, s]); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }, pop() { const t = a[0], l = a.pop(); if (a.length) { a[0] = l; let i = 0; for (;;) { let m = i; const x = 2 * i + 1, y = x + 1; if (x < a.length && a[x][0] < a[m][0]) m = x; if (y < a.length && a[y][0] < a[m][0]) m = y; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return t; } }; }
  const nearestNode = (g, p, max) => { let b = -1, bd = max; g.list.forEach((n, i) => { const dd = dist(n, p); if (dd < bd) { bd = dd; b = i; } }); return b; };
  const rwyDist = (chains, p) => Math.min(...chains.map((c) => nearest(c, p).d));
  const FREE_TWY = 4, FREE_LANE = 2.5;
  // Kürzester Weg, der die genannten Rollwege der Reihe nach nutzt; wo sie nicht zusammenhängen, wird die kürzeste Verbindung (Rollwege ×4, Rollgassen ×2,5 teurer) eingefügt.
  // o: { start:{x,y}|null, end:{x,y}|null, chains: Pistenlinien|null, mode:'dep'|'arr', holdRef: Rollweg für den Halt am Ende|null }
  function solve(d, toks, o) {
    const g = d.g, L = g.list, N = L.length, K = toks.length, INF = 1e12;
    const dist_ = new Float64Array(N * K).fill(INF), prev = new Int32Array(N * K).fill(-1), pr = new Array(N * K), h = Heap();
    const relax = (s, c, from, ref) => { if (c < dist_[s]) { dist_[s] = c; prev[s] = from; pr[s] = ref; h.push(c, s); } };
    const t0 = g.refNodes.get(toks[0]) || [];
    let starts = [];
    if (o.start) { const n = nearestNode(g, o.start, 250); if (n >= 0) starts = [n]; }
    if (!starts.length) {
      if (o.mode === 'arr' && o.chains) { const m = Math.min(...t0.map((i) => rwyDist(o.chains, L[i]))); starts = t0.filter((i) => rwyDist(o.chains, L[i]) <= m + 60); }
      else if (K > 1) { const t1 = g.refNodes.get(toks[1]) || []; let bd = -1, b = -1; t0.forEach((i) => { const dd = Math.min(...t1.map((j) => Math.hypot(L[i].x - L[j].x, L[i].y - L[j].y))); if (dd > bd) { bd = dd; b = i; } }); if (b >= 0) starts = [b]; }
      else if (o.chains) { let bd = -1, b = -1; t0.forEach((i) => { const dd = rwyDist(o.chains, L[i]); if (dd > bd) { bd = dd; b = i; } }); if (b >= 0) starts = [b]; }
      if (!starts.length) starts = t0;
    }
    for (const i of starts) relax(i * K, 0, -1, '');
    while (h.size()) {
      const [c, s] = h.pop(); if (c > dist_[s]) continue; if (c > 40000) break;
      const u = (s / K) | 0, k = s % K;
      if (k < K - 1 && L[u].refs.has(toks[k + 1])) relax(u * K + k + 1, c, s, 'T');
      for (const e of L[u].e) relax(e.to * K + k, c + e.len * (e.ref === toks[k] ? 1 : e.lane || !e.ref ? FREE_LANE : FREE_TWY), s, e.ref);
    }
    const lastT = toks[K - 1], lastNodes = g.refNodes.get(lastT) || [];
    let targets = [], endKind = null;
    if (o.holdRef) { targets = lastNodes.filter((i) => L[i].refs.has(o.holdRef)); if (targets.length) endKind = 'twy'; }
    if (!targets.length && o.mode === 'arr' && o.end) { const n = nearestNode(g, o.end, 250); if (n >= 0) targets = [n]; }
    if (!targets.length && o.mode !== 'arr' && o.chains) { const m = Math.min(...lastNodes.map((i) => rwyDist(o.chains, L[i]))); if (m < 120) { targets = lastNodes.filter((i) => rwyDist(o.chains, L[i]) <= m + 8); endKind = 'rwy'; } }
    let best = -1, bc = INF;
    if (targets.length) { for (const i of targets) { const s = i * K + K - 1; if (dist_[s] < bc) { bc = dist_[s]; best = s; } } }
    else { bc = -1; for (const i of lastNodes) { const s = i * K + K - 1; if (dist_[s] < INF && pr[s] === lastT && dist_[s] > bc) { bc = dist_[s]; best = s; } } }
    if (best < 0) return null;
    const seq = []; for (let s = best; s >= 0; s = prev[s]) seq.push({ i: (s / K) | 0, k: s % K, ref: pr[s] }); seq.reverse();
    // Abschnitte bilden: gleiche Bezeichnung zusammenfassen
    let legs = [], pts = [], nid = [];
    const P0 = L[seq[0].i]; pts.push({ x: P0.x, y: P0.y }); nid.push(seq[0].i);
    let lastI = seq[0].i;
    for (let j = 1; j < seq.length; j++) {
      const q = seq[j]; if (q.ref === 'T') { continue; }
      const k = seq[j - 1].k, onTok = q.ref === toks[k], ref = onTok ? toks[k] : q.ref, gap = !onTok, pk = legs[legs.length - 1];
      const a = lastI, b = q.i; lastI = b;
      if (pk && pk.ref === ref && pk.gap === gap && pk.tok === k) { pk.i1 = pts.length; } else { legs.push({ ref, tok: k, gap, i0: pts.length - 1, i1: pts.length }); }
      pts.push({ x: L[b].x, y: L[b].y }); nid.push(b);
    }
    if (pts.length < 2) return null;
    // kurze Verbindungsstücke (<20 m) und unbenannte Lücken dem vorherigen Abschnitt zuschlagen
    const lenOf = (l) => { let t = 0; for (let i = l.i0; i < l.i1; i++) t += dist(pts[i], pts[i + 1]); return t; };
    for (let n = 0; n < legs.length;) { const l = legs[n]; if (l.gap && (!l.ref || lenOf(l) < 20) && legs.length > 1) { const tgt = n > 0 ? legs[n - 1] : legs[n + 1]; if (n > 0) tgt.i1 = l.i1; else tgt.i0 = l.i0; legs.splice(n, 1); } else n++; }
    for (let n = 1; n < legs.length;) { const a = legs[n - 1], b = legs[n]; if (a.ref === b.ref && a.gap === b.gap) { a.i1 = b.i1; legs.splice(n, 1); } else n++; }
    return { pts, nid, legs, endKind, toks };
  }
  const finish = (path) => { // Linienzug mit Längen
    const ch = mkChain(path.pts); path.chain = ch; for (const l of path.legs) { l.s0 = ch.cum[l.i0]; l.s1 = ch.cum[l.i1]; } return path;
  };
  function cutPath(path, s) { // Weg bei Länge s abschneiden
    const ch = path.chain; if (s >= ch.len - 1) return;
    const keep = []; for (let i = 0; i < ch.pts.length; i++) if (ch.cum[i] < s) keep.push(i);
    const q = at(ch, s); path.pts = keep.map((i) => path.pts[i]).concat([q]); path.nid = keep.map((i) => path.nid[i]).concat([-1]);
    path.legs = path.legs.filter((l) => l.s0 < s - 0.5); path.legs[path.legs.length - 1].i1 = path.pts.length - 1; path.legs.forEach((l) => { l.i1 = Math.min(l.i1, path.pts.length - 1); }); finish(path);
  }
  // Rollwegbezeichnungen aus der Eingabe: „B A (N) 26R“ → Weg B, A; Halt vor Rollweg N (Klammer) nach A; Piste wird ignoriert
  function parse(str) {
    const s = String(str || '').toUpperCase().replace(/\(([^)]*)\)/g, (m, x) => ' (' + x.trim().replace(/\s+/g, '') + ') ');
    const raw = s.split(/[\s,;>→]+|\s-\s|-(?=\s|$)/).map((t) => t.trim()).filter(Boolean), route = [], holds = [];
    raw.forEach((t, i) => {
      if (t[0] === '(') {
        const n = t.replace(/[()]/g, ''); if (!n || RWY_RE.test(n)) return;
        const more = raw.slice(i + 1).some((x) => x[0] !== '(' && !RWY_RE.test(x));
        if (more && route.length) { route.push(n); holds.push({ after: route.length - 2, ref: n, enter: true }); } // Klammer mitten in der Route: Rollweg wird befahren, roter Strich davor
        else holds.push({ after: route.length - 1, ref: n });                                                    // Klammer am Ende: nur Halt davor
      } else if (!RWY_RE.test(t)) route.push(t);
    });
    return { route, holds };
  }
  const solved = {};
  // Weg für einen Plan berechnen (zwischengespeichert). pos nur, wenn kein Stand bekannt ist
  function pathFor(plan, pos) {
    const d = data[plan.icao]; if (!d || !d.g || !plan.route.length) return null;
    const g = d.g, stand = d.stands && d.stands[String(plan.stand || '').toUpperCase()] || null, P = proj(d);
    const useLive = !stand && pos && plan.mode !== 'arr';
    const ck = plan.key + '|' + (plan.stand || '') + '|' + (plan.rwy || '') + (plan.lineup ? '|lu' : '') + (useLive ? '|live' : '');
    if (solved[ck] !== undefined) return solved[ck];
    const missing = plan.route.filter((t) => !g.refNodes.has(t)), toks = plan.route.filter((t) => g.refNodes.has(t));
    if (!toks.length) return (solved[ck] = { missing });
    const rwyRef = String(plan.rwy || '').toUpperCase(), rws = d.rwy.filter((r) => !rwyRef || r.ref.toUpperCase().split('/').includes(rwyRef)), chains = rws.length ? rws.map((r) => r.chain) : null;
    const lastHold = (plan.holds || []).filter((h2) => h2.after === plan.route.length - 1 && g.refNodes.has(h2.ref)).pop();
    const start = stand && plan.mode !== 'arr' ? stand : useLive ? P.xy(pos.lat, pos.lon) : null;
    const path = solve(d, toks, { start, end: stand && plan.mode === 'arr' ? stand : null, chains, mode: plan.mode, holdRef: lastHold ? lastHold.ref : null });
    if (!path) return (solved[ck] = { missing });
    // Weg beginnt am Stand (bzw. endet dort bei Ankunft): Verbindungsstück vom Stand zum Rollwegnetz dem ersten/letzten Abschnitt zuschlagen
    if (start && stand && plan.mode !== 'arr') { const dd = dist(start, path.pts[0]); if (dd > 3 && dd < 260) { path.pts.unshift({ x: start.x, y: start.y }); path.nid.unshift(-1); path.legs.forEach((l) => { l.i0++; l.i1++; }); path.legs[0].i0 = 0; } }
    if (stand && plan.mode === 'arr') { const e = path.pts[path.pts.length - 1], dd = dist(stand, e); if (dd > 3 && dd < 260) { path.pts.push({ x: stand.x, y: stand.y }); path.nid.push(-1); path.legs[path.legs.length - 1].i1 = path.pts.length - 1; } }
    finish(path); path.missing = missing; path.rwyChains = chains;
    // Halt vor der Piste: ~55 m vor der Pistenmitte stoppen
    path.holds = [];
    // Mit „Line up“ (plan.lineup) entfällt der Halt: der Weg läuft auf die Piste
    if (path.endKind === 'rwy' && chains && !plan.lineup) {
      const ch = path.chain; let cutS = null;
      for (let s = Math.max(0, ch.len - 400); s <= ch.len; s += 4) { const q = at(ch, s); if (rwyDist(chains, q) <= 55 && s > 25) { cutS = s; break; } }
      if (cutS !== null) {
        cutPath(path, cutS);
        const c2 = path.chain, sH = c2.len, q = at(c2, sH), b = bearing(at(c2, Math.max(0, sH - 6)), at(c2, sH)) * RAD, nx = Math.cos(b) * 14, ny = -Math.sin(b) * 14;
        path.holds.push({ s: sH, ref: rwyRef || 'Piste', a: { x: q.x - nx, y: q.y - ny }, b: { x: q.x + nx, y: q.y + ny }, end: true, rwy: true });
      }
    }
    // Halt vor einem Rollweg (Klammer): roter Strich ~22 m vor der Kreuzung
    for (const hs of plan.holds || []) {
      const ti = toks.indexOf(plan.route[hs.after]); if (ti < 0 || !g.refNodes.has(hs.ref)) continue;
      const ch = path.chain; let sJ = null;
      if (hs.enter) { // Rollweg wird befahren: Strich ~22 m vor dem Einbiegen
        const tn = toks.indexOf(plan.route[hs.after + 1]), ln = tn >= 0 ? path.legs.find((x) => x.tok === tn && !x.gap) : null;
        if (ln && ln.s0 > 3) { const sH = Math.max(0, ln.s0 - 22), q = at(ch, sH), b = bearing(at(ch, Math.max(0, sH - 6)), at(ch, sH + 6)) * RAD, nx = Math.cos(b) * 14, ny = -Math.sin(b) * 14; path.holds.push({ s: sH, ref: hs.ref, a: { x: q.x - nx, y: q.y - ny }, b: { x: q.x + nx, y: q.y + ny }, end: false }); }
        continue;
      }
      for (let i = 0; i < path.nid.length; i++) { const l = path.legs.find((x) => i >= x.i0 && i <= x.i1); if (!l || l.tok !== ti || l.gap) continue; const nd = path.nid[i] >= 0 ? g.list[path.nid[i]] : null; if (nd && nd.refs.has(hs.ref) && ch.cum[i] > 3) { sJ = ch.cum[i]; break; } }
      if (sJ === null) continue;
      const sH = Math.max(0, sJ - 22), q = at(ch, sH), b = bearing(at(ch, Math.max(0, sH - 6)), at(ch, sH + 6)) * RAD, nx = Math.cos(b) * 14, ny = -Math.sin(b) * 14;
      path.holds.push({ s: sH, ref: hs.ref, a: { x: q.x - nx, y: q.y - ny }, b: { x: q.x + nx, y: q.y + ny }, end: false });
    }
    if (lastHold && path.endKind === 'twy') { const hd = path.holds.find((x) => x.ref === lastHold.ref); if (hd) { cutPath(path, hd.s); hd.end = true; } }
    path.holdKind = lastHold && path.endKind === 'twy' ? 'twy' : path.endKind === 'rwy' && !plan.lineup ? 'rwy' : null; path.holdRef = lastHold ? lastHold.ref : null;
    return (solved[ck] = path);
  }
  // Anzeige: Abschnitte (blau; eingefügte Verbindungen gestrichelt), rote Halte-Striche, Kette der Rollwege für die Leiste
  function preview(plan, pos) {
    const d = data[plan.icao]; if (!d || !d.g) return null;
    const path = pathFor(plan, pos); if (!path || !path.legs) return path && path.missing ? { missing: path.missing } : null;
    const P = proj(d), ll = (arr) => arr.map(P.ll);
    const bar = [];
    path.legs.forEach((l) => { bar.push({ ref: l.ref, gap: l.gap }); path.holds.filter((h2) => h2.s >= l.s0 - 0.5 && h2.s <= l.s1 + 0.5).forEach((h2) => bar.push({ ref: h2.ref, hold: true })); });
    return { legs: path.legs.map((l) => ({ ref: l.ref, gap: l.gap, pts: ll(path.pts.slice(l.i0, l.i1 + 1)) })), holds: path.holds.map((h2) => ({ ref: h2.ref, end: h2.end, line: ll([h2.a, h2.b]) })), bar, missing: path.missing || [], holdKind: path.holdKind };
  }
  const turnAt = (ch, s) => { const bin = bearing(at(ch, s - 18), at(ch, s)), bout = bearing(at(ch, s), at(ch, s + 25)), diff = ((bout - bin + 540) % 360) - 180; return { turn: Math.abs(diff) < 22 ? 'straight' : diff > 0 ? 'right' : 'left', sharp: Math.abs(diff) > 110, angle: Math.round(diff) }; };
  // Position auf dem berechneten Weg: aktueller Abschnitt, nächste Kreuzung, Abbiegerichtung
  function navigate(plan, pos, path) {
    const d = data[plan.icao], P = proj(d), p = P.xy(pos.lat, pos.lon), ch = path.chain, ll = (arr) => arr.map(P.ll), legs = path.legs;
    let prog = progress[plan.key];
    const win = (lo, hi) => { let b = { d: Infinity, s: 0 }; for (let i = 1; i < ch.pts.length; i++) { if (ch.cum[i] < lo || ch.cum[i - 1] > hi) continue; const a = ch.pts[i - 1], c = ch.pts[i], dx = c.x - a.x, dy = c.y - a.y, l2 = dx * dx + dy * dy; let t = l2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t)); const dd = Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)); if (dd < b.d) b = { d: dd, s: ch.cum[i - 1] + t * Math.sqrt(l2) }; } return b; };
    let best = prog === undefined ? win(-1, ch.len + 1) : win(prog - 60, prog + 250);
    if (best.d > 45 && prog !== undefined) { const g2 = win(-1, ch.len + 1); if (g2.d < 30 && g2.s > prog - 60) best = g2; }
    const onRoute = best.d < 45;
    const out = { toks: legs.map((l) => l.ref), onRoute, hold: !!path.holdKind, holdKind: path.holdKind, holdRef: path.holdRef, holds: ll([]), path: null };
    out.holdLines = path.holds.map((h2) => ({ ref: h2.ref, end: h2.end, line: ll([h2.a, h2.b]) }));
    if (!onRoute && prog === undefined) { // noch nicht auf dem Weg: Weg zum Anfang zeigen
      const q = best.s, a0 = at(ch, q);
      out.cur = -1; out.ref = null; out.next = legs[0].ref; out.toFirst = legs[0].ref; out.distToJ = best.d; out.legCur = ll([p, a0]); out.legNext = ll(path.pts.slice(legs[0].i0, legs[0].i1 + 1)); return out;
    }
    if (onRoute && (prog === undefined || best.s > prog - 30)) progress[plan.key] = best.s;
    const s = onRoute ? best.s : (prog || 0);
    let cur = legs.findIndex((l) => s <= l.s1 + 0.5); if (cur < 0) cur = legs.length - 1;
    const leg = legs[cur], nx = legs[cur + 1] || null;
    out.cur = cur; out.ref = leg.ref; out.next = nx ? nx.ref : null; out.atEnd = !nx;
    out.distToJ = Math.max(0, leg.s1 - s); out.J = P.ll(at(ch, leg.s1));
    out.legCur = ll(slice(ch, s, leg.s1));
    if (nx) { Object.assign(out, turnAt(ch, leg.s1)); out.legNext = ll(slice(ch, leg.s1, nx.s1)); }
    const ha = path.holds.filter((h2) => h2.s > s - 2).sort((a, b) => a.s - b.s)[0];
    if (ha) { out.holdAhead = { dist: ha.s - s, ref: ha.ref, end: ha.end, rwy: !!ha.rwy }; }
    return out;
  }
  async function ensure(icao, lat, lon) {
    if (data[icao]) return data[icao];
    if (loading[icao]) return loading[icao];
    if (!isFinite(lat) || !isFinite(lon)) return null;
    const bb = [lat - 0.035, lon - 0.055, lat + 0.035, lon + 0.055].map((x) => x.toFixed(3)).join(',');
    loading[icao] = fetch('/api/ground?bbox=' + bb).then((r) => r.json()).then((j) => build(icao, lat, lon, j.elements)).catch(() => null).finally(() => { delete loading[icao]; });
    return loading[icao];
  }

  // nächster Punkt einer Linie: { d, s (Länge entlang), p }
  function nearest(ch, p) {
    let best = { d: Infinity, s: 0, p: null };
    for (let i = 1; i < ch.pts.length; i++) {
      const a = ch.pts[i - 1], b = ch.pts[i], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
      let t = l2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
      const q = { x: a.x + t * dx, y: a.y + t * dy }, dd = dist(p, q);
      if (dd < best.d) best = { d: dd, s: ch.cum[i - 1] + t * Math.sqrt(l2), p: q };
    }
    return best;
  }
  function at(ch, s) { // Punkt bei Länge s
    s = Math.max(0, Math.min(ch.len, s));
    for (let i = 1; i < ch.pts.length; i++) if (ch.cum[i] >= s) { const a = ch.pts[i - 1], b = ch.pts[i], l = ch.cum[i] - ch.cum[i - 1] || 1, t = (s - ch.cum[i - 1]) / l; return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }; }
    return ch.pts[ch.pts.length - 1];
  }
  function slice(ch, s1, s2) { // Teilstück zwischen zwei Längen (auch rückwärts)
    const rev = s2 < s1, a = Math.min(s1, s2), b = Math.max(s1, s2), out = [at(ch, a)];
    for (let i = 0; i < ch.pts.length; i++) if (ch.cum[i] > a && ch.cum[i] < b) out.push(ch.pts[i]);
    out.push(at(ch, b)); return rev ? out.reverse() : out;
  }
  // Kreuzung zweier Rollwege: engste Stelle zwischen allen Linienzügen
  function junction(A, B) {
    let best = null;
    for (const a of A) for (const b of B) {
      for (const [x, y, flip] of [[a, b, false], [b, a, true]]) for (const v of x.pts) { const n = nearest(y, v); if (!best || n.d < best.d) best = { d: n.d, a: flip ? y : x, b: flip ? x : y, pa: flip ? n.p : v, pb: flip ? v : n.p }; }
    }
    if (!best || best.d > 30) return null;
    const pa = nearest(best.a, best.pa), pb = nearest(best.b, best.pb);
    return { a: best.a, b: best.b, sa: pa.s, sb: pb.s, p: { x: (pa.p.x + pb.p.x) / 2, y: (pa.p.y + pb.p.y) / 2 } };
  }
  function pathAt(ch, s, dir, len) { return at(ch, s + dir * len); }

  // Plan: { key, icao, route:['N5','N','A'], rwy:'26R' }, pos: { lat, lon, hdg, gs }
  function compute(plan, pos) {
    const d = data[plan.icao]; if (!d || !plan.route.length) return null;
    if (d.g) { try { const path = pathFor(plan, pos); if (path && path.legs) return Object.assign(navigate(plan, pos, path), path.missing && path.missing.length ? { missingSome: path.missing } : {}); if (path && path.missing && path.missing.length === plan.route.length) return { missing: path.missing }; } catch (e) { /* alter Weg */ } }
    return computeOld(plan, pos);
  }
  function computeOld(plan, pos) {
    const d = data[plan.icao]; if (!d || !plan.route.length) return null;
    const P = proj(d), p = P.xy(pos.lat, pos.lon), toks = plan.route.filter((t) => d.twy[t]);
    if (!toks.length) return { missing: plan.route.filter((t) => !d.twy[t]) };
    const dists = toks.map((t) => Math.min(...d.twy[t].map((c) => nearest(c, p).d)));
    let prog = progress[plan.key]; if (prog === undefined) prog = -1;
    let cur = prog, bestD = 45;
    for (let k = Math.max(0, prog); k <= Math.min(toks.length - 1, prog + 1); k++) if (dists[k] < bestD) { bestD = dists[k]; cur = k; }
    if (cur < prog) cur = prog;
    progress[plan.key] = cur;
    // Kreuzungen
    const J = []; for (let k = 0; k < toks.length - 1; k++) J.push(junction(d.twy[toks[k]], d.twy[toks[k + 1]]));
    const last = toks[toks.length - 1];
    let hold = null; // Haltepunkt: engste Stelle des letzten Rollwegs zur Piste
    const rwyRef = String(plan.rwy || '').toUpperCase();
    const rws = d.rwy.filter((r) => !rwyRef || r.ref.toUpperCase().split('/').includes(rwyRef));
    if (rws.length) { const j = junction(d.twy[last], rws.map((r) => r.chain)); if (j) hold = j; }
    const out = { toks, cur, ref: cur >= 0 ? toks[cur] : null, next: toks[cur + 1] || null, onRoute: cur >= 0 && dists[cur] < 45, hold: !!hold };
    // aktueller Abschnitt: von der Position bis zur nächsten Kreuzung
    const nxtJ = cur >= 0 ? (J[cur] || (cur === toks.length - 1 ? hold : null)) : null;
    const ll = (arr) => arr.map(P.ll);
    if (cur < 0) { // noch nicht auf dem Rollweg: Weg zum ersten Rollweg zeigen
      const c0 = d.twy[toks[0]].map((c) => ({ c, n: nearest(c, p) })).sort((a, b) => a.n.d - b.n.d)[0];
      const j0 = J[0];
      out.legCur = ll([p, c0.n.p]); out.legNext = j0 && j0.a === c0.c ? ll(slice(c0.c, c0.n.s, j0.sa)) : ll([c0.n.p]);
      out.distToJ = c0.n.d; out.toFirst = toks[0];
      return out;
    }
    const chainNow = d.twy[toks[cur]].map((c) => ({ c, n: nearest(c, p) })).sort((a, b) => a.n.d - b.n.d)[0];
    if (nxtJ) {
      const sameChain = nxtJ.a === chainNow.c;
      const sJ = nxtJ.sa, sP = chainNow.n.s;
      // Fahrtrichtung entlang des Rollwegs: aus dem Kurs, sonst aus der Lage der Kreuzung
      let dirIn = sJ >= sP ? 1 : -1;
      if (sameChain && pos.hdg !== undefined && Number.isFinite(pos.hdg) && (pos.gs || 0) > 0.5) {
        const fw = bearing(at(chainNow.c, sP - 2), at(chainNow.c, sP + 2)), dd = Math.cos((pos.hdg - fw) * RAD);
        if (Math.abs(dd) > 0.3) dirIn = dd >= 0 ? 1 : -1;
      }
      out.distToJ = sameChain ? Math.max(0, (sJ - sP) * dirIn) : dist(p, nxtJ.p);
      out.legCur = sameChain ? ll(slice(chainNow.c, sP, sJ)) : ll([p, nxtJ.p]);
      out.J = P.ll(nxtJ.p);
      // Abbiegerichtung
      const bin = bearing(pathAt(nxtJ.a, sJ, -dirIn, 18), nxtJ.p);
      let dirOut = 1;
      const after = cur < toks.length - 2 ? J[cur + 1] : (hold || null);
      if (after && after.a === nxtJ.b) dirOut = after.sa >= nxtJ.sb ? 1 : -1;
      else if (after && after.b === nxtJ.b) dirOut = after.sb >= nxtJ.sb ? 1 : -1;
      else dirOut = nxtJ.sb < nxtJ.b.len / 2 ? 1 : -1;
      const bout = bearing(nxtJ.p, pathAt(nxtJ.b, nxtJ.sb, dirOut, 25));
      const diff = ((bout - bin + 540) % 360) - 180;
      out.turn = Math.abs(diff) < 22 ? 'straight' : diff > 0 ? 'right' : 'left'; out.sharp = Math.abs(diff) > 110; out.angle = Math.round(diff);
      // folgender Abschnitt
      if (cur < toks.length - 1) {
        const nb = nxtJ.b, sFrom = nxtJ.sb, sTo = after && (after.a === nb ? after.sa : after.b === nb ? after.sb : null);
        out.legNext = ll(sTo === null || sTo === undefined ? slice(nb, sFrom, sFrom + dirOut * Math.min(80, dirOut > 0 ? nb.len - sFrom : sFrom)) : slice(nb, sFrom, sTo));
      }
    } else { out.distToJ = null; out.legCur = ll([p]); }
    out.atEnd = cur === toks.length - 1;
    return out;
  }
  // Rollroute des aktuellen Abschnitts: vor dem Flug Abflug-Plan, nach dem Flug Ankunfts-Plan (aus den Eingaben in der Karte)
  function activePlan() {
    const o = app.ofp || {}, flown = store.get('taxiFlown', false), mode = flown ? 'arr' : 'dep', a = flown ? o.destination : o.origin;
    if (!a || !a.icao_code) return null;
    const e = (store.get('taxi', {}) || {})[a.icao_code + ':' + mode]; if (!e || !e.route) return null;
    return planFrom(a.icao_code, mode, e, +a.pos_lat, +a.pos_long);
  }
  function planFrom(icao, mode, e, lat, lon) {
    const { route, holds } = parse(e.route);
    return { key: icao + ':' + mode + ':' + String(e.route || '').toUpperCase().replace(/\s+/g, '.') + (e.lineup ? ':lu' : ''), icao, mode, route, holds, rwy: e.rwy || '', stand: e.stand || '', lineup: !!e.lineup, lat, lon };
  }
  const reset = (key) => { if (key) { delete progress[key]; for (const k of Object.keys(solved)) if (k.startsWith(key)) delete solved[k]; } else { for (const k of Object.keys(progress)) delete progress[k]; for (const k of Object.keys(solved)) delete solved[k]; } };
  // nächster Standplatz (OSM) zur Flugzeugposition – für die automatische Parkposition im ATC-Tab
  function nearestStand(icao, lat, lon, maxM) {
    const d = data[icao]; if (!d || !d.stands) return null;
    const p = proj(d).xy(lat, lon); let best = null, bd = maxM || 60;
    for (const k of Object.keys(d.stands)) { const q = d.stands[k], dd = Math.hypot(q.x - p.x, q.y - p.y); if (dd < bd) { bd = dd; best = k; } }
    return best;
  }
  return { ensure, compute, reset, activePlan, planFrom, parse, preview, data, build, nearestStand };
})();
