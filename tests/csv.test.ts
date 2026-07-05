import { describe, expect, it } from 'vitest';
import { parseCsv, detectDelimiter } from '../src/lib/csv/parse';
import { detectAndParse } from '../src/lib/csv/profiles';

// Exact fixtures from real bank exports (anonymized structure preserved).
const C24_FIXTURE = `Transaktionstyp,Buchungsdatum,Karteneinsatz,Betrag,Zahlungsempfänger,IBAN,BIC,Verwendungszweck,Beschreibung,Kontonummer,Kontoname,Kategorie,Unterkategorie,Bargeldabhebung
SEPA-Lastschrift,02.07.2026,,"-2000,00 €",Scalable Capital,DE16120700700752814076,DEUTDEMMXXX,Scalable Capital Broker 2x savings plan,Scalable Capital GmbH,4858835001,C24 Smartkonto,Geldanlage,Kapitalanlage`;

const DKB_FIXTURE = `"Girokonto";"DE48120300001082275023"

"Kontostand vom 05.07.2026:";"1.572,41 €"
""
"Buchungsdatum";"Wertstellung";"Status";"Zahlungspflichtige*r";"Zahlungsempfänger*in";"Verwendungszweck";"Umsatztyp";"IBAN";"Betrag (€)";"Gläubiger-ID";"Mandatsreferenz";"Kundenreferenz"
"02.07.26";"02.07.26";"Gebucht";"Anselm Josek";"S. Payment Solutions GmbH";"Lidl sagt Danke DE144783060455181261 Lidl Pay";"Ausgang";"DE74600400710521470501";"-11,02";"DE18ZZZ00002700707";"1120362894/0001/00";"ZB 210171509226"`;

describe('parseCsv', () => {
  it('handles quoted fields with embedded delimiter', () => {
    const rows = parseCsv('a,"x, y",c', ',');
    expect(rows[0]).toEqual(['a', 'x, y', 'c']);
  });
  it('handles escaped quotes', () => {
    const rows = parseCsv('"say ""hi""",b', ',');
    expect(rows[0][0]).toBe('say "hi"');
  });
});

describe('detectDelimiter', () => {
  it('detects semicolon for DKB', () => expect(detectDelimiter(DKB_FIXTURE)).toBe(';'));
  it('detects comma for C24', () => expect(detectDelimiter(C24_FIXTURE)).toBe(','));
});

describe('C24 profile', () => {
  it('parses the fixture row', () => {
    const result = detectAndParse(C24_FIXTURE);
    expect(result?.profile).toBe('c24');
    expect(result?.rows).toHaveLength(1);
    const row = result!.rows[0];
    expect(row.bookingDate).toBe('2026-07-02');
    expect(row.amountCents).toBe(-200000);
    expect(row.counterparty).toBe('Scalable Capital');
    expect(row.counterpartyIban).toBe('DE16120700700752814076');
    expect(row.purpose).toBe('Scalable Capital Broker 2x savings plan');
  });
});

describe('DKB profile', () => {
  it('parses the fixture with metadata lines and extracts source IBAN', () => {
    const result = detectAndParse(DKB_FIXTURE);
    expect(result?.profile).toBe('dkb');
    expect(result?.sourceIban).toBe('DE48120300001082275023');
    expect(result?.rows).toHaveLength(1);
    const row = result!.rows[0];
    expect(row.bookingDate).toBe('2026-07-02');
    expect(row.amountCents).toBe(-1102);
    expect(row.counterparty).toBe('S. Payment Solutions GmbH');
    expect(row.purpose).toContain('Lidl');
  });
  it('skips rows that are not booked', () => {
    const pending = DKB_FIXTURE.replace('"Gebucht"', '"Vorgemerkt"');
    const result = detectAndParse(pending);
    expect(result?.rows).toHaveLength(0);
  });
});

describe('unknown format', () => {
  it('returns null so the generic mapper takes over', () => {
    expect(detectAndParse('foo;bar\n1;2')).toBeNull();
  });
});
