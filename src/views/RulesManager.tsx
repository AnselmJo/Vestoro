import { useMemo, useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import type { Rule, Transaction, Category } from '../db/schema';
import { previewRule } from '../lib/rules';
import { addRuleAndApply, reapplyRules, updateRule, deleteRule, updateCategory, reorderRules, bulkUpdateRules, bulkDeleteRules, bulkReassignRules } from '../db/repo';
import { useToast } from '../components/ui';
import { useEffect } from 'react';

const PALETTE = ['#EF4444','#F97316','#F59E0B','#EAB308','#84CC16','#10B981','#06B6D4','#3B82F6','#6366F1','#8B5CF6','#EC4899','#374151'];

export default function RulesManagerPage() {
  const rules = useLiveQuery(() => db.rules.orderBy('priority').toArray(), []) ?? [];
  const txs = useLiveQuery(() => db.transactions.orderBy('bookingDate').reverse().toArray(), []) ?? [];
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const [editingCat, setEditingCat] = useState<Record<string, string>>({});
  const [previewId, setPreviewId] = useState<string | null>(null);

  // filtering & sorting state
  const [filters, setFilters] = useState({ field: '', op: '', value: '', categoryId: '', enabled: '' });
  const [sortKey, setSortKey] = useState<'priority'|'field'|'op'|'value'|'category'|'enabled'>('priority');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc');
  // accessible focused row id for keyboard reordering
  const [focusedRow, setFocusedRow] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedRuleIds, setSelectedRuleIds] = useState<Record<string, boolean>>({});
  const toast = useToast();

  const ruleMatches = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const r of rules) map.set(r.id, previewRule(r, txs));
    return map;
  }, [rules, txs]);

  const rulesByCategory = useMemo(() => {
    const m = new Map<string, Rule[]>();
    for (const r of rules) {
      const k = r.categoryId ?? '__none__';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    return m;
  }, [rules]);

  const filtered = useMemo(() => {
    return rules.filter((r) => {
      if (filters.field && !r.field.includes(filters.field)) return false;
      if (filters.op && !r.op.includes(filters.op)) return false;
      if (filters.value && !r.value.toLowerCase().includes(filters.value.toLowerCase())) return false;
      if (filters.categoryId && r.categoryId !== filters.categoryId) return false;
      if (filters.enabled) {
        const want = filters.enabled === 'true';
        if ((r.enabled ?? true) !== want) return false;
      }
      return true;
    }).sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'priority') return (a.priority - b.priority) * dir;
      if (sortKey === 'field') return a.field.localeCompare(b.field) * dir;
      if (sortKey === 'op') return a.op.localeCompare(b.op) * dir;
      if (sortKey === 'value') return a.value.localeCompare(b.value) * dir;
      if (sortKey === 'category') {
        const an = categories.find((c) => c.id === a.categoryId)?.name ?? '';
        const bn = categories.find((c) => c.id === b.categoryId)?.name ?? '';
        return an.localeCompare(bn) * dir;
      }
      if (sortKey === 'enabled') return (Number(a.enabled ?? 1) - Number(b.enabled ?? 1)) * dir;
      return 0;
    });
  }, [rules, filters, sortKey, sortDir, categories]);

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

  // keyboard move: move focused row up/down via Ctrl+ArrowUp/ArrowDown
  async function onKeyboardMove(id: string, dir: 'up'|'down') {
    const ids = rules.map((r) => r.id);
    const idx = ids.indexOf(id);
    if (idx === -1) return;
    const to = dir === 'up' ? Math.max(0, idx - 1) : Math.min(ids.length - 1, idx + 1);
    ids.splice(idx, 1);
    ids.splice(to, 0, id);
    await reorderRules(ids);
  }

  async function onMarkException(rule: Rule, txId: string) {
    const exceptions = Array.isArray(rule.exceptions) ? [...rule.exceptions, txId] : [txId];
    await updateRule(rule.id, { exceptions });
    await reapplyRules(false);
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

  // reorder via drag/drop or priority edit
  const onReorder = useCallback(async (newOrderIds: string[]) => {
    await reorderRules(newOrderIds);
  }, []);

  function onDragStart(e: React.DragEvent, id: string) {
    e.dataTransfer.setData('text/rule-id', id);
    e.dataTransfer.effectAllowed = 'move';
  }
  function onDragOver(e: React.DragEvent) { e.preventDefault(); }
  async function onDrop(e: React.DragEvent, targetId: string | null) {
    e.preventDefault();
    const dragged = e.dataTransfer.getData('text/rule-id');
    if (!dragged) return;
    const ids = rules.map((r) => r.id);
    const from = ids.indexOf(dragged);
    if (from === -1) return;
    ids.splice(from, 1);
    if (targetId) {
      const to = ids.indexOf(targetId);
      ids.splice(to, 0, dragged);
    } else {
      ids.push(dragged);
    }
    await onReorder(ids);
  }

  async function onPriorityEdit(r: Rule, newPriority: number) {
    const ids = rules.map((x) => x.id).sort((aId, bId) => {
      const a = rules.find((r2) => r2.id === aId)!;
      const b = rules.find((r2) => r2.id === bId)!;
      return a.priority - b.priority;
    });
    const idx = ids.indexOf(r.id);
    if (idx === -1) return;
    ids.splice(idx, 1);
    const insertAt = Math.max(0, Math.min(newPriority - 1, ids.length));
    ids.splice(insertAt, 0, r.id);
    await onReorder(ids);
  }

  useEffect(() => { if (selectedCategoryId) setSelectedRuleIds({}); }, [selectedCategoryId]);

  async function bulkAction(action: 'enable'|'disable'|'delete'|'reassign', reassignTo?: string) {
    const ids = Object.keys(selectedRuleIds).filter((k) => selectedRuleIds[k]);
    if (ids.length === 0) { toast.add({ message: 'No rules selected', tone: 'info' }); return; }
    if (action === 'delete' && !confirm(`Delete ${ids.length} rules?`)) return;
    try {
      if (action === 'enable') await bulkUpdateRules(ids, { enabled: true });
      if (action === 'disable') await bulkUpdateRules(ids, { enabled: false });
      if (action === 'delete') await bulkDeleteRules(ids);
      if (action === 'reassign' && reassignTo) await bulkReassignRules(ids, reassignTo);
      await reapplyRules(false);
      toast.add({ message: `Bulk ${action} applied (${ids.length})`, tone: 'success' });
      setSelectedRuleIds({});
    } catch (e: any) {
      toast.add({ message: e?.message ?? 'Bulk action failed', tone: 'error' });
    }
  }

  return (
    <div className="flex gap-6">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold text-lg">Kategorien & Regeln</h2>
            <div className="text-xs" style={{ color: 'var(--text-dim)' }}>Manage auto-categorization rules and categories</div>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn" title="Add rule" onClick={addNewRule}>+</button>
            <button className="btn" title="Refresh rules" onClick={() => reapplyRules(true)}>⟳</button>
          </div>
        </div>

        <div className="card overflow-auto">
          <table className="w-full text-sm">
              <thead>
                <tr className="text-xs" style={{ color: 'var(--text-dim)' }}>
                  <th style={{ width: 60, textAlign: 'center', cursor: 'pointer' }} onClick={() => { setSortKey('priority'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }}># {sortKey === 'priority' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>
                  <th style={{ width: 120, cursor: 'pointer' }} onClick={() => { setSortKey('field'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }}>Field {sortKey === 'field' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>
                  <th style={{ width: 120, cursor: 'pointer' }} onClick={() => { setSortKey('op'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }}>Op {sortKey === 'op' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>
                  <th>Value {sortKey === 'value' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>
                  <th style={{ width: 180, cursor: 'pointer' }} onClick={() => { setSortKey('category'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }}>Category {sortKey === 'category' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>
                  <th style={{ width: 90, cursor: 'pointer' }} onClick={() => { setSortKey('enabled'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }}>Enabled {sortKey === 'enabled' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>
                  <th style={{ width: 220 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" onChange={(e) => {
                      const checked = e.target.checked; const visible = filtered.map((r) => r.id); const next: Record<string, boolean> = {};
                      for (const id of visible) next[id] = checked; setSelectedRuleIds(next);
                    }} /> Actions</div></th>
                </tr>
                <tr>
                  <th />
                  <th><input className="input" placeholder="filter" value={filters.field} onChange={(e) => setFilters((s) => ({ ...s, field: e.target.value }))} /></th>
                  <th><input className="input" placeholder="filter" value={filters.op} onChange={(e) => setFilters((s) => ({ ...s, op: e.target.value }))} /></th>
                  <th><input className="input" placeholder="filter" value={filters.value} onChange={(e) => setFilters((s) => ({ ...s, value: e.target.value }))} /></th>
                  <th>
                    <select className="input" value={filters.categoryId} onChange={(e) => setFilters((s) => ({ ...s, categoryId: e.target.value }))}>
                      <option value="">(any)</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </th>
                  <th>
                    <select className="input" value={filters.enabled} onChange={(e) => setFilters((s) => ({ ...s, enabled: e.target.value }))}>
                      <option value="">(any)</option>
                      <option value="true">enabled</option>
                      <option value="false">disabled</option>
                    </select>
                  </th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}
                    tabIndex={0}
                    onFocus={() => setFocusedRow(r.id)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowUp') { e.preventDefault(); onKeyboardMove(r.id, 'up'); }
                      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowDown') { e.preventDefault(); onKeyboardMove(r.id, 'down'); }
                      if (e.key === 'Enter') { e.preventDefault(); setPreviewId(previewId === r.id ? null : r.id); }
                    }}
                    draggable
                    onDragStart={(e) => onDragStart(e, r.id)} onDragOver={onDragOver} onDrop={(e) => onDrop(e, r.id)}
                    style={{ borderTop: '1px solid var(--border)' }}
                    aria-selected={focusedRow === r.id}
                  >
                    <td className="p-3 text-center">
                      <input className="input" style={{ width: 48, textAlign: 'center' }} type="number" defaultValue={r.priority} onBlur={(e) => onPriorityEdit(r, Number(e.target.value))} />
                    </td>
                    <td className="p-3">
                      <select value={r.field} onChange={(e) => onRuleChange(r, { field: e.target.value as any })}>
                        <option value="counterparty">counterparty</option>
                        <option value="purpose">purpose</option>
                        <option value="counterpartyIban">counterpartyIban</option>
                      </select>
                    </td>
                    <td className="p-3">
                      <select value={r.op} onChange={(e) => onRuleChange(r, { op: e.target.value as any })}>
                        <option value="contains">contains</option>
                        <option value="equals">equals</option>
                        <option value="startsWith">startsWith</option>
                      </select>
                    </td>
                    <td className="p-3"><input className="input" value={r.value} onChange={(e) => onRuleChange(r, { value: e.target.value })} /></td>
                    <td className="p-3">
                      <select value={r.categoryId} onChange={(e) => onRuleChange(r, { categoryId: e.target.value })}>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </td>
                    <td className="p-3 text-center"><input type="checkbox" checked={r.enabled ?? true} onChange={() => toggleEnabled(r)} /></td>
                    <td className="p-3">
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input type="checkbox" checked={!!selectedRuleIds[r.id]} onChange={(e) => setSelectedRuleIds((s) => ({ ...s, [r.id]: e.target.checked }))} />
                        <button className="btn btn-ghost" aria-label="Delete rule" title="Delete rule" onClick={() => onDelete(r)}>🗑</button>
                        <button className="btn" aria-pressed={previewId === r.id} onClick={() => setPreviewId(previewId === r.id ? null : r.id)}>{`Captures ${ruleMatches.get(r.id)?.length ?? 0}`}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ width: 320 }}>
          <h4 className="font-medium mb-2">Kategorien</h4>
          <div className="card overflow-auto p-2">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-2 border-b" style={{ background: selectedCategoryId === c.id ? 'var(--surface-2)' : undefined, cursor: 'pointer' }} onClick={() => setSelectedCategoryId(c.id)}>
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
                  <input className="input" type="color" value={c.color ?? '#000000'} onChange={(e) => onCatColor(c, e.target.value)} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ width: 360 }}>
          <h4 className="font-medium mb-2">Category Rules</h4>
          <div className="card overflow-auto p-2 mb-3">
            {selectedCategoryId ? (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <button className="btn" onClick={() => bulkAction('enable')}>Activate</button>
                  <button className="btn" onClick={() => bulkAction('disable')}>Deactivate</button>
                  <button className="btn btn-danger" onClick={() => bulkAction('delete')}>Delete</button>
                  <select className="input" onChange={(e) => bulkAction('reassign', e.target.value)} defaultValue="">
                    <option value="">Reassign to...</option>
                    {categories.filter((c)=>c.id !== selectedCategoryId).map((c)=> <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="text-xs text-muted mb-2">Rules for: {categories.find((c) => c.id === selectedCategoryId)?.name}</div>
                <div>
                  {(rulesByCategory.get(selectedCategoryId) ?? []).map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-2 border-b">
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input type="checkbox" checked={!!selectedRuleIds[r.id]} onChange={(e)=> setSelectedRuleIds((s)=>({ ...s, [r.id]: e.target.checked }))} />
                        <div>{r.field} {r.op} "{r.value}"</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <div className="text-xs">#{r.priority}</div>
                        <button className="btn" onClick={() => toggleEnabled(r)}>{(r.enabled ?? true) ? 'Disable' : 'Enable'}</button>
                        <button className="btn btn-ghost" onClick={() => onDelete(r)}>🗑</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-xs" style={{ color: 'var(--text-dim)' }}>Select a category to manage its rules and perform bulk actions.</div>
            )}
          </div>

          {previewId ? (
            <div className="card p-2">
              <div className="flex items-center justify-between mb-2">
                <strong>Matches ({ruleMatches.get(previewId)?.length ?? 0})</strong>
                <button className="btn btn-ghost" onClick={() => setPreviewId(null)}>✕</button>
              </div>
              <div style={{ maxHeight: 300, overflow: 'auto' }}>
                <table className="w-full text-sm">
                  <thead><tr className="text-xs" style={{ color: 'var(--text-dim)' }}><th className="p-2">Datum</th><th className="p-2">Empfänger</th><th className="p-2">Betrag</th><th className="p-2">Aktion</th></tr></thead>
                  <tbody>
                    {(ruleMatches.get(previewId) ?? []).slice(0, 20).map((t) => (
                      <tr key={t.id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td className="p-2 mono">{t.bookingDate}</td>
                        <td className="p-2 truncate">{t.counterparty}</td>
                        <td className="p-2 mono">{(t.amountCents/100).toFixed(2)}€</td>
                        <td className="p-2"><button className="btn text-xs" onClick={() => { const r = rules.find((x) => x.id === previewId); if (r) onMarkException(r, t.id); }}>Mark as exception</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="text-xs mt-3">Legend</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {categories.map((c) => (
                  <div key={c.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <div style={{ width: 14, height: 12, background: c.color ?? '#ddd', borderRadius: 3 }} />
                    <div style={{ fontSize: 12 }}>{c.name}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-xs" style={{ color: 'var(--text-dim)' }}>Select a rule to preview matching transactions and mark exceptions.</div>
          )}
        </div>
      </div>
    );
  }
