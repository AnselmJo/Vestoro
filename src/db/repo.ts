import { db } from './schema';
import type { Account, AccountType, Category, Person, Rule, Transaction } from './schema';
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
  { name: 'Shopping', kind: 'expense' },
  { name: 'Kinder', kind: 'expense' },
  { name: 'Geldanlage', kind: 'expense' },
  { name: 'Sonstiges', kind: 'expense' },
];

// Auto-classification starter pack for common German merchants/patterns.
// Users can delete or override these in Einstellungen → Regeln.
const DEFAULT_RULES: Array<{ field: Rule['field']; op: Rule['op']; value: string; category: string }> = [
  { field: 'counterparty', op: 'contains', value: 'rewe', category: 'Lebensmittel' },
  { field: 'counterparty', op: 'contains', value: 'lidl', category: 'Lebensmittel' },
  { field: 'counterparty', op: 'contains', value: 'aldi', category: 'Lebensmittel' },
  { field: 'counterparty', op: 'contains', value: 'edeka', category: 'Lebensmittel' },
  { field: 'counterparty', op: 'contains', value: 'netto', category: 'Lebensmittel' },
  { field: 'counterparty', op: 'contains', value: 'penny', category: 'Lebensmittel' },
  { field: 'counterparty', op: 'contains', value: 'kaufland', category: 'Lebensmittel' },
  { field: 'counterparty', op: 'contains', value: 'dm-drogerie', category: 'Lebensmittel' },
  { field: 'counterparty', op: 'contains', value: 'rossmann', category: 'Lebensmittel' },
  { field: 'counterparty', op: 'contains', value: 'shell', category: 'Mobilität' },
  { field: 'counterparty', op: 'contains', value: 'aral', category: 'Mobilität' },
  { field: 'counterparty', op: 'contains', value: 'esso', category: 'Mobilität' },
  { field: 'counterparty', op: 'contains', value: 'db vertrieb', category: 'Mobilität' },
  { field: 'counterparty', op: 'contains', value: 'deutsche bahn', category: 'Mobilität' },
  { field: 'counterparty', op: 'contains', value: 'spotify', category: 'Abos & Verträge' },
  { field: 'counterparty', op: 'contains', value: 'netflix', category: 'Abos & Verträge' },
  { field: 'counterparty', op: 'contains', value: 'telekom', category: 'Abos & Verträge' },
  { field: 'counterparty', op: 'contains', value: 'vodafone', category: 'Abos & Verträge' },
  { field: 'counterparty', op: 'contains', value: 'telefonica', category: 'Abos & Verträge' },
  { field: 'counterparty', op: 'contains', value: '1&1', category: 'Abos & Verträge' },
  { field: 'counterparty', op: 'contains', value: 'allianz', category: 'Versicherungen' },
  { field: 'counterparty', op: 'contains', value: 'huk', category: 'Versicherungen' },
  { field: 'counterparty', op: 'contains', value: 'axa', category: 'Versicherungen' },
  { field: 'counterparty', op: 'contains', value: 'ergo', category: 'Versicherungen' },
  { field: 'counterparty', op: 'contains', value: 'versicherung', category: 'Versicherungen' },
  { field: 'counterparty', op: 'contains', value: 'scalable', category: 'Geldanlage' },
  { field: 'counterparty', op: 'contains', value: 'trade republic', category: 'Geldanlage' },
  { field: 'counterparty', op: 'contains', value: 'apotheke', category: 'Gesundheit' },
  { field: 'counterparty', op: 'contains', value: 'amazon', category: 'Shopping' },
  { field: 'purpose', op: 'contains', value: 'miete', category: 'Wohnen' },
  { field: 'purpose', op: 'contains', value: 'gehalt', category: 'Gehalt' },
  { field: 'purpose', op: 'contains', value: 'lohn', category: 'Gehalt' },
];

/** First-run seed: person, category tree, starter rules. Idempotent. */
export async function ensureSeed(): Promise<void> {
  const personCount = await db.persons.count();
  if (personCount === 0) await db.persons.add({ id: uid(), name: 'Ich' });
  const catCount = await db.categories.count();
  if (catCount === 0) {
    await db.categories.bulkAdd(DEFAULT_CATEGORIES.map((c) => ({ id: uid(), ...c })));
  }
  const ruleCount = await db.rules.count();
  if (ruleCount === 0) {
    const cats = await db.categories.toArray();
    const byName = new Map(cats.map((c) => [c.name, c.id]));
    const rules: Rule[] = [];
    DEFAULT_RULES.forEach((r, i) => {
      const categoryId = byName.get(r.category);
      if (categoryId) rules.push({ id: uid(), priority: i + 1, field: r.field, op: r.op, value: r.value, categoryId });
    });
    await db.rules.bulkAdd(rules);
  }
}

// ---------- settings ----------
export async function getSetting<T>(key: string): Promise<T | undefined> {
  return (await db.settings.get(key))?.value as T | undefined;
}
export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}

// ---------- persons & accounts ----------
export async function createPerson(name: string): Promise<Person> {
  const person: Person = { id: uid(), name };
  await db.persons.add(person);
  return person;
}

export interface CreateAccountOpts { personId?: string; isDemo?: boolean; }

export async function createAccount(
  name: string,
  type: AccountType,
  iban?: string,
  opts: CreateAccountOpts = {},
): Promise<Account> {
  const personId = opts.personId ?? (await db.persons.toCollection().first())!.id;
  const account: Account = {
    id: uid(), personId, name, type, iban, currency: 'EUR', isDemo: opts.isDemo ?? false,
  };
  await db.accounts.add(account);
  return account;
}

export async function updateAccountBalance(id: string, balanceCents: number, balanceDate: string): Promise<void> {
  await db.accounts.update(id, { balanceCents, balanceDate });
}

// ---------- import pipeline ----------
export interface ImportSummary { imported: number; duplicates: number; transfers: number; }

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

// ---------- categorization ----------
export async function setCategory(txId: string, categoryId: string | undefined): Promise<void> {
  await db.transactions.update(txId, { categoryId });
}

/** Bulk: assign one category to many transactions in one write. */
export async function bulkCategorize(txIds: string[], categoryId: string): Promise<void> {
  const txs = await db.transactions.bulkGet(txIds);
  const updated = txs.filter((t): t is Transaction => !!t).map((t) => ({ ...t, categoryId }));
  await db.transactions.bulkPut(updated);
}

export async function addRuleAndApply(rule: Omit<Rule, 'id' | 'priority'>): Promise<number> {
  const priority = (await db.rules.count()) + 1;
  const full: Rule = { id: uid(), priority, ...rule };
  await db.rules.add(full);
  return reapplyRules(false);
}

/** Apply all rules; only fills empty categories unless overwrite. */
export async function reapplyRules(overwrite: boolean): Promise<number> {
  const rules = await db.rules.orderBy('priority').toArray();
  const txs = await db.transactions.toArray();
  const changed: Transaction[] = [];
  for (const tx of txs) {
    if (!overwrite && tx.categoryId) continue;
    const cat = applyRules(tx, rules);
    if (cat && cat !== tx.categoryId) changed.push({ ...tx, categoryId: cat });
  }
  if (changed.length > 0) await db.transactions.bulkPut(changed);
  return changed.length;
}

// ---------- categories ----------
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

// ---------- demo & danger zone ----------
export async function clearDemoData(): Promise<void> {
  const demoAccounts = (await db.accounts.toArray()).filter((a) => a.isDemo);
  const demoAccountIds = new Set(demoAccounts.map((a) => a.id));
  const txs = (await db.transactions.toArray()).filter(
    (t) => t.source === 'demo' || demoAccountIds.has(t.accountId),
  );
  await db.transactions.bulkDelete(txs.map((t) => t.id));
  await db.accounts.bulkDelete(demoAccounts.map((a) => a.id));
}

export async function deleteAllData(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear();
  });
  await ensureSeed();
}
