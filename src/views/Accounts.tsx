import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import type { AccountType } from '../db/schema';
import { de } from '../i18n/de';
import { formatCents } from '../lib/money';
import { createAccount } from '../db/repo';
import { Modal } from '../components/ui';
import { ImportDialog } from './ImportDialog';

const ACCOUNT_TYPES: AccountType[] = ['checking', 'savings', 'fixed_deposit', 'depot', 'cash'];

export function Accounts() {
  const accounts = useLiveQuery(() => db.accounts.toArray(), []) ?? [];
  const txs = useLiveQuery(() => db.transactions.toArray(), []) ?? [];
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [iban, setIban] = useState('');

  const balances = new Map<string, { cents: number; count: number }>();
  for (const t of txs) {
    const b = balances.get(t.accountId) ?? { cents: 0, count: 0 };
    b.cents += t.amountCents;
    b.count++;
    balances.set(t.accountId, b);
  }

  async function submit() {
    if (!name.trim()) return;
    await createAccount(name.trim(), type, iban.trim() ? iban.replace(/\s/g, '').toUpperCase() : undefined);
    setName(''); setIban(''); setCreateOpen(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{de.accounts.title}</h2>
        <div className="flex gap-2">
          <button className="btn" onClick={() => setCreateOpen(true)}>{de.accounts.add}</button>
          <button className="btn btn-primary" onClick={() => setImportOpen(true)}>{de.dashboard.importCsv}</button>
        </div>
      </div>

      {accounts.length === 0 && (
        <div className="card p-8 text-center" style={{ color: 'var(--text-dim)' }}>{de.accounts.none}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {accounts.map((a) => {
          const b = balances.get(a.id) ?? { cents: 0, count: 0 };
          return (
            <div key={a.id} className="card p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">{a.name}</span>
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-dim)' }}>
                  {de.accounts.types[a.type]}
                </span>
              </div>
              {a.iban && <div className="mono text-xs mb-3" style={{ color: 'var(--text-dim)' }}>{a.iban}</div>}
              <div className="mono text-xl" style={{ color: b.cents >= 0 ? 'var(--income)' : 'var(--expense)' }}>
                {formatCents(b.cents)}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
                {b.count} {de.accounts.txCount}
              </div>
            </div>
          );
        })}
      </div>

      {createOpen && (
        <Modal title={de.accounts.add} onClose={() => setCreateOpen(false)}>
          <div className="flex flex-col gap-3">
            <input className="input" placeholder={de.accounts.name} value={name} onChange={(e) => setName(e.target.value)} />
            <select className="input" value={type} onChange={(e) => setType(e.target.value as AccountType)}>
              {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{de.accounts.types[t]}</option>)}
            </select>
            <input className="input mono" placeholder={de.accounts.iban} value={iban} onChange={(e) => setIban(e.target.value)} />
            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={submit}>{de.common.save}</button>
              <button className="btn" onClick={() => setCreateOpen(false)}>{de.common.cancel}</button>
            </div>
          </div>
        </Modal>
      )}
      {importOpen && <ImportDialog onClose={() => setImportOpen(false)} />}
    </div>
  );
}
