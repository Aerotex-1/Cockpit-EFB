// Prüft Kokoro-Installation (ohne Netz): Download und Entpacken sind ersetzt.
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
const k = require('../code/lib/kokoro');
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-'));
  assert.deepStrictEqual(k.status(dir), { binary: false, model: false, mb: 130 });
  assert.strictEqual(k.env(dir).EFB_KOKORO, '');
  const fetchFn = async () => ({ ok: true, headers: { get: () => '3' }, body: { getReader: () => { let d = false; return { read: async () => (d ? { done: true } : ((d = true), { done: false, value: new Uint8Array([1, 2, 3]) })) }; } } });
  const calls = [];
  const extract = (file, dst) => {
    calls.push(path.basename(file));
    if (/^bin/.test(path.basename(file))) { fs.mkdirSync(path.dirname(k.exe(dst)), { recursive: true }); fs.writeFileSync(k.exe(dst), 'x'); }
    else { const m = k.modelDir(dst); fs.mkdirSync(path.join(m, 'espeak-ng-data'), { recursive: true }); ['model.int8.onnx', 'voices.bin', 'tokens.txt'].forEach((f) => fs.writeFileSync(path.join(m, f), 'x')); }
  };
  const prog = []; await k.install(dir, { fetchFn, extract, onProgress: (w, p) => prog.push(w) });
  assert.deepStrictEqual(calls, ['bin.tar.bz2', 'model.tar.bz2']); assert.ok(prog.includes('Programm') && prog.includes('Stimmen'));
  assert.ok(k.status(dir).binary && k.status(dir).model); assert.ok(k.env(dir).EFB_KOKORO.endsWith('.exe'));
  await k.install(dir, { fetchFn, extract }); assert.strictEqual(calls.length, 2); // nichts doppelt laden
  await assert.rejects(() => k.install(fs.mkdtempSync(path.join(os.tmpdir(), 'kk-')), { fetchFn: async () => ({ ok: false, status: 404 }), extract }), /404/);
  k.remove(dir); assert.strictEqual(k.status(dir).binary, false);
  console.log('✓ Kokoro: Status, Installieren, Entfernen, Fehlerfälle');
})().catch((e) => { console.error(e); process.exit(1); });
