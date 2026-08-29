import { PDFParse } from 'pdf-parse';

export type ParsedBankStatementRow = {
  date: string;
  description: string;
  amount: string;
  balance?: string;
  externalId?: string;
  confidence: 'high' | 'medium' | 'low';
};

export type ParseBankStatementPdfResult = {
  rows: ParsedBankStatementRow[];
  pageCount: number;
  rawLineCount: number;
  warnings: string[];
  detectedFormat?: string;
};

const MONTHS: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};

const SKIP_LINE =
  /^(page\s+\d+|statement\s+period|opening\s+balance|closing\s+balance|account\s+(no|number|name)|branch|customer|currency|bdt|total\s+(debit|credit)|generated\s+on|printed\s+on|continued)/i;

const DATE_AT_START =
  /^(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{1,2}[\s\-](?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-\.]\d{1,2})/i;

const AMOUNT_TOKEN =
  /(?:^|\s)(-?(?:\d{1,3}(?:,\d{3})+(?:\.\d{2})?|\d+\.\d{2}))(?:\s*(?:DR|CR|Dr|Cr))?/gi;

/** Extract plain text from a bank statement PDF buffer. */
export async function extractPdfText(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return {
      text: result.text ?? '',
      pageCount: result.pages?.length ?? result.total ?? 0,
    };
  } finally {
    await parser.destroy();
  }
}

/** Normalize BD-style dates to ISO YYYY-MM-DD when possible. */
export function normalizeStatementDate(raw: string): string | null {
  const trimmed = raw.trim();
  const slash = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (slash?.[1] && slash[2] && slash[3]) {
    const d = slash[1];
    const m = slash[2];
    const y = slash[3];
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const named = trimmed.match(
    /^(\d{1,2})[\s\-](jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s\-](\d{2,4})$/i,
  );
  if (named?.[1] && named[2] && named[3]) {
    const d = named[1];
    const mon = named[2];
    const y = named[3];
    const year = y.length === 2 ? `20${y}` : y;
    const month = MONTHS[mon.slice(0, 3).toLowerCase()];
    if (!month) return null;
    return `${year}-${month}-${d.padStart(2, '0')}`;
  }

  const iso = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (iso?.[1] && iso[2] && iso[3]) {
    const y = iso[1];
    const m = iso[2];
    const d = iso[3];
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}

function cleanAmount(raw: string): string | null {
  const token = raw.replace(/,/g, '').replace(/\s*(DR|CR)$/i, '').trim();
  if (!/^-?\d+(\.\d+)?$/.test(token)) return null;
  return token;
}

function isDashAmount(raw: string | undefined): boolean {
  if (!raw) return true;
  const t = raw.trim();
  return t === '-' || t === '—' || t === '' || t === '0' || t === '0.00';
}

function extractAmounts(line: string): Array<{ value: string; drCr?: string; index: number }> {
  const matches: Array<{ value: string; drCr?: string; index: number }> = [];
  for (const match of line.matchAll(AMOUNT_TOKEN)) {
    const full = match[0].trim();
    const index = match.index ?? 0;
    const drCr = full.match(/\b(DR|CR)\b/i)?.[1]?.toUpperCase();
    const numeric = full.replace(/\s*(DR|CR)$/i, '').trim();
    const cleaned = cleanAmount(numeric);
    if (cleaned != null) {
      matches.push({ value: cleaned, drCr, index });
    }
  }
  return matches;
}

function parseTailAmounts(
  rest: string,
  amounts: Array<{ value: string; drCr?: string; index: number }>,
): { amount: string | null; balance?: string; confidence: ParsedBankStatementRow['confidence'] } {
  if (amounts.length >= 3) {
    const debitTok = amounts[amounts.length - 3];
    const creditTok = amounts[amounts.length - 2];
    const balanceTok = amounts[amounts.length - 1];
    if (!debitTok || !creditTok || !balanceTok) {
      return { amount: null, confidence: 'low' };
    }
    return {
      amount: signedAmountFromDebitCredit(debitTok.value, creditTok.value),
      balance: cleanAmount(balanceTok.value) ?? undefined,
      confidence: 'high',
    };
  }

  if (amounts.length === 2) {
    const first = amounts[0];
    const second = amounts[1];
    if (!first || !second) return { amount: null, confidence: 'low' };

    const dashBetween = /\s-\s/.test(
      rest.slice(first.index, second.index + String(first.value).length + 8),
    );
    const dashBeforeFirst = rest.slice(0, first.index).trimEnd().endsWith('-');

    if (dashBeforeFirst) {
      return {
        amount: signedAmountFromSingle(first.value, 'CR', rest),
        balance: cleanAmount(second.value) ?? undefined,
        confidence: 'high',
      };
    }
    if (dashBetween) {
      return {
        amount: signedAmountFromSingle(first.value, 'DR', rest),
        balance: cleanAmount(second.value) ?? undefined,
        confidence: 'high',
      };
    }

    return {
      amount: signedAmountFromSingle(first.value, first.drCr, rest),
      balance: cleanAmount(second.value) ?? undefined,
      confidence: 'high',
    };
  }

  if (amounts.length === 1) {
    const only = amounts[0];
    if (!only) return { amount: null, confidence: 'low' };
    return {
      amount: signedAmountFromSingle(only.value, only.drCr, rest),
      confidence: 'low',
    };
  }

  return { amount: null, confidence: 'low' };
}

function signedAmountFromDebitCredit(debit: string, credit: string): string | null {
  const d = cleanAmount(debit);
  const c = cleanAmount(credit);
  if (d && !isDashAmount(debit) && parseFloat(d) !== 0) {
    return (-Math.abs(parseFloat(d))).toFixed(2);
  }
  if (c && !isDashAmount(credit) && parseFloat(c) !== 0) {
    return Math.abs(parseFloat(c)).toFixed(2);
  }
  return null;
}

function signedAmountFromSingle(amount: string, drCr?: string, line?: string): string | null {
  const cleaned = cleanAmount(amount);
  if (!cleaned) return null;
  let value = parseFloat(cleaned);
  if (Number.isNaN(value) || value === 0) return null;

  const marker = drCr ?? (line?.match(/\b(DR|CR)\b/i)?.[1]?.toUpperCase());
  if (marker === 'DR') value = -Math.abs(value);
  else if (marker === 'CR') value = Math.abs(value);
  else if (/\b(debit|withdraw|paid|charge|fee|pos|atm)\b/i.test(line ?? '')) {
    value = -Math.abs(value);
  }

  return value.toFixed(2);
}

function descriptionBetweenDateAndAmounts(line: string, dateRaw: string, amountStart: number): string {
  const afterDate = line.slice(dateRaw.length, amountStart).trim();
  return afterDate.replace(/\s+/g, ' ').replace(/\s+\b(DR|CR)\b\s*$/i, '').trim();
}

/**
 * Parse extracted statement text into structured transaction rows.
 * Handles common Bangladesh bank layouts: date + narration + debit/credit/balance columns.
 */
export function parseBankStatementText(text: string): ParseBankStatementPdfResult {
  const warnings: string[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const rows: ParsedBankStatementRow[] = [];
  let detectedFormat: string | undefined;

  for (const line of lines) {
    if (SKIP_LINE.test(line)) continue;
    if (!DATE_AT_START.test(line)) continue;

    const dateMatch = line.match(DATE_AT_START);
    if (!dateMatch?.[1]) continue;
    const dateRaw = dateMatch[1];
    const isoDate = normalizeStatementDate(dateRaw);
    if (!isoDate) continue;

    const rest = line.slice(dateRaw.length).trim();
    const amounts = extractAmounts(rest);
    if (amounts.length === 0) continue;

    const { amount, balance, confidence } = parseTailAmounts(rest, amounts);
    if (!amount || amount === '0.00' || amount === '-0.00') continue;

    const firstAmountIndex =
      amounts[0]?.index ?? rest.search(/(?:^|\s)-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?|-?\d+\.\d{2}/);
    const description = descriptionBetweenDateAndAmounts(
      rest,
      '',
      firstAmountIndex > 0 ? firstAmountIndex : rest.length,
    ).replace(/\s-\s*$/, '').trim();
    if (!description || description.length < 2) continue;

    if (amounts.length >= 3) {
      detectedFormat = detectedFormat ?? 'date_description_debit_credit_balance';
    } else if (amounts.length === 2) {
      detectedFormat = detectedFormat ?? 'date_description_amount_balance';
    } else {
      detectedFormat = detectedFormat ?? 'date_description_amount';
    }

    rows.push({
      date: isoDate,
      description,
      amount,
      balance,
      externalId: `${isoDate}|${description}|${amount}`,
      confidence,
    });
  }

  if (rows.length === 0) {
    warnings.push(
      'No transactions detected. PDF text layout may differ — try CSV export or paste rows manually.',
    );
  } else if (rows.filter((r) => r.confidence === 'low').length > rows.length / 2) {
    warnings.push('Many rows have low confidence — review amounts before importing.');
  }

  return {
    rows,
    pageCount: 0,
    rawLineCount: lines.length,
    warnings,
    detectedFormat,
  };
}

export async function parseBankStatementPdf(buffer: Buffer): Promise<ParseBankStatementPdfResult> {
  const { text, pageCount } = await extractPdfText(buffer);
  if (!text.trim()) {
    return {
      rows: [],
      pageCount,
      rawLineCount: 0,
      warnings: ['PDF contains no extractable text (may be scanned/image-only).'],
    };
  }
  const parsed = parseBankStatementText(text);
  return { ...parsed, pageCount };
}

/** Convert parsed rows to the CSV import row shape: date, description, amount, balance, externalId */
export function parsedRowsToImportArrays(
  rows: ParsedBankStatementRow[],
): Array<Array<string>> {
  return rows.map((r) => [
    r.date,
    r.description,
    r.amount,
    r.balance ?? '',
    r.externalId ?? `${r.date}|${r.description}|${r.amount}`,
  ]);
}
