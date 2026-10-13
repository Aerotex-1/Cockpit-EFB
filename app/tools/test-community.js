// Test: Community-Ordner finden und Modul installieren/erneuern (mit Testordnern)
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
const c = require('../code/lib/community');
const t = fs.mkdtempSync(path.join(os.tmpdir(), 'com-'));
const efb = path.join(t, 'efb'), mod = path.join(efb, 'community', 'cockpit-efb-link');
fs.mkdirSync(path.join(mod, 'html_ui'), { recursive: true }); fs.writeFileSync(path.join(mod, 'manifest.json'), '{"v":1}'); fs.writeFileSync(path.join(mod, 'html_ui', 'a.js'), 'x');
const pk = path.join(t, 'Packages'); fs.mkdirSync(path.join(pk, 'Community'), { recursive: true });
const la = path.join(t, 'la'), cfg = path.join(la, 'Packages', 'Microsoft.Limitless_8wekyb3d8bbwe', 'LocalCache');
fs.mkdirSync(cfg, { recursive: true }); fs.writeFileSync(path.join(cfg, 'UserCfg.opt'), `{Foo 1\nInstalledPackagesPath "${pk.replace(/\\/g, '\\\\')}"\n}`);
const env = { LOCALAPPDATA: la, APPDATA: path.join(t, 'ra') };
let s = c.status(efb, '', env); assert.equal(s.mode, 'auto'); assert.equal(s.dir, path.join(pk, 'Community')); assert(!s.installed);
let r = c.install(efb, '', env); assert(r.changed && r.upToDate);
assert.equal(fs.readFileSync(path.join(pk, 'Community', 'cockpit-efb-link', 'html_ui', 'a.js'), 'utf8'), 'x');
r = c.install(efb, '', env); assert(!r.changed);
fs.writeFileSync(path.join(mod, 'html_ui', 'a.js'), 'y'); // neue Version
s = c.status(efb, '', env); assert(s.installed && !s.upToDate);
r = c.install(efb, '', env); assert(r.changed); assert.equal(fs.readFileSync(path.join(pk, 'Community', 'cockpit-efb-link', 'html_ui', 'a.js'), 'utf8'), 'y');
// manuell: Community-Ordner selbst und Ordner darüber
const m2 = path.join(t, 'other', 'Community'); fs.mkdirSync(m2, { recursive: true });
assert.equal(c.resolve(m2, env).dir, m2); assert.equal(c.resolve(path.join(t, 'other'), env).dir, m2);
assert(c.resolve(path.join(t, 'nix'), env).error);
r = c.install(efb, m2, env); assert(r.changed && fs.existsSync(path.join(m2, 'cockpit-efb-link', 'manifest.json')));
// nicht gefunden
assert(c.resolve('', { LOCALAPPDATA: path.join(t, 'x'), APPDATA: path.join(t, 'y') }).error);
console.log('community ok');
