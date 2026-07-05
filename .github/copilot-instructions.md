# CLAUDE.md — Agent instructions for Vestoro

Copy this file's content unchanged to `.github/copilot-instructions.md` so
GitHub Copilot, Claude Code and Antigravity all follow the same rules.

## What this project is

Local-first personal finance PWA (German UI, English code). Stack is FIXED:
Vite + React 18 + TypeScript strict + Tailwind v4 + Dexie + ECharts (core,
tree-shaken) + Zustand + vite-plugin-pwa + Vitest. Do not add dependencies,
do not swap libraries. The build spec is `SPEC-ALPHA.md`; the roadmap is
`docs/PLAN.md`; out-of-scope ideas go to `docs/BACKLOG.md`.

## Hard rules

1. Money is integer cents. Never float arithmetic on amounts. Format via
   `lib/money.ts` only.
2. All user-facing strings live in `src/i18n/de.ts`. Never hardcode German
   text in components.
3. `src/lib/**` and `src/db/**` must not import React or anything from
   `src/views`/`src/components`. Pure logic, unit-tested.
4. All IndexedDB access goes through `src/db/repo.ts`. Views never touch
   Dexie directly.
5. Keep files under ~200 lines. One component per file. Split before you grow.
6. Colors/typography only via CSS variables from `src/styles/tokens.css` and
   Tailwind utilities. No inline hex values, no new colors.
7. No emojis in UI, no gradients, no decorative animation.
8. Every `lib/` change ships with/updates its Vitest test in the same commit.
9. Architecture decisions are append-only entries in `docs/DECISIONS.md`
   (date, decision, why, alternatives). Read it before proposing changes;
   do not re-litigate decided items.
10. Conventional commits (`feat:`, `fix:`, `test:`, `chore:`), small and scoped.

## Working style (token efficiency)

- Read `SPEC-ALPHA.md` section for the current task; do not re-read the whole
  repo. The folder layout is deterministic — trust the paths.
- Implement exactly one build-order step (SPEC section 13) per session/PR.
- Prefer targeted edits over regenerating files.
- Run `npm run check` (tsc + lint + test) before finishing; fix, don't discuss.
- When output would be boilerplate the linter can fix, let the linter fix it.
- Don't produce long explanations in PRs/commits; the code + tests + one
  paragraph is enough.
- If a requirement is ambiguous: choose the simplest interpretation, note one
  line in `docs/DECISIONS.md`, continue. Do not ask when the spec answers it.

## Commands

- `npm run dev` — start dev server
- `npm run test` — Vitest
- `npm run check` — tsc --noEmit + eslint + vitest run (must be green)
- `npm run build` — production build (also run by CI)

## Definition of done (any task)

Green `npm run check`, no new dependencies, strings in `de.ts`, logic in
`lib/` with tests, UI matches tokens, file size rule respected.
