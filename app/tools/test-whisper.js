const http = require('http'), fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
const W = require('../code/lib/whisper');
const { readZip } = require(process.env.EFB_UPDATER || '../../efb/updater.js');
(async () => {
  const zip = fs.readFileSync(process.env.WHISPER_ZIP || '/tmp/wh/w-v1.7.6.zip'); const model = Buffer.alloc(200000, 3);
  const srv = http.createServer((q, r) => {
    if (q.url.endsWith('.zip')) { r.setHeader('content-length', zip.length); return r.end(zip); }
    if (q.url.endsWith('.bin')) { r.setHeader('content-length', model.length); return r.end(model); }
    r.writeHead(404); r.end();
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); const base = 'http://127.0.0.1:' + srv.address().port;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'w-'));
  let s = W.status(dir); assert(!s.binary && !s.active && s.models.length === 2);
  assert.strictEqual(W.env(dir).EFB_WHISPER, '');
  let p = 0; await W.installBinary(dir, { readZip, binUrl: base + '/w.zip', onProgress: (x) => (p = x) });
  assert.strictEqual(p, 1); assert(fs.existsSync(path.join(dir, 'bin', 'whisper-cli.exe'))); assert(fs.existsSync(path.join(dir, 'bin', 'ggml.dll')));
  assert.strictEqual(W.env(dir, 'base').EFB_WHISPER, '', 'ohne Modell nicht aktiv');
  await W.installModel(dir, 'base', { base }); s = W.status(dir, 'small');
  assert(s.binary && s.active === 'base' && s.models[0].installed);
  const e = W.env(dir, 'base'); assert(e.EFB_WHISPER.endsWith('whisper-cli.exe') && e.EFB_WHISPER_MODEL.endsWith('ggml-base-q5_1.bin'));
  W.removeModel(dir, 'base'); assert(!W.status(dir).active);
  await assert.rejects(W.installModel(dir, '../x', { base }), /Unbekannt/);
  await assert.rejects(W.installModel(dir, 'small', { base, fetchFn: async () => ({ ok: false, status: 404 }) }), /404/);
  assert(!fs.readdirSync(path.join(dir, 'models')).some((f) => f.endsWith('.part')));
  console.log('✓ Whisper: Programm entpacken, Modell laden, Status/Env, Fehlerfälle'); srv.close(); process.exit(0);
})().catch((e) => { console.error('✗', e); process.exit(1); });
