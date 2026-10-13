// Cockpit EFB – Windows-App (Electron): Server starten/stoppen, Copilot, Einstellungen, Updates.
'use strict';
const { app, BrowserWindow, ipcMain, shell, Menu, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { ServerProc } = require('./lib/server-proc');
const releases = require('./lib/releases');
const settingsStore = require('./lib/store');
const voiceLib = require('./lib/voices');

if (!app.requestSingleInstanceLock()) { app.quit(); }

const DATA = app.getPath('userData');
const EFB_DIR = path.join(DATA, 'efb');
const BUNDLE = app.isPackaged ? path.join(process.resourcesPath, 'efb') : path.join(__dirname, 'efb-bundle');
const SETTINGS_FILE = path.join(DATA, 'launcher.json');
const VOICES_USER = path.join(DATA, 'voices');
const VOICES_BUNDLED = app.isPackaged ? path.join(process.resourcesPath, 'voices') : path.join(__dirname, 'voices-bundle');
const PIPER_EXE = [path.join(process.resourcesPath || '', 'piper', 'piper', 'piper.exe'), path.join(__dirname, 'piper-bundle', 'piper', 'piper.exe')].find((p) => fs.existsSync(p)) || '';
const safe = { available: () => safeStorage.isEncryptionAvailable(), encrypt: (t) => safeStorage.encryptString(t), decrypt: (b) => safeStorage.decryptString(b) };
let S = null, win = null, efbWin = null, proc = null, updateInfo = { efb: null, app: null, error: null, checkedAt: 0 };

const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const efbVersion = () => readJson(path.join(EFB_DIR, 'package.json'), {}).version || '0.0.0';
const send = (ch, ...a) => { if (win && !win.isDestroyed()) win.webContents.send(ch, ...a); };

// Erste Einrichtung bzw. neuere mitgelieferte EFB (nach Installer-Update) über die vorhandene legen.
// Der Updater überschreibt nur Programmdateien: Logbuch, Charts, Einstellungen, PIN, Hintergründe bleiben.
function seed() {
  const bundled = readJson(path.join(BUNDLE, 'package.json'), {}).version;
  if (!bundled) return;
  const inst = fs.existsSync(path.join(EFB_DIR, 'server.js')) ? efbVersion() : null;
  if (inst === null || releases.cmp(bundled, inst) > 0) {
    fs.mkdirSync(EFB_DIR, { recursive: true });
    require(path.join(BUNDLE, 'updater.js')).installDir(BUNDLE, EFB_DIR);
  }
}
const updaterFor = () => require(fs.existsSync(path.join(EFB_DIR, 'updater.js')) ? path.join(EFB_DIR, 'updater.js') : path.join(BUNDLE, 'updater.js'));

function nodePath() { return [path.join(__dirname, 'node_modules'), path.join(process.resourcesPath || '', 'app', 'node_modules')].join(path.delimiter); }

async function doCheck() {
  if (!S.repo) { updateInfo = { efb: null, app: null, error: 'Noch kein Repository eingetragen (Einstellungen → Updates).', checkedAt: Date.now() }; return updateInfo; }
  try {
    const r = await releases.check({ repo: S.repo, token: S.token, edition: S.edition, efbVersion: efbVersion(), appVersion: app.getVersion() });
    updateInfo = { efb: r.efb, app: r.app, latestEfb: r.latestEfb, error: null, checkedAt: Date.now() };
  } catch (e) { updateInfo = { efb: null, app: null, error: e.message, checkedAt: Date.now() }; }
  send('update:info', updateInfo);
  return updateInfo;
}

async function installEfb() {
  const u = updateInfo.efb; if (!u) throw new Error('Kein Update vorhanden.');
  send('update:progress', { what: 'efb', text: 'Lade ' + u.asset.name + ' …', p: 0 });
  const buf = await releases.download(u.asset, { token: S.token, onProgress: (p) => send('update:progress', { what: 'efb', text: 'Lade …', p }) });
  send('update:progress', { what: 'efb', text: 'Installiere …', p: 1 });
  const wasRunning = proc.status === 'running' || proc.status === 'starting';
  await proc.stop();
  const res = updaterFor().install(buf, EFB_DIR);
  if (wasRunning) proc.start();
  updateInfo.efb = null; send('update:info', updateInfo);
  return res;
}

async function installApp() {
  const u = updateInfo.app; if (!u) throw new Error('Kein App-Update vorhanden.');
  const buf = await releases.download(u.asset, { token: S.token, onProgress: (p) => send('update:progress', { what: 'app', text: 'Lade Installer …', p }) });
  const f = path.join(os.tmpdir(), u.asset.name); fs.writeFileSync(f, buf);
  await proc.stop();
  spawn(f, [], { detached: true, stdio: 'ignore' }).unref();
  app.quit();
}

function openEfb(mode) {
  const url = `http://localhost:${proc.port()}/`;
  if ((mode || S.openIn) === 'window') {
    if (efbWin && !efbWin.isDestroyed()) return efbWin.focus();
    efbWin = new BrowserWindow({ width: 1280, height: 860, title: 'Cockpit EFB', autoHideMenuBar: true });
    efbWin.loadURL(url);
  } else shell.openExternal(url);
}

function applyLogin() { try { app.setLoginItemSettings({ openAtLogin: !!S.startWithWindows }); } catch { /* nicht unterstützt */ } }

function state() {
  return { status: proc.status, port: proc.port(), efbVersion: efbVersion(), appVersion: app.getVersion(), settings: { ...S, token: S.token ? '••••' : '' }, update: updateInfo, logs: proc.logs.slice(-150), efbDir: EFB_DIR, lastExit: proc.lastExit };
}

function copilotFile() { return path.join(EFB_DIR, 'copilot.json'); }

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  S = settingsStore.load(SETTINGS_FILE, safe);
  seed();
  proc = new ServerProc({ execPath: process.execPath, cwd: EFB_DIR, env: { ELECTRON_RUN_AS_NODE: '1', NODE_PATH: nodePath(), EFB_PIPER: PIPER_EXE, EFB_VOICES: VOICES_USER, EFB_VOICES_BUNDLED: VOICES_BUNDLED }, getPort: null });
  proc.on('status', (st) => { send('status', st); if (st === 'running' && S.openBrowserOnStart && !proc._opened) { proc._opened = true; openEfb(); } });
  proc.on('log', (l) => send('log', l));

  ipcMain.handle('state', () => state());
  ipcMain.handle('server:start', () => { proc.start(); });
  ipcMain.handle('server:stop', () => proc.stop());
  ipcMain.handle('server:restart', () => proc.restart());
  ipcMain.handle('efb:open', (_e, mode) => openEfb(mode));
  ipcMain.handle('folder:open', () => shell.openPath(EFB_DIR));
  ipcMain.handle('settings:set', async (_e, patch) => {
    const portNew = patch.port; delete patch.port;
    if (patch.token === '••••') delete patch.token;
    S = { ...S, ...patch }; settingsStore.save(SETTINGS_FILE, S, safe); applyLogin();
    if (portNew) {
      const cf = path.join(EFB_DIR, 'config.json'), c = readJson(cf, {});
      if (Number(portNew) >= 1024 && Number(portNew) <= 65535 && c.port !== Number(portNew)) { c.port = Number(portNew); fs.writeFileSync(cf, JSON.stringify(c, null, 2)); if (proc.status === 'running') await proc.restart(); }
    }
    return state();
  });
  ipcMain.handle('copilot:get', () => readJson(copilotFile(), {}));
  ipcMain.handle('copilot:set', (_e, patch) => { const o = { ...readJson(copilotFile(), {}), ...patch }; if (patch.voice) o.voice = { ...(readJson(copilotFile(), {}).voice || {}), ...patch.voice }; fs.writeFileSync(copilotFile(), JSON.stringify(o, null, 2)); return o; });
  ipcMain.handle('voices:list', () => ({ voices: voiceLib.list({ userDir: VOICES_USER, bundledDir: VOICES_BUNDLED }), piper: !!PIPER_EXE }));
  ipcMain.handle('voices:install', async (_e, id) => { await voiceLib.install(id, { userDir: VOICES_USER, onProgress: (p) => send('voices:progress', id, p) }); return voiceLib.list({ userDir: VOICES_USER, bundledDir: VOICES_BUNDLED }); });
  ipcMain.handle('voices:remove', (_e, id) => { voiceLib.remove(id, { userDir: VOICES_USER }); return voiceLib.list({ userDir: VOICES_USER, bundledDir: VOICES_BUNDLED }); });
  ipcMain.handle('update:check', () => doCheck());
  ipcMain.handle('update:efb', () => installEfb());
  ipcMain.handle('update:app', () => installApp());

  win = new BrowserWindow({ width: 980, height: 720, minWidth: 760, minHeight: 560, title: 'Cockpit EFB', backgroundColor: '#0d1520', webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false } });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.on('before-input-event', (e, i) => { if (i.type === 'keyDown' && (i.key === 'F12' || (i.control && i.shift && i.key.toLowerCase() === 'i'))) win.webContents.toggleDevTools(); });
  win.webContents.on('preload-error', (_e, p, err) => { console.error('preload-error', p, err); });
  win.on('close', async (e) => { if (S.closeStopsServer && proc.child) { e.preventDefault(); await proc.stop(); win.destroy(); } });

  if (S.autoStartServer) proc.start();
  applyLogin();
  if (S.checkOnStart && S.repo) setTimeout(doCheck, 3000);
  setInterval(() => { if (S.checkOnStart && S.repo) doCheck(); }, 6 * 3600 * 1000);
});
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => app.quit());
