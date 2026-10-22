// Spielzeug-Player für Demo und Online-Vorschau (keine echte Musik)
module.exports = class DemoPlayer {
  constructor() {
    this.tracks = [['Blue Hour Approach', 'Demo Ensemble', 214000], ['Flight Level 360', 'The Test Pilots', 187000], ['Crosswind', 'Radio Tower', 241000]];
    this.i = 0; this.playing = true; this.pos = 42000; this.at = Date.now(); this.volume = 60; this.shuffle = false; this.repeat = 'off'; this.device = 'dev1';
  }
  _tick() {
    const n = Date.now();
    if (this.playing) { this.pos += n - this.at; const d = this.tracks[this.i][2]; if (this.pos >= d) { this.i = (this.i + 1) % this.tracks.length; this.pos = 0; } }
    this.at = n;
  }
  status() { return { configured: true, loggedIn: true, demo: true, redirectUri: '', loginUrl: '' }; }
  player() {
    this._tick();
    const t = this.tracks[this.i];
    return { ok: true, active: true, playing: this.playing, title: t[0], artist: t[1], album: 'Demo-Album', art: '', progress: this.pos, duration: t[2], volume: this.volume, shuffle: this.shuffle, repeat: this.repeat,
      device: { id: this.device, name: this.device === 'dev1' ? 'Cockpit-PC' : 'Tablet', type: 'Computer' }, ctx: 'demo:pl1', at: Date.now() };
  }
  playlists() { return { ok: true, items: ['Anflug-Mix', 'Nachtflug', 'Deutschrap-Klassiker', 'Chill im Cockpit', 'Lange Strecke', 'Gute Laune'].map((n, i) => ({ name: n, uri: 'demo:pl' + i, art: '', count: 20 + i * 7 })) }; }
  search(q) {
    const l = q.toLowerCase(), pick = (a) => a.filter((x) => x.name.toLowerCase().includes(l) || x.sub.toLowerCase().includes(l));
    return { ok: true,
      tracks: pick(this.tracks.map((t, i) => ({ name: t[0], sub: t[1], uri: 'demo:t' + i, art: '', kind: 'track' }))),
      artists: pick([{ name: 'Demo Ensemble', sub: 'Künstler', uri: 'demo:a1', art: '', kind: 'context' }, { name: 'The Test Pilots', sub: 'Künstler', uri: 'demo:a2', art: '', kind: 'context' }]),
      albums: pick([{ name: 'Demo-Album', sub: 'Demo Ensemble', uri: 'demo:al1', art: '', kind: 'context' }]),
      playlists: pick(['Anflug-Mix', 'Nachtflug', 'Chill im Cockpit'].map((n, i) => ({ name: n, sub: 'Playlist', uri: 'demo:pl' + i, art: '', kind: 'context' }))) };
  }
  devices() { return { ok: true, items: [{ id: 'dev1', name: 'Cockpit-PC', type: 'Computer', active: this.device === 'dev1' }, { id: 'dev2', name: 'Tablet', type: 'Tablet', active: this.device === 'dev2' }] }; }
  command(c) {
    this._tick();
    if (c.cmd === 'play') { this.playing = true; if (c.uri) { this.i = Math.floor(Math.random() * this.tracks.length); this.pos = 0; } }
    else if (c.cmd === 'pause') this.playing = false;
    else if (c.cmd === 'next') { this.i = (this.i + 1) % this.tracks.length; this.pos = 0; }
    else if (c.cmd === 'prev') { if (this.pos > 3000) this.pos = 0; else this.i = (this.i + this.tracks.length - 1) % this.tracks.length; }
    else if (c.cmd === 'seek') this.pos = Number(c.ms) || 0;
    else if (c.cmd === 'volume') this.volume = Number(c.value) || 0;
    else if (c.cmd === 'shuffle') this.shuffle = !!c.value;
    else if (c.cmd === 'repeat') this.repeat = c.value;
    else if (c.cmd === 'transfer') this.device = c.device;
    return { ok: true };
  }
};
