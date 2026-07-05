import Dexie, { type Table } from 'dexie';

export type AccountType = 'checking' | 'savings' | 'fixed_deposit' | 'depot' | 'cash';
export type CategoryKind = 'income' | 'expense';

export interface Person { id: string; name: string; }

export interface Account {
  id: string;
  personId: string;
  name: string;
  type: AccountType;
  iban?: string;        // normalized (uppercase, no spaces)
  currency: string;     // 'EUR'
  sharedRatio?: number;
  isDemo?: boolean;     // demo environment flag — demo and real data never mix
  balanceCents?: number;   // last known balance from a bank export (e.g. DKB)
  balanceDate?: string;    // ISO date of that balance
}

export interface Category {
  id: string;
  name: string;
  parentId?: string;
  kind: CategoryKind;
  color?: string; // optional CSS variable or hex from fixed palette
}

export interface Transaction {
  id: string;
  accountId: string;
  bookingDate: string;   // ISO YYYY-MM-DD
  amountCents: number;   // signed
  currency: string;
  counterparty: string;
  counterpartyIban?: string;
  purpose: string;
  categoryId?: string;
  transferGroupId?: string;
  importHash: string;
  source: 'csv' | 'demo' | 'manual';
  raw?: Record<string, string>;
}

export interface Rule {
  id: string;
  priority: number;
  field: 'counterparty' | 'purpose' | 'counterpartyIban';
  op: 'contains' | 'equals' | 'startsWith';
  value: string;               // matched case-insensitive
  categoryId: string;
  exceptions?: string[];       // transaction IDs to exclude from this rule
  enabled?: boolean;           // default true
}

export interface Setting { key: string; value: unknown; }

export class VestoroDb extends Dexie {
  persons!: Table<Person, string>;
  accounts!: Table<Account, string>;
  categories!: Table<Category, string>;
  transactions!: Table<Transaction, string>;
  rules!: Table<Rule, string>;
  settings!: Table<Setting, string>;

  constructor() {
    super('vestoro');
    this.version(1).stores({
      persons: 'id',
      accounts: 'id, personId, iban',
      categories: 'id, kind',
      transactions: 'id, accountId, bookingDate, importHash, categoryId, transferGroupId',
      rules: 'id, priority',
    });
    this.version(2)
      .stores({
        persons: 'id',
        accounts: 'id, personId, iban',
        categories: 'id, kind',
        transactions: 'id, accountId, bookingDate, importHash, categoryId, transferGroupId',
        rules: 'id, priority',
        settings: 'key',
      })
      .upgrade(async (tx) => {
        // Existing installs: mark previously created demo accounts.
        await tx.table('accounts').toCollection().modify((a: Account) => {
          if (a.name?.includes('(Demo)')) a.isDemo = true;
        });
      });

    // v3: add optional rule fields (exceptions, enabled) and set sensible defaults
    // also ensure categories have a default color
    this.version(3)
      .stores({
        persons: 'id',
        accounts: 'id, personId, iban',
        categories: 'id, kind',
        transactions: 'id, accountId, bookingDate, importHash, categoryId, transferGroupId',
        rules: 'id, priority',
        settings: 'key',
      })
      .upgrade(async (tx) => {
        const rules = tx.table('rules');
        // Ensure existing rules have enabled = true and empty exceptions array
        await rules.toCollection().modify((r: Partial<Rule>) => {
          if ((r as any).enabled === undefined) (r as any).enabled = true;
          if (!Array.isArray((r as any).exceptions)) (r as any).exceptions = [];
        });
        const categories = tx.table('categories');
        const palette = ['#EF4444','#F97316','#F59E0B','#EAB308','#84CC16','#10B981','#06B6D4','#3B82F6','#6366F1','#8B5CF6','#EC4899','#374151'];
        let i = 0;
        await categories.toCollection().modify((c: Partial<Category>) => {
          if (!c.color) { c.color = palette[i % palette.length]; i++; }
        });
      });
  }
}

export const db = new VestoroDb();
