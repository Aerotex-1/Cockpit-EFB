// GSX Pro – Bodendienste per Tipp auslösen
//
// So funktioniert es:
// GSX schreibt den Text seines Menüs in eine Datei ("menu") in seinem Paketordner
// (...\fsdreamteam-gsx-pro\html_ui\InGamePanels\FSDT_GSX_Panel\menu).
// Zum Auslösen eines Dienstes wird das Menü über L:FSDT_GSX_MENU_OPEN angefordert,
// der passende Eintrag in der Datei gesucht und über L:FSDT_GSX_MENU_CHOICE gewählt.
// So passt die Auswahl immer, auch wenn GSX die Reihenfolge der Einträge ändert.

const fs = require('fs');
const path = require('path');

// Welcher Menütext gehört zu welchem Dienst. "path" ist die Folge von Menüeinträgen,
// die nacheinander gewählt werden (für Untermenüs wie die Zusatzdienste).
const has = (re, not) => (t) => re.test(t) && !(not && not.test(t));
const ADD = has(/additional|extra|other service|more service/i);
const SERVICES = {
  deboarding: { label: 'Deboarding', path: [has(/deboard/i)] },
  catering: { label: 'Catering', path: [has(/cater/i)] },
  refueling: { label: 'Betanken', path: [has(/refuel|fuel/i, /de-?fuel/i)] },
  boarding: { label: 'Boarding', path: [has(/board/i, /deboard/i)] },
  pushback: { label: 'Pushback', path: [has(/push/i)] },
  jetway: { label: 'Fluggastbrücke', path: [has(/jetway|jet bridge|jetbridge/i)] },
  stairs: { label: 'Treppen', path: [has(/stair/i)] },
  gpu: { label: 'GPU', path: [has(/\bgpu\b|ground power/i)] },
  deice: { label: 'De-Icing', path: [has(/de-?ic/i)] },
  followme: { label: 'Follow-me', path: [has(/follow/i)] },
  parking: { label: 'Parkposition', path: [has(/parking|gate|stand|warp/i, /customi/i)] },
  position: { label: 'Position anpassen', path: [has(/customi|position/i)] },
  additional: { label: 'Zusatzdienste', path: [ADD], menu: true },
  cleaning: { label: 'Reinigung', path: [ADD, has(/clean/i)] },
  lavatory: { label: 'Toilette', path: [ADD, has(/lavator|toilet|waste/i)] },
  water: { label: 'Wasser', path: [ADD, has(/water/i, /waste/i)] },
  crewbus: { label: 'Crew-Bus', path: [ADD, has(/crew/i)] },
  cameras: { label: 'Kameras', path: [has(/camera/i)] },
};

const PANEL_SUBPATH = path.join('html_ui', 'InGamePanels', 'FSDT_GSX_Panel', 'menu');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Gsx {
  constructor(sim, getConfig) {
    this.sim = sim;
    this.getConfig = getConfig;
    this.menuFile = null;
    this.demo = sim.demo;
    this.demoMenu = null;
    this.demoMtime = 0;
    if (this.demo) this._setupDemo();
    else this.locate();
  }

  // ---------- Menüdatei finden ----------
  locate() {
    const manual = (this.getConfig().gsxMenuFile || '').trim();
    const candidates = [];
    if (manual) candidates.push(manual);
    for (const dir of this._communityDirs()) candidates.push(...this._scanForGsx(dir, 1));
    for (const drive of ['C', 'D', 'E', 'F', 'G']) candidates.push(...this._scanForGsx(`${drive}:\\FSDreamTeam`, 4));
    if (process.env.APPDATA) candidates.push(path.join(process.env.APPDATA, 'Virtuali', 'GSX', 'MSFS', 'menu'));

    this.menuFile = candidates.find((f) => { try { return fs.statSync(f).isFile(); } catch { return false; } }) || null;
    console.log(this.menuFile ? `[GSX] Menüdatei: ${this.menuFile}` : '[GSX] Menüdatei nicht gefunden. Pfad kann unter SETUP eingetragen werden.');
    return this.menuFile;
  }

  // Community-Ordner aus der UserCfg.opt von MSFS 2024 (Store und Steam) und 2020
  _communityDirs() {
    const la = process.env.LOCALAPPDATA || '', ra = process.env.APPDATA || '';
    const cfgs = [
      path.join(la, 'Packages', 'Microsoft.Limitless_8wekyb3d8bbwe', 'LocalCache', 'UserCfg.opt'),
      path.join(ra, 'Microsoft Flight Simulator 2024', 'UserCfg.opt'),
      path.join(la, 'Packages', 'Microsoft.FlightSimulator_8wekyb3d8bbwe', 'LocalCache', 'UserCfg.opt'),
      path.join(ra, 'Microsoft Flight Simulator', 'UserCfg.opt'),
    ];
    const dirs = [];
    for (const cfg of cfgs) {
      try {
        const m = fs.readFileSync(cfg, 'utf8').match(/InstalledPackagesPath\s+"([^"]+)"/);
        if (m) dirs.push(path.join(m[1], 'Community'));
      } catch { /* nicht vorhanden */ }
    }
    return dirs;
  }

  // Sucht Ordner "fsdreamteam-gsx-pro*" bis zur angegebenen Tiefe
  _scanForGsx(base, depth) {
    const found = [];
    const walk = (dir, d) => {
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        if (!e.isDirectory() && !e.isSymbolicLink()) continue;
        const full = path.join(dir, e.name);
        if (/^fsdreamteam-gsx-pro/i.test(e.name)) found.push(path.join(full, PANEL_SUBPATH));
        else if (d > 1 && !/^(html_ui|SimObjects|\.)/i.test(e.name)) walk(full, d - 1);
      }
    };
    walk(base, depth);
    return found;
  }

  // ---------- Menü lesen ----------
  readMenu() {
    if (this.demo) return this.demoMenu ? { ...this.demoMenu, mtime: this.demoMtime } : null;
    if (!this.menuFile) return null;
    try {
      const st = fs.statSync(this.menuFile);
      const lines = fs.readFileSync(this.menuFile, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (!lines.length) return null;
      return { title: lines[0], items: lines.slice(1), mtime: st.mtimeMs };
    } catch {
      return null;
    }
  }

  status() {
    const m = this.readMenu();
    return {
      menuFile: this.demo ? '(Demo)' : this.menuFile,
      menu: m ? { title: m.title, items: m.items, age: Math.round((Date.now() - m.mtime) / 1000) } : null,
      services: Object.fromEntries(Object.entries(SERVICES).map(([k, v]) => [k, v.label])),
    };
  }

  // Menü anfordern und warten, bis GSX die Datei neu geschrieben hat
  async refresh() {
    if (!this.demo && !this.menuFile && !this.locate()) {
      return { ok: false, error: 'GSX-Menüdatei nicht gefunden. Trag den Pfad unter SETUP ein.' };
    }
    const before = (this.readMenu() || {}).mtime || 0;
    if (!this.sim.setLVar('L:FSDT_GSX_MENU_OPEN', 1)) return { ok: false, error: 'Sim nicht verbunden.' };
    for (let i = 0; i < 30; i++) {
      await sleep(100);
      const m = this.readMenu();
      if (m && m.mtime !== before) return { ok: true, menu: m };
    }
    const m = this.readMenu();
    return m ? { ok: true, menu: m, stale: true } : { ok: false, error: 'GSX hat kein Menü geliefert. Läuft Couatl?' };
  }

  choose(index) {
    const offset = Number(this.getConfig().gsxChoiceOffset || 0);
    return this.sim.setLVar('L:FSDT_GSX_MENU_CHOICE', Number(index) + offset);
  }

  // Wartet, bis GSX die Menüdatei nach einer Auswahl neu geschrieben hat
  async _waitMenuChange(before, ms = 2500) {
    for (let i = 0; i < ms / 100; i++) {
      await sleep(100);
      const m = this.readMenu();
      if (m && m.mtime !== before) return m;
    }
    return this.readMenu();
  }

  async requestService(key) {
    const svc = SERVICES[key];
    if (!svc) return { ok: false, error: 'Unbekannter Dienst' };
    const r = await this.refresh();
    if (!r.ok) return r;
    let menu = r.menu;
    const chosen = [];
    // Steht GSX schon in einem Untermenü (z. B. Zusatzdienste), dort weitermachen
    let startStep = 0;
    if (menu.items.findIndex(svc.path[0]) < 0) {
      const later = svc.path.findIndex((f, i) => i > 0 && menu.items.findIndex(f) >= 0);
      if (later > 0) startStep = later;
    }
    for (let step = startStep; step < svc.path.length; step++) {
      const idx = menu.items.findIndex(svc.path[step]);
      if (idx < 0) {
        return { ok: false, error: `„${svc.label}“ steht gerade nicht im GSX-Menü.`, menu, partial: chosen };
      }
      await sleep(150);
      const before = menu.mtime;
      this.choose(idx);
      chosen.push(menu.items[idx]);
      if (step < svc.path.length - 1 || svc.menu) menu = await this._waitMenuChange(before);
      else { const m2 = await this._waitMenuChange(before, 2000); if (m2 && m2.mtime !== before && m2.items && m2.items.length) menu = m2; else menu = null; }
      if (!menu && step < svc.path.length - 1) return { ok: false, error: 'GSX hat das Untermenü nicht geöffnet.', partial: chosen };
    }
    return { ok: true, chosen: chosen.join(' › '), menu: menu || undefined };
  }

  // ---------- Demo ----------
  _setupDemo() {
    const main = { title: 'GSX - Leipzig/Halle Stand 12', items: ['Request Deboarding', 'Request Catering', 'Request Refueling', 'Request Boarding', 'Request Pushback', 'Request De-Icing', 'Operate jetways', 'Operate stairs', 'Additional services', 'Change parking position', 'Customize aircraft position'] };
    const extra = { title: 'Additional services', items: ['Request cleaning', 'Request lavatory service', 'Request water service', 'Request crew bus', 'Back'] };
    this.sim.on('demoOpen', () => { this.demoMenu = this.demoMenu && this.demoMenu.title === 'Pushback direction' ? this.demoMenu : main; this.demoMtime = Date.now(); });
    this.sim.on('demoChoice', (i) => {
      const item = this.demoMenu && this.demoMenu.items[i];
      if (item === 'Request Pushback') {
        this.demoMenu = { title: 'Pushback direction', items: ['FACING WEST (Taxiway A)', 'FACING EAST (Taxiway A)', 'QuickEdit Pushback', 'LFRN_C3-28', 'LFRN_C3-10', 'Straight pushback (manual stop, max 60 m)'] };
      } else if (item === 'Additional services') {
        this.demoMenu = extra;
      } else if (item === 'Back') {
        this.demoMenu = main;
      } else {
        this.demoMenu = null;
      }
      this.demoMtime = Date.now();
    });
  }
}

module.exports = { Gsx, SERVICES };
