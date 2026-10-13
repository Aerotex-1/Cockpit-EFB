// Sprach-Copilot für die Checklisten: spricht über die Kopfhörer des PCs, hört per Mikrofon zu
// und prüft Antworten (Speeds, QNH, Fuel) gegen die Berechnung bzw. den Sim.
// Alles läuft im Browser (Sprachausgabe + Spracherkennung des Browsers). Die Spracherkennung
// von Chrome/Edge ist ein Cloud-Dienst – siehe PRIVACY.md. Ohne Mikrofon geht es per Texteingabe.
(function () {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const TTS = window.speechSynthesis;
  const pref = Object.assign({ lang: 'de', rate: 1.05, mic: true, autostart: false, voice: {} }, store.get('copilot', {}));
  let persistT = 0;
  const persist = () => { store.set('copilot', pref); clearTimeout(persistT); persistT = setTimeout(() => fetch('/api/copilot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({}, pref, { from: window.EFB_ID })) }).catch(() => {}), 300); };
  const HOST = /[?&]host=1\b/.test(location.search); // PC-App: dieses Fenster spricht und hört zu
  const stt = { available: false };
  let hostActive = false; // läuft irgendwo ein Copilot-Fenster am PC?
  let isLocal = false; // Gerät ist der PC selbst (nicht das iPad)? Nur der PC darf sprechen und zuhören
  const remote = () => !HOST && (hostActive || !isLocal);
  let muted = false; // stumm: weder sprechen noch zuhören (gilt für alle Geräte)
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
      snooze: (n, m) => `Okay, ich frage in ${m} Minuten wieder wegen der {{${n}}} Checkliste.`, snoozeQ: 'Welche Checkliste, und in wie vielen Minuten?',
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
      correct: 'Stimmt.', brake: 'Gesetzt oder gelöst?', brakeIs: (set) => `Laut Sim ist die Parkbremse ${set ? 'gesetzt' : 'gelöst'}.`,
      spdFix: (l) => `Nicht ganz. Laut Performance-Rechner: ${l}.`, needRwy: 'Welche Piste?',
      rwyBad: (want, got) => `Falsch. Geplant ist Piste ${want}, du sagst ${got}.`, rwyHdg: (want, hdg) => `Wir stehen nicht auf Piste ${want}. Der Kurs ist ${hdg}.`,
      rwyOk: (r) => `Stimmt, Piste ${r}.`, mute: 'Copilot ist stumm.', unmute: 'Copilot ist wieder da.',
      stby: (f) => `Standby ${f}.`, act: (f) => `${f} active.`, radioFail: 'Das Funkgerät hat die Frequenz nicht angenommen.', noFreq: 'Welche Frequenz?',
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
      snooze: (n, m) => `Okay, I will ask you about the ${n} checklist again in ${m} minutes.`, snoozeQ: 'Which checklist, and in how many minutes?',
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
      correct: 'Correct.', brake: 'Set or released?', brakeIs: (set) => `The sim shows the parking brake ${set ? 'set' : 'released'}.`,
      spdFix: (l) => `Not quite. According to the performance calculator: ${l}.`, needRwy: 'Which runway?',
      rwyBad: (want, got) => `Negative. Planned runway is ${want}, you said ${got}.`, rwyHdg: (want, hdg) => `We are not lined up with runway ${want}. Heading is ${hdg}.`,
      rwyOk: (r) => `Correct, runway ${r}.`, mute: 'Copilot muted.', unmute: 'Copilot is back.',
      stby: (f) => `Standby ${f}.`, act: (f) => `${f} active.`, radioFail: 'The radio did not accept the frequency.', noFreq: 'Which frequency?',
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
    if (!s.onGround && (s.ias || 0) > 80) { lat.since = lat.since || now; if (now - lat.since > 8000) lat.flown = true; } else lat.since = 0; // Ladezeit des Sims (kurz „in der Luft“) zählt nicht als Flug
    if (lat.flown && s.onGround && (s.gs || 0) < 80) lat.landed = true;
    const gs = s.gs || 0;
    if (lat.landed) return gs < 3 && brk() !== false ? 'post' : 'in';
    if (!s.onGround) {
      if ((s.alt || 0) < 3500 && (s.vs || 0) < -200 && lat.flown) return 'final';
      if ((s.vs || 0) < -300 && (s.alt || 0) < 15000 && lat.flown) return 'desc';
      return 'air';
    }
    const pb = ((s.efb || {}).ground || {}).pushback; // beim Pushback sind wir noch am Gate
    return gs < 3 || (pb && gs < 8) ? 'pre' : 'out';
  }
  // Parkbremse: true/false nur, wenn der Sim sie verlässlich meldet, sonst null (unbekannt)
  const brk = () => { const s = app.sim || {}; if (!s.connected) return null; return s.parkingBrake === true ? true : (s.brakeKnown ? false : null); };
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
  function playPiper(text, id, url) {
    return new Promise((res, rej) => {
      const a = new Audio(url || piperUrl(id, text));
      curAudio = a;
      const ready = window.AudioDev ? window.AudioDev.sink(a) : Promise.resolve();
      const done = (ok) => { if (curAudio === a) curAudio = null; ok ? res() : rej(new Error('audio')); };
      a.onended = () => done(true); a.onerror = () => done(false);
      ready.then(() => a.play()).catch(() => done(false));
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
  // Abkürzungen, die man buchstabiert (ADIRS → A.D.I.R.S.); Wörter wie ECAM oder TOGA bleiben
  const SPELL = ['ADIRS', 'APU', 'FMGC', 'MCDU', 'FCU', 'GPU', 'IRS', 'ADR', 'ILS', 'QNH', 'QFE', 'ATC', 'TCAS', 'GPWS', 'EGPWS', 'EFIS', 'PFD', 'ISIS', 'ELAC', 'EFB', 'VHF', 'VOR', 'DME', 'NDB', 'RNAV', 'FMA', 'CVR', 'EWD', 'RMP'];
  const SPELL_RE = new RegExp('(?<![\\w.])(' + SPELL.join('|') + ')(?![\\w.])', 'g');
  const spellOut = (t) => String(t).replace(SPELL_RE, (m) => m.split('').join('.') + '.');
  function parts(text, lang) {
    if (lang === 'de') text = autoMark(text);
    const out = [];
    String(text).split(/\{\{(.*?)\}\}/).forEach((t, i) => { t = spellOut(t.trim()); if (t) out.push({ text: t, lang: i % 2 ? 'en' : lang }); });
    return out;
  }
  const capFirst = (x) => x.charAt(0).toUpperCase() + x.slice(1);
  function kSplit(t) {
    const o = []; const m = t.match(/^(Ground to Cockpit,|Ground, hello,)\s*([\s\S]*)$/);
    if (m) { o.push(m[1]); t = m[2]; }
    t.split(/(?<=[.!?])\s+/).forEach((x) => { x = x.trim(); if (x) o.push(capFirst(x)); });
    return o;
  }
  async function say(text, lang, opt) {
    lang = lang || pref.lang; opt = opt || {};
    log(opt.who || 'Copilot', String(text).replace(/\{\{|\}\}/g, ''));
    if (!S.on || muted) return;
    const vid = (p) => opt.voiceId || piperFor(p.lang);
    // Kokoro rechnet pro Satz: kurze, oft gleiche Stücke (Anrede, einzelne Sätze) → Zwischenspeicher trifft öfter, erster Satz kommt schneller
    const ps = parts(text, lang).flatMap((p) => { const id = vid(p); return id && id.startsWith('kokoro-') && !opt.url ? kSplit(p.text).map((x) => ({ text: x, lang: p.lang })) : [p]; });
    if (!ps.length) return;
    S.speaking = true; ui(); pauseRec();
    if (!opt.url) ps.slice(1).forEach((p) => { const id = vid(p); if (id) fetch(piperUrl(id, p.text)).catch(() => {}); }); // schon vorrechnen lassen
    try {
      for (const p of ps) {
        if (!S.on) break;
        if (opt.url) { try { await playPiper(null, null, opt.url); } catch (e) { /* Datei nicht abspielbar */ } continue; }
        const id = vid(p);
        if (id) { try { await playPiper(p.text, id); } catch (e) { await speakRaw(p.text, p.lang, opt.pitch); } } else await speakRaw(p.text, p.lang, opt.pitch);
      }
    } finally { S.speaking = false; ui(); resumeRec(); }
  }
  function speakRaw(text, lang, pitch) {
    if (!TTS) return Promise.resolve();
    return new Promise((res) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang === 'de' ? 'de-DE' : 'en-US';
      const v = voiceFor(lang); if (v) u.voice = v;
      u.rate = pref.rate; if (pitch) u.pitch = pitch;
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
  // Hinweistext für Whisper: passend zur Lage (offenes GSX-Menü, laufende Checkliste, Rückfrage, sonst allgemein) – so erkennt er genau die Wörter, die jetzt wahrscheinlich sind
  function sttPrompt() {
    const cut = (x, n) => String(x || '').replace(/\s+/g, ' ').trim().slice(0, n);
    let p = 'Cockpit to ground. Ground to Cockpit. ';
    try {
      if (S.mode === 'gsxMenu') {
        p += 'Nose left, tail right. Nose right, tail left. Straight pushback. Straight pull pushback. ' + cut((S.gsxItems || []).map((x) => itemSpoken(x)).join('. '), 260) + '. Left. Right. Cancel. ';
      } else if (S.mode === 'run') {
        const l = lists()[S.list] || {}, it = (l.items || [])[S.item] || {};
        p += cut(l.name, 40) + '. ' + cut(it.item, 70) + '. ' + cut(String(it.resp || '').replace(/_+/g, ''), 60) + '. Checked. Set. Released. Confirmed. On. Off. Skip. Repeat. Stop. V1, VR, V2, QNH, flaps, runway. Zero one two three four five six seven eight nine. ';
      } else if (/^ask/.test(S.mode)) {
        p += cut((lists()[S.list] || {}).name, 40) + ' checklist. Yes. No. Not now. Later. Ask me again in five to ten minutes. In ten minutes. ';
      } else {
        p += 'Request pushback. Request boarding, catering, refueling. Ground power, chocks, start engines, disconnect. ' + cut(LISTNAMES(), 170) + '. Let\'s do the checklist. Frequency one two one decimal eight. Alpha Bravo Charlie Delta Echo Foxtrot Golf Hotel. ';
      }
    } catch (e) { /* weiter */ }
    return p.slice(0, 640);
  }
  const sttOpts = () => ({
    lang: S.mode === 'run' && checklistKey().startsWith('airbus') ? 'en' : 'auto',
    prompt: sttPrompt(),
  });
  function startRec() {
    if (!pref.mic || muted) return;
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
  function resumeRec() { if (muted) return; if (useW()) { if (wantRec && S.on) window.WhisperMic.resume(); return; } if (wantRec && S.on && !rec) { clearTimeout(recTimer); recTimer = setTimeout(startRec, 250); } }
  function stopRec() { wantRec = false; clearTimeout(recTimer); if (window.WhisperMic) window.WhisperMic.stop(); if (rec) { try { rec.abort(); } catch (e) {} } S.listening = false; }

  // ---------- Zahlen verstehen ----------
  const DW = { null: 0, zero: 0, eins: 1, ein: 1, eine: 1, one: 1, zwei: 2, zwo: 2, two: 2, drei: 3, three: 3, vier: 4, four: 4, fünf: 5, fuenf: 5, five: 5, sechs: 6, six: 6, sieben: 7, seven: 7, acht: 8, eight: 8, neun: 9, nine: 9, niner: 9, tree: 3, fife: 5, fower: 4 };
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
  // „1.0.2.1.“, „1 0 2 1“ → „1021“
  const collapseDigits = (t) => String(t).replace(/(?<![\d.,])(\d)(?:[\s.,-]+\d){2,}(?!\d)/g, (m) => m.replace(/\D/g, '')).replace(/(\d)\.(?=\s|$)/g, '$1');
  function nums(text) {
    text = collapseDigits(text);
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

  // „2.3“, „two three left“, „26 rechts“ → { n: 23, side: '' }
  function rwyOf(text) {
    const t = String(text).toLowerCase().replace(/\b(runway|piste|bahn)\b/g, ' ');
    const sd = (w, l) => new RegExp('\\b(' + w + ')\\b|\\d\\s?' + l + '\\b|\\b' + l + '\\b').test(t);
    const side = sd('left|links', 'l') ? 'L' : sd('right|rechts', 'r') ? 'R' : sd('center|centre|mitte', 'c') ? 'C' : '';
    const dig = t.replace(/[a-zäöüß]+/g, (w) => (Object.prototype.hasOwnProperty.call(DW, w) && !/^(ein|eine)$/.test(w) ? String(DW[w]) : w));
    const m = dig.replace(/(?<!\d)(\d)(?:[\s.,-]+\d)+(?!\d)/g, (x) => x.replace(/\D/g, '')).match(/(?<!\d)(\d{1,2})(?!\d)/);
    const n = m ? parseInt(m[1], 10) : 0;
    return n >= 1 && n <= 36 ? { n, side } : null;
  }
  // Geplante Startbahn: Rollweg-Eingabe (Karte) → Performance-Rechner → OFP
  function plannedRwy() {
    const o = app.ofp || {}, ic = o.origin && o.origin.icao_code;
    const pick = (s) => { const m = String(s || '').toUpperCase().match(/^(\d{1,2})([LRC]?)/); return m ? { n: parseInt(m[1], 10), side: m[2] || '' } : null; };
    const tx = (store.get('taxi', {}) || {})[ic + ':dep'];
    const P = perf();
    return pick(tx && tx.rwy) || (P && P.rwy && (!P.icao || !ic || P.icao === ic) ? pick(P.rwy) : null) || pick(o.origin && o.origin.plan_rwy);
  }
  const rwyName = (r) => String(r.n).padStart(2, '0') + (r.side === 'L' ? ' left' : r.side === 'R' ? ' right' : r.side === 'C' ? ' center' : '');
  const rwySay = (r) => spokenDigits(String(r.n).padStart(2, '0')) + (r.side === 'L' ? ' left' : r.side === 'R' ? ' right' : r.side === 'C' ? ' center' : '');
  const spokenDigitsDe = (s) => String(s).split('').map((d) => ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun'][+d]).join(' ');
  // Piste für die Sprachausgabe in der Sprache des Copiloten („zwei sechs rechts“ / „two six right“)
  const rwyTxt = (r) => (pref.lang === 'de' ? spokenDigitsDe(String(r.n).padStart(2, '0')) + (r.side === 'L' ? ' links' : r.side === 'R' ? ' rechts' : r.side === 'C' ? ' Mitte' : '') : rwySay(r));
  const spokenDigits = (s) => String(s).split('').map((d) => ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'niner'][+d]).join(' ');
  // ---------- Prüfen der Antworten ----------
  function perf() { return window.PerfLast || store.get('perfLast', null); }
  const norm = (s) => String(s).toLowerCase().replace(/[.,!?]/g, ' ').replace(/\s+/g, ' ').trim();
  function verify(it, said) {
    const name = it.item, resp = it.resp || '', hasVal = resp.includes('___');
    const s = app.sim || {};
    const ph = listPhases((lists()[S.list] || {}).name || '') || [];
    const N = nums(said);
    // Parkbremse: „set“ oder „released“ genügt; wenn der Sim es meldet, wird verglichen
    if (/park(ing)?\s*(brake|brk)|parkbremse/i.test(name)) {
      const t = norm(said);
      const set = /\b(set|on|applied|apply|gesetzt|fest|angezogen|an)\b/.test(t), rel = /\b(released?|off|gelöst|geloest|offen|los|aus)\b/.test(t);
      if (!set && !rel) return { ok: false, msg: T().brake, retry: true };
      if (brk() !== null) {
        if (set && !rel && brk() === false) return { ok: false, msg: T().brakeIs(false) };
        if (rel && !set && brk() === true) return { ok: false, msg: T().brakeIs(true) };
      }
      return { ok: true };
    }
    // Startbahn: „2.3“ / „two three left“ gegen die geplante Piste (sonst gegen den Kurs)
    if (/(t\.?o|takeoff)\s*runway|startbahn|start-?piste/i.test(name)) {
      const got = rwyOf(said); if (!got) return { ok: false, msg: T().needRwy, retry: true };
      const want = plannedRwy();
      if (want) {
        if (got.n !== want.n || (got.side && want.side && got.side !== want.side)) return { ok: false, msg: T().rwyBad(rwyTxt(want), rwyTxt(got)) };
        return { ok: true, good: T().rwyOk(rwyTxt(want)) };
      }
      if (s.connected && s.onGround && Number.isFinite(s.hdg)) {
        const d = Math.abs(((s.hdg - got.n * 10 + 540) % 360) - 180);
        if (d > 30) return { ok: false, msg: T().rwyHdg(rwyTxt(got), String(Math.round(s.hdg)).padStart(3, '0')) };
        return { ok: true, good: T().rwyOk(rwyTxt(got)) };
      }
      return { ok: true };
    }
    if (!hasVal) return { ok: true };
    if (/speeds|geschwindigkeiten/i.test(name) && /t\.?o|start/i.test(name) && !/land/i.test(name)) {
      const tl = String(said).toLowerCase().replace(/[:=]/g, ' ');
      // Reihenfolge und Schreibweise frei: „V1 150, V2 150“, „V one 150“, „vee r 145“, „rotate 145“ …
      const mk = tl.replace(/,/g, ' ').replace(/\b(?:v|vee|we)[\s-]*(?:1|one|eins|ein)\b/g, ' @v1 ').replace(/\b(?:v|vee|we)[\s-]*(?:2|two|zwei|zwo)\b/g, ' @v2 ').replace(/\b(?:v|vee)[\s-]*(?:r|are|rotate)\b|\brotate\b|\brotation\b/g, ' @vr ');
      const got = {}; const segs = mk.split(/(@v1|@vr|@v2)/);
      for (let i = 1; i < segs.length; i += 2) { const n = nums(segs[i + 1] || '').find((x) => x >= 80 && x <= 250); if (n !== undefined && got[segs[i].slice(1)] === undefined) got[segs[i].slice(1)] = n; }
      let { v1 = null, vr = null, v2 = null } = got;
      if (v1 === null && vr === null && v2 === null) { const q = N.filter((n) => n >= 80 && n <= 250); if (q.length < 3) return { ok: false, msg: T().needSpeeds, retry: true }; [v1, vr, v2] = q; }
      const P = perf();
      if (!P || !P.v1) return { ok: true, note: T().noPerf };
      const bad = [];
      if (v1 !== null && Math.abs(v1 - P.v1) > 1) bad.push('V1 ' + P.v1); if (vr !== null && Math.abs(vr - P.vr) > 1) bad.push('VR ' + P.vr); if (v2 !== null && Math.abs(v2 - P.v2) > 1) bad.push('V2 ' + P.v2);
      const fl = tl.match(/\bflaps?\s*(1\s*(?:\+|plus)\s*f|\d)/); // Klappen sind optional; wenn genannt, werden sie mitgeprüft
      if (fl && P.conf) { const g = fl[1].replace(/\s|plus/g, '').replace('+', '+').toUpperCase(); if (String(P.conf).toUpperCase() !== (/\+F/.test(g) ? '1+F' : g)) bad.push((pref.lang === 'de' ? 'Klappen ' : 'flaps ') + P.conf); }
      if (bad.length) return { ok: false, msg: T().spdFix(bad.join(', ')) };
      return { ok: true, good: T().correct };
    }
    if (/fuel quantity|treibstoffmenge/i.test(name)) {
      let n = N.find((x) => x > 0); if (n === undefined) return { ok: false, msg: T().yn, retry: true };
      if (n < 100) n *= 1000;
      if (s.fuelKg == null) return { ok: true };
      if (Math.abs(n - s.fuelKg) <= Math.max(0.05 * s.fuelKg, 200)) return { ok: true };
      return { ok: false, msg: T().fuel(Math.round(s.fuelKg / 10) * 10, Math.round(n)) };
    }
    if (/baro ref|altimeter/i.test(name) && ph.some((p) => ['pre', 'desc', 'final'].includes(p))) {
      if (/\b(std|standard)\b/i.test(said)) return { ok: true, good: T().correct };
      let n = N.find((x) => x > 20); if (n === undefined) return { ok: false, msg: T().yn, retry: true };
      if (n >= 2800 && n <= 3100) n /= 100;
      else if (n >= 28 && n <= 31) { const k = N[N.indexOf(n) + 1]; if (k !== undefined && k < 100 && Number.isInteger(k)) n += k / 100; }
      const hpa = n < 40 ? n * 33.8639 : n;
      if (s.qnh == null || !isFinite(s.qnh)) return { ok: true };
      if (Math.abs(hpa - s.qnh) <= 2) return { ok: true, good: T().correct };
      return { ok: false, msg: T().qnh(Math.round(s.qnh), n < 40 ? n.toFixed(2) : Math.round(n)) };
    }
    if (/flap setting|^klappen/i.test(name) && ph.includes('out')) {
      const P = perf(); if (!P || !P.conf) return { ok: true };
      const t = norm(said);
      const got = /(1\s*(\+|plus)\s*(f|ef)|eins\s*plus\s*(f|ef)|one\s*plus\s*(f|ef))/.test(t) ? '1+F' : (N.find((x) => x >= 0 && x <= 40) !== undefined ? String(N.find((x) => x >= 0 && x <= 40)) : '');
      if (!got) return { ok: false, msg: T().yn, retry: true };
      if (String(P.conf).toUpperCase() === got) return { ok: true, good: T().correct };
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
    S.log.push({ who, text }); if (S.log.length > 40) S.log.shift(); ui();
    if (HOST && !noRelay) post('/api/cp/event', { type: 'log', who, text, from: window.EFB_ID });
  }
  const itemLang = () => (checklistKey().startsWith('airbus') ? 'en' : pref.lang);

  async function handle(text, spoken) {
    text = String(text || '').trim(); if (!text || !S.on) return;
    log('Du', text);
    text = fuzzyFix(text); // ähnlich Erkanntes gilt als verstanden
    { const gk = gsxCmd(text); if (gk) { clearTimeout(S.askT); if (S.mode === 'gsxMenu') S.mode = S.afterGsx === 'run' ? 'run' : 'idle'; else if (S.mode !== 'run') S.mode = 'idle'; return groundDo(gk, text, dirOf(text)); } }
    if (S.mode === 'gsxMenu') return groundPick(text);
    { const lm = livePush(); if (lm && S.mode !== 'run' && (addressed(text) || pushSem(text, lm.items))) { S.gsxItems = lm.items; S.gsxTitle = lm.title; S.mode = 'gsxMenu'; armAsk(45000); return groundPick(text); } }
    if (FREQ_CMD.test(text) && (freqOf(text) || (SWAP_CMD.test(text) && /\b(frequenc\w*|frequenz\w*|stand\s?-?by)\b/i.test(text))) && !/\b(speeds?|checklist|checkliste)\b/i.test(text)) return radioCmd(text);
    if (S.mode !== 'run' && await snoozeCmd(text)) return;
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
        if (v.good) await say(v.good);
        await say(T().checked, itemLang() === 'en' ? 'en' : pref.lang);
        return advance(true);
      }
      await say(v.msg);
      if (v.retry) return;
    }
  }
  // ---------- „Frag mich in 5–10 Minuten nochmal“ / „After Start Checkliste in 10 Minuten“ ----------
  const snoozeUntil = {}; // Listenschlüssel → Zeitpunkt
  const NUMW = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, eins: 1, ein: 1, eine: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, fuenf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12, zwoelf: 12, fünfzehn: 15, fuenfzehn: 15, zwanzig: 20, dreißig: 30, dreissig: 30, to: 2, for: 4 };
  function parseDelay(text) { // → [min, max] Minuten oder null
    let t = ' ' + String(text).toLowerCase().replace(/[-–]/g, ' bis ').replace(/\bhalf an hour\b|\beine halbe stunde\b/g, ' 30 minutes ').replace(/\ba quarter of an hour\b|\beine viertelstunde\b/g, ' 15 minutes ') + ' ';
    if (!/\b(minutes?|mins?|minuten?)\b/.test(t)) return null;
    t = t.replace(/[a-zäöüß]+/g, (w) => (NUMW[w] && w !== 'to' && w !== 'for' ? String(NUMW[w]) : w));
    const m = t.match(/(\d{1,2})\s*(?:bis|to|or|oder|till)?\s*(\d{1,2})?\s*(?:minutes?|mins?|minuten?)/);
    if (!m) return null;
    const a = parseInt(m[1], 10), b = m[2] ? parseInt(m[2], 10) : a;
    if (!(a > 0) || a > 90) return null;
    return [Math.min(a, b), Math.max(a, b)];
  }
  const SNOOZE_CUE = /\b(in|again|nochmal|wieder|später|remind|erinner\w*|frag\w*|ask)\b/i;
  async function snoozeCmd(text) {
    const d = parseDelay(text); if (!d || !SNOOZE_CUE.test(text)) return false;
    const ls = lists(); if (!ls.length) return false;
    let i = -1; const tt = tokz(text);
    ls.forEach((l, k) => { const nt = tokz(l.name).filter((w) => !STOPW.has(w)); if (nt.length && nt.every((w) => tt.some((x) => wordEq(x, w))) && (i < 0 || nt.length > tokz(ls[i].name).filter((w) => !STOPW.has(w)).length)) i = k; });
    if (i < 0 && (S.mode === 'ask' || S.mode === 'askAnyway' || S.mode === 'askNext' || (S.list != null && S.list >= 0 && S.mode === 'idle'))) i = S.list;
    if (i == null || i < 0 || !ls[i]) { await say(T().snoozeQ); return true; }
    const mins = Math.round(d[0] + Math.random() * (d[1] - d[0]));
    snoozeUntil[checklistKey() + '|' + i] = Date.now() + mins * 60000;
    for (const k of [...asked]) if (k.endsWith('|' + i)) asked.delete(k);
    clearTimeout(S.askT); S.mode = 'idle';
    await say(T().snooze(ls[i].name, mins));
    return true;
  }
  // ---------- Funk: „Frequenz 1.2.2 decimal 8.0.0 eindrehen“ → Standby, „switch to …“ → aktiv (COM1) ----------
  const FREQ_CMD = /\b(frequenc\w*|frequenz\w*|freq|stand\s?-?by|com\s?1|tune|dial\w*|eindreh\w*|switch\w*|swap|wechsel\w*|umschalt\w*)\b/i;
  const SWAP_CMD = /\b(switch\w*|swap|wechsel\w*|umschalt\w*|activate|aktivier\w*)\b/i;
  function freqOf(text) { // → Hz oder null
    let t = String(text).toLowerCase().replace(/\bcom\s?-?\s?[12]\b/g, ' ');
    t = t.replace(/\b(decimal|dezimal|point|komma|punkt|dot)\b/g, ' ~ ');
    t = t.replace(/[a-zäöüß]+/g, (w) => (Object.prototype.hasOwnProperty.call(DW, w) && !/^(ein|eine)$/.test(w) ? String(DW[w]) : w));
    let ip, fp = '';
    if (t.includes('~')) { // „… decimal …“: davor die Pistenzahl (letzte 3 Ziffern), danach der Bruchteil
      const parts = t.split('~'), pre = parts[0].replace(/\D/g, ''), post = parts.slice(1).join('').replace(/\D/g, '');
      if (pre.length >= 3) { ip = pre.slice(-3); fp = post; }
    }
    if (!ip) {
      const m = t.match(/(?<!\d)(1[123]\d)\s?[.,]\s?(\d{1,3})(?!\d)/);
      if (m) { ip = m[1]; fp = m[2]; } else {
        const d = t.replace(/\D/g, ''), k = d.search(/1[123]\d\d/);
        if (k >= 0) { ip = d.slice(k, k + 3); fp = d.slice(k + 3, k + 6); } else return null;
      }
    }
    if (!ip || ip.length !== 3) return null;
    fp = (String(fp || '') + '000').slice(0, 3);
    const hz = parseInt(ip, 10) * 1e6 + parseInt(fp, 10) * 1e3;
    return hz >= 118e6 && hz <= 136.99e6 ? hz : null;
  }
  const freqTxt = (hz) => (hz / 1e6).toFixed(3);
  const freqSay = (hz) => { const [a, b] = freqTxt(hz).split('.'); return spokenDigits(a) + ' decimal ' + spokenDigits(b.replace(/0+$/, '') || '0'); };
  const radioPost = (b) => fetch('/api/radio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json()).catch(() => ({ ok: false }));
  async function radioCmd(text) {
    const hz = freqOf(text), swap = SWAP_CMD.test(text);
    log('System', (pref.lang === 'de' ? 'Frequenz verstanden: ' : 'Frequency understood: ') + (hz ? freqTxt(hz) : '—'));
    if (!hz && !swap) return say(T().noFreq);
    const near = (a, b) => a != null && Math.abs(a - b) <= 500;
    // der Sim meldet COM nur einmal pro Sekunde: auf die Rückmeldung warten, statt sofort „nicht angenommen“ zu sagen
    const until = async (pred, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (pred(app.sim || {})) return true; await new Promise((r) => setTimeout(r, 250)); } return pred(app.sim || {}); };
    const shown = (v) => (v > 1e6 ? freqTxt(v) : '—');
    const mismatch = async (what) => { const s2 = app.sim || {}; log('System', `COM1 aktiv ${shown(s2.com1)}, Standby ${shown(s2.com1s)}`); return say(pref.lang === 'de' ? `${what} Das Funkgerät zeigt aber ${shown(s2.com1)} aktiv und ${shown(s2.com1s)} Standby. Bitte am Funkgerät prüfen.` : `${what} But the radio shows ${shown(s2.com1)} active and ${shown(s2.com1s)} standby. Please check the radio panel.`); };
    const sim0 = app.sim || {};
    if (hz && (!swap || !near(sim0.com1s, hz))) {
      const r = await radioPost({ action: 'standby', hz });
      if (!r.ok) { log('System', 'Funk: ' + (r.error || 'Sim hat den Befehl nicht angenommen (nicht verbunden?)')); return say(T().radioFail); }
      const ok = await until((x) => near(x.com1s, hz), 3500);
      if (!swap) return ok ? say(T().stby(freqSay(hz)), 'en') : mismatch(pref.lang === 'de' ? `Standby ${freqSay(hz)} gesendet.` : `Standby ${freqSay(hz)} sent.`);
      if (!ok) return mismatch(pref.lang === 'de' ? 'Standby gesendet, aber nicht übernommen.' : 'Standby sent, but not accepted.');
    }
    const r2 = await radioPost({ action: 'swap' }); if (!r2.ok) { log('System', 'Funk: ' + (r2.error || 'Umschalten nicht möglich')); return say(T().radioFail); }
    if (!hz) await new Promise((r) => setTimeout(r, 1300));
    const ok2 = await until((x) => (hz ? near(x.com1, hz) : true), 3500);
    const s = app.sim || {};
    if (hz && !ok2) return mismatch(pref.lang === 'de' ? 'Umschalten gesendet.' : 'Swap sent.');
    return say(T().act(hz ? freqSay(hz) : freqSay(s.com1 || 0)), 'en');
  }
  // ---------- Bodenpersonal (GSX): „Cockpit to ground, request boarding“ ----------
  const GROUND = /\b(ground|grounds|bodendienst\w*|bodenpersonal|bodencrew|gsx)\b/i;
  const REQ = /\b(request|approved?|cleared?|anfordern|bestell\w*|genehmigt|freigegeben)\b/i;
  const GSX_WORDS = [
    ['deboarding', /de-?\s?board|aussteig/i], ['boarding', /\bboarding|einsteig/i], ['catering', /cater/i],
    ['refueling', /refuel|fuel truck|fueling|betank|tanken/i], ['pushback', /(push|bush|pusch|poosh)\s?-?\s?(back|pack|beck|bag)|\bpush\b|zurückschieb/i],
    ['jetway', /jet\s?-?way|jet bridge|fluggastbr/i], ['stairs', /stair|treppe/i], ['gpu', /\bgpu\b|ground power|external power|bodenstrom|landstrom/i], ['chocks', /chock|bremskeil/i], ['enginestart', /(start|starting)\s+(up\s+)?(the\s+|my\s+|both\s+)?engines?|engines?\s+start|start-?\s?up|anlassen|triebwerk\w*\s+(an|start)/i], ['disconnect', /disconnect|abkoppel|abstecken|trennen/i],
    ['deice', /de-?\s?ic|enteis/i], ['followme', /follow\s?-?me/i], ['cleaning', /clean|reinig/i], ['lavatory', /lavator|toilet/i],
    ['water', /water service|wasserservice|wasser/i], ['crewbus', /crew\s?-?bus/i],
  ];
  const GS_LABEL = { deboarding: 'Deboarding', boarding: 'Boarding', catering: 'Catering', refueling: 'Refueling', pushback: 'Pushback', jetway: 'Jetway', stairs: 'Stairs', gpu: 'Ground power', chocks: 'Chocks', enginestart: 'Engine start', disconnect: 'Disconnect', deice: 'De-icing', followme: 'Follow me', cleaning: 'Cleaning', lavatory: 'Lavatory service', water: 'Water service', crewbus: 'Crew bus' };
  const GS_VAR = { boarding: 'boarding', deboarding: 'deboarding', catering: 'catering', refueling: 'refueling', pushback: 'departure' };
  const gsxAsked = new Set(), gsPrev = {};

  // NATO-Alphabet und Zahlwörter: „Sierra One“ → S1 (für Pushback-Profile wie S1, A12 …)
  const NATO = { alfa: 'A', alpha: 'A', bravo: 'B', charlie: 'C', delta: 'D', echo: 'E', foxtrot: 'F', golf: 'G', hotel: 'H', india: 'I', juliet: 'J', juliett: 'J', kilo: 'K', lima: 'L', mike: 'M', november: 'N', oscar: 'O', papa: 'P', quebec: 'Q', romeo: 'R', sierra: 'S', tango: 'T', uniform: 'U', victor: 'V', whiskey: 'W', whisky: 'W', xray: 'X', yankee: 'Y', zulu: 'Z' };
  const NATO_SAY = Object.fromEntries(Object.entries({ A: 'Alpha', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Foxtrot', G: 'Golf', H: 'Hotel', I: 'India', J: 'Juliett', K: 'Kilo', L: 'Lima', M: 'Mike', N: 'November', O: 'Oscar', P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango', U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'X-ray', Y: 'Yankee', Z: 'Zulu' }));
  const DIGW = { zero: 0, null: 0, one: 1, eins: 1, ein: 1, two: 2, zwei: 2, zwo: 2, three: 3, tree: 3, drei: 3, four: 4, fower: 4, vier: 4, five: 5, fife: 5, fünf: 5, fuenf: 5, six: 6, sechs: 6, seven: 7, sieben: 7, eight: 8, acht: 8, nine: 9, niner: 9, neun: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, zehn: 10, elf: 11, zwölf: 12 };
  // liefert die Codes (z. B. ['S1']) aus einem Satz
  function codesOf(text) {
    const toks = String(text).replace(/\b([A-Za-z])-(\d{1,3})\b/g, (m, l, d) => l.toUpperCase() + d).split(/[\s,.;:!?]+/).filter(Boolean);
    const out = []; let cur = '';
    const flush = () => { if (cur) out.push(cur); cur = ''; };
    for (const t of toks) {
      const low = t.toLowerCase();
      if (NATO[low]) { if (/\d/.test(cur)) flush(); cur += NATO[low]; }
      else if (cur && /[A-Z]\d*[23]0$/.test(cur) && DIGW[low] >= 1 && DIGW[low] <= 9) cur = cur.slice(0, -1) + DIGW[low];
      else if (cur && Object.prototype.hasOwnProperty.call(DIGW, low)) cur += DIGW[low];
      else if (cur && /^\d{1,3}$/.test(t) && !/\d/.test(cur.replace(/[A-Z]/g, ''))) cur += t;
      else if (/^[A-Za-z]{1,3}\d{1,3}$/.test(t)) { flush(); out.push(t.toUpperCase()); }
      else flush();
    }
    flush();
    return out;
  }
  const spoken = (code) => String(code).split('').map((c) => (/\d/.test(c) ? ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'niner'][+c] : NATO_SAY[c] || c)).join(' ');
  // Himmelsrichtung („facing south“, „Richtung Nord“) – Einträge in GSX-Profilen heißen oft „… facing north“
  const DIRS = { north: /\b(north|nord|norden)\b/i, south: /\b(south|süd|sued|süden)\b/i, east: /\b(east|ost|osten)\b/i, west: /\b(west|westen)\b/i };
  const dirOf = (t) => Object.keys(DIRS).find((k) => DIRS[k].test(t)) || null;
  // GSX-Einträge zuordnen (z. B. „Release Point R2“, „LFRN_C3-28“, „FACING WEST (Taxiway A)“):
  // gesprochene Teile werden wie die Tokens des Eintrags zusammengesetzt („Charlie Three Two Eight“ = C328)
  const GENERIC = new Set(['RELEASE', 'POINT', 'PUSHBACK', 'PUSH', 'BACK', 'TO', 'FACING', 'TAXIWAY', 'MANUAL', 'STOP', 'MAX', 'M', 'AT', 'THE', 'POSITION', 'NORTH', 'SOUTH', 'EAST', 'WEST', 'NORD', 'NORDEN', 'OST', 'OSTEN', 'SÜD', 'SÜDEN', 'SUED']);
  const COMMON = new Set([...GENERIC, 'COCKPIT', 'GROUND', 'APPROVED', 'APPROVE', 'REQUEST', 'CLEARED', 'CLEAR', 'PLEASE', 'GSX', 'BODENPERSONAL', 'ANFORDERN', 'DIRECTION', 'RICHTUNG', 'AND', 'FOR', 'UND', 'BITTE', 'FREIGEGEBEN', 'GENEHMIGT', 'THANKS', 'THANK', 'YOU', 'ON', 'GATE', 'STAND', 'WE', 'NEED', 'WOULD', 'LIKE', 'CAN', 'COULD', 'ME', 'US', 'NOW', 'READY', 'WANT', 'BUSHBACK', 'PUSHPACK', 'PUSCH', 'WIR', 'BRAUCHEN', 'UNS', 'MÖCHTEN', 'MOECHTEN', 'EIN', 'EINEN', 'EINE', 'JETZT', 'ICH', 'HELLO', 'HALLO', 'HI']);
  function utTokens(text) {
    const raw = String(text).toUpperCase().replace(/[^A-Z0-9ÄÖÜ]+/g, ' ').trim().split(' ').filter(Boolean);
    const out = [];
    for (let k = 0; k < raw.length; k++) {
      const w = raw[k], low = w.toLowerCase();
      if (NATO[low]) { out.push(NATO[low]); continue; }
      if (Object.prototype.hasOwnProperty.call(DIGW, low)) {
        let v = DIGW[low]; const nx = DIGW[(raw[k + 1] || '').toLowerCase()];
        if (v >= 20 && nx >= 1 && nx <= 9) { v += nx; k++; }
        out.push(String(v)); continue;
      }
      if (w.length === 1 && /[A-Z]/.test(w)) continue; // „a“, „I“ …
      out.push(w);
    }
    return out;
  }
  const itemTok = (it) => String(it).toUpperCase().split(/[^A-Z0-9ÄÖÜ]+/).filter((t) => t && !GENERIC.has(t));
  function windows(toks, max) { const o = new Set(); for (let i = 0; i < toks.length; i++) { let c = ''; for (let j = i; j < toks.length && j < i + (max || 5); j++) { c += toks[j]; o.add(c); } } return o; }
  const hasSpecific = (text) => utTokens(text).some((t) => !COMMON.has(t));
  const anyDir = (it) => Object.keys(DIRS).some((k) => DIRS[k].test(it));
  function pickIdx(items, text, dir) {
    const U = windows(utTokens(text), 12);
    const sc = items.map((it, i) => { let best = 0, key = ''; for (const w of windows(itemTok(it))) if (w.length >= 2 && U.has(w) && w.length > best) { best = w.length; key = w; } return { i, best, key, d: dir ? DIRS[dir].test(it) : null, hasDir: anyDir(it) }; });
    const hits = sc.filter((x) => x.best > 0);
    if (hits.length) {
      const max = Math.max(...hits.map((x) => x.best)); let top = hits.filter((x) => x.best === max);
      if (dir) { const wd = top.filter((x) => x.d); if (wd.length) top = wd; else { top = top.filter((x) => !x.hasDir); if (!top.length) return { i: -1 }; } }
      if (top.length === 1) return { i: top[0].i, both: !!dir && !!top[0].d, key: top[0].key };
      return { i: -1, ties: top.map((x) => x.i) };
    }
    if (dir) { const d = sc.filter((x) => x.d); if (d.length === 1) return { i: d[0].i, both: true, key: '' }; if (d.length > 1) return { i: -1, ties: d.map((x) => x.i) }; }
    return { i: -1 };
  }
  // GSX-Pushback-Einträge: „Nose Left/Tail Right (Left)“, „Straight pushback (manual stop, max 100 m)“, „Straight Pull …“
  function pushItem(it) {
    const t = String(it).toLowerCase();
    return { nose: (t.match(/nose\s*(left|right)/) || [])[1] || null, tail: (t.match(/tail\s*(left|right)/) || [])[1] || null, turn: (t.match(/\((left|right)\)/) || [])[1] || null, straight: /straight/.test(t), pull: /\bpull/.test(t) };
  }
  const isPushMenu = (items) => (items || []).some((x) => { const i = pushItem(x); return i.nose || i.tail || i.straight; });
  // sinngemäß zuordnen: „nose left“, „tail right“, „left“ (= Drehrichtung in Klammern), „straight“, „straight pull“; Verhörer wie „tile“ (tail), „no“ (nose)
  function pushSem(text, items) {
    if (!isPushMenu(items)) return null;
    const info = items.map(pushItem);
    let t = ' ' + String(text).toLowerCase().replace(/[^a-zäöüß\s]/g, ' ') + ' ';
    t = t.replace(/\b(tile|tale|teil|till|tell|tails)\b/g, ' tail ').replace(/\b(no|nos|nows|nose's|knows|know|nurse)\s+(?=(straight|left|right|links|rechts)\b)/g, ' nose ').replace(/\blinks\b/g, 'left').replace(/\brechts\b/g, 'right');
    const side = (w) => { const m = t.match(new RegExp('\\b' + w + '\\s+(left|right)\\b')); return m ? m[1] : null; };
    const wn = side('nose'), wt = side('tail'), straight = /\bstraight\b/.test(t), pull = /\bpull\b/.test(t);
    const lr = t.match(/\b(left|right)\b/g) || [];
    let c = info.map((_, i) => i);
    if (wn) c = c.filter((i) => info[i].nose === wn);
    else if (wt) c = c.filter((i) => info[i].tail === wt);
    else if (straight) { c = c.filter((i) => info[i].straight); const p = c.filter((i) => info[i].pull === pull); if (p.length) c = p; }
    else if (lr.length) { const want = lr[lr.length - 1]; c = c.filter((i) => info[i].turn === want || (!info[i].turn && info[i].nose === want)); }
    else return null;
    return c.length === 1 ? { i: c[0] } : c.length ? { i: -1, ties: c } : { i: -1, none: true };
  }
  const itemSpoken = (it) => { const pi = pushItem(it); if (pi.nose && pi.tail && String(it).length < 48) return 'nose ' + pi.nose + ', tail ' + pi.tail + (pi.turn ? ', turning ' + pi.turn : ''); return String(it).replace(/[_()]/g, ' ').replace(/\//g, ', ').replace(/(\d)-(\d)/g, '$1 $2').replace(/\s+/g, ' ').trim(); };
  // Sound-Namen für einen gewählten Eintrag (längste Übereinstimmung zuerst, mit Richtung zuerst)
  function soundKeys(svc, item, dir) {
    const ws = [...windows(itemTok(item))].filter((w) => w.length >= 2).sort((a, b) => b.length - a.length);
    const ks = [];
    if (dir) ws.forEach((w) => ks.push(svc + '.ack.' + w + '.' + dir));
    ws.forEach((w) => ks.push(svc + '.ack.' + w));
    if (dir) ks.push(svc + '.ack.' + dir);
    return ks;
  }

  // eigene Sounds (sounds/<ereignis>.mp3): ersetzen die Computerstimme des Bodenpersonals
  const sounds = new Map();
  const loadSounds = () => fetch('/api/sounds').then((r) => r.json()).then((l) => { sounds.clear(); (l || []).forEach((x) => sounds.set(x.key.toLowerCase(), x.file)); }).catch(() => {});

  // Ground wird nur angesprochen, wenn „Cockpit“ und „Ground“ im selben Satz vorkommen – sonst hört der Copilot
  // Whisper hört „Cockpit to ground“ oft als „cockpots of ground“, „cock pit two ground“ …
  const addressed = (t) => /\b(?:cock|kok|cop)\s?-?\s?p\w{0,5}\b[\s\S]{0,18}?\b(?:ground|grounds|bodendienst\w*|bodenpersonal|bodencrew|gsx)\b/i.test(t);
  // Offenes GSX-Richtungsmenü (frisch, Pushback kürzlich angefordert)?
  function livePush() {
    const m = app.sim && app.sim.gsxInfo && app.sim.gsxInfo.menu;
    if (!m || !m.items || !m.items.length || !(m.age < 120) || !isPushMenu(m.items)) return null;
    if (S.pushAt && Date.now() - S.pushAt > 5 * 60000) return null;
    return m;
  }
  function gsxCmd(text) {
    if (!addressed(text)) return null;
    const hit = GSX_WORDS.find(([, re]) => re.test(text));
    if (hit) return hit[0];
    if (HELLO.test(text)) return 'hello';
    return (S.mode === 'gsxMenu' || livePush()) ? null : 'unknown'; // an Ground gerichtet, aber Dienst nicht verstanden → nicht an die Checkliste weiterreichen
  }
  // Standplatz aus dem GSX-Menütitel („GSX – Leipzig/Halle Stand 12“, „Gate B27“ …)
  function standOf(title) {
    const m = String(title || '').match(/\b(stand|gate|parking(?: position)?|position|apron|pos\.?)\s*([A-Z]{0,2}\s?\d{1,3}[A-Z]?)\b/i);
    return m ? m[1].toLowerCase().replace('pos.', 'position') + ' ' + m[2].replace(/\s+/g, '') : '';
  }
  // Häufige Ground-Sätze mit Kokoro vorab berechnen (im Hintergrund, nur am Boden), damit sie ohne Wartezeit kommen
  const WARM = ['Ground to Cockpit,', 'Ground, hello,', 'Go ahead.', 'Roger.', 'Say again, which service do you need?', 'Which direction do you want?', 'Confirm doors closed and bridge retracted.', 'Tug is on its way.', 'Release the parking brake when ready.', 'Brakes released, starting pushback.', 'Pushback complete, set parking brake.', 'Cleared to start engines, call me when both engines are stable.', 'Roger, disconnecting. Standing by for hand signals on your left.', 'Disconnect complete, you are clear on the left. Have a good flight!', 'Ground power connected, external power available.', 'Ground power disconnected.', 'Chocks are in place.', 'Chocks removed.', 'Boarding complete, doors are being closed.', 'Refueling complete, fuel truck is leaving.', 'Welcome. Chocks are in place, ground power is available on request.', 'Boarding requested.', 'Catering requested.', 'Refueling requested.', 'Negative, set parking brake first.'];
  let warmKey = '';
  async function prewarm() {
    if (!HOST) return; const id = groundVoice(); if (!id || !id.startsWith('kokoro-')) return;
    const key = id + '|' + pref.rate; if (warmKey === key) return; warmKey = key;
    for (const t of WARM) {
      for (let i = 0; i < 400; i++) { const sm = app.sim || {}; if (!S.speaking && !(sm.connected && !sm.onGround) && warmKey === key) break; await wait(1500); }
      if (warmKey !== key) return;
      await fetch(piperUrl(id, t)).then((r) => r.arrayBuffer()).catch(() => {});
      await wait(400);
    }
  }
  setInterval(() => { try { if (piper.available) prewarm(); } catch (e) { /* weiter */ } }, 30000);
  function groundVoice() {
    if (!piper.available) return null;
    const w = pref.voice && pref.voice.ground;
    if (w && w.startsWith('piper:') && piper.voices.some((v) => v.id === w.slice(6))) return w.slice(6);
    const mine = piperFor('en'), en = piper.voices.filter((v) => v.lang === 'en');
    const BEST = ['kokoro-am_michael', 'kokoro-bm_lewis', 'kokoro-am_adam', 'en_US-ryan-high', 'en_GB-cori-high', 'en_US-hfc_male-medium', 'en_US-joe-medium', 'en_US-john-medium', 'en_US-norman-medium', 'en_US-ryan-medium'];
    for (const id of BEST) if (id !== mine && en.some((v) => v.id === id)) return id;
    return (en.find((v) => v.id !== mine) || en[0] || {}).id || null;
  }
  // keys: Sound-Namen in der Reihenfolge, in der nach einer eigenen Datei gesucht wird
  const HELLO = /\b(hello|hallo|hi|hey|good\s+(morning|afternoon|evening|day)|guten\s+(morgen|tag|abend)|moin|servus)\b/i;
  let helloAt = 0;
  const lc = (x) => x.charAt(0).toLowerCase() + x.slice(1);
  // o.call: Ground meldet sich von selbst → „Ground to Cockpit, …“. Sonst Antwort; hat der Pilot gegrüßt, grüßt Ground einmal zurück.
  function groundLine(t, keys, o) {
    const f = (keys || []).map((k) => sounds.get(String(k).toLowerCase())).find(Boolean);
    const A = window.Ambience;
    if (!f) {
      if (o && o.call) t = 'Ground to Cockpit, ' + lc(t);
      else if (Date.now() - helloAt < 25000) { helloAt = 0; t = 'Ground, hello, ' + lc(t); }
    }
    if (A && HOST) { try { A.radioOn(); A.maybe(); } catch (e) {} }
    return say(t, 'en', f ? { url: '/sounds/' + encodeURIComponent(f), who: 'Ground' } : { voiceId: groundVoice(), pitch: 0.7, who: 'Ground' }).finally(() => { if (A && HOST) { try { A.radioOff(); } catch (e) {} } });
  }
  const lifeOn = (k) => !!(pref.life && pref.life[k] === true);
  // Von „request pushback“ bis zum Ende des Pushbacks redet GSX selbst; unsere Zwischenrufe würden sich mit seinem Ablauf überschneiden
  const pushBusy = () => !!S.pushAt && !S.pushOver && Date.now() - S.pushAt < 25 * 60000;
  const call = (t, keys) => (pushBusy() && !lifeOn('groundPush') ? Promise.resolve() : groundLine(t, keys, { call: true }));
  // GSX trennt nach dem Laden die Bodenstrom-Anlage des Fliegers: vorher ist der Zustand nicht verlässlich
  const gx = { since: 0 };
  function gsxReady() {
    const s = app.sim || {}, info = s.gsxInfo || {};
    if (!info.menuFile || info.menuFile === '(Demo)') return true; // GSX nicht vorhanden
    if (!((s.gsx || {}).couatl > 0)) { gx.since = 0; return false; }
    gx.since = gx.since || Date.now();
    return Date.now() - gx.since > 25000;
  }
  const efbAct = (action) => fetch('/api/efb/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) }).then((x) => x.json()).catch(() => ({ ok: false }));
  const gnd = () => ((app.sim || {}).efb || {}).ground || {};
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // Dienste, die Ground selbst erledigt (ohne GSX): Bodenstrom, Bremsklötze, Triebwerksstart-Freigabe, Abkoppeln
  async function localDo(key, text) {
    const off = /(disconnect|remove|\boff\b|unplug|weg|trenn|ab\b)/i.test(text);
    if (key === 'gpu' || key === 'chocks') {
      if (!gsxReady()) return groundLine('Stand by, ground services are still starting up.', ['again']);
      const name = key === 'gpu' ? 'Ground power' : 'Chocks';
      const wantOn = key === 'gpu' ? !off : !(off || /\b(remove|removed|out|take|entfern\w*)\b/i.test(text));
      const cur = gnd()[key];
      if (cur === wantOn) return groundLine(name + ' ' + (key === 'gpu' ? (wantOn ? 'is already connected' : 'is already disconnected') : (wantOn ? 'are already in place' : 'are already removed')) + '.', [key + '.already', 'ack']);
      const r = await efbAct(key);
      if (!r.ok) { const g = await fetch('/api/gsx/service', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ service: key }) }).then((x) => x.json()).catch(() => ({ ok: false })); if (!g.ok) return groundLine('Negative. ' + name + ' is not available at this stand.', [key + '.negative', 'negative']); }
      let now = gnd()[key];
      for (let i = 0; i < 10 && now !== wantOn; i++) { await wait(500); now = gnd()[key]; } // Status des EFB kommt verzögert
      // nur bestätigen, was der Sim wirklich meldet – unbekannter oder falscher Zustand wird nicht als „verbunden“ ausgegeben
      if (now !== wantOn) return groundLine(name + ' requested, but I cannot confirm it' + (now == null ? ', I get no status from this aircraft' : '') + '. Please check the panel.', ['again']);
      const txt = key === 'gpu' ? (wantOn ? 'Ground power connected, external power available.' : 'Ground power disconnected.') : (wantOn ? 'Chocks are in place.' : 'Chocks removed.');
      return groundLine(txt, [key + (wantOn ? '.on' : '.off'), key + '.ack', 'ack']);
    }
    if (key === 'enginestart') return engineClear(true);
    if (key === 'disconnect') return disconnectNow(true);
  }
  // Freigabe zum Triebwerksstart
  async function engineClear(asked) {
    const s = app.sim || {}, g = gnd();
    if (g.enginesRunning) return groundLine('Engines are already running.', ['ack']);
    if (g.pushback) return groundLine('Negative, pushback is not complete yet. Stand by.', ['negative']);
    if (brk() === false) return groundLine('Negative, set parking brake first.', ['negative']);
    S.engCleared = Date.now();
    return groundLine('Cleared to start engines, ' + (asked ? 'call me when stable.' : 'call me when both engines are stable.'), ['enginestart.ack', 'enginestart', 'ack'], asked ? undefined : { call: true });
  }
  // Abkoppeln nach dem Triebwerksstart: Bodenstrom weg, Handzeichen
  let discBusy = false;
  async function disconnectNow(asked) {
    if (discBusy) return; discBusy = true;
    try {
      const g = gnd();
      if (!g.enginesRunning && asked) { discBusy = false; return groundLine('Negative, engines are not running yet.', ['negative']); }
      const o = asked ? undefined : { call: true };
      await groundLine('Roger, disconnecting. Standing by for hand signals on your left.', ['disconnect.ack', 'ack'], o);
      if (g.gpu) { await efbAct('gpu'); }
      await wait(3500);
      S.discDone = Date.now();
      await groundLine('Disconnect complete, you are clear on the left. Have a good flight!', ['disconnect.done', 'done'], { call: true });
    } finally { discBusy = false; }
  }
  const chooseGsx = (index) => fetch('/api/gsx/choose', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ index }) }).catch(() => {});
  async function groundDo(key, text, dir) {
    if (HELLO.test(text)) helloAt = Date.now();
    if (key === 'hello') return groundLine('go ahead.', ['hello', 'ack']);
    if (key === 'unknown') return groundLine('Say again, which service do you need?', ['again']);
    if (key === 'gpu' || key === 'chocks' || key === 'enginestart' || key === 'disconnect') return localDo(key, text);
    const r = await fetch('/api/gsx/service', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ service: key }) }).then((x) => x.json()).catch(() => ({ ok: false, error: 'PC-Brücke nicht erreichbar.' }));
    if (!r.ok) { log('System', r.error || 'GSX-Fehler'); return groundLine('Negative. ' + GS_LABEL[key] + ' is not available right now.', [key + '.negative', 'negative']); }
    gsxAsked.add(key);
    if (key === 'pushback') { S.pushAt = Date.now(); S.pushOver = false; }
    if (r.menu) log('System', 'GSX-Menü: ' + r.menu.title + ' | ' + (r.menu.items || []).join(' | '));
    const m = r.menu && r.menu.items && r.menu.items.length ? r.menu : null;
    const sem = key === 'pushback' && m ? pushSem(text, m.items) : null;
    const spec = key === 'pushback' && !!m && (!!sem || !!dir || hasSpecific(text));
    const pk = sem ? (sem.i >= 0 ? { i: sem.i, both: true } : { i: -1, ties: sem.ties, none: sem.none }) : spec ? pickIdx(m.items, text, dir) : { i: -1 };
    if (spec && pk.i < 0) {
      if (pk.ties) { await groundLine('Which one?', ['again']); return groundMenu(m, false, undefined, ' '); }
      if (dir || pk.none) { await groundLine('Negative. That pushback position is not available.', [key + '.negative', 'negative']); return groundMenu(m); }
    }
    const stand = standOf(r.stand);
    const it = pk.i >= 0 ? m.items[pk.i] : '';
    const dtxt = dir && !pk.both ? ', facing ' + dir : '';
    if (key === 'pushback') {
      S.pushStand = stand;
      const head = 'Roger, pushback' + (stand ? ' from ' + stand : '') + (it ? ', ' + itemSpoken(it) + dtxt : '') + '.';
      if (it) {
        await groundLine(head, [...soundKeys(key, it, dir), key + '.ack', 'ack']);
      } else {
        await groundLine(head + ' Confirm doors closed and ' + 'bridge retracted.', [key + '.ack', 'ack']);
        if (m) return groundMenu(m, false, undefined, 'Which direction do you want?'); // fragt die Richtung ab
      }
    } else {
      await groundLine(GS_LABEL[key] + ' requested' + (it ? ', ' + itemSpoken(it) : '') + dtxt + '.', [...(it ? soundKeys(key, it, dir) : []), key + '.ack', 'ack']);
    }
    S.wantDir = dir && pk.i >= 0 && !pk.both ? dir : null;
    if (pk.i >= 0) return afterChoose(m.title, pk.i);
    if (m) return groundMenu(m, true);
  }
  async function groundMenu(m, quiet, only, intro) {
    S.afterGsx = S.mode === 'run' ? 'run' : S.afterGsx; S.mode = 'gsxMenu'; S.gsxItems = m.items; S.gsxTitle = m.title; armAsk(45000);
    if (quiet && only) return; // Auswahl wurde schon vorgelesen
    const opts = m.items.map((t, i) => [i, t]).filter(([i]) => !only || only.includes(i)).map(([i, t]) => (i + 1) + ', ' + itemSpoken(t)).join('. ');
    return groundLine((intro || m.title) + ' ' + opts + '.', []);
  }
  // Auswahl senden; stellt GSX danach noch eine Frage, wird sie vorgelesen
  async function afterChoose(prevTitle, idx, items) {
    const back = async () => { if (S.afterGsx === 'run') { S.afterGsx = null; S.mode = 'run'; await challenge(); } else S.mode = 'idle'; };
    S.mode = 'idle';
    await chooseGsx(idx);
    await new Promise((r) => setTimeout(r, 900));
    const m = app.sim && app.sim.gsxInfo && app.sim.gsxInfo.menu; // GSX fragt eventuell nach
    if (m && m.age < 5 && m.items && m.items.length && m.title !== prevTitle) {
      if (S.wantDir) { const d = S.wantDir; S.wantDir = null; const k = pickIdx(m.items, null, d); if (k.i >= 0) return afterChoose(m.title, k.i); }
      return groundMenu(m);
    }
    S.wantDir = null;
    return back();
  }
  async function groundPick(text) {
    const back = async () => { if (S.afterGsx === 'run') { S.afterGsx = null; S.mode = 'run'; await challenge(); } else S.mode = 'idle'; };
    if (STOP.test(text) || /\b(cancel|never ?mind|vergiss)\b/i.test(text)) { await groundLine('Roger, cancelled.', ['ack']); return back(); }
    const items = S.gsxItems || [];
    let idx = -1;
    const dr = dirOf(text);
    const sem = pushSem(text, items);
    if (sem) {
      if (sem.i >= 0) idx = sem.i;
      else { await groundLine(sem.none ? 'Negative, that one is not available. Your options:' : 'Which one?', ['again']); return groundMenu({ items, title: S.gsxTitle }, false, undefined, ' '); }
    } else if (hasSpecific(text) || dr) { const k = pickIdx(items, text, dr); idx = k.i; S.wantDir = dr && idx >= 0 && !k.both ? dr : null; if (k.ties) { await groundLine('Which one?', ['again']); return groundMenu({ items, title: S.gsxTitle }, false, undefined, ' '); } }
    if (idx < 0) {
      const N = nums(text).filter((n) => n >= 1 && n <= items.length);
      const ORD = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, erste: 1, erster: 1, zweite: 2, zweiter: 2, dritte: 3, dritter: 3, vierte: 4, fünfte: 5 };
      const ow = tokz(text).map((w) => ORD[w]).find(Boolean);
      if (ow && ow <= items.length) idx = ow - 1; else if (N.length) idx = N[0] - 1;
    }
    if (idx < 0) {
      const tt = tokz(text).filter((w) => w.length > 2); let best = 0;
      items.forEach((it, i) => { const sc = tokz(it).filter((w) => w.length > 2 && tt.some((x) => wordEq(x, w))).length; if (sc > best) { best = sc; idx = i; } });
    }
    if (idx < 0) return groundLine('Say again.', ['again']);
    await groundLine('Roger, ' + (/push/i.test(S.gsxTitle || '') ? 'pushback ' : '') + itemSpoken(items[idx]).replace(/^facing /i, 'facing ') + '.', ['ack']);
    return afterChoose(S.gsxTitle, idx);
  }
  // Pushback beginnt: Schlepper angeschlossen → Bremse lösen lassen, dann Beginn melden
  let pushRun = false;
  async function pushStart() {
    if (pushRun) return; pushRun = true;
    try {
      await call('Tug is connected' + (S.pushStand ? ' at ' + S.pushStand : '') + ', release the parking brake when ready.', ['pushback.connected']);
      if (brk() !== null) for (let i = 0; i < 80 && brk() !== false; i++) await wait(500);
      if (brk() === false) await call('Brakes released, starting pushback.', ['pushback.start']);
    } finally { pushRun = false; }
  }
  function gsxWatch() {
    gsxReady();
    if (!S.on) return;
    const g = (app.sim && app.sim.gsx) || {};
    for (const [svc, v] of Object.entries(GS_VAR)) {
      const st = Math.round(g[v] || 0), prev = gsPrev[svc];
      if (prev === undefined) { gsPrev[svc] = st; continue; }
      if (prev === st) continue;
      if (S.speaking) return; // später nochmal
      gsPrev[svc] = st;
      if (!gsxAsked.has(svc)) continue;
      if (svc === 'pushback' && st === 4) call('Tug is on its way.', ['pushback.tug']);
      if (svc === 'pushback' && st === 5) { if (lifeOn('groundPush')) pushStart(); }
      else if (st === 5) call(GS_LABEL[svc] + ' in progress.', [svc + '.progress']);
      if (st === 6) {
        gsxAsked.delete(svc);
        if (svc === 'pushback') { const quiet = pushBusy() && !lifeOn('groundPush'); S.pushDone = Date.now(); S.pushOver = true; if (!quiet) call('Pushback complete, set parking brake.', ['pushback.done']); }
        else if (svc === 'boarding') call('Boarding complete, doors are being closed.', ['boarding.done']);
        else if (svc === 'refueling') call('Refueling complete, fuel truck is leaving.', ['refueling.done']);
        else call(GS_LABEL[svc] + ' complete.', [svc + '.done']);
      }
    }
  }

  // „let's do the cockpit preparation checklist“ / „starte die Before Start Checkliste“ / „next checklist“
  const STOPW = new Set(['checklist', 'checkliste', 'list', 'liste', 'the', 'die', 'der', 'das', 'und', 'and', 'of', 'to', 'a']);
  const tokz = (x) => norm(x).replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/[\s-]+/).filter(Boolean);
  // Ähnliches gilt als gleich: gleiche ersten 4 Buchstaben oder kleiner Tippfehler-/Verhör-Abstand
  function lev(a, b, max) { // Damerau-Levenshtein (Buchstabendreher zählen als 1)
    if (Math.abs(a.length - b.length) > max) return max + 1;
    const d = [];
    for (let i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
      let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2][j - 2] + 1);
      d[i][j] = v;
    }
    return d[a.length][b.length];
  }
  const tol = (n) => (n >= 8 ? 2 : n >= 5 ? 1 : 0);
  const wordEq = (a, b) => a === b || (a.length > 3 && b.length > 3 && a.slice(0, 4) === b.slice(0, 4)) || (Math.min(a.length, b.length) >= 5 && lev(a, b, tol(Math.min(a.length, b.length))) <= tol(Math.min(a.length, b.length)));
  // Befehlswörter: Verhörer/Tippfehler im Satz werden auf das nächstliegende Befehlswort gesetzt (nur ab 5 Buchstaben, sonst zu riskant)
  const CMD_VOCAB = ['checklist', 'checkliste', 'checked', 'confirmed', 'affirmative', 'affirm', 'negative', 'cancel', 'abort', 'repeat', 'again', 'skip', 'later', 'please', 'standby', 'stand', 'frequency', 'frequenz', 'runway', 'startbahn', 'parking', 'parkbremse', 'brake', 'released', 'release', 'pushback', 'boarding', 'deboarding', 'catering', 'refueling', 'refuel', 'fueling', 'disconnect', 'connect', 'external', 'power', 'chocks', 'engine', 'engines', 'start', 'minutes', 'minuten', 'remind', 'erinnere', 'nochmal', 'wiederholen', 'überspringen', 'abbrechen', 'später', 'bitte', 'gesetzt', 'gelöst', 'weiter', 'descent', 'approach', 'landing', 'takeoff', 'taxi', 'before', 'after', 'cockpit', 'preparation', 'straight', 'left', 'right', 'ground', 'nose', 'tail'];
  const SAFE = new Set(['around', 'found', 'round', 'sound', 'ground', 'rights', 'lefts', 'start', 'stars', 'power', 'tower', 'lower', 'rather', 'later', 'water', 'taxi', 'taxis', 'light', 'right', 'might', 'night', 'flight', 'again', 'agent', 'brake', 'break', 'brave', 'check', 'chuck', 'chunk', 'state', 'stats', 'stage', 'speed', 'spend', 'spent', 'flaps', 'flags', 'clear', 'cleared', 'clean', 'close', 'closed', 'cloud', 'gear', 'gears', 'heading', 'headings']);
  function fuzzyFix(text) {
    const vocab = new Set(CMD_VOCAB); try { for (const l of lists()) for (const w of tokz(l.name)) if (w.length >= 5) vocab.add(w); } catch (e) { /* weiter */ }
    const V = [...vocab];
    return String(text).replace(/[A-Za-zÄÖÜäöüß]{5,}/g, (w) => {
      const lw = w.toLowerCase(); if (vocab.has(lw) || SAFE.has(lw)) return w;
      const t = tol(lw.length); let best = null, bd = t + 1;
      for (const v of V) { if (Math.abs(v.length - lw.length) > t) continue; const d = lev(lw, v, t); if (d < bd) { bd = d; best = v; } }
      return best && bd <= t ? best : w;
    });
  }
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
    const auto = autoResp(it); if (auto) await say(auto, itemLang());
  }
  // „AS RQRD“-Punkte beantwortet der Copilot selbst (du bestätigst nur mit „checked“)
  function autoResp(it) {
    const de = itemLang() === 'de';
    if (/^packs?(\s*\/\s*bleed)?$/i.test(String(it.item).trim())) {
      if (pref.packsOff) return de ? 'Aus, wegen der Performance.' : 'Off, as required for performance.';
      return de ? 'Ein, nach Bedarf.' : 'On, as required.';
    }
    return '';
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
  function armAsk(ms) { clearTimeout(S.askT); S.askT = setTimeout(() => { if (S.mode.startsWith('ask') || S.mode === 'gsxMenu') S.mode = 'idle'; }, ms || 30000); }

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

  // Die erste Erinnerung an die Cockpit-Vorbereitung kommt erst 5–10 Minuten nach dem Anschluss der Bodenstromversorgung (GPU).
  // Ist keine GPU-Information vorhanden oder wird keine angeschlossen, kommt sie nach 15 Minuten.
  const prep = { gpuAt: 0, since: 0, wait: (5 + Math.random() * 5) * 60000 };
  function prepDue() {
    const now = Date.now(), g = ((app.sim || {}).efb || {}).ground;
    if (!prep.since) prep.since = now;
    if (g && g.gpu && !prep.gpuAt) prep.gpuAt = now;
    if (prep.gpuAt) return now - prep.gpuAt >= prep.wait;
    return now - prep.since >= 15 * 60000;
  }
  // Erinnerung: fällige Checkliste anbieten – aber erst, wenn der Ablauf wirklich so weit ist (nicht schon beim Phasenwechsel)
  const clDoneAt = {}, ph0 = { ph: null, at: 0 }, eng0 = { on: false, at: 0 }, air0 = { on: false, at: 0 };
  function trackProgress() {
    const now = Date.now(), ls = lists(), key = checklistKey();
    ls.forEach((_, i) => { const k = key + '|' + i; if (isDone(i)) { if (!clDoneAt[k]) clDoneAt[k] = now; } else delete clDoneAt[k]; });
    const s = app.sim || {}, g = (s.efb || {}).ground;
    const er = !!(g && g.enginesRunning); if (er !== eng0.on) { eng0.on = er; eng0.at = now; }
    const ar = !s.onGround && s.connected; if (ar !== air0.on) { air0.on = ar; air0.at = now; }
    const ph = phase(); if (ph !== ph0.ph) { ph0.ph = ph; ph0.at = now; }
  }
  function ready(i, ph) { // true = jetzt anbieten
    const now = Date.now(), name = lists()[i].name, s = app.sim || {}, g = (s.efb || {}).ground, key = checklistKey();
    if (now - ph0.at < 20000) return false; // Phase muss kurz stabil sein
    if ((snoozeUntil[key + '|' + i] || 0) > now) return false; // von dir vertagt
    let prev = 0; for (let k = 0; k < i; k++) { const d = clDoneAt[key + '|' + k]; if (d) prev = Math.max(prev, d); }
    const since = (ms) => !prev || now - prev >= ms;
    const gx = s.gsx || {}, busy = ['boarding', 'refueling', 'catering', 'deboarding'].some((v) => { const st = Math.round(gx[v] || 0); return st === 4 || st === 5; });
    if (/before start/i.test(name)) return !busy && !pushBusy() && (prev ? now - prev >= 60000 : now - prep.since >= 180000);
    if (/after start/i.test(name)) { if (!g) return since(20000); return !!g.enginesRunning && now - eng0.at >= 40000 && !g.pushback && !pushBusy() && since(15000); }
    if (/before taxi|^taxi/i.test(name)) return ph === 'out' && now - ph0.at >= 25000 && since(20000);
    if (/line-?up|before takeoff/i.test(name)) return ph === 'out' && now - ph0.at >= 60000 && since(45000);
    if (/after takeoff/i.test(name)) return !s.onGround && now - air0.at >= 90000 && (s.vs || 0) > -200 && (s.alt || 0) > 2500;
    if (/descent|approach/i.test(name)) return now - ph0.at >= 10000;
    if (/after landing/i.test(name)) return now - ph0.at >= 25000 && (s.gs || 0) < 30;
    if (/parking|shutdown|secur/i.test(name)) return now - ph0.at >= 30000 && since(15000);
    return true;
  }
  function watch() {
    if (!S.on || muted) return;
    gsxWatch();
    const ph = phase(); if (!ph) return;
    trackProgress();
    if (lat.landed && ph === 'post' && lists().length && isDone(lists().length - 1)) { lat.flown = lat.landed = false; asked.clear(); }
    if (S.mode !== 'idle' || S.speaking) return;
    const ls = lists();
    for (let i = 0; i < ls.length; i++) {
      const p = listPhases(ls[i].name);
      if (isDone(i) || !p || !p.includes(ph)) continue;
      if (/cockpit prep|preflight/i.test(ls[i].name) && (!prepDue() || (snoozeUntil[checklistKey() + '|' + i] || 0) > Date.now())) return;
      const k = ph + '|' + i; if (asked.has(k)) continue; // diese Liste wurde in dieser Phase schon angeboten
      if (!ready(i, ph)) continue;                      // noch zu früh → später erneut prüfen
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
    const on = remote() ? hostActive : S.on, de = pref.lang === 'de';
    const tg = panel.querySelector('#cpToggle');
    tg.textContent = remote() ? (on ? (de ? 'Am PC stoppen' : 'Stop on PC') : (de ? 'Am PC starten' : 'Start on PC')) : (on ? (de ? 'Copilot stoppen' : 'Stop Copilot') : (de ? 'Copilot starten' : 'Start Copilot'));
    tg.classList.toggle('on', on);
    const st = panel.querySelector('#cpState');
    st.textContent = muted ? (de ? '🔇 stumm' : '🔇 muted') : remote() ? (on ? (de ? 'Läuft am PC' : 'Running on the PC') : (de ? 'Am PC nicht aktiv' : 'Not active on the PC')) : !on ? (de ? 'Aus' : 'Off') : S.speaking ? (de ? '🔊 spricht' : '🔊 speaking') : S.listening ? (de ? '🎤 hört zu' : '🎤 listening') : (de ? 'An' : 'On');
    panel.querySelector('#cpLog').innerHTML = S.log.map((m) => `<div class="cp-${m.who === 'Du' ? 'me' : 'cp'}"><b>${esc(m.who)}</b> ${esc(m.text)}</div>`).join('') || `<div class="cp-empty">${de ? 'Noch nichts gesprochen.' : 'Nothing said yet.'}</div>`;
    panel.classList.toggle('on', on);
    panel.classList.toggle('cp-remote', remote());
    const note = panel.querySelector('#cpNote'); if (note) note.textContent = remote() ? (de ? 'Stimme und Mikrofon laufen am PC. Dieses Gerät zeigt und steuert nur.' : 'Voice and microphone run on the PC. This device only shows and controls.') : '';
    const dev = panel.querySelector('#cpDevHint'); if (dev) dev.hidden = !remote();
  }
  // ---------- Stumm schalten (Knopf in der Kopfleiste) ----------
  function muteBtn() {
    let b = document.getElementById('cpMute');
    if (!b) {
      const strip = document.querySelector('header.strip'), clock = strip && strip.querySelector('.strip-clock'); if (!strip) return null;
      b = document.createElement('button'); b.id = 'cpMute'; b.type = 'button'; b.className = 'strip-mute';
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6"/><path class="sl" d="M4 4l16 16"/></svg>';
      b.onclick = () => { const v = !muted; setMuted(v); cmd('mute', v ? '1' : '0'); };
      strip.insertBefore(b, clock || null);
    }
    return b;
  }
  function setMuted(v) {
    v = !!v; if (v === muted) { muteBtn(); return; }
    muted = v; S.muted = v;
    if (HOST) {
      if (v) { if (curAudio) { try { curAudio.pause(); } catch (e) {} curAudio = null; } if (TTS) { try { TTS.cancel(); } catch (e) {} } S.speaking = false; stopRec(); }
      else if (S.on) startRec();
    }
    const b = muteBtn(); if (b) { b.classList.toggle('on', v); b.title = v ? (pref.lang === 'de' ? 'Copilot ist stumm – antippen zum Aktivieren' : 'Copilot muted – tap to unmute') : (pref.lang === 'de' ? 'Copilot stumm schalten' : 'Mute Copilot'); }
    ui();
  }
  // Befehl an den PC (nur wenn dieses Gerät nicht selbst spricht)
  const cmd = (action, id) => post('/api/cp/event', { type: 'cmd', action, id: id || '', from: window.EFB_ID });
  function build() {
    const sec = $('#tab-copilot'); if (!sec) return;
    panel = document.createElement('div');
    panel.className = 'cp-panel cpv';
    panel.innerHTML = `<div class="cpv-card"><h3>Copilot</h3>
        <div class="cp-row"><button class="btn-s" id="cpToggle">Copilot starten</button><span id="cpState" class="cp-state"></span></div>
        <small id="cpNote"></small></div>
      <div class="cpv-card"><h3>Stimme &amp; Sprache</h3><div class="cp-row">
        <select id="cpLang"><option value="de">Deutsch</option><option value="en">English</option></select>
        <select id="cpVoice" title="Stimme"></select>
        <select id="cpVoiceEn" title="Stimme für englische Wörter"></select>
        <select id="cpVoiceGr" title="Stimme des Bodenpersonals (GSX)"></select>
        <label class="cp-rate">Tempo <input type="range" id="cpRate" min="0.8" max="1.4" step="0.05"></label>
        <label class="cp-chk"><input type="checkbox" id="cpMic"> Mikrofon</label>
        <label class="cp-chk"><input type="checkbox" id="cpAuto"> Automatisch starten</label>
        <label class="cp-chk"><input type="checkbox" id="cpPacks"> Start mit Packs AUS (Performance)</label>
        <label class="cp-chk"><input type="checkbox" id="cpGsxKeys"> GSX-Menü per Zifferntaste bedienen (nur wenn die Auswahl, z. B. beim Pushback, sonst nicht ankommt; MSFS muss laufen)</label></div></div>
      <div class="cpv-card"><h3>Mehr Leben</h3><small>Der Copilot spricht auch von sich aus. Gilt nur, solange er an und nicht stumm ist.</small><div class="cp-row">
        <label class="cp-chk"><input type="checkbox" id="cpLifeTaxi"> Rollweg-Ansagen (aus der Route in der Karte)</label>
        <label class="cp-chk"><input type="checkbox" id="cpLifeTraffic"> Verkehrshinweise (VATSIM)</label>
        <label class="cp-chk"><input type="checkbox" id="cpLifeCalls"> Callouts (80 Knoten, V1, Rotate, 10.000 ft)</label>
        <label class="cp-chk"><input type="checkbox" id="cpLifeGround"> Bodencrew meldet sich selbst (Triebwerksstart frei, Abkoppeln, Ankunft)</label>
        <label class="cp-chk"><input type="checkbox" id="cpLifePush"> Bodencrew spricht auch während des Pushbacks (sonst übernimmt GSX)</label></div></div>
      <div class="cpv-card" id="cpAmb"></div>
      <div class="cpv-card" id="cpDev"><small id="cpDevHint"><b>Audio-Geräte:</b> Mikrofon und Lautsprecher stellst du im Copilot-Fenster am PC ein.</small></div>
      <div class="cpv-card"><h3>Verlauf</h3><div id="cpLog" class="cp-log"></div>
        <form id="cpForm"><input id="cpText" placeholder="Antwort eintippen …" autocomplete="off"><button class="btn-s">OK</button></form></div>`;
    sec.appendChild(panel);
    if (window.AudioDev) {
      if (HOST) { window.AudioDev.mount($('#cpDev')); window.AudioDev.onChange((w) => { if (w === 'mic' && window.WhisperMic && S.on && useW()) window.WhisperMic.restart().catch(() => {}); }); }
    }
    if (window.Ambience) {
      window.Ambience.hook({ host: HOST, save: (cfg) => { pref.amb = Object.assign({}, cfg); persist(); }, test: (a, id) => cmd(a, id) });
      if (pref.amb) window.Ambience.setCfg(pref.amb);
      window.Ambience.mount($('#cpAmb'));
    }
    if (window.LANG === 'en') $('#cpText').placeholder = 'Type your answer …';
    $('#cpLang').value = pref.lang; $('#cpRate').value = pref.rate; $('#cpMic').checked = pref.mic;
    const save = persist;
    const fill1 = (sel, k, label, key) => {
      if (!sel) return;
      key = key || k;
      const list = key === 'ground' || remote() ? [] : voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith(k));
      const cur = (pref.voice && pref.voice[key]) || '';
      const pl = piper.voices.filter((v) => v.lang === k);
      const auto = piper.available && pl.length ? (pref.lang === 'de' ? 'Automatisch (eingebaut)' : 'Automatic (built-in)') : (pref.lang === 'de' ? 'Standardstimme' : 'Default voice');
      sel.innerHTML = `<option value="">${label}${auto}</option>` + pl.map((v) => `<option value="piper:${esc(v.id)}" ${'piper:' + v.id === cur ? 'selected' : ''}>★ ${esc(v.label)}</option>`).join('') + list.map((v) => `<option value="${esc(v.name)}" ${v.name === cur ? 'selected' : ''}>${esc(v.name)}</option>`).join('');
    };
    const fillVoices = () => {
      fill1($('#cpVoice'), pref.lang === 'de' ? 'de' : 'en', '');
      const e = $('#cpVoiceEn'); if (e) { e.hidden = pref.lang !== 'de'; fill1(e, 'en', 'EN: '); }
      const gr = $('#cpVoiceGr'); if (gr) { gr.hidden = !piper.available; fill1(gr, 'en', 'Ground: ', 'ground'); }
    };
    window._cpFillVoices = fillVoices; fillVoices();
    // Hörprobe immer am PC: dieses Gerät spricht nur, wenn es selbst der Copilot ist
    const preview = (which) => { if (remote()) return cmd(which); if (which === 'voice') say(pref.lang === 'de' ? 'So klinge ich.' : 'This is my voice.'); else if (which === 'ground') groundLine('Ground, ready.'); else say('Before Start checklist', 'en'); };
    window._cpPreview = preview;
    $('#cpVoice').onchange = (e) => { pref.voice = pref.voice || {}; pref.voice[pref.lang === 'de' ? 'de' : 'en'] = e.target.value; save(); setTimeout(() => preview('voice'), 500); };
    $('#cpVoiceGr').onchange = (e) => { pref.voice = pref.voice || {}; pref.voice.ground = e.target.value; save(); setTimeout(() => preview('ground'), 500); };
    $('#cpVoiceEn').onchange = (e) => { pref.voice = pref.voice || {}; pref.voice.en = e.target.value; save(); setTimeout(() => preview('voiceEn'), 500); };
    $('#cpAuto').checked = !!pref.autostart;
    $('#cpAuto').onchange = (e) => { pref.autostart = e.target.checked; save(); };
    const lifeSet = () => { const L = pref.life || {}; $('#cpLifeTaxi').checked = L.taxi !== false; $('#cpLifeTraffic').checked = L.traffic !== false; $('#cpLifeCalls').checked = L.calls !== false; $('#cpLifeGround').checked = L.ground !== false; $('#cpLifePush').checked = L.groundPush === true; };
    lifeSet(); window._cpLifeSet = lifeSet;
    [['#cpLifeTaxi', 'taxi'], ['#cpLifeTraffic', 'traffic'], ['#cpLifeCalls', 'calls'], ['#cpLifeGround', 'ground'], ['#cpLifePush', 'groundPush']].forEach(([id, k]) => { $(id).onchange = (e) => { pref.life = Object.assign({ taxi: true, traffic: true, calls: true, ground: true, groundPush: false }, pref.life || {}); pref.life[k] = e.target.checked; save(); }; });
    $('#cpPacks').checked = !!pref.packsOff;
    $('#cpPacks').onchange = (e) => { pref.packsOff = e.target.checked; save(); };
    $('#cpGsxKeys').checked = !!pref.gsxKeys; $('#cpGsxKeys').onchange = (e) => { pref.gsxKeys = e.target.checked; save(); };
    $('#cpToggle').onclick = () => { if (remote()) { cmd(hostActive ? 'stop' : 'start'); const st = panel.querySelector('#cpState'); st.textContent = hostActive ? '…' : (pref.lang === 'de' ? 'Starte am PC …' : 'Starting on the PC …'); setTimeout(pollHost, 2500); setTimeout(pollHost, 6000); } else (S.on ? stop() : start()); };
    $('#cpLang').onchange = (e) => { pref.lang = e.target.value; save(); fillVoices(); if (rec) { pauseRec(); } ui(); };
    $('#cpRate').oninput = (e) => { pref.rate = parseFloat(e.target.value); save(); };
    $('#cpMic').onchange = (e) => { pref.mic = e.target.checked; save(); if (!pref.mic) stopRec(); else if (S.on) startRec(); };
    $('#cpForm').onsubmit = (e) => { e.preventDefault(); const t = $('#cpText').value; $('#cpText').value = ''; if (remote()) { log('Du', t, true); post('/api/cp/event', { type: 'input', text: t, from: window.EFB_ID }); } else handle(t, false); };
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
  // Einstellungen vom Server übernehmen (gelten für alle Geräte, gesprochen wird am PC)
  function applyPref(o) {
    if (!o || typeof o !== 'object') return;
    const micWas = pref.mic;
    Object.assign(pref, o); store.set('copilot', pref);
    if (panel) { $('#cpLang').value = pref.lang; $('#cpRate').value = pref.rate; $('#cpMic').checked = pref.mic; $('#cpAuto').checked = !!pref.autostart; $('#cpPacks').checked = !!pref.packsOff; if (window._cpLifeSet) window._cpLifeSet(); if (window._cpFillVoices) window._cpFillVoices(); }
    if (window.Ambience && pref.amb) window.Ambience.setCfg(pref.amb);
    if (HOST && S.on && micWas !== pref.mic) { if (!pref.mic) stopRec(); else startRec(); }
    ui();
  }
  loadPiper(); fetch('/api/copilot').then((r) => r.json()).then((o) => {
    applyPref(o);
    if (HOST) { setTimeout(() => { try { showTab('check'); } catch (e) {} if (!S.on) start(); }, 800); } else if (pref.autostart) { const go = () => { document.removeEventListener('pointerdown', go, true); document.removeEventListener('keydown', go, true); if (!S.on) start(); }; document.addEventListener('pointerdown', go, true); document.addEventListener('keydown', go, true); }
  }).catch(() => {});
  loadSounds(); setInterval(loadSounds, 60000);
  fetch('/api/stt/status').then((r) => r.json()).then((o) => { stt.available = !!o.available; stt.checked = true; }).catch(() => { stt.checked = true; });
  const pollHost = () => fetch('/api/cp/host').then((r) => r.json()).then((o) => { const was = remote(), wasA = hostActive; setMuted(!!o.mute); isLocal = !!o.local; hostActive = !!o.active && o.id !== window.EFB_ID; if (remote() && S.on) stop(); if (was !== remote() || wasA !== hostActive) { ui(); if (window._cpFillVoices) window._cpFillVoices(); } }).catch(() => {});
  if (!HOST) { pollHost(); setInterval(pollHost, 5000); } else { fetch('/api/cp/host').then((r) => r.json()).then((o) => setMuted(!!o.mute)).catch(() => {}); setInterval(() => { if (S.on) beat(); }, 5000); }
  hooks.sim.push(watch);
  setInterval(watch, 4000);
  // Ereignisse vom Server: iPad tippt eine Liste an / tippt eine Antwort / zeigt die Liste des Copiloten
  function onEvent(name, d) {
    if (name === 'cp' && d.type === 'cmd' && d.action === 'mute') { setMuted(d.id === '1'); return; }
    if (name !== 'cp' || d.from === window.EFB_ID) return;
    if (d.type === 'prefs') { fetch('/api/copilot').then((r) => r.json()).then(applyPref).catch(() => {}); return; }
    if (HOST) {
      if (d.type === 'pick' && S.on) { clIndex = d.index; renderChecklists(); onPick(d.index); }
      if (d.type === 'input' && S.on) handle(d.text, false);
      if (d.type === 'cmd') {
        if (d.action === 'start' && !S.on) start();
        else if (d.action === 'stop' && S.on) stop();
        else if (d.action === 'test-amb' && window.Ambience) window.Ambience.play(d.id);
        else if (d.action === 'test-radio' && window.Ambience) { window.Ambience.radioOn(); setTimeout(window.Ambience.radioOff, 900); }
        else if (['voice', 'voiceEn', 'ground'].includes(d.action) && window._cpPreview) window._cpPreview(d.action);
      }
    } else {
      if (d.type === 'log') log(d.who, d.text, true);
      if (d.type === 'show' && remote()) { clIndex = d.index; if (typeof renderChecklists === 'function' && app.tab === 'check') renderChecklists(); }
    }
  }
  function onRemoteTick(k) {
    if (!HOST || !S.on || S.mode !== 'run' || S.speaking || k !== 'cl.' + checklistKey()) return;
    if ((progOf()[S.list] || [])[S.item]) advance();
  }
  window.Copilot = { _core: { say: (t, l, o) => say(t, l, o), groundLine, call, brk, gsxReady, lifeOn, pushBusy, engineClear, disconnectNow, efbAct, S, pref, isMuted: () => muted, spoken, rwySay, rwyTxt, itemLang, post }, freqOf, rwyOf, spellOut, setMuted, plannedRwy, parts, handle, state: S, nums, verify, phase, start, stop, _pref: pref, onEvent, onRemoteTick, intentList, gsxCmd, codesOf, dirOf, pickIdx, utTokens, hasSpecific, sttError: (m) => log('System', 'Spracherkennung: ' + m), sttEmpty: () => log('System', pref.lang === 'de' ? '(gehört, aber nichts verstanden)' : '(heard something, could not understand)') };
  const boot = () => { build(); muteBtn(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
