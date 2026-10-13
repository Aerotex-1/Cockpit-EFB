// Stimmen-Verwaltung: Katalog der Piper-Stimmen, Installieren (Download von Hugging Face) und Entfernen.
'use strict';
const fs = require('fs');
const path = require('path');

const HF = 'https://huggingface.co/rhasspy/piper-voices/resolve/main';
// id = <locale>-<name>-<quality>; mitgeliefert (bundled) sind die ersten beiden
const CATALOG = [
  { id: 'de_DE-thorsten-medium', lang: 'de', name: 'Thorsten', desc: 'männlich, klar, Standard', mb: 63, bundled: true },
  { id: 'en_US-lessac-medium', lang: 'en', name: 'Lessac', desc: 'weiblich, US-Englisch, Standard', mb: 63, bundled: true },
  { id: 'de_DE-thorsten-high', lang: 'de', name: 'Thorsten (hohe Qualität)', desc: 'männlich, mehr Details, langsamer', mb: 110 },
  { id: 'de_DE-kerstin-low', lang: 'de', name: 'Kerstin', desc: 'weiblich', mb: 63 },
  { id: 'de_DE-ramona-low', lang: 'de', name: 'Ramona', desc: 'weiblich', mb: 63 },
  { id: 'de_DE-karlsson-low', lang: 'de', name: 'Karlsson', desc: 'männlich', mb: 63 },
  { id: 'de_DE-pavoque-low', lang: 'de', name: 'Pavoque', desc: 'männlich', mb: 63 },
  { id: 'en_US-ryan-medium', lang: 'en', name: 'Ryan', desc: 'männlich, US-Englisch', mb: 63 },
  { id: 'en_US-amy-medium', lang: 'en', name: 'Amy', desc: 'weiblich, US-Englisch', mb: 63 },
  { id: 'en_GB-alan-medium', lang: 'en', name: 'Alan', desc: 'männlich, britisch', mb: 63 },
  { id: 'en_GB-jenny_dioco-medium', lang: 'en', name: 'Jenny', desc: 'weiblich, britisch', mb: 63 },
];

function urlFor(id, base = HF) {
  const [locale, name, quality] = id.split('-');
  return `${base}/${locale.split('_')[0]}/${locale}/${name}/${quality}/${id}.onnx`;
}
const has = (dir, id) => !!dir && fs.existsSync(path.join(dir, id + '.onnx')) && fs.existsSync(path.join(dir, id + '.onnx.json'));

function list({ userDir, bundledDir }) {
  return CATALOG.map((v) => ({ ...v, installed: has(bundledDir, v.id) || has(userDir, v.id), removable: has(userDir, v.id) && !has(bundledDir, v.id) }));
}

async function fetchTo(url, file, fetchFn, onProgress) {
  const r = await fetchFn(url, { headers: { 'User-Agent': 'CockpitEFB-App' }, redirect: 'follow' });
  if (!r.ok) throw new Error(`Download fehlgeschlagen (${r.status}): ${url.split('/').pop()}`);
  const total = Number(r.headers.get('content-length')) || 0;
  const tmp = file + '.part'; const out = fs.createWriteStream(tmp);
  let got = 0;
  try {
    const rd = r.body.getReader();
    for (;;) { const { done, value } = await rd.read(); if (done) break; await new Promise((res, rej) => out.write(value, (e) => (e ? rej(e) : res()))); got += value.length; if (onProgress && total) onProgress(got / total); }
    await new Promise((res) => out.end(res));
    fs.renameSync(tmp, file);
  } catch (e) { out.destroy(); try { fs.unlinkSync(tmp); } catch { /* weg */ } throw e; }
}

async function install(id, { userDir, base = HF, fetchFn = fetch, onProgress }) {
  if (!CATALOG.some((v) => v.id === id)) throw new Error('Unbekannte Stimme.');
  fs.mkdirSync(userDir, { recursive: true });
  const u = urlFor(id, base);
  await fetchTo(u + '.json', path.join(userDir, id + '.onnx.json'), fetchFn);
  await fetchTo(u, path.join(userDir, id + '.onnx'), fetchFn, onProgress);
}
function remove(id, { userDir }) {
  if (!CATALOG.some((v) => v.id === id)) throw new Error('Unbekannte Stimme.');
  for (const f of [id + '.onnx', id + '.onnx.json']) try { fs.unlinkSync(path.join(userDir, f)); } catch { /* war nicht da */ }
}
module.exports = { CATALOG, urlFor, list, install, remove, HF };
