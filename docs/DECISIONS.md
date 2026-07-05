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
  and backup-import.** Root cause of the reported blank-screen: failures were
  swallowed silently (unhandled promise rejections) and one code path did ~400
  sequential single-row IndexedDB writes instead of one bulk write. Both fixed.
