// Spotify-Fernbedienung über die Spotify Web API (Anmeldung per PKCE, ohne Client-Secret).
// Die Anmeldung läuft einmal am PC im Browser; danach steuert das iPad die Wiedergabe über die PC-Brücke.
// Die Wiedergabe selbst braucht Spotify Premium und ein aktives Gerät (z. B. die Spotify-App am PC).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ACCOUNTS = process.env.SPOTIFY_ACCOUNTS_BASE || 'https://accounts.spotify.com';
const API = process.env.SPOTIFY_API_BASE || 'https://api.spotify.com/v1';
const TOKEN_FILE = path.join(__dirname, 'spotify-token.json');
const SCOPES = 'user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private playlist-read-collaborative';

const b64u = (b) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

class Spotify {
  constructor(getConfig, port, demo) {
    this.demo = demo ? new (require('./spotify-demo'))() : null;
    this.getConfig = getConfig;
    this.port = port;
    this.pending = new Map(); // state -> verifier
    this.tok = null;
    try { this.tok = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')); } catch { /* noch nicht angemeldet */ }
  }

  get clientId() { return String(this.getConfig().spotifyClientId || '').trim(); }
  get redirectUri() { return `http://127.0.0.1:${this.port}/api/spotify/callback`; }
  status() { if (this.demo) return this.demo.status(); return { configured: !!this.clientId, loggedIn: !!(this.tok && this.tok.refresh), redirectUri: this.redirectUri, loginUrl: `http://127.0.0.1:${this.port}/api/spotify/login` }; }

  loginUrl() {
    const verifier = b64u(crypto.randomBytes(48));
    const state = b64u(crypto.randomBytes(12));
    this.pending.set(state, verifier);
    setTimeout(() => this.pending.delete(state), 10 * 60000);
    const q = new URLSearchParams({
      client_id: this.clientId, response_type: 'code', redirect_uri: this.redirectUri, scope: SCOPES, state,
      code_challenge_method: 'S256', code_challenge: b64u(crypto.createHash('sha256').update(verifier).digest()),
    });
    return `${ACCOUNTS}/authorize?${q}`;
  }

  async _token(params) {
    const r = await fetch(`${ACCOUNTS}/api/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: this.clientId, ...params }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.access_token) throw new Error(d.error_description || d.error || `Spotify-Anmeldung fehlgeschlagen (${r.status})`);
    this.tok = { access: d.access_token, refresh: d.refresh_token || (this.tok && this.tok.refresh), expires: Date.now() + (d.expires_in - 60) * 1000 };
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(this.tok), { mode: 0o600 });
  }

  async callback(code, state) {
    const verifier = this.pending.get(state);
    if (!verifier) throw new Error('Anmeldung abgelaufen. Bitte noch einmal starten.');
    this.pending.delete(state);
    await this._token({ grant_type: 'authorization_code', code, redirect_uri: this.redirectUri, code_verifier: verifier });
  }

  logout() { this.tok = null; try { fs.unlinkSync(TOKEN_FILE); } catch { /* egal */ } }

  async _access() {
    if (!this.tok) throw new Error('Nicht bei Spotify angemeldet.');
    if (Date.now() >= this.tok.expires) await this._token({ grant_type: 'refresh_token', refresh_token: this.tok.refresh });
    return this.tok.access;
  }

  async api(method, p, body) {
    let r;
    for (let attempt = 0; attempt < 2; attempt++) {
      const access = await this._access();
      r = await fetch(API + p, { method, headers: { Authorization: `Bearer ${access}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
      if (r.status === 401 && attempt === 0) { this.tok.expires = 0; continue; }
      break;
    }
    if (r.status === 204 || r.status === 202) return { ok: true, data: null };
    const d = await r.json().catch(() => null);
    if (!r.ok) {
      const reason = d && d.error && (d.error.reason || d.error.message);
      const msg = reason === 'NO_ACTIVE_DEVICE' || r.status === 404 ? 'Kein aktives Gerät. Starte Spotify am PC oder wähle unten ein Gerät.'
        : reason === 'PREMIUM_REQUIRED' || r.status === 403 ? 'Dafür braucht der Account Spotify Premium.'
          : r.status === 429 ? 'Spotify bremst gerade. Gleich nochmal versuchen.' : (d && d.error && d.error.message) || `Spotify-Fehler ${r.status}`;
      return { ok: false, error: msg, status: r.status };
    }
    return { ok: true, data: d };
  }

  async player() {
    if (this.demo) return this.demo.player();
    const r = await this.api('GET', '/me/player?additional_types=episode');
    if (!r.ok) return r;
    const d = r.data;
    if (!d || !d.item) return { ok: true, active: false, device: d && d.device ? { id: d.device.id, name: d.device.name } : null };
    const it = d.item;
    const imgs = (it.album && it.album.images) || (it.images) || [];
    const art = (imgs.find((i) => i.width && i.width <= 400 && i.width >= 200) || imgs[0] || {}).url || '';
    return {
      ok: true, active: true, playing: !!d.is_playing, title: it.name,
      artist: (it.artists || []).map((a) => a.name).join(', ') || (it.show && it.show.name) || '',
      album: (it.album && it.album.name) || '', art, progress: d.progress_ms || 0, duration: it.duration_ms || 0,
      volume: d.device ? d.device.volume_percent : null, shuffle: !!d.shuffle_state, repeat: d.repeat_state || 'off',
      device: d.device ? { id: d.device.id, name: d.device.name, type: d.device.type } : null, ctx: d.context ? d.context.uri : '', at: Date.now(),
    };
  }

  async playlists() {
    if (this.demo) return this.demo.playlists();
    const r = await this.api('GET', '/me/playlists?limit=50');
    if (!r.ok) return r;
    return {
      ok: true,
      items: ((r.data && r.data.items) || []).filter(Boolean).map((p) => ({
        name: p.name, uri: p.uri, art: ((p.images || [])[0] || {}).url || '', count: (p.tracks && p.tracks.total) ?? (p.items && p.items.total) ?? null,
      })),
    };
  }

  async search(q) {
    q = String(q || '').trim().slice(0, 100);
    if (!q) return { ok: true, tracks: [], artists: [], albums: [], playlists: [] };
    if (this.demo) return this.demo.search(q);
    const r = await this.api('GET', `/search?q=${encodeURIComponent(q)}&type=track,artist,album,playlist&limit=6`);
    if (!r.ok) return r;
    const d = r.data || {}, art = (o) => ((o.images || o.album && o.album.images || [])[0] || {}).url || '', items = (k) => ((d[k] && d[k].items) || []).filter(Boolean);
    return {
      ok: true,
      tracks: items('tracks').map((t) => ({ name: t.name, sub: (t.artists || []).map((a) => a.name).join(', '), uri: t.uri, art: art(t), kind: 'track' })),
      artists: items('artists').map((a) => ({ name: a.name, sub: 'Künstler', uri: a.uri, art: art(a), kind: 'context' })),
      albums: items('albums').map((a) => ({ name: a.name, sub: (a.artists || []).map((x) => x.name).join(', '), uri: a.uri, art: art(a), kind: 'context' })),
      playlists: items('playlists').map((p) => ({ name: p.name, sub: (p.owner && p.owner.display_name) || 'Playlist', uri: p.uri, art: art(p), kind: 'context' })),
    };
  }

  async devices() {
    if (this.demo) return this.demo.devices();
    const r = await this.api('GET', '/me/player/devices');
    if (!r.ok) return r;
    return { ok: true, items: ((r.data && r.data.devices) || []).map((d) => ({ id: d.id, name: d.name, type: d.type, active: d.is_active })) };
  }

  async command(c) {
    if (this.demo) return this.demo.command(c);
    const dev = c.device ? `?device_id=${encodeURIComponent(c.device)}` : '';
    const clamp = (n, a, b) => Math.max(a, Math.min(b, Math.round(Number(n) || 0)));
    switch (c.cmd) {
      case 'play': return this.api('PUT', `/me/player/play${dev}`, c.uri ? (c.kind === 'track' ? { uris: [c.uri] } : { context_uri: c.uri }) : undefined);
      case 'pause': return this.api('PUT', '/me/player/pause');
      case 'next': return this.api('POST', '/me/player/next');
      case 'prev': return this.api('POST', '/me/player/previous');
      case 'seek': return this.api('PUT', `/me/player/seek?position_ms=${clamp(c.ms, 0, 1e9)}`);
      case 'volume': return this.api('PUT', `/me/player/volume?volume_percent=${clamp(c.value, 0, 100)}`);
      case 'shuffle': return this.api('PUT', `/me/player/shuffle?state=${c.value ? 'true' : 'false'}`);
      case 'repeat': return this.api('PUT', `/me/player/repeat?state=${['off', 'context', 'track'].includes(c.value) ? c.value : 'off'}`);
      case 'transfer': return this.api('PUT', '/me/player', { device_ids: [String(c.device)], play: c.play !== false });
      default: return { ok: false, error: 'Unbekannter Befehl' };
    }
  }

  // Alle Routen unter /api/spotify. Gibt true zurück, wenn die Anfrage behandelt wurde.
  async handle(req, res, url, p, readBody, sendJson) {
    if (!p.startsWith('/api/spotify/')) return false;
    const route = p.slice('/api/spotify/'.length);
    try {
      if (route === 'status') { sendJson(res, 200, this.status()); return true; }
      if (route === 'login') {
        if (!this.clientId) { res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Trag zuerst die Spotify-Client-ID unter Setup ein.'); return true; }
        res.writeHead(302, { Location: this.loginUrl() }); res.end(); return true;
      }
      if (route === 'callback') {
        const q = url.searchParams;
        let msg = 'Verbunden. Du kannst dieses Fenster schließen und im EFB weitermachen.', code = 200;
        try {
          if (q.get('error')) throw new Error(q.get('error') === 'access_denied' ? 'Zugriff abgelehnt.' : q.get('error'));
          await this.callback(q.get('code'), q.get('state'));
        } catch (e) { msg = 'Anmeldung fehlgeschlagen: ' + e.message; code = 400; }
        res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html><meta charset="utf-8"><title>Spotify</title><body style="font:18px system-ui;background:#0b1016;color:#e8edf2;padding:40px"><p>${msg.replace(/[<>&]/g, '')}</p>`);
        return true;
      }
      if (route === 'logout' && req.method === 'POST') { this.logout(); sendJson(res, 200, { ok: true }); return true; }
      if (!this.tok && !this.demo) { sendJson(res, 200, { ok: false, error: 'Nicht bei Spotify angemeldet.', needLogin: true }); return true; }
      if (route === 'player') { sendJson(res, 200, await this.player()); return true; }
      if (route === 'playlists') { sendJson(res, 200, await this.playlists()); return true; }
      if (route === 'search') { sendJson(res, 200, await this.search(url.searchParams.get('q'))); return true; }
      if (route === 'devices') { sendJson(res, 200, await this.devices()); return true; }
      if (route === 'cmd' && req.method === 'POST') { const r = await this.command(await readBody(req)); sendJson(res, 200, { ok: r.ok, error: r.error }); return true; }
      sendJson(res, 404, { error: 'Unbekannt' });
    } catch (e) {
      sendJson(res, 200, { ok: false, error: e.message, needLogin: /angemeldet/.test(e.message) });
    }
    return true;
  }
}

module.exports = { Spotify };
