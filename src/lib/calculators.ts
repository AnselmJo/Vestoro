// Pure financial calculators. Monthly compounding, all money in integer cents.

export interface SavingsPlanInput {
  initialCents: number;
  monthlyCents: number;
  annualRatePct: number;      // e.g. 7 for 7 % p.a.
  years: number;
  annualInflationPct?: number; // optional: show purchasing power
}

export interface SavingsYearPoint {
  year: number;               // 1..years
  valueCents: number;
  contributedCents: number;   // initial + deposits so far
}

export interface SavingsPlanResult {
  finalCents: number;
  contributedCents: number;
  interestCents: number;
  realFinalCents?: number;    // inflation-adjusted purchasing power
  yearly: SavingsYearPoint[];
}

export function savingsPlan(input: SavingsPlanInput): SavingsPlanResult {
  const months = Math.max(0, Math.round(input.years * 12));
  const r = input.annualRatePct / 100 / 12;
  let value = input.initialCents;
  let contributed = input.initialCents;
  const yearly: SavingsYearPoint[] = [];

  for (let m = 1; m <= months; m++) {
    value = value * (1 + r) + input.monthlyCents;
    contributed += input.monthlyCents;
    if (m % 12 === 0) {
      yearly.push({ year: m / 12, valueCents: Math.round(value), contributedCents: contributed });
    }
  }
  const finalCents = Math.round(value);
  const result: SavingsPlanResult = {
    finalCents,
    contributedCents: contributed,
    interestCents: finalCents - contributed,
    yearly,
  };
  if (input.annualInflationPct !== undefined) {
    const deflator = Math.pow(1 + input.annualInflationPct / 100, input.years);
    result.realFinalCents = Math.round(finalCents / deflator);
  }
  return result;
}

export interface FireInput {
  monthlyExpensesCents: number;
  withdrawalRatePct: number;    // classic: 4 (%-rule → 25x yearly expenses)
  currentWealthCents: number;
  monthlySavingsCents: number;
  annualRatePct: number;
}

export interface FireResult {
  targetCents: number;          // wealth needed for financial independence
  yearsToFi: number | null;     // null = not reachable within 100 years
  fiYearly: SavingsYearPoint[]; // projection until target (capped at 60y for charting)
}

export function fireProjection(input: FireInput): FireResult {
  const targetCents = Math.round((input.monthlyExpensesCents * 12) / (input.withdrawalRatePct / 100));
  const r = input.annualRatePct / 100 / 12;
  let value = input.currentWealthCents;
  let contributed = input.currentWealthCents;
  const yearly: SavingsYearPoint[] = [];
  let yearsToFi: number | null = value >= targetCents ? 0 : null;

  for (let m = 1; m <= 100 * 12; m++) {
    value = value * (1 + r) + input.monthlySavingsCents;
    contributed += input.monthlySavingsCents;
    if (m % 12 === 0 && m / 12 <= 60) {
      yearly.push({ year: m / 12, valueCents: Math.round(value), contributedCents: contributed });
    }
    if (yearsToFi === null && value >= targetCents) {
      yearsToFi = Math.round((m / 12) * 10) / 10;
      if (m / 12 > 60) break;
    }
  }
  return { targetCents, yearsToFi, fiYearly: yearly };
}
