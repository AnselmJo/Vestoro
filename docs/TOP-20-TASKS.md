

## P0 — Categorization foundation (everything else builds on this)

### CAT-01: Seed full template category taxonomy + migrate existing data
*(was: BUDGET-CAT-02)*
**Files:** `src/db/repo.ts`, seed/migration script, `docs/` migration note.

Seed the full default taxonomy as `isTemplate: true` categories/subcategories (list below), unable to hard-delete, only deactivatable. Critical constraint: **migrate existing category assignments and rules first** — with 938 transactions already categorized in the current account, seeding must not silently orphan or rename away existing work. Write the migration as an explicit, reviewable step (dry-run diff before applying), not a blind re-seed.

```
Wohnen: Wohnnebenkosten, Heimwerken und Garten, Strom, Gas, Möbel und Haushaltsgeräte, Haushaltsdienstleistungen, Immobilienkredit, Miete / Wohngeld
Kinder: Kinderbetreuung und -gruppen, Taschengeld / Unterhalt, Spielwaren
Lebenshaltung: Drogerie, Lebensmittel und Getränke, Haushaltsbedarf, Festnetz und Internet, Handy, Haustier (-bedarf)
Gesundheit und Wellness: Arztbesuch / Krankenhaus, Arznei- und Heilmittel, Wellness und Beauty
Einnahmen: Staatliche Leistung und Förderung, Unterhalt, Kapitaleinkommen, Bareinzahlung, Mieteinnahmen, Rente und Pension, Gehalt
Versicherung: Unfallversicherung, Krankenversicherung, Wohngebäudeversicherung, Hausratversicherung, Rechtsschutzversicherung, Haftpflichtversicherung, Pflegeversicherung, Berufsunfähigkeitsversicherung, Tierversicherung, Kranken-Zusatzversicherung, Risiko-Lebensversicherung, Reiseversicherung
Freizeit, Hobbies und Soziales: Kirche / Spende, Freizeitaktivitäten, Restaurant / Cafe / Bar, Sport und Fitness
Mobilität: KFZ-Versicherung, KFZ-Kredit / Leasingrate / KFZ-Kauf, KFZ-Sonstige, Tanken, Taxi / ÖPNV / Car- und Bikesharing
Sparen und Anlegen: Festgeld / Tagesgeld / Sparkonto, Bausparen, Kapitallebensversicherung, Private Rentenversicherung, Wertpapieranlage, Wertgegenstände und andere Anlagen
Shopping und Unterhaltung: Bücher / Zeitungen / Zeitschriften, Bekleidung / Schuhe / Accessoires, Unterhaltungselektronik und Software, Büromaterial, TV / Video / Musik
Reisen: Hotel und Unterkunft, Pauschalreise, Transport
Bank und Kredit: Kontentransfer, Bankgebühren, Barauszahlung, Kreditkartenabrechnung, Kredittilgung und -zinsen
Unkategorisiert: (fallback bucket, no subcategories)
```

**Acceptance:** All categories seeded and nested correctly; zero existing transactions lose their category; template categories show a lock/"Vorlage" indicator and can only be deactivated, not deleted.

---

### CAT-02: Rule Manager — per-category rule list with bulk actions
*(reconstructed context for referenced "Task #1"; was: BUDGET-CAT-07)*
**Files:** likely `src/views/Categories.tsx` or new `src/components/RuleManager.tsx` — confirm against existing Task #1 if it already exists in the codebase before building this from scratch.

Per category, list all rules pointing to it (condition, created date, active/inactive, matched-transaction count). Row actions: toggle active/inactive (independent of delete), delete. Bulk actions on a multi-select: activate, deactivate, delete, reassign to a different category.

**Acceptance:** Deactivated rules stop firing on new imports but stay visible/reactivatable; bulk actions apply in one confirmation step.

---

### CAT-03: Bulk categorization — from a single transaction *and* from the recipient overview
*(merges new #8 with previous BUDGET-CAT-08 — same underlying action, two entry points)*
**Files:** `src/views/Transactions.tsx`, `db/repo.ts::bulkCategorize` (existing).

Two entry points into the same logic:
1. **From a transaction row** (#8 as specified): clicking a row opens a popover with "Categorize only this one" / "Categorize all from **[Recipient]** (N matches)" / "Create rule without retroactive application". "All from recipient" matches on `counterparty`, case-insensitive/trimmed, across all time (ignore current filter), with a toast "N transactions updated, rule created".
2. **From a recipient-grouped overview** (already partially exists as "Bulk-Kategorisierung"): grouped by counterparty, sorted by uncategorized count, with the same "create rule" checkbox.

Implement as `repo.ts::bulkCategorizeByCounterparty(counterparty, categoryId, { createRule: boolean })` used by both UIs, so there's one code path instead of two.

**Tests:** `tests/logic.test.ts`, isolated with `fake-indexeddb` per `tests/demo-regression.test.ts` pattern.

**Acceptance:** Both entry points produce identical results for the same recipient; rule creation is optional and explicit in both.

---

### CAT-04: Smart rule suggestions from transaction memo (regex-based)
*(was: new #9, absorbs the "suggestion mechanism" ideas from previous BUDGET-CAT-09)*
**New file:** `src/lib/smartRules.ts`.

1. Regex pattern library for memo/purpose keywords → category suggestions: `miete`, `nebenkosten`, `gehalt`, `lohn`, `kindergeld`, `rente`, `dividende`, `zins(en)?`, `erstattung`, `rückzahlung`, `kfz.?versicherung`, `rundfunk`, `gez`, `spende`. Extend `Rule.op` with `'regex'`, guarded (max pattern length, `try/catch` around `new RegExp`, no nested quantifiers — basic ReDoS protection).
2. `suggestCategoryFromPurpose(purpose: string): string | null` — returns a **category name** (not ID, since the category may not exist for this user), matched against the pattern library.
3. Import-flow integration (`db/repo.ts::importRows`): if no existing rule matches, try `suggestCategoryFromPurpose` before falling back to "Unkategorisiert". If the suggested category name doesn't exist in this user's DB, do **not** auto-create it — fall back cleanly instead.
4. **UI extension** (folds in the earlier idea): where a transaction is uncategorized and a suggestion exists but confidence is only partial (e.g. rule almost-matches), show an inline "vorgeschlagen: X" chip in the transaction row, acceptable with one click — don't auto-apply low-confidence matches silently.

**Tests:** `tests/smartRules.test.ts` — ≥2 realistic German example purposes per pattern, plus negative tests for near-miss false positives.

---

### CAT-05: Category Wizard — overview, custom categories, icons, colors
*(merges previous BUDGET-CAT-01, -03, -04, -05, -06, and GENERAL-01/03)*
**Files:** new `src/views/CategoryWizard.tsx`, `src/components/IconPicker.tsx`, `src/components/ColorPicker.tsx`.

- Overview screen: all categories/subcategories, tree or grouped list, filter `Alle Kategorien` / `Eigene Kategorien`. Replaces the standalone "Kategorien & Regeln" sidebar item — reachable from within Transaktionen instead (fold sidebar entry into this view once shipped).
- "Neue Kategorie" (top-level): name + `IconPicker` + `ColorPicker`.
- "Neue Unterkategorie": name + parent picker (any top-level, template or custom).
- `IconPicker`: standardize on one icon set (Lucide, matching what's already visible in the app) and reuse it everywhere — sidebar, delete actions, category icons — instead of mixed icon sources. Searchable subset (~40–60 relevant icons).
- `ColorPicker`: 16 presets in a 4×4 grid + full color wheel/RGB/HEX, built generic (no category-specific logic) so Portfolio/Accounts can reuse it later.

**Acceptance:** Both picker components are standalone and reusable; new categories/subcategories appear immediately in pickers and respect the template/custom filter.

---

## P1 — Everyday usability & quick wins

### NAV-01: Regroup sidebar into Budget / Portfolio / Planen
Group Dashboard, Transfer Flows, Transaktionen (incl. CAT-05's wizard), Konten under **Budget**; Portfolio, Verträge (→ SYS-01), Berichte (→ REPORT-01) under **Portfolio**; Rechner, Budgets, Ziele under **Planen**. `Einstellungen` stays separate. Purely structural — no route/logic changes beyond labels and grouping.

### TX-01: Filter transactions by direction (income / expense)
Add `Alle / Eingehend / Ausgehend` filter to Transaktionen, combinable with existing filters. Confirm how internal transfers are excluded/labeled so they aren't double-counted, consistent with Transfer Flows logic.

### DASH-01: Redesign period selector (Month / Quarter / Year)
Top-right segmented control `Monat | Quartal | Jahr` + dynamic "Aktueller Monat/Quartal/Jahr" label (shown only when the selected period is the current one). Left side: selected period text + ◀ ▶ arrows, stepping by the active granularity. All dashboard widgets react to both period and granularity.

### DASH-02: €/% toggle on the Sankey diagram
Small `€ | %` toggle in the Sankey card's top-right corner, matching the existing category-share toggle. Persist last-used mode.

### INFRA-02: Performance hardening (bring forward from P4)
*(was: new #20 — moved up because the 790 KB chunk warning and 938-transaction dataset are already present today, not a future problem)*
- Virtualize the transaction table (`@tanstack/react-virtual`) once the filtered set exceeds 500 rows.
- Memoize `sankeyData`/`categoryBars`/`monthlyBars` (key: hash of period + filters + transaction count) — currently recomputed on every render.
- Code-split ECharts via dynamic `import()`, separate `manualChunks` for `echarts`/`dexie` in `vite.config.ts`.
- Deliverable: `docs/PERFORMANCE-BUDGET.md` with target numbers (e.g. "dashboard render < 200 ms at 10k transactions") + `scripts/generate-load-test-data.ts` for manual checks (not CI).

---

## P2 — Categorization intelligence, settings, onboarding

### SYS-01: Contract detection → replaces "Verträge" placeholder
*(new #10; depends on CAT-04's pattern library for category context)*
**New file:** `src/lib/contracts.ts`, view `src/views/Contracts.tsx`.

Group by normalized counterparty + amount (±5% tolerance), classify as a contract at ≥3 occurrences with 25–35 day (monthly), 85–100 day (quarterly), or 350–380 day (annual) intervals, based on median gap. Result includes `nextExpectedDate`. View: grouped-by-category list, monthly-normalized costs (annual ÷ 12), total fixed-cost row, manual confirm/dismiss per detected contract persisted in a new `contractDecisions` table.

**Tests:** synthetic 12×30-day series detected; irregular series not detected; interval-boundary tolerance verified.

### SYS-02: Categorization completeness nudging
*(new #11; depends on CAT-01–CAT-04)*
Extend the existing uncategorized banner with a progress bar ("82% kategorisiert (€X von €Y)"). Clicking opens a full-screen **Categorization Center** with tabs: Quick Assign (existing bulk dialog, moved here), Improve Rules (→ CAT-02), Progress (categorized % per imported month over time). Never blocking — all other functions stay usable at 0% categorization. Post-import toast expands to "180 importiert, 165 automatisch kategorisiert (92%), 15 offen".

### SETTINGS-01: Editable persons and account ownership
List persons with linked accounts; rename/delete person (confirm, decide fate of their accounts — reassign or unassign, never delete transaction history), rename/delete account, reassign an account's owning person.

### ONBOARD-01: Setup wizard — multiple people from the start
Extend `SetupWizard.tsx`: optional "weitere Personen?" step with "+ Person hinzufügen", skippable, no hard limit (UI hint: "2–4 reichen meist"). Creates `Person` entries for all names on completion.

### ONBOARD-02: Guided demo tour
`GuidedTour.tsx`: 4–5 sequential tooltip overlays over core elements (Sankey, bulk categorization, calculator nav, etc.) when "Demo ansehen" is chosen. Skippable, shown once (`tourShown` flag), ends with CTA "Jetzt zu meinen eigenen Daten wechseln".

### A11Y-01: Accessibility & keyboard navigation (WCAG 2.2 AA)
*(supersedes/expands the earlier "dark theme contrast" ticket)*
Keyboard operability + visible focus rings on all interactive elements; `MultiSelect` closable via Escape, arrow-key navigation, `role="listbox"/"option"`; contrast-check all `tokens.css` combinations against WCAG AA (4.5:1 text / 3:1 large), lighten `--text-dim` if needed — this covers the red/orange warning-icon contrast issue from the screenshots; `aria-label` + hidden data table alongside Sankey/donut charts for screen readers; 44×44px minimum tap targets in table rows (e.g. the category dropdown in Transaktionen). Deliverable: `docs/A11Y-CHECKLIST.md`, manually tracked.

---

## P3 — Calculator suite

### CALC-01: Withdrawal plan calculator (Entnahmeplan)
*(new #15 — fully specified, build first among calculators)*

```ts
export interface WithdrawalInput {
  startCapitalCents: number;
  annualRatePct: number;
  years: number;
  annualInflationPct: number;
  capitalGainsTaxEnabled: boolean;
  capitalGainsTaxRatePct: number; // default 26.375
  mode: 'fixed_withdrawal' | 'capital_depletion';
  fixedMonthlyWithdrawalCents?: number;
  targetDepletionYears?: number;
}
export interface WithdrawalResult {
  monthlyWithdrawalCents: number;
  monthsUntilDepleted: number | null;
  yearly: Array<{ year: number; remainingCapitalCents: number; withdrawnCents: number; taxPaidCents: number }>;
  sustainable: boolean;
}
export function withdrawalPlan(input: WithdrawalInput): WithdrawalResult;
```

Tax applies only to the earnings portion of each withdrawal (simplified, no *Vorabpauschale* modeling — explicitly flagged as "vereinfachte Berechnung" in the UI, exact modeling is V2+). `fixed_withdrawal`: simulate month-by-month until depletion. `capital_depletion`: binary search the monthly amount for ~0 capital at `targetDepletionYears` (1% tolerance).

**Tests:** 0%-return case against manual calculation; cross-check that `capital_depletion`'s output, re-run through `fixed_withdrawal`, converges to the same `targetDepletionYears`.

### CALC-02: Savings-plan (Zinseszins + inflation) and FIRE calculators, with persistence & pre-fill
*(previously PLANEN-01, minus the withdrawal-plan part now covered by CALC-01)*
Two calculator tabs alongside CALC-01. Both pre-fillable from real data (e.g. average monthly savings rate) on first use or via explicit "mit echten Daten befüllen" action — never silently overwriting user edits. Inputs persisted per calculator tab in IndexedDB and restored on reopen.

### CALC-03: Shared capital-gains-tax (KESt) utility
*(previously PLANEN-02)*
Extract the tax logic already required by CALC-01 into a shared utility, then add the same "Bruttorendite vs. Rendite nach Kapitalertragsteuer" toggle to CALC-02's savings-plan calculator. One tax implementation used by both, not duplicated.

### CALC-04: Real estate purchase / mortgage calculator
*(new #16)*

```ts
export interface MortgageInput {
  purchasePriceCents: number;
  equityCents: number;
  additionalCostsPct: number; // default 10
  interestRatePct: number;
  repaymentRatePct: number;
  years: number;
  monthlyRentEquivalentCents: number;
  annualAppreciationPct: number;
}
export interface MortgageResult {
  loanAmountCents: number;
  monthlyRateCents: number;
  yearly: Array<{ year: number; remainingDebtCents: number; interestPaidCents: number; principalPaidCents: number; propertyValueCents: number }>;
  payoffYear: number | null;
  totalInterestPaidCents: number;
  buyVsRentDiffCents: number;
}
export function mortgagePlan(input: MortgageInput): MortgageResult;
```

Standard German annuity loan: `rate = loanAmount * (interestRatePct + repaymentRatePct) / 100 / 12`, constant nominal installment, interest/principal split recalculated yearly from outstanding balance. Chart: outstanding debt vs. property value over time. This is the dedicated real-estate calculator that Portfolio's asset search (PORT-03) explicitly excludes real estate in favor of.

**Tests:** sum of `interestPaidCents + principalPaidCents` across all years equals `loanAmountCents + totalInterestPaidCents`; reference check against a standard example (€300k loan, 3.5% interest, 2% repayment).

---

## P3 — Portfolio (still "coming soon")

### PORT-01: Dashboard chart with time-range selector
`1W / 1M / YTD / 1J (default) / 3J / 5J / Alle` + calendar icon for custom range; graceful fallback for accounts with shorter history.

### PORT-02: Index benchmark overlay
FTSE All-World / MSCI World lines, rebased to the same starting point as the portfolio for relative-performance comparison, independently toggleable.

### PORT-03: Asset search by Name/ISIN/WKN
Stocks, ETFs, funds, bonds, certificates, metals, crypto, currencies, cash, tangible assets — **excluding real estate** (see CALC-04).

### PORT-04: Price data integration
Delayed/interval quotes via BYOK API or free source (Yahoo Finance/Stooq); dynamic gain/loss; graceful offline degradation with "Stand: …" timestamp.

### PORT-06: Account balance history (sparkline)
*(new #18 — actually a Budget/Konten feature, listed here since it's the data foundation for a future Portfolio-style "Account Comparison" tab referenced as "Task #6")*

```ts
export function accountBalanceHistory(
  txs: Transaction[], accountId: string, months: string[],
  manualBalance?: { cents: number; date: string },
): Array<{ month: string; balanceCents: number }>
```

Cumulative sum per month; if a manual balance anchor exists after the latest transaction, apply the calculated-vs-recorded difference as a constant offset across the whole history (pragmatic workaround for missing opening balances). UI: small ECharts sparkline (~40px, axes hidden) under the balance on each Konten card, last 12 months.

**Tests:** cumulative history correct without anchor; correctly offset with anchor.

### PORT-05 (Backlog / later phase): FinTS interface for DKB & ING
Per `docs/PLAN.md`, this is V3/companion-app scope. Keep captured but do not implement until explicitly prioritized — local-only credential handling is a hard constraint whenever it is picked up.

---

## P4 — New modules & infrastructure

### REPORT-01: Reports module (replaces placeholder) — monthly/yearly PDF export
Follow `/mnt/skills/public/pdf/SKILL.md` for the PDF generation. Period + person/account filter; content: KPI summary, top 5 categories, prior-period comparison, 6-period savings-rate trend, detected contracts (SYS-01) with total fixed costs. Client-side PDF only (no-server principle). Extract the data aggregation as a pure, independently testable `analytics.ts::reportSummary(txs, period)`.

### INFRA-01: File System Access backup
Feature-detect `showDirectoryPicker` (Chromium-only, hide silently elsewhere). On selection, store the handle and re-validate via `navigator.permissions.query` on startup. After every successful CSV import, write `vestoro-backup-latest.json` to the chosen folder in addition to (not instead of) the existing manual download. Settings shows status ("Automatisches Backup aktiv → [Pfad]" / "Nicht eingerichtet").

---

## Suggested Build Order

**P0** (CAT-01 → CAT-02 → CAT-03 → CAT-04 → CAT-05) — categorization is the foundation everything else assumes.
**P1** (NAV-01, TX-01, DASH-01, DASH-02, INFRA-02) — fast, low-risk, immediately visible improvements; INFRA-02 pulled forward since the perf issue already exists today.
**P2** (SYS-01, SYS-02, SETTINGS-01, ONBOARD-01/02, A11Y-01) — depends on P0 categorization data; onboarding/accessibility can run in parallel with anything.
**P3** (CALC-01 → CALC-03 → CALC-02 → CALC-04, then PORT-01…PORT-06) — calculators are independent of categorization and can be parallelized by a second agent/session.
**P4** (REPORT-01, INFRA-01) — depends on SYS-01 (contracts) and stable analytics from earlier tiers.
