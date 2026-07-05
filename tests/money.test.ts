import { describe, expect, it } from 'vitest';
import { parseGermanAmount, parseGermanDate, formatCents, monthKey, shiftMonth } from '../src/lib/money';

describe('parseGermanAmount', () => {
  it('parses C24 style with € sign', () => {
    expect(parseGermanAmount('-2000,00 €')).toBe(-200000);
  });
  it('parses DKB style plain', () => {
    expect(parseGermanAmount('-11,02')).toBe(-1102);
  });
  it('parses thousands separator', () => {
    expect(parseGermanAmount('1.572,41 €')).toBe(157241);
  });
  it('parses positive and integer amounts', () => {
    expect(parseGermanAmount('+50,5')).toBe(5050);
    expect(parseGermanAmount('1234')).toBe(123400);
  });
  it('rejects garbage', () => {
    expect(parseGermanAmount('abc')).toBeNull();
    expect(parseGermanAmount('')).toBeNull();
  });
});

describe('parseGermanDate', () => {
  it('parses DD.MM.YYYY', () => expect(parseGermanDate('02.07.2026')).toBe('2026-07-02'));
  it('parses DD.MM.YY as 20YY', () => expect(parseGermanDate('02.07.26')).toBe('2026-07-02'));
  it('passes through ISO', () => expect(parseGermanDate('2026-07-02')).toBe('2026-07-02'));
  it('rejects invalid', () => expect(parseGermanDate('99.99.2026')).toBeNull());
});

describe('formatCents', () => {
  it('formats German currency', () => {
    expect(formatCents(-1102).replace(/\u00a0/g, ' ')).toBe('-11,02 €');
  });
});

describe('month helpers', () => {
  it('monthKey', () => expect(monthKey('2026-07-02')).toBe('2026-07'));
  it('shiftMonth across year boundary', () => expect(shiftMonth('2026-01', -1)).toBe('2025-12'));
});
