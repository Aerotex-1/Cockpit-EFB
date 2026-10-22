// Windows-Firewall: eine Regel nur für den EFB-Port im privaten Netzwerk (damit das iPad zugreifen kann).
// Lesen braucht keine Rechte; Anlegen und Entfernen startet netsh mit Administrator-Abfrage (UAC).
'use strict';
const { execFile } = require('child_process');

const RULE = 'Cockpit EFB (iPad)';

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    execFile(cmd, args, { windowsHide: true, timeout: opts.timeout || 20000 }, (err, stdout, stderr) => resolve({ code: err ? (typeof err.code === 'number' ? err.code : 1) : 0, out: String(stdout || ''), err: String(stderr || '') }));
  });
}

const validPort = (p) => Number.isInteger(Number(p)) && Number(p) >= 1024 && Number(p) <= 65535;

// { supported, exists, port, ok }  ok = Regel vorhanden, für diesen Port, private Netzwerke, eingehend, erlaubt
async function status(port, { platform = process.platform, exec = run } = {}) {
  if (platform !== 'win32') return { supported: false };
  const r = await exec('netsh', ['advfirewall', 'firewall', 'show', 'rule', `name=${RULE}`, 'verbose']);
  if (r.code !== 0 || !/LocalPort|Lokaler Port/i.test(r.out)) return { supported: true, exists: false, ok: false };
  const m = /(?:LocalPort|Lokaler Port)\s*:\s*([^\r\n]+)/i.exec(r.out);
  const rulePort = m ? m[1].trim() : '';
  return { supported: true, exists: true, port: rulePort, ok: rulePort === String(port) };
}

// Führt ein PowerShell-Skript mit Administrator-Abfrage (UAC) aus. Bricht der Nutzer ab, kommt cancelled: true.
// Das Skript wird als Base64 übergeben, damit Anführungszeichen keine Rolle spielen.
async function elevated(script, { platform = process.platform, exec = run } = {}) {
  if (platform !== 'win32') return { ok: false, error: 'Nur unter Windows möglich.' };
  const inner = `try { ${script}; exit 0 } catch { exit 1 }`;
  const enc = Buffer.from(inner, 'utf16le').toString('base64');
  const outer = `try { $p = Start-Process -FilePath powershell.exe -ArgumentList '-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand','${enc}' -Verb RunAs -Wait -PassThru -WindowStyle Hidden; exit $p.ExitCode } catch { exit 1223 }`;
  const r = await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', outer], { timeout: 120000 });
  if (r.code === 1223) return { ok: false, cancelled: true };
  return r.code === 0 ? { ok: true } : { ok: false, error: `Fehlercode ${r.code}` };
}

// Eine Regel: eingehend, TCP, nur dieser Port, nur private Netzwerke. Eine ältere Regel gleichen Namens wird ersetzt.
async function add(port, opts) {
  if (!validPort(port)) return { ok: false, error: 'Ungültiger Port.' };
  return elevated(`Remove-NetFirewallRule -DisplayName '${RULE}' -ErrorAction SilentlyContinue; New-NetFirewallRule -DisplayName '${RULE}' -Direction Inbound -Action Allow -Protocol TCP -LocalPort ${Number(port)} -Profile Private -ErrorAction Stop | Out-Null`, opts);
}
async function remove(opts) { return elevated(`Remove-NetFirewallRule -DisplayName '${RULE}' -ErrorAction Stop`, opts); }

module.exports = { status, add, remove, RULE, validPort };
