// Lädt Piper (Windows) und die mitgelieferten Stimmen für den Installer. Läuft beim Bauen (npm run dist).
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const voices = require('../lib/voices');
const ROOT = path.join(__dirname, '..');
const PIPER_URL = 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip';
(async () => {
  const pdir = path.join(ROOT, 'piper-bundle'), vdir = path.join(ROOT, 'voices-bundle');
  if (!fs.existsSync(path.join(pdir, 'piper', 'piper.exe'))) {
    console.log('Lade Piper …'); fs.mkdirSync(pdir, { recursive: true });
    const r = await fetch(PIPER_URL, { redirect: 'follow' }); if (!r.ok) throw new Error('Piper-Download: ' + r.status);
    const zip = path.join(pdir, 'piper.zip'); fs.writeFileSync(zip, Buffer.from(await r.arrayBuffer()));
    execFileSync('tar', ['-xf', zip, '-C', pdir]); fs.unlinkSync(zip);
    if (!fs.existsSync(path.join(pdir, 'piper', 'piper.exe'))) throw new Error('piper.exe nicht gefunden nach dem Entpacken.');
  }
  for (const v of voices.CATALOG.filter((x) => x.bundled)) {
    if (fs.existsSync(path.join(vdir, v.id + '.onnx'))) continue;
    console.log('Lade Stimme', v.id); await voices.install(v.id, { userDir: vdir });
  }
  console.log('Piper und Stimmen bereit.');
})().catch((e) => { console.error(e); process.exit(1); });
