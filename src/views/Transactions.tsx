import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import type { Transaction } from '../db/schema';
import { de } from '../i18n/de';
import { currentMonthKey, formatCents, monthLabel, shiftMonth } from '../lib/money';
import { addRuleAndApply, bulkCategorize, setCategory, bulkCategorizeByCounterparty, saveUndoEntry, restoreUndoEntry, logAudit } from '../db/repo';
import { Modal, useToast } from '../components/ui';
// RulesManager is now a separate page; navigate via global event
import TransactionRow from '../components/TransactionRow';
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
  const [categorizeOpen, setCategorizeOpen] = useState<Transaction | null>(null);
  const [categorizeCreateRule, setCategorizeCreateRule] = useState(true);
  const [categorizeCategory, setCategorizeCategory] = useState<string>('');
  const [confirmBulk, setConfirmBulk] = useState<{ counterparty: string; categoryId: string; matches: number; createRule: boolean } | null>(null);
  // rulesOpen modal removed; rules are managed on their own page

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

  const toast = useToast();

  async function onCategoryChange(tx: Transaction, categoryId: string) {
    try {
      await setCategory(tx.id, categoryId || undefined);
      if (categoryId && tx.counterparty.trim()) setRulePrompt({ tx, categoryId });
      toast.add({ message: de.tx.bulkApplied(1), tone: 'success' });
    } catch (err: any) {
      toast.add({ message: err instanceof Error ? err.message : String(err), tone: 'error' });
    }
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
          <button className="btn" onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'rules' }))}>{de.tx.rulesButton}</button>
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
              <TransactionRow key={t.id} t={t} accountName={accountName} categories={categories} transferPartner={transferPartner} onCategoryChange={onCategoryChange} colorTransfersBySign={scope.accountIds.length === 1} currentAccountId={scope.accountIds.length === 1 ? scope.accountIds[0] : undefined} onOpenCategorize={(tx) => { setCategorizeOpen(tx); setCategorizeCategory(tx.categoryId ?? ''); }} />
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

      {(() => {
        const categorizeMatches = categorizeOpen ? allTxs.filter((t) => (t.counterparty || '').trim().toLowerCase() === (categorizeOpen.counterparty || '').trim().toLowerCase()).length : 0;
        return categorizeOpen && (
        <Modal title={de.tx.categorizeTitle} onClose={() => setCategorizeOpen(null)} wide>
          <div className="mb-3">
            <div className="text-sm font-medium">{categorizeOpen.counterparty || '—'}</div>
            <div className="text-xs" style={{ color: 'var(--text-dim)' }}>{categorizeOpen.purpose}</div>
          </div>
          <div className="mb-3">
            <select className="input w-full" value={categorizeCategory} onChange={(e) => setCategorizeCategory(e.target.value)}>
              <option value="">{de.tx.categorizeSelect}</option>
              {categories.filter((c) => c.kind === (categorizeOpen.amountCents > 0 ? 'income' : 'expense')).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 mb-4">
            <input type="checkbox" checked={categorizeCreateRule} onChange={(e) => setCategorizeCreateRule(e.target.checked)} />
            {de.tx.categorizeCreateRule}
          </label>
          <div className="flex gap-2 justify-end">
            <button className="btn" onClick={() => setCategorizeOpen(null)}>{de.tx.categorizeCancel}</button>
            <button className="btn btn-outline" onClick={async () => {
              if (!categorizeCategory || !categorizeOpen) return;
              await onCategoryChange(categorizeOpen, categorizeCategory);
              setCategorizeOpen(null);
            }}>{de.tx.categorizeThis}</button>
            <button className="btn btn-primary" onClick={async () => {
            if (!categorizeCategory || !categorizeOpen) return;
            // if >100 matches, ask for confirmation
            if (categorizeMatches > 100) { setConfirmBulk({ counterparty: categorizeOpen.counterparty, categoryId: categorizeCategory, matches: categorizeMatches, createRule: categorizeCreateRule }); return; }
            try {
              const res = await bulkCategorizeByCounterparty(categorizeOpen.counterparty, categorizeCategory, { createRule: categorizeCreateRule });
              // persist undo and audit
              const undoId = await saveUndoEntry(res.prevs, `Bulk categorize ${categorizeOpen.counterparty}`);
              await logAudit('bulkCategorizeByCounterparty', { counterparty: categorizeOpen.counterparty, categoryId: categorizeCategory, matched: res.updated, undoId });
              toast.add({ message: de.tx.bulkApplied(res.updated), tone: 'success', action: { label: de.tx.undo, onClick: async () => { try { await restoreUndoEntry(undoId); toast.add({ message: de.tx.undoDone, tone: 'info' }); } catch (e) { /* ignore */ } } } });
            } catch (e: any) {
              toast.add({ message: e?.message ?? 'Fehler', tone: 'error' });
            }
            setCategorizeOpen(null);
            }}>{de.tx.categorizeAllFrom(categorizeMatches)}</button>
          </div>
        </Modal>
      )})()}

    {confirmBulk && (
      <Modal title={de.tx.confirmBulkTitle} onClose={() => setConfirmBulk(null)}>
        <p className="mb-4">{de.tx.confirmBulkBody(confirmBulk.matches)}</p>
        <div className="flex justify-end gap-2">
          <button className="btn" onClick={() => setConfirmBulk(null)}>{de.common.cancel}</button>
          <button className="btn btn-primary" onClick={async () => {
            try {
              const res = await bulkCategorizeByCounterparty(confirmBulk.counterparty, confirmBulk.categoryId, { createRule: confirmBulk.createRule });
              const undoId = await saveUndoEntry(res.prevs, `Bulk categorize ${confirmBulk.counterparty}`);
              await logAudit('bulkCategorizeByCounterparty', { counterparty: confirmBulk.counterparty, categoryId: confirmBulk.categoryId, matched: res.updated, undoId });
              toast.add({ message: de.tx.bulkApplied(res.updated), tone: 'success', action: { label: de.tx.undo, onClick: async () => { try { await restoreUndoEntry(undoId); toast.add({ message: de.tx.undoDone, tone: 'info' }); } catch (e) { /* ignore */ } } } });
            } catch (e: any) {
              toast.add({ message: e?.message ?? 'Fehler', tone: 'error' });
            }
            setConfirmBulk(null);
            setCategorizeOpen(null);
          }}>{de.common.save}</button>
        </div>
      </Modal>
    )}

    </div>
  );
}

/** Groups uncategorized transactions by counterparty for one-click bulk assignment. */
function BulkCategorize({ txs, onClose }: { txs: Transaction[]; onClose: () => void }) {
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const [withRule, setWithRule] = useState(true);
  const toast = useToast();

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

  async function assign(group: { counterparty: string; txIds: string[]; totalCents: number }, categoryId: string) {
    if (!categoryId) return;
    // Validate category kind client-side: choose by group's net sign
    const signKind: 'income' | 'expense' = group.totalCents > 0 ? 'income' : 'expense';
    const cat = (await db.categories.get(categoryId));
    if (!cat) return;
    if (cat.kind !== signKind) {
      toast.add({ message: 'Kategorie passt nicht zur Gruppe (Einnahme/Ausgabe)', tone: 'error' });
      return;
    }
    if (group.counterparty !== '—') {
      const res = await bulkCategorizeByCounterparty(group.counterparty, categoryId, { createRule: withRule });
      const undoId = await saveUndoEntry(res.prevs, `Bulk categorize ${group.counterparty}`);
      await logAudit('bulkCategorizeByCounterparty', { counterparty: group.counterparty, categoryId, matched: res.updated, undoId });
      toast.add({ message: de.tx.bulkApplied(res.updated), tone: 'success', action: { label: de.tx.undo, onClick: async () => { try { await restoreUndoEntry(undoId); toast.add({ message: de.tx.undoDone, tone: 'info' }); } catch (e) { /* ignore */ } } } });
    } else {
      await bulkCategorize(group.txIds, categoryId);
      toast.add({ message: de.tx.bulkApplied(group.txIds.length), tone: 'success' });
    }
  }

  return (
    <Modal title={de.tx.bulkTitle} onClose={onClose} wide>
      <p className="text-sm mb-3" style={{ color: 'var(--text-dim)' }}>{de.tx.bulkHint}</p>
      <label className="flex items-center gap-2 text-sm mb-4">
        <input type="checkbox" checked={withRule} onChange={(e) => setWithRule(e.target.checked)} />
        {de.tx.bulkWithRule}
      </label>
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
              {categories.filter((c) => c.kind === (g.totalCents > 0 ? 'income' : 'expense')).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        ))}
      </div>
    </Modal>
  );
}
