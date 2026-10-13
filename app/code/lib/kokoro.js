// Natürliche englische Stimmen (Kokoro-82M, Apache-2.0) über sherpa-onnx (Apache-2.0).
// Programm (26 MB) und Modell (103 MB, int8) werden bei Bedarf von GitHub geladen. Kokoro spricht kein Deutsch.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const os = require('os');

const VER = '1.12.20';
const BIN_URL = `https://github.com/k2-fsa/sherpa-onnx/releases/download/v${VER}/sherpa-onnx-v${VER}-win-x64-shared.tar.bz2`;
const MODEL_URL = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-int8-en-v0_19.tar.bz2';
const BIN_DIR = `sherpa-onnx-v${VER}-win-x64-shared`;
const MODEL_DIR = 'kokoro-int8-en-v0_19';

const exe = (dir) => path.join(dir, BIN_DIR, 'bin', 'sherpa-onnx-offline-tts.exe');
const modelDir = (dir) => path.join(dir, MODEL_DIR);
const modelOk = (dir) => ['model.int8.onnx', 'voices.bin', 'tokens.txt'].every((f) => fs.existsSync(path.join(modelDir(dir), f))) && fs.existsSync(path.join(modelDir(dir), 'espeak-ng-data'));

function status(dir) { return { binary: fs.existsSync(exe(dir)), model: modelOk(dir), mb: 130 }; }
function env(dir) { const s = status(dir); return s.binary && s.model ? { EFB_KOKORO: exe(dir), EFB_KOKORO_DIR: modelDir(dir) } : { EFB_KOKORO: '', EFB_KOKORO_DIR: '' }; }

async function fetchTo(url, file, fetchFn, onProgress) {
  const r = await fetchFn(url, { headers: { 'User-Agent': 'CockpitEFB-App' }, redirect: 'follow' });
  if (!r.ok) throw new Error(`Download fehlgeschlagen (${r.status}): ${url.split('/').pop()}`);
  const total = Number(r.headers.get('content-length')) || 0;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.part'; const out = fs.createWriteStream(tmp); let got = 0;
  try {
    const rd = r.body.getReader();
    for (;;) { const { done, value } = await rd.read(); if (done) break; await new Promise((res, rej) => out.write(value, (e) => (e ? rej(e) : res()))); got += value.length; if (onProgress && total) onProgress(got / total); }
    await new Promise((res) => out.end(res));
    fs.renameSync(tmp, file);
  } catch (e) { out.destroy(); try { fs.unlinkSync(tmp); } catch { /* weg */ } throw e; }
}
// Windows 10/11 bringt tar.exe (bsdtar) mit, das .tar.bz2 entpackt
const tarExtract = (file, dst) => { fs.mkdirSync(dst, { recursive: true }); execFileSync('tar', ['-xf', file, '-C', dst], { windowsHide: true }); };

async function install(dir, { fetchFn = fetch, extract = tarExtract, onProgress, binUrl = BIN_URL, modelUrl = MODEL_URL } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'efb-kokoro-'));
  try {
    if (!status(dir).binary) {
      const f = path.join(tmp, 'bin.tar.bz2'); await fetchTo(binUrl, f, fetchFn, (p) => onProgress && onProgress('Programm', p));
      extract(f, dir); if (!status(dir).binary) throw new Error('sherpa-onnx-offline-tts.exe fehlt im Download.');
    }
    if (!status(dir).model) {
      const f = path.join(tmp, 'model.tar.bz2'); await fetchTo(modelUrl, f, fetchFn, (p) => onProgress && onProgress('Stimmen', p));
      extract(f, dir); if (!status(dir).model) throw new Error('Das Stimmenpaket ist unvollständig.');
    }
  } finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* weg */ } }
}
function remove(dir) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* war nicht da */ } }

module.exports = { VER, BIN_URL, MODEL_URL, BIN_DIR, MODEL_DIR, status, env, exe, modelDir, install, remove };
