import { parseCsv, detectDelimiter } from './parse';
import { parseGermanAmount, parseGermanDate } from '../money';

/** A parsed, bank-agnostic transaction row ready for import. */
export interface ParsedRow {
  bookingDate: string; // ISO
  amountCents: number;
  counterparty: string;
  counterpartyIban?: string;
  purpose: string;
  raw: Record<string, string>;
}

export interface ParseResult {
  profile: 'c24' | 'dkb' | 'generic';
  rows: ParsedRow[];
  /** IBAN of the source account if the file states it (DKB does). */
  sourceIban?: string;
  /** Balance stated in the export header (DKB: "Kontostand vom DD.MM.YYYY"). */
  sourceBalanceCents?: number;
  sourceBalanceDate?: string; // ISO
  headers: string[];
}

export interface GenericMapping {
  delimiter: ',' | ';';
  dateCol: string;
  amountCol: string;
  counterpartyCol: string;
  purposeCol: string;
  ibanCol?: string;
}

function toRecord(headers: string[], cells: string[]): Record<string, string> {
  const rec: Record<string, string> = {};
  headers.forEach((h, i) => { rec[h] = (cells[i] ?? '').trim(); });
  return rec;
}

// ---------- C24 ----------
// Header: Transaktionstyp,Buchungsdatum,Karteneinsatz,Betrag,Zahlungsempfänger,IBAN,BIC,
//         Verwendungszweck,Beschreibung,Kontonummer,Kontoname,Kategorie,Unterkategorie,Bargeldabhebung
export function isC24(headers: string[]): boolean {
  return headers.includes('Transaktionstyp') && headers.includes('Karteneinsatz');
}

function parseC24(rows: string[][]): ParseResult {
  const headers = rows[0].map((h) => h.trim());
  const out: ParsedRow[] = [];
  for (const cells of rows.slice(1)) {
    const rec = toRecord(headers, cells);
    const date = parseGermanDate(rec['Buchungsdatum'] ?? '');
    const amount = parseGermanAmount(rec['Betrag'] ?? '');
    if (date === null || amount === null) continue;
    out.push({
      bookingDate: date,
      amountCents: amount,
      counterparty: rec['Zahlungsempfänger'] || rec['Beschreibung'] || '',
      counterpartyIban: normalizeIban(rec['IBAN']),
      purpose: rec['Verwendungszweck'] ?? '',
      raw: rec,
    });
  }
  return { profile: 'c24', rows: out, headers };
}

// ---------- DKB ----------
// 4 metadata lines, then quoted ;-separated header containing "Zahlungspflichtige*r".
export function isDkb(rows: string[][]): number {
  // Returns the header row index, or -1.
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    if (rows[i].some((c) => c.trim() === 'Zahlungspflichtige*r')) return i;
  }
  return -1;
}

function parseDkb(rows: string[][], headerIdx: number): ParseResult {
  const headers = rows[headerIdx].map((h) => h.trim());
  let sourceIban: string | undefined;
  let sourceBalanceCents: number | undefined;
  let sourceBalanceDate: string | undefined;
  const first = rows[0];
  if (first && first.length >= 2 && /^[A-Z]{2}\d/.test(first[1]?.trim() ?? '')) {
    sourceIban = normalizeIban(first[1]);
  }
  // Metadata line: "Kontostand vom 05.07.2026:";"1.572,41 €"
  for (const r of rows.slice(0, headerIdx)) {
    const label = r[0]?.trim() ?? '';
    const m = label.match(/Kontostand vom (\d{2}\.\d{2}\.\d{4})/);
    if (m && r[1]) {
      const cents = parseGermanAmount(r[1]);
      const iso = parseGermanDate(m[1]);
      if (cents !== null && iso !== null) { sourceBalanceCents = cents; sourceBalanceDate = iso; }
    }
  }
  const out: ParsedRow[] = [];
  for (const cells of rows.slice(headerIdx + 1)) {
    const rec = toRecord(headers, cells);
    if ((rec['Status'] ?? 'Gebucht') !== 'Gebucht') continue;
    const date = parseGermanDate(rec['Buchungsdatum'] ?? '');
    const amount = parseGermanAmount(rec['Betrag (€)'] ?? rec['Betrag'] ?? '');
    if (date === null || amount === null) continue;
    const counterparty =
      amount < 0
        ? rec['Zahlungsempfänger*in'] || rec['Zahlungspflichtige*r'] || ''
        : rec['Zahlungspflichtige*r'] || rec['Zahlungsempfänger*in'] || '';
    out.push({
      bookingDate: date,
      amountCents: amount,
      counterparty,
      counterpartyIban: normalizeIban(rec['IBAN']),
      purpose: rec['Verwendungszweck'] ?? '',
      raw: rec,
    });
  }
  return { profile: 'dkb', rows: out, headers, sourceIban, sourceBalanceCents, sourceBalanceDate };
}

// ---------- generic ----------
export function parseGeneric(text: string, mapping: GenericMapping): ParseResult {
  const rows = parseCsv(text, mapping.delimiter);
  const headers = rows[0].map((h) => h.trim());
  const out: ParsedRow[] = [];
  for (const cells of rows.slice(1)) {
    const rec = toRecord(headers, cells);
    const date = parseGermanDate(rec[mapping.dateCol] ?? '');
    const amount = parseGermanAmount(rec[mapping.amountCol] ?? '');
    if (date === null || amount === null) continue;
    out.push({
      bookingDate: date,
      amountCents: amount,
      counterparty: rec[mapping.counterpartyCol] ?? '',
      counterpartyIban: mapping.ibanCol ? normalizeIban(rec[mapping.ibanCol]) : undefined,
      purpose: rec[mapping.purposeCol] ?? '',
      raw: rec,
    });
  }
  return { profile: 'generic', rows: out, headers };
}

/** Auto-detect C24/DKB. Returns null when the format is unknown (→ generic mapper UI). */
export function detectAndParse(text: string): ParseResult | null {
  const delimiter = detectDelimiter(text);
  const rows = parseCsv(text, delimiter);
  if (rows.length < 2) return null;
  const dkbHeader = isDkb(rows);
  if (dkbHeader >= 0) return parseDkb(rows, dkbHeader);
  if (isC24(rows[0].map((h) => h.trim()))) return parseC24(rows);
  return null;
}

/** For the generic mapper UI: headers + a few raw preview rows. */
export function readHeaders(text: string, delimiter: ',' | ';'): { headers: string[]; preview: string[][] } {
  const rows = parseCsv(text, delimiter);
  return { headers: rows[0]?.map((h) => h.trim()) ?? [], preview: rows.slice(1, 6) };
}

export function normalizeIban(raw?: string): string | undefined {
  if (!raw) return undefined;
  const s = raw.replace(/\s/g, '').toUpperCase();
  return /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s) ? s : undefined;
}
