// Cockpit EFB Link – läuft im EFB des MSFS 2024 und verbindet den Sim mit der PC-Brücke.
//
// Aufgaben:
//  1. Lido-Charts abrufen (Liste, Seiten, Bilder) und an die Brücke schicken
//  2. Systemstörungen für FBW/Headwind an den Flieger senden (wie das flyPad)
//
// Spricht die Chart-Schnittstelle des Sims ("JS_LISTENER_CHARTS") direkt an – so wie es
// ChartsClient/ChartView im MSFS-SDK intern tun. Damit hängt das Modul nicht von der SDK-Version ab.

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const Coherent: { call: (name: string, ...args: unknown[]) => Promise<unknown> };
declare function RegisterViewListener(name: string, cb?: () => void): any;
declare function RegisterGenericDataListener(cb?: () => void): { send: (key: string, data: unknown) => void };

const BRIDGE = 'http://127.0.0.1:8090';
const VERSION = '0.7.0';

// Meldungen aus dem Sim im Fenster von start.bat anzeigen (hilft bei der Fehlersuche)
export function remoteLog(msg: string): void {
  try {
    fetch(`${BRIDGE}/api/lido/log`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ msg: String(msg).slice(0, 2000), v: VERSION }) }).catch(() => {});
  } catch { /* egal */ }
}

// Startet die Verbindung genau einmal, egal aus welcher Datei sie aufgerufen wird
export function startLink(onStatus?: (s: string) => void): BridgeLink {
  const w = window as any;
  if (!w.__cockpitEfbLink) {
    w.__cockpitEfbLink = new BridgeLink();
    w.__cockpitEfbLink.start();
    remoteLog(`Sim-Modul geladen (${typeof location !== "undefined" ? location.href : "?"})`);
  }
  if (onStatus) { w.__cockpitEfbLink.onStatus = onStatus; onStatus(w.__cockpitEfbLink.status); }
  return w.__cockpitEfbLink;
}

type Job = { id: number; type: 'index' | 'pages' | 'image'; icao?: string; guid?: string; page?: number; url?: string };

// ---------- Chart-Schnittstelle des Sims ----------
class SimCharts {
  private listener: any = null;
  private ready: Promise<any> | null = null;
  private seq: any = null;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>();
  private views = new Map<string, (name: string, url: string, err?: number) => void>();

  private init(): Promise<any> {
    if (this.ready) return this.ready;
    this.ready = new Promise((resolve) => {
      this.listener = RegisterViewListener('JS_LISTENER_CHARTS', () => {
        const l = this.listener;
        l.on('SendChartIndex', (id: number, data: any) => this.done(id, data));
        l.on('SendChartIndexError', (id: number, code: number) => this.fail(id, code));
        l.on('SendChartPages', (id: number, data: any) => this.done(id, data));
        l.on('SendChartPagesError', (id: number, code: number) => this.fail(id, code));
        l.on('SendLiveViewName', (guid: string, name: string, url: string) => { const f = this.views.get(guid); if (f) f(name, url); });
        l.on('SendLiveViewError', (guid: string, code: number, url: string) => { const f = this.views.get(guid); if (f) f('', url, code); });
        resolve(l);
      });
    });
    try {
      RegisterViewListener('JS_LISTENER_ATOMIC', () => { this.seq = (window as any).AtomicSequence; });
    } catch { /* dann eigene Nummern */ }
    return this.ready;
  }

  private nextId(): number {
    try { if (this.seq && this.seq.getNext) return this.seq.getNext(); } catch { /* weiter */ }
    return Math.floor(1e9 + Math.random() * 1e9);
  }
  private done(id: number, data: any): void { const p = this.pending.get(id); if (p) { this.pending.delete(id); p.resolve(data); } }
  private fail(id: number, code: number): void { const p = this.pending.get(id); if (p) { this.pending.delete(id); p.reject(new Error(`Chart-Fehler ${code}`)); } }

  private request(method: string, ...args: unknown[]): Promise<any> {
    return this.init().then((l) => new Promise((resolve, reject) => {
      const id = this.nextId();
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('Keine Antwort vom Sim')); }, 15000);
      this.pending.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
      l.call(method, id, ...args);
    }));
  }

  index(icao: string): Promise<any> {
    const icaoValue = { __Type: 'JS_ICAO', type: 'A', region: '', airport: '', ident: icao.toUpperCase() };
    return this.request('GET_CHARTS_INDEX', icaoValue, 'LIDO');
  }

  pages(guid: string): Promise<any> { return this.request('GET_CHART_PAGES', guid); }

  // Liefert den Namen der "Live View", den man als Bildquelle verwenden kann
  async liveView(pageUrl: string): Promise<string> {
    const l = await this.init();
    const viewId: string = await l.call('CREATE_CHART_VIEW');
    try {
      return await new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Zeitüberschreitung beim Laden des Bildes')), 20000);
        this.views.set(viewId, (name, url, err) => {
          if (url !== pageUrl) return;
          clearTimeout(timer);
          if (err || !name) reject(new Error(`Bildfehler ${err || 0}`)); else resolve(name);
        });
        l.call('SET_CHART_VIEW_URL', viewId, pageUrl);
      });
    } finally {
      // Ansicht erst später schließen, damit das Bild fertig gezeichnet werden kann
      setTimeout(() => { this.views.delete(viewId); try { l.call('DESTROY_CHART_VIEW', viewId); } catch { /* egal */ } }, 15000);
    }
  }
}

// ---------- Verbindung zur PC-Brücke ----------
export class BridgeLink {
  public status = 'Starte …';
  public onStatus: (s: string) => void = () => {};
  private busy = false;
  private charts = new SimCharts();
  private dataListener: ReturnType<typeof RegisterGenericDataListener> | null = null;

  public start(): void {
    setInterval(() => this.poll(), 700);
  }

  private setStatus(s: string): void {
    if (s !== this.status) { this.status = s; this.onStatus(s); }
  }

  private async poll(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const r = await fetch(`${BRIDGE}/api/lido/poll?v=${VERSION}`);
      const d = await r.json();
      this.setStatus('Verbunden mit der PC-Brücke');
      if (Array.isArray(d.fbwFailures)) this.sendFailures(d.fbwFailures);
      for (const job of d.jobs as Job[]) await this.run(job);
    } catch {
      this.setStatus('PC-Brücke nicht erreichbar – läuft start.bat?');
    } finally {
      this.busy = false;
    }
  }

  private async post(body: unknown): Promise<void> {
    await fetch(`${BRIDGE}/api/lido/result`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }

  private async run(job: Job): Promise<void> {
    try {
      if (job.type === 'index') {
        const data = await this.charts.index(job.icao!);
        await this.post({ id: job.id, ok: true, data: JSON.parse(JSON.stringify(data)) });
      } else if (job.type === 'pages') {
        const data = await this.charts.pages(job.guid!);
        await this.post({ id: job.id, ok: true, data: JSON.parse(JSON.stringify(data)) });
      } else if (job.type === 'image') {
        const info = await this.renderImage(job.id, job.url!);
        await this.post({ id: job.id, ok: true, data: { rawDone: true, ...info } });
      }
    } catch (e) {
      await this.post({ id: job.id, ok: false, error: `${e && (e as Error).message ? (e as Error).message : e}` });
    }
  }

  // Das Bild der Live View in Streifen auf ein kleines Canvas zeichnen, die Pixel auslesen und roh an
  // die PC-Brücke schicken. Die Brücke baut daraus das PNG (toDataURL funktioniert im Sim nicht).
  private async renderImage(jobId: number, url: string): Promise<{ w: number; h: number; nonWhite: number }> {
    const src = await this.charts.liveView(url);
    const im = new Image();
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Bild lädt nicht (Zeitüberschreitung)')), 20000);
      im.onload = () => { clearTimeout(timer); resolve(); };
      im.onerror = () => { clearTimeout(timer); reject(new Error('Bild konnte im Sim nicht geladen werden')); };
      im.src = src;
    });
    const w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
    if (!(w > 0 && h > 0)) throw new Error(`Bildgröße ${w}x${h}`);
    remoteLog(`Bild geladen: ${w}x${h}, sende Streifen …`);
    const sh = 256;
    const c = document.createElement('canvas');
    c.width = w; c.height = sh;
    const ctx = c.getContext('2d')!;
    let nonWhite = 0;
    for (let y = 0; y < h; y += sh) {
      const rows = Math.min(sh, h - y);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, sh);
      ctx.drawImage(im, 0, y, w, rows, 0, 0, w, rows);
      let img: ImageData;
      try { img = ctx.getImageData(0, 0, w, rows); } catch (e) { throw new Error(`getImageData: ${e}`); }
      const rgba = img.data, rgb = new Uint8Array(w * rows * 3);
      for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
        const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
        rgb[j] = r; rgb[j + 1] = g; rgb[j + 2] = b;
        if (r < 245 || g < 245 || b < 245) nonWhite++;
      }
      const resp = await fetch(`${BRIDGE}/api/lido/stripe?job=${jobId}&y=${y}&w=${w}&rows=${rows}&h=${h}`, { method: 'POST', body: rgb });
      if (!resp.ok) throw new Error(`Streifen abgelehnt (${resp.status})`);
    }
    remoteLog(`Bild gesendet: ${nonWhite} nicht-weiße Pixel`);
    if (nonWhite === 0) throw new Error('Das Bild ist komplett weiß/leer – das Canvas hat die Live-View nicht gezeichnet');
    return { w, h, nonWhite };
  }

  // Wie der FailuresOrchestrator des flyPads: aktive Störungen an WASM und JS-Instrumente senden
  private sendFailures(active: number[]): void {
    try {
      Coherent.call('COMM_BUS_WASM_CALLBACK', 'FBW_FAILURE_UPDATE', JSON.stringify(active));
      if (!this.dataListener) this.dataListener = RegisterGenericDataListener();
      this.dataListener.send('EB_EVENTS', { packagedId: Math.floor(Math.random() * 1e9), data: [{ topic: 'FBW_FAILURE_UPDATE', data: active }] });
    } catch (e) {
      this.setStatus(`Störungen konnten nicht gesendet werden: ${e}`);
    }
  }
}
