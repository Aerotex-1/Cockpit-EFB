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
const slot = () => new Promise((res) => { if (!busy) { busy = true; res(); } else queue.push(res); });
const release = () => { const n = queue.shift(); if (n) n(); else busy = false; };

// wav: Buffer (16 kHz, mono, 16 Bit)
async function transcribe(wav, { lang = 'auto', prompt = '' } = {}) {
  if (!available()) throw new Error('Spracherkennung nicht installiert.');
  if (!Buffer.isBuffer(wav) || wav.length < 1000 || wav.length > 8e6) throw new Error('Audio ungültig.');
  lang = /^(auto|de|en)$/.test(lang) ? lang : 'auto';
  await slot();
  const f = path.join(os.tmpdir(), 'efb-stt-' + process.pid + '-' + Date.now() + '.wav');
  try {
    fs.writeFileSync(f, wav);
    const args = ['-m', model(), '-f', f, '-l', lang, '-nt', '-np', '-nf', '-sns', '-t', String(Math.max(2, Math.min(6, os.cpus().length - 1)))];
    if (prompt) args.push('--prompt', String(prompt).slice(0, 400));
    const out = await new Promise((res, rej) => {
      const c = spawn(bin(), args, { cwd: path.dirname(bin()), windowsHide: true });
      let o = '', e = '';
      const to = setTimeout(() => { try { c.kill(); } catch { /* weg */ } }, 25000);
      c.stdout.on('data', (d) => { o += d; }); c.stderr.on('data', (d) => { e += d; });
      c.on('error', rej);
      c.on('close', (code) => { clearTimeout(to); code === 0 ? res(o) : rej(new Error('whisper beendet mit ' + code + ': ' + e.slice(-200))); });
    });
    return clean(out);
  } finally { try { fs.unlinkSync(f); } catch { /* weg */ } release(); }
}
module.exports = { available, transcribe, clean, model: () => (model() ? path.basename(model()) : '') };
