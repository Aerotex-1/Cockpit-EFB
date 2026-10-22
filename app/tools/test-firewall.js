// Testet die Firewall-Logik mit nachgestellten Windows-Befehlen (keine echte Firewall).
const assert = require('assert');
const fw = require('../code/lib/firewall');
(async () => {
  const calls = [];
  const mk = (map) => async (cmd, args) => { calls.push([cmd, args]); return map(cmd, args); };
  // nicht Windows
  assert.deepStrictEqual(await fw.status(8090, { platform: 'linux' }), { supported: false });
  assert.strictEqual((await fw.add(8090, { platform: 'linux' })).ok, false);
  // keine Regel (netsh meldet Code 1)
  assert.deepStrictEqual(await fw.status(8090, { platform: 'win32', exec: mk(() => ({ code: 1, out: 'No rules match the specified criteria.', err: '' })) }), { supported: true, exists: false, ok: false });
  // Regel vorhanden, englisch und deutsch, richtiger und falscher Port
  const en = (p) => mk(() => ({ code: 0, out: `Rule Name: Cockpit EFB (iPad)\r\nProtocol: TCP\r\nLocalPort: ${p}\r\nAction: Allow\r\n`, err: '' }));
  const de = (p) => mk(() => ({ code: 0, out: `Regelname: Cockpit EFB (iPad)\r\nProtokoll: TCP\r\nLokaler Port: ${p}\r\nAktion: Zulassen\r\n`, err: '' }));
  assert.strictEqual((await fw.status(8090, { platform: 'win32', exec: en(8090) })).ok, true);
  assert.strictEqual((await fw.status(8090, { platform: 'win32', exec: de(8090) })).ok, true);
  const wrong = await fw.status(8090, { platform: 'win32', exec: en(9000) });
  assert.strictEqual(wrong.exists, true); assert.strictEqual(wrong.ok, false); assert.strictEqual(wrong.port, '9000');
  // Anlegen: Skript enthält Port, Name, nur private Netzwerke; UAC per Start-Process -Verb RunAs
  calls.length = 0;
  let r = await fw.add(8090, { platform: 'win32', exec: mk(() => ({ code: 0, out: '', err: '' })) });
  assert.strictEqual(r.ok, true);
  const outer = calls[0][1].join(' ');
  assert.ok(/-Verb RunAs/.test(outer) && /-EncodedCommand/.test(outer));
  const b64 = /'-EncodedCommand','([A-Za-z0-9+/=]+)'/.exec(outer)[1];
  const inner = Buffer.from(b64, 'base64').toString('utf16le');
  assert.ok(/New-NetFirewallRule/.test(inner) && /-LocalPort 8090/.test(inner) && /-Profile Private/.test(inner) && /-Direction Inbound/.test(inner) && /-Protocol TCP/.test(inner), inner);
  // Abbruch der Administrator-Abfrage (Code 1223) und Fehler
  r = await fw.add(8090, { platform: 'win32', exec: mk(() => ({ code: 1223, out: '', err: '' })) });
  assert.deepStrictEqual(r, { ok: false, cancelled: true });
  r = await fw.remove({ platform: 'win32', exec: mk(() => ({ code: 5, out: '', err: '' })) });
  assert.strictEqual(r.ok, false); assert.ok(/5/.test(r.error));
  // Ungültige Ports werden nie an die Shell gereicht
  for (const bad of ['8090; calc', 80, 70000, 'abc', '']) { calls.length = 0; assert.strictEqual((await fw.add(bad, { platform: 'win32', exec: mk(() => ({ code: 0, out: '', err: '' })) })).ok, false); assert.strictEqual(calls.length, 0); }
  console.log('✓ Firewall: Status (en/de), Anlegen, Entfernen, Abbruch, Fehler, ungültige Ports');
})().catch((e) => { console.error('✗', e); process.exit(1); });
