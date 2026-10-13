// Eingebaute Sprachausgabe mit Piper (offline, neuronale Stimmen). Die Windows-App liefert piper.exe und die
// Stimmen mit und setzt EFB_PIPER, EFB_VOICES (eigene/nachgeladene) und EFB_VOICES_BUNDLED (mitgelieferte).
// Ohne diese Variablen ist die Funktion aus und der Copilot nimmt die Stimmen des Browsers.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const CACHE = path.join(__dirname, 'cache', 'tts');
const piperBin = () => { const p = process.env.EFB_PIPER; return p && fs.existsSync(p) ? p : null; };

function voices() {
  const seen = new Map();
  [[process.env.EFB_VOICES, false], [process.env.EFB_VOICES_BUNDLED, true]].forEach(([dir, bundled]) => {
    if (!dir || !fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.onnx') || !fs.existsSync(path.join(dir, f + '.json'))) continue;
      const id = f.slice(0, -5); if (seen.has(id)) continue;
      let j = {}; try { j = JSON.parse(fs.readFileSync(path.join(dir, f + '.json'), 'utf8')); } catch { /* ohne Metadaten */ }
      const lang = String((j.language && j.language.code) || id.split(/[-_]/)[0]).slice(0, 2).toLowerCase();
      const parts = id.split('-');
      seen.set(id, { id, lang, label: `${parts[1] || id} (${parts[2] || ''}${parts[0] ? ', ' + parts[0].replace('_', '-') : ''})`.replace(' ()', ''), file: path.join(dir, f), bundled });
    }
  });
  return [...seen.values()].sort((a, b) => Number(b.bundled) - Number(a.bundled) || a.id.localeCompare(b.id));
}

let running = 0; const waiting = []; const inflight = new Map();
const slot = () => new Promise((res) => { const go = () => { running++; res(); }; running < 2 ? go() : waiting.push(go); });
const free = () => { running--; const n = waiting.shift(); if (n) n(); };

function prune() {
  try {
    const fl = fs.readdirSync(CACHE).map((f) => ({ f, t: fs.statSync(path.join(CACHE, f)).mtimeMs })).sort((a, b) => a.t - b.t);
    for (const x of fl.slice(0, Math.max(0, fl.length - 400))) fs.unlinkSync(path.join(CACHE, x.f));
  } catch { /* leer */ }
}

// liefert den Pfad einer WAV-Datei (aus dem Zwischenspeicher oder frisch erzeugt)
async function synth(text, voiceId, rate) {
  const bin = piperBin(); if (!bin) throw new Error('Piper ist nicht installiert.');
  text = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 500); if (!text) throw new Error('Kein Text.');
  if (!/^[\w.-]+$/.test(voiceId || '')) throw new Error('Ungültige Stimme.');
  const v = voices().find((x) => x.id === voiceId); if (!v) throw new Error('Stimme nicht gefunden.');
  const r = Math.min(1.6, Math.max(0.6, Number(rate) || 1));
  const key = crypto.createHash('sha1').update(`${voiceId}|${r.toFixed(2)}|${text}`).digest('hex');
  const out = path.join(CACHE, key + '.wav');
  if (fs.existsSync(out)) { try { fs.utimesSync(out, new Date(), new Date()); } catch { /* egal */ } return out; }
  if (inflight.has(key)) return inflight.get(key);
  const job = (async () => {
    await slot();
    try {
      fs.mkdirSync(CACHE, { recursive: true });
      const tmp = out + '.' + process.pid + '.tmp';
      await new Promise((res, rej) => {
        const c = spawn(bin, ['--model', v.file, '--output_file', tmp, '--length_scale', String(+(1 / r).toFixed(3)), '--sentence_silence', '0.18'], { cwd: path.dirname(bin), windowsHide: true });
        let err = ''; c.stderr.on('data', (d) => { err += d; if (err.length > 4000) err = err.slice(-2000); });
        c.on('error', rej);
        c.on('close', (code) => (code === 0 && fs.existsSync(tmp) ? res() : rej(new Error('Piper-Fehler: ' + err.split(/\r?\n/).filter(Boolean).pop()))));
        c.stdin.on('error', () => {}); c.stdin.end(text + '\n');
      });
      fs.renameSync(tmp, out); prune();
      return out;
    } finally { free(); inflight.delete(key); }
  })();
  inflight.set(key, job);
  return job;
}

module.exports = { voices, synth, available: () => !!piperBin() };
