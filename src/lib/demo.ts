import { db } from '../db/schema';
import type { Transaction } from '../db/schema';
import { createAccount, importRows, uid } from '../db/repo';
import type { ParsedRow } from './csv/profiles';

// Deterministic pseudo-random so the demo looks the same for everyone.
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GROCERIES = ['REWE Markt GmbH', 'Lidl Vertriebs GmbH', 'ALDI SUED', 'Edeka Suedwest', 'dm-drogerie markt'];
const LEISURE = ['Kino Isny', 'Buchhandlung Osiander', 'Cafe Allgäu', 'Decathlon', 'Thalia'];
const MOBILITY = ['Shell Tankstelle', 'DB Vertrieb GmbH', 'Aral AG'];

export async function loadDemoData(): Promise<void> {
  const existing = await db.accounts.count();
  const rand = mulberry32(42);

  const giroC24 = existing === 0
    ? await createAccount('C24 Girokonto (Demo)', 'checking', 'DE02120300000000202051')
    : (await db.accounts.toCollection().first())!;
  const giroDkb = await createAccount('DKB Girokonto (Demo)', 'checking', 'DE02100500000054540402');
  const tagesgeld = await createAccount('Tagesgeld (Demo)', 'savings', 'DE02300209000106531065');

  const catId = async (name: string) =>
    (await db.categories.toArray()).find((c) => c.name === name)?.id;
  const salary = await catId('Gehalt');
  const housing = await catId('Wohnen');
  const groceries = await catId('Lebensmittel');
  const mobility = await catId('Mobilität');
  const insurance = await catId('Versicherungen');
  const subs = await catId('Abos & Verträge');
  const leisure = await catId('Freizeit');
  const invest = await catId('Geldanlage');

  const now = new Date();
  const c24Rows: ParsedRow[] = [];
  const dkbRows: ParsedRow[] = [];
  const tgRows: ParsedRow[] = [];
  const cat = new Map<string, string | undefined>(); // rowKey → categoryId

  const push = (rows: ParsedRow[], date: string, cents: number, cp: string, purpose: string, category?: string, iban?: string) => {
    const row: ParsedRow = { bookingDate: date, amountCents: cents, counterparty: cp, purpose, counterpartyIban: iban, raw: {} };
    rows.push(row);
    cat.set(rowKey(row), category);
  };

  for (let m = 17; m >= 0; m--) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = (n: number) => `${y}-${mo}-${String(n).padStart(2, '0')}`;

    push(c24Rows, day(1), 385000 + Math.floor(rand() * 20) * 500, 'Muster GmbH', `Gehalt ${mo}/${y}`, salary);
    push(c24Rows, day(2), -128000, 'Wohnbau Allgäu eG', 'Miete inkl. NK', housing);
    push(c24Rows, day(3), -12500, 'Allianz Versicherung', 'Haftpflicht/Hausrat', insurance);
    push(c24Rows, day(5), -1499, 'Spotify AB', 'Premium Family', subs);
    push(c24Rows, day(6), -4990, 'Telekom Deutschland', 'Festnetz/Internet', subs);
    // groceries: 6–9 purchases per month on the DKB card
    const buys = 6 + Math.floor(rand() * 4);
    for (let i = 0; i < buys; i++) {
      const merchant = GROCERIES[Math.floor(rand() * GROCERIES.length)];
      push(dkbRows, day(2 + Math.floor(rand() * 26)), -(1200 + Math.floor(rand() * 9000)), merchant, `${merchant} sagt Danke`, groceries);
    }
    for (let i = 0; i < 2; i++) {
      const merchant = MOBILITY[Math.floor(rand() * MOBILITY.length)];
      push(dkbRows, day(4 + Math.floor(rand() * 22)), -(3000 + Math.floor(rand() * 6000)), merchant, 'Kartenzahlung', mobility);
    }
    for (let i = 0; i < 2 + Math.floor(rand() * 3); i++) {
      const merchant = LEISURE[Math.floor(rand() * LEISURE.length)];
      push(dkbRows, day(5 + Math.floor(rand() * 23)), -(900 + Math.floor(rand() * 5500)), merchant, 'Kartenzahlung', leisure);
    }
    // internal transfers: C24 → DKB budget + C24 → Tagesgeld savings
    push(c24Rows, day(3), -60000, 'Anselm Muster', 'Haushaltsbudget', undefined, giroDkb.iban);
    push(dkbRows, day(3), 60000, 'Anselm Muster', 'Haushaltsbudget', undefined, giroC24.iban);
    push(c24Rows, day(4), -80000, 'Anselm Muster', 'Sparen Tagesgeld', undefined, tagesgeld.iban);
    push(tgRows, day(4), 80000, 'Anselm Muster', 'Sparen Tagesgeld', undefined, giroC24.iban);
    // broker savings plan
    push(c24Rows, day(7), -100000, 'Scalable Capital', 'Broker Sparplan FTSE All-World', invest, 'DE16120700700752814076');
  }

  await importRows(giroC24.id, c24Rows, 'demo');
  await importRows(giroDkb.id, dkbRows, 'demo');
  await importRows(tagesgeld.id, tgRows, 'demo');

  // Assign categories recorded above (import itself only applies rules).
  const all = await db.transactions.toArray();
  const updates: Array<{ key: string; id: string }> = [];
  for (const t of all) {
    if (t.source !== 'demo' || t.categoryId) continue;
    updates.push({ key: txKey(t), id: t.id });
  }
  for (const u of updates) {
    const categoryId = cat.get(u.key);
    if (categoryId) await db.transactions.update(u.id, { categoryId });
  }
}

const rowKey = (r: ParsedRow) => `${r.bookingDate}|${r.amountCents}|${r.counterparty}|${r.purpose}`;
const txKey = (t: Transaction) => `${t.bookingDate}|${t.amountCents}|${t.counterparty}|${t.purpose}`;

export const demoId = uid; // re-export to keep tree-shaking honest
