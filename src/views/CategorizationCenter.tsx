import { useMemo, useState } from 'react';
import { Modal } from '../components/ui';
import { db } from '../db/schema';
import { useLiveQuery } from 'dexie-react-hooks';
import { formatCents, monthLabel } from '../lib/money';
import { bulkCategorizeByCounterparty, saveUndoEntry, logAudit } from '../db/repo';
import { useToast } from '../components/ui';
import { de } from '../i18n/de';
import Typeahead from '../components/Typeahead';

export default function CategorizationCenter({ onClose }: { onClose: () => void }) {
  const txs = useLiveQuery(() => db.transactions.toArray(), []) ?? [];
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const toast = useToast();

  // Quick-assign groups similar to previous BulkCategorize
  const groups = useMemo(() => {
    const byCp = new Map<string, { counterparty: string; txIds: string[]; totalCents: number; months: Set<string> }>();
    for (const t of txs) {
      if (t.categoryId || t.transferGroupId) continue;
      const key = (t.counterparty || '').trim().toLowerCase() || '—';
      const g = byCp.get(key) ?? { counterparty: t.counterparty || '—', txIds: [], totalCents: 0, months: new Set<string>() };
      g.txIds.push(t.id);
      g.totalCents += t.amountCents;
      g.months.add(t.bookingDate.slice(0,7));
      byCp.set(key, g);
    }
    return [...byCp.values()].sort((a,b) => b.txIds.length - a.txIds.length);
  }, [txs]);

  const [activeTab, setActiveTab] = useState<'quick'|'rules'|'progress'>('quick');
  const [previews, setPreviews] = useState<Record<string, boolean>>({});

  async function assignGroup(group: { counterparty: string; txIds: string[]; totalCents: number }, categoryId: string) {
    if (!categoryId) return;
    try {
      const res = await bulkCategorizeByCounterparty(group.counterparty, categoryId, { createRule: true });
      const undoId = await saveUndoEntry(res.prevs, `Bulk categorize ${group.counterparty}`);
      await logAudit('bulkCategorizeByCounterparty', { counterparty: group.counterparty, matched: res.updated, undoId });
      toast.add({ message: de.tx.bulkApplied(res.updated), tone: 'success' });
    } catch (e: any) {
      toast.add({ message: e?.message ?? 'Fehler', tone: 'error' });
    }
  }

  // Progress: grouped by month
  const progress = useMemo(() => {
    const byMonth = new Map<string, { total: number; categorized: number }>();
    for (const t of txs) {
      const m = t.bookingDate.slice(0,7);
      const cur = byMonth.get(m) ?? { total: 0, categorized: 0 };
      cur.total += Math.abs(t.amountCents);
      if (t.categoryId) cur.categorized += Math.abs(t.amountCents);
      byMonth.set(m, cur);
    }
    return [...byMonth.entries()].sort((a,b) => a[0] < b[0] ? 1 : -1).map(([k,v]) => ({ month: k, pct: v.total ? Math.round((v.categorized / v.total) * 100) : 0, total: v.total, categorized: v.categorized }));
  }, [txs]);

  return (
    <Modal title="Kategorisierungs-Zentrale" onClose={onClose} wide>
      <div className="flex gap-3 mb-4">
        <button className={activeTab === 'quick' ? 'btn btn-primary' : 'btn'} onClick={() => setActiveTab('quick')}>Quick Assign</button>
        <button className={activeTab === 'rules' ? 'btn btn-primary' : 'btn'} onClick={() => setActiveTab('rules')}>Improve Rules</button>
        <button className={activeTab === 'progress' ? 'btn btn-primary' : 'btn'} onClick={() => setActiveTab('progress')}>Progress</button>
      </div>

      {activeTab === 'quick' && (
        <div>
          <p className="text-sm mb-3" style={{ color: 'var(--text-dim)' }}>{de.tx.bulkHint}</p>
          <div className="flex flex-col">
            {groups.map((g) => (
              <div key={g.counterparty + g.txIds.length} className="flex flex-col gap-2 py-2.5" style={{ borderTop: '1px solid var(--border)' }}>
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="truncate font-medium">{g.counterparty}</div>
                      <button className="btn btn-ghost btn-xs" onClick={() => setPreviews((p) => ({...p, [g.counterparty]: !p[g.counterparty]}))}>{previews[g.counterparty] ? 'Hide' : `Preview (${Math.min(5, g.txIds.length)})`}</button>
                    </div>
                    <div className="text-xs mono" style={{ color: 'var(--text-dim)' }}>{g.txIds.length}× · {formatCents(g.totalCents)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Typeahead
                      fetchOptions={async (q) => {
                        const ql = q.trim().toLowerCase();
                        const filtered = categories.filter((c) => c.kind === (g.totalCents > 0 ? 'income' : 'expense'))
                          .filter((c) => !ql || c.name.toLowerCase().includes(ql))
                          .slice(0, 50)
                          .map((c) => ({ id: c.id, label: c.name, meta: c.kind, color: c.color }));
                        return Promise.resolve(filtered);
                      }}
                      onSelect={async (opt) => { await assignGroup(g, opt.id); }}
                      placeholder={de.tx.bulkApply}
                    />
                    <button className="btn btn-ghost btn-xs" onClick={() => assignGroup(g, '')}>Apply...</button>
                  </div>
                </div>
                {previews[g.counterparty] && (
                  <div className="ml-4">
                    <div className="text-xs mb-1" style={{ color: 'var(--text-dim)' }}>Erste {Math.min(5, g.txIds.length)} Transaktionen</div>
                    <div className="grid grid-cols-1 gap-1 text-sm">
                      {g.txIds.slice(0,5).map((id) => {
                        const t = txs.find((x) => x.id === id);
                        if (!t) return null;
                        return (
                          <div key={id} className="flex items-center justify-between p-1 rounded hover:bg-surface-2">
                            <div className="truncate">{t.counterparty || t.purpose || '—'}</div>
                            <div className="mono text-xs" style={{ color: 'var(--text-dim)' }}>{formatCents(t.amountCents)} · {t.bookingDate}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'rules' && (
        <div>
          <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Manage and improve auto-categorization rules.</p>
          <div className="mt-3">
            <button className="btn" onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'rules' }))}>Zu Regeln</button>
          </div>
        </div>
      )}

      {activeTab === 'progress' && (
        <div>
          <div className="grid grid-cols-1 gap-2">
            {progress.map((p) => (
              <div key={p.month} className="flex items-center gap-3">
                <div style={{ width: 140 }}>{monthLabel(p.month + '-01')}</div>
                <div style={{ flex: 1, background: 'var(--surface-2)', height: 12, borderRadius: 6 }}>
                  <div style={{ width: `${p.pct}%`, background: 'var(--accent)', height: 12, borderRadius: 6 }} />
                </div>
                <div style={{ width: 56, textAlign: 'right' }}>{p.pct}%</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
