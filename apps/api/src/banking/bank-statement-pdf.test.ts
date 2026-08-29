import { describe, expect, it } from 'vitest';
import {
  normalizeStatementDate,
  parseBankStatementText,
  parsedRowsToImportArrays,
} from './bank-statement-pdf.js';

describe('normalizeStatementDate', () => {
  it('parses DD/MM/YYYY', () => {
    expect(normalizeStatementDate('10/08/2026')).toBe('2026-08-10');
  });

  it('parses DD-MMM-YYYY', () => {
    expect(normalizeStatementDate('09-Aug-2026')).toBe('2026-08-09');
  });

  it('parses ISO dates', () => {
    expect(normalizeStatementDate('2026-08-10')).toBe('2026-08-10');
  });
});

describe('parseBankStatementText', () => {
  it('parses debit/credit/balance columns', () => {
    const text = `
Statement of Account
Date Particulars Debit Credit Balance
10/08/2026 NEFT CR INORYUM PAYMENT - 75,000.00 158,500.00
09/08/2026 POS CLOUDFLARE 2,500.00 - 83,500.00
    `.trim();

    const result = parseBankStatementText(text);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      date: '2026-08-10',
      description: 'NEFT CR INORYUM PAYMENT',
      amount: '75000.00',
      balance: '158500.00',
    });
    expect(result.rows[1]).toMatchObject({
      date: '2026-08-09',
      amount: '-2500.00',
    });
  });

  it('parses amount and balance columns', () => {
    const text = '10-Aug-2026 Salary credit 120000.00 CR 320000.00';
    const result = parseBankStatementText(text);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.amount).toBe('120000.00');
    expect(result.rows[0]?.balance).toBe('320000.00');
  });

  it('skips header lines without dates', () => {
    const text = `
Opening Balance 50,000.00
10/08/2026 Transfer in 5000.00 55000.00
    `.trim();
    const result = parseBankStatementText(text);
    expect(result.rows).toHaveLength(1);
  });

  it('converts to import row arrays', () => {
    const text = '10/08/2026 Test payment 1000.00 5000.00';
    const { rows } = parseBankStatementText(text);
    const arrays = parsedRowsToImportArrays(rows);
    expect(arrays[0]?.[0]).toBe('2026-08-10');
    expect(arrays[0]?.[2]).toBe('1000.00');
  });
});
