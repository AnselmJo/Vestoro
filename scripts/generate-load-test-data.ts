#!/usr/bin/env tsx
/**
 * scripts/generate-load-test-data.ts
 *
 * Generates a synthetic transaction dataset compatible with Vestoro's JSON
 * backup format. Output can be imported via the Vestoro backup-restore path
 * (Settings → Backup → Restore from file) for manual performance testing.
 *
 * Usage:
 *   npx tsx scripts/generate-load-test-data.ts [--count N] [--accounts N] [--months N] [--out FILE]
 *
 * Defaults:
 *   --count    10000   number of transactions to generate
 *   --accounts 3       number of synthetic accounts
 *   --months   24      months of history (most-recent first)
 *   --out      dist/load-test-<count>.json
 *
 * NOT a CI test. For manual verification only.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// CLI argument parsing (no external dep)
// ---------------------------------------------------------------------------
function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--') && i + 1 < args.length) {
      result[arg.slice(2)] = args[i + 1]!;
      i++;
    }
  }
  return result;
}

const args = parseArgs(process.argv.slice(2));
const COUNT    = Math.max(1, Number(args['count']    ?? 10000));
const ACCOUNTS = Math.max(1, Number(args['accounts'] ?? 3));
const MONTHS   = Math.max(1, Number(args['months']   ?? 24));

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT = join(__dirname, '..', 'dist', `load-test-${COUNT}.json`);
const OUT = args['out'] ?? DEFAULT_OUT;

// ---------------------------------------------------------------------------
// Deterministic PRNG (xorshift32) — reproducible data across runs
// ---------------------------------------------------------------------------
let seed = 0xdeadbeef;
function rand(): number {
  seed ^= seed << 13;
  seed ^= seed >> 17;
  seed ^= seed << 5;
  return (seed >>> 0) / 0xffffffff;
}
function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)]!;
}
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(rand() * 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------
const COUNTERPARTIES = [
  'REWE Group', 'EDEKA', 'Aldi', 'Lidl', 'dm-drogerie markt',
  'Deutsche Bahn', 'Spotify', 'Netflix', 'Amazon', 'Zalando',
  'Arbeitgeber GmbH', 'Freelance AG', 'Miete Verwaltung KG',
  'GEZ / ARD ZDF', 'Stadtwerke Energie', 'Telekom', 'O2',
  'Fitness-Studio', 'Apotheke am Markt', 'Zahnarzt Dr. Müller',
  'Restaurant Bella Italia', 'Café Central', 'Pizzeria Roma',
  'Buchhandlung Hugendubel', 'Media Markt', 'Saturn',
  'Baumarkt Obi', 'IKEA Deutschland', 'Hornbach',
  'Tankstelle Shell', 'Tankstelle Aral',
];

const PURPOSES = [
  'Monatsbeitrag', 'Einkauf', 'Reisekosten', 'Erstattung',
  'Dauerauftrag', 'Lastschrift', 'Überweisung', 'Gehalt',
  'Provision', 'Rückerstattung', 'Abonnement', 'Rechnung',
];

const CATEGORY_IDS = [
  'cat-food', 'cat-transport', 'cat-housing', 'cat-health',
  'cat-entertainment', 'cat-shopping', 'cat-income', 'cat-utilities',
];

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------
function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function monthsBack(count: number): Array<{ year: number; month: number }> {
  const now = new Date();
  const result: Array<{ year: number; month: number }> = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  return result;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// ---------------------------------------------------------------------------
// Generate accounts
// ---------------------------------------------------------------------------
interface Account {
  id: string;
  personId: string;
  name: string;
  type: string;
  currency: string;
  isDemo: boolean;
}

const personId = uuid();
const accounts: Account[] = Array.from({ length: ACCOUNTS }, (_, i) => ({
  id: `acc-${i + 1}`,
  personId,
  name: `Testkonto ${i + 1}`,
  type: i === 0 ? 'checking' : i === 1 ? 'savings' : 'checking',
  currency: 'EUR',
  isDemo: false,
}));

// ---------------------------------------------------------------------------
// Generate transactions
// ---------------------------------------------------------------------------
interface Transaction {
  id: string;
  accountId: string;
  bookingDate: string;
  amountCents: number;
  currency: string;
  counterparty: string;
  purpose: string;
  categoryId?: string;
  importHash: string;
  source: 'csv';
}

const availableMonths = monthsBack(MONTHS);
const transactions: Transaction[] = [];

for (let i = 0; i < COUNT; i++) {
  const { year, month } = pick(availableMonths);
  const day = randInt(1, daysInMonth(year, month));
  const isIncome = rand() < 0.15; // ~15 % income transactions
  const amountCents = isIncome
    ? randInt(150_000, 500_000)          // €1 500 – €5 000 income
    : -randInt(50, 30_000);              // €0.50 – €300 expense

  transactions.push({
    id: uuid(),
    accountId: accounts[randInt(0, ACCOUNTS - 1)]!.id,
    bookingDate: isoDate(year, month, day),
    amountCents,
    currency: 'EUR',
    counterparty: pick(COUNTERPARTIES),
    purpose: pick(PURPOSES),
    // ~80 % categorized
    categoryId: rand() < 0.8 ? pick(CATEGORY_IDS) : undefined,
    importHash: uuid(),
    source: 'csv',
  });
}

// Sort descending by date (same as the real DB query)
transactions.sort((a, b) => b.bookingDate.localeCompare(a.bookingDate));

// ---------------------------------------------------------------------------
// Assemble backup payload (Vestoro backup format)
// ---------------------------------------------------------------------------
const payload = {
  version: 1,
  exportedAt: new Date().toISOString(),
  persons: [{ id: personId, name: 'Load Test Person' }],
  accounts,
  categories: CATEGORY_IDS.map((id) => ({
    id,
    name: id.replace('cat-', ''),
    kind: id === 'cat-income' ? 'income' : 'expense',
    active: true,
  })),
  transactions,
  rules: [],
};

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(payload, null, 2), 'utf-8');

console.log(`✓  Generated ${COUNT} transactions across ${ACCOUNTS} accounts / ${MONTHS} months`);
console.log(`✓  Output: ${OUT}`);
console.log('');
console.log('To import into Vestoro:');
console.log('  1. Open Vestoro → Settings → Backup → Restore from file');
console.log(`  2. Select: ${OUT}`);
console.log('  3. Navigate to Transactions — virtual scrolling activates above 500 filtered rows.');
