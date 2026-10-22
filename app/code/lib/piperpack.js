// Copilot-Pack: die Sprachengine (Piper) steckt nicht mehr im Installer, sondern wird erst geladen, wenn man die Version
// „Copilot & Ground“ wählt. Ablage: <userData>/piper-pack/piper/piper.exe
'use strict';
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const URL = 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip';
const MB = 22; // ungefähre Größe des Downloads
const exe = (dir) => path.join(dir, 'piper', 'piper.exe');
const status = (dir) => ({ installed: fs.existsSync(exe(dir)), mb: MB });

const tarExtract = (zip, dir) => new Promise((res, rej) => execFile('tar', ['-xf', zip, '-C', dir], { windowsHide: true, timeout: 120000 }, (e) => (e ? rej(new Error('Entpacken fehlgeschlagen: ' + e.message)) : res())));

async function install(dir, { fetchFn = fetch, extract = tarExtract, onProgress } = {}) {
  if (fs.existsSync(exe(dir))) return status(dir);
  fs.mkdirSync(dir, { recursive: true });
  const r = await fetchFn(URL, { headers: { 'User-Agent': 'CockpitEFB-App' }, redirect: 'follow' });
  if (!r.ok) throw new Error(`Download fehlgeschlagen (${r.status}): ${URL.split('/').pop()}`);
  const total = Number(r.headers && r.headers.get && r.headers.get('content-length')) || 0;
  const zip = path.join(dir, 'piper.zip.part'); const out = fs.createWriteStream(zip);
  let got = 0;
  try {
    const rd = r.body.getReader();
    for (;;) { const { done, value } = await rd.read(); if (done) break; await new Promise((ok, no) => out.write(value, (e) => (e ? no(e) : ok()))); got += value.length; if (onProgress && total) onProgress(got / total); }
    await new Promise((ok) => out.end(ok));
    await extract(zip, dir);
  } catch (e) { out.destroy(); throw e; } finally { try { fs.unlinkSync(zip); } catch { /* weg */ } }
  if (!fs.existsSync(exe(dir))) { fs.rmSync(path.join(dir, 'piper'), { recursive: true, force: true }); throw new Error('piper.exe nicht gefunden nach dem Entpacken.'); }
  if (onProgress) onProgress(1);
  return status(dir);
}
function remove(dir) { fs.rmSync(dir, { recursive: true, force: true }); }
module.exports = { status, install, remove, exe, URL };
