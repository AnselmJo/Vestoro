import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import type { Transaction } from '../db/schema';
import { de } from '../i18n/de';
import { formatCents, formatIsoDate } from '../lib/money';
import { addRuleAndApply, setCategory } from '../db/repo';

const PAGE = 100;

export function Transactions({ month, search, onSearch }: { month: string; search: string; onSearch: (s: string) => void }) {
  const txs = useLiveQuery(() => db.transactions.orderBy('bookingDate').reverse().toArray(), []) ?? [];
  const accounts = useLiveQuery(() => db.accounts.toArray(), []) ?? [];
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const [accountFilter, setAccountFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [monthOnly, setMonthOnly] = useState(true);
  const [limit, setLimit] = useState(PAGE);
  const [rulePrompt, setRulePrompt] = useState<{ tx: Transaction; categoryId: string } | null>(null);

  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  const filtered = txs.filter((t) => {
    if (monthOnly && !t.bookingDate.startsWith(month)) return false;
    if (accountFilter && t.accountId !== accountFilter) return false;
    if (categoryFilter === '__none__' && t.categoryId) return false;
    if (categoryFilter && categoryFilter !== '__none__' && t.categoryId !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!t.counterparty.toLowerCase().includes(q) && !t.purpose.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  async function onCategoryChange(tx: Transaction, categoryId: string) {
    await setCategory(tx.id, categoryId || undefined);
    if (categoryId && tx.counterparty.trim()) setRulePrompt({ tx, categoryId });
  }

  async function createRule() {
    if (!rulePrompt) return;
    await addRuleAndApply({
      field: 'counterparty',
      op: 'contains',
      value: rulePrompt.tx.counterparty.trim(),
      categoryId: rulePrompt.categoryId,
    });
    setRulePrompt(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-lg font-semibold mr-auto">{de.tx.title}</h2>
        <input id="tx-search" className="input max-w-56" placeholder={de.tx.search}
          value={search} onChange={(e) => onSearch(e.target.value)} />
        <select className="input max-w-44" value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
          <option value="">{de.tx.filterAll}: {de.tx.account}</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select className="input max-w-44" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">{de.tx.filterAll}: {de.tx.category}</option>
          <option value="__none__">{de.tx.uncategorized}</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-dim)' }}>
          <input type="checkbox" checked={monthOnly} onChange={(e) => setMonthOnly(e.target.checked)} />
          {de.common.month}
        </label>
      </div>

      {rulePrompt && (
        <div className="card p-3 flex items-center gap-3 text-sm" style={{ borderColor: 'var(--accent)' }}>
          <span>
            {de.tx.createRule} <span style={{ color: 'var(--text-dim)' }}>
              „{de.tx.counterparty} enthält ‚{rulePrompt.tx.counterparty}‘ → {categories.find((c) => c.id === rulePrompt.categoryId)?.name}“
            </span>
          </span>
          <button className="btn btn-primary text-xs" onClick={createRule}>Ja, Regel erstellen</button>
          <button className="btn text-xs" onClick={() => setRulePrompt(null)}>Nein</button>
        </div>
      )}

      <div className="card overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs" style={{ color: 'var(--text-dim)' }}>
              <th className="text-left p-3">{de.tx.date}</th>
              <th className="text-left p-3">{de.tx.account}</th>
              <th className="text-left p-3">{de.tx.counterparty}</th>
              <th className="text-left p-3 hidden lg:table-cell">{de.tx.purpose}</th>
              <th className="text-left p-3">{de.tx.category}</th>
              <th className="text-right p-3">{de.tx.amount}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, limit).map((t) => (
              <tr key={t.id} style={{ borderTop: '1px solid var(--border)', opacity: t.transferGroupId ? 0.55 : 1 }}>
                <td className="p-3 mono whitespace-nowrap">{formatIsoDate(t.bookingDate)}</td>
                <td className="p-3 whitespace-nowrap" style={{ color: 'var(--text-dim)' }}>{accountName.get(t.accountId)}</td>
                <td className="p-3 max-w-48 truncate">{t.counterparty}</td>
                <td className="p-3 max-w-64 truncate hidden lg:table-cell" style={{ color: 'var(--text-dim)' }}>{t.purpose}</td>
                <td className="p-3">
                  {t.transferGroupId ? (
                    <span className="text-xs px-2 py-1 rounded" style={{ background: 'var(--surface-2)', color: 'var(--transfer)' }}>
                      {de.tx.transfer}
                    </span>
                  ) : (
                    <select
                      className="input text-xs py-1"
                      value={t.categoryId ?? ''}
                      onChange={(e) => onCategoryChange(t, e.target.value)}
                      style={{ minWidth: 130, borderColor: t.categoryId ? 'var(--border)' : 'var(--expense)' }}
                    >
                      <option value="">{de.tx.uncategorized}</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  )}
                </td>
                <td className="p-3 mono text-right whitespace-nowrap"
                  style={{ color: t.transferGroupId ? 'var(--transfer)' : t.amountCents < 0 ? 'var(--expense)' : 'var(--income)' }}>
                  {formatCents(t.amountCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-10 text-center" style={{ color: 'var(--text-dim)' }}>{de.tx.none}</div>
        )}
        {filtered.length > limit && (
          <div className="p-3 text-center">
            <button className="btn text-xs" onClick={() => setLimit(limit + PAGE)}>
              {de.tx.loadMore} ({filtered.length - limit})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
