// VATSIM-Daten (öffentlicher Datenfeed, alle 15 Sekunden aktualisiert)
const FEED = 'https://data.vatsim.net/v3/vatsim-data.json';

let cache = null;
let fetchedAt = 0;
let pending = null;

async function load() {
  if (cache && Date.now() - fetchedAt < 15000) return cache;
  if (pending) return pending;
  pending = (async () => {
    try {
      const r = await fetch(FEED, { headers: { 'User-Agent': 'CockpitEFB' } });
      const d = await r.json();
      cache = {
        updated: d.general && d.general.update_timestamp,
        pilots: (d.pilots || []).map((p) => ({
          cs: p.callsign, cid: p.cid, lat: p.latitude, lon: p.longitude, alt: p.altitude, gs: p.groundspeed, hdg: p.heading,
          type: p.flight_plan ? p.flight_plan.aircraft_short : '', dep: p.flight_plan ? p.flight_plan.departure : '',
          arr: p.flight_plan ? p.flight_plan.arrival : '',
          squawk: p.transponder, assigned: p.flight_plan ? p.flight_plan.assigned_transponder : '',
          route: p.flight_plan ? p.flight_plan.route : '', fpAlt: p.flight_plan ? p.flight_plan.altitude : '',
        })),
        controllers: (d.controllers || []).filter((c) => c.facility > 0).map((c) => ({ cs: c.callsign, freq: c.frequency, name: c.name, facility: c.facility })),
        atis: (d.atis || []).map((a) => ({ cs: a.callsign, freq: a.frequency, code: a.atis_code, text: (a.text_atis || []).join(' ') })),
      };
      fetchedAt = Date.now();
      return cache;
    } finally {
      pending = null;
    }
  })();
  return pending;
}

// Piloten im Kartenausschnitt, Lotsen/ATIS für die angegebenen Flughäfen bzw. Präfixe
async function query({ bbox, airports }) {
  const d = await load();
  let pilots = d.pilots;
  if (bbox) {
    const [s, w, n, e] = bbox;
    pilots = pilots.filter((p) => p.lat >= s && p.lat <= n && p.lon >= w && p.lon <= e).slice(0, 600);
  }
  const pre = (airports || []).filter(Boolean).map((a) => a.toUpperCase());
  const match = (cs) => pre.some((a) => cs.startsWith(a + '_') || cs.startsWith(a.slice(1) + '_'));
  return {
    updated: d.updated,
    pilots,
    controllers: d.controllers.filter((c) => match(c.cs)),
    atis: d.atis.filter((a) => match(a.cs)),
  };
}

module.exports = { query, load };
