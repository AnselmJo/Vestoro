import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import type { AccountType } from '../db/schema';
import { de } from '../i18n/de';
import { formatCents, formatIsoDate } from '../lib/money';
import { currentIsoDate } from '../lib/money';
import { createAccount, updateAccountBalance } from '../db/repo';
import { Modal } from '../components/ui';
import { ImportDialog } from './ImportDialog';
import type { Scope } from '../app/App';

const ACCOUNT_TYPES: AccountType[] = ['checking', 'savings', 'fixed_deposit', 'depot', 'cash'];

export function Accounts({ scope }: { scope: Scope }) {
  const accounts = useLiveQuery(() => db.accounts.toArray(), []) ?? [];
  const txs = useLiveQuery(() => db.transactions.toArray(), []) ?? [];
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [iban, setIban] = useState('');
  const [balanceFor, setBalanceFor] = useState<string | null>(null);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceDate, setBalanceDate] = useState(currentIsoDate());

  const scoped = useMemo(() => accounts
    .filter((a) => (a.isDemo ?? false) === scope.demoMode)
    .filter((a) => scope.personIds.length === 0 || scope.personIds.includes(a.personId)), [accounts, scope]);

  const balances = new Map<string, { cents: number; count: number }>();
  for (const t of txs) {
    const b = balances.get(t.accountId) ?? { cents: 0, count: 0 };
    b.cents += t.amountCents;
    b.count++;
    balances.set(t.accountId, b);
  }

  async function submit() {
    if (!name.trim()) return;
    await createAccount(name.trim(), type, iban.trim() ? iban.replace(/\s/g, '').toUpperCase() : undefined, {
      isDemo: scope.demoMode,
      personId: scope.personIds.length === 1 ? scope.personIds[0] : undefined,
    });
    setName(''); setIban(''); setCreateOpen(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div />
        <div className="flex gap-2">
          <button className="btn" onClick={() => setCreateOpen(true)}>{de.accounts.add}</button>
          <button className="btn btn-primary" onClick={() => setImportOpen(true)}>{de.dashboard.importCsv}</button>
        </div>
      </div>

      {scoped.length === 0 && (
        <div className="card p-8 text-center" style={{ color: 'var(--text-dim)' }}>{de.accounts.none}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {scoped.map((a) => {
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
              <div className="text-xs" style={{ color: 'var(--text-dim)' }}>{de.accounts.balanceCalc}</div>
              <div className="mono text-xl" style={{ color: b.cents >= 0 ? 'var(--income)' : 'var(--expense)' }}>
                {formatCents(b.cents)}
              </div>
              {a.balanceCents !== undefined && a.balanceDate && (
                <div className="mt-2 text-xs" style={{ color: 'var(--text-dim)' }}>
                  {de.accounts.balanceExport(formatIsoDate(a.balanceDate))}:{' '}
                  <span className="mono" style={{ color: 'var(--text)' }}>{formatCents(a.balanceCents)}</span>
                </div>
              )}
              <div className="text-xs mt-2 mb-3" style={{ color: 'var(--text-dim)' }}>
                {b.count} {de.accounts.txCount}
              </div>
              <button className="btn text-xs" onClick={() => {
                setBalanceFor(a.id);
                setBalanceAmount(a.balanceCents !== undefined ? (a.balanceCents / 100).toFixed(2) : '');
                setBalanceDate(a.balanceDate ?? currentIsoDate());
              }}>
                {de.accounts.setBalance}
              </button>
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
      {importOpen && <ImportDialog scope={scope} onClose={() => setImportOpen(false)} />}
      {balanceFor && (
        <Modal title={de.accounts.setBalance} onClose={() => setBalanceFor(null)}>
          <div className="flex flex-col gap-3">
            <p className="text-sm" style={{ color: 'var(--text-dim)' }}>{de.accounts.setBalanceHint}</p>
            <label className="text-xs" style={{ color: 'var(--text-dim)' }}>
              {de.accounts.balanceAmount}
              <input className="input mt-1 mono" type="number" step="0.01" value={balanceAmount}
                onChange={(e) => setBalanceAmount(e.target.value)} />
            </label>
            <label className="text-xs" style={{ color: 'var(--text-dim)' }}>
              {de.accounts.balanceAsOf}
              <input className="input mt-1" type="date" value={balanceDate}
                onChange={(e) => setBalanceDate(e.target.value)} />
            </label>
            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={async () => {
                const cents = Math.round(Number(balanceAmount.replace(',', '.')) * 100);
                if (!Number.isFinite(cents)) return;
                await updateAccountBalance(balanceFor, cents, balanceDate);
                setBalanceFor(null);
              }}>{de.common.save}</button>
              <button className="btn" onClick={() => setBalanceFor(null)}>{de.common.cancel}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
