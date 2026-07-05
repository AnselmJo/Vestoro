import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { de } from '../i18n/de';
import { createPerson, deleteAllData, reapplyRules, clearDemoData, renamePerson, deletePerson, renameAccount, reassignAccountOwner, deleteAccount } from '../db/repo';
import { exportBackup, importBackup, downloadJson } from '../lib/backup';
import { loadDemoData } from '../lib/demo';
import { Modal } from '../components/ui';

export function Settings() {
  const persons = useLiveQuery(() => db.persons.toArray(), []) ?? [];
  const accounts = useLiveQuery(() => db.accounts.toArray(), []) ?? [];
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const rules = useLiveQuery(() => db.rules.orderBy('priority').toArray(), []) ?? [];
  const [personName, setPersonName] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [toast, setToast] = useState('');

  const say = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

  async function onExport() {
    const backup = await exportBackup();
    downloadJson(backup, `vestoro-backup-${new Date().toISOString().slice(0, 10)}.json`);
  }

  async function onImportFile(f: File) {
    try {
      const parsed = JSON.parse(await f.text());
      await importBackup(parsed);
      say(de.settings.backupRestored);
    } catch (err) {
      say(`Backup-Import fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function onLoadDemo() {
    try {
      await loadDemoData();
      say(de.settings.demoLoaded);
    } catch (err) {
      say(`Demo-Daten konnten nicht geladen werden: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const [reassignPersonId, setReassignPersonId] = useState<string | null>(null);
  const [reassignTarget, setReassignTarget] = useState<string | null>(null);
  const [renameAccountId, setRenameAccountId] = useState<string | null>(null);
  const [renameAccountValue, setRenameAccountValue] = useState('');
  const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <h2 className="text-lg font-semibold">{de.settings.title}</h2>
      {toast && <div className="card p-3 text-sm" style={{ borderColor: 'var(--accent)' }}>{toast}</div>}

      <section className="card p-4">
        <h3 className="font-medium mb-3">{de.settings.persons}</h3>
        <div className="flex flex-col gap-2 mb-3">
          {persons.map((p) => (
            <div key={p.id} className="flex items-center justify-between">
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
                  {accounts.filter((a) => a.personId === p.id).map((a) => a.name).join(' · ') || '—'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="btn" onClick={async () => {
                  const newName = window.prompt('Neuer Name', p.name);
                  if (newName) { await renamePerson(p.id, newName); setToast('Gespeichert'); }
                }}>{de.settings.rename}</button>
                <button className="btn" onClick={async () => {
                  const linked = accounts.filter((a) => a.personId === p.id);
                  if (linked.length === 0) {
                    // open simple confirm modal
                    if (confirm(`Lösche Person ${p.name}?`)) { await deletePerson(p.id); setToast('Gelöscht'); }
                    return;
                  }
                  // open reassign modal
                  setReassignPersonId(p.id);
                }}>{de.common.delete}</button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input className="input max-w-56" placeholder={de.settings.catName} value={personName}
            onChange={(e) => setPersonName(e.target.value)} />
          <button className="btn" onClick={async () => { if (personName.trim()) { await createPerson(personName.trim()); setPersonName(''); } }}>
            {de.settings.addPerson}
          </button>
        </div>
      </section>

      <section className="card p-4">
        <h3 className="font-medium mb-3">{de.settings.accounts}</h3>
        <div className="flex flex-col gap-2 mb-3">
          {accounts.map((a) => (
            <div key={a.id} className="flex items-center justify-between">
              <div>
                <div className="font-medium">{a.name}</div>
                <div className="text-xs" style={{ color: 'var(--text-dim)' }}>{de.settings.accountOwner}: {persons.find((p) => p.id === a.personId)?.name ?? '—'}</div>
              </div>
              <div className="flex items-center gap-2">
                <button className="btn" onClick={async () => {
                  setRenameAccountId(a.id); setRenameAccountValue(a.name);
                }}>{de.settings.renameAccount}</button>
                <select className="input" defaultValue={a.personId} onChange={async (e) => { await reassignAccountOwner(a.id, e.target.value); setToast('Gespeichert'); }}>
                  {persons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button className="btn" onClick={async () => { setDeleteAccountId(a.id); }}>{de.common.delete}</button>
              </div>
            </div>
          ))}
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

      {reassignPersonId && (
        <Modal title={de.settings.reassignAccounts} onClose={() => { setReassignPersonId(null); setReassignTarget(null); }}>
          <p className="mb-2">Die Person hat mehrere Konten. Wähle eine Zielperson zur Übertragung der Konten, oder Abbrechen.</p>
          <select className="input w-full mb-3" value={reassignTarget ?? ''} onChange={(e) => setReassignTarget(e.target.value || null)}>
            <option value="">— Zielperson wählen —</option>
            {persons.filter((p) => p.id !== reassignPersonId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="flex justify-end gap-2">
            <button className="btn" onClick={() => { setReassignPersonId(null); setReassignTarget(null); }}>{de.common.cancel}</button>
            <button className="btn btn-primary" onClick={async () => {
              if (!reassignTarget) return alert('Bitte Zielperson wählen');
              try {
                await deletePerson(reassignPersonId as string, reassignTarget);
                setToast('Gelöscht und Konten zugewiesen');
              } catch (e: any) { alert(e?.message ?? 'Fehler'); }
              setReassignPersonId(null); setReassignTarget(null);
            }}>{de.common.delete}</button>
          </div>
        </Modal>
      )}

      {renameAccountId && (
        <Modal title={de.settings.renameAccount} onClose={() => setRenameAccountId(null)}>
          <input className="input w-full mb-3" value={renameAccountValue} onChange={(e) => setRenameAccountValue(e.target.value)} />
          <div className="flex justify-end gap-2">
            <button className="btn" onClick={() => setRenameAccountId(null)}>{de.common.cancel}</button>
            <button className="btn btn-primary" onClick={async () => { if (!renameAccountValue) return; await renameAccount(renameAccountId as string, renameAccountValue); setToast('Gespeichert'); setRenameAccountId(null); }}>{de.common.save}</button>
          </div>
        </Modal>
      )}

      {deleteAccountId && (
        <Modal title={de.settings.deleteAccountConfirm} onClose={() => setDeleteAccountId(null)}>
          <p>Dieses Konto löschen? Diese Aktion ist nur möglich, wenn keine Transaktionen vorhanden sind.</p>
          <div className="flex justify-end gap-2">
            <button className="btn" onClick={() => setDeleteAccountId(null)}>{de.common.cancel}</button>
            <button className="btn btn-danger" onClick={async () => { try { await deleteAccount(deleteAccountId as string); setToast('Konto gelöscht'); } catch (e: any) { alert(e?.message ?? 'Fehler'); } setDeleteAccountId(null); }}>{de.common.delete}</button>
          </div>
        </Modal>
      )}

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
        <h3 className="font-medium mb-1">{de.settings.demo}</h3>
        <p className="text-sm mb-3" style={{ color: 'var(--text-dim)' }}>{de.settings.demoHint}</p>
        <div className="flex gap-2">
          <button className="btn" onClick={onLoadDemo}>{de.settings.demoLoad}</button>
          <button className="btn" onClick={async () => { await clearDemoData(); say(de.settings.demoCleared); }}>{de.settings.demoClear}</button>
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
