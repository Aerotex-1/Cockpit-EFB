// Einstellungen der App (launcher.json im Datenordner). Der GitHub-Token wird mit Windows-Bordmitteln verschlüsselt, wenn möglich.
'use strict';
const fs = require('fs');
const DEFAULTS = {
  repo: '', token: '', edition: 'public', checkOnStart: true,
  autoStartServer: true, openBrowserOnStart: false, startWithWindows: false, closeStopsServer: true, openIn: 'browser', copilotOnStart: false, sttModel: '', communityDir: '', communityAuto: true,
};
function load(file, safe) {
  let o = {}; try { o = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* neu */ }
  const s = { ...DEFAULTS, ...o };
  if (o.tokenEnc && safe) { try { s.token = safe.decrypt(Buffer.from(o.tokenEnc, 'base64')); } catch { s.token = ''; } }
  delete s.tokenEnc;
  return s;
}
function save(file, s, safe) {
  const o = { ...s };
  if (o.token && safe && safe.available()) { o.tokenEnc = safe.encrypt(o.token).toString('base64'); delete o.token; }
  fs.writeFileSync(file, JSON.stringify(o, null, 2));
}
module.exports = { DEFAULTS, load, save };
