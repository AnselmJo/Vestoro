# Vestoro — Vollständiges Backlog (jenseits der Top 20)

Alles, was zusätzlich zu `docs/TOP-20-TASKS.md` und `docs/PLAN.md` gesammelt
wurde. Nicht priorisiert innerhalb der Kategorien — das passiert erst, wenn
diese Punkte in eine konkrete Aufgabe für einen Agenten übersetzt werden.

## Beta (Feinschliff der Alpha, vor öffentlichem V1-Launch)

- Anpassbares Dashboard: eigene Widget-Layouts per Drag & Drop, Standard-
  Templates zur Auswahl
- Mehrere Sparziele mit Fortschrittsbalken (Notgroschen, Jahresziel, frei
  benennbar)
- Budgets pro Kategorie mit Soll/Ist-Vergleich und Warnindikator bei
  Überschreitung (siehe Fintech-UX-Recherche: "empowering, nicht schuldig
  machend" formulieren, z. B. "Du könntest 50 € mehr sparen" statt "Du hast
  zu viel ausgegeben")
- Gemeinschaftskonto mit Anteilslogik (z. B. Miete über gemeinsames Konto →
  nur 50 % zählen zu den eigenen Ausgaben) — Schema-Feld `sharedRatio`
  existiert bereits auf `Account`, wird aber noch nirgends genutzt
- Bargeld-Tracking: manuelles Cash-Konto, fließt in Cash-Position ein
- Cash-Verteilung Giro/Tagesgeld/Festgeld, Festgeld mit Laufzeit/Fälligkeit
  und Fälligkeits-Erinnerung
- Hell-Modus (aktuell nur Dunkel) + System-Einstellung folgen
- DE/EN-Sprachumschaltung (Grundgerüst ist da: alle Strings zentral in
  `src/i18n/de.ts` — `en.ts` ergänzen + Umschalter in Einstellungen)
- Infoboxen/Glossar per (i)-Icon für Fachbegriffe (z. B. "Was ist die
  Eigenschutzzeit beim Entnahmeplan?", "Interner Zinsfuß vs. einfache Rendite")
- Feedback-Kanal: GitHub Issues verlinken oder einfaches In-App-Formular
- Gespeicherte generische Import-Profile, automatisch erkannt anhand der
  Spalten-Signatur einer Bank (ING/comdirect müssen sonst jedes Mal neu
  zugeordnet werden)
- Transaktions-Detailansicht mit den rohen CSV-Originaldaten (`raw`-Feld ist
  bereits im Schema gespeichert, aber in der UI nicht einsehbar)

## V1 — Öffentliches Release

- Portfolio-Grundlagen: Depot-Konten als eigener Kontotyp (bereits im Schema
  vorbereitet: `AccountType: 'depot'`), Positionen, Käufe/Verkäufe aus
  Broker-CSV-Importen (Scalable-Export, pytr-Export als weitere CSV-Profile
  analog zu C24/DKB)
- Asset-Suche über Name/ISIN/WKN — Aktien, ETFs, Fonds, Anleihen, Zertifikate,
  Metalle, Krypto, Währungen, Cash, Sachwerte (Immobilien bewusst ausgeklammert,
  da eigener Rechner dafür existiert)
- Kursdaten verzögert oder alle X Minuten (BYOK-API oder kostenlose Quelle wie
  Yahoo Finance/Stooq), Kursgewinn dynamisch berechnet
- Template-/Widget-Sharing: Dashboard-Konfiguration als Datei exportieren
  oder in die Zwischenablage kopieren
- vite-plugin-pwa: echte Installierbarkeit mit Offline-App-Shell (aktuell
  läuft die Seite zwar überall, hat aber noch keinen Service Worker)
- PWA-Politur: eigenes Manifest-Icon-Set (aktuell nur Favicon), Onboarding-
  Flow für die installierte App-Variante
- Saubere Doku: README mit echten GIFs/Screenshots (aktuell nur Text),
  CONTRIBUTING.md für externe Mitwirkende

## V2 — Analyse & Projektion

- Benchmark-Kurven im Depot-Chart: Inflation als Vergleichslinie
  (Kaufkraft-Entwicklung direkt ablesbar), Index-Benchmarks (FTSE All-World,
  MSCI World) zum Depot-Vergleich
- Virtuelles Depot ("Hätte ich damals investiert…") mit historischen
  Kursdaten, dazu Watchlists für Assets ohne eigene Position
- IZF-Berechnung (geldgewichtete Rendite, XIRR) mit verständlicher Erklärung
  parallel zur einfachen Rendite
- Steuer-Toggle Depot (DE): Bruttorendite vs. Rendite nach Kapitalertragsteuer
  ("was bleibt tatsächlich bei Verkauf") — Ergänzung zum bereits geplanten
  Kapitalertragssteuer-Toggle im Entnahmeplan-Rechner (Top-20 #15)
- KI-gestützte Kategorisierung als Ergänzung zu den regelbasierten Verfahren:
  BYOK (eigener API-Key) oder lokales Ollama-Modell für Fälle, die keine
  Regel trifft — mit klarer Kennzeichnung "KI-Vorschlag, bitte bestätigen"
  statt stillschweigender automatischer Übernahme (Transparenz-Prinzip aus
  der UX-Recherche)
- PDF-Import: Trade-Republic-Abrechnungen, Kontoauszüge als PDF (ergänzend
  zum CSV-Import, für Banken/Broker ohne CSV-Export)
- Szenario-Vergleiche für Sparpläne (z. B. "3 % vs. 7 % Rendite nebeneinander"),
  Monte-Carlo-Simulation für Sparpläne (Renditepfade mit Streuung statt
  einer einzelnen deterministischen Linie)

## V3 — Automatisierung & Community

- Lokale Companion-App (Tauri oder CLI) für automatischen Sync:
  FinTS-Anbindung für ING/DKB/comdirect (offizielles, kostenloses Protokoll),
  pytr-Integration für Trade Republic, Scalable-Proxy für den kostenlosen
  Tarif (siehe frühere Recherche zu unofficial-scalable-capital-api)
- Feedback-/Ticket-System mit Nutzer-Votes: pragmatisch über GitHub Projects
  + 👍-Reactions, bevor eine eigene Lösung gebaut wird
- Plugin-System für Community-Rechner und -Bank-Import-Profile (damit neue
  CSV-Formate nicht jedes Mal einen Core-Release brauchen)
- Weitere Länder-Steuermodule (AT, CH) für Nutzer außerhalb Deutschlands
- Datei-basierter Sync über eigenen Cloud-Ordner (iCloud/Dropbox), damit ein
  Nutzer mehrere Geräte ohne eigenen Server synchron halten kann — deutlich
  einfacher umzusetzen als ein echtes Backend, passt zum "0 €"-Prinzip

## UX & Design (fortlaufend, nicht an eine Phase gebunden)

- Konsistente Empty-States für jede Sidebar-Seite (aktuell nur Dashboard hat
  einen echten Empty-State, andere Ansichten zeigen bei 0 Daten nur leere
  Tabellen/Charts)
- Mikro-Copy-Audit: alle Fehlermeldungen/Toasts auf den "empowering, nicht
  wertend"-Ton aus der UX-Recherche prüfen (z. B. Bulk-Kategorisierung-Erfolg,
  Import-Fehler)
- Datenvisualisierung als "Storytelling" statt nur statischer Charts (Trend
  in Textform zusammenfassen: "Deine Ausgaben für Freizeit sind diesen
  Monat 18 % höher als im Schnitt" statt nur den nackten Chart zu zeigen)
- Konsistentes Lade-/Skeleton-State-Konzept (aktuell teils "…"-Text, teils
  gar keine Ladeanzeige) — einheitliche `Skeleton`-Komponente
- Tastenkombinationen über ⌘K hinaus dokumentieren/erweitern (z. B. „N" für
  neue Transaktion, „G then D" für Dashboard — GitHub-Stil)
- Responsive-Check für schmalere Laptop-Displays (aktuell primär für breite
  Desktop-Fenster optimiert, Breakpoints in Tailwind-Klassen vorhanden aber
  nicht systematisch durchgetestet)
- Kategorie-Farben frei wählbar statt fester Palette (Aufgabe #1 im Top-20
  bringt eine feste 12er-Palette — freie Farbwahl ist eine spätere Ausbaustufe)

## Datenmodell & Architektur

- Multi-Währungs-Unterstützung tatsächlich nutzbar machen (Schema hat
  `currency`-Feld seit Tag 1, UI zeigt aber überall hart EUR) — relevant
  sobald Fremdwährungskonten oder -depots dazukommen
- Kategorien-Hierarchie nutzen (`Category.parentId` existiert im Schema,
  wird aber nirgends in der UI dargestellt — Ober-/Unterkategorien wie
  "Freizeit → Kino, Sport, Reisen")
- Such-Index für Transaktionen bei sehr großen Datenmengen (aktuell lineares
  Filtern über Array — ausreichend bis mehrere zehntausend Zeilen, siehe
  Top-20 #20 für den Zeitpunkt, ab dem das relevant wird)
- Geräte-übergreifende Konsistenzprüfung nach Datei-Sync (V3): Konflikt-
  Auflösung, wenn dieselbe Transaktion auf zwei Geräten unterschiedlich
  kategorisiert wurde

## Monetarisierung (Vorbereitung, nichts davon vor V1 aktiv)

- Freemium-Grenze definieren: was bleibt dauerhaft kostenlos (lokaler Kern,
  CSV-Import, Rechner), was wird kostenpflichtig (gehosteter Auto-Sync über
  lizenzierten Partner wie finAPI/wealthAPI, Cloud-Backup-Service,
  Mehrgeräte-Sync ohne eigenen Cloud-Ordner)
- Rechtliche Prüfung vor Launch einer bezahlten Sync-Funktion: eigene
  BaFin-Anforderungen vs. Partnerschaft mit lizenziertem AISP (siehe frühere
  Recherche im Chatverlauf zu Qplix/finAPI/wealthAPI)
- Preismodell-Benchmark gegen Finanzfluss Copilot (9 €/Monat), Monarch
  (8–14 $/Monat) für eine spätere Preisentscheidung

## Qualitätssicherung

- End-to-End-Test-Suite (z. B. Playwright) für die Kern-User-Journeys:
  CSV-Import → Kategorisierung → Dashboard-Anzeige, aktuell nur Unit-Tests
  auf `lib/`-Ebene vorhanden
- Visuelle Regressionstests für die Chart-Komponenten (ECharts-Optionen
  ändern sich leicht unbeabsichtigt bei Refactorings)
- Systematischer Cross-Browser-Check (Safari-Eigenheiten bei IndexedDB,
  siehe README-Abschnitt zu Storage-Persistenz)
