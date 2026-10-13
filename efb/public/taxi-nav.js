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
    data[icao] = d; return d;
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
    const route = String(e.route).toUpperCase().split(/[\s,;>→]+|\s-\s|-(?=\s|$)/).map((t) => t.trim()).filter((t) => t && !RWY_RE.test(t));
    return { key: a.icao_code + ':' + mode + ':' + route.join('.'), icao: a.icao_code, mode, route, rwy: e.rwy || '', stand: e.stand || '', lat: +a.pos_lat, lon: +a.pos_long };
  }
  const reset = (key) => { if (key) delete progress[key]; else for (const k of Object.keys(progress)) delete progress[k]; };
  return { ensure, compute, reset, activePlan, data, build };
})();
