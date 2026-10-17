// Cockpit EFB – Windows-App (Electron): Server starten/stoppen, Copilot, Einstellungen, Updates.
'use strict';
const { app, BrowserWindow, ipcMain, shell, Menu, safeStorage, dialog, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { ServerProc } = require('./lib/server-proc');
const releases = require('./lib/releases');
const settingsStore = require('./lib/store');
const voiceLib = require('./lib/voices');
const whisperLib = require('./lib/whisper');
const kokoroLib = require('./lib/kokoro');
const communityLib = require('./lib/community');
const editionLib = require('./lib/editions');
const hotkeys = require('./lib/hotkeys');

if (!app.requestSingleInstanceLock()) { app.quit(); }

const DATA = app.getPath('userData');
const EFB_DIR = path.join(DATA, 'efb');
const BOOT = global.__EFB_BOOT || { shellDir: path.join(__dirname, '..'), bundledDir: __dirname, userCodeDir: path.join(app.getPath('userData'), 'app-code'), shellVersion: app.getVersion() };
const CODE_VERSION = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version; } catch { return '0.0.0'; } })();
const BUNDLE = app.isPackaged ? path.join(process.resourcesPath, 'efb') : path.join(BOOT.shellDir, 'efb-bundle');
const WHISPER_DIR = path.join(app.getPath('userData'), 'whisper');
const KOKORO_DIR = path.join(app.getPath('userData'), 'kokoro');
const SETTINGS_FILE = path.join(DATA, 'launcher.json');
const VOICES_USER = path.join(DATA, 'voices');
const VOICES_BUNDLED = app.isPackaged ? path.join(process.resourcesPath, 'voices') : path.join(BOOT.shellDir, 'voices-bundle');
const PIPER_EXE = [path.join(process.resourcesPath || '', 'piper', 'piper', 'piper.exe'), path.join(BOOT.shellDir, 'piper-bundle', 'piper', 'piper.exe')].find((p) => fs.existsSync(p)) || '';
const safe = { available: () => safeStorage.isEncryptionAvailable(), encrypt: (t) => safeStorage.encryptString(t), decrypt: (b) => safeStorage.decryptString(b) };
let S = null, win = null, efbWin = null, cpWin = null, proc = null, updateInfo = { efb: null, code: null, shell: null, error: null, checkedAt: 0 };

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

function nodePath() { return [path.join(BOOT.shellDir, 'node_modules'), path.join(process.resourcesPath || '', 'app', 'node_modules')].join(path.delimiter); }

async function doCheck() {
  if (!S.repo) { updateInfo = { efb: null, code: null, shell: null, error: 'Noch kein Repository eingetragen (Einstellungen → Updates).', checkedAt: Date.now() }; return updateInfo; }
  try {
    const r = await releases.check({ repo: S.repo, token: S.token, edition: S.edition, efbVersion: efbVersion(), codeVersion: CODE_VERSION, shellVersion: BOOT.shellVersion });
    updateInfo = { efb: r.efb, code: r.code, shell: r.shell, latestEfb: r.latestEfb, error: null, checkedAt: Date.now() };
  } catch (e) { updateInfo = { efb: null, code: null, shell: null, error: e.message, checkedAt: Date.now() }; }
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
  try { communitySync(); } catch { /* egal */ }
  if (wasRunning) proc.start();
  updateInfo.efb = null; send('update:info', updateInfo);
  return res;
}

// App-Oberfläche aktualisieren (ohne Installer): ZIP nach userData/app-code entpacken, App neu starten
async function installCode() {
  const u = updateInfo.code; if (!u) throw new Error('Kein App-Update vorhanden.');
  send('update:progress', { what: 'code', text: 'Lade ' + u.asset.name + ' …', p: 0 });
  const buf = await releases.download(u.asset, { token: S.token, onProgress: (p) => send('update:progress', { what: 'code', text: 'Lade …', p }) });
  const files = updaterFor().readZip(buf);
  const pk = files.find((f) => /(^|\/)package\.json$/.test(f.name) && f.name.split('/').length <= 2);
  if (!pk) throw new Error('Kein App-Update: package.json fehlt.');
  const meta = JSON.parse(pk.data.toString('utf8'));
  if (meta.name !== 'cockpit-efb-app-code') throw new Error('Das ist kein App-Update.');
  if ((meta.shellApi || 1) > BOOT.shellApi) throw new Error('Dieses Update braucht den neuen Installer (siehe unten).');
  const prefix = pk.name.slice(0, pk.name.length - 'package.json'.length);
  if (!files.some((f) => f.name === prefix + 'app-main.js')) throw new Error('app-main.js fehlt im Update.');
  const tmp = BOOT.userCodeDir + '.new';
  fs.rmSync(tmp, { recursive: true, force: true });
  for (const f of files) {
    if (!f.name.startsWith(prefix)) continue;
    const rel = f.name.slice(prefix.length);
    if (!rel || rel.includes('..') || path.isAbsolute(rel)) continue;
    const dst = path.join(tmp, rel); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.writeFileSync(dst, f.data);
  }
  fs.rmSync(BOOT.userCodeDir, { recursive: true, force: true });
  fs.renameSync(tmp, BOOT.userCodeDir);
  send('update:progress', { what: 'code', text: 'Starte neu …', p: 1 });
  await proc.stop();
  app.relaunch(); app.exit(0);
}

// Seltener Fall (neue Electron-Version): Installer still im Hintergrund ausführen und die App danach wieder starten
async function installShell() {
  const u = updateInfo.shell; if (!u) throw new Error('Kein Installer-Update vorhanden.');
  const buf = await releases.download(u.asset, { token: S.token, onProgress: (p) => send('update:progress', { what: 'shell', text: 'Lade Installer …', p }) });
  const f = path.join(os.tmpdir(), u.asset.name); fs.writeFileSync(f, buf);
  const cmd = path.join(os.tmpdir(), 'efb-update.cmd');
  fs.writeFileSync(cmd, `@echo off\r\nping -n 4 127.0.0.1 >nul\r\n"${f}" /S\r\nstart "" "${process.execPath}"\r\n`);
  await proc.stop();
  spawn('cmd.exe', ['/c', cmd], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
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

// Copilot-Fenster: spricht über die Kopfhörer des PCs und hört per Mikrofon zu; das iPad zeigt nur die Checkliste
function openCopilot() {
  if (cpWin && !cpWin.isDestroyed()) { cpWin.show(); return cpWin.focus(); }
  cpWin = new BrowserWindow({ width: 560, height: 760, title: 'Cockpit Copilot', autoHideMenuBar: true, webPreferences: { autoplayPolicy: 'no-user-gesture-required', backgroundThrottling: false } });
  cpWin.loadURL(`http://127.0.0.1:${proc.port()}/?host=1`);
  cpWin.on('closed', () => { cpWin = null; });
}
const whisperEnv = () => whisperLib.env(WHISPER_DIR, S.sttModel);
async function sttApply() { Object.assign(proc.env, whisperEnv()); if (proc.status === 'running') { await proc.restart(); if (cpWin && !cpWin.isDestroyed()) setTimeout(() => cpWin && !cpWin.isDestroyed() && cpWin.reload(), 2500); } }
async function kokoroApply() { Object.assign(proc.env, kokoroLib.env(KOKORO_DIR)); if (proc.status === 'running') { await proc.restart(); if (cpWin && !cpWin.isDestroyed()) setTimeout(() => cpWin && !cpWin.isDestroyed() && cpWin.reload(), 2500); } }
const sttState = () => ({ ...whisperLib.status(WHISPER_DIR, S.sttModel), cores: os.cpus().length });

// Sim-Modul im Community-Ordner: beim Start und nach EFB-Updates automatisch installieren bzw. erneuern
function communityState() { try { return communityLib.status(EFB_DIR, S.communityDir); } catch (e) { return { error: e.message }; } }
function communitySync(force) {
  if (!force && !S.communityAuto) return communityState();
  try { const r = communityLib.install(EFB_DIR, S.communityDir); if (r.changed) send('log', '[App] Sim-Modul aktualisiert: ' + r.target); return r; } catch (e) { return { ...communityState(), error: e.message }; }
}

let hotkeyState = { mic: 'off', mute: 'off' };
function applyHotkeys() {
  try { hotkeyState = hotkeys.apply(globalShortcut, S, () => proc.port(), () => { try { shell.beep(); } catch { /* egal */ } }); }
  catch { hotkeyState = { mic: 'ungültig', mute: 'ungültig' }; }
  // Unzulässige gespeicherte Tasten (z. B. „Enter“ aus einer älteren Version) werden entfernt, damit sie nichts im System blockieren
  let fixed = false;
  for (const [k, key] of [['mic', 'hotkeyMic'], ['mute', 'hotkeyMute']]) if (hotkeyState[k] === 'ungültig' && S[key]) { S[key] = ''; fixed = true; }
  if (fixed) { try { settingsStore.save(SETTINGS_FILE, S, safe); } catch { /* egal */ } }
  return hotkeyState;
}
function applyLogin() { try { app.setLoginItemSettings({ openAtLogin: !!S.startWithWindows }); } catch { /* nicht unterstützt */ } }

const editionState = () => { try { return editionLib.status(EFB_DIR, BUNDLE); } catch (e) { return { supported: false, current: { id: 'full', name: 'Voll', tabs: [] }, editions: [], tabs: [], error: e.message }; } };
function state() {
  return { edition: editionState(), status: proc.status, port: proc.port(), efbVersion: efbVersion(), appVersion: CODE_VERSION, shellVersion: BOOT.shellVersion, bootNote: BOOT.note || '', settings: { ...S, token: S.token ? '••••' : '' }, hotkeys: hotkeyState, update: updateInfo, logs: proc.logs.slice(-150), efbDir: EFB_DIR, lastExit: proc.lastExit };
}

// Eigene Sounds des Bodenpersonals: Ordner „sounds“ in der EFB, Dateiname = Ereignis (z. B. pushback.ack.S1.mp3)
const SOUNDS_DIR = () => path.join(EFB_DIR, 'sounds');
const SND_RE = /^[\w.-]{1,60}$/;
function soundList() {
  try { return fs.readdirSync(SOUNDS_DIR()).filter((f) => /\.(mp3|wav|ogg)$/i.test(f)).map((f) => ({ key: f.replace(/\.[^.]+$/, ''), file: f, path: path.join(SOUNDS_DIR(), f) })); } catch { return []; }
}
function soundRemove(key) { for (const f of soundList()) if (f.key.toLowerCase() === key.toLowerCase()) try { fs.unlinkSync(f.path); } catch { /* weg */ } }

function copilotFile() { return path.join(EFB_DIR, 'copilot.json'); }

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  S = settingsStore.load(SETTINGS_FILE, safe);
  seed();
  proc = new ServerProc({ execPath: process.execPath, cwd: EFB_DIR, env: { ELECTRON_RUN_AS_NODE: '1', NODE_PATH: nodePath(), EFB_PIPER: PIPER_EXE, EFB_VOICES: VOICES_USER, EFB_VOICES_BUNDLED: VOICES_BUNDLED, ...whisperEnv(), ...kokoroLib.env(KOKORO_DIR) }, getPort: null });
  // Mikrofon nur für die lokale EFB erlauben
  const okOrigin = (u) => /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(u || '');
  const ses = require('electron').session.defaultSession;
  ses.setPermissionRequestHandler((wc, perm, cb, det) => cb(perm === 'media' && okOrigin(det && det.requestingUrl)));
  ses.setPermissionCheckHandler((wc, perm, origin) => perm === 'media' && okOrigin(origin + '/'));
  proc.on('status', (st) => { send('status', st); if (st === 'running' && S.openBrowserOnStart && !proc._opened) { proc._opened = true; openEfb(); } if (st === 'running' && S.copilotOnStart && !proc._cpOpened && (() => { const t = editionState().current.tabs; return !t.length || t.includes('copilot'); })()) { proc._cpOpened = true; openCopilot(); } });
  proc.on('log', (l) => {
    // Vom iPad aus „Copilot starten“ gedrückt, aber am PC läuft kein Copilot-Fenster: öffnen
    if (String(l).includes('@@EFB:COPILOT_OPEN@@')) { try { const t = editionState().current.tabs; if (proc.status === 'running' && releases.cmp(efbVersion(), '1.2.0') >= 0 && (!t.length || t.includes('copilot'))) openCopilot(); } catch { /* egal */ } return; }
    send('log', l);
  });

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
    if ('hotkeyMic' in patch || 'hotkeyMute' in patch) applyHotkeys();
    if (portNew) {
      const cf = path.join(EFB_DIR, 'config.json'), c = readJson(cf, {});
      if (Number(portNew) >= 1024 && Number(portNew) <= 65535 && c.port !== Number(portNew)) { c.port = Number(portNew); fs.writeFileSync(cf, JSON.stringify(c, null, 2)); if (proc.status === 'running') await proc.restart(); }
    }
    return state();
  });
  ipcMain.handle('copilot:open', () => { if (proc.status !== 'running') throw new Error('Der Server läuft nicht.'); { const t = editionState().current.tabs; if (t.length && !t.includes('copilot')) throw new Error('Die gewählte Version hat keinen Copilot. Wechsle unter „Version“.'); } if (releases.cmp(efbVersion(), '1.2.0') < 0) throw new Error('Das Copilot-Fenster braucht EFB 1.2.0 oder neuer. Bitte unter „Updates“ zuerst die EFB aktualisieren.'); openCopilot(); });
  ipcMain.handle('edition:get', () => editionState());
  ipcMain.handle('edition:set', (_e, sel) => {
    const r = editionLib.set(EFB_DIR, BUNDLE, sel);
    S = { ...S, editionChosen: true }; settingsStore.save(SETTINGS_FILE, S, safe);
    if (r.current && r.current.tabs.includes('copilot')) { try { communitySync(); } catch { /* egal */ } } // Sim-Modul (enthält die Copilot-Einstellungen im Sim-EFB) auf dem neuesten Stand
    else if (cpWin && !cpWin.isDestroyed()) cpWin.close();
    return r;
  });
  ipcMain.handle('sounds:list', () => soundList());
  ipcMain.handle('sounds:folder', () => { fs.mkdirSync(SOUNDS_DIR(), { recursive: true }); return shell.openPath(SOUNDS_DIR()); });
  ipcMain.handle('sounds:set', async (_e, key) => {
    if (!SND_RE.test(String(key))) throw new Error('Ungültiger Name.');
    const r = await dialog.showOpenDialog(win, { title: 'Sound auswählen', properties: ['openFile'], filters: [{ name: 'Audio (MP3, WAV, OGG)', extensions: ['mp3', 'wav', 'ogg'] }] });
    if (r.canceled || !r.filePaths[0]) return soundList();
    const src = r.filePaths[0];
    if (fs.statSync(src).size > 15e6) throw new Error('Die Datei ist größer als 15 MB.');
    fs.mkdirSync(SOUNDS_DIR(), { recursive: true });
    soundRemove(key);
    fs.copyFileSync(src, path.join(SOUNDS_DIR(), key + path.extname(src).toLowerCase()));
    return soundList();
  });
  ipcMain.handle('sounds:remove', (_e, key) => { if (SND_RE.test(String(key))) soundRemove(key); return soundList(); });
  ipcMain.handle('community:status', () => communityState());
  ipcMain.handle('community:install', () => communitySync(true));
  ipcMain.handle('community:pick', async () => {
    const r = await dialog.showOpenDialog(win, { title: 'Community-Ordner von MSFS 2024 wählen', properties: ['openDirectory'] });
    if (r.canceled || !r.filePaths[0]) return communityState();
    if (!communityLib.normalizeManual(r.filePaths[0])) throw new Error('Das ist kein Community-Ordner. Er heißt „Community“ oder enthält einen Ordner dieses Namens.');
    S = { ...S, communityDir: r.filePaths[0] }; settingsStore.save(SETTINGS_FILE, S, safe);
    return communitySync(true);
  });
  ipcMain.handle('community:auto', () => { S = { ...S, communityDir: '' }; settingsStore.save(SETTINGS_FILE, S, safe); return communityState(); });
  ipcMain.handle('stt:status', () => sttState());
  ipcMain.handle('stt:install', async (_e, id) => {
    const prog = (what) => (p) => send('stt:progress', { what, p });
    if (!whisperLib.status(WHISPER_DIR).binary) await whisperLib.installBinary(WHISPER_DIR, { readZip: updaterFor().readZip, onProgress: prog('Programm') });
    await whisperLib.installModel(WHISPER_DIR, id, { onProgress: prog('Modell') });
    S = { ...S, sttModel: id }; settingsStore.save(SETTINGS_FILE, S, safe);
    await sttApply(); return sttState();
  });
  ipcMain.handle('stt:use', async (_e, id) => { S = { ...S, sttModel: id }; settingsStore.save(SETTINGS_FILE, S, safe); await sttApply(); return sttState(); });
  ipcMain.handle('stt:remove', async (_e, id) => { whisperLib.removeModel(WHISPER_DIR, id); await sttApply(); return sttState(); });
  ipcMain.handle('kokoro:status', () => kokoroLib.status(KOKORO_DIR));
  ipcMain.handle('kokoro:install', async () => { await kokoroLib.install(KOKORO_DIR, { onProgress: (what, p) => send('kokoro:progress', { what, p }) }); await kokoroApply(); return kokoroLib.status(KOKORO_DIR); });
  ipcMain.handle('kokoro:remove', async () => { kokoroLib.remove(KOKORO_DIR); await kokoroApply(); return kokoroLib.status(KOKORO_DIR); });
  ipcMain.handle('copilot:get', () => readJson(copilotFile(), {}));
  ipcMain.handle('copilot:set', (_e, patch) => { const o = { ...readJson(copilotFile(), {}), ...patch }; if (patch.voice) o.voice = { ...(readJson(copilotFile(), {}).voice || {}), ...patch.voice }; fs.writeFileSync(copilotFile(), JSON.stringify(o, null, 2)); return o; });
  ipcMain.handle('voices:list', () => ({ voices: voiceLib.list({ userDir: VOICES_USER, bundledDir: VOICES_BUNDLED }), piper: !!PIPER_EXE }));
  ipcMain.handle('voices:install', async (_e, id) => { await voiceLib.install(id, { userDir: VOICES_USER, onProgress: (p) => send('voices:progress', id, p) }); return voiceLib.list({ userDir: VOICES_USER, bundledDir: VOICES_BUNDLED }); });
  ipcMain.handle('voices:remove', (_e, id) => { voiceLib.remove(id, { userDir: VOICES_USER }); return voiceLib.list({ userDir: VOICES_USER, bundledDir: VOICES_BUNDLED }); });
  ipcMain.handle('update:check', () => doCheck());
  ipcMain.handle('update:efb', () => installEfb());
  ipcMain.handle('update:code', () => installCode());
  ipcMain.handle('update:shell', () => installShell());

  win = new BrowserWindow({ width: 980, height: 720, minWidth: 760, minHeight: 560, title: 'Cockpit EFB', backgroundColor: '#0d1520', webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false } });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.on('before-input-event', (e, i) => { if (i.type === 'keyDown' && (i.key === 'F12' || (i.control && i.shift && i.key.toLowerCase() === 'i'))) win.webContents.toggleDevTools(); });
  win.webContents.on('preload-error', (_e, p, err) => { console.error('preload-error', p, err); });
  win.on('close', async (e) => { if (S.closeStopsServer && proc.child) { e.preventDefault(); await proc.stop(); win.destroy(); } });

  setTimeout(() => { try { communitySync(); } catch { /* egal */ } }, 1500);
  if (S.autoStartServer) proc.start();
  applyLogin(); applyHotkeys();
  if (S.checkOnStart && S.repo) setTimeout(doCheck, 3000);
  setInterval(() => { if (S.checkOnStart && S.repo) doCheck(); }, 6 * 3600 * 1000);
});
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => { try { globalShortcut.unregisterAll(); } catch { /* egal */ } });
