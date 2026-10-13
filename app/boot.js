// Fester Kern der App (ändert sich fast nie, nur über den Installer). Lädt den eigentlichen App-Code aus
// %APPDATA%\cockpit-efb-app\app-code, wenn dort eine neuere Version liegt (Update in der App), sonst den mitgelieferten.
'use strict';
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const SHELL_API = 1; // wird nur erhöht, wenn neuer App-Code eine neuere Hülle braucht (dann Installer nötig)

const meta = (d) => { try { return JSON.parse(fs.readFileSync(path.join(d, 'package.json'), 'utf8')); } catch { return {}; } };
const cmp = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0 ? 1 : -1; } return 0; };

const bundled = path.join(__dirname, 'code');
const user = path.join(app.getPath('userData'), 'app-code');
const u = meta(user), b = meta(bundled);
let dir = bundled, note = '';
if (u.version) {
  if ((u.shellApi || 1) > SHELL_API) note = `App-Code ${u.version} braucht einen neueren Installer.`;
  else if (cmp(u.version, b.version) > 0 && fs.existsSync(path.join(user, 'app-main.js'))) dir = user;
}
global.__EFB_BOOT = { codeDir: dir, shellDir: __dirname, shellApi: SHELL_API, bundledDir: bundled, userCodeDir: user, shellVersion: app.getVersion(), note };
try { require(path.join(dir, 'app-main.js')); } catch (e) {
  if (dir === bundled) throw e;
  console.error('App-Code in userData defekt, nutze mitgelieferten:', e);
  try { fs.rmSync(user, { recursive: true, force: true }); } catch { /* weg */ }
  global.__EFB_BOOT.codeDir = bundled; require(path.join(bundled, 'app-main.js'));
}
