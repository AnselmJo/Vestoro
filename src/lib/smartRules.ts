// Smart rule suggestions based on purpose/memo regex patterns.
// Export suggestCategoryFromPurpose that returns a category NAME or null.

const PATTERNS: Array<{ name: string; pattern: string }> = [
  { name: 'Wohnen', pattern: '\\bmiet(e|en)?\\b' },
  { name: 'Wohnen', pattern: '\\bnebenkosten\\b' },
  { name: 'Gehalt', pattern: '\\b(gehalt|lohn)\\b' },
  { name: 'Kinder', pattern: '\\b(kindergeld|kinder)\\b' },
  { name: 'Einnahmen', pattern: '\\brente\\b' },
  { name: 'Einnahmen', pattern: '\\b(dividende)s?\\b' },
  { name: 'Einnahmen', pattern: '\\bzin(s|sen)?\\b' },
  { name: 'Wohnen', pattern: '\\b(erstattung|rückzahlung)\\b' },
  { name: 'Versicherung', pattern: '\\bkfz\\.?versicherung\\b' },
  { name: 'Freizeit, Hobbies und Soziales', pattern: '\\b(spende)\\b' },
  { name: 'Wohnen', pattern: '\\b(rundfunk|gez)\\b' },
];

function safePattern(p: string): boolean {
  if (!p || p.length > 120) return false;
  // simple protection: disallow multiple nested quantifiers or suspicious sequences
  if (/\{.*\{/.test(p)) return false;
  if (/\+\+|\*\*|\+\*|\*\+/.test(p)) return false;
  return true;
}

export function suggestCategoryFromPurpose(purpose: string): string | null {
  if (!purpose) return null;
  const s = purpose.toLowerCase();
  for (const entry of PATTERNS) {
    const pat = entry.pattern;
    if (!safePattern(pat)) continue;
    try {
      const re = new RegExp(pat, 'i');
      if (re.test(s)) return entry.name;
    } catch (e) {
      // ignore bad patterns
      continue;
    }
  }
  return null;
}

export const _PATTERNS = PATTERNS; // exported for tests
