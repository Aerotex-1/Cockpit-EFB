# Änderungen

## 1.2.42
- **Performance:** Das Höchstgewicht der Piste steht jetzt groß oben im Ergebnis (Takeoff und Landung), mit Reserve bzw. Überschreitung. Stehen im SimBrief-TLR Höchstgewichte je Piste, zeigt eine Tabelle darunter alle Pisten (geplante Piste markiert, mit Begrenzungsgrund).
- **Einstellungen → Sprache → Gewichte:** Umschalten zwischen kg und lb (gilt pro Gerät). Betrifft die Gewichte im Flugplan, den Performance-Rechner (Eingaben werden beim Umschalten umgerechnet) und das Logbuch.
- **Fehler behoben:** Hatte SimBrief den Flugplan in lbs geliefert, wurden Start- und Landegewicht im Rechner als kg übernommen. Jetzt wird umgerechnet.
- **ATC-Tab:** Parkposition (nächster Stellplatz laut OpenStreetMap, solange der Flieger steht), ATIS-Buchstabe und QNH vom VATSIM-ATIS des Abflughafens werden automatisch eingetragen. Was du von Hand änderst, bleibt stehen.
- **ATC-Tab:** Feld „Climb via SID“. Ohne Haken steht in der Zusammenfassung „Climb“ mit der Anfangshöhe.
- **Karte:** Tippe auf einen Wegpunkt der Route: Es öffnet sich eine Tabelle mit Wind und Temperatur auf mehreren Höhen. Die Zeile, die der OFP-Flughöhe am Wegpunkt am nächsten liegt, ist markiert; der Wind laut OFP steht darüber. Der Wind ist eine Vorhersage (Open-Meteo), keine Messung.
- **Flug-Tab:** Höhe jetzt MSL und AGL (neue Sim-Variable „Plane Alt Above Ground“).
- **Wetter-Tab:** neuer Reiter TAF für Abflug, Ziel und Ausweichflughafen (aviationweather.gov, kostenlos).
- Ungetestet gegen den echten Sim: AGL-Wert, TAF-Abruf und die TLR-Felder `max_weight`/`limit_code` (nur Demo geprüft).

## 1.2.41
- Leistung, vor allem Karte und iPad (Aussehen unverändert):
  - Beschriftungen der Bodenkarte (Rollwege, Stands) liegen nur noch für den sichtbaren Ausschnitt im Speicher der Seite statt für den ganzen Flughafen. Bei einem großen Flughafen sind das einige hundert statt mehrere tausend Elemente.
  - Die Bodenkarte wird in kleinen Häppchen gezeichnet. Die Karte bleibt dabei bedienbar, statt ein bis zwei Sekunden zu hängen.
  - „Folgen“ verschiebt die Karte nur noch, wenn das Flugzeug merklich aus der Mitte läuft (jedes Verschieben zeichnet die Karte neu).
  - Die Rollweg-Markierung wird nur neu gezeichnet, wenn sich etwas geändert hat.
  - Die Kopfzeile (Lampe, GS, Höhe, Kurs) wird nur bei Änderungen geschrieben, und gespeicherte Einstellungen werden im Speicher zwischengehalten statt vier Mal pro Sekunde aus dem Browser-Speicher gelesen.
  - Messung (simulierter Flughafen mit rund 5000 Beschriftungen, CPU auf Tablet-Niveau gedrosselt): Aufbau 2 s Stillstand → rund 0,2 s, Bildzeit beim Verschieben im Schnitt 176 ms → 48 ms.

## 1.2.40
- Rollweg-Ansagen früher: Die Abbiege-Ansage („Gleich links auf Taxiway N“) kommt jetzt je nach Rollgeschwindigkeit 130 bis 320 m vor der Kreuzung (rund 12 Sekunden Vorlauf plus Reserve) statt fest 120 m. Dasselbe gilt für „Halt vor Taxiway …“ und „Halt vor Piste …“.
- Der Satz wird schon rund 250 m vorher von der Stimme berechnet und zwischengespeichert, damit beim Ansagen keine Rechenzeit mehr vergeht.

## 1.2.39
- Rollroute neu berechnet: Alle Rollwege des Flughafens werden als Kreuzungs-Netz gelesen. Die Route wird nur noch bis zur jeweiligen Abbiegung markiert, nicht mehr über die ganze Länge eines Rollwegs. Damit kennt der Copilot an jeder Kreuzung die Abbiegerichtung („Gleich links auf Taxiway N“).
- Lücken: Hängen zwei Rollwege der Eingabe nicht direkt zusammen (oder fehlt ein Stück in den Kartendaten), fügt der EFB die kürzeste Verbindung ein. Sie erscheint gestrichelt auf der Karte und in der Rollweg-Leiste (gestrichelt umrandet). Mit angegebenem Stand beginnt (Abflug) bzw. endet (Ankunft) der Weg dort.
- Halt vor einem Rollweg: Steht ein Rollweg in Klammern, z. B. „B A (N)“, endet der Halt vor N mit einem roten Strich quer zum Rollweg (rund 22 m vor der Kreuzung) und der Beschriftung „Halt N“. Der Copilot sagt „Gleich Halt vor Taxiway N“. Ohne Klammer gilt wie bisher der Halt vor der Piste (etwa 55 m vor der Pistenmitte).
- Rollwege, die nach Farben benannt sind (Blue, Orange, Green, Red, Yellow … auch deutsch), werden in der Bodenkarte in dieser Farbe gezeichnet und beschriftet.

## 1.2.38
- Pushback-Ende: Steht der Flieger nach der Bewegung länger als 4 Sekunden still (egal ob die Parkbremse schon gesetzt ist), sagt Ground „Pushback complete, set parking brake“.

## 1.2.37
- Das Pushback-Ende wird jetzt auch an der Bewegung erkannt, nicht nur über GSX-Status und Flieger-Variablen: Hat sich der Flieger bewegt und steht dann still (8 s, bei gesetzter Parkbremse 3 s), sagt Ground „Pushback complete, set parking brake“ und fragt nach deiner Bestätigung für den Triebwerksstart. Das greift auch, wenn GSX den Status nicht meldet.
- Hatte Ground vor dem Pushback „Warte mit dem Triebwerksstart“ gesagt, gibt er am Ende ausdrücklich frei („You are clear to start engines.“ in mehreren Varianten).

## 1.2.36
- Pushback-Richtung mit Ortsnamen: Menüeinträge wie „Facing South - W2“, „Facing North - Center 2“ oder „Facing South - E2“ werden jetzt vollständig verstanden. „Facing south W2“, „W2“, „south echo two“, „facing south center two“ usw. führen zum richtigen Eintrag („West two“ und „double you two“ werden als W2 gedeutet). Nennst du erst „W2“ und nach der Rückfrage „Facing South“, merkt sich der EFB beides.
- Das GSX-Fenster „Interrupt pushback? Yes / No / Select pushback direction / Cameras“ wird erkannt (wie „Change direction“): „Yes“ wird nie gewählt, bei genannter Richtung wählt der EFB „Select pushback direction“.

## 1.2.35
- Bodenstrom (GPU): Der EFB findet den Eintrag jetzt auch unter „Additional services“ (je nach GSX-Version liegt er dort statt im Hauptmenü). Die Meldung „Ground power is not available in the GSX menu“ kommt nur noch, wenn er weder im Hauptmenü noch in den Zusatzdiensten steht.

## 1.2.34
- GSX-Fenster „Abort pushback? Yes / No / Change direction“ wird erkannt: Ground sagt „Tug is connected“ und geht direkt zur Bremse. Hattest du eine Richtung genannt („push and start approved facing east“), wählt der EFB „Change direction“ und danach den passenden Richtungseintrag. „Yes“ (Abbruch) wird nie gewählt, und das Fenster wird nicht mehr vorgelesen.
- Das Fenster am Pushback-Ende („Confirm good engine start“ o. ä.) wird erkannt: Sobald es erscheint, sagt Ground „Pushback complete…“ und „Wait for your confirmation for a good engine start.“ Deine Bestätigung („Engines started well“) wählt genau diesen Eintrag (Abbruch-/„No“-Einträge werden übersprungen).

## 1.2.33
- Neuer Pushback-Ablauf (Ground führt dich durch, GSX bleibt Chef):
  1. „Cockpit to ground, request pushback“ (gern gleich mit Richtung, z. B. „… facing east“): Ground bestätigt Stand und Türen/Brücke, merkt sich die Richtung und wartet auf GSX.
  2. Sobald GSX das Richtungsfenster zeigt (der EFB prüft das Menü ständig, auch „Pushback direction“/„Change direction“), sagt Ground „Tug is connected, report pushback direction.“ Du nennst die Richtung, der EFB sucht den passenden Eintrag selbst im Menü (ein Treffer wird gewählt, mehrere führen zu einer Rückfrage). Hattest du die Richtung schon genannt, wird sie direkt gewählt.
  3. Danach: „Release parking brake, please.“ plus Hinweis zu den Triebwerken: „Engines clear for start“, „Wait for engine start until I call you“ oder „Wait with engine start until push is completed and brakes are set“ (in den Einstellungen wählbar: wechselnd, oder immer dieselbe Art).
  4. Du sagst „Parking brake released“ (oder löst die Bremse, dann merkt es der EFB selbst). Ground bestätigt „Roger, pushing back“.
  5. Am Ende des Pushbacks: „Pushback complete, set parking brake“ und „Wait for your confirmation for a good engine start.“ Du antwortest z. B. „Engines started well“, Ground sagt „Roger“ und reicht die Bestätigung an GSX weiter (passender Menüeintrag mit „Engine“/„Disconnect“), damit der Schlepper abkoppelt.
  6. Sobald der Schlepper weg ist (oder nach 45 s), verabschiedet sich Ground freundlich („Have a good flight!“ in mehreren Varianten).
- „Facing east/west/north/south“ nutzt echte Kompassrichtungen (090, 270, 000, 180). Gibt es keinen Eintrag mit der Himmelsrichtung, wird aus dem aktuellen Kurs berechnet, ob die Nase links oder rechts schwenken muss. Nennst du einen Rollweg („onto taxiway A“), wird bei mehreren Treffern der Eintrag mit diesem Rollweg bevorzugt.
- Der Copilot sagt „release parking brake“ nicht mehr aus eigenem Antrieb zu früh; die Bremsansage kommt nur noch nach der Richtungswahl.
- Nicht mit echtem GSX getestet (im Demo-Modus mit simuliertem Menü geprüft). Unsicher sind: Wann GSX das Richtungsfenster öffnet, ob ein Menü die Triebwerks-Bestätigung entgegennimmt und wie dessen Eintrag heißt, und woran das Abkoppeln erkannt wird. Im Verlauf steht jedes gelesene GSX-Menü („GSX-Menü: …“) – schick mir die Zeilen rund um Pushback-Ende und Abkoppeln, dann passe ich es genau an.

## 1.2.32
- Pushback, Reihenfolge: Der Copilot sagt nichts mehr zu „release the parking brake“ und „Tug is connected“. Das führt GSX selbst, und die Ansage kam zu früh und brachte GSX durcheinander. Nur wenn die Bremse tatsächlich gelöst ist und der Schub läuft, kommt (optional) eine kurze Meldung.
- Pushback-Fenster: GSX öffnet das Richtungsmenü oft erst, wenn der Schlepper da ist. Der EFB beobachtet das GSX-Menü jetzt und fragt in dem Moment nach der Richtung, in dem das Pushback-Fenster erscheint. Hast du die Richtung schon beim Anfordern genannt („push approved facing east“), nimmt er sie dann ohne Rückfrage.
- Himmelsrichtung: „Facing east/west/north/south“ passt zu einem Eintrag mit dieser Richtung. Gibt es nur „Nose Left/Right“, rechnet der EFB mit dem aktuellen Kurs aus, wohin die Nase schwenken muss (z. B. Kurs 000 und „facing east“ → nose right; Kurs 180 → nose left; ungefähr gleicher Kurs → straight).
- Kein Vorlesen aller Vorschläge mehr: Der EFB sucht deine Wörter selbst im Menü. Ein Treffer wird gewählt, mehrere Treffer werden zur Auswahl vorgelesen, kein Treffer führt zu einer kurzen Rückfrage mit den möglichen Richtungen (nur dann).
- Verhörer werden toleriert (z. B. tile/tale → tail, knows → nose, strate → straight, yeast → east, Ost/Süd/Nord/West, links/rechts).
- Mehr Abwechslung bei allen Ansagen: Copilot (Checkliste starten/beenden, „Checked“, „Stimmt“, Checkliste komplett/als Nächstes/fällig, Erinnerungen, Funk Standby/aktiv, Stumm) und Ground (Rückfragen, Fehlermeldungen, Pushback-Aufforderungen, Bestätigungen) haben mehrere Formulierungen, die zufällig und nie zweimal hintereinander gewählt werden.
- Nicht im Sim getestet. Wie dein GSX das Pushback-Menü genau aufbaut und ab wann es es öffnet, kenne ich nur aus deinem Verlauf. Im Verlauf steht jetzt bei jedem Menü „GSX-Menü: …“, schick mir die Zeilen, falls etwas nicht passt.

## 1.2.31
- Neu in der Kopfleiste: Ein gelbes Symbol „✉ N“ neben dem Stumm-Knopf zeigt an, dass N Meldungen warten (von Copilot oder Ground), weil der Copilot stumm ist. Antippen hebt Stumm auf und liest sie vor. Ohne wartende Meldungen ist es nicht zu sehen. Es erscheint im Fenster am PC, das den Copilot ausführt.
- Pushback: Die Ansage „Tug is connected, release the parking brake“ kommt erst, wenn die Richtungsfrage geklärt und ausgesprochen ist (sie wartet bis zu 2 Minuten auf deine Antwort), nicht mehr dazwischen.
- Nicht im Sim getestet; das Symbol habe ich im Demo-Modus geprüft. Falls „release parking brake“ bei dir von GSX selbst kommt (nicht vom Copilot), kann ich die Reihenfolge dort nicht beeinflussen.

## 1.2.30
- Auf die Frage, ob eine Checkliste gestartet oder die nächste gemacht werden soll, werden jetzt viele Arten von „Nein“ akzeptiert: no, nope, nah, nay, negative, negativ, „not now“, „not yet“, „no thanks“, „never mind“, „don't“, nein, nö, nee, „lass mal“, „später“, „jetzt nicht“, „kein Bedarf“, stopp, halt, vergiss es. Entsprechend mehr Varianten für „Ja“ (yes, yup, aye, roger, wilco, proceed, continue, „do it“, „let's go“, natürlich, genau, gern, weiter).
- Der Copilot bestätigt ein Nein mit wechselnden Sätzen („Okay, not now.“, „No problem, I will stand by.“ …).
- Die Antwortzeit auf eine solche Frage ist von 30 auf 60 Sekunden verlängert; vorher wurde ein spätes „Negative“ nach 30 s nicht mehr als Antwort gewertet.
- Nicht im Sim getestet; die Erkennung habe ich mit Beispielsätzen geprüft.

## 1.2.29
- „Wait two minutes“ / „Warte 2 Minuten“ / „Give me five minutes“ funktioniert jetzt: Der Copilot vertagt die Checkliste (auch mitten in einer laufenden), bestätigt die Zeit und fragt danach wieder. Auch das Verhör „wait to minutes“ gilt als zwei.
- Stumm-Knopf: Während der Copilot stumm ist, werden seine Meldungen (z. B. Bodencrew-Ansagen zu Boarding, Tanken, Pushback) gemerkt. Beim Aufheben sagt er „Während du stumm warst, gab es N Meldungen“ und liest sie vor (die letzten 8 aus den letzten 20 Minuten).
- „Ja oder nein?“ während einer laufenden Checkliste: Ein Antippen der Checkliste im Fenster unterbrach die laufende Sprachabfrage und schaltete den Copilot auf eine Ja/Nein-Frage um. Das passiert nicht mehr. Außerdem wird eine verspätete Antwort auf den letzten Punkt („checked“, Zahlen) nach Abschluss der Liste nicht mehr mit „Ja oder nein?“ beantwortet.
- Nicht im Sim getestet. Falls „Ja oder nein?“ bei dir während der Checkliste trotzdem noch kommt, schick mir den Verlauf: dort sehe ich, was vorher gesagt wurde.

## 1.2.28
- Funk, Umschalten: Der EFB sendete bisher mehrere Swap-Befehle schnell hintereinander. Da diese in MSFS teils derselbe Befehl sind, schaltete der zweite wieder zurück, und es sah aus, als passiere nichts. Jetzt wird immer nur ein Befehl gesendet und bis zu 4,5 s auf die Rückmeldung gewartet (der Sim meldet COM nur einmal pro Sekunde), erst dann der nächste bzw. das direkte Setzen der aktiven Frequenz. Im Verlauf steht, mit welchem Befehl es geklappt hat.
- Frequenzen: „two“ wird auch als „zo“, „zoo“, „tu“, „tew“ verstanden, und „one to one“ als 1-2-1.
- Antwort auf einen Checklistenpunkt (z. B. „QNH 1014“), während die Checkliste noch nicht läuft: Der Copilot sagt jetzt „Die Checkliste läuft noch nicht. Soll ich sie jetzt starten?“ (in mehreren Varianten) statt „Ja oder nein?“. Die Rückfragen bei QNH, Kraftstoff, Klappen und Ja/Nein haben mehrere Formulierungen.
- Nicht im Sim getestet. Ob der Swap bei deinem Flieger jetzt greift, sehe ich an der Verlaufszeile „Funk: Umschalten …“; schick sie mir, falls es weiter nicht klappt.

## 1.2.27
- Abwechslung bei der Bodencrew: Die Ansagen werden aus mehreren Formulierungen zufällig gewählt (nie zweimal dieselbe hintereinander). Beispiel Tanken: „Roger, the fuel truck is on its way.“, „Copy, refueling is on its way to you.“, „Fuel truck is on its way.“ … Das gilt für Anforderung, Fortschritt und Abschluss von Boarding, Deboarding, Catering, Refueling und alle weiteren GSX-Dienste (mit dem passenden Dienstnamen), außerdem für Schlepper, Pushback-Ende, Go-ahead, Rückfragen, Abbruch, GPU, Freigabe zum Triebwerksstart, Abkoppeln und die Begrüßung am Gate.
- Die neuen Sätze werden im Hintergrund vorberechnet, sodass auch sie ohne Wartezeit kommen (mit den Kokoro-Stimmen).
- Hinweis: Eigene Ground-Sounds aus dem Sound-Ordner haben weiterhin Vorrang vor den Texten.

## 1.2.26
- Auswahl des Handling-Betreibers (GSX wählt nach kurzer Zeit selbst): Ground fragt jetzt sofort und kurz („Handling? Name, Name, Name.“) – ohne vorherige Bestätigung, Menütitel und Nummern. Du antwortest mit dem Namen oder „first“/„second“.
- Hinweis: Ich kenne den genauen Menütitel deines GSX nicht; erkannt wird er an „operator“, „handling“, „handler“ oder „provider“ im Titel. Steht er anders im Verlauf („GSX-Menü: …“), schick mir die Zeile.

## 1.2.25
- Bodenstrom (GPU) läuft wieder über GSX: „Cockpit to ground, ground power“ wählt den GPU-Eintrag im GSX-Menü, Ground sagt nur „Roger, ground power requested.“ Den Zustand des Fliegers (der bei manchen Fliegern fälschlich „verbunden“ meldet) liest der Copilot dafür nicht mehr aus und behauptet deshalb auch nicht mehr, die GPU sei verbunden. „Ground power disconnect“ trennt sie ebenso über GSX.
- Das automatische Abkoppeln nach dem Triebwerksstart nutzt ebenfalls GSX (der EFB-Schalter ist nur noch Ersatz, falls GSX keinen GPU-Eintrag hat).
- Das gelesene GSX-Menü steht im Verlauf („GSX-Menü: …“), damit ich sehe, wie dein GPU-Eintrag heißt, falls er nicht gefunden wird.
- Nicht mit echtem GSX getestet: ob dein GSX den Eintrag „GPU“/„Ground Power“ nennt und ob er zwischen Verbinden und Trennen umschaltet, weiß ich nicht.

## 1.2.24
- Neu im Copilot-Tab unter „Audio-Geräte“: Regler „Mindestlautstärke“ mit rotem Strich im Pegelbalken. Alles unter dem Strich gilt als Stille, alles darüber als Sprache. So stellst du ihn ein: „Pegel live zeigen“ drücken, normal sprechen und den Regler so setzen, dass dein Sprechen deutlich über dem Strich liegt, Lüfter und Rauschen aber darunter. Der Balken wird grün, wenn er über dem Strich liegt.
- Läuft der Copilot, zeigt derselbe Balken live, was die Spracherkennung gerade hört (und ob sie pausiert).
- „automatisch“ (Standard) behält die bisherige Selbsteinstellung bei; sobald du den Haken entfernst, gilt dein Wert. Zusammen mit der Eingangslautstärke darüber lässt sich so jedes Mikrofon abstimmen.
- Mit einem simulierten Mikrofon geprüft (Regler, Strich, Balken); mit deinem echten Mikrofon nicht.

## 1.2.23
- Spracherkennung: Der Hinweistext für Whisper passt sich jetzt der Lage an. Bei offenem GSX-Menü enthält er die Pushback-Optionen („nose left, tail right“ …), bei laufender Checkliste Name und Soll-Antwort des aktuellen Punktes plus Zahlen und V-Speeds, bei einer Rückfrage „Yes, no, later, ask me again in …“, sonst Ground-Befehle, Checklistennamen und Funkfrequenzen. Vorher wurde der lange Einheitstext vom Server nach 500 Zeichen abgeschnitten, sodass der hintere Teil nie ankam; die Grenze liegt jetzt bei 700.
- Sprechpausen: Das Satzende wird erst nach 0,55 s Stille erkannt (vorher 0,45 s), damit „V1 … 150 … V2 …“ mit kurzen Denkpausen nicht in zwei Teile zerfällt.
- Neu in der Windows-App: drittes Modell „Mittel (sehr genau)“ (ca. 540 MB) für die beste Erkennung. Braucht einen starken PC und ist spürbar langsamer; „Klein“ bleibt die Empfehlung.
- Nicht im Sim getestet; wie gut es wirklich wird, hängt vor allem von Mikrofon, Modell und Raum ab. Im Verlauf steht dein Originalsatz, schick mir Fälle, die trotzdem falsch ankommen.

## 1.2.22
- Ähnlich Erkanntes gilt als verstanden: Verhörer und Tippfehler bei Befehlswörtern (z. B. „chekclist“, „repeet“, „afirmative“, „cancle“, „disconect“, „pushbak“) werden vor der Auswertung auf das nächstliegende Befehlswort gesetzt. Das gilt für Copilot-Befehle, Ground/GSX-Dienste, Checklisten-Namen und Antworten (ja/nein, überspringen, wiederholen, vertagen).
- Namen von Checklisten werden ebenfalls unscharf erkannt (kleiner Buchstabenabstand genügt).
- Aus Sicherheitsgründen werden nur Wörter ab 5 Buchstaben korrigiert, mit höchstens 1 Fehler (ab 8 Buchstaben 2), und gängige echte Wörter („around“, „tower“, „later“ …) bleiben unverändert. Kurze Befehle müssen weiter klar erkannt werden.
- Nicht im Sim getestet; geprüft mit Beispielsätzen. Sag mir, wo er noch etwas Ähnliches nicht akzeptiert, dann ergänze ich das gezielt.

## 1.2.21
- Checklisten vertagen per Sprache: „After Start Checklist in 10 Minuten“, „Remind me about the descent checklist in five minutes“ oder, wenn der Copilot gerade fragt: „Frag mich in 5 bis 10 Minuten nochmal“ / „Ask me again in 5 to 10 minutes“. Bei einem Bereich wählt der Copilot zufällig eine Zeit darin. Er bestätigt die Zeit, schweigt bis dahin zu dieser Liste und fragt danach wieder, sobald der Ablauf so weit ist (siehe 1.2.20). Funktioniert auch für die Cockpit-Vorbereitung.
- Zeitangaben werden auch ausgeschrieben verstanden („zehn“, „fünf bis zehn“, „half an hour“).
- Nicht im Sim getestet; die Erkennung der Sätze habe ich nur mit Beispieltexten geprüft.

## 1.2.20
- Checklisten-Erinnerungen kommen nicht mehr sofort beim Phasenwechsel, sondern erst, wenn der Ablauf wirklich so weit ist:
  - Before Start: erst 1 Minute nach der Cockpit-Vorbereitung, nicht solange GSX Boarding/Tanken/Catering läuft und nicht während des Pushbacks (ohne Vorbereitungs-Haken nach 3 Minuten).
  - After Start: erst, wenn die Triebwerke ca. 40 s laufen und der Pushback vorbei ist.
  - Taxi: erst nach After Start und wenn du rollst. Before Takeoff/Line-up: später, erst nach einiger Rollzeit.
  - After Takeoff: erst ca. 90 s nach dem Abheben über 2500 ft und im Steigflug. After Landing: erst, wenn du langsam genug bist. Descent/Approach/Parking mit kurzer Verzögerung.
  - Jede Phase muss mindestens 20 s stabil sein; eine übersprungene Liste blockiert die folgenden nicht mehr.
- Hinweis: Die Zeiten sind aus der Praxis geschätzt und nicht im echten Flug getestet. Sag mir, welche du länger oder kürzer willst.

## 1.2.19
- Pushback-Richtung: Ground kennt jetzt alle GSX-Optionen („Nose Left/Tail Right (Left)“, „Straight pushback“, „Straight Pull pushback“ …) und liest sie verständlich vor („nose left, tail right, turning left“). Bei Unklarheit oder keinem Treffer werden alle Optionen genannt, nicht nur die ähnlichen.
- Sinngemäße Zuordnung deiner Antwort: „nose left“, „tail right“, „left“ (= Drehrichtung in der Klammer), „straight“, „straight pull“. Typische Verhörer („tile“ für tail, „no“ für nose) werden korrigiert.
- Antworten wie „Left“ oder „Cockpit to ground, nose left“ gelten, solange das GSX-Richtungsmenü offen ist (bis ca. 2 Minuten nach der Anfrage), als Antwort auf die Frage – nicht mehr als neuer, unverstandener Befehl („Say again, which service…“).
- Whisper bekommt die Richtungsbegriffe als Hinweis.
- Hinweis: Das reale GSX-Menü konnte ich hier nicht testen; die Auswertung beruht auf den Eintragstexten aus deinem Verlauf. Im Verlauf steht weiterhin „GSX-Menü: …“ zur Kontrolle.

## 1.2.18
- GPU: Solange GSX noch lädt (Couatl nicht gestartet, danach noch ca. 25 s), sagt Ground „Stand by, ground services are still starting up.“ statt „verbunden“. GSX trennt beim Laden die Bodenstrom-Anlage des Fliegers, der vorherige Zustand war deshalb nicht verlässlich.
- Pushback: Ab „request pushback“ bis zum Ende des Pushbacks sagt die Bodencrew von sich aus nichts mehr, GSX übernimmt den Ablauf (Bremse lösen, Schlepper). Dein Kommando und die Richtungsfrage bleiben. Danach folgt wie bisher „Cleared to start engines“ (bei unbekanntem Bremszustand erst 12 s nach Pushback-Ende, damit es nicht in GSX hineinredet). Wer die Ansagen während des Pushbacks trotzdem will, schaltet im Copilot-Tab „Bodencrew spricht auch während des Pushbacks“ ein.
- Im Verlauf steht bei jedem GSX-Dienst jetzt das gelesene Menü („GSX-Menü: Titel | Eintrag | …“) zur Fehlersuche.
- Neu im Copilot-Tab: „GSX-Menü per Zifferntaste bedienen“. Dann wählt der EFB den Eintrag, indem er MSFS aktiviert und die Ziffer 1–9 sendet (Windows, GSX-Tastatursteuerung), statt die GSX-Variable zu setzen. Nur einschalten, wenn die Auswahl sonst nicht ankommt.

## 1.2.17
- Parkbremse: Der Copilot behauptete immer „released“, weil der Standardwert des Sims beim FBW dauerhaft „gelöst“ bleibt. Der EFB liest jetzt zusätzlich die FBW-Variable (A32NX_PARK_BRAKE_LEVER_POS). „Gelöst“ gilt außerdem erst als verlässlich, wenn der Sim die Bremse einmal als gesetzt gemeldet hat; bis dahin nimmt der Copilot deine Antwort an, ohne sie zu widersprechen. Gilt auch für Ground („set parking brake first“, Pushback, Triebwerksstart).
- T.O. Speeds: Reihenfolge und Schreibweise sind frei („V1 150, V2 155“, „V one 150“, „V2 155 V1 150“, „150 152 155“). Es werden nur die genannten Werte gegen den Performance-Rechner geprüft.
- „Cockpit to ground“: Verhörer wie „cockpots of ground“, „cock pit two ground“ gelten jetzt auch als Anruf an Ground. Whisper bekommt die Anrede zusätzlich als Hinweis.

## 1.2.16
- Funk: Der Copilot sagte oft „Das Funkgerät hat die Frequenz nicht angenommen“, weil er nur 0,9 s auf die Rückmeldung des Sims wartete (der meldet COM nur einmal pro Sekunde). Er wartet jetzt bis zu 3,5 s. Kommt die Frequenz wirklich nicht an, nennt er, was das Funkgerät anzeigt („The radio shows … active and … standby“), und der Verlauf zeigt die Werte bzw. den Grund.

## 1.2.15
- Bodenstrom/Chocks: Ground sagt nur noch „connected“ bzw. „in place“, wenn der Sim es wirklich meldet. Bei unbekanntem oder falschem Zustand kommt „requested, but I cannot confirm it. Please check the panel.“. Zuvor galt ein fehlender Status (z. B. bei Standard-Fliegern) fälschlich als „verbunden“.
- Standard-Flieger: Der EFB liest jetzt „EXTERNAL POWER AVAILABLE/ON“ als Bodenstrom-Status.

## 1.2.14
- Natürlichere englische Stimmen mit Kokoro (kostenlos, offline, Apache-2.0): Die Windows-App (ab 1.3.10) lädt sie auf Wunsch nach (ca. 130 MB). Sie erscheinen im Copilot-Tab bei den Stimmen (Michael, Adam, Lewis, George, Sarah, Bella, Emma); die Bodencrew nimmt sonst automatisch Michael. Kokoro spricht kein Deutsch, deutsche Sätze bleiben bei Piper.
- Kokoro rechnet pro Satz; häufige Ground-Meldungen werden im Hintergrund (nur am Boden) vorab berechnet, damit sie ohne Pause kommen. Neue Sätze brauchen je nach PC ein bis drei Sekunden.

## 1.2.13
- Ansprache: Ground hört nur noch, wenn „Cockpit“ und „Ground“ im selben Satz vorkommen („Cockpit to ground, we need pushback“). Alles andere geht an den Copiloten. Versteht Ground den Dienst nicht, fragt sie nach. Antworten auf eine Ground-Frage (z. B. die Richtung) brauchen die Anrede nicht.
- Pushback mit GSX: Ground liest den Standplatz aus dem GSX-Menü („Roger, pushback from stand 12. Confirm doors closed and bridge retracted. Which direction do you want?“) und liest die Richtungen vor. Du antwortest z. B. „facing west“, „north“ oder „one“. Danach: „Tug is on its way“, „Tug is connected, release the parking brake when ready“, „Brakes released, starting pushback“, „Pushback complete, set parking brake“, „Cleared to start engines“ …
- Weitere GSX-Meldungen kommen von Ground selbst („Boarding complete, doors are being closed“, „Refueling complete, fuel truck is leaving“).
- Stimmen: Piper klingt etwas lebendiger (mehr Betonung/Variation). Mit der App 1.3.9 gibt es zusätzliche hochwertige Stimmen; Ground nimmt automatisch die beste installierte.

## 1.2.12
- Checklisten-Phase: Beim Pushback (Schleppen mit bis zu ca. 8 kn) gilt man jetzt noch als „am Gate“ statt „beim Rollen“. Die Ladezeit des Sims (kurz „in der Luft“) zählt nicht mehr als Flug und löst kein „nach der Landung“ mehr aus.
- Wartezeit wuchs mit der Zeit: Dauerlärm (über 9 s am Stück, z. B. Lüfter, Sound aus den Lautsprechern) wird nicht mehr zur Spracherkennung geschickt, die Schwelle steigt dafür 90 s lang. Wartende Sprachfetzen, die älter als 8 s sind, werden verworfen.
- Neu: Regler „Eingangslautstärke“ (0,5–6×) unter Audio-Geräte im Copilot-Tab (am PC). Wirkt auf Spracherkennung und Pegelanzeige.
- „Cockpit to ground, we need bushback/push back“: Auch Verhörer wie „bushback“ werden als Pushback verstanden. Versteht Ground den Dienst nicht, fragt sie „Say again, which service do you need?“ statt dass der Copilot etwas zur Checkliste antwortet.
- GPU beim Headwind A339X: Der EFB liest zusätzlich die Standard-Variable „EXTERNAL POWER AVAILABLE“; kann der Copilot den Zustand nicht bestätigen, sagt er „requested, please check the panel“.

## 1.2.11
- Funk: Frequenzerkennung robuster („COM1“ im Satz stört nicht mehr, Zahl vor und nach „decimal/Komma“ wird getrennt ausgewertet, auch lose Ziffernfolgen). Im Verlauf steht jetzt „Frequenz verstanden: 122.800“, damit man sieht, was angekommen ist.

## 1.2.10
- ATC-Tab: Oben im Funk-Feld stehen jetzt COM1 aktiv und COM1 Standby aus dem Sim (live, nur Anzeige). Gestellt wird weiter per Sprache („Frequenz … eindrehen“, „switch to …“).
- Bodencrew meldet sich von selbst immer mit „Ground to Cockpit, …“. Antwortet sie auf deinen Funkspruch und du hast darin gegrüßt (hello, hi, hallo, good morning …), antwortet sie einmal mit „Ground, hello, …“. Ein reines „Ground, hello“ beantwortet sie mit „go ahead“.
- Bodenstrom (GPU) und Bremsklötze (Chocks) laufen jetzt direkt über den EFB statt über das GSX-Menü – die Meldung „GPU nicht verfügbar“ kommt nicht mehr. „Request ground power“ / „disconnect ground power“ / „chocks removed“ funktionieren und werden mit dem Sim-Zustand abgeglichen.
- Echte Ansagen statt GSX-Stimme: nach dem Pushback „Pushback complete, set parking brake“, danach „Cleared to start engines“, laufen die Triebwerke „Roger, disconnecting, standing by for hand signals“ (Bodenstrom wird getrennt) und „Disconnect complete, you are clear on the left“. Auch auf Zuruf: „Cockpit to ground, request engine start“ / „ready for disconnect“. Boarding fertig, Refueling fertig und die Ankunft am Stand („Welcome, chocks are in place“) werden ebenfalls angesagt. Im Copilot-Tab abschaltbar („Bodencrew meldet sich selbst“).

## 1.2.9
- Aussprache: Abkürzungen wie ADIRS, APU, MCDU, QNH werden buchstabiert („A.D.I.R.S.“).
- Checklisten-Antworten: Zahlen wie „1.0.2.1.“, „eins null zwei eins“ oder „1021“ gelten gleich; „… and checked“ dahinter schadet nicht. Baro Ref wird mit dem QNH des Sims verglichen, sonst korrigiert dich der Copilot. Parkbremse: „set“ oder „released“ reicht und wird mit dem Sim abgeglichen. T.O Speeds: „V1 153, VR 145 and V2 148, flaps 2“ wird gegen den Performance-Rechner geprüft („Stimmt“ oder die richtigen Werte). T.O Runway: „2.3.“ oder „two three left“ wird mit der geplanten Piste verglichen (Rollweg-Eingabe in der Karte, sonst Performance-Rechner, sonst OFP). Packs beantwortet der Copilot selbst („On, as required“); mit dem Häkchen „Start mit Packs AUS“ im Copilot-Tab sagt er „Off“.
- Funk: „Frequenz 1.2.2 decimal 8.0.0 eindrehen“ stellt COM1 Standby ein, „switch to 1.2.2 decimal 8.0.0“ schaltet um (auch „swap frequencies“). Der Copilot liest die Frequenz zurück und prüft, ob der Sim sie angenommen hat.
- Stumm-Knopf in der Kopfleiste (Mikrofon-Symbol): Der Copilot spricht dann nicht und hört nicht zu (auch kein Mikrofon). Gilt für alle Geräte; vom iPad aus drückbar.
- Mehr Leben (im Copilot-Tab einzeln abschaltbar): Rollweg-Ansagen („Gleich links auf Taxiway November“, „Halt vor Piste 26 rechts“) aus der Rollroute in der Karte, Verkehrshinweise über VATSIM („Vor uns steht DLH123 nach EDDM“, „Verkehr 11 Uhr …“) und Callouts (80 Knoten, V1, Rotate, Positive Rate, 10.000 Fuß).
- Karte: Mit Sim-Position zeigt die Bodenkarte nur noch den Rollweg-Abschnitt, auf dem du gerade bist, und den nächsten (mit „links/rechts“-Marke), nicht mehr die ganze Route. Die ganze Route siehst du als Vorschau, solange das Rollweg-Fenster in der Karte offen ist.

## 1.2.8
- Neuer Tab „Copilot“: Alle Einstellungen (Stimmen, Sprache, Tempo, Mikrofon, Funk & Geräusche, Audio-Geräte) und der Verlauf mit Eingabefeld liegen jetzt dort. Auf der Checklisten-Seite ist nichts davon mehr. Der Tab lässt sich unter Setup wie die anderen ein-/ausblenden und verschieben.
- Das iPad (und jedes Gerät, das nicht der PC ist) spricht und hört nie selbst zu. „Copilot starten/stoppen“ am iPad startet bzw. stoppt den Copilot am PC. Läuft dort noch kein Copilot-Fenster, öffnet die Windows-App es (mit App 1.3.8).
- Einstellungen vom iPad (Stimme, Tempo, Mikrofon an/aus, Funk, Geräusche) gelten sofort am PC. Hörproben und Tests der Geräusche laufen am PC, nicht auf dem iPad. Systemstimmen des iPads werden nicht mehr angeboten.
- Eigene Geräusche hochladen und Mikrofon/Lautsprecher wählen geht nur im Copilot-Fenster am PC.

## 1.2.7
- Audio-Geräte: Im Copilot-Fenster unter „Audio-Geräte“ lassen sich Mikrofon und Ausgabegerät (Lautsprecher/Kopfhörer) wählen. Mit Pegelanzeige zum Mikrofontest (4 s) und einem Testton für die Ausgabe. Die Wahl gilt für Spracherkennung, Copilot- und Ground-Stimmen, Funk, Hintergrundgeräusche und eigene Sounds und bleibt gespeichert. Ist ein gewähltes Gerät nicht angeschlossen, wird automatisch das Windows-Standardgerät genutzt.

## 1.2.6
- Cockpit-Vorbereitung: Die erste Erinnerung des Copiloten kommt jetzt erst 5–10 Minuten (zufällig) nachdem die Bodenstromversorgung (GPU) angeschlossen wurde. Gibt es keine GPU-Information oder wird keine angeschlossen, kommt sie nach 15 Minuten.
- Funk-Effekt für das Bodenpersonal: leises Knacken beim Senden, schwaches Rauschen beim Sprechen und ein Squelch am Ende. Lautstärke und Ein/Aus im Copilot-Fenster unter „Funk & Geräusche“.
- Hintergrundgeräusche: Eingebaut sind Jetway-Piepen, Rückfahrwarner, Bodenstrom-Brummen, Fahrzeugmotor und Klacken. Jedes lässt sich einzeln an- und ausschalten und testen. Sie laufen zufällig im Hintergrund, wenn das Bodenpersonal spricht (Lautstärke und Häufigkeit einstellbar).
- Eigene Geräusche (MP3/WAV/OGG, max. 8 MB) lassen sich im selben Bereich hochladen und wieder löschen.

## 1.2.5
- Spracherkennung deutlich schneller: Das Modell bleibt jetzt im Arbeitsspeicher (whisper-server) und wird beim Start des EFB schon vorgeladen, statt für jeden Satz neu geladen zu werden. Typisch Sekundenbruchteile statt vieler Sekunden. Fällt der Server aus, nimmt der EFB automatisch den alten Weg.
- Schnellere Dekodierung (greedy), kürzerer Hinweistext, Sprechpause als Satzende von 0,6 auf 0,45 s verkürzt, veraltete Sätze in der Warteschlange werden übersprungen.
- Die Antwort von /api/stt enthält jetzt die Dauer (ms) und den Weg (server/cli) zur Diagnose.

## 1.2.4
- Bodenpersonal: Pushback-Menüs aus GSX-Profilen werden jetzt richtig erkannt. Beispiele aus echten Menüs: „Release Point R2“, „LFRN_C3-28“, „FACING WEST (Taxiway A)“, „QuickEdit Pushback“, „Straight pushback“. Du sagst nur den markanten Teil („Cockpit to ground, pushback approved Romeo Two“, „… Charlie three two eight“, „… facing west“, „… straight pull“); NATO-Alphabet und Zahlwörter werden zusammengesetzt (C328 = „Charlie three two eight“). Passen mehrere Einträge („Charlie three“), fragt das Bodenpersonal „Which one?“ und liest nur diese vor; du antwortest dann z. B. „two eight“ oder mit der Nummer.
- Eigene Sounds für Pushback-Punkte: Dateiname = markanter Teil des Menünamens (z. B. pushback.ack.R2.mp3, pushback.ack.C328.mp3), optional mit Richtung (pushback.ack.R2.west.mp3).

## 1.2.3
- Bodenpersonal: Himmelsrichtung beim Pushback. „Cockpit to ground, pushback approved Sierra One facing south“ (auch „Richtung Süd“) wählt den GSX-Eintrag mit S1 und „south“. Fragt GSX die Richtung erst im nächsten Menü, wird sie dort automatisch gewählt. Gibt es die Kombination nicht, sagt das Bodenpersonal „Negative“ und liest die Auswahl vor. Eigene Sounds lassen sich auch pro Richtung festlegen (z. B. pushback.ack.S1.south).

## 1.2.2
- Bodenpersonal: Pushback-Profile mit NATO-Alphabet. „Cockpit to ground, pushback approved Sierra One“ fordert den Pushback an und wählt in GSX den Eintrag mit „S1“ (z. B. aus dem GSX-Profil einer Szenerie); „Sierra One“, „Sierra 1“ und „S1“ sind gleichwertig, auch längere Namen wie „A12“ („Alpha Twelve“). Gibt es den Namen nicht, liest das Bodenpersonal die Auswahl vor.
- Eigene Sounds: Statt der Computerstimme spielt das Bodenpersonal MP3/WAV/OGG-Dateien aus dem Ordner „sounds“ (Dateiname = Ereignis, z. B. pushback.ack.S1.mp3 oder boarding.done.mp3). Zuordnung bequem in der Windows-App unter Copilot. Der Ordner bleibt bei Updates erhalten.

## 1.2.1
- Neu: Bodenpersonal per Sprache (GSX). Sag z. B. „Cockpit to ground, request boarding“ (auch pushback, catering, refueling, deboarding, jetway, stairs, GPU, de-icing …, Deutsch geht auch: „Bodenpersonal, Catering anfordern“). Das Bodenpersonal antwortet mit einer anderen Stimme („Roger, boarding requested“) und meldet später „Boarding in progress“ und „Boarding complete“. Stellt GSX eine Rückfrage (z. B. Pushback-Richtung), liest es die Möglichkeiten vor; du antwortest mit der Nummer oder dem Namen („nose left“, „zwei“). Die Stimme ist im Copilot-Feld einstellbar („Ground: …“).
- Spracherkennung: empfindlicher bei leisem Mikrofon (automatische Anhebung), kürzere Pause bis zur Auswertung, und der Copilot meldet „gehört, aber nichts verstanden“, wenn Sprache erkannt, aber kein Text erzeugt wurde.

## 1.2.0
- Copilot am PC, Checkliste am iPad: In der Windows-App öffnet „Copilot-Fenster öffnen“ den Copilot, der über die Kopfhörer des PCs spricht und per Mikrofon zuhört. Das iPad zeigt nur die Checkliste: Haken, die du per Sprache setzt, erscheinen dort sofort; du kannst am iPad auch Listen antippen oder Antworten tippen, der Copilot am PC reagiert darauf. Läuft ein Copilot-Fenster am PC, ist der Schalter am iPad gesperrt („Copilot läuft am PC“).
- Neu: Spracherkennung direkt in der App (Whisper, Open Source, offline, ohne Cloud). Die App lädt sie auf Wunsch nach (Copilot → Spracherkennung). Sprachbefehle: „Let's do the Cockpit Preparation checklist“, „starte die Before Start Checkliste“, „next checklist“ – Deutsch und Englisch.
- Der Checklisten-Stand liegt jetzt auf dem PC (clstate.json, bleibt bei Updates erhalten), damit PC und iPad dieselben Haken sehen.

## 1.1.10
- Copilot: Englische Begriffe in deutschen Sätzen (Checklisten-Namen, „Checked“, Fuel, QNH, V1/VR/V2, Flaps, Gate …) werden jetzt automatisch erkannt und mit einer englischen Stimme gesprochen, nicht mehr mit deutschem Akzent. Neu: eigene Auswahl „EN: …“ für die englische Stimme (sichtbar bei Copilot-Sprache Deutsch).

## 1.1.9
- Copilot: Englische Fachwörter (Namen der Checklisten wie „Before Start“, „Cockpit Preparation“) werden jetzt mit einer englischen Stimme gesprochen, der Rest des Satzes mit der deutschen. Vorher klangen sie extrem deutsch. Die Abschlussmeldung einer Liste wird nicht mehr mit der englischen Stimme gelesen.

## 1.1.8
- Eingebaute Offline-Stimmen für den Copilot (Piper): klingen deutlich natürlicher als die Windows-Stimmen und brauchen kein Internet. Sie sind in der Windows-App enthalten; im Copilot-Feld erscheinen sie mit ★ und werden automatisch gewählt. Ohne die App nutzt der Copilot wie bisher die Stimmen des Browsers. Neu: Server-Schnittstelle /api/tts (Zwischenspeicher in cache/tts).

## 1.1.7
- Copilot: Stimme wählbar (alle Stimmen deines Systems), Schalter „Automatisch starten“ (schaltet den Copilot nach dem ersten Klick ein). Die Copilot-Einstellungen werden in copilot.json gespeichert und bleiben bei Updates erhalten.
- Vorbereitung für die Windows-App: Update-Ablauf und Neustart funktionieren auch, wenn die EFB von der App gestartet wird.

## 1.1.6
- Neu: Sprach-Copilot im Checklisten-Tab (Schalter „Copilot“). Er spricht über die Kopfhörer des PCs und hört per Mikrofon zu. Tippst du eine Checkliste an, sagt er, ob sie jetzt dran ist (nach Flugphase: Gate, Rollen, Flug, Sinkflug, Anflug, Landung) und fragt, ob ihr sie machen wollt; passt sie noch nicht, nennt er den Grund. Vergisst du eine Liste, fragt er beim Wechsel der Phase von selbst nach. In der Liste liest er jeden Punkt vor, du antwortest, er sagt „Checked“ und hakt ab. Geprüft werden Takeoff-Speeds (V1/VR/V2 aus dem Performance-Rechner), Baro/QNH und Fuel (aus dem Sim) sowie die Startklappen; alle anderen Punkte werden bestätigt. Sprachbefehle: weiter/überspringen, wiederholen, stopp. Deutsch und Englisch, Tempo einstellbar, Texteingabe als Ersatz fürs Mikrofon.
- Neu: Update direkt in der App (Setup → Info → „Update installieren“, nur am PC): ZIP wählen, die EFB ersetzt die Programmdateien, behält Einstellungen, Logbuch, PIN, Hintergründe und config.json und sichert ersetzte Dateien in _backup (die letzten drei bleiben). „Jetzt neu starten“ startet über start.bat automatisch neu und installiert bei Bedarf Pakete nach.
- Der Performance-Rechner merkt sich die letzte Berechnung (für den Copilot).

## 1.1.5
- Türen im Standard-EFB: Die Zuordnung „Kachel → Tür im Sim“ wird jetzt beim ersten Antippen gelernt (vorher konnte Tür 1 die Anzeige von Tür 2 bewegen). Keine Reaktion im Sim wird gemeldet; unter den Kacheln stehen die Rohwerte aller Türen zur Diagnose.
- Flieger-Auswahl nach Hersteller (Airbus, Boeing, Sonstige) gruppiert und nach Entwickler getrennt (Standard/MSFS, PMDG, iniBuilds, FlyByWire, Fenix, Headwind). Es gibt z. B. 737 für PMDG und 737 aus dem Standard-Sim getrennt. Suchbegriffe mit „&“ verlangen mehrere Treffer („PMDG&737“); bei mehreren Profilen gewinnt der genauere. Beim Update werden Profile automatisch umgestellt; eigene Flieger bleiben erhalten.
- Flug-Seite: Der Text „NM geflogen · NM verbleibend“ steht jetzt fest in der Mitte unter der Strecke und überlagert keine Flughafennamen mehr.
- Karte: Der Abflug-Rollweg verschwindet nach dem Abheben, der Ankunfts-Rollweg am Gate nach der Landung (Parkbremse gesetzt, 20 s). Ein Flugplan mit anderer Strecke leert alte Rollwege. Neu: „Alle löschen“ im Rollweg-Fenster und ein × an der Rollweg-Leiste.
- Neu: Web-Version ohne Node (eigenes Paket „Web“): läuft komplett im Browser, auch auf Xbox/iPad/Handy. Position über den VATSIM-Datenfeed, Anleitung in LIESMICH-WEB.md.

## 1.5.1
- Profile für Airbus A330 (-200/-300, auch Frachter P2F) und A400M (Standard-EFB, Airbus-Checkliste); A400M im Performance-Rechner (Näherungswerte). Headwind A339X behält Vorrang. A310 war schon in 1.5.0 enthalten.

## 1.5.0
- Profile für iniBuilds (A350, A340, A310, A300-600) und den Standard-A320 des Sims; Erkennung am Titel, Airbus-Checkliste, Performance-Typ. A300-600R und A310-300 neu im Performance-Rechner (Näherungswerte).
- Standard-EFB hat jetzt einen Payload-Tab: Passagiere und Fracht eingeben, die Nutzlast wird sofort auf die Beladungsstationen des Fliegers verteilt (wie bisher beladen, sonst gleichmäßig). Anzeige von Nutzlast, ZFW und Gesamtgewicht (Schätzung).
- Nicht möglich ohne Herstellerschnittstelle: Presets und Boarding-Animation. Nicht mit iniBuilds im Sim getestet.

## 1.4.0
- Boeing-Unterstützung: neue Flieger-Profile Boeing 737 (NG), 737 MAX, 747, 777 und 787. Sie werden am Titel des Fliegers im Sim erkannt (auch PMDG, iniBuilds usw.) und erscheinen in der Flieger-Auswahl; vorhandene Installationen bekommen sie beim Start automatisch ergänzt.
- Neues Standard-EFB im EFB-Tab (ohne Herstellervariablen): Türen, Fluggastbrücke, Treppe, Catering, Gepäck, Tankwagen, GPU, Tank direkt befüllen (Flächen, dann Center) und Sim-Störungen. Beladung und Presets gibt es dort nicht.
- Checklisten „Boeing schmal“ und „Boeing breit“ (allgemein gehalten, kein Handbuchersatz).
- Performance-Rechner wählt für Boeing den passenden Typ vor (B738, B38M, B748, B77W, B789; weitere im Typ-Menü).
- Hinweis: Nicht mit einem echten Boeing im Sim getestet. Add-ons mit eigenem System (z. B. PMDG) können Tankwerte oder Türen eigenständig überschreiben.

## 1.3.0
- Neuer Tab „Wetter“: aktuelles METAR (NOAA aviationweather.gov), VATSIM-ATIS oder nur die Werte – umschaltbar. Für Abflug, Ziel, Ausweichflughafen und die nächste Wetterstation am aktuellen Standort. Aktualisiert sich automatisch jede Minute; gibt es keine ATIS, wird das METAR gezeigt.
- Der Wetter-Kasten auf der Flug-Seite nutzt jetzt ebenfalls die aktuellen METARs statt der festen aus dem OFP.
- Flug-Seite: Ein Flugzeug auf der Streckenlinie zeigt, wo du im Verhältnis zur Strecke bist (inkl. NM geflogen / verbleibend).
- Der Tab lässt sich wie die anderen in Setup → Tabs ein-/ausblenden und sortieren.

## 1.2.1
- Performance: Takeoff-Geschwindigkeiten für Großraumflugzeuge (A330/A350/A380/777 …) höher und realistischer; V2 sinkt bei geringem Gewicht nicht mehr unter eine Untergrenze. Behebt „TAKEOFF SPEEDS TOO LOW“ im Headwind A339. Die Werte bleiben Näherungen – bei Abweichung die SimBrief-/TLR-Werte oder den Rechner des Flugzeugs nehmen.

## 1.2.0
- PIN: Du legst sie beim ersten Öffnen am iPad selbst fest (4 bis 8 Ziffern). Am PC steht sie unter Setup → Zugang, dort lässt sie sich auch ändern. Bestehende Installationen behalten ihre PIN
- Musik: Der Endlosschleife-Knopf zeigt jetzt per Meldung und Beschriftung, ob Playlist, einzelner Titel oder aus gewählt ist

## 1.1.2
- Helligkeit steht jetzt unter Setup → Design
- Bodenkarte: Meldung „nicht erreichbar“ erscheint seltener. Die PC-Brücke probiert mehrere Overpass-Server und zeigt notfalls alte gespeicherte Daten, das EFB versucht es still mehrmals neu

## 1.1.1
- Sprache: Deutsch und Englisch, einstellbar unter Setup → Sprache (gilt pro Gerät; ohne Auswahl richtet sich die App nach der Browsersprache)
- Das Design „Liquid Glass“ heißt jetzt „Glas“
- Behoben: Flugzeiten wie „1:60 h“ werden richtig als „2:00 h“ angezeigt

## 1.1.0
- Airlines: Auswahl mit Vorlagen, eigene Farbe, eigenes Hintergrundbild und eigenes Design je Airline; Wechsel per Tipp in der Leiste; Übernahme aus dem SimBrief-Flugplan
- Logbuch: automatische Aufzeichnung auf dem PC (Boarding, Block-, Start- und Landezeit, Strecke, Sprit, Gewichte, Landerate); Filter nach Airline oder alle Einträge, Sortierung nach Datum, Flugzeugtyp, Blockzeit oder Airline; Bewertung, Notizen, Löschen einzeln oder mehrfach, Aufräumen, CSV-Export, Einträge von Hand
- Neue Designs: Glas (durchscheinende Flächen), Tageslicht, Nachtrot, Hoher Kontrast
- Tabs ein- und ausblenden und sortieren, Presets
- Setup neu aufgebaut mit Bereichen
- Behoben: Symbole in den Musik-Tasten und der Seitenleiste saßen nicht mittig

## 1.0.0-rc1
- Zugangsschutz: Kopplung des iPads per PIN, nur lokales Netzwerk, Abwehr fremder Webseiten (Origin/Host-Prüfung), Anmeldedateien nur für den Benutzer lesbar
- Hinweise und Quellenangaben in der App, beim ersten Start ein Haftungshinweis
- Kartenserver und Overpass-Adresse einstellbar, eigene Kennung bei Abfragen
- Import freier Flughafendaten (OurAirports) per `import-airports.bat`
- LICENSE (MIT), THIRD-PARTY-NOTICES.md, PRIVACY.md

## 0.10.x
- Karte: Höhenwind und Wolken, Rollweg-Anzeige, Stands, bessere Leistung; Musik-Tab mit Suche
