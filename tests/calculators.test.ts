import { describe, expect, it } from 'vitest';
import { savingsPlan, fireProjection } from '../src/lib/calculators';

describe('savingsPlan', () => {
  it('with 0% rate equals plain deposits', () => {
    const r = savingsPlan({ initialCents: 0, monthlyCents: 10000, annualRatePct: 0, years: 10 });
    expect(r.finalCents).toBe(10000 * 12 * 10);
    expect(r.interestCents).toBe(0);
  });
  it('matches the closed-form future value of an annuity', () => {
    // FV = P * ((1+r)^n − 1) / r, deposits at end of month
    const P = 10000, ratePct = 6, years = 15;
    const r = ratePct / 100 / 12;
    const n = years * 12;
    const expected = Math.round(P * ((Math.pow(1 + r, n) - 1) / r));
    const result = savingsPlan({ initialCents: 0, monthlyCents: P, annualRatePct: ratePct, years });
    expect(Math.abs(result.finalCents - expected)).toBeLessThanOrEqual(2); // rounding tolerance
  });
  it('applies inflation to purchasing power', () => {
    const r = savingsPlan({ initialCents: 100000, monthlyCents: 0, annualRatePct: 0, years: 10, annualInflationPct: 2 });
    expect(r.realFinalCents).toBe(Math.round(100000 / Math.pow(1.02, 10)));
  });
});

describe('fireProjection', () => {
  it('computes the 25x target for a 4% withdrawal rate', () => {
    const r = fireProjection({
      monthlyExpensesCents: 200000, withdrawalRatePct: 4,
      currentWealthCents: 0, monthlySavingsCents: 0, annualRatePct: 0,
    });
    expect(r.targetCents).toBe(200000 * 12 * 25);
    expect(r.yearsToFi).toBeNull(); // no savings, never reached
  });
  it('is immediately FI when wealth already covers the target', () => {
    const r = fireProjection({
      monthlyExpensesCents: 100000, withdrawalRatePct: 4,
      currentWealthCents: 100000 * 12 * 25, monthlySavingsCents: 0, annualRatePct: 0,
    });
    expect(r.yearsToFi).toBe(0);
  });
  it('reaches FI in finite time with savings and returns', () => {
    const r = fireProjection({
      monthlyExpensesCents: 200000, withdrawalRatePct: 4,
      currentWealthCents: 5000000, monthlySavingsCents: 150000, annualRatePct: 7,
    });
    expect(r.yearsToFi).not.toBeNull();
    expect(r.yearsToFi!).toBeGreaterThan(5);
    expect(r.yearsToFi!).toBeLessThan(40);
  });
});
