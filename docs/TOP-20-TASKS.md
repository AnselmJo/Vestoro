

## 6. Multiple Dashboard Views (Tabs/Variants)

**Goal:** Replace the monolithic dashboard with a choice of several
focused views (similar to getquin: Overview / Cash Flow / Categories / Account Comparison). **Files:** Split `src/views/Dashboard.tsx` into:
- `src/views/dashboard/OverviewTab.tsx` (current content: KPIs + Sankey)
- `src/views/dashboard/CashflowTab.tsx` (large 12-month history view, trend analysis)
- `src/views/dashboard/CategoriesTab.tsx` (large category list, with
drill-down from Task #2, year-over-year/month-over-month comparison per category)
- `src/views/dashboard/AccountsCompareTab.tsx` (side-by-side accounts:
balance history per account as overlaid line charts)

**Implementation:** Within `Dashboard.tsx`, use a `Seg` control (already available
in `components/ui.tsx`) with the four tabs and an `activeTab` state; pass `scope`
as a prop to each tab component. Shared data loading (`useLiveQuery`
for `transactions`/`categories`/`accounts`) remains in `Dashboard.tsx` and is
passed down via props to avoid each tab component opening its own live queries.

**Tests:** No new pure logic tests required, provided no new
calculation logic is introduced (only layout restructuring + reuse of existing
`lib/analytics.ts` functions).

---
## 7. Interactive Pie Charts with Drill-down (getquin style)

**Goal:** Donut charts featuring hover tooltips, click-to-drill-down functionality (opening a sub-level),
and a grouping selector in the title (Income/Expenses/Accounts/People/Assets).

**New file:** `src/components/DonutChart.tsx` (ECharts `pie` series with
`radius: ['55%','80%']` for the donut look; center displays label + total + percentage
matching the reference screenshot).

**Requirements:**
- Add ECharts `pie` to the `echarts.use([...])` registration in `components/ui.tsx`
(import `PieChart` from `echarts/charts`)
- Props: `data: { name: string; value: number }[]`, `centerLabel: string`,
`groupOptions: { id: string; label: string }[]`, `activeGroup`,
`onGroupChange`, `onSliceClick?: (name: string) => void`
- Title bar above the donut: Segmented control for groups (Income /
Expenses / Accounts / People — "Assets" only usable once a portfolio
exists; otherwise grayed out with a "coming soon" tooltip)
- Clicking a segment → Modal with a detailed list (similar to Task #2, but
generic for any grouping: clicking an account donut segment shows
transactions for that account within the selected period)
- Center of the donut: `centerLabel` (e.g., selected category), large
amount, and percentage — exactly as shown in the reference screenshot

**Usage:** Replaces/complements the current bar list in
`CategoriesTab.tsx` (Task #6) as an alternative view (toggle between list and donut). **Tests:** No mandatory tests (purely for visualization), but the data preparation logic
(`data: {name,value}[]` derived from `categoryBars`/`transferFlows`/account balances)
should be extracted into a pure function in `lib/analytics.ts` and tested there.

---

## 8. Bulk categorization starting from a single transaction (context menu)

**Goal:** Enable a direct action from a single transaction—"categorize all
transactions from this sender permanently into category X"—without
relying solely on the separate bulk dialog.

**Files:** `src/views/Transactions.tsx`.

**Implementation:**
- Clicking a transaction row opens a small context menu or popover (instead
of just an inline category dropdown) with options:
"Categorize only this one" (existing behavior) / "Categorize all from
**[Recipient]** (N matches)" / "Create rule without retroactive application"
- "Categorize all from [Recipient]" calls `bulkCategorize` (already present
in `repo.ts`) using all transaction IDs sharing the same `counterparty`
(case-insensitive, trimmed), ignoring the current time-range filter
(applying across all time)—include explicit explanatory text in the popover
- After action: Toast notification "N transactions updated, rule created"

**Tests:** `tests/logic.test.ts` — Extension: Test the function
`repo.ts::bulkCategorizeByCounterparty(counterparty, categoryId)` in isolation
using `fake-indexeddb` (adopt the pattern from `tests/demo-regression.test.ts`).

---

## 9. Smart rule suggestions based on transaction reference/memo

**Goal:** Improve auto-categorization via pattern recognition within the
transaction reference/memo field (going beyond just the recipient's name),
including a suggestion mechanism.

**New file:** `src/lib/smartRules.ts`. **Must include:**
1. Extended pattern library (using regex instead of just `contains`) for
transaction purpose keywords: `miete`, `nebenkosten`, `gehalt`, `lohn`,
`kindergeld`, `rente`, `dividende`, `zins(en)?`, `erstattung`,
`rückzahlung`, `kfz.?versicherung`, `rundfunk`, `gez`, `spende` →
category suggestions. Extend `Rule.op` to include `'regex'` (with
security checks: limit pattern length, wrap `new RegExp` in try/catch,
ReDoS protection via simple patterns without nested quantifiers).
2. **Suggestion engine**: `suggestCategoryFromPurpose(purpose: string):
string | null` — matches against the pattern library, returns the category name
(not the ID, as the category might not exist yet).
3. Integration into the import flow (`db/repo.ts::importRows`): if no
existing rule matches, try `suggestCategoryFromPurpose` as a fallback before
defaulting to "Uncategorized" — the category must exist via a name lookup in the
database (if the category is missing: no fallback; cleanly default to
"Uncategorized" rather than automatically creating new categories).

**Tests:** `tests/smartRules.test.ts` — test each pattern with at least 2
example purposes (realistic, German), including negative tests
(ensure no false positives with similar but incorrect terms).
---

## 10. Contract Detection: Recurring Payments → Fixed Costs Overview

**Goal:** Building on categorization: automatic detection of recurring
debits (subscriptions, insurance, rent) with a monthly fixed-cost total.
Replaces the "Contracts" placeholder in the sidebar.

**New file:** `src/lib/contracts.ts`. **Detection Logic** (`detectContracts(transactions): Contract[]`):
- Group by `counterparty` (normalized) + similar amount (±5%
tolerance for price increases)
- Count as a contract: at least 3 occurrences with an interval of
25–35 days (monthly) OR 85–100 days (quarterly) OR
350–380 days (annually) — interval detection based on the median
of the gaps between consecutive transactions
- Result type: `{ counterparty, intervalDays, amountCents, lastDate,
nextExpectedDate, categoryId, transactionIds: string[] }`

**New View:** `src/views/Contracts.tsx` (replaces `ComingSoon` for
`contracts` in `App.tsx`):
- List of detected contracts, grouped by category, showing monthly
normalized costs (annual contracts ÷12 for comparability)
- "Total monthly fixed costs" summary row
- Per contract: next expected debit (forecast), amount history
(if price changes were detected)
- Manual confirmation/dismissal of a detected contract (exclude
false positives, e.g., recurring gas station visits are not contracts)
— persist confirmed/dismissed IDs in a new Dexie table `contractDecisions:
'counterparty+intervalDays' → 'confirmed'|'dismissed'`

**Tests:** `tests/contracts.test.ts` — synthetic monthly series (12
transactions, exactly 30-day intervals) is detected; one-off/irregular
transactions are not detected; tolerance limits (26 vs. 40-day intervals)
handled correctly. ---

## 11. Categorization Completeness Concept (Onboarding-Style Nudging)

**Goal:** A user-friendly, non-intrusive concept that actively guides users
to complete categorization—ensuring that classification remains accurate
immediately after a "delete data + re-import" cycle.

**Files:** `src/components/UncategorizedBanner.tsx` (extend),
new file `src/views/CategorizationCenter.tsx`.

**Concept (based on 2026 Fintech UX practices: proactive, explanatory, never
blaming):**
1. Banner (already exists from the "Immediate Fix") gets a progress bar
instead of just a number: "82% categorized (€X of €Y)"
2. Clicking the banner opens the **Categorization Center** (full-screen view, not
a modal) with three tabs:
- **"Quick Assign"**: the existing bulk assignment dialog (task already
completed), moved here
- **"Improve Rules"**: link to Task #1 (Rule Manager)
- **"Progress"**: chart showing the percentage of categorized items
per imported month over time (motivational, no pressure)
3. Explicitly **no blocking** of other functions—users can continue working
at any time, even with 0% categorization (see Task #3; everything
remains visible)
4. After every CSV import: expanded toast notification—"180 imported, 165
automatically categorized (92%), 15 awaiting assignment"—instead of the
current simple count notification; formula uses `auditCoverage` from Task #3

**Tests:** no new calculation logic beyond Task #3/#9.

---

## 12. Extend Setup Wizard: Multiple People from the Start

**Goal:** Extend the existing setup wizard (name entry) to allow adding
additional household members (e.g., partner, child's portfolio) right
from the initial launch.

**File:** Extend `src/app/SetupWizard.tsx`.

**Requirements:**
- After name entry: optional step "Additional people? (optional)"
with an "+ Add person" button that generates an additional text field
(list of strings in local state; no hard limit, but UI recommendation:
"2–4 usually suffice")
- "Skip" proceeds directly to the next step (no mandatory action)
- Upon completion: create `Person` entries for all entered names
(first entry = main account; others created without additional pre-configuration)

**Tests:** No new logic required beyond `createPerson` (already exists).

---

## 13. Accessibility & Keyboard Navigation (WCAG 2.2 AA)

**Goal:** Explicitly implement 2026 best practices: screen reader
support, keyboard operability, contrast checks, and larger tap targets.

**Files:** Project-wide; systematic review. **Must include:**
1. All interactive elements (`button`, `select`, custom `MultiSelect`)
must be keyboard-navigable (Tab) and have a visible focus ring (add `:focus-visible`
in `global.css`; use consistent `outline: 2px solid var(--accent)`)
2. `MultiSelect.tsx`: Popover closable via `Escape` key; arrow keys for
navigating options; `role="listbox"`/`role="option"` attributes
3. Contrast check of all text/background combinations in `tokens.css`
against WCAG AA standards (4.5:1 for body text, 3:1 for large text) —
check `--text-dim` against dark `--bg` and lighten slightly if necessary
Sankey/donut charts: `aria-label` with a text summary of core data
for screen readers (ECharts canvas is invisible to screen readers) —
e.g., a hidden `<table>` containing the same data alongside the chart.
5. Minimum tap target of 44×44px for all buttons in tables (currently
smaller in some cases, e.g., the category dropdown in `Transactions.tsx`).

**Tests:** No automated a11y test runner in scope (no new
dependencies without consultation) — but document a manual checklist in
`docs/A11Y-CHECKLIST.md` and mark items as completed.

---

## 14. Secure initial startup experience: Demo as a guided click-through tour

**Goal:** The existing setup wizard offers a "View demo" option —
this should now be a guided tour, not just a silent mountain of data.

**Files:** `src/app/SetupWizard.tsx`, new file
`src/components/GuidedTour.tsx`.

**Must include:**
- After selecting "View demo": 4–5 tooltip overlays pointing sequentially
to core elements (Sankey, environment pill, bulk categorization button,
calculator nav item) with brief explanatory text and "Next"/"End tour" buttons.
- Simple implementation: `position: absolute` overlay with an arrow,
`tourStep` state, no external library dependencies.
- Tour is skippable at any time; shown automatically only once
(using a `tourShown` flag in the `settings` table).
- At the end of the tour: clear CTA "Switch to my own data now".

**Tests:** None required (pure UI choreography). ---

## 15. Expand Calculator Suite: Withdrawal Plan Calculator

**Goal:** A third calculator alongside the savings plan/FIRE calculators — determining how much can be withdrawn monthly without depleting assets too quickly (or based on a defined capital depletion schedule).

**File:** Extend `src/lib/calculators.ts` and add a third card to `src/views/Calculators.tsx`.

**Exact Parameters (no interpretation required):**

```ts
export interface WithdrawalInput {
startCapitalCents: number; // Initial capital
annualRatePct: number; // Expected annual return % (pre-tax)
years: number; // Withdrawal period in years
annualInflationPct: number; // For adjusting withdrawal amount for purchasing power
capitalGainsTaxEnabled: boolean; // Include capital gains tax? (DE: 26.375% incl. solidarity surcharge; no church tax toggle in V1)
capitalGainsTaxRatePct: number; // Default 26.375, editable
mode: 'fixed_withdrawal' | 'capital_depletion'; 
// fixed_withdrawal: Constant monthly amount (inflation-adjusted); goal = how long the capital lasts
fixedMonthlyWithdrawalCents?: number; 
// capital_depletion: Target "Capital reaches 0 after X years"; goal = what monthly amount is possible
targetDepletionYears?: number;
}

export interface WithdrawalResult {
monthlyWithdrawalCents: number; // Calculated for capital_depletion mode; otherwise = input value
monthsUntilDepleted: number | null; // null = lasts beyond the analysis period (sustainable)
yearly: Array<{ year: number; remainingCapitalCents: number; withdrawnCents: number; taxPaidCents: number }>; 
sustainable: boolean; // true if monthsUntilDepleted === null
}

export function withdrawalPlan(input: WithdrawalInput): WithdrawalResult;
```

**Calculation logic:**
- Monthly return `r = annualRatePct/100/12` applied to remaining capital
- If `capitalGainsTaxEnabled`: Tax applies only to the earnings portion of the withdrawal
(not to the withdrawn original capital) — simplified FIFO based on
total capital (no claim to exact modeling of the German *Vorabpauschale*/advance lump-sum tax;
that is an explicit V2+ step; here, only a rough approximation is used,
accompanied by a "simplified calculation" note in the UI)
- `fixed_withdrawal`: iterate month by month, withdraw inflation-adjusted
amount, stop when capital ≤ 0, report `monthsUntilDepleted`
- `capital_depletion`: binary search on `fixedMonthlyWithdrawalCents` such that
capital reaches ~0 after exactly `targetDepletionYears` (1% tolerance)

**UI fields (`Calculators.tsx`):** Initial capital (€), return % p.a.,
inflation % p.a., "Account for capital gains tax" checkbox (if
enabled: tax rate field becomes editable, default 26.375), radio buttons for
"Fixed monthly amount" vs. "Capital depleted after X years"
(appropriate input field shown based on selection), chart: capital progression over time
with depletion point marked, if applicable.

**Tests:** Extend `tests/calculators.test.ts` — verify 0% return case exactly
against manual calculation; ensure `capital_depletion` yields an amount that,
when re-simulated using `fixed_withdrawal`, converges to the same `targetDepletionYears`
(consistency test between both modes).
---
## 16. Expanding the Calculator Suite: Real Estate Purchase Calculator

**Goal:** Fourth calculator — rough estimate of buying vs. renting, plus an amortization schedule.

**File:** Extend `src/lib/calculators.ts`.

**Exact Parameters:**

```ts
export interface MortgageInput {
purchasePriceCents: number; 
equityCents: number; // Equity
additionalCostsPct: number; // Ancillary purchase costs % (property transfer tax + notary + agent), default 10
interestRatePct: number; // Nominal interest rate % p.a.
repaymentRatePct: number; // Initial repayment rate % p.a. (classic German annuity loan)
years: number; // Analysis period
monthlyRentEquivalentCents: number; // Comparative rent for buy-vs-rent difference
annualAppreciationPct: number; // Expected property value appreciation % p.a.
}

export interface MortgageResult {
loanAmountCents: number; // Loan amount = price + ancillary costs − equity
monthlyRateCents: number; // Constant annuity payment
yearly: Array<{
year: number; remainingDebtCents: number; interestPaidCents: number; 
principalPaidCents: number; propertyValueCents: number; 
}>; 
payoffYear: number | null; // Year of full debt repayment within `years`, otherwise null
totalInterestPaidCents: number; 
buyVsRentDiffCents: number; // Cumulative purchase costs (interest + repayment + ancillary costs) − cumulative comparative rent over `years`
}

export function mortgagePlan(input: MortgageInput): MortgageResult;
```

**Calculation logic:** standard annuity formula
`rate = loanAmount * (interestRatePct + repaymentRatePct) / 100 / 12`,
installment remains nominally constant; the interest/repayment split shifts annually,
recalculated based on the outstanding balance.

**UI:** similar to calculators 1 & 2; result chart: outstanding balance vs. property value
over time (two lines); KPI row: monthly installment, total interest costs,
year debt is cleared, buy-vs-rent difference (green if buying is cheaper).

**Tests:** `tests/calculators.test.ts` — sum of `interestPaidCents +
principalPaidCents` across all years must equal `loanAmountCents +
totalInterestPaidCents`; verify against independently calculated reference values
using a standard example (€300,000 loan, 3.5% interest, 2% repayment).

---

## 17. Backup convenience: File system access for automatic local export

**Goal:** Provide a better answer to "how do I protect my data" than just
manual downloads — progressive enhancement for Chrome/Edge.

**File:** `src/lib/fileSystemBackup.ts`, extend `src/views/Settings.tsx`.

``` **Must include:**
1. Feature detection: `'showDirectoryPicker' in window` (File System Access
API, Chromium browsers only — hide the function for Safari/Firefox, do
not display an error)
2. "Select backup folder" button → `showDirectoryPicker()`, store handle in
IndexedDB (Dexie CANNOT store `FileSystemDirectoryHandle` objects
directly — re-validate the handle via a custom structure using
`navigator.permissions.query` upon next startup; pattern:
MDN "File System Access API persistence")
3. After every successful CSV import: automatically write a
`vestoro-backup-latest.json` file to the selected folder
(overwrite existing file, avoid file proliferation) — in addition to the
existing manual download, not as a replacement
4. Settings display status: "Automatic backup active → [folder path]"
or "Not set up (optional)"

**Tests:** Feature detection path testable (mock `window.showDirectoryPicker`),
actual file access not feasibly testable via automation —
document manual browser test.

---

## 18. Accounts View: Balance history instead of just current balance

**Goal:** View how the balance for each account has evolved over time (not
just the current standing) — basis for task #6 (Account Comparison tab).

**File:** Extend `src/lib/analytics.ts` (`accountBalanceHistory`),
extend `src/views/Accounts.tsx` (sparkline per account card).

**Function:**
```ts
export function accountBalanceHistory(
txs: Transaction[], accountId: string, months: string[],
manualBalance?: { cents: number; date: string },
): Array<{ month: string; balanceCents: number }>
```
Calculation: cumulative sum of all transactions for this account up to the end
of each month; If a manual account balance exists (task already implemented; see
`Account.balanceCents`/`balanceDate`) and falls *after* the date of the
latest transaction, it is used as an anchor for backward calculation
(the difference between the calculated and recorded balance is applied
as a constant offset to the entire history—a pragmatic workaround
for missing opening balances).

**UI:** Small sparkline (ECharts `line`, `xAxis`/`yAxis` hidden,
height ~40px) below the balance on each account card; timeframe: last 12 months.

**Tests:** `tests/logic.test.ts` — history correctly cumulative without
manual anchor; correctly shifted with anchor.

---

## 19. Reports module (replace placeholder): Monthly/yearly report as PDF

**Goal:** First functional version of "Reports" — automatically
generated monthly/yearly review, exportable.

**Prerequisite:** Observe `/mnt/skills/public/pdf/SKILL.md` (PDF creation);
to be taken into account during implementation by the agent.

**New file:** `src/views/Reports.tsx` (replaces `ComingSoon` for `reports`).

**Must include:**
- Selection: Time period (month or year), person/account filter (from scope)
- Content: KPI summary, top 5 categories, comparison to previous period,
savings rate trend over the last 6 periods, detected contracts (from
Task #10) with total fixed costs
- "Export as PDF" button — implementation according to PDF skill guidelines
- Reports NOT generated server-side ("no-server" principle remains
in effect) — client-side PDF generation

**Tests:** Extract data content (KPI aggregation for the report) as a pure function
`lib/analytics.ts::reportSummary(txs, period)` and test it; PDF
rendering itself is not unit-testable.

---

## 20. Performance hardening for growing data volumes

**Goal:** Preparation for multi-year usage with many thousands of
transactions — already noted in `docs/DECISIONS.md` as "revisit at ~20k
transactions"; implement now before it becomes a problem.

**Files:** `src/views/Transactions.tsx`, `src/lib/analytics.ts`,
`vite.config.ts`. **Must include:**
1. **Virtualized table**: Replace the current "Load 100+ more" pagination with
true windowed rendering — introduce the `@tanstack/react-virtual` library
(lightweight, no major additional dependencies); implement only
if the transaction count in the filtered set exceeds 500 (progressive
enhancement, avoiding overkill for small datasets).
2. **Memoized aggregations**: Add a simple memoization layer to
`sankeyData`/`categoryBars`/`monthlyBars` (key = hash of
time period + filters + transaction count), as these currently iterate
over all transactions on every render.
3. **Code splitting**: Resolve the 790 KB chunk warning already visible in the build —
lazy-load ECharts via `import()` (only when a chart view is
actually accessed) and configure `vite.config.ts` (`build.rollupOptions.
output.manualChunks`) to handle `echarts`/`dexie` separately.

**Tests:** Performance cannot be tested in Vitest — instead,
create `docs/PERFORMANCE-BUDGET.md` with target values ​​(e.g., "Dashboard render
< 200ms with 10,000 transactions") and a manual test script
(`scripts/generate-load-test-data.ts`, generating 10k synthetic records
for local performance checks; not part of CI).

---

## Recommended Order

1–3 first (categorization foundation — everything else builds on this),
then 4–8 (internal transfers + interactivity), then 9–11 (smart
categorization + nudging), then 12–14 (onboarding polish), then 15–16
(calculators), then 17–20 (hardening & new modules) in parallel based on capacity.