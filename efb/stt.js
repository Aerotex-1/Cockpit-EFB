// Eingebaute Spracherkennung mit whisper.cpp (Open Source, offline). Die Windows-App lädt whisper-cli.exe und ein Modell
// nach und setzt EFB_WHISPER (Programm) und EFB_WHISPER_MODEL (Modelldatei). Ohne diese Variablen ist die Funktion aus.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const bin = () => { const p = process.env.EFB_WHISPER; return p && fs.existsSync(p) ? p : null; };
const model = () => { const p = process.env.EFB_WHISPER_MODEL; return p && fs.existsSync(p) ? p : null; };
const available = () => !!(bin() && model());

// typische Fantasie-Texte von Whisper bei Stille/Rauschen
const JUNK = /^(\[.*\]|\(.*\)|\*.*\*|♪.*|\.+|thank you\.?|thanks for watching\.?|untertitel.*|vielen dank\.?|subtitles? by.*|amara\.org.*)$/i;
function clean(t) {
  t = String(t || '').replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
  return JUNK.test(t) ? '' : t;
}

let busy = false; const queue = [];
// Läuft gerade eine Erkennung, wartet höchstens eine weitere: eine noch ältere wird verworfen (sie wäre ohnehin veraltet,
// und die Wartezeit würde sonst bei langsamem PC immer weiter wachsen).
const slot = () => new Promise((res, rej) => {
  if (!busy) { busy = true; return res(); }
  while (queue.length >= 1) queue.shift().rej(Object.assign(new Error('übersprungen'), { skipped: true }));
  queue.push({ res, rej });
});
const release = () => { const n = queue.shift(); if (n) n.res(); else busy = false; };

// Rechenlast schonen: Spracherkennung läuft neben dem Simulator. Wenige Kerne und niedrige Priorität (Windows: „Niedriger als normal“).
const lowPrio = (proc) => { try { if (proc && proc.pid) os.setPriority(proc.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* nicht überall erlaubt */ } };
const threads = () => { const e = parseInt(process.env.EFB_WHISPER_THREADS, 10); return String(e > 0 ? e : Math.max(2, Math.min(4, Math.floor(os.cpus().length / 3)))); };

// --- Schneller Weg: whisper-server bleibt mit geladenem Modell im Speicher (kein Neuladen pro Satz) ---
const serverBin = () => {
  const o = process.env.EFB_WHISPER_SERVER; if (o && fs.existsSync(o)) return o;
  const b = bin(); if (!b) return null;
  const p = path.join(path.dirname(b), 'whisper-server.exe'); return fs.existsSync(p) ? p : null;
};
let srv = null; // { proc, port, ready:Promise<boolean>, model }
let srvFailed = 0, srvFailedAt = 0;
function freePort() {
  return new Promise((res, rej) => { const s = require('net').createServer(); s.on('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
}
function stopServer() { if (srv) { try { srv.proc.kill(); } catch { /* weg */ } srv = null; } }
async function startServer() {
  const sb = serverBin(), m = model();
  if (srvFailed >= 3 && Date.now() - srvFailedAt > 120000) srvFailed = 0; // nach zwei Minuten neu versuchen
  if (!sb || !m || srvFailed >= 3) return null;
  if (srv && srv.model === m) return srv;
  stopServer();
  const port = await freePort();
  const proc = spawn(sb, ['-m', m, '--host', '127.0.0.1', '--port', String(port), '-t', threads(), '-bs', '1', '-bo', '1', '-nf', '-sns'], { cwd: path.dirname(sb), windowsHide: true });
  lowPrio(proc);
  const me = { proc, port, model: m, ready: null };
  let dead = false;
  proc.on('error', () => { dead = true; }); proc.on('close', () => { dead = true; if (srv === me) srv = null; });
  proc.stdout.on('data', () => {}); proc.stderr.on('data', () => {});
  me.ready = (async () => {
    for (let i = 0; i < 120 && !dead; i++) { // bis ca. 30 s aufs Laden warten
      try { await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1000) }); return true; } catch { await new Promise((r) => setTimeout(r, 250)); }
    }
    return false;
  })();
  srv = me;
  me.ready.then((ok) => { if (!ok) { srvFailed++; srvFailedAt = Date.now(); if (srv === me) stopServer(); } });
  return me;
}
async function viaServer(wav, lang, prompt) {
  const s = await startServer(); if (!s) return null;
  if (!(await s.ready)) return null;
  const fd = new FormData();
  fd.append('file', new Blob([wav], { type: 'audio/wav' }), 'a.wav');
  fd.append('response_format', 'json'); fd.append('temperature', '0.0'); fd.append('language', lang);
  if (prompt) fd.append('prompt', prompt);
  const r = await fetch(`http://127.0.0.1:${s.port}/inference`, { method: 'POST', body: fd, signal: AbortSignal.timeout(45000) });
  if (!r.ok) throw new Error('whisper-server ' + r.status);
  const j = await r.json(); if (j && j.error) throw new Error(String(j.error));
  return (j && j.text) || '';
}
function viaCli(wav, lang, prompt) {
  const f = path.join(os.tmpdir(), 'efb-stt-' + process.pid + '-' + Date.now() + '.wav');
  fs.writeFileSync(f, wav);
  const args = ['-m', model(), '-f', f, '-l', lang, '-nt', '-np', '-nf', '-sns', '-bs', '1', '-bo', '1', '-t', threads()];
  if (prompt) args.push('--prompt', prompt);
  return new Promise((res, rej) => {
    const c = spawn(bin(), args, { cwd: path.dirname(bin()), windowsHide: true });
    lowPrio(c);
    let o = '', e = '', timedOut = false;
    const to = setTimeout(() => { timedOut = true; try { c.kill(); } catch { /* weg */ } }, 60000);
    c.stdout.on('data', (d) => { o += d; }); c.stderr.on('data', (d) => { e += d; });
    c.on('error', (er) => { clearTimeout(to); rej(er); });
    c.on('close', (code) => { clearTimeout(to); code === 0 ? res(o) : rej(Object.assign(new Error(timedOut ? 'zu langsam, abgebrochen (PC ausgelastet; ein kleineres Modell hilft)' : 'whisper beendet mit ' + code + ': ' + e.slice(-200)), { slow: timedOut })); });
  }).finally(() => { try { fs.unlinkSync(f); } catch { /* weg */ } });
}

let lastMs = 0, lastVia = '';
// wav: Buffer (16 kHz, mono, 16 Bit)
async function transcribe(wav, { lang = 'auto', prompt = '' } = {}) {
  if (!available()) throw new Error('Spracherkennung nicht installiert.');
  if (!Buffer.isBuffer(wav) || wav.length < 1000 || wav.length > 8e6) throw new Error('Audio ungültig.');
  lang = /^(auto|de|en)$/.test(lang) ? lang : 'auto';
  prompt = String(prompt || '').slice(0, 700);
  try { await slot(); } catch (er) { if (er && er.skipped) return null; throw er; }
  const t0 = Date.now();
  try {
    let out = null;
    try { out = await viaServer(wav, lang, prompt); lastVia = 'server'; if (out !== null) srvFailed = 0; }
    catch (er) {
      if (er && (er.name === 'TimeoutError' || er.name === 'AbortError')) throw Object.assign(new Error('zu langsam, abgebrochen (PC ausgelastet; ein kleineres Modell hilft)'), { slow: true }); // Server bleibt, kein Umweg über das langsame Einzelprogramm
      out = null; stopServer(); srvFailed++; srvFailedAt = Date.now();
    }
    if (out === null) { out = await viaCli(wav, lang, prompt); lastVia = 'cli'; }
    lastMs = Date.now() - t0;
    const txt = clean(out);
    // Whisper „erfindet“ bei Rauschen gern japanische, chinesische oder russische Sätze: Texte in fremder Schrift verwerfen (Deutsch und Englisch sind lateinisch)
    return /[\u0400-\u04ff\u0590-\u06ff\u0900-\u0dff\u0e00-\u0e7f\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(txt) ? '' : txt;
  } finally { release(); }
}
// Modell schon beim Start laden, damit der erste Satz nicht wartet
function warm() { if (available() && serverBin()) startServer().catch(() => {}); }
process.on('exit', stopServer);
module.exports = { available, transcribe, clean, warm, stop: stopServer, info: () => ({ ms: lastMs, via: lastVia }), model: () => (model() ? path.basename(model()) : '') };
