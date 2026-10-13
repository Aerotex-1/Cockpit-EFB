// Spracherkennung (whisper.cpp, Open Source, offline): Programm und Modelle werden bei Bedarf geladen.
'use strict';
const fs = require('fs');
const path = require('path');

const BIN_URL = 'https://github.com/ggml-org/whisper.cpp/releases/download/v1.7.6/whisper-bin-x64.zip';
const HF = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main';
const MODELS = [
  { id: 'base', file: 'ggml-base-q5_1.bin', name: 'Basis', desc: 'schnell, gut für Befehle und kurze Antworten', mb: 57 },
  { id: 'small', file: 'ggml-small-q5_1.bin', name: 'Klein (genauer)', desc: 'erkennt auch Akzent und Fachwörter besser, braucht etwas länger', mb: 182 },
  { id: 'medium', file: 'ggml-medium-q5_0.bin', name: 'Mittel (sehr genau)', desc: 'beste Erkennung, braucht einen starken PC und ist spürbar langsamer', mb: 539 },
];
const exe = (dir) => path.join(dir, 'bin', 'whisper-cli.exe');
const modelFile = (dir, id) => { const m = MODELS.find((x) => x.id === id); return m ? path.join(dir, 'models', m.file) : ''; };

function status(dir, active) {
  const models = MODELS.map((m) => ({ ...m, installed: fs.existsSync(modelFile(dir, m.id)) }));
  const use = (models.find((m) => m.id === active && m.installed) || models.find((m) => m.installed) || {}).id || '';
  return { binary: fs.existsSync(exe(dir)), models, active: use };
}
// Umgebungsvariablen für den EFB-Server (leer, wenn nicht komplett installiert)
function env(dir, active) {
  const s = status(dir, active);
  return s.binary && s.active ? { EFB_WHISPER: exe(dir), EFB_WHISPER_MODEL: modelFile(dir, s.active) } : { EFB_WHISPER: '', EFB_WHISPER_MODEL: '' };
}

async function getBuf(url, fetchFn, onProgress) {
  const r = await fetchFn(url, { headers: { 'User-Agent': 'CockpitEFB-App' }, redirect: 'follow' });
  if (!r.ok) throw new Error(`Download fehlgeschlagen (${r.status}): ${url.split('/').pop()}`);
  const total = Number(r.headers.get('content-length')) || 0;
  const chunks = []; let got = 0; const rd = r.body.getReader();
  for (;;) { const { done, value } = await rd.read(); if (done) break; chunks.push(Buffer.from(value)); got += value.length; if (onProgress && total) onProgress(got / total); }
  return Buffer.concat(chunks);
}
async function fetchTo(url, file, fetchFn, onProgress) {
  const r = await fetchFn(url, { headers: { 'User-Agent': 'CockpitEFB-App' }, redirect: 'follow' });
  if (!r.ok) throw new Error(`Download fehlgeschlagen (${r.status}): ${url.split('/').pop()}`);
  const total = Number(r.headers.get('content-length')) || 0;
  const tmp = file + '.part'; fs.mkdirSync(path.dirname(file), { recursive: true });
  const out = fs.createWriteStream(tmp); let got = 0;
  try {
    const rd = r.body.getReader();
    for (;;) { const { done, value } = await rd.read(); if (done) break; await new Promise((res, rej) => out.write(value, (e) => (e ? rej(e) : res()))); got += value.length; if (onProgress && total) onProgress(got / total); }
    await new Promise((res) => out.end(res));
    fs.renameSync(tmp, file);
  } catch (e) { out.destroy(); try { fs.unlinkSync(tmp); } catch { /* weg */ } throw e; }
}

// Programm: ZIP laden, den Ordner „Release“ nach <dir>/bin entpacken
async function installBinary(dir, { readZip, fetchFn = fetch, binUrl = BIN_URL, onProgress } = {}) {
  const buf = await getBuf(binUrl, fetchFn, onProgress);
  const files = readZip(buf);
  const cli = files.find((f) => /(^|\/)whisper-cli\.exe$/.test(f.name));
  if (!cli) throw new Error('whisper-cli.exe fehlt im Download.');
  const prefix = cli.name.slice(0, cli.name.length - 'whisper-cli.exe'.length);
  const dst = path.join(dir, 'bin'); fs.mkdirSync(dst, { recursive: true });
  for (const f of files) {
    if (!f.name.startsWith(prefix) || f.name.endsWith('/')) continue;
    const rel = f.name.slice(prefix.length);
    if (!rel || rel.includes('/') || rel.includes('..')) continue; // nur Dateien direkt im Ordner (exe + dll)
    fs.writeFileSync(path.join(dst, rel), f.data);
  }
}
async function installModel(dir, id, { fetchFn = fetch, base = HF, onProgress } = {}) {
  const m = MODELS.find((x) => x.id === id); if (!m) throw new Error('Unbekanntes Modell.');
  await fetchTo(`${base}/${m.file}`, modelFile(dir, id), fetchFn, onProgress);
}
function removeModel(dir, id) { try { fs.unlinkSync(modelFile(dir, id)); } catch { /* war nicht da */ } }

module.exports = { MODELS, BIN_URL, HF, status, env, exe, modelFile, installBinary, installModel, removeModel };
