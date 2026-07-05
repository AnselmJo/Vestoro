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
  isTemplate?: boolean;  // seeded template categories
  active?: boolean;      // deactivatable instead of deletable
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

export interface UndoEntry { id: string; createdAt: string; desc?: string; prevs: Array<{ id: string; previousCategoryId?: string }>; }
export interface AuditLog { id: string; ts: string; action: string; details?: Record<string, any>; }

export class VestoroDb extends Dexie {
  persons!: Table<Person, string>;
  accounts!: Table<Account, string>;
  categories!: Table<Category, string>;
  transactions!: Table<Transaction, string>;
  rules!: Table<Rule, string>;
  settings!: Table<Setting, string>;
  undoEntries!: Table<UndoEntry, string>;
  auditLogs!: Table<AuditLog, string>;

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
          if ((c as any).active === undefined) (c as any).active = true;
        });
      });

    // v4: allow template categories and active flag; migration will seed templates via explicit repo function (dry-run then apply)
    this.version(4)
      .stores({
        persons: 'id',
        accounts: 'id, personId, iban',
        categories: 'id, kind',
        transactions: 'id, accountId, bookingDate, importHash, categoryId, transferGroupId',
        rules: 'id, priority',
        settings: 'key',
      })
      .upgrade(async (tx) => {
        const categories = tx.table('categories');
        // Ensure existing categories have active = true (no deletions yet)
        await categories.toCollection().modify((c: Partial<Category>) => {
          if ((c as any).active === undefined) (c as any).active = true;
          if ((c as any).isTemplate === undefined) (c as any).isTemplate = false;
        });
      });

    // v5: undo entries and audit logs for operations
    this.version(5)
      .stores({
        persons: 'id',
        accounts: 'id, personId, iban',
        categories: 'id, kind',
        transactions: 'id, accountId, bookingDate, importHash, categoryId, transferGroupId',
        rules: 'id, priority',
        settings: 'key',
        undoEntries: 'id, createdAt',
        auditLogs: 'id, ts, action',
      })
      .upgrade(async () => {
        // nothing to migrate; new tables start empty
      });

    // v6: contract detection decisions
    this.version(6)
      .stores({
        persons: 'id',
        accounts: 'id, personId, iban',
        categories: 'id, kind',
        transactions: 'id, accountId, bookingDate, importHash, categoryId, transferGroupId',
        rules: 'id, priority',
        settings: 'key',
        undoEntries: 'id, createdAt',
        auditLogs: 'id, ts, action',
        contractDecisions: 'id, counterpartyNormalized, amountCents, createdAt',
      })
      .upgrade(async () => {
        // nothing to migrate for contractDecisions
      });
  }
}

export const db = new VestoroDb();
