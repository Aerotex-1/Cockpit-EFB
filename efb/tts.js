// Eingebaute Sprachausgabe mit Piper (offline, neuronale Stimmen). Die Windows-App liefert piper.exe und die
// Stimmen mit und setzt EFB_PIPER, EFB_VOICES (eigene/nachgeladene) und EFB_VOICES_BUNDLED (mitgelieferte).
// Ohne diese Variablen ist die Funktion aus und der Copilot nimmt die Stimmen des Browsers.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { spawn } = require('child_process');

const CACHE = path.join(__dirname, 'cache', 'tts');
// Kokoro (sherpa-onnx): natürlichere englische Stimmen; die App setzt EFB_KOKORO (Programm) und EFB_KOKORO_DIR (Modell)
const kBin = () => { const p = process.env.EFB_KOKORO; return p && fs.existsSync(p) ? p : null; };
const kDir = () => { const d = process.env.EFB_KOKORO_DIR; return d && ['model.int8.onnx', 'voices.bin', 'tokens.txt'].every((f) => fs.existsSync(path.join(d, f))) ? d : null; };
const kokoroOn = () => !!(kBin() && kDir());
const KOKORO = [ // Sprecher-Nummern des Modells kokoro-int8-en-v0_19
  [6, 'am_michael', 'Michael (Kokoro, US, männlich)'], [5, 'am_adam', 'Adam (Kokoro, US, männlich)'], [10, 'bm_lewis', 'Lewis (Kokoro, britisch, männlich)'], [9, 'bm_george', 'George (Kokoro, britisch, männlich)'],
  [3, 'af_sarah', 'Sarah (Kokoro, US, weiblich)'], [1, 'af_bella', 'Bella (Kokoro, US, weiblich)'], [7, 'bf_emma', 'Emma (Kokoro, britisch, weiblich)'],
];
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
  const list = [...seen.values()].sort((a, b) => Number(b.bundled) - Number(a.bundled) || a.id.localeCompare(b.id));
  if (kokoroOn()) KOKORO.forEach(([sid, n, label]) => list.push({ id: 'kokoro-' + n, lang: 'en', label, kokoro: sid, bundled: false }));
  return list;
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
  text = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 500); if (!text) throw new Error('Kein Text.');
  if (!/^[\w.-]+$/.test(voiceId || '')) throw new Error('Ungültige Stimme.');
  const v = voices().find((x) => x.id === voiceId); if (!v) throw new Error('Stimme nicht gefunden.');
  const bin = v.kokoro ? kBin() : piperBin(); if (!bin) throw new Error('Sprachausgabe ist nicht installiert.');
  const r = Math.min(1.6, Math.max(0.6, Number(rate) || 1));
  const key = crypto.createHash('sha1').update(`v2|${voiceId}|${r.toFixed(2)}|${text}`).digest('hex');
  const out = path.join(CACHE, key + '.wav');
  if (fs.existsSync(out)) { try { fs.utimesSync(out, new Date(), new Date()); } catch { /* egal */ } return out; }
  if (inflight.has(key)) return inflight.get(key);
  const job = (async () => {
    await slot();
    try {
      fs.mkdirSync(CACHE, { recursive: true });
      const tmp = out + '.' + process.pid + '.tmp.wav';
      await new Promise((res, rej) => {
        const kd = v.kokoro ? kDir() : null;
        const args = v.kokoro
          ? [`--kokoro-model=${path.join(kd, 'model.int8.onnx')}`, `--kokoro-voices=${path.join(kd, 'voices.bin')}`, `--kokoro-tokens=${path.join(kd, 'tokens.txt')}`, `--kokoro-data-dir=${path.join(kd, 'espeak-ng-data')}`, `--num-threads=${Math.max(2, Math.min(4, Math.floor(os.cpus().length / 3)))}`, `--sid=${v.kokoro}`, `--kokoro-length-scale=${+(1 / r).toFixed(3)}`, `--output-filename=${tmp}`, text.replace(/^-+/, '')]
          : null;
        const c = args ? spawn(bin, args, { cwd: path.dirname(bin), windowsHide: true }) : spawn(bin, ['--model', v.file, '--output_file', tmp, '--length_scale', String(+(1 / r).toFixed(3)), '--sentence_silence', '0.22', '--noise_scale', '0.85', '--noise_w', '1.0'], { cwd: path.dirname(bin), windowsHide: true });
        try { if (c.pid) os.setPriority(c.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* nicht überall erlaubt */ } // neben dem Simulator: niedrige Priorität
        c.stdout.on('data', () => {}); let err = ''; c.stderr.on('data', (d) => { err += d; if (err.length > 4000) err = err.slice(-2000); });
        c.on('error', rej);
        c.on('close', (code) => (code === 0 && fs.existsSync(tmp) ? res() : rej(new Error('Piper-Fehler: ' + err.split(/\r?\n/).filter(Boolean).pop()))));
        if (!args) { c.stdin.on('error', () => {}); c.stdin.end(text + '\n'); }
      });
      fs.renameSync(tmp, out); prune();
      return out;
    } finally { free(); inflight.delete(key); }
  })();
  inflight.set(key, job);
  return job;
}

module.exports = { voices, synth, available: () => !!piperBin() || kokoroOn() };
