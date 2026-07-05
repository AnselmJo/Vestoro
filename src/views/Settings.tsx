import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import type { CategoryKind } from '../db/schema';
import { de } from '../i18n/de';
import { addCategory, deleteCategory, deleteAllData, reapplyRules, clearDemoData } from '../db/repo';
import { exportBackup, importBackup, downloadJson } from '../lib/backup';
import { loadDemoData } from '../lib/demo';

export function Settings() {
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const rules = useLiveQuery(() => db.rules.orderBy('priority').toArray(), []) ?? [];
  const [catName, setCatName] = useState('');
  const [catKind, setCatKind] = useState<CategoryKind>('expense');
  const [confirmText, setConfirmText] = useState('');
  const [toast, setToast] = useState('');

  const say = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

  async function onExport() {
    const backup = await exportBackup();
    downloadJson(backup, `vestoro-backup-${new Date().toISOString().slice(0, 10)}.json`);
  }

  async function onImportFile(f: File) {
    const parsed = JSON.parse(await f.text());
    await importBackup(parsed);
    say(de.settings.backupRestored);
  }

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <h2 className="text-lg font-semibold">{de.settings.title}</h2>
      {toast && <div className="card p-3 text-sm" style={{ borderColor: 'var(--accent)' }}>{toast}</div>}

      <section className="card p-4">
        <h3 className="font-medium mb-3">{de.settings.categories}</h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {categories.map((c) => (
            <span key={c.id} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
              style={{ background: 'var(--surface-2)', color: c.kind === 'income' ? 'var(--income)' : 'var(--text)' }}>
              {c.name}
              <button className="cursor-pointer" style={{ color: 'var(--text-dim)' }}
                title={de.common.delete} onClick={() => deleteCategory(c.id)}>✕</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input className="input max-w-56" placeholder={de.settings.catName} value={catName}
            onChange={(e) => setCatName(e.target.value)} />
          <select className="input max-w-36" value={catKind} onChange={(e) => setCatKind(e.target.value as CategoryKind)}>
            <option value="expense">{de.settings.catKindExpense}</option>
            <option value="income">{de.settings.catKindIncome}</option>
          </select>
          <button className="btn" onClick={async () => { if (catName.trim()) { await addCategory(catName.trim(), catKind); setCatName(''); } }}>
            {de.settings.addCategory}
          </button>
        </div>
      </section>

      <section className="card p-4">
        <h3 className="font-medium mb-3">{de.settings.rules}</h3>
        {rules.length === 0 && <p className="text-sm" style={{ color: 'var(--text-dim)' }}>{de.settings.noRules}</p>}
        {rules.map((r) => (
          <div key={r.id} className="flex items-center gap-2 text-sm py-1.5" style={{ borderTop: '1px solid var(--border)' }}>
            <span className="mono text-xs" style={{ color: 'var(--text-dim)' }}>#{r.priority}</span>
            <span className="flex-1">
              {r.field === 'counterparty' ? de.tx.counterparty : r.field === 'purpose' ? de.tx.purpose : 'IBAN'}
              {' '}{r.op === 'contains' ? 'enthält' : r.op === 'equals' ? 'ist' : 'beginnt mit'}{' '}
              „{r.value}“ → {categories.find((c) => c.id === r.categoryId)?.name ?? '?'}
            </span>
            <button className="btn text-xs" onClick={() => db.rules.delete(r.id)}>{de.common.delete}</button>
          </div>
        ))}
        {rules.length > 0 && (
          <button className="btn mt-3" onClick={async () => say(de.settings.rulesApplied(await reapplyRules(false)))}>
            {de.settings.applyRules}
          </button>
        )}
      </section>

      <section className="card p-4">
        <h3 className="font-medium mb-1">{de.settings.backup}</h3>
        <p className="text-sm mb-3" style={{ color: 'var(--text-dim)' }}>{de.settings.backupHint}</p>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={onExport}>{de.settings.exportJson}</button>
          <label className="btn cursor-pointer">
            {de.settings.importJson}
            <input type="file" accept="application/json" className="hidden"
              onChange={(e) => e.target.files?.[0] && onImportFile(e.target.files[0])} />
          </label>
        </div>
      </section>

      <section className="card p-4">
        <h3 className="font-medium mb-3">{de.settings.demo}</h3>
        <div className="flex gap-2">
          <button className="btn" onClick={() => loadDemoData()}>{de.settings.demoLoad}</button>
          <button className="btn" onClick={() => clearDemoData()}>{de.settings.demoClear}</button>
        </div>
      </section>

      <section className="card p-4" style={{ borderColor: 'var(--expense)' }}>
        <h3 className="font-medium mb-2" style={{ color: 'var(--expense)' }}>{de.settings.danger}</h3>
        <p className="text-sm mb-2" style={{ color: 'var(--text-dim)' }}>{de.settings.deleteConfirm}</p>
        <div className="flex gap-2">
          <input className="input max-w-40" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
          <button className="btn btn-danger" disabled={confirmText !== 'LÖSCHEN'}
            onClick={async () => { await deleteAllData(); setConfirmText(''); say(de.settings.deleted); }}>
            {de.settings.deleteAll}
          </button>
        </div>
      </section>
    </div>
  );
}
