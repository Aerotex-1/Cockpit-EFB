// Testet den festen Kern (boot.js): welcher App-Code wird geladen, Rückfall bei defektem Update.
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert'), Module = require('module');
const BOOT = fs.readFileSync(path.join(__dirname, '..', 'boot.js'), 'utf8');
function run(userCode) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boot-')), shell = path.join(dir, 'shell'), data = path.join(dir, 'data');
  fs.mkdirSync(path.join(shell, 'code'), { recursive: true }); fs.mkdirSync(data);
  fs.writeFileSync(path.join(shell, 'boot.js'), BOOT);
  fs.writeFileSync(path.join(shell, 'code', 'package.json'), '{"version":"1.2.0"}');
  fs.writeFileSync(path.join(shell, 'code', 'app-main.js'), "global.__LOADED='bundled';");
  if (userCode) { const u = path.join(data, 'app-code'); fs.mkdirSync(u); fs.writeFileSync(path.join(u, 'package.json'), JSON.stringify({ version: userCode.v, shellApi: userCode.api })); fs.writeFileSync(path.join(u, 'app-main.js'), userCode.main || "global.__LOADED='user';"); }
  const orig = Module._load; Module._load = function (r, ...a) { return r === 'electron' ? { app: { getPath: () => data, getVersion: () => '1.2.0' } } : orig.call(this, r, ...a); };
  delete global.__LOADED; delete global.__EFB_BOOT;
  try { require(path.join(shell, 'boot.js')); } finally { Module._load = orig; delete require.cache[path.join(shell, 'boot.js')]; }
  return { loaded: global.__LOADED, note: global.__EFB_BOOT.note, userExists: fs.existsSync(path.join(data, 'app-code')) };
}
assert.strictEqual(run(null).loaded, 'bundled');
assert.strictEqual(run({ v: '1.3.0' }).loaded, 'user');
assert.strictEqual(run({ v: '1.1.0' }).loaded, 'bundled');
const r = run({ v: '2.0.0', api: 9 }); assert.strictEqual(r.loaded, 'bundled'); assert(/neueren Installer/.test(r.note));
const bad = run({ v: '1.5.0', main: "throw new Error('kaputt');" }); assert.strictEqual(bad.loaded, 'bundled'); assert.strictEqual(bad.userExists, false);
console.log('✓ Kern: neuerer Code wird geladen, älterer/inkompatibler/defekter nicht');
