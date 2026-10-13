// Beispieldaten für die Demo und die Online-Vorschau (keine echten Lotsen)
module.exports = function demo(body) {
  const ap = (icao, set) => !icao ? null : {
    icao,
    atis: [{ cs: `${icao}_ATIS`, freq: '127.275', code: 'B', text: '' }],
    controllers: set.map(([role, f, n], i) => ({ cs: `${icao}_${role}`, freq: f, name: n, role, facility: { DEL: 2, GND: 3, TWR: 4, APP: 5 }[role] })),
  };
  const set1 = [['DEL', '121.900', 'Demo Lotse A'], ['GND', '121.700', 'Demo Lotse B'], ['TWR', '118.525', 'Demo Lotse C']];
  const set2 = [['TWR', '118.700', 'Demo Lotse D'], ['APP', '120.000', 'Demo Lotse E']];
  return {
    updated: new Date().toISOString(), boundaries: true, boundaryError: null, demo: true,
    dep: ap(body.dep, set1), dest: ap(body.dest, set2), alts: (body.alts || []).filter(Boolean).map((a) => ap(a, [])),
    enroute: [
      { fir: 'EDMM-N / EDMM-S', name: 'München Radar', prefix: 'EDMM', controllers: [{ cs: 'EDMM_N_CTR', freq: '132.150', name: 'Demo Lotse F', role: 'CTR', facility: 6 }] },
      { fir: 'EDGG', name: 'Langen Radar', prefix: 'EDGG', controllers: [] },
    ],
    me: body.callsign ? { cs: body.callsign, squawk: '2000', assigned: '4521', route: '', alt: '', dep: body.dep, arr: body.dest } : null,
  };
};
