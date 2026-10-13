// EFB-App "Cockpit EFB Link" für das EFB des MSFS 2024.
// Startet beim Hochfahren des EFB im Hintergrund (BootMode HOT) und zeigt nur einen Status an.

import { App, AppBootMode, AppSuspendMode, AppView, Efb, TVNode } from '@efb/efb-api';
import { FSComponent, Subject, VNode } from '@microsoft/msfs-sdk';
import { remoteLog, startLink } from './link';

const status = Subject.create('Starte …');
startLink((s) => status.set(s));

class CockpitLinkView extends AppView {
  public render(): VNode {
    return (
      <div style="padding: 40px; font-size: 26px; color: #e8ecef; background: #0b0f13; height: 100%; box-sizing: border-box;">
        <div style="font-size: 36px; margin-bottom: 20px;">Cockpit EFB Link</div>
        <div style="color: #3be26a;">{status}</div>
        <div style="margin-top: 22px; color: #8794a0; font-size: 20px; line-height: 1.4;">
          Verbindet den Sim mit der PC-Brücke deines iPad-EFB (Lido-Charts, Systemstörungen).
          Die App arbeitet im Hintergrund, du musst sie nicht geöffnet lassen.
        </div>
      </div>
    );
  }
}

class CockpitLinkApp extends App {
  public get name(): string { return 'Cockpit EFB Link'; }
  // Fester interner Name (ohne Leerzeichen), unabhängig von der Minifizierung
  public get internalName(): string { return 'CockpitEfbLink'; }
  public get icon(): string { return 'coui://html_ui/efb_ui/efb_apps/CockpitEfbLink/Assets/app-icon.svg'; }
  public BootMode = AppBootMode.HOT;
  public SuspendMode = AppSuspendMode.SLEEP;

  public async install(): Promise<void> {
    // Auf den Startbildschirm des EFB legen, damit man die App findet
    try { this.efbSettingsManager.addAppToFavorites(this); } catch (e) { remoteLog(`Favorit nicht möglich: ${e}`); }
    remoteLog('App im EFB installiert');
  }

  public render(): TVNode<CockpitLinkView> {
    return <CockpitLinkView bus={this.bus} />;
  }
}

try {
  Efb.use(CockpitLinkApp);
  remoteLog('App beim EFB angemeldet');
} catch (e) {
  remoteLog(`Anmeldung beim EFB fehlgeschlagen: ${e}`);
}
