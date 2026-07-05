# Architecture Decision Log (append-only)

- 2026-07-05 — **PWA/web app instead of Tauri/Electron.** Alpha targets Mac +
  Windows desktops via browser; a later mobile companion reuses the same
  codebase. 0 € hosting via GitHub Pages; data stays local (IndexedDB).
- 2026-07-05 — **FNV-1a double hash instead of SHA-256 for import dedupe.**
  Synchronous, dependency-free; crypto strength is not needed for dedupe.
- 2026-07-05 — **No router library.** Four views switched via React state;
  revisit when deep-linking is needed.
- 2026-07-05 — **No PWA service worker yet.** Plain static site is enough for
  Alpha; vite-plugin-pwa goes in when offline/installed mode is prioritized.
- 2026-07-05 — **Simple pagination instead of virtualization** in the
  transactions table (100 rows + "load more"). Revisit past ~20k transactions.
- 2026-07-05 — **Bulk write instead of sequential updates for demo categorization,
  plus a top-level ErrorBoundary and busy/error states on demo-load, CSV-import,
  and backup-import.** Root cause of an earlier reported blank-screen: failures
  were swallowed silently (unhandled promise rejections) and one code path did
  ~400 sequential single-row IndexedDB writes instead of one bulk write.
- 2026-07-05 — **sankeyData nets each category to a single edge** (income −
  expense) instead of emitting separate income-side and expense-side edges.
  Root cause of a real crash: a category with both an inflow and an outflow in
  the same period produced two opposing edges between the same two nodes — a
  2-cycle, which ECharts Sankey rejects ("Sankey is a DAG, the original data
  has cycle!"). Contributing cause fixed alongside: loadDemoData() now reuses
  existing demo accounts by IBAN instead of creating duplicates on repeated
  clicks, which is what produced the mixed-direction category in the first
  place (duplicate IBANs broke transfer-pair matching). Regression tests added
  in tests/logic.test.ts and tests/demo-regression.test.ts.
- 2026-07-05 — **CI: actions/checkout@v5, actions/setup-node@v6** (both now
  run natively on Node 24, removing the deprecation warning). upload-pages-
  artifact/deploy-pages stay on their current majors (v3/v4) until GitHub
  ships newer ones; the residual warning there is informational only.
