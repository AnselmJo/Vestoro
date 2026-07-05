import { db } from './schema';
import type { Account, AccountType, Category, Rule, Transaction } from './schema';
import type { ParsedRow } from '../lib/csv/profiles';
import { importHash } from '../lib/dedupe';
import { detectTransfers } from '../lib/transfers';
import { applyRules } from '../lib/rules';

export const uid = () => crypto.randomUUID();

const DEFAULT_CATEGORIES: Array<{ name: string; kind: 'income' | 'expense' }> = [
  { name: 'Gehalt', kind: 'income' },
  { name: 'Kapitalerträge', kind: 'income' },
  { name: 'Sonstiges Einkommen', kind: 'income' },
  { name: 'Wohnen', kind: 'expense' },
  { name: 'Lebensmittel', kind: 'expense' },
  { name: 'Mobilität', kind: 'expense' },
  { name: 'Versicherungen', kind: 'expense' },
  { name: 'Abos & Verträge', kind: 'expense' },
  { name: 'Gesundheit', kind: 'expense' },
  { name: 'Freizeit', kind: 'expense' },
  { name: 'Kinder', kind: 'expense' },
  { name: 'Geldanlage', kind: 'expense' },
  { name: 'Sonstiges', kind: 'expense' },
];

/** First-run seed: one person + default category tree. Idempotent. */
export async function ensureSeed(): Promise<void> {
  const personCount = await db.persons.count();
  if (personCount === 0) await db.persons.add({ id: uid(), name: 'Ich' });
  const catCount = await db.categories.count();
  if (catCount === 0) {
    await db.categories.bulkAdd(DEFAULT_CATEGORIES.map((c) => ({ id: uid(), ...c })));
  }
}

export async function createAccount(name: string, type: AccountType, iban?: string): Promise<Account> {
  const person = (await db.persons.toCollection().first())!;
  const account: Account = { id: uid(), personId: person.id, name, type, iban, currency: 'EUR' };
  await db.accounts.add(account);
  return account;
}

export interface ImportSummary { imported: number; duplicates: number; transfers: number; }

/**
 * Import pipeline: hash + dedupe → insert → apply rules → detect transfers.
 * Runs in a single Dexie transaction.
 */
export async function importRows(
  accountId: string,
  rows: ParsedRow[],
  source: Transaction['source'] = 'csv',
): Promise<ImportSummary> {
  return db.transaction('rw', db.transactions, db.rules, db.accounts, async () => {
    const existing = new Set((await db.transactions.toArray()).map((t) => t.importHash));
    const rules = await db.rules.orderBy('priority').toArray();
    let imported = 0;
    let duplicates = 0;

    const toInsert: Transaction[] = [];
    for (const r of rows) {
      const hash = importHash(accountId, r.bookingDate, r.amountCents, r.counterpartyIban ?? r.counterparty, r.purpose);
      if (existing.has(hash)) { duplicates++; continue; }
      existing.add(hash);
      const tx: Transaction = {
        id: uid(),
        accountId,
        bookingDate: r.bookingDate,
        amountCents: r.amountCents,
        currency: 'EUR',
        counterparty: r.counterparty,
        counterpartyIban: r.counterpartyIban,
        purpose: r.purpose,
        importHash: hash,
        source,
        raw: r.raw,
      };
      tx.categoryId = applyRules(tx, rules) ?? undefined;
      toInsert.push(tx);
      imported++;
    }
    await db.transactions.bulkAdd(toInsert);

    const accounts = await db.accounts.toArray();
    const all = await db.transactions.toArray();
    const pairs = detectTransfers(all, accounts);
    let transfers = 0;
    for (const [a, b, groupId] of pairs) {
      await db.transactions.update(a, { transferGroupId: groupId });
      await db.transactions.update(b, { transferGroupId: groupId });
      transfers++;
    }
    return { imported, duplicates, transfers };
  });
}

export async function setCategory(txId: string, categoryId: string | undefined): Promise<void> {
  await db.transactions.update(txId, { categoryId });
}

export async function addRuleAndApply(rule: Omit<Rule, 'id' | 'priority'>): Promise<number> {
  const priority = (await db.rules.count()) + 1;
  const full: Rule = { id: uid(), priority, ...rule };
  await db.rules.add(full);
  return reapplyRules(false);
}

/** Apply all rules to transactions; only fills empty categories unless overwrite. */
export async function reapplyRules(overwrite: boolean): Promise<number> {
  const rules = await db.rules.orderBy('priority').toArray();
  const txs = await db.transactions.toArray();
  let changed = 0;
  for (const tx of txs) {
    if (!overwrite && tx.categoryId) continue;
    const cat = applyRules(tx, rules);
    if (cat && cat !== tx.categoryId) {
      await db.transactions.update(tx.id, { categoryId: cat });
      changed++;
    }
  }
  return changed;
}

export async function addCategory(name: string, kind: Category['kind']): Promise<void> {
  await db.categories.add({ id: uid(), name, kind });
}

export async function deleteCategory(id: string): Promise<void> {
  await db.transaction('rw', db.categories, db.transactions, db.rules, async () => {
    await db.categories.delete(id);
    await db.transactions.where('categoryId').equals(id).modify({ categoryId: undefined });
    await db.rules.where('categoryId').equals(id).delete();
  });
}

export async function clearDemoData(): Promise<void> {
  // 'source' is not indexed — plain filter is fine at this data size.
  const demo = (await db.transactions.toArray()).filter((t) => t.source === 'demo');
  await db.transactions.bulkDelete(demo.map((t) => t.id));
}

export async function deleteAllData(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear();
  });
  await ensureSeed();
}
