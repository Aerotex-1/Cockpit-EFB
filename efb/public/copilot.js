// Sprach-Copilot für die Checklisten: spricht über die Kopfhörer des PCs, hört per Mikrofon zu
// und prüft Antworten (Speeds, QNH, Fuel) gegen die Berechnung bzw. den Sim.
// Alles läuft im Browser (Sprachausgabe + Spracherkennung des Browsers). Die Spracherkennung
// von Chrome/Edge ist ein Cloud-Dienst – siehe PRIVACY.md. Ohne Mikrofon geht es per Texteingabe.
(function () {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const TTS = window.speechSynthesis;
  const pref = Object.assign({ lang: 'de', rate: 1.05, mic: true, autostart: false, voice: {} }, store.get('copilot', {}));
  const persist = () => { store.set('copilot', pref); fetch('/api/copilot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pref) }).catch(() => {}); };
  const HOST = /[?&]host=1\b/.test(location.search); // PC-App: dieses Fenster spricht und hört zu
  const stt = { available: false };
  let hostActive = false; // läuft irgendwo ein Copilot-Fenster am PC?
  const remote = () => !HOST && hostActive;
  const post = (u, b) => (window.efbPost ? window.efbPost(u, b) : Promise.resolve());
  const S = { on: false, mode: 'idle', list: -1, item: -1, listening: false, speaking: false, log: [], askT: 0 };
  let rec = null, wantRec = false, recTimer = 0, lastPhase = null;
  const asked = new Set();
  const lat = { flown: false, landed: false, since: 0 };

  // ---------- Texte ----------
  const TX = {
    de: {
      on: 'Copilot aktiv.', off: 'Copilot aus.',
      due: (n) => `Ja, die {{${n}}} Checkliste ist jetzt dran. Soll ich sie mit dir durchgehen?`,
      notDue: (n, why) => `Die {{${n}}} Checkliste ist eigentlich noch nicht dran. ${why} Willst du sie trotzdem machen?`,
      why: (now, want) => `Wir sind ${now}, die Liste gehört ${want}.`,
      before: (p) => `Davor fehlt noch die {{${p}}} Checkliste.`,
      done: (n) => `Die {{${n}}} Checkliste ist schon komplett.`,
      go: 'Okay, los.', no: 'Okay, dann nicht.', stop: 'Okay, abgebrochen.', skip: 'Übersprungen.',
      complete: (n) => `{{${n}}} Checkliste komplett.`,
      next: (n) => `Als Nächstes ist die {{${n}}} Checkliste dran. Soll ich weitermachen?`,
      remind: (ph, n) => `Wir sind jetzt ${ph}. Die {{${n}}} Checkliste wäre dran. Soll ich sie mit dir machen?`,
      yn: 'Das habe ich nicht verstanden. Ja oder nein?',
      checked: 'Checked.', open: 'Okay, der Punkt bleibt offen.',
      needSpeeds: 'Ich brauche V1, VR und V2.',
      spd: (a, b) => `Die Speeds stimmen nicht. Ich habe ${a}, du sagst ${b}.`,
      qnh: (a, b) => `QNH stimmt nicht. Laut Sim ${a}, du sagst ${b}.`,
      fuel: (a, b) => `Fuel stimmt nicht. Ich sehe ${a} Kilo, du sagst ${b}.`,
      conf: (a, b) => `Klappen stimmen nicht. Berechnet ist ${a}, du sagst ${b}.`,
      noPerf: 'Ich habe keine Performance-Berechnung und nehme die Werte unbesehen.',
      noMic: 'Kein Mikrofon verfügbar – bitte per Texteingabe antworten.',
      ph: { pre: 'am Gate vor dem Start', out: 'auf dem Rollweg zur Piste', air: 'im Flug', desc: 'im Sinkflug', final: 'im Endanflug', in: 'auf dem Rollweg zum Gate', post: 'am Gate nach der Landung' },
      wantPh: { pre: 'an das Gate vor dem Start', out: 'auf den Rollweg zur Piste', air: 'in den Flug', desc: 'in den Sinkflug', final: 'in den Endanflug', in: 'auf den Rollweg zum Gate', post: 'ans Gate nach der Landung' },
    },
    en: {
      on: 'Copilot active.', off: 'Copilot off.',
      due: (n) => `Yes, the ${n} checklist is due now. Shall I run it with you?`,
      notDue: (n, why) => `The ${n} checklist is not due yet. ${why} Do you want to run it anyway?`,
      why: (now, want) => `We are ${now}, this list belongs ${want}.`,
      before: (p) => `The ${p} checklist is still missing before it.`,
      done: (n) => `The ${n} checklist is already complete.`,
      go: 'Okay, here we go.', no: 'Okay, not now.', stop: 'Okay, cancelled.', skip: 'Skipped.',
      complete: (n) => `${n} checklist complete.`,
      next: (n) => `Next up is the ${n} checklist. Shall I continue?`,
      remind: (ph, n) => `We are ${ph}. The ${n} checklist is due. Shall I run it with you?`,
      yn: "I didn't catch that. Yes or no?",
      checked: 'Checked.', open: 'Okay, the item stays open.',
      needSpeeds: 'I need V1, VR and V2.',
      spd: (a, b) => `Speeds do not match. I have ${a}, you said ${b}.`,
      qnh: (a, b) => `QNH does not match. The sim says ${a}, you said ${b}.`,
      fuel: (a, b) => `Fuel does not match. I see ${a} kilos, you said ${b}.`,
      conf: (a, b) => `Flaps do not match. Calculated is ${a}, you said ${b}.`,
      noPerf: 'I have no performance calculation and take the values as given.',
      noMic: 'No microphone available – please answer by typing.',
      ph: { pre: 'at the gate before departure', out: 'taxiing out', air: 'airborne', desc: 'in the descent', final: 'on final', in: 'taxiing in', post: 'at the gate after landing' },
      wantPh: { pre: 'at the gate before departure', out: 'to taxiing out', air: 'to the flight', desc: 'to the descent', final: 'to final', in: 'to taxiing in', post: 'to the gate after landing' },
    },
  };
  const T = () => TX[pref.lang] || TX.de;

  // ---------- Phasen ----------
  // welche Liste gehört in welche Flugphase (Airbus- und Boeing-Namen)
  const LISTPH = [
    [/cockpit prep|preflight/i, ['pre']], [/before start/i, ['pre']], [/after start/i, ['pre', 'out']],
    [/before taxi/i, ['out']], [/^taxi/i, ['out']], [/line-?up|before takeoff/i, ['out']],
    [/after takeoff/i, ['air']], [/descent/i, ['desc', 'final']], [/approach/i, ['desc', 'final']],
    [/^landing/i, ['final']], [/after landing/i, ['in']], [/parking|shutdown/i, ['post']], [/secur/i, ['post']],
  ];
  const listPhases = (name) => { for (const [re, ph] of LISTPH) if (re.test(name)) return ph; return null; };
  function phase() {
    const s = app.sim || {};
    if (!s.connected && !s.demo) return null;
    const now = Date.now();
    if (!s.onGround) { lat.since = lat.since || now; if (now - lat.since > 8000) lat.flown = true; } else lat.since = 0;
    if (lat.flown && s.onGround && (s.gs || 0) < 80) lat.landed = true;
    const gs = s.gs || 0;
    if (lat.landed) return gs < 3 && s.parkingBrake !== false ? 'post' : 'in';
    if (!s.onGround) {
      if ((s.alt || 0) < 3500 && (s.vs || 0) < -200 && lat.flown) return 'final';
      if ((s.vs || 0) < -300 && (s.alt || 0) < 15000 && lat.flown) return 'desc';
      return 'air';
    }
    return gs < 3 ? 'pre' : 'out';
  }
  const lists = () => app.checklists[checklistKey()] || [];
  const progOf = () => store.get('cl.' + checklistKey(), {});
  const isDone = (i) => { const l = lists()[i]; const t = progOf()[i] || []; return !!l && l.items.every((_, k) => t[k]); };

  // ---------- Sprachausgabe ----------
  let voices = [];
  function loadVoices() { voices = TTS ? TTS.getVoices() : []; }
  if (TTS) { loadVoices(); TTS.onvoiceschanged = () => { loadVoices(); if (window._cpFillVoices) window._cpFillVoices(); }; }
  function voiceFor(lang) {
    const pre = lang === 'de' ? 'de' : 'en';
    const c = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith(pre));
    const want = pref.voice && pref.voice[lang === 'de' ? 'de' : 'en'];
    if (want) { const w = voices.find((v) => v.name === want); if (w) return w; }
    return c.find((v) => /natural|online/i.test(v.name)) || c[0] || null;
  }
  // ---- eingebaute Piper-Stimmen (nur wenn die Windows-App sie mitliefert)
  const piper = { available: false, voices: [] };
  let curAudio = null;
  const loadPiper = () => fetch('/api/tts/voices').then((r) => r.json()).then((o) => { piper.available = !!o.available; piper.voices = o.voices || []; if (window._cpFillVoices) window._cpFillVoices(); }).catch(() => {});
  function piperFor(lang) {
    if (!piper.available) return null;
    const k = lang === 'de' ? 'de' : 'en', want = pref.voice && pref.voice[k];
    if (want && want.startsWith('piper:')) { const id = want.slice(6); return piper.voices.some((v) => v.id === id) ? id : null; }
    if (want) return null; // bewusst eine Systemstimme gewählt
    const v = piper.voices.find((x) => x.lang === k); return v ? v.id : null;
  }
  const piperUrl = (id, text) => `/api/tts?voice=${encodeURIComponent(id)}&rate=${pref.rate}&text=${encodeURIComponent(text)}`;
  function playPiper(text, id) {
    return new Promise((res, rej) => {
      const a = new Audio(piperUrl(id, text));
      curAudio = a;
      const done = (ok) => { if (curAudio === a) curAudio = null; ok ? res() : rej(new Error('audio')); };
      a.onended = () => done(true); a.onerror = () => done(false);
      a.play().catch(() => done(false));
      setTimeout(() => done(true), 30000);
    });
  }
  // Englische Fachwörter ({{Before Start}}) werden mit englischer Stimme gesprochen, der Rest mit der Sprache des Copiloten
  // Automatische Erkennung typischer englischer Begriffe in deutschen Sätzen (deutsche Piper-Stimmen sprechen sie sonst mit deutschem Akzent)
  const EN_TERMS = ['Cockpit Preparation', 'Cockpit Prep', 'Before Start', 'After Start', 'Before Taxi', 'Before Takeoff', 'After Takeoff', 'After Landing', 'Line-?up', 'Approach', 'Descent', 'Landing', 'Parking', 'Securing the Aircraft', 'Shutdown', 'Pushback', 'Takeoff', 'Taxi', 'Checked', 'Copilot', 'Co-?pilot', 'Flaps', 'Fuel', 'QNH', 'Speeds', 'Performance', 'Gate', 'Autopilot', 'Baro Ref', 'Transponder', 'V1', 'VR', 'V2', 'ILS', 'APU', 'ECAM', 'FMGC', 'MCDU', 'FCU'];
  const EN_RE = new RegExp('(?<![\\w{])(' + EN_TERMS.sort((a, b) => b.length - a.length).join('|') + ')(?![\\w}])', 'gi');
  function autoMark(text) {
    return String(text).split(/(\{\{.*?\}\})/).map((seg) => (seg.startsWith('{{') ? seg : seg.replace(EN_RE, '{{$1}}'))).join('');
  }
  function parts(text, lang) {
    if (lang === 'de') text = autoMark(text);
    const out = [];
    String(text).split(/\{\{(.*?)\}\}/).forEach((t, i) => { t = t.trim(); if (t) out.push({ text: t, lang: i % 2 ? 'en' : lang }); });
    return out;
  }
  async function say(text, lang) {
    lang = lang || pref.lang;
    log('Copilot', String(text).replace(/\{\{|\}\}/g, ''));
    if (!S.on) return;
    const ps = parts(text, lang); if (!ps.length) return;
    S.speaking = true; ui(); pauseRec();
    ps.slice(1).forEach((p) => { const id = piperFor(p.lang); if (id) fetch(piperUrl(id, p.text)).catch(() => {}); }); // schon vorrechnen lassen
    try {
      for (const p of ps) {
        if (!S.on) break;
        const id = piperFor(p.lang);
        if (id) { try { await playPiper(p.text, id); } catch (e) { await speakRaw(p.text, p.lang); } } else await speakRaw(p.text, p.lang);
      }
    } finally { S.speaking = false; ui(); resumeRec(); }
  }
  function speakRaw(text, lang) {
    if (!TTS) return Promise.resolve();
    return new Promise((res) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang === 'de' ? 'de-DE' : 'en-US';
      const v = voiceFor(lang); if (v) u.voice = v;
      u.rate = pref.rate;
      let fin = false;
      const end = () => { if (fin) return; fin = true; res(); };
      u.onend = end; u.onerror = end;
      TTS.speak(u);
      setTimeout(end, 15000 + text.length * 120);
    });
  }
  async function sayAll(parts) { for (const [t, l] of parts) await say(t, l); }

  // ---------- Spracherkennung ----------
  const useW = () => stt.available && window.WhisperMic && window.isSecureContext;
  const LISTNAMES = () => lists().map((l) => l.name).join(', ');
  const sttOpts = () => ({
    lang: S.mode === 'run' && checklistKey().startsWith('airbus') ? 'en' : 'auto',
    prompt: (LISTNAMES() + '. Checked, V1, VR, V2, QNH, flaps, fuel, standard, let\'s do the checklist. Ja, nein, weiter, stopp.').slice(0, 380),
  });
  function startRec() {
    if (!pref.mic) return;
    if (useW()) {
      wantRec = true;
      window.WhisperMic.start((t) => handle(t, true), sttOpts)
        .then(() => { S.listening = true; ui(); })
        .catch((e) => { wantRec = false; log('System', (pref.lang === 'de' ? 'Mikrofon nicht verfügbar: ' : 'Microphone not available: ') + (e && e.message || e)); });
      return;
    }
    if (!SR) { log('System', stt.checked && !stt.available && HOST ? (pref.lang === 'de' ? 'Spracherkennung ist noch nicht installiert (App → Copilot → Spracherkennung installieren). Bis dahin: Antworten tippen.' : 'Speech recognition is not installed yet (App → Copilot). Until then, type your answers.') : T().noMic); return; }
    if (!window.isSecureContext) { log('System', pref.lang === 'de' ? 'Mikrofon geht nur im PC-Browser über http://localhost:8090 (nicht über die IP-Adresse).' : 'The microphone only works in the PC browser via http://localhost:8090 (not via the IP address).'); return; }
    wantRec = true;
    if (rec) return;
    rec = new SR();
    rec.lang = pref.lang === 'de' ? 'de-DE' : 'en-US';
    rec.continuous = false; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onstart = () => { S.listening = true; ui(); };
    rec.onresult = (e) => { const r = e.results[e.results.length - 1]; if (r && r.isFinal) handle(r[0].transcript, true); };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { wantRec = false; log('System', pref.lang === 'de' ? 'Mikrofon blockiert – im Browser erlauben (Schloss neben der Adresse).' : 'Microphone blocked – allow it in the browser (lock icon next to the address).'); }
    };
    rec.onend = () => { S.listening = false; rec = null; ui(); if (wantRec && S.on && !S.speaking) { clearTimeout(recTimer); recTimer = setTimeout(startRec, 300); } };
    try { rec.start(); } catch (e) { rec = null; }
  }
  function pauseRec() { if (useW()) { window.WhisperMic.pause(); return; } if (rec) { try { rec.abort(); } catch (e) {} } }
  function resumeRec() { if (useW()) { if (wantRec && S.on) window.WhisperMic.resume(); return; } if (wantRec && S.on && !rec) { clearTimeout(recTimer); recTimer = setTimeout(startRec, 250); } }
  function stopRec() { wantRec = false; clearTimeout(recTimer); if (window.WhisperMic) window.WhisperMic.stop(); if (rec) { try { rec.abort(); } catch (e) {} } S.listening = false; }

  // ---------- Zahlen verstehen ----------
  const DW = { null: 0, zero: 0, eins: 1, ein: 1, eine: 1, one: 1, zwei: 2, zwo: 2, two: 2, drei: 3, three: 3, vier: 4, four: 4, fünf: 5, fuenf: 5, five: 5, sechs: 6, six: 6, sieben: 7, seven: 7, acht: 8, eight: 8, neun: 9, nine: 9, niner: 9 };
  const TEEN = { zehn: 10, elf: 11, zwölf: 12, zwoelf: 12, dreizehn: 13, vierzehn: 14, fünfzehn: 15, fuenfzehn: 15, sechzehn: 16, siebzehn: 17, achtzehn: 18, neunzehn: 19 };
  const TENS = { zwanzig: 20, dreißig: 30, dreissig: 30, vierzig: 40, fünfzig: 50, fuenfzig: 50, sechzig: 60, siebzig: 70, achtzig: 80, neunzig: 90 };
  function wordNum(w) { // "einhundertvierzig", "dreiundvierzig", "hundert" …
    if (/^\d+([.,]\d+)?$/.test(w)) return parseFloat(w.replace(',', '.'));
    let rest = w, total = 0, cur = 0, got = false;
    const pieces = Object.assign({}, DW, TEEN, TENS);
    const keys = Object.keys(pieces).sort((a, b) => b.length - a.length);
    while (rest) {
      if (rest.startsWith('und')) { rest = rest.slice(3); continue; }
      if (rest.startsWith('hundert')) { cur = (cur || 1) * 100; rest = rest.slice(7); got = true; continue; }
      if (rest.startsWith('tausend')) { total += (cur || 1) * 1000; cur = 0; rest = rest.slice(7); got = true; continue; }
      const k = keys.find((x) => rest.startsWith(x));
      if (!k) return null;
      cur += pieces[k]; rest = rest.slice(k.length); got = true;
    }
    return got ? total + cur : null;
  }
  function nums(text) {
    const toks = String(text).toLowerCase().replace(/(\d),(\d)/g, '$1.$2').replace(/\bkomma\b|\bpoint\b/g, '.').replace(/[^\p{L}\p{N}.+\s]/gu, ' ').split(/\s+/).filter(Boolean);
    const out = [];
    let run = '';
    const flush = () => {
      if (!run) return;
      if (run.length > 4) { for (let k = 0; k < run.length; k += 3) out.push(parseInt(run.slice(k, k + 3), 10)); } else out.push(parseInt(run, 10));
      run = '';
    };
    for (let i = 0; i < toks.length; i++) {
      let t = toks[i];
      if (t === '.' && (run || out.length) && toks[i + 1]) { // Dezimalpunkt
        flush();
        const f = wordNum(toks[i + 1]);
        if (f !== null) { out[out.length - 1] = parseFloat(out[out.length - 1] + '.' + f); i++; }
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(DW, t) && DW[t] <= 9 && !/^(ein|eine)$/.test(t) || (/^(ein|eine)$/.test(t) && /^(null|zero|eins|ein|zwei|zwo|drei|vier|fünf|fuenf|sechs|sieben|acht|neun|one|two|three|four|five|six|seven|eight|nine|niner)$/.test(toks[i + 1] || ''))) {
        run += DW[t]; continue;
      }
      if (/^(hundert|hundred)$/.test(t)) { // "ein hundert vierzig"
        flush();
        if (out.length && out[out.length - 1] >= 1 && out[out.length - 1] <= 9) out[out.length - 1] *= 100; else out.push(100);
        const nx = wordNum(toks[i + 1] || ''); if (nx !== null && nx < 100) { out[out.length - 1] += nx; i++; }
        continue;
      }
      flush();
      const n = wordNum(t);
      if (n !== null && n !== undefined) out.push(n);
    }
    flush();
    return out;
  }

  // ---------- Prüfen der Antworten ----------
  function perf() { return window.PerfLast || store.get('perfLast', null); }
  const norm = (s) => String(s).toLowerCase().replace(/[.,!?]/g, ' ').replace(/\s+/g, ' ').trim();
  function verify(it, said) {
    const name = it.item, resp = it.resp || '', hasVal = resp.includes('___');
    const s = app.sim || {};
    const ph = listPhases((lists()[S.list] || {}).name || '') || [];
    const N = nums(said);
    if (!hasVal) return { ok: true };
    if (/speeds|geschwindigkeiten/i.test(name) && /t\.?o|start/i.test(name) && !/land/i.test(name)) {
      const v = N.filter((n) => n >= 80 && n <= 250);
      if (v.length < 3) return { ok: false, msg: T().needSpeeds, retry: true };
      const P = perf();
      if (!P || !P.v1) return { ok: true, note: T().noPerf };
      const want = [P.v1, P.vr, P.v2];
      if (v.slice(0, 3).every((n, k) => Math.abs(n - want[k]) <= 1)) return { ok: true };
      return { ok: false, msg: T().spd(want.join(', '), v.slice(0, 3).join(', ')) };
    }
    if (/fuel quantity|treibstoffmenge/i.test(name)) {
      let n = N.find((x) => x > 0); if (n === undefined) return { ok: false, msg: T().yn, retry: true };
      if (n < 100) n *= 1000;
      if (s.fuelKg == null) return { ok: true };
      if (Math.abs(n - s.fuelKg) <= Math.max(0.05 * s.fuelKg, 200)) return { ok: true };
      return { ok: false, msg: T().fuel(Math.round(s.fuelKg / 10) * 10, Math.round(n)) };
    }
    if (/baro ref|altimeter/i.test(name) && ph.some((p) => ['pre', 'desc', 'final'].includes(p))) {
      if (/\b(std|standard)\b/i.test(said)) return { ok: true };
      let n = N.find((x) => x > 20); if (n === undefined) return { ok: false, msg: T().yn, retry: true };
      if (n >= 2800 && n <= 3100) n /= 100;
      else if (n >= 28 && n <= 31) { const k = N[N.indexOf(n) + 1]; if (k !== undefined && k < 100 && Number.isInteger(k)) n += k / 100; }
      const hpa = n < 40 ? n * 33.8639 : n;
      if (s.qnh == null || !isFinite(s.qnh)) return { ok: true };
      if (Math.abs(hpa - s.qnh) <= 2) return { ok: true };
      return { ok: false, msg: T().qnh(Math.round(s.qnh), n < 40 ? n.toFixed(2) : Math.round(n)) };
    }
    if (/flap setting|^klappen/i.test(name) && ph.includes('out')) {
      const P = perf(); if (!P || !P.conf) return { ok: true };
      const t = norm(said);
      const got = /(1\s*(\+|plus)\s*(f|ef)|eins\s*plus\s*(f|ef)|one\s*plus\s*(f|ef))/.test(t) ? '1+F' : (N.find((x) => x >= 0 && x <= 40) !== undefined ? String(N.find((x) => x >= 0 && x <= 40)) : '');
      if (!got) return { ok: false, msg: T().yn, retry: true };
      if (String(P.conf).toUpperCase() === got) return { ok: true };
      return { ok: false, msg: T().conf(P.conf, got) };
    }
    return { ok: true };
  }

  // ---------- Dialog ----------
  const YES = /\b(ja|jo|jawohl|jep|klar|okay|ok|bitte|los|mach|machen|gerne|starte?|anfangen|beginn\w*|yes|yeah|yep|sure|go|please|affirm\w*|positiv)\b/i;
  const NO = /\b(nein|nö|nee|nicht|später|lass|no|nope|negative?|negativ|cancel|later)\b/i;
  const STOP = /\b(stopp?|abbrechen|abbruch|ende|beenden|cancel|abort|halt)\b/i;
  const SKIP = /\b(weiter|überspringen|skip|next|nächster|nächste)\b/i;
  const REP = /\b(wiederholen|nochmal|noch mal|repeat|again|wie bitte|say again)\b/i;

  function log(who, text, noRelay) {
    S.log.push({ who, text }); if (S.log.length > 5) S.log.shift(); ui();
    if (HOST && !noRelay) post('/api/cp/event', { type: 'log', who, text, from: window.EFB_ID });
  }
  const itemLang = () => (checklistKey().startsWith('airbus') ? 'en' : pref.lang);

  async function handle(text, spoken) {
    text = String(text || '').trim(); if (!text || !S.on) return;
    log('Du', text);
    if (S.mode !== 'run') {
      const li = intentList(text);
      if (li >= 0) { clearTimeout(S.askT); return begin(li); }
    }
    if (S.mode === 'ask' || S.mode === 'askAnyway') {
      if (STOP.test(text) || (NO.test(text) && !YES.test(text))) { S.mode = 'idle'; return say(T().no); }
      if (YES.test(text)) return begin(S.list);
      return say(T().yn);
    }
    if (S.mode === 'askNext') {
      if (NO.test(text) && !YES.test(text)) { S.mode = 'idle'; return say(T().no); }
      if (YES.test(text)) return begin(S.list);
      return say(T().yn);
    }
    if (S.mode === 'run') {
      if (STOP.test(text)) { S.mode = 'idle'; return say(T().stop); }
      if (REP.test(text)) return challenge();
      if (SKIP.test(text)) { await say(T().skip); return advance(false); }
      const l = lists()[S.list]; if (!l) { S.mode = 'idle'; return; }
      const it = l.items[S.item];
      const v = verify(it, text);
      if (v.ok) {
        tick(S.list, S.item);
        if (v.note) await say(v.note);
        await say(T().checked, itemLang() === 'en' ? 'en' : pref.lang);
        return advance(true);
      }
      await say(v.msg);
      if (v.retry) return;
    }
  }
  // „let's do the cockpit preparation checklist“ / „starte die Before Start Checkliste“ / „next checklist“
  const STOPW = new Set(['checklist', 'checkliste', 'list', 'liste', 'the', 'die', 'der', 'das', 'und', 'and', 'of', 'to', 'a']);
  const tokz = (x) => norm(x).replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/[\s-]+/).filter(Boolean);
  const wordEq = (a, b) => a === b || (a.length > 3 && b.length > 3 && a.slice(0, 4) === b.slice(0, 4));
  const INTENT = /(checkl|check list|liste\b|\blist\b|let'?s|lass|mach|start|beginn|begin|\bdo\b|\brun\b)/i;
  function intentList(text) {
    if (!INTENT.test(text)) return -1;
    const ls = lists(); if (!ls.length) return -1;
    if (/\b(next|nächste\w*|naechste\w*)\b/i.test(text) && /(checkl|check list|liste|list)/i.test(text)) {
      const ph = phase(); const i = ls.findIndex((l, k) => !isDone(k) && (!ph || !listPhases(l.name) || listPhases(l.name).includes(ph)));
      return i >= 0 ? i : ls.findIndex((_, k) => !isDone(k));
    }
    const tt = tokz(text); let best = -1, bs = 0;
    ls.forEach((l, i) => {
      const nt = tokz(l.name).filter((w) => !STOPW.has(w)); if (!nt.length) return;
      if (nt.every((w) => tt.some((x) => wordEq(x, w))) && nt.length > bs) { bs = nt.length; best = i; }
    });
    return best;
  }
  function tick(li, ii) {
    const key = checklistKey(); const prog = store.get('cl.' + key, {});
    const t = prog[li] || []; t[ii] = true; prog[li] = t; store.set('cl.' + key, prog);
    renderChecklists();
  }
  function nextOpen(li) { const l = lists()[li]; const t = progOf()[li] || []; return l.items.findIndex((_, k) => !t[k]); }
  async function begin(li) {
    const l = lists()[li]; if (!l) return;
    clIndex = li; renderChecklists();
    if (HOST) post('/api/cp/event', { type: 'show', index: li, from: window.EFB_ID });
    S.list = li; S.mode = 'run'; S.item = nextOpen(li);
    if (S.item < 0) { S.mode = 'idle'; return say(T().done(l.name)); }
    await say(T().go);
    return challenge();
  }
  async function challenge() {
    const l = lists()[S.list]; if (!l || S.item < 0) return;
    const it = l.items[S.item];
    await say(it.item, itemLang());
  }
  async function advance() {
    const l = lists()[S.list]; if (!l) { S.mode = 'idle'; return; }
    const nx = nextOpen(S.list);
    if (nx < 0) {
      S.mode = 'idle';
      await say(T().complete(l.name));
      return suggestNext(S.list);
    }
    S.item = nx; return challenge();
  }
  async function suggestNext(li) {
    const ls = lists(), ph = phase();
    for (let i = li + 1; i < ls.length; i++) {
      if (isDone(i)) continue;
      const p = listPhases(ls[i].name);
      if (!p || (ph && p.includes(ph))) { S.list = i; S.mode = 'askNext'; armAsk(); return say(T().next(ls[i].name)); }
      break;
    }
  }
  function armAsk() { clearTimeout(S.askT); S.askT = setTimeout(() => { if (S.mode.startsWith('ask')) S.mode = 'idle'; }, 30000); }

  // Klick auf eine Checkliste: Copilot sagt, ob sie dran ist
  async function onPick(i) {
    if (!S.on) return;
    const ls = lists(), l = ls[i]; if (!l) return;
    S.list = i;
    if (isDone(i)) { S.mode = 'idle'; return say(T().done(l.name)); }
    const ph = phase(), p = listPhases(l.name);
    const prev = ls.findIndex((x, k) => k < i && !isDone(k) && (listPhases(x.name) || []).some((q) => (p || []).includes(q)));
    const due = !ph || !p || p.includes(ph);
    S.mode = due ? 'ask' : 'askAnyway'; armAsk();
    const parts = [];
    if (due) parts.push([T().due(l.name)]);
    else parts.push([T().notDue(l.name, T().why(T().ph[ph], T().wantPh[p[0]]))]);
    if (prev >= 0) parts.push([T().before(ls[prev].name)]);
    for (const [t] of parts) await say(t);
  }

  // Erinnerung: neue Phase → fällige Checkliste anbieten
  function watch() {
    if (!S.on) return;
    const ph = phase(); if (!ph) return;
    if (lat.landed && ph === 'post' && lists().length && isDone(lists().length - 1)) { lat.flown = lat.landed = false; asked.clear(); }
    if (ph === lastPhase) return;
    lastPhase = ph;
    if (S.mode !== 'idle' || S.speaking) { lastPhase = null; return; }
    const ls = lists();
    for (let i = 0; i < ls.length; i++) {
      const p = listPhases(ls[i].name);
      if (isDone(i) || !p || !p.includes(ph)) continue;
      const k = ph + '|' + i; if (asked.has(k)) return;
      asked.add(k);
      S.list = i; S.mode = 'ask'; armAsk();
      say(T().remind(T().ph[ph], ls[i].name));
      return;
    }
  }

  // ---------- Oberfläche ----------
  let panel;
  function ui() {
    if (!panel) return;
    const on = S.on;
    panel.querySelector('#cpToggle').textContent = on ? (pref.lang === 'de' ? 'Copilot: an' : 'Copilot: on') : (pref.lang === 'de' ? 'Copilot: aus' : 'Copilot: off');
    panel.querySelector('#cpToggle').classList.toggle('on', on);
    const st = panel.querySelector('#cpState');
    st.textContent = !on ? '' : S.speaking ? '🔊' : S.listening ? '🎤' : '·';
    panel.querySelector('#cpLog').innerHTML = S.log.map((m) => `<div class="cp-${m.who === 'Du' ? 'me' : 'cp'}"><b>${esc(m.who)}</b> ${esc(m.text)}</div>`).join('');
    panel.classList.toggle('on', on);
    panel.classList.toggle('cp-remote', remote());
    if (remote()) { const tg = panel.querySelector('#cpToggle'); tg.textContent = pref.lang === 'de' ? 'Copilot läuft am PC' : 'Copilot runs on the PC'; tg.disabled = true; tg.classList.add('on'); } else panel.querySelector('#cpToggle').disabled = false;
  }
  function build() {
    const sec = $('#tab-check'); if (!sec) return;
    panel = document.createElement('div');
    panel.className = 'cp-panel';
    panel.innerHTML = `<div class="cp-row">
        <button class="btn-s" id="cpToggle">Copilot: aus</button><span id="cpState" class="cp-state"></span>
        <select id="cpLang"><option value="de">Deutsch</option><option value="en">English</option></select>
        <select id="cpVoice" title="Stimme"></select>
        <select id="cpVoiceEn" title="Stimme für englische Wörter"></select>
        <label class="cp-rate">Tempo <input type="range" id="cpRate" min="0.8" max="1.4" step="0.05"></label>
        <label class="cp-chk"><input type="checkbox" id="cpMic"> Mikrofon</label>
        <label class="cp-chk"><input type="checkbox" id="cpAuto"> Automatisch starten</label>
        <form id="cpForm"><input id="cpText" placeholder="Antwort eintippen …" autocomplete="off"><button class="btn-s">OK</button></form>
      </div><div id="cpLog" class="cp-log"></div>`;
    sec.insertBefore(panel, sec.firstChild);
    if (window.LANG === 'en') $('#cpText').placeholder = 'Type your answer …';
    $('#cpLang').value = pref.lang; $('#cpRate').value = pref.rate; $('#cpMic').checked = pref.mic;
    const save = persist;
    const fill1 = (sel, k, label) => {
      if (!sel) return;
      const list = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith(k));
      const cur = (pref.voice && pref.voice[k]) || '';
      const pl = piper.voices.filter((v) => v.lang === k);
      const auto = piper.available && pl.length ? (pref.lang === 'de' ? 'Automatisch (eingebaut)' : 'Automatic (built-in)') : (pref.lang === 'de' ? 'Standardstimme' : 'Default voice');
      sel.innerHTML = `<option value="">${label}${auto}</option>` + pl.map((v) => `<option value="piper:${esc(v.id)}" ${'piper:' + v.id === cur ? 'selected' : ''}>★ ${esc(v.label)}</option>`).join('') + list.map((v) => `<option value="${esc(v.name)}" ${v.name === cur ? 'selected' : ''}>${esc(v.name)}</option>`).join('');
    };
    const fillVoices = () => {
      fill1($('#cpVoice'), pref.lang === 'de' ? 'de' : 'en', '');
      const e = $('#cpVoiceEn'); if (e) { e.hidden = pref.lang !== 'de'; fill1(e, 'en', 'EN: '); }
    };
    window._cpFillVoices = fillVoices; fillVoices();
    $('#cpVoice').onchange = (e) => { pref.voice = pref.voice || {}; pref.voice[pref.lang === 'de' ? 'de' : 'en'] = e.target.value; save(); say(pref.lang === 'de' ? 'So klinge ich.' : 'This is my voice.'); };
    $('#cpVoiceEn').onchange = (e) => { pref.voice = pref.voice || {}; pref.voice.en = e.target.value; save(); say('Before Start {{checklist}}'.replace(/\{\{|\}\}/g, ''), 'en'); };
    $('#cpAuto').checked = !!pref.autostart;
    $('#cpAuto').onchange = (e) => { pref.autostart = e.target.checked; save(); };
    $('#cpToggle').onclick = () => (S.on ? stop() : start());
    $('#cpLang').onchange = (e) => { pref.lang = e.target.value; save(); fillVoices(); if (rec) { pauseRec(); } ui(); };
    $('#cpRate').oninput = (e) => { pref.rate = parseFloat(e.target.value); save(); };
    $('#cpMic').onchange = (e) => { pref.mic = e.target.checked; save(); if (!pref.mic) stopRec(); else if (S.on) startRec(); };
    $('#cpForm').onsubmit = (e) => { e.preventDefault(); const t = $('#cpText').value; $('#cpText').value = ''; if (remote()) { log('Du', t, true); post('/api/cp/event', { type: 'input', text: t, from: window.EFB_ID }); } else handle(t, false); };
    const css = document.createElement('style'); css.textContent = '.cp-remote .cp-row > :not(#cpToggle):not(#cpState):not(#cpForm){display:none}'; document.head.appendChild(css);
    ui();
  }
  function start() {
    if (remote()) return;
    S.on = true; S.mode = 'idle'; lastPhase = null; ui();
    if (TTS) { try { TTS.cancel(); } catch (e) {} }
    loadPiper().then(() => say(T().on)); startRec(); if (!SR && !stt.available && pref.mic && !HOST) log('System', T().noMic);
    if (HOST) beat();
  }
  function stop() {
    S.on = false; S.mode = 'idle'; stopRec(); if (TTS) { try { TTS.cancel(); } catch (e) {} } if (curAudio) { try { curAudio.pause(); } catch (e) {} curAudio = null; }
    S.speaking = false; ui();
    if (HOST) post('/api/cp/host', { off: true });
  }
  const beat = () => post('/api/cp/host', { id: window.EFB_ID });

  document.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.cl === undefined) return;
    if (remote()) { post('/api/cp/event', { type: 'pick', index: Number(b.dataset.cl), from: window.EFB_ID }); return; }
    if (S.on) setTimeout(() => onPick(Number(b.dataset.cl)), 0);
  }, true);
  loadPiper(); fetch('/api/copilot').then((r) => r.json()).then((o) => {
    if (o && typeof o === 'object') { Object.assign(pref, o); store.set('copilot', pref); if (panel) { $('#cpLang').value = pref.lang; $('#cpRate').value = pref.rate; $('#cpMic').checked = pref.mic; $('#cpAuto').checked = !!pref.autostart; if (window._cpFillVoices) window._cpFillVoices(); } }
    if (HOST) { setTimeout(() => { try { showTab('check'); } catch (e) {} if (!S.on) start(); }, 800); } else if (pref.autostart) { const go = () => { document.removeEventListener('pointerdown', go, true); document.removeEventListener('keydown', go, true); if (!S.on) start(); }; document.addEventListener('pointerdown', go, true); document.addEventListener('keydown', go, true); }
  }).catch(() => {});
  fetch('/api/stt/status').then((r) => r.json()).then((o) => { stt.available = !!o.available; stt.checked = true; }).catch(() => { stt.checked = true; });
  const pollHost = () => fetch('/api/cp/host').then((r) => r.json()).then((o) => { const was = remote(); hostActive = !!o.active && o.id !== window.EFB_ID; if (remote() && S.on) stop(); if (was !== remote()) ui(); }).catch(() => {});
  if (!HOST) { pollHost(); setInterval(pollHost, 5000); } else setInterval(() => { if (S.on) beat(); }, 5000);
  hooks.sim.push(watch);
  setInterval(watch, 4000);
  // Ereignisse vom Server: iPad tippt eine Liste an / tippt eine Antwort / zeigt die Liste des Copiloten
  function onEvent(name, d) {
    if (name !== 'cp' || d.from === window.EFB_ID) return;
    if (HOST) {
      if (d.type === 'pick' && S.on) { clIndex = d.index; renderChecklists(); onPick(d.index); }
      if (d.type === 'input' && S.on) handle(d.text, false);
    } else {
      if (d.type === 'log') log(d.who, d.text, true);
      if (d.type === 'show' && remote()) { clIndex = d.index; if (typeof renderChecklists === 'function' && app.tab === 'check') renderChecklists(); }
    }
  }
  function onRemoteTick(k) {
    if (!HOST || !S.on || S.mode !== 'run' || S.speaking || k !== 'cl.' + checklistKey()) return;
    if ((progOf()[S.list] || [])[S.item]) advance();
  }
  window.Copilot = { handle, state: S, nums, verify, phase, start, stop, _pref: pref, onEvent, onRemoteTick, intentList, sttError: (m) => log('System', 'Spracherkennung: ' + m) };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
