import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import type { Rule, Transaction, Category } from '../db/schema';
import { Modal } from '../components/ui';
import { previewRule } from '../lib/rules';
import { addRuleAndApply, reapplyRules, updateRule, deleteRule, moveRule, updateCategory } from '../db/repo';

const PALETTE = ['#EF4444','#F97316','#F59E0B','#EAB308','#84CC16','#10B981','#06B6D4','#3B82F6','#6366F1','#8B5CF6','#EC4899','#374151'];

export function RulesManager({ onClose }: { onClose: () => void }) {
  const rules = useLiveQuery(() => db.rules.orderBy('priority').toArray(), []) ?? [];
  const txs = useLiveQuery(() => db.transactions.orderBy('bookingDate').reverse().toArray(), []) ?? [];
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editingCat, setEditingCat] = useState<Record<string, string>>({});

  const ruleMatches = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const r of rules) map.set(r.id, previewRule(r, txs).slice(0, 5));
    return map;
  }, [rules, txs]);

  async function addNewRule() {
    await addRuleAndApply({ field: 'counterparty', op: 'contains', value: '', categoryId: categories[0]?.id ?? '' });
  }

  async function toggleEnabled(r: Rule) {
    await updateRule(r.id, { enabled: r.enabled === undefined ? false : !r.enabled });
    await reapplyRules(false);
  }

  async function onDelete(r: Rule) {
    if (!confirm('Delete rule?')) return;
    await deleteRule(r.id);
    await reapplyRules(false);
  }

  async function onMarkException(rule: Rule, txId: string) {
    const exceptions = Array.isArray(rule.exceptions) ? [...rule.exceptions, txId] : [txId];
    await updateRule(rule.id, { exceptions });
    await reapplyRules(false);
  }

  async function onMove(r: Rule, dir: 'up' | 'down') {
    await moveRule(r.id, dir);
  }

  async function onRuleChange(r: Rule, patch: Partial<Rule>) {
    await updateRule(r.id, patch);
  }

  async function onCatRename(c: Category, newName: string) {
    await updateCategory(c.id, { name: newName });
  }

  async function onCatColor(c: Category, color: string) {
    await updateCategory(c.id, { color });
  }

  return (
    <Modal title="Categories & Rules" onClose={onClose} wide>
      <div className="flex gap-6">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">Regeln</h3>
            <div className="flex items-center gap-2">
              <button className="btn" onClick={addNewRule}>+ Regel hinzufügen</button>
              <button className="btn" onClick={() => reapplyRules(true)}>Reapply (overwrite)</button>
            </div>
          </div>
          <div className="card overflow-auto">
            {rules.map((r) => (
              <div key={r.id} className="p-3 border-b" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ cursor: 'grab' }}>☰</div>
                <div style={{ width: 40, textAlign: 'center' }}>{r.priority}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
                  <select value={r.field} onChange={(e) => onRuleChange(r, { field: e.target.value as any })}>
                    <option value="counterparty">counterparty</option>
                    <option value="purpose">purpose</option>
                    <option value="counterpartyIban">counterpartyIban</option>
                  </select>
                  <select value={r.op} onChange={(e) => onRuleChange(r, { op: e.target.value as any })}>
                    <option value="contains">contains</option>
                    <option value="equals">equals</option>
                    <option value="startsWith">startsWith</option>
                  </select>
                  <input className="input" value={r.value} onChange={(e) => onRuleChange(r, { value: e.target.value })} />
                  <select value={r.categoryId} onChange={(e) => onRuleChange(r, { categoryId: e.target.value })}>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="checkbox" checked={r.enabled ?? true} onChange={() => toggleEnabled(r)} />
                    Enabled
                  </label>
                  <button className="btn text-xs" onClick={() => onMove(r, 'up')}>↑</button>
                  <button className="btn text-xs" onClick={() => onMove(r, 'down')}>↓</button>
                  <button className="btn btn-danger text-xs" onClick={() => onDelete(r)}>Delete</button>
                  <button className="btn text-xs" onClick={() => setExpanded((s) => ({ ...s, [r.id]: !s[r.id] }))}>
                    {expanded[r.id] ? 'Hide' : `Captures ${previewRule(r, txs).length}`}
                  </button>
                </div>
                {expanded[r.id] && (
                  <div style={{ marginTop: 8, width: '100%' }}>
                    <div className="text-xs text-muted mb-2">First matches:</div>
                    {ruleMatches.get(r.id)?.map((t) => (
                      <div key={t.id} className="flex items-center justify-between py-1" style={{ borderTop: '1px solid var(--border)' }}>
                        <div className="truncate" style={{ maxWidth: 400 }}>{t.counterparty} · {t.bookingDate} · { (t.amountCents/100).toFixed(2) }€</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn text-xs" onClick={() => onMarkException(r, t.id)}>Mark as exception</button>
                        </div>
                      </div>
                    ))}
                    { (ruleMatches.get(r.id)?.length ?? 0) === 0 && <div className="p-2 text-sm" style={{ color: 'var(--text-dim)' }}>No matches</div> }
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ width: 320 }}>
          <h4 className="font-medium mb-2">Kategorien</h4>
          <div className="card overflow-auto p-2">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-2 border-b">
                <div style={{ width: 28, height: 20, background: c.color ?? '#ddd', borderRadius: 4 }} />
                <div style={{ flex: 1 }}>
                  <input className="input" value={editingCat[c.id] ?? c.name} onChange={(e) => setEditingCat((s) => ({ ...s, [c.id]: e.target.value }))}
                    onBlur={async (e) => { if (e.target.value !== c.name) await onCatRename(c, e.target.value); }} />
                  <div className="text-xs" style={{ color: 'var(--text-dim)' }}>{c.kind}</div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexDirection: 'column' }}>
                  {PALETTE.map((col) => (
                    <button key={col} className="p-0" title={col} style={{ width: 18, height: 18, background: col, border: col === c.color ? '2px solid var(--border)' : '1px solid rgba(0,0,0,0.06)' }}
                      onClick={() => onCatColor(c, col)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
