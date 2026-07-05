import { db } from './schema';
import type { Account, AccountType, Category, Person, Rule, Transaction, UndoEntry } from './schema';
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
  // Validate kind matches transaction sign
  await db.transaction('rw', db.transactions, db.categories, async () => {
    const tx = await db.transactions.get(txId);
    if (!tx) throw new Error('Transaction not found');
    if (!categoryId) {
      await db.transactions.update(txId, { categoryId: undefined });
      return;
    }
    const cat = await db.categories.get(categoryId);
    if (!cat) throw new Error('Category not found');
    const signKind = tx.amountCents > 0 ? 'income' : 'expense';
    if (cat.kind !== signKind) throw new Error(`Category kind '${cat.kind}' does not match transaction sign (${signKind})`);
    await db.transactions.update(txId, { categoryId });
  });
}

/** Bulk: assign one category to many transactions in one write. */
export async function bulkCategorize(txIds: string[], categoryId: string): Promise<void> {
  const txs = await db.transactions.bulkGet(txIds);
  const updated = txs.filter((t): t is Transaction => !!t).map((t) => ({ ...t, categoryId }));
  await db.transactions.bulkPut(updated);
}

export async function addRule(rule: Omit<Rule, 'id' | 'priority'>): Promise<string> {
  const priority = (await db.rules.count()) + 1;
  const id = uid();
  const full: Rule = { id, priority, ...rule };
  await db.rules.add(full);
  return id;
}

export async function bulkCategorizeByCounterparty(counterparty: string, categoryId: string, opts: { createRule?: boolean } = {}): Promise<{ updated: number; ruleId?: string; prevs: Array<{ id: string; previousCategoryId?: string }> }> {
  // match counterparty case-insensitive, trimmed, across all transactions
  const norm = (s: string) => s.trim().toLowerCase();
  const target = norm(counterparty);
  return db.transaction('rw', db.transactions, db.categories, db.rules, async () => {
    const cat = await db.categories.get(categoryId);
    if (!cat) throw new Error('Category not found');
    const all = await db.transactions.toArray();
    const matches = all.filter((t) => norm(t.counterparty) === target);
    const toUpdate = matches.filter((t) => t.categoryId !== categoryId).filter((t) => {
      // enforce kind match
      const signKind = t.amountCents > 0 ? 'income' : 'expense';
      return cat.kind === signKind;
    });
    const prevs: Array<{ id: string; previousCategoryId?: string }> = toUpdate.map((t) => ({ id: t.id, previousCategoryId: t.categoryId }));
    for (const t of toUpdate) await db.transactions.update(t.id, { categoryId });
    let ruleId: string | undefined;
    if (opts.createRule) {
      // create a contains rule on counterparty
      ruleId = await addRule({ field: 'counterparty', op: 'equals', value: counterparty.trim(), categoryId });
    }
    return { updated: toUpdate.length, ruleId, prevs };
  });
}

export async function restoreCategorization(prevs: Array<{ id: string; previousCategoryId?: string }>): Promise<void> {
  if (!prevs || prevs.length === 0) return;
  await db.transaction('rw', db.transactions, async () => {
    for (const p of prevs) {
      await db.transactions.update(p.id, { categoryId: p.previousCategoryId });
    }
  });
}

export async function saveUndoEntry(prevs: Array<{ id: string; previousCategoryId?: string }>, desc?: string): Promise<string> {
  const id = uid();
  const entry = { id, createdAt: new Date().toISOString(), desc, prevs };
  await db.undoEntries.add(entry as any);
  return id;
}

export async function restoreUndoEntry(id: string): Promise<void> {
  const entry = await db.undoEntries.get(id as any);
  if (!entry) throw new Error('Undo entry not found');
  await restoreCategorization(entry.prevs);
  await db.undoEntries.delete(id as any);
}

export async function listUndoEntries(): Promise<UndoEntry[]> {
  return await db.undoEntries.orderBy('createdAt').reverse().toArray();
}

export async function logAudit(action: string, details?: Record<string, any>): Promise<string> {
  const id = uid();
  await db.auditLogs.add({ id, ts: new Date().toISOString(), action, details } as any);
  return id;
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

export async function updateCategory(id: string, patch: Partial<Category>): Promise<void> {
  await db.categories.update(id, patch);
}

export async function deleteCategory(id: string): Promise<void> {
  // Prevent hard delete of template categories. Templates may be deactivated instead.
  const cat = await db.categories.get(id);
  if (!cat) return;
  if ((cat as any).isTemplate) throw new Error('Vorlage kann nicht gelöscht werden — bitte deaktivieren.');
  await db.transaction('rw', db.categories, db.transactions, db.rules, async () => {
    await db.categories.delete(id);
    await db.transactions.where('categoryId').equals(id).modify({ categoryId: undefined });
    await db.rules.where('categoryId').equals(id).delete();
  });
}

/**
 * Dry-run: compare desired template taxonomy against existing categories and return a diff-report
 */
export async function previewSeedCategoryTemplate(): Promise<{
  toCreate: Array<{ name: string; parent?: string; kind: string }>;
  matches: Array<{ name: string; existingId: string }>;
}> {
  const existing = await db.categories.toArray();
  const existingByName = new Map(existing.map((c) => [c.name.toLowerCase(), c]));

  const template = getTemplateList();
  const toCreate: Array<{ name: string; parent?: string; kind: string }> = [];
  const matches: Array<{ name: string; existingId: string }> = [];

  for (const t of template) {
    const found = existingByName.get(t.name.toLowerCase());
    if (found) matches.push({ name: t.name, existingId: found.id });
    else toCreate.push(t);
  }
  return { toCreate, matches };
}

/**
 * Apply seed: migrate existing categories/rules first by name, then create missing template categories and mark them as templates.
 * Returns created category ids map.
 */
export async function applySeedCategoryTemplate(): Promise<Record<string, string>> {
  return db.transaction('rw', db.categories, db.transactions, db.rules, async () => {
    const existing = await db.categories.toArray();
    const existingByName = new Map(existing.map((c) => [c.name.toLowerCase(), c]));
    const template = getTemplateList();

    const created: Record<string, string> = {};
    // First ensure parent categories exist or are created
    for (const t of template) {
      const lname = t.name.toLowerCase();
      let cat = existingByName.get(lname);
      if (!cat) {
        // create
        const id = uid();
        const parentId = t.parent ? (created[t.parent] ?? existingByName.get(t.parent.toLowerCase())?.id) : undefined;
        const newCat = { id, name: t.name, parentId, kind: t.kind as any, isTemplate: true, active: true } as any;
        await db.categories.add(newCat);
        created[t.name] = id;
        existingByName.set(lname, newCat);
      } else {
        // mark as template and active
        await db.categories.update(cat.id, { isTemplate: true, active: true });
        created[t.name] = cat.id;
      }
    }
    // Done. Rules and txs already point to existing category ids; we preserved those. Return map
    return created;
  });
}

/** Template definition helper (flat list with parent references) */
function getTemplateList(): Array<{ name: string; parent?: string; kind: 'income'|'expense' }> {
  const out: Array<{ name: string; parent?: string; kind: 'income'|'expense' }> = [];
  // Top-level and subcategories from spec
  const addTop = (name: string, subs: string[] | null, kind: 'income'|'expense') => {
    out.push({ name, kind });
    if (subs) for (const s of subs) out.push({ name: s, parent: name, kind });
  };
  addTop('Wohnen', ['Wohnnebenkosten','Heimwerken und Garten','Strom','Gas','Möbel und Haushaltsgeräte','Haushaltsdienstleistungen','Immobilienkredit','Miete / Wohngeld'], 'expense');
  addTop('Kinder', ['Kinderbetreuung und -gruppen','Taschengeld / Unterhalt','Spielwaren'], 'expense');
  addTop('Lebenshaltung', ['Drogerie','Lebensmittel und Getränke','Haushaltsbedarf','Festnetz und Internet','Handy','Haustier (-bedarf)'], 'expense');
  addTop('Gesundheit und Wellness', ['Arztbesuch / Krankenhaus','Arznei- und Heilmittel','Wellness und Beauty'], 'expense');
  addTop('Einnahmen', ['Staatliche Leistung und Förderung','Unterhalt','Kapitaleinkommen','Bareinzahlung','Mieteinnahmen','Rente und Pension','Gehalt'], 'income');
  addTop('Versicherung', ['Unfallversicherung','Krankenversicherung','Wohngebäudeversicherung','Hausratversicherung','Rechtsschutzversicherung','Haftpflichtversicherung','Pflegeversicherung','Berufsunfähigkeitsversicherung','Tierversicherung','Kranken-Zusatzversicherung','Risiko-Lebensversicherung','Reiseversicherung'], 'expense');
  addTop('Freizeit, Hobbies und Soziales', ['Kirche / Spende','Freizeitaktivitäten','Restaurant / Cafe / Bar','Sport und Fitness'], 'expense');
  addTop('Mobilität', ['KFZ-Versicherung','KFZ-Kredit / Leasingrate / KFZ-Kauf','KFZ-Sonstige','Tanken','Taxi / ÖPNV / Car- und Bikesharing'], 'expense');
  addTop('Sparen und Anlegen', ['Festgeld / Tagesgeld / Sparkonto','Bausparen','Kapitallebensversicherung','Private Rentenversicherung','Wertpapieranlage','Wertgegenstände und andere Anlagen'], 'expense');
  addTop('Shopping und Unterhaltung', ['Bücher / Zeitungen / Zeitschriften','Bekleidung / Schuhe / Accessoires','Unterhaltungselektronik und Software','Büromaterial','TV / Video / Musik'], 'expense');
  addTop('Reisen', ['Hotel und Unterkunft','Pauschalreise','Transport'], 'expense');
  addTop('Bank und Kredit', ['Kontentransfer','Bankgebühren','Barauszahlung','Kreditkartenabrechnung','Kredittilgung und -zinsen'], 'expense');
  addTop('Unkategorisiert', null, 'expense');
  return out;
}

// ---------- rules helpers ----------
export async function updateRule(id: string, patch: Partial<Rule>): Promise<void> {
  await db.rules.update(id, patch);
}

export async function deleteRule(id: string): Promise<void> {
  await db.rules.delete(id);
}

export async function moveRule(id: string, direction: 'up' | 'down'): Promise<void> {
  const rules = await db.rules.orderBy('priority').toArray();
  const idx = rules.findIndex((r) => r.id === id);
  if (idx === -1) return;
  const swapWith = direction === 'up' ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= rules.length) return;
  const a = rules[idx];
  const b = rules[swapWith];
  await db.transaction('rw', db.rules, async () => {
    await db.rules.update(a.id, { priority: b.priority });
    await db.rules.update(b.id, { priority: a.priority });
  });
}

/** Reorder rules to match the provided array of ids (first = highest priority). */
export async function reorderRules(ids: string[]): Promise<void> {
  await db.transaction('rw', db.rules, async () => {
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      await db.rules.update(id, { priority: i + 1 });
    }
  });
}

export async function bulkUpdateRules(ids: string[], patch: Partial<Rule>): Promise<void> {
  await db.transaction('rw', db.rules, async () => {
    for (const id of ids) await db.rules.update(id, patch);
  });
}

export async function bulkDeleteRules(ids: string[]): Promise<void> {
  await db.transaction('rw', db.rules, async () => {
    for (const id of ids) await db.rules.delete(id);
  });
}

export async function bulkReassignRules(ids: string[], categoryId: string): Promise<void> {
  await db.transaction('rw', db.rules, async () => {
    for (const id of ids) await db.rules.update(id, { categoryId });
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
