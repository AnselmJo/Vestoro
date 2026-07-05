# Performance Budget — Vestoro

This document defines measurable performance targets for the Vestoro frontend.
All numbers assume a modern desktop browser (Chrome/Firefox latest, M1 or mid-range x86,
no network throttling, IndexedDB populated locally).

---

## Scope

Vestoro is an **offline-first** application. Network performance is out of scope here.
The budget governs:

- **JavaScript parse + execute time** (initial load)
- **Render latency** (time from data ready to first meaningful paint of a view)
- **Data-processing time** (analytics functions)
- **Scroll / interaction frame time**

---

## Bundle Targets

| Chunk       | Limit (raw) | Limit (gzip) | Notes                                          |
|-------------|------------|--------------|------------------------------------------------|
| `index`     | ≤ 150 KB   | ≤ 50 KB      | App code + React. Must never include ECharts.  |
| `echarts`   | ≤ 700 KB   | ≤ 200 KB     | Loaded lazily on first chart render.           |
| `dexie`     | ≤ 150 KB   | ≤ 45 KB      | Loaded at startup; separate for cache stability.|
| Any other   | ≤ 200 KB   | ≤ 60 KB      |                                                |

> The 790 KB chunk warning that triggered this budget was caused by ECharts
> being bundled into the main chunk. The `manualChunks` config in `vite.config.ts`
> resolves this.

**How to check:** `npm run build` — Rollup prints per-chunk sizes. Fail if
`index` exceeds 150 KB raw.

---

## Render Time Targets

| Scenario                                       | Target   | Measured how                           |
|------------------------------------------------|----------|----------------------------------------|
| Dashboard initial render (1 k transactions)    | < 100 ms | Chrome DevTools Performance → scripting|
| Dashboard initial render (10 k transactions)   | < 200 ms | Same                                   |
| Switching dashboard tabs (cached data)         | < 50 ms  | Same                                   |
| Transactions view render (500 rows, paginated) | < 80 ms  | Same                                   |
| Transactions view render (5 k rows, virtual)   | < 100 ms | Same                                   |
| Scroll through virtual table (5 k rows)        | ≥ 60 fps | DevTools Rendering → FPS meter         |

> These targets assume `useMemo` caches are warm. A first render after a
> new `useLiveQuery` result fires may be slightly higher.

---

## Data-Processing Time Targets

These are the analytics functions in `src/lib/analytics.ts`. Measured via
`performance.now()` wrappers in the browser console or DevTools.

| Function       | Input size              | Target  |
|----------------|-------------------------|---------|
| `sankeyData`   | 10 k txs                | < 10 ms |
| `categoryBars` | 10 k txs                | < 10 ms |
| `monthlyBars`  | 10 k txs × 12 months    | < 25 ms |
| `periodStats`  | 10 k txs                | < 5 ms  |

With `useMemo` in place these run at most once per data change, not per render.

---

## Interaction Frame Budget

| Interaction                          | Target (frame time) |
|--------------------------------------|---------------------|
| Category dropdown change             | < 16 ms             |
| Filter / search input keypress       | < 16 ms             |
| Month navigation arrow               | < 32 ms             |
| Virtual table scroll (5 k rows)      | < 16 ms             |

---

## Virtualisation Threshold

The transaction table switches from "load-more pagination" to `@tanstack/react-virtual`
when the filtered set exceeds **500 rows**.

Rationale: below 500 rows, the DOM cost is negligible (< 500 `<tr>` nodes).
Above 500 rows, full DOM rendering causes visible jank on mid-range hardware.

---

## How to Measure

### Bundle sizes

```bash
npm run build
# Vite prints chunk sizes. Look for echarts, dexie, index.
```

### Render time (manual)

1. Load the app in Chrome.
2. Open DevTools → Performance.
3. Click "Record", perform the action, stop recording.
4. Find the "Scripting" and "Rendering" bars in the flame chart.

### Data-processing (manual)

Open DevTools → Console and run:

```js
const start = performance.now();
// ... trigger a dashboard tab switch ...
console.log('elapsed:', performance.now() - start, 'ms');
```

### Load test data

Use `scripts/generate-load-test-data.ts` to generate a JSON import file:

```bash
npx tsx scripts/generate-load-test-data.ts --count 10000
# → dist/load-test-10000.json
# Import via Vestoro → Import button (CSV/JSON import dialog)
```

---

## Warning Thresholds

A PR / commit should be reconsidered if any of the following are observed:

- `index` chunk exceeds **150 KB raw** after build
- `echarts` chunk exceeds **700 KB raw** after build
- Dashboard render at 10 k transactions exceeds **400 ms**
- Virtual table scroll drops below **30 fps**

These are soft warnings for manual review, not automated CI gates (Vestoro
has no Lighthouse CI today).
