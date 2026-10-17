// Prüft die Tastenkürzel: Gültigkeit, Registrierung (mit Attrappe) und das Umschalten gegen einen kleinen Testserver.
'use strict';
const assert = require('assert'), http = require('http');
const hk = require('../code/lib/hotkeys');
for (const a of ['F9', 'Ctrl+Alt+M', 'numadd', 'Shift+F12', 'Ctrl+Space', 'Alt+num5', 'Ctrl+Enter', 'Insert']) assert(hk.valid(a), a);
for (const a of ['', 'Ctrl', 'Ctrl+', 'm', 'Ctrl+Alt+Mm', 'F25', 'Foo+M', null, 'Enter', 'Space', 'Tab', 'Backspace', 'M', 'Shift+M', 'Shift+Enter', 'Up']) assert(!hk.valid(a), String(a));

let mute = false, micmute = false; const events = [];
const srv = http.createServer((q, r) => {
  let b = ''; q.on('data', (c) => { b += c; }); q.on('end', () => {
    r.setHeader('content-type', 'application/json');
    if (q.url === '/api/cp/host') return r.end(JSON.stringify({ mute, micmute }));
    if (q.url === '/api/cp/event') { const o = JSON.parse(b); events.push(o); if (o.action === 'mute') mute = o.id === '1'; if (o.action === 'micmute') micmute = o.id === '1'; return r.end('{"ok":true}'); }
    r.statusCode = 404; r.end('{}');
  });
}).listen(0, '127.0.0.1', async () => {
  const port = srv.address().port, handlers = {};
  const gs = { unregisterAll() { for (const k of Object.keys(handlers)) delete handlers[k]; }, register(a, f) { if (a === 'F10') return false; handlers[a] = f; return true; } };
  let toggled = [];
  const res = hk.apply(gs, { hotkeyMic: 'F9', hotkeyMute: 'F10' }, () => port, (a, v) => toggled.push([a, v]));
  assert.deepStrictEqual(res, { mic: 'ok', mute: 'belegt' });
  assert.deepStrictEqual(hk.apply(gs, { hotkeyMic: '', hotkeyMute: 'x' }, () => port), { mic: 'off', mute: 'ungültig' });
  assert.strictEqual(hk.apply(gs, { hotkeyMic: 'F9', hotkeyMute: 'F9' }, () => port).mute, 'doppelt');
  hk.apply(gs, { hotkeyMic: 'F9', hotkeyMute: 'Ctrl+F8' }, () => port, (a, v) => toggled.push([a, v]));
  handlers.F9(); await new Promise((r) => setTimeout(r, 200));
  assert.strictEqual(micmute, true); assert.strictEqual(mute, false);
  handlers.F9(); await new Promise((r) => setTimeout(r, 200));
  assert.strictEqual(micmute, false);
  handlers['Ctrl+F8'](); await new Promise((r) => setTimeout(r, 200));
  assert.strictEqual(mute, true);
  assert.deepStrictEqual(toggled, [['micmute', true], ['micmute', false], ['mute', true]]);
  assert(events.every((e) => e.type === 'cmd' && e.from === 'app'));
  console.log('Tastenkürzel: ok'); srv.close();
});
