# Vestoro — Produktplan

> Klarheit über dein Geld. Lokal, kostenlos, deutsch.

Lokale-first Personal-Finance-App für den deutschen Markt. Kern: Cashflow-Analyse
über alle Konten (Sankey + Barcharts + Kategorisierung). Portfolio folgt später.

## Grundsatzentscheidungen (bewusst, nicht mehr diskutieren)

| Entscheidung | Begründung |
|---|---|
| **PWA statt Tauri/Electron** | Alpha muss auf Mac, iOS **und** Windows laufen. iOS schließt Desktop-Frameworks aus. PWA = eine Codebasis, installierbar, 0 € Hosting (GitHub Pages). |
| **Local-first, kein Backend** | Daten bleiben in IndexedDB auf dem Gerät. Kein Server = 0 € Kosten, keine DSGVO-Serverpflichten, kein AISP-Lizenzthema. Sync kommt erst in V3 (Datei-basiert). |
| **Beträge als Integer-Cents** | Nie Floats für Geld. Multi-Währung im Schema ab Tag 1 (`currency`-Feld), UI erstmal nur EUR. |
| **CSV-Import zuerst, Automatisierung später** | FinTS/pytr/Scraper sind V3 (Companion-App). Alpha lebt von CSV-Profilen — das ist robust und sofort testbar. |
| **Deutsch als UI-Sprache, Englisch im Code** | Alle UI-Strings in einer `de.ts`-Datei → EN-Umschaltung in Beta trivial. |
| **Ein Repo, kein Monorepo** | Solo-Projekt + KI-Agenten: flache Struktur, kleine Dateien, klare Konventionen. |

## Phasen

### Alpha — „Cashflow-Kern" (du + Freunde, Mac/iOS/Windows)

Ziel: Alle Kontobewegungen sehen, verstehen, kategorisieren. Installierbar als PWA
über eine URL (GitHub Pages), Demo-Datensatz für Tests ohne eigene Daten.

- Datenmodell: Personen → Konten (Typ: Girokonto/Tagesgeld/Festgeld/Depot/Bargeld) → Transaktionen → Kategorien; Multi-Währung im Schema
- CSV-Import mit Bank-Profilen: **C24, DKB** (exakte Formate liegen vor, siehe SPEC), generischer Spalten-Mapper für alles andere (comdirect, ING, Scalable-Prime-Export, pytr-CSV); Mapper-Profile werden gespeichert
- Duplikaterkennung beim Re-Import (Hash über Datum+Betrag+Gegenkonto+Zweck)
- Transfer-Erkennung: Umbuchungen zwischen eigenen Konten ≠ Einnahme/Ausgabe
- Regelbasierte Kategorisierung („Empfänger enthält REWE → Lebensmittel"), Regeln entstehen aus manuellen Zuordnungen („Regel daraus erstellen?")
- Sankey: Einkommen → (Konten) → Kategorien, monatlich, absolut + %
- Barcharts: Einnahmen/Ausgaben pro Kategorie und Monat
- Sparquote (% vom Netto-Einkommen der Periode)
- Layout: einklappbare Sidebar (Dashboard/Konten/Transaktionen/Einstellungen), Cmd+K-Suche
- Dunkles Grau-Design als Default
- Persistenz: IndexedDB (Dexie) + Backup-Export/-Import als JSON
- Demo-Datensatz per Klick
- Installation: URL öffnen → „Zum Home-Bildschirm/installieren". Für Entwickler: `npm install && npm run dev`, ein Befehl.

**Bewusst NICHT in Alpha:** Budgets, Ziele, Portfolio, Verträge, PDF-Import, Sync, Mehrsprachigkeit, Hell-Modus.

### Beta — „Alltagstauglich" (Familie testet)

- Zeiträume Woche/Monat/Quartal/Jahr + Vergleich Vorperiode (Δ absolut/%)
- Anpassbares Dashboard (Widget-Grid, Drag&Drop), Standard-Templates
- Sparziele mit Fortschrittsbalken, Budgets pro Kategorie (Soll/Ist)
- Gemeinschaftskonto mit Anteilslogik (z. B. 50 % der Ausgaben zählen zu dir)
- Bargeld-Konto (manuell), Cash-Verteilung Giro/Tagesgeld/Festgeld (Festgeld mit Fälligkeit)
- Hell/Dunkel/System-Umschalter, DE/EN-Umschaltung
- Einstellungen: Profil, Bankprofile-Übersicht, „Alle Daten löschen" (versteckt hinter Bestätigung)
- Glossar-Infoboxen (?-Icon), Feedback-Link (GitHub Issues)

### V1 — „Öffentliches Release" (GitHub-Launch)

- Personen-/Konten-Umschalter (du, Partner, Kinderdepot)
- Portfolio-Grundlagen: Depot-Konten, Positionen, Käufe/Verkäufe aus Broker-CSVs
- Asset-Suche Name/ISIN/WKN; Kurse verzögert über BYOK-API/kostenlose Quellen
- Vertragsübersicht: wiederkehrende Abbuchungen automatisch erkannt, Kündigungs-Link
- Widget-/Template-Sharing (Datei/Zwischenablage)
- Onboarding-Flow, README mit GIFs, Contribution-Guide

### V2 — „Analyse & Projektion"

- Rechner-Suite (Zinseszins/Sparplan mit Inflation, FIRE, Entnahmeplan) — vorbefüllbar mit echten Daten
- Benchmarks im Depot-Chart (Inflation, FTSE All-World, MSCI World)
- Virtuelles Depot / Watchlists, IZF mit Erklärung, Steuer-Toggle (KESt)
- KI-Kategorisierung (BYOK oder lokales Ollama), PDF-Import (TR-Abrechnungen, Kontoauszüge)
- Monte-Carlo für Sparpläne, Szenario-Vergleiche

### V3 — „Automatisierung & Community"

- Lokale Companion-App (Tauri/CLI): FinTS (DKB, ING), comdirect-API, pytr (TR), Scalable-Proxy
- Feedback via GitHub Projects + 👍-Votes, Plugin-System für Rechner & Bank-Profile
- Länder-Steuermodule (AT/CH), Datei-Sync (iCloud-/Dropbox-Ordner), Multi-Device

## Monetarisierung (Perspektive, nichts davon vor V1)

Freemium wie Finanzfluss Copilot/Parqet: Basis kostenlos & open source, bezahlt wird
später die Bequemlichkeit (gehosteter Sync, automatischer Bankabruf über lizenzierten
Partner, Premium-Analysen). Companion-App und Datenmodell werden so gebaut, dass ein
bezahlter Sync-Dienst andockbar ist, ohne den lokalen Kern zu ändern.

## Status (Stand 05.07.2026)

Alpha ist funktional (Cashflow-Kern, CSV-Import C24/DKB, Kategorisierung,
Bulk-Zuordnung, Umbuchungserkennung, erste Rechner, Demo-Umgebung, Setup-Wizard).
Detaillierte nächste Schritte: **docs/TOP-20-TASKS.md** (agentenbereit, präzise
spezifiziert). Vollständiges darüber hinausgehendes Backlog nach Phase/Thema:
**docs/BACKLOG.md**.

## Risiken

- **Scalable ohne Prime:** kein nativer CSV-Export → generischer Mapper + Community-Profile; Proxy erst in V3
- **Trade Republic:** kein offizieller Export → pytr-CSV als Mapper-Profil in Alpha, echte Integration V3
- **PWA auf iOS:** IndexedDB kann bei langer Nichtnutzung von iOS geleert werden → Backup-Export prominent machen, Reminder einbauen
- **Scope Creep:** Jede Phase hat eine „bewusst NICHT"-Liste. Neue Ideen → BACKLOG.md, nicht in die laufende Phase.
