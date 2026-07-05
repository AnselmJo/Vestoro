import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import type { AccountType } from '../db/schema';
import { de } from '../i18n/de';
import { formatCents, formatIsoDate } from '../lib/money';
import { detectAndParse, parseGeneric, readHeaders, normalizeIban } from '../lib/csv/profiles';
import type { GenericMapping, ParseResult } from '../lib/csv/profiles';
import { detectDelimiter } from '../lib/csv/parse';
import { createAccount, importRows } from '../db/repo';
import { Modal } from '../components/ui';

const ACCOUNT_TYPES: AccountType[] = ['checking', 'savings', 'fixed_deposit', 'depot', 'cash'];

export function ImportDialog({ onClose }: { onClose: () => void }) {
  const accounts = useLiveQuery(() => db.accounts.toArray(), []) ?? [];
  const [fileText, setFileText] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [needsMapping, setNeedsMapping] = useState(false);
  const [mapping, setMapping] = useState<GenericMapping | null>(null);
  const [accountId, setAccountId] = useState<string>('');
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState<AccountType>('checking');
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const headersInfo = useMemo(() => {
    if (!fileText || !needsMapping) return null;
    const delimiter = mapping?.delimiter ?? detectDelimiter(fileText);
    return { delimiter, ...readHeaders(fileText, delimiter) };
  }, [fileText, needsMapping, mapping?.delimiter]);

  async function onFile(f: File) {
    const text = await f.text();
    setFileName(f.name);
    setFileText(text);
    const auto = detectAndParse(text);
    if (auto && auto.rows.length > 0) {
      setParsed(auto);
      setNeedsMapping(false);
      // DKB tells us the source IBAN — preselect a matching account.
      if (auto.sourceIban) {
        const match = accounts.find((a) => a.iban === auto.sourceIban);
        if (match) setAccountId(match.id);
      }
    } else {
      setParsed(null);
      setNeedsMapping(true);
      const delimiter = detectDelimiter(text);
      const { headers } = readHeaders(text, delimiter);
      setMapping({
        delimiter,
        dateCol: headers[0] ?? '',
        amountCol: headers[0] ?? '',
        counterpartyCol: headers[0] ?? '',
        purposeCol: headers[0] ?? '',
      });
    }
  }

  function applyMapping() {
    if (!fileText || !mapping) return;
    const res = parseGeneric(fileText, mapping);
    setParsed(res);
  }

  async function runImport() {
    if (!parsed || parsed.rows.length === 0) return;
    setBusy(true);
    try {
      let targetId = accountId;
      if (targetId === '__new__' || !targetId) {
        const name = newAccountName.trim() || fileName.replace(/\.csv$/i, '') || 'Neues Konto';
        const account = await createAccount(name, newAccountType, normalizeIban(parsed.sourceIban));
        targetId = account.id;
      }
      const summary = await importRows(targetId, parsed.rows);
      setResult(de.import.result(summary.imported, summary.duplicates, summary.transfers));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={de.import.title} onClose={onClose}>
      {result ? (
        <div className="flex flex-col gap-4">
          <p>{result}</p>
          <button className="btn btn-primary self-start" onClick={onClose}>{de.common.close}</button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <input
            type="file"
            accept=".csv,text/csv"
            className="input"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />

          {needsMapping && headersInfo && mapping && (
            <div className="card p-3 flex flex-col gap-2" style={{ background: 'var(--surface-2)' }}>
              <div className="text-sm font-medium">{de.import.generic}</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs" style={{ color: 'var(--text-dim)' }}>
                  {de.import.delimiter}
                  <select className="input mt-1" value={mapping.delimiter}
                    onChange={(e) => setMapping({ ...mapping, delimiter: e.target.value as ',' | ';' })}>
                    <option value=",">,</option>
                    <option value=";">;</option>
                  </select>
                </label>
                {(['dateCol', 'amountCol', 'counterpartyCol', 'purposeCol', 'ibanCol'] as const).map((key) => (
                  <label key={key} className="text-xs" style={{ color: 'var(--text-dim)' }}>
                    {key === 'dateCol' ? de.import.colDate
                      : key === 'amountCol' ? de.import.colAmount
                      : key === 'counterpartyCol' ? de.import.colCounterparty
                      : key === 'purposeCol' ? de.import.colPurpose
                      : de.import.colIban}
                    <select className="input mt-1" value={mapping[key] ?? ''}
                      onChange={(e) => setMapping({ ...mapping, [key]: e.target.value || undefined })}>
                      <option value="">—</option>
                      {headersInfo.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              <button className="btn self-start" onClick={applyMapping}>{de.import.preview}</button>
            </div>
          )}

          {parsed && (
            <>
              <div className="text-sm" style={{ color: 'var(--text-dim)' }}>
                {de.import.detected}: <span style={{ color: 'var(--text)' }}>{parsed.profile.toUpperCase()}</span>
                {' · '}{parsed.rows.length} Zeilen
              </div>
              {parsed.rows.length === 0 && <div style={{ color: 'var(--expense)' }}>{de.import.noRows}</div>}
              {parsed.rows.length > 0 && (
                <div className="overflow-auto max-h-56 card" style={{ background: 'var(--bg)' }}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ color: 'var(--text-dim)' }}>
                        <th className="text-left p-2">{de.tx.date}</th>
                        <th className="text-left p-2">{de.tx.counterparty}</th>
                        <th className="text-left p-2">{de.tx.purpose}</th>
                        <th className="text-right p-2">{de.tx.amount}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.rows.slice(0, 20).map((r, i) => (
                        <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                          <td className="p-2 mono">{formatIsoDate(r.bookingDate)}</td>
                          <td className="p-2">{r.counterparty}</td>
                          <td className="p-2 truncate max-w-56">{r.purpose}</td>
                          <td className="p-2 mono text-right" style={{ color: r.amountCents < 0 ? 'var(--expense)' : 'var(--income)' }}>
                            {formatCents(r.amountCents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <label className="text-xs" style={{ color: 'var(--text-dim)' }}>
                {de.import.targetAccount}
                <select className="input mt-1" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  <option value="">— bitte wählen —</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  <option value="__new__">{de.import.newAccount}</option>
                </select>
              </label>

              {(accountId === '__new__' || accounts.length === 0) && (
                <div className="grid grid-cols-2 gap-2">
                  <input className="input" placeholder={de.accounts.name} value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)} />
                  <select className="input" value={newAccountType}
                    onChange={(e) => setNewAccountType(e.target.value as AccountType)}>
                    {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{de.accounts.types[t]}</option>)}
                  </select>
                </div>
              )}

              <div className="flex gap-2">
                <button className="btn btn-primary" disabled={busy || parsed.rows.length === 0 || (!accountId && accounts.length > 0)}
                  onClick={runImport}>
                  {busy ? '…' : de.import.run}
                </button>
                <button className="btn" onClick={onClose}>{de.import.cancel}</button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
