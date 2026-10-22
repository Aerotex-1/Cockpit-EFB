// Testet das Nachladen des Copilot-Packs mit nachgestelltem Download (kein Netz).
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const pp = require('../code/lib/piperpack');
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-'));
  assert.strictEqual(pp.status(dir).installed, false);
  const body = (b) => ({ getReader: () => { let d = false; return { read: async () => (d ? { done: true } : ((d = true), { done: false, value: b })) }; } });
  const ok = async () => ({ ok: true, headers: { get: () => '4' }, body: body(Buffer.from('zip!')) });
  const prog = []; const good = async (zip, d) => { assert.ok(fs.existsSync(zip)); fs.mkdirSync(path.join(d, 'piper'), { recursive: true }); fs.writeFileSync(path.join(d, 'piper', 'piper.exe'), 'x'); };
  let r = await pp.install(dir, { fetchFn: ok, extract: good, onProgress: (p) => prog.push(p) });
  assert.strictEqual(r.installed, true); assert.ok(prog.includes(1)); assert.ok(!fs.existsSync(path.join(dir, 'piper.zip.part')));
  // schon da: kein zweiter Download
  let n = 0; await pp.install(dir, { fetchFn: async () => { n++; return ok(); }, extract: good }); assert.strictEqual(n, 0);
  // Fehler: HTTP, leeres Archiv
  const d2 = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-'));
  await assert.rejects(pp.install(d2, { fetchFn: async () => ({ ok: false, status: 404 }), extract: good }), /404/);
  await assert.rejects(pp.install(d2, { fetchFn: ok, extract: async () => {} }), /nicht gefunden/);
  assert.ok(!fs.existsSync(path.join(d2, 'piper.zip.part')));
  pp.remove(dir); assert.strictEqual(pp.status(dir).installed, false);
  console.log('✓ Copilot-Pack: Nachladen, Fortschritt, schon vorhanden, Fehler, Entfernen');
})().catch((e) => { console.error('✗', e); process.exit(1); });
