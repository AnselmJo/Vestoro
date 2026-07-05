<p align="center">
  <img src="public/logo.png" width="72" alt="Vestoro Logo" />
</p>

<h1 align="center">Vestoro</h1>
<p align="center"><strong>Mehr Überblick. Bessere Entscheidungen.</strong></p>
<p align="center">Lokale Cashflow-Analyse für deine Konten. Alle Daten bleiben auf deinem Gerät.<br/>Kein Server, kein Konto, keine Kosten.</p>

---

## Was ist Vestoro?

Vestoro importiert CSV-Kontoauszüge deiner Banken, kategorisiert Transaktionen
automatisch und zeigt dir, wohin dein Geld fließt: Sankey-Diagramm, Kategorien
mit Betrag & Anteil, Monatsverlauf, Sparquote und Umbuchungen zwischen deinen
Konten (von wo → wohin).

**Aktuelle Funktionen**

- 📥 **CSV-Import** mit automatischer Formaterkennung für **C24** und **DKB**
  (inkl. Kontostand-Übernahme aus dem DKB-Export), generischer Spalten-Zuordner
  für alle anderen Banken
- 🏷️ **Auto-Kategorisierung**: eingebaute Regeln für gängige deutsche Händler
  (REWE, Lidl, Telekom, Allianz, …) plus eigene Regeln per Klick
- ⚡ **Bulk-Kategorisierung**: unkategorisierte Transaktionen nach
  Empfänger gruppiert in Sekunden zuordnen
- 🔄 **Umbuchungs-Erkennung** zwischen eigenen Konten mit Richtungsanzeige
  und Auswertung der Geldflüsse
- 📊 **Dashboard**: Monats-/Jahresansicht, KPIs mit Vergleich zur Vorperiode,
  Sankey (mit Vollbild), Kategorien-Anteile, 12-Monats-Verlauf
- 🧮 **Rechner**: Zinseszins/Sparplan (mit Inflation) und FIRE-Projektion,
  vorbefüllt mit deinen echten Durchschnittsausgaben
- 🧪 **Demo-Umgebung**: strikt getrennt von echten Daten, Umschalter oben rechts
- 💾 **Backup** als JSON-Datei exportieren/importieren
- 👥 Mehrere Personen und Konten, Wechsel oben rechts im Header

## Nutzung

### Ohne Installation (empfohlen)

**https://anselmjo.github.io/Vestoro/** im Browser öffnen — fertig.
Funktioniert auf Mac und Windows (Chrome, Edge, Safari, Firefox).
Die Daten liegen lokal im Browser des jeweiligen Geräts.

### Lokal starten

Einmalig [Node.js LTS](https://nodejs.org) installieren (Version 20+). Dann:

```bash
git clone https://github.com/AnselmJo/Vestoro.git
cd Vestoro
npm install
npm run dev
```

Im Browser öffnen: **http://localhost:5173**

## Lebenszyklus: starten, stoppen, updaten, löschen

Vestoro ist eine reine Browser-App ohne Hintergrunddienst — es gibt nichts,
das "dauerhaft laufen" muss. Zwei Nutzungsarten:

**A) Gehostete Version (empfohlen für den Alltag)**
Einmal **https://anselmjo.github.io/Vestoro/** öffnen und über das
Browser-Menü **„Installieren"** (Chrome/Edge) bzw. **„Zum Home-Bildschirm"**
(Safari) hinzufügen. Danach liegt ein normales App-Icon auf dem Schreibtisch/
Dock — öffnen und schließen wie jede andere App. Kein Terminal nötig.
*Updaten:* passiert automatisch beim nächsten Öffnen, sobald ein neuer Stand
auf GitHub Pages liegt.

**B) Lokale Entwicklungsversion**
- **Starten:** `cd /Users/aj/projekte/Vestoro && npm run dev`, Browser öffnet
  `http://localhost:5173`
- **Stoppen:** Im Terminal `Ctrl + C`. Der Tab im Browser kann offen bleiben,
  zeigt dann aber nur einen Verbindungsfehler — das ist normal und unschädlich.
- **Neu starten:** derselbe `npm run dev`-Befehl
- **Updaten:** `git pull`, danach `npm install` (nur nötig, wenn sich
  `package.json` geändert hat)

**Daten löschen:** In der App unter **Einstellungen → Gefahrenzone → Alle
Daten löschen**. Das betrifft nur die gespeicherten Finanzdaten, nicht die
App selbst.

**App komplett entfernen:** Bei der gehosteten Version die PWA in den
Betriebssystem-Einstellungen deinstallieren (oder im Browser unter
Website-Einstellungen „Daten löschen" für anselmjo.github.io ausführen).
Bei der lokalen Version reicht es, den Projektordner zu löschen.

## Die Oberfläche in 60 Sekunden

| Bereich | Was du dort machst |
|---|---|
| **Oben rechts** | Umgebung wechseln (**Meine Daten** ↔ **Demo**), Person und Konto filtern. Der Filter gilt in der ganzen App. |
| **Dashboard** | Zeitraum wählen (Monat/Jahr, ◀ ▶), KPIs mit Trend, Geldfluss-Sankey, Ausgaben nach Kategorie (€ und %), Umbuchungen zwischen Konten. |
| **Transaktionen** | Alle Buchungen filtern & durchsuchen (⌘K). Kategorie direkt in der Zeile ändern. **Bulk-Kategorisierung** ordnet ganze Empfänger-Gruppen auf einmal zu — optional mit Regel für die Zukunft. |
| **Konten** | Konten anlegen, CSV importieren, berechneter Saldo + Kontostand lt. Bank-Export. |
| **Rechner** | Sparplan-/Zinseszins- und FIRE-Rechner, live berechnet. |
| **Einstellungen** | Personen, Kategorien, Regeln, Backup, Demo-Daten, Alles-Löschen. |

Module mit **„bald"**-Badge (Portfolio, Budgets, Ziele, Verträge, Berichte)
sind Platzhalter — die Roadmap steht in [docs/PLAN.md](docs/PLAN.md).

## Erste Schritte mit echten Daten

1. Oben rechts auf **Meine Daten** schalten
2. **Konten → CSV importieren**, Export deiner Bank auswählen
3. Format wird automatisch erkannt (C24/DKB) oder per Spalten-Zuordner gemappt
4. **Transaktionen → Bulk-Kategorisierung**: übrige Buchungen in Minuten zuordnen
5. **Einstellungen → Backup exportieren** (Daten liegen nur in diesem Browser!)

### CSV-Export bei deiner Bank finden

| Bank | Weg zum Export |
|---|---|
| **C24** | Transaktionen → Download-Button (CSV) |
| **DKB** | Umsatzliste → Exportieren → CSV |
| **ING / comdirect** | Umsätze → Export → generischer Zuordner |
| **Scalable Capital** | Transaktionen → Export CSV (nur PRIME/PRIME+) |
| **Trade Republic** | Kein nativer Export — [pytr](https://github.com/pytr-org/pytr) `export_transactions` |

## Datenschutz & Datensicherheit

Vestoro hat keinen Server. Alle Daten liegen ausschließlich in der IndexedDB
deines Browsers. Nichts wird übertragen, getrackt oder ausgewertet.

**Wie sicher sind die Daten wirklich?** Vestoro fordert beim Start automatisch
„persistenten Speicher" an (`navigator.storage.persist()`). Das ist eine
offizielle Browser-Funktion, die verhindert, dass der Browser deine Daten bei
wenig Festplattenplatz automatisch räumt — genau das Szenario, das sonst am
ehesten zu Datenverlust führt. Chrome/Edge gewähren das in der Regel
automatisch, sobald man die Seite installiert/wiederholt nutzt; Firefox fragt
aktiv nach; Safari entscheidet selbst und ist historisch die strengste Instanz
(kann Daten nach 7 Tagen Inaktivität räumen, unabhängig von `persist()`).

Es gibt technisch **keine Möglichkeit, eine rein lokale Browser-App zu 100 %
narrensicher** zu machen, ohne einen Server einzuführen — das würde aber allen
Zielen (0 €, kein Login, maximale Einfachheit) widersprechen. Der beste
verfügbare Kompromiss:
1. Browser-Daten nie über „Alle Website-Daten löschen" pauschal räumen, ohne
   vorher ein Backup zu ziehen
2. Die installierte PWA-Version (siehe oben) nutzen statt eines Bookmarks —
   installierte Apps werden von Browsern deutlich seltener automatisch geräumt
3. Regelmäßig **Einstellungen → Backup exportieren** — die JSON-Datei ist die
   einzige Kopie, die auch eine komplette Neuinstallation von Browser oder
   Betriebssystem übersteht

Ein automatischer Datei-Sync (z. B. direkt in einen iCloud-/Dropbox-Ordner)
ist als Feature auf der Roadmap (siehe docs/PLAN.md, V3) — bis dahin ist der
manuelle JSON-Export der zuverlässigste Weg.

## Entwicklung

```bash
npm run dev     # Dev-Server (http://localhost:5173)
npm run test    # Unit-Tests (Vitest)
npm run check   # Typprüfung + Tests
npm run build   # Produktions-Build (dist/)
```

Konventionen für KI-Agenten: [CLAUDE.md](CLAUDE.md) · Roadmap:
[docs/PLAN.md](docs/PLAN.md) · Entscheidungslog: [docs/DECISIONS.md](docs/DECISIONS.md)

## Lizenz

MIT
