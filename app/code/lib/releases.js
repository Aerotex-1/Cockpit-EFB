// Updates über GitHub Releases: sucht neue EFB-ZIPs und neue App-Installer, lädt sie herunter.
'use strict';

function cmp(a, b) {
  const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0 ? 1 : -1; }
  return 0;
}

const headers = (token, accept) => {
  const h = { Accept: accept || 'application/vnd.github+json', 'User-Agent': 'CockpitEFB-App', 'X-GitHub-Api-Version': '2022-11-28' };
  if (token) h.Authorization = 'Bearer ' + token;
  return h;
};

async function listReleases({ repo, token, base = 'https://api.github.com', fetchFn = fetch }) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '')) throw new Error('Repository fehlt oder ist ungültig (Format: besitzer/name).');
  const r = await fetchFn(`${base}/repos/${repo}/releases?per_page=30`, { headers: headers(token) });
  if (r.status === 404) throw new Error('Repository nicht gefunden. Bei privaten Repositories fehlt der Zugriffstoken.');
  if (r.status === 401 || r.status === 403) throw new Error('Zugriff abgelehnt (Token prüfen).');
  if (!r.ok) throw new Error('GitHub antwortet mit Fehler ' + r.status);
  return (await r.json()).filter((x) => !x.draft);
}

// neueste EFB-ZIP: Cockpit-EFB-1.2.3.zip bzw. -privat.zip
function newestEfb(releases, edition) {
  const re = edition === 'privat' ? /^Cockpit-EFB-(\d+\.\d+\.\d+)-privat\.zip$/ : /^Cockpit-EFB-(\d+\.\d+\.\d+)\.zip$/;
  let best = null;
  for (const rel of releases) for (const a of rel.assets || []) {
    const m = re.exec(a.name); if (m && (!best || cmp(m[1], best.version) > 0)) best = { version: m[1], asset: a, notes: rel.body || '', name: rel.name || rel.tag_name };
  }
  return best;
}
// neuester App-Code (Oberfläche der App): Cockpit-EFB-App-Code-1.2.3.zip
function newestCode(releases) {
  const re = /^Cockpit-EFB-App-Code-(\d+\.\d+\.\d+)\.zip$/;
  let best = null;
  for (const rel of releases) for (const a of rel.assets || []) {
    const m = re.exec(a.name); if (m && (!best || cmp(m[1], best.version) > 0)) best = { version: m[1], asset: a, notes: rel.body || '' };
  }
  return best;
}
// neuester Installer: Cockpit-EFB-Setup-1.2.3.exe
function newestInstaller(releases) {
  const re = /^Cockpit-EFB-Setup-(\d+\.\d+\.\d+)\.exe$/;
  let best = null;
  for (const rel of releases) for (const a of rel.assets || []) {
    const m = re.exec(a.name); if (m && (!best || cmp(m[1], best.version) > 0)) best = { version: m[1], asset: a, notes: rel.body || '' };
  }
  return best;
}

async function check({ repo, token, edition, efbVersion, codeVersion, shellVersion, base, fetchFn }) {
  const rels = await listReleases({ repo, token, base, fetchFn });
  const efb = newestEfb(rels, edition), code = newestCode(rels), shell = newestInstaller(rels);
  return {
    efb: efb && cmp(efb.version, efbVersion) > 0 ? efb : null,
    code: code && cmp(code.version, codeVersion) > 0 ? code : null,
    shell: shell && cmp(shell.version, shellVersion) > 0 ? shell : null,
    latestEfb: efb ? efb.version : null,
  };
}

async function download(asset, { token, base, fetchFn = fetch, onProgress } = {}) {
  const url = asset.url || asset.browser_download_url;
  const r = await fetchFn(url, { headers: headers(token, 'application/octet-stream'), redirect: 'follow' });
  if (!r.ok) throw new Error('Download fehlgeschlagen (' + r.status + ').');
  const total = Number(r.headers.get('content-length')) || asset.size || 0;
  const chunks = []; let got = 0;
  if (r.body && r.body.getReader) {
    const rd = r.body.getReader();
    for (;;) { const { done, value } = await rd.read(); if (done) break; chunks.push(Buffer.from(value)); got += value.length; if (onProgress && total) onProgress(got / total); }
  } else { const b = Buffer.from(await r.arrayBuffer()); chunks.push(b); got = b.length; }
  return Buffer.concat(chunks);
}

module.exports = { cmp, listReleases, newestEfb, newestCode, newestInstaller, check, download };
