// Musik-Tab: Spotify steuern (Wiedergabe läuft auf dem PC oder einem anderen Spotify-Gerät, nicht im iPad)
'use strict';

const MusicTab = (() => {
  let status = null, pl = null, lists = null, devs = null, msg = '', msgBad = false, timer = null, tick = null, built = '';
  const isLocal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const mmss = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const get = (p) => fetch(p, { cache: 'no-store' }).then((r) => r.json()).catch(() => ({ ok: false, error: 'PC-Brücke nicht erreichbar.' }));
  const post = (p, b) => fetch(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}) }).then((r) => r.json()).catch(() => ({ ok: false, error: 'PC-Brücke nicht erreichbar.' }));
  const flash = (t, bad) => { msg = t || ''; msgBad = !!bad; const n = $('#spMsg'); if (n) { n.textContent = msg; n.classList.toggle('bad', msgBad); } };

  const RPT = { off: 'Endlosschleife aus', context: 'Endlosschleife: Playlist', track: 'Endlosschleife: ein Titel' };
  const cover = (url, cls) => url ? `<img class="${cls}" src="${esc(url)}" alt="" referrerpolicy="no-referrer">` : `<div class="${cls} ph"><svg viewBox="0 0 24 24"><path d="M9 17.5V6.5l10-2v11"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/></svg></div>`;

  function setup() {
    $('#musicBody').innerHTML = `<div class="panel music-setup"><h3>Spotify verbinden</h3>
      <ol class="steps">
        <li>Öffne <b>developer.spotify.com/dashboard</b> und lege eine App an (Name egal).</li>
        <li>Trage als Redirect-URI ein: <code>${esc(status.redirectUri)}</code></li>
        <li>Kopiere die <b>Client-ID</b> der App in Setup → Spotify und speichere.</li>
        <li>Komm hierher zurück und melde dich an. Steuern lässt sich nur mit <b>Spotify Premium</b>.</li>
      </ol><div class="form-row"><button class="btn" data-go="setup">Zu Setup</button><button class="btn-s" id="spRecheck">Neu prüfen</button></div></div>`;
  }
  function login() {
    $('#musicBody').innerHTML = `<div class="panel music-setup"><h3>Bei Spotify anmelden</h3>
      <p>Die Anmeldung läuft einmalig <b>am PC</b>, nicht am iPad.</p>
      ${isLocal ? `<div class="form-row"><a class="btn" href="/api/spotify/login" target="_blank" rel="noopener">Bei Spotify anmelden</a></div>`
        : `<p>Öffne diese Adresse im Browser des PCs:</p><p><code>${esc(status.loginUrl)}</code></p>`}
      <div class="form-row"><button class="btn-s" id="spRecheck">Neu prüfen</button></div><p class="note" id="spMsg"></p></div>`;
  }
  function player() {
    $('#musicBody').innerHTML = `<div class="music-grid">
      <div class="panel music-now" id="spNow"></div>
      <div class="panel music-side">
        <h3>Gerät</h3><div class="form-row"><select id="spDev"></select></div>
        <div class="sp-search"><input id="spQ" type="search" placeholder="Suchen: Titel, Künstler, Album, Playlist" autocomplete="off" enterkeyhint="search"></div>
        <div id="spRes" class="sp-res" hidden></div>
        <div id="spBrowse"><h3>Playlists</h3><div class="pls" id="spLists"></div></div>
        <p class="note bad" id="spMsg"></p>
        <p class="note sp-credit">Wiedergabe über Spotify. Spotify ist eine Marke von Spotify AB; Cockpit EFB ist nicht mit Spotify verbunden.</p>
      </div></div>`;
    drawNow(); drawDevs(); drawLists();
  }
  function drawNow() {
    const el = $('#spNow'); if (!el) return;
    if (!pl || !pl.ok) { el.innerHTML = `<h3>Wiedergabe</h3><p class="empty">${esc((pl && pl.error) || 'Lade …')}</p>`; return; }
    if (!pl.active) { el.innerHTML = `<h3>Wiedergabe</h3><p class="empty">Gerade läuft nichts. Starte unten eine Playlist${pl.device ? '' : ' oder öffne Spotify am PC'}.</p>`; return; }
    el.innerHTML = `${cover(pl.art, 'cover')}
      <div class="np-title">${esc(pl.title)}</div><div class="np-artist">${esc(pl.artist)}</div>
      <div class="np-bar" id="spBar"><div id="spFill"></div></div>
      <div class="np-times"><span id="spPos">0:00</span><span>${mmss(pl.duration)}</span></div>
      <div class="np-ctl">
        <button class="ic ${pl.shuffle ? 'on' : ''}" data-sp="shuffle" aria-label="Zufall"><svg viewBox="0 0 24 24"><path d="M4 7h3.5c3.5 0 5 10 9 10H20M4 17h3.5c1.4 0 2.4-1.6 3.2-3.3M20 7h-3.5c-1.6 0-2.8 1.4-3.7 3M18 4.5L20.5 7 18 9.5M18 14.5l2.5 2.5-2.5 2.5"/></svg></button>
        <button class="ic" data-sp="prev" aria-label="Zurück"><svg viewBox="0 0 24 24" class="fill"><g transform="translate(-1 0)"><path d="M6 5h2v14H6zM20 5v14L9 12z"/></g></svg></button>
        <button class="ic big" data-sp="toggle" aria-label="${pl.playing ? 'Pause' : 'Abspielen'}"><svg viewBox="0 0 24 24" class="fill">${pl.playing ? '<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/>' : '<g transform="translate(-1.2 0)"><path d="M8 5v14l11-7z"/></g>'}</svg></button>
        <button class="ic" data-sp="next" aria-label="Weiter"><svg viewBox="0 0 24 24" class="fill"><g transform="translate(1 0)"><path d="M16 5h2v14h-2zM4 5v14l11-7z"/></g></svg></button>
        <button class="ic ${pl.repeat !== 'off' ? 'on' : ''}" data-sp="repeat" aria-label="${RPT[pl.repeat] || RPT.off}" title="${RPT[pl.repeat] || RPT.off}"><svg viewBox="0 0 24 24"><path d="M5 11V9.5A2.5 2.5 0 0 1 7.5 7H19M16.5 4.5L19 7l-2.5 2.5M19 13v1.5a2.5 2.5 0 0 1-2.5 2.5H5M7.5 19.5L5 17l2.5-2.5"/></svg>${pl.repeat === 'track' ? '<i>1</i>' : ''}</button>
      </div>
      <label class="np-vol"><svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4zM15.5 9a4 4 0 0 1 0 6"/></svg>
        <input type="range" id="spVol" min="0" max="100" value="${pl.volume ?? 50}" aria-label="Lautstärke"><span id="spVolV">${pl.volume ?? ''}</span></label>`;
    paint();
  }
  function paint() {
    if (!pl || !pl.active) return;
    const pos = Math.min(pl.duration, pl.progress + (pl.playing ? Date.now() - pl.at : 0));
    const f = $('#spFill'), p = $('#spPos');
    if (f) f.style.width = `${pl.duration ? (pos / pl.duration) * 100 : 0}%`;
    if (p) p.textContent = mmss(pos);
  }
  function drawDevs() {
    const el = $('#spDev'); if (!el) return;
    const list = (devs && devs.items) || [];
    el.innerHTML = list.length ? list.map((d) => `<option value="${esc(d.id)}" ${d.active ? 'selected' : ''}>${esc(d.name)} (${esc(d.type)})</option>`).join('') : '<option value="">Kein Gerät gefunden – Spotify am PC öffnen</option>';
  }
  function drawLists() {
    const el = $('#spLists'); if (!el) return;
    el.innerHTML = lists && lists.ok ? (lists.items.map((p) => `<button class="pl" data-uri="${esc(p.uri)}">${cover(p.art, 'pl-art')}<span>${esc(p.name)}</span><small>${p.count ?? ''}${p.count ? ' Titel' : ''}</small></button>`).join('') || '<p class="empty">Keine Playlists.</p>')
      : `<p class="empty">${esc((lists && lists.error) || 'Lade …')}</p>`;
  }

  let qT = null, qSeq = 0;
  const SECT = [['tracks', 'Titel'], ['artists', 'Künstler'], ['albums', 'Alben'], ['playlists', 'Playlists']];
  function drawRes(r) {
    const el = $('#spRes'); if (!el) return;
    if (!r.ok) { el.innerHTML = `<p class="empty">${esc(r.error || 'Suche fehlgeschlagen.')}</p>`; return; }
    const html = SECT.map(([k, h]) => (r[k] && r[k].length ? `<h3>${h}</h3>` + r[k].map((x) => `<button class="sp-row" data-uri="${esc(x.uri)}" data-kind="${x.kind}">${cover(x.art, 'pl-art')}<span><b>${esc(x.name)}</b><small>${esc(x.sub || '')}</small></span></button>`).join('') : '')).join('');
    el.innerHTML = html || '<p class="empty">Nichts gefunden.</p>';
  }
  function onSearch(v) {
    clearTimeout(qT);
    const q = v.trim(), res = $('#spRes'), br = $('#spBrowse');
    if (!res || !br) return;
    res.hidden = !q; br.hidden = !!q;
    if (!q) return;
    qT = setTimeout(async () => { const id = ++qSeq; const r = await get('/api/spotify/search?q=' + encodeURIComponent(q)); if (id === qSeq) drawRes(r); }, 350);
  }

  async function refresh(full) {
    status = await get('/api/spotify/status');
    if (!status.configured) { if (built !== 'setup') { setup(); built = 'setup'; } return; }
    if (!status.loggedIn) { if (built !== 'login') { login(); built = 'login'; } return; }
    if (built !== 'player') { built = 'player'; player(); full = true; }
    pl = await get('/api/spotify/player');
    if (pl.needLogin) { built = ''; return refresh(); }
    drawNow();
    if (full) { [lists, devs] = await Promise.all([get('/api/spotify/playlists'), get('/api/spotify/devices')]); drawLists(); drawDevs(); }
  }
  function start() { stop(); refresh(true); timer = setInterval(() => refresh(false), 3500); tick = setInterval(paint, 500); }
  function stop() { clearInterval(timer); clearInterval(tick); timer = tick = null; }

  async function cmd(c, optimistic) {
    if (optimistic && pl) { Object.assign(pl, optimistic, { progress: pl.progress + (pl.playing ? Date.now() - pl.at : 0), at: Date.now() }); drawNow(); }
    const r = await post('/api/spotify/cmd', c);
    if (!r.ok) flash(r.error || 'Spotify hat den Befehl nicht angenommen.', true); else flash('');
    setTimeout(() => refresh(!!(c.cmd === 'transfer' || c.cmd === 'play')), 450);
  }

  document.addEventListener('click', (e) => {
    if (app.tab !== 'music') return;
    const t = e.target.closest('button, .np-bar'); if (!t) return;
    if (t.dataset.go === 'setup') showTab('setup');
    if (t.id === 'spRecheck') { built = ''; refresh(true); }
    if (t.dataset.sp && pl) {
      const k = t.dataset.sp;
      if (k === 'toggle') cmd({ cmd: pl.playing ? 'pause' : 'play' }, { playing: !pl.playing });
      if (k === 'next') cmd({ cmd: 'next' });
      if (k === 'prev') cmd({ cmd: 'prev' });
      if (k === 'shuffle') cmd({ cmd: 'shuffle', value: !pl.shuffle }, { shuffle: !pl.shuffle });
      if (k === 'repeat') { const n = { off: 'context', context: 'track', track: 'off' }[pl.repeat] || 'off'; cmd({ cmd: 'repeat', value: n }, { repeat: n }); Settings.toast(RPT[n]); }
    }
    if (t.dataset.uri) cmd({ cmd: 'play', uri: t.dataset.uri, kind: t.dataset.kind || 'context', device: ($('#spDev') || {}).value || undefined });
    if (t.id === 'spBar' && pl && pl.duration) {
      const r = t.getBoundingClientRect();
      const ms = Math.round(((e.clientX - r.left) / r.width) * pl.duration);
      cmd({ cmd: 'seek', ms }, { progress: ms });
    }
  });
  document.addEventListener('input', (e) => { if (e.target.id === 'spQ') onSearch(e.target.value); });
  document.addEventListener('input', (e) => { if (e.target.id === 'spVol') { const v = $('#spVolV'); if (v) v.textContent = e.target.value; } });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'spVol') cmd({ cmd: 'volume', value: Number(e.target.value) });
    if (e.target.id === 'spDev' && e.target.value) cmd({ cmd: 'transfer', device: e.target.value, play: true });
  });
  hooks.tab.push((n) => { if (n === 'music') { built = ''; start(); } else stop(); });
  return {};
})();
