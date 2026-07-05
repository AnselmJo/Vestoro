import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import type { Transaction } from '../db/schema';
import { de } from '../i18n/de';
import { currentMonthKey, formatCents, formatIsoDate, monthLabel, shiftMonth } from '../lib/money';
import { addRuleAndApply, bulkCategorize, setCategory } from '../db/repo';
import { Modal } from '../components/ui';
import { RulesManager } from './RulesManager';
import type { Scope } from '../app/App';

const PAGE = 100;

export function Transactions({ scope, search, onSearch }: {
  scope: Scope; search: string; onSearch: (s: string) => void;
}) {
  const allTxs = useLiveQuery(() => db.transactions.orderBy('bookingDate').reverse().toArray(), []) ?? [];
  const accounts = useLiveQuery(() => db.accounts.toArray(), []) ?? [];
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const [categoryFilter, setCategoryFilter] = useState('');
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const [allPeriods, setAllPeriods] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [rulePrompt, setRulePrompt] = useState<{ tx: Transaction; categoryId: string } | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  const scopedAccountIds = useMemo(() => new Set(
    accounts
      .filter((a) => (a.isDemo ?? false) === scope.demoMode)
      .filter((a) => scope.personIds.length === 0 || scope.personIds.includes(a.personId))
      .filter((a) => scope.accountIds.length === 0 || scope.accountIds.includes(a.id))
      .map((a) => a.id),
  ), [accounts, scope]);
  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  // For transfers: map groupId → the two involved account names to render direction.
  const transferPartner = useMemo(() => {
    const byGroup = new Map<string, Transaction[]>();
    for (const t of allTxs) {
      if (!t.transferGroupId) continue;
      if (!byGroup.has(t.transferGroupId)) byGroup.set(t.transferGroupId, []);
      byGroup.get(t.transferGroupId)!.push(t);
    }
    const partner = new Map<string, string>(); // txId → partner account name
    for (const pair of byGroup.values()) {
      if (pair.length !== 2) continue;
      partner.set(pair[0].id, accountName.get(pair[1].accountId) ?? '?');
      partner.set(pair[1].id, accountName.get(pair[0].accountId) ?? '?');
    }
    return partner;
  }, [allTxs, accountName]);

  const scopedTxs = allTxs.filter((t) => scopedAccountIds.has(t.accountId));

  const filtered = scopedTxs.filter((t) => {
    if (!allPeriods && !t.bookingDate.startsWith(monthKey)) return false;
    if (categoryFilter === '__none__' && (t.categoryId || t.transferGroupId)) return false;
    if (categoryFilter && categoryFilter !== '__none__' && t.categoryId !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!t.counterparty.toLowerCase().includes(q) && !t.purpose.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const uncategorizedCount = scopedTxs.filter((t) => !t.categoryId && !t.transferGroupId).length;

  async function onCategoryChange(tx: Transaction, categoryId: string) {
    await setCategory(tx.id, categoryId || undefined);
    if (categoryId && tx.counterparty.trim()) setRulePrompt({ tx, categoryId });
  }

  async function createRule() {
    if (!rulePrompt) return;
    await addRuleAndApply({
      field: 'counterparty', op: 'contains',
      value: rulePrompt.tx.counterparty.trim(), categoryId: rulePrompt.categoryId,
    });
    setRulePrompt(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button className="btn px-2 py-1" disabled={allPeriods} onClick={() => setMonthKey(shiftMonth(monthKey, -1))}>◀</button>
        <span className="font-medium min-w-32 text-center" style={{ opacity: allPeriods ? 0.4 : 1 }}>{monthLabel(monthKey)}</span>
        <button className="btn px-2 py-1" disabled={allPeriods} onClick={() => setMonthKey(shiftMonth(monthKey, 1))}>▶</button>
        <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-dim)' }}>
          <input type="checkbox" checked={allPeriods} onChange={(e) => setAllPeriods(e.target.checked)} />
          {de.tx.allPeriods}
        </label>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <input id="tx-search" className="input max-w-52" placeholder={de.tx.search}
            value={search} onChange={(e) => onSearch(e.target.value)} />
          <select className="input max-w-44" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">{de.tx.filterAll}: {de.tx.category}</option>
            <option value="__none__">{de.tx.uncategorized}</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => setBulkOpen(true)}>
            {de.tx.bulk}{uncategorizedCount > 0 ? ` (${uncategorizedCount})` : ''}
          </button>
          <button className="btn" onClick={() => setRulesOpen(true)}>Categories & Rules</button>
        </div>
      </div>

      {rulePrompt && (
        <div className="card p-3 flex items-center gap-3 text-sm flex-wrap" style={{ borderColor: 'var(--accent)' }}>
          <span>
            {de.tx.createRule}{' '}
            <span style={{ color: 'var(--text-dim)' }}>
              „{de.tx.counterparty} enthält ‚{rulePrompt.tx.counterparty}‘ → {categories.find((c) => c.id === rulePrompt.categoryId)?.name}“
            </span>
          </span>
          <button className="btn btn-primary text-xs" onClick={createRule}>{de.tx.yesRule}</button>
          <button className="btn text-xs" onClick={() => setRulePrompt(null)}>{de.tx.no}</button>
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
              <tr key={t.id} style={{ borderTop: '1px solid var(--border)', opacity: t.transferGroupId ? 0.6 : 1 }}>
                <td className="p-3 mono whitespace-nowrap">{formatIsoDate(t.bookingDate)}</td>
                <td className="p-3 whitespace-nowrap" style={{ color: 'var(--text-dim)' }}>{accountName.get(t.accountId)}</td>
                <td className="p-3 max-w-48 truncate">{t.counterparty}</td>
                <td className="p-3 max-w-64 truncate hidden lg:table-cell" style={{ color: 'var(--text-dim)' }}>{t.purpose}</td>
                <td className="p-3">
                  {t.transferGroupId ? (
                    <span className="text-xs px-2 py-1 rounded whitespace-nowrap"
                      style={{ background: 'var(--surface-2)', color: 'var(--transfer)' }}>
                      {de.tx.transfer}{' '}
                      {t.amountCents < 0
                        ? de.tx.transferTo(transferPartner.get(t.id) ?? '?')
                        : de.tx.transferFrom(transferPartner.get(t.id) ?? '?')}
                    </span>
                  ) : (
                    <select className="input text-xs py-1" value={t.categoryId ?? ''}
                      onChange={(e) => onCategoryChange(t, e.target.value)}
                      style={{ minWidth: 130, borderColor: t.categoryId ? 'var(--border)' : 'var(--expense)' }}>
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
        {filtered.length === 0 && <div className="p-10 text-center" style={{ color: 'var(--text-dim)' }}>{de.tx.none}</div>}
        {filtered.length > limit && (
          <div className="p-3 text-center">
            <button className="btn text-xs" onClick={() => setLimit(limit + PAGE)}>
              {de.tx.loadMore} ({filtered.length - limit})
            </button>
          </div>
        )}
      </div>

      {bulkOpen && (
        <BulkCategorize
          txs={scopedTxs.filter((t) => !t.categoryId && !t.transferGroupId)}
          onClose={() => setBulkOpen(false)}
        />
      )}
      {rulesOpen && (
        <RulesManager onClose={() => setRulesOpen(false)} />
      )}
    </div>
  );
}

/** Groups uncategorized transactions by counterparty for one-click bulk assignment. */
function BulkCategorize({ txs, onClose }: { txs: Transaction[]; onClose: () => void }) {
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const [withRule, setWithRule] = useState(true);
  const [toast, setToast] = useState('');

  const groups = useMemo(() => {
    const byCp = new Map<string, { counterparty: string; txIds: string[]; totalCents: number }>();
    for (const t of txs) {
      const key = t.counterparty.trim().toLowerCase() || '—';
      const g = byCp.get(key) ?? { counterparty: t.counterparty.trim() || '—', txIds: [], totalCents: 0 };
      g.txIds.push(t.id);
      g.totalCents += t.amountCents;
      byCp.set(key, g);
    }
    return [...byCp.values()].sort((a, b) => b.txIds.length - a.txIds.length);
  }, [txs]);

  async function assign(group: { counterparty: string; txIds: string[] }, categoryId: string) {
    if (!categoryId) return;
    await bulkCategorize(group.txIds, categoryId);
    if (withRule && group.counterparty !== '—') {
      await addRuleAndApply({ field: 'counterparty', op: 'contains', value: group.counterparty, categoryId });
    }
    setToast(de.tx.bulkApplied(group.txIds.length));
    setTimeout(() => setToast(''), 2500);
  }

  return (
    <Modal title={de.tx.bulkTitle} onClose={onClose} wide>
      <p className="text-sm mb-3" style={{ color: 'var(--text-dim)' }}>{de.tx.bulkHint}</p>
      <label className="flex items-center gap-2 text-sm mb-4">
        <input type="checkbox" checked={withRule} onChange={(e) => setWithRule(e.target.checked)} />
        {de.tx.bulkWithRule}
      </label>
      {toast && <div className="card p-2.5 mb-3 text-sm" style={{ borderColor: 'var(--accent)' }}>{toast}</div>}
      {groups.length === 0 && <div className="py-8 text-center" style={{ color: 'var(--text-dim)' }}>{de.tx.bulkDone}</div>}
      <div className="flex flex-col">
        {groups.map((g) => (
          <div key={g.counterparty} className="flex items-center gap-3 py-2.5 text-sm"
            style={{ borderTop: '1px solid var(--border)' }}>
            <div className="flex-1 min-w-0">
              <div className="truncate font-medium">{g.counterparty}</div>
              <div className="text-xs mono" style={{ color: 'var(--text-dim)' }}>
                {g.txIds.length}× · {formatCents(g.totalCents)}
              </div>
            </div>
            <select className="input max-w-52 text-xs py-1.5" defaultValue=""
              onChange={(e) => assign(g, e.target.value)}>
              <option value="" disabled>{de.tx.bulkApply} …</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        ))}
      </div>
    </Modal>
  );
}
