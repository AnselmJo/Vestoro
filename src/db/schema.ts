import Dexie, { type Table } from 'dexie';

export type AccountType = 'checking' | 'savings' | 'fixed_deposit' | 'depot' | 'cash';
export type CategoryKind = 'income' | 'expense';

export interface Person { id: string; name: string; }

export interface Account {
  id: string;
  personId: string;
  name: string;
  type: AccountType;
  iban?: string;      // normalized (uppercase, no spaces)
  currency: string;   // 'EUR'
  sharedRatio?: number;
}

export interface Category {
  id: string;
  name: string;
  parentId?: string;
  kind: CategoryKind;
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
  value: string;
  categoryId: string;
}

export class VestoroDb extends Dexie {
  persons!: Table<Person, string>;
  accounts!: Table<Account, string>;
  categories!: Table<Category, string>;
  transactions!: Table<Transaction, string>;
  rules!: Table<Rule, string>;

  constructor() {
    super('vestoro');
    this.version(1).stores({
      persons: 'id',
      accounts: 'id, personId, iban',
      categories: 'id, kind',
      transactions: 'id, accountId, bookingDate, importHash, categoryId, transferGroupId',
      rules: 'id, priority',
    });
  }
}

export const db = new VestoroDb();
