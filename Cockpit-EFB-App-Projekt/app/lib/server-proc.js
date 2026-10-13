// Startet und überwacht den EFB-Server (server.js) als Kindprozess.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class ServerProc extends EventEmitter {
  constructor({ execPath, cwd, env = {}, getPort }) {
    super();
    Object.assign(this, { execPath, cwd, env, getPort });
    this.child = null; this.status = 'stopped'; this.logs = []; this.want = false; this.lastExit = null;
  }
  _log(s) { for (const l of String(s).split(/\r?\n/)) if (l.trim()) { this.logs.push(l); if (this.logs.length > 300) this.logs.shift(); this.emit('log', l); } }
  _set(st) { this.status = st; this.emit('status', st); }
  port() { try { return JSON.parse(fs.readFileSync(path.join(this.cwd, 'config.json'), 'utf8')).port || 8090; } catch { return 8090; } }
  start() {
    if (this.child) return;
    if (!fs.existsSync(path.join(this.cwd, 'server.js'))) { this._log('server.js fehlt in ' + this.cwd); this._set('error'); return; }
    this.want = true; this._set('starting');
    const c = spawn(this.execPath, ['server.js'], { cwd: this.cwd, env: { ...process.env, ...this.env, EFB_LAUNCHER: 'app' }, windowsHide: true });
    this.child = c;
    c.stdout.on('data', (d) => this._log(d)); c.stderr.on('data', (d) => this._log(d));
    c.on('error', (e) => { this._log('Startfehler: ' + e.message); });
    c.on('exit', (code) => {
      this.child = null; this.lastExit = code;
      if (code === 42 && this.want) { this._log('Neustart nach Update …'); this._set('starting'); setTimeout(() => this.start(), 500); return; }
      this._set(this.want && code ? 'crashed' : 'stopped'); this.want = false;
    });
    this._wait();
  }
  async _wait() {
    const c = this.child;
    for (let i = 0; i < 60 && this.child === c && c; i++) {
      try { const r = await fetch(`http://127.0.0.1:${this.port()}/api/info`); if (r.ok) { if (this.child === c) this._set('running'); return; } } catch { /* noch nicht da */ }
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  stop() {
    this.want = false;
    return new Promise((res) => {
      const c = this.child; if (!c) { this._set('stopped'); return res(); }
      const t = setTimeout(() => { try { c.kill('SIGKILL'); } catch { /* weg */ } }, 4000);
      c.once('exit', () => { clearTimeout(t); res(); });
      try { c.kill(); } catch { res(); }
    });
  }
  async restart() { await this.stop(); this.start(); }
}
module.exports = { ServerProc };
