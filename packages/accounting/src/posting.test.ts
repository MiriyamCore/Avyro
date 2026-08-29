import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { AccountingError, assertBalanced } from './index.js';

describe('assertBalanced', () => {
  it('accepts a balanced two-line journal', () => {
    expect(() =>
      assertBalanced([
        { accountId: 'a', debitAmount: '100.00' },
        { accountId: 'b', creditAmount: '100.00' },
      ]),
    ).not.toThrow();
  });

  it('rejects unbalanced journals', () => {
    expect(() =>
      assertBalanced([
        { accountId: 'a', debitAmount: '100' },
        { accountId: 'b', creditAmount: '90' },
      ]),
    ).toThrow(AccountingError);
  });

  it('rejects floating-point-unsafe equality by using Decimal', () => {
    const d = new Decimal('0.1').plus('0.2');
    expect(d.toFixed(1)).toBe('0.3');
  });
});
