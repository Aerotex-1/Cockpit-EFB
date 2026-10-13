// Testet die Logik ohne Electron: GitHub-Releases (Mock), Seed/Update-Überschreiben, Server starten/neu starten.
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
const releases = require('../code/lib/releases'), { ServerProc } = require('../code/lib/server-proc');
const EFB = path.join(__dirname, '..', '..', 'efb'), upd = require(path.join(EFB, 'updater.js'));
(async () => {
  // --- GitHub-Mock
  const zip = fs.readFileSync(process.argv[2]);
  const rel = (tag, assets, body) => ({ tag_name: tag, name: tag, body, draft: false, assets });
  let hits = [];
  const srv = http.createServer((q, r) => {
    hits.push(q.url + ' ' + (q.headers.authorization || ''));
    if (q.url.startsWith('/repos/me/priv/releases')) {
      if (q.headers.authorization !== 'Bearer tok') { r.writeHead(404); return r.end('{}'); }
      return r.end(JSON.stringify([rel('app-v1.0.1', [{ name: 'Cockpit-EFB-Setup-1.0.1.exe', url: base + '/dl/exe', size: 3 }, { name: 'Cockpit-EFB-App-Code-1.2.0.zip', url: base + '/dl/zip', size: 3 }], 'App neu'), rel('v1.9.0', [{ name: 'Cockpit-EFB-1.9.0.zip', url: base + '/dl/zip', size: zip.length }, { name: 'Cockpit-EFB-1.9.0-privat.zip', url: base + '/dl/zip', size: 1 }], 'Neu!'), rel('v1.1.7', [{ name: 'Cockpit-EFB-1.1.7.zip', url: base + '/dl/zip', size: 1 }], '')]));
    }
    if (q.url === '/dl/zip') { if (q.headers.authorization !== 'Bearer tok') { r.writeHead(401); return r.end(); } r.setHeader('content-length', zip.length); return r.end(zip); }
    r.writeHead(404); r.end();
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); const base = 'http://127.0.0.1:' + srv.address().port;
  assert.strictEqual(releases.cmp('1.10.0', '1.9.9'), 1);
  await assert.rejects(releases.check({ repo: 'me/priv', token: '', edition: 'public', efbVersion: '1.1.7', codeVersion: '1.0.0', shellVersion: '1.0.0', base }), /Repository nicht gefunden/);
  const c = await releases.check({ repo: 'me/priv', token: 'tok', edition: 'public', efbVersion: '1.1.7', codeVersion: '1.0.0', shellVersion: '1.0.0', base });
  assert.strictEqual(c.efb.version, '1.9.0'); assert.strictEqual(c.shell.version, '1.0.1'); assert.strictEqual(c.code.version, '1.2.0');
  const c2 = await releases.check({ repo: 'me/priv', token: 'tok', edition: 'public', efbVersion: '1.9.0', codeVersion: '1.2.0', shellVersion: '1.0.1', base });
  assert(!c2.efb && !c2.code && !c2.shell);
  const buf = await releases.download(c.efb.asset, { token: 'tok' });
  assert.deepStrictEqual(buf, zip); console.log('✓ GitHub-Releases (Token, Versionsvergleich, Download)');

  // --- Seed + persönliche Dateien bleiben beim Update
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'efbapp-')), data = path.join(dir, 'efb');
  fs.mkdirSync(data); upd.installDir(EFB, data);
  fs.writeFileSync(path.join(data, 'logbook.json'), '[1]'); fs.mkdirSync(path.join(data, 'charts')); fs.writeFileSync(path.join(data, 'charts', 'x.pdf'), 'pdf');
  const cj = JSON.parse(fs.readFileSync(path.join(data, 'config.json'))); cj.port = 8097; fs.writeFileSync(path.join(data, 'config.json'), JSON.stringify(cj));
  const r = upd.install(buf, data);
  assert.strictEqual(fs.readFileSync(path.join(data, 'logbook.json'), 'utf8'), '[1]'); assert(fs.existsSync(path.join(data, 'charts', 'x.pdf')));
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(data, 'config.json'))).port, 8097); console.log('✓ Update überschreibt nur Programmdateien', r);

  // --- Server starten, Neustart über /api/update/restart (Exit-Code 42), Stopp
  const p = new ServerProc({ execPath: process.execPath, cwd: data, env: {} });
  const states = []; p.on('status', (s) => states.push(s));
  p.start();
  const until = async (f, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (f()) return; await new Promise((x) => setTimeout(x, 200)); } throw new Error('Timeout ' + states + '\n' + p.logs.slice(-8).join('\n')); };
  await until(() => p.status === 'running'); console.log('✓ Server läuft auf Port', p.port());
  const rr = await fetch(`http://127.0.0.1:${p.port()}/api/update/restart`, { method: 'POST' }).then((x) => x.json());
  assert.strictEqual(rr.managed, true);
  await until(() => states.filter((s) => s === 'running').length >= 2); console.log('✓ Neustart nach Update (Exit 42)');
  await p.stop(); assert.strictEqual(p.status, 'stopped'); console.log('✓ Stopp');
  srv.close(); fs.rmSync(dir, { recursive: true, force: true }); process.exit(0);
})().catch((e) => { console.error('✗', e); process.exit(1); });
