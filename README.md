# Vestoro

**Klarheit über dein Geld.** — Lokale Cashflow-Analyse für deine Konten.
Alle Daten bleiben auf deinem Gerät. Kein Server, kein Konto, keine Kosten.

![Status](https://img.shields.io/badge/Status-Alpha-6ea8b5) ![Lizenz](https://img.shields.io/badge/Lizenz-MIT-7fb069)

## Was ist Vestoro?

Vestoro importiert CSV-Kontoauszüge deiner Banken, kategorisiert die
Transaktionen und zeigt dir, wohin dein Geld fließt: als Sankey-Diagramm,
Kategorien-Auswertung, Monatsverlauf und Sparquote. Umbuchungen zwischen
eigenen Konten werden automatisch erkannt und verfälschen die Auswertung nicht.

**Alpha-Funktionen**

- CSV-Import mit automatischer Formaterkennung für **C24** und **DKB**,
  generischer Spalten-Zuordner für alle anderen Banken (ING, comdirect,
  Scalable-Export, pytr-CSV …)
- Duplikaterkennung beim erneuten Import derselben Datei
- Erkennung interner Umbuchungen (via IBAN-Abgleich zwischen eigenen Konten)
- Kategorisierung mit Regeln („Empfänger enthält REWE → Lebensmittel"),
  Regeln entstehen per Klick beim manuellen Kategorisieren
- Dashboard: Einnahmen, Ausgaben, Überschuss, Sparquote, Sankey-Geldfluss,
  Kategorien-Chart, 12-Monats-Verlauf
- Demo-Datensatz zum Ausprobieren ohne eigene Daten
- Backup als JSON-Datei exportieren/importieren

## Nutzung

### Ohne Installation (empfohlen für Tester)

Sobald das Repository auf GitHub Pages veröffentlicht ist:
**https://anselmjo.github.io/Vestoro/** im Browser öffnen (Chrome, Edge,
Safari, Firefox — Mac und Windows). Fertig. Die Daten liegen lokal im
Browser des jeweiligen Geräts.

### Lokal starten (Entwickler)

Voraussetzung: [Node.js LTS](https://nodejs.org) (Version 20 oder neuer).

```bash
git clone https://github.com/AnselmJo/Vestoro.git
cd Vestoro
npm install
npm run dev
```

Dann `http://localhost:5173` im Browser öffnen.

## Datenschutz

Vestoro hat keinen Server. Alle Daten (Konten, Transaktionen, Kategorien,
Regeln) liegen ausschließlich in der IndexedDB deines Browsers auf deinem
Gerät. Es werden keine Daten übertragen, getrackt oder ausgewertet.

**Wichtig:** Da die Daten nur im Browser liegen, gehen sie verloren, wenn du
die Browserdaten löschst. Exportiere deshalb regelmäßig ein Backup
(Einstellungen → Backup exportieren).

## CSV-Export bei deiner Bank finden

| Bank | Weg zum Export |
|---|---|
| **C24** | Transaktionen → Download-Button (CSV) |
| **DKB** | Umsatzliste → Exportieren → CSV |
| **ING** | Umsätze → Export (CSV) → generischer Zuordner |
| **comdirect** | Umsätze → Export → generischer Zuordner |
| **Scalable Capital** | Transaktionen → Export CSV (nur PRIME/PRIME+) → generischer Zuordner |
| **Trade Republic** | Kein nativer Export — [pytr](https://github.com/pytr-org/pytr) `export_transactions` → generischer Zuordner |

## Entwicklung

```bash
npm run dev     # Dev-Server
npm run test    # Unit-Tests (Vitest)
npm run check   # Typprüfung + Tests
npm run build   # Produktions-Build (dist/)
```

Architektur- und Agenten-Konventionen: siehe [CLAUDE.md](CLAUDE.md).
Roadmap: siehe [docs/PLAN.md](docs/PLAN.md).

## Lizenz

MIT
