#!/usr/bin/env python3
# Erzeugt aus eigenen Aufnahmen eine Stimme (XTTS-v2, Open Source) und rendert damit die Sätze des Bodenpersonals
# als WAV-Dateien in den Ordner "sounds" der Cockpit-EFB. Die EFB spielt sie statt der Computerstimme ab.
# Läuft komplett auf deinem PC. Nur Stimmen verwenden, die du verwenden darfst (eigene oder mit Erlaubnis).
import argparse, json, os, sys, time, tempfile, wave
from pathlib import Path
import numpy as np
from scipy.io import wavfile

HERE = Path(__file__).resolve().parent
APPDATA = os.environ.get('APPDATA') or str(Path.home())
DEFAULT_OUT = str(Path(APPDATA) / 'cockpit-efb-app' / 'efb' / 'sounds')
AUDIO = {'.wav', '.mp3', '.flac', '.ogg', '.m4a'}
REF_SR = 22050


def to_mono_float(sr_data):
    sr, d = sr_data
    d = np.asarray(d)
    if d.ndim > 1:
        d = d.mean(axis=1)
    if d.dtype == np.int16:
        d = d.astype(np.float32) / 32768.0
    elif d.dtype == np.int32:
        d = d.astype(np.float32) / 2147483648.0
    elif d.dtype == np.uint8:
        d = (d.astype(np.float32) - 128) / 128.0
    else:
        d = d.astype(np.float32)
    return sr, d


def resample(d, sr, to):
    if sr == to:
        return d
    n = int(round(len(d) * to / sr))
    return np.interp(np.linspace(0, len(d) - 1, n), np.arange(len(d)), d).astype(np.float32)


def read_any(path):
    p = Path(path)
    if p.suffix.lower() == '.wav':
        return to_mono_float(wavfile.read(str(p)))
    import torchaudio  # nur für MP3/FLAC/OGG nötig
    w, sr = torchaudio.load(str(p))
    return sr, w.mean(dim=0).numpy().astype(np.float32)


def trim(d, thr=0.015, pad=0.12, sr=24000):
    idx = np.where(np.abs(d) > thr)[0]
    if not len(idx):
        return d
    a, b = max(0, idx[0] - int(pad * sr)), min(len(d), idx[-1] + int(pad * sr))
    return d[a:b]


def write_wav(path, d, sr):
    pk = float(np.max(np.abs(d))) or 1.0
    d = d / pk * 0.9
    wavfile.write(str(path), sr, (d * 32767).astype(np.int16))


def prepare_refs(folder, tmp):
    files = sorted(p for p in Path(folder).glob('*') if p.suffix.lower() in AUDIO)
    if not files:
        sys.exit(f'Keine Aufnahmen in "{folder}" gefunden (WAV, MP3, FLAC, OGG).')
    refs, total = [], 0.0
    for p in files[:8]:
        try:
            sr, d = read_any(p)
        except Exception as e:  # noqa: BLE001
            print(f'  übersprungen ({p.name}): {e}')
            continue
        d = resample(d, sr, REF_SR)[: REF_SR * 30]  # höchstens 30 s je Datei
        if len(d) < REF_SR * 2:
            print(f'  zu kurz, übersprungen: {p.name}')
            continue
        out = Path(tmp) / (p.stem + '.wav')
        write_wav(out, d, REF_SR)
        refs.append(str(out)); total += len(d) / REF_SR
        print(f'  Aufnahme: {p.name} ({len(d) / REF_SR:.0f} s)')
    if not refs or total < 5:
        sys.exit('Zu wenig Audio: mindestens 6 Sekunden saubere Sprache, besser 15 bis 60 Sekunden.')
    if total < 12:
        print('  Hinweis: Mit mehr Aufnahmematerial (15–60 s) klingt die Stimme meist besser.')
    return refs


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--voice', default=str(HERE / 'aufnahmen'), help='Ordner mit deinen Aufnahmen')
    ap.add_argument('--out', default=DEFAULT_OUT, help='Zielordner "sounds" der EFB')
    ap.add_argument('--phrases', default=str(HERE / 'phrases.json'), help='Sätze (JSON)')
    ap.add_argument('--lang', default='en', help='Sprache der Sätze (en, de, …)')
    ap.add_argument('--only', default='', help='nur Sätze, deren Name diesen Text enthält')
    ap.add_argument('--add', action='append', default=[], metavar='NAME=TEXT', help='zusätzlicher Satz, z. B. "pushback.ack.R2=Pushback approved, Romeo Two."')
    ap.add_argument('--force', action='store_true', help='vorhandene Dateien neu erzeugen')
    ap.add_argument('--yes', action='store_true', help='Bedingungen ohne Nachfrage bestätigen')
    ap.add_argument('--dry-run', action='store_true', help='nur anzeigen, was erzeugt würde')
    a = ap.parse_args()

    phrases = json.loads(Path(a.phrases).read_text(encoding='utf-8'))
    for kv in a.add:
        k, _, t = kv.partition('=')
        if k.strip() and t.strip():
            phrases[k.strip()] = {'text': t.strip()}
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    todo = [(k, v) for k, v in phrases.items() if a.only in k and (a.force or not (out / f'{k}.wav').exists() and not (out / f'{k}.mp3').exists())]
    print(f'{len(todo)} von {len(phrases)} Sätzen werden erzeugt → {out}')
    if a.dry_run or not todo:
        for k, v in todo:
            print(f'  {k}: {v["text"]}')
        return

    if not a.yes and os.environ.get('COQUI_TOS_AGREED') != '1':
        print('\nDie Stimme wird mit XTTS-v2 erzeugt. Dessen Lizenz (Coqui Public Model License) erlaubt nur nicht-kommerzielle Nutzung.')
        print('Du bestätigst außerdem, dass du die Stimme in deinen Aufnahmen verwenden darfst (eigene Stimme oder mit Erlaubnis).')
        if input('Einverstanden? (j/n) ').strip().lower() not in ('j', 'ja', 'y', 'yes'):
            sys.exit('Abgebrochen.')
    os.environ['COQUI_TOS_AGREED'] = '1'

    with tempfile.TemporaryDirectory() as tmp:
        print('\nAufnahmen vorbereiten …')
        refs = prepare_refs(a.voice, tmp)
        print('\nModell laden (beim ersten Mal Download von ca. 1,8 GB, das dauert) …')
        import torch
        from TTS.api import TTS
        dev = 'cuda' if torch.cuda.is_available() else 'cpu'
        print(f'Rechner: {dev}' + ('' if dev == 'cuda' else ' (ohne NVIDIA-Karte dauert jeder Satz einige Sekunden bis Minuten)'))
        tts = TTS('tts_models/multilingual/multi-dataset/xtts_v2').to(dev)
        t0 = time.time()
        for n, (k, v) in enumerate(todo, 1):
            t1 = time.time()
            raw = Path(tmp) / 'out.wav'
            tts.tts_to_file(text=v['text'], speaker_wav=refs, language=v.get('lang', a.lang), file_path=str(raw))
            sr, d = to_mono_float(wavfile.read(str(raw)))
            write_wav(out / f'{k}.wav', trim(d, sr=sr), sr)
            left = (time.time() - t0) / n * (len(todo) - n)
            print(f'  [{n}/{len(todo)}] {k}: "{v["text"]}"  ({time.time() - t1:.0f} s, noch ca. {left / 60:.1f} min)')
    print(f'\nFertig. Die Dateien liegen in {out}. Die EFB erkennt sie nach spätestens einer Minute, ein Neustart ist nicht nötig.')


if __name__ == '__main__':
    main()
