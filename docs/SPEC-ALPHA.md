# Vestoro — Alpha Build Spec

This document is the single source of truth for building the Alpha. Execute it
top to bottom. Do not redesign, do not add features, do not swap libraries.
If something is ambiguous, pick the simplest option consistent with this spec
and note it in `docs/DECISIONS.md`.

## 1. Product

Vestoro is a local-first personal finance PWA for the German market.
Alpha scope: import bank CSV exports, categorize transactions, visualize cash
flow (Sankey + bar charts), savings rate. All data stays in the browser
(IndexedDB). No backend. No login. UI language: German. Code language: English.

Slogan (shown on empty dashboard): **"Klarheit über dein Geld."**

## 2. Tech stack (fixed)

- Vite + React 18 + TypeScript (strict)
- Tailwind CSS v4
- Dexie (IndexedDB wrapper)
- ECharts (only `sankey` + `bar` via tree-shaken imports from `echarts/core`)
- Zustand (UI state only; persistent data lives in Dexie)
- vite-plugin-pwa (installable on iOS/macOS/Windows)
- Vitest (unit tests for lib/)
- ESLint + Prettier (defaults, no bikeshedding)
- Fonts: `@fontsource-variable/ibm-plex-sans` and `@fontsource/ibm-plex-mono`
  (self-hosted, no CDN). All numeric data uses tabular figures
  (`font-variant-numeric: tabular-nums`).

No other runtime dependencies without a note in `docs/DECISIONS.md`.

## 3. Repository layout

```
vestoro/
  index.html
  vite.config.ts
  CLAUDE.md                     # agent instructions (already provided)
  .github/copilot-instructions.md  # identical content to CLAUDE.md
  docs/
    DECISIONS.md                # append-only architecture decision log
    BACKLOG.md                  # ideas that are out of scope now
  src/
    app/                        # shell: routing, layout, sidebar, command palette
    views/                      # one folder per screen: dashboard/, accounts/, transactions/, settings/
    components/                 # shared dumb components (Button, Card, Modal, EmptyState…)
    lib/                        # pure logic, NO React imports
      money.ts                  # cents math, formatting (de-DE)
      csv/
        parse.ts                # RFC-4180 tolerant CSV parser (handle quoted ; and ,)
        profiles/
          c24.ts
          dkb.ts
          generic.ts            # user-defined column mapper
        detect.ts               # profile auto-detection from header/first lines
      dedupe.ts
      transfers.ts
      rules.ts                  # categorization rules engine
      analytics.ts              # sankey/bars/savings-rate aggregations
      demo.ts                   # demo dataset generator
      backup.ts                 # JSON export/import
    db/
      schema.ts                 # Dexie tables + types
      repo.ts                   # all DB access goes through here
    i18n/
      de.ts                     # ALL user-facing strings live here
    styles/
      tokens.css                # design tokens as CSS variables
  tests/                        # mirrors src/lib
```

Rules: files < 200 lines where feasible. `lib/` and `db/` are framework-free
and fully unit-tested. Views import from `lib/`, never the other way.

## 4. Data model (Dexie schema v1)

Money: integer cents. Dates: ISO `YYYY-MM-DD` strings. IDs: `crypto.randomUUID()`.

```ts
interface Person   { id: string; name: string; }
interface Account  {
  id: string; personId: string; name: string;
  type: 'checking' | 'savings' | 'fixed_deposit' | 'depot' | 'cash';
  iban?: string;               // normalized: uppercase, no spaces
  currency: string;            // 'EUR'
  sharedRatio?: number;        // 0..1, Beta feature, in schema now
}
interface Category {
  id: string; name: string; parentId?: string;
  kind: 'income' | 'expense';
  color?: string;              // falls back to palette
}
interface Transaction {
  id: string; accountId: string;
  bookingDate: string;         // ISO
  amountCents: number;         // signed; negative = outflow
  currency: string;
  counterparty: string;        // payee/payer display name
  counterpartyIban?: string;
  purpose: string;             // Verwendungszweck
  categoryId?: string;
  transferGroupId?: string;    // set when matched as internal transfer
  importHash: string;          // dedupe key
  source: 'csv' | 'demo' | 'manual';
  raw?: Record<string, string>;// original CSV row for debugging
}
interface Rule {
  id: string; priority: number;
  field: 'counterparty' | 'purpose' | 'counterpartyIban';
  op: 'contains' | 'equals' | 'startsWith';
  value: string;               // matched case-insensitive
  categoryId: string;
}
interface ImportProfile {      // saved generic-mapper configs
  id: string; name: string;
  delimiter: ',' | ';';
  decimal: ',' | '.';
  dateFormat: 'DD.MM.YYYY' | 'DD.MM.YY' | 'YYYY-MM-DD';
  skipRows: number;
  columns: { bookingDate: string; amount: string; counterparty: string;
             purpose: string; counterpartyIban?: string };
}
```

`importHash = sha256(accountId | bookingDate | amountCents | counterpartyIban∥counterparty | purpose)`.
On import, rows whose hash already exists are skipped and counted as duplicates.

Seed data on first run: one person ("Ich"), no accounts, default category tree
(German): Einkommen (Gehalt, Kapitalerträge, Sonstiges Einkommen); Ausgaben
(Wohnen, Lebensmittel, Mobilität, Versicherungen, Abos & Verträge, Gesundheit,
Freizeit, Kinder, Geldanlage, Sonstiges).

## 5. CSV import

Flow: Konten-view → "CSV importieren" → file picker → auto-detect profile →
preview table (first 20 rows, mapped) → user confirms account assignment →
import → result toast: "184 importiert, 12 Duplikate übersprungen, 3 Transfers erkannt".

### 5.1 C24 profile (exact)

Comma-separated, quoted fields, header row 1:

```
Transaktionstyp,Buchungsdatum,Karteneinsatz,Betrag,Zahlungsempfänger,IBAN,BIC,Verwendungszweck,Beschreibung,Kontonummer,Kontoname,Kategorie,Unterkategorie,Bargeldabhebung
SEPA-Lastschrift,02.07.2026,,"-2000,00 €",Scalable Capital,DE16120700700752814076,DEUTDEMMXXX,Scalable Capital Broker 2x savings plan,Scalable Capital GmbH,4858835001,C24 Smartkonto,Geldanlage,Kapitalanlage
```

Mapping: `Buchungsdatum` (DD.MM.YYYY) → bookingDate; `Betrag` ("-2000,00 €" →
strip € and spaces, German decimal) → amountCents; `Zahlungsempfänger` →
counterparty; `IBAN` → counterpartyIban; `Verwendungszweck` → purpose.
Detection: header contains `Transaktionstyp` and `Karteneinsatz`.

### 5.2 DKB profile (exact)

Semicolon-separated, all fields quoted, 4 metadata lines before the header:

```
"Girokonto";"DE48120300001082275023"

"Kontostand vom 05.07.2026:";"1.572,41 €"
""
"Buchungsdatum";"Wertstellung";"Status";"Zahlungspflichtige*r";"Zahlungsempfänger*in";"Verwendungszweck";"Umsatztyp";"IBAN";"Betrag (€)";"Gläubiger-ID";"Mandatsreferenz";"Kundenreferenz"
"02.07.26";"02.07.26";"Gebucht";"Anselm Josek";"S. Payment Solutions GmbH";"Lidl sagt Danke DE144783060455181261 Lidl Pay";"Ausgang";"DE74600400710521470501";"-11,02";"DE18ZZZ00002700707";"1120362894/0001/00";"ZB 210171509226"
```

Mapping: `Buchungsdatum` (DD.MM.YY, assume 20YY) → bookingDate; `Betrag (€)`
(German decimal, thousands dot possible) → amountCents; counterparty =
`Zahlungsempfänger*in` if amount < 0 else `Zahlungspflichtige*r`; `IBAN` →
counterpartyIban; `Verwendungszweck` → purpose. Skip rows with Status ≠
"Gebucht". Extract the account IBAN from line 1 and offer to link/verify the
target account. Detection: first line starts with `"Girokonto";` or header
contains `Zahlungspflichtige*r`.

### 5.3 Generic mapper

If detection fails: show mapping UI (pick delimiter, decimal, date format,
skip rows, assign columns via dropdowns over a live preview). Saving creates an
`ImportProfile` that is offered next time (matched by header signature).

## 6. Transfer detection

After each import, run over all transactions: two transactions form a transfer
pair when (a) amounts are exact opposites, (b) booking dates differ ≤ 2 days,
(c) they belong to two *different* own accounts, and (d) either counterpartyIban
matches the other account's IBAN or fuzzy: both lack IBAN but purpose/counterparty
contains the other account's name. Pairs get a shared `transferGroupId` and are
excluded from income/expense analytics (shown in a muted "Umbuchung" style in
the transaction list).

## 7. Rules engine

- Rules sorted by priority; first match wins; applied on import and via
  "Regeln jetzt anwenden" button (only fills empty categoryId unless user
  chooses "überschreiben").
- When the user manually categorizes a transaction, offer inline:
  "Regel erstellen: Empfänger enthält ‚REWE' → Lebensmittel" (one click, editable).

## 8. Analytics (lib/analytics.ts, pure functions)

Input: transactions of a period (default: current month, month picker with
◀ ▶ navigation). Excluded: transfers.

- `sankeyData(period)`: nodes = income categories → "Einkommen" hub →
  expense categories (+ "Sparen/Überschuss" node = income − expenses when
  positive). Values in cents; tooltip shows € and % of income.
- `categoryBars(period)`: per category totals, income vs expense.
- `monthlyBars(last12)`: income vs expense per month, grouped bars.
- `savingsRate(period)`: (income − expense) / income, guard div-by-zero.

## 9. UI / design tokens

Aesthetic: calm German engineering instrument, not a fintech toy. Dark,
matte, precise. The Sankey is the hero; everything else stays quiet.
No emojis in the UI. No gradients. Motion: 150ms ease-out on hover/expand only,
respect `prefers-reduced-motion`.

`styles/tokens.css`:

```css
:root {
  --bg:        #16181d;  /* app background, warm-neutral dark gray */
  --surface:   #1e2128;  /* cards, sidebar */
  --surface-2: #262a33;  /* hover, table stripes */
  --border:    #32363f;
  --text:      #e8eaed;
  --text-dim:  #9aa0ab;
  --accent:    #6ea8b5;  /* "Gletscher" — desaturated glacier blue, interactive elements */
  --income:    #7fb069;  /* muted moss green */
  --expense:   #c96f5d;  /* muted clay red */
  --transfer:  #8a8f99;
  --radius: 10px;
}
```

Typography: IBM Plex Sans Variable for UI (weights 400/500/600), IBM Plex Mono
for all amounts, IBANs and table numerals. Type scale: 13/14/16/20/28px.
Amounts right-aligned, tabular-nums, sign-colored (income/expense tokens).

Layout: left sidebar (collapsible to icons; logo wordmark "Vestoro" top,
collapse button beside it) with items Dashboard, Konten, Transaktionen,
Einstellungen. Top bar: month picker (center), Cmd+K search button (right).
Cmd+K palette searches transactions (counterparty/purpose) and navigation.

Views:
- **Dashboard**: KPI row (Einnahmen, Ausgaben, Überschuss, Sparquote) →
  Sankey card (full width, "Vollbild" button) → two half-width cards:
  Kategorien-Barchart, 12-Monats-Barchart. Empty state: slogan + two buttons
  "CSV importieren" / "Demo-Daten laden".
- **Konten**: card per account (name, bank, balance = sum of transactions,
  last import date), "Konto anlegen" + "CSV importieren".
- **Transaktionen**: virtualized table (date, account, counterparty, purpose
  truncated, category as editable pill, amount), filters: account, category,
  period, free text. Row click → detail drawer with raw CSV data.
- **Einstellungen**: Kategorien verwalten, Regeln verwalten, Import-Profile,
  Backup (Export JSON / Import JSON), Demo-Daten laden/entfernen,
  Danger zone: "Alle Daten löschen" (type-to-confirm).

## 10. PWA & install

- vite-plugin-pwa: standalone display, theme color `#16181d`, maskable icons
  (generate simple "V" monogram SVG → png sizes), offline caching of app shell.
- Data note in Einstellungen: iOS can evict IndexedDB after long inactivity →
  prompt users to export a backup; show a subtle reminder if last backup > 30 days.
- Deploy: GitHub Actions workflow `deploy.yml` → build → GitHub Pages.
  `vite.config.ts` base path configurable via env for Pages project sites.

## 11. Tests & quality gates

- Unit tests (Vitest) required for: money.ts, csv/parse.ts, both bank profiles
  (use the exact sample lines from section 5 as fixtures), dedupe.ts,
  transfers.ts, rules.ts, analytics.ts, backup.ts round-trip.
- One smoke test: app renders, demo data loads, dashboard shows 4 KPIs.
- Scripts: `npm run dev`, `npm run build`, `npm run test`, `npm run lint`,
  `npm run check` (tsc --noEmit + lint + test) — CI runs `check` + `build`.

## 12. README (write it in German, structure below)

1. Wordmark + Slogan + 3 Screenshots/GIF placeholders
2. "Was ist Vestoro?" (3 Sätze) + Feature-Liste Alpha
3. **Nutzung ohne Installation**: Link zur GitHub-Pages-URL, "Als App installieren"
   (Safari: Teilen → Zum Home-Bildschirm; Chrome/Edge: Installieren-Icon)
4. **Lokal entwickeln**: `git clone … && cd vestoro && npm install && npm run dev`
5. Datenschutz-Absatz: alles lokal, kein Server, Backup-Hinweis
6. Unterstützte CSV-Formate (C24, DKB, generisch) + kurze Anleitung je Bank,
   wo der Export zu finden ist
7. Roadmap-Kurzfassung (link auf docs/PLAN.md), Lizenz (MIT), Feedback → Issues

## 13. Build order (execute in this sequence, commit after each step)

1. Scaffold: Vite+React+TS, Tailwind, ESLint/Prettier, Vitest, folder layout, tokens.css, fonts
2. `lib/money.ts` + tests
3. `db/schema.ts` + `db/repo.ts` + seed categories
4. `lib/csv/parse.ts` + tests; profiles c24/dkb + tests with the exact fixtures
5. `lib/dedupe.ts`, `lib/transfers.ts`, `lib/rules.ts` + tests
6. `lib/analytics.ts` + tests; `lib/demo.ts` (24 months, 3 accounts, realistic German merchants, includes transfers)
7. App shell: sidebar, routing, Cmd+K, month picker
8. Views: Transaktionen → Konten (+ import flow with preview & generic mapper) → Dashboard (ECharts) → Einstellungen (+ backup)
9. PWA config, icons, deploy workflow, README, final `npm run check` green

Definition of done for Alpha: a friend on iPhone opens the URL, installs the
PWA, loads demo data, sees the Sankey; you import real C24 + DKB CSVs, transfers
between your accounts are detected, savings rate is plausible, backup export/import
round-trips.
