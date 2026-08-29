import { Decimal } from 'decimal.js';
import type { Prisma, PrismaClient } from '@avyro/database';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export class AccountingError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AccountingError';
  }
}

export type JournalLineInput = {
  accountId: string;
  description?: string;
  debitAmount?: string | number | Decimal;
  creditAmount?: string | number | Decimal;
  currency?: string;
  exchangeRate?: string | number | Decimal;
};

export type CreateJournalInput = {
  organizationId: string;
  entryDate: Date;
  description: string;
  sourceType?: string;
  sourceId?: string;
  currency?: string;
  exchangeRate?: string | number | Decimal;
  createdById?: string;
  lines: JournalLineInput[];
  post?: boolean;
};

function toDecimal(value: string | number | Decimal | undefined): Decimal {
  if (value === undefined || value === null || value === '') {
    return new Decimal(0);
  }
  return new Decimal(value);
}

function assertBalanced(lines: JournalLineInput[]): void {
  let debit = new Decimal(0);
  let credit = new Decimal(0);

  for (const line of lines) {
    const d = toDecimal(line.debitAmount);
    const c = toDecimal(line.creditAmount);
    if (d.isNegative() || c.isNegative()) {
      throw new AccountingError('NEGATIVE_AMOUNT', 'Journal line amounts cannot be negative.');
    }
    if (!d.isZero() && !c.isZero()) {
      throw new AccountingError(
        'DEBIT_AND_CREDIT',
        'A journal line cannot have both debit and credit amounts.',
      );
    }
    if (d.isZero() && c.isZero()) {
      throw new AccountingError('ZERO_LINE', 'A journal line must have a debit or credit amount.');
    }
    debit = debit.plus(d);
    credit = credit.plus(c);
  }

  if (!debit.equals(credit)) {
    throw new AccountingError(
      'UNBALANCED_JOURNAL',
      `Journal is unbalanced: debit ${debit.toFixed(6)} != credit ${credit.toFixed(6)}.`,
    );
  }

  if (lines.length < 2) {
    throw new AccountingError('INSUFFICIENT_LINES', 'A journal requires at least two lines.');
  }
}

export class AccountingPostingService {
  constructor(private readonly db: PrismaClient) {}

  async assertPeriodOpen(organizationId: string, entryDate: Date): Promise<void> {
    const locked = await this.db.accountingPeriod.findFirst({
      where: {
        organizationId,
        status: 'LOCKED',
        startDate: { lte: entryDate },
        endDate: { gte: entryDate },
      },
    });
    if (locked) {
      throw new AccountingError(
        'PERIOD_LOCKED',
        `Accounting period ${locked.name} is locked.`,
      );
    }
  }

  async nextJournalNumber(organizationId: string, tx: Prisma.TransactionClient): Promise<string> {
    const count = await tx.journalEntry.count({ where: { organizationId } });
    const seq = String(count + 1).padStart(5, '0');
    const year = new Date().getUTCFullYear();
    return `JE-${year}-${seq}`;
  }

  async createJournal(input: CreateJournalInput) {
    assertBalanced(input.lines);
    await this.assertPeriodOpen(input.organizationId, input.entryDate);

    const currency = input.currency ?? 'BDT';
    const exchangeRate = toDecimal(input.exchangeRate ?? 1);

    return this.db.$transaction(async (tx) => {
      const accountIds = [...new Set(input.lines.map((l) => l.accountId))];
      const accounts = await tx.ledgerAccount.findMany({
        where: {
          organizationId: input.organizationId,
          id: { in: accountIds },
          active: true,
          isPostable: true,
        },
      });
      if (accounts.length !== accountIds.length) {
        throw new AccountingError(
          'INVALID_ACCOUNT',
          'One or more accounts are missing, inactive, or not postable for this organisation.',
        );
      }

      const journalNumber = await this.nextJournalNumber(input.organizationId, tx);
      const shouldPost = input.post !== false;

      const entry = await tx.journalEntry.create({
        data: {
          organizationId: input.organizationId,
          journalNumber,
          entryDate: input.entryDate,
          description: input.description,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          status: shouldPost ? 'POSTED' : 'DRAFT',
          currency,
          exchangeRate: exchangeRate.toFixed(8),
          createdById: input.createdById,
          postedById: shouldPost ? input.createdById : null,
          postedAt: shouldPost ? new Date() : null,
          lines: {
            create: input.lines.map((line) => {
              const debit = toDecimal(line.debitAmount);
              const credit = toDecimal(line.creditAmount);
              const lineRate = toDecimal(line.exchangeRate ?? exchangeRate);
              return {
                organizationId: input.organizationId,
                accountId: line.accountId,
                description: line.description,
                debitAmount: debit.toFixed(6),
                creditAmount: credit.toFixed(6),
                baseDebitAmount: debit.times(lineRate).toFixed(6),
                baseCreditAmount: credit.times(lineRate).toFixed(6),
                currency: line.currency ?? currency,
                exchangeRate: lineRate.toFixed(8),
              };
            }),
          },
        },
        include: { lines: true },
      });

      return entry;
    });
  }

  async reverseJournal(params: {
    organizationId: string;
    journalEntryId: string;
    reversedById?: string;
    reason?: string;
  }) {
    const original = await this.db.journalEntry.findFirst({
      where: {
        id: params.journalEntryId,
        organizationId: params.organizationId,
      },
      include: { lines: true },
    });

    if (!original) {
      throw new AccountingError('JOURNAL_NOT_FOUND', 'Journal entry not found.');
    }
    if (original.status !== 'POSTED') {
      throw new AccountingError('JOURNAL_NOT_POSTED', 'Only posted journals can be reversed.');
    }

    const alreadyReversed = await this.db.journalEntry.findFirst({
      where: {
        organizationId: params.organizationId,
        reversedEntryId: original.id,
      },
    });
    if (alreadyReversed) {
      throw new AccountingError('ALREADY_REVERSED', 'Journal has already been reversed.');
    }

    await this.assertPeriodOpen(params.organizationId, original.entryDate);

    return this.db.$transaction(async (tx) => {
      const journalNumber = await this.nextJournalNumber(params.organizationId, tx);
      const reversal = await tx.journalEntry.create({
        data: {
          organizationId: params.organizationId,
          journalNumber,
          entryDate: original.entryDate,
          description: params.reason
            ? `Reversal of ${original.journalNumber}: ${params.reason}`
            : `Reversal of ${original.journalNumber}`,
          sourceType: original.sourceType,
          sourceId: original.sourceId,
          status: 'POSTED',
          currency: original.currency,
          exchangeRate: original.exchangeRate,
          createdById: params.reversedById,
          postedById: params.reversedById,
          postedAt: new Date(),
          reversedEntryId: original.id,
          lines: {
            create: original.lines.map((line) => ({
              organizationId: params.organizationId,
              accountId: line.accountId,
              description: line.description,
              debitAmount: line.creditAmount,
              creditAmount: line.debitAmount,
              baseDebitAmount: line.baseCreditAmount,
              baseCreditAmount: line.baseDebitAmount,
              currency: line.currency,
              exchangeRate: line.exchangeRate,
            })),
          },
        },
        include: { lines: true },
      });

      await tx.journalEntry.update({
        where: { id: original.id },
        data: { status: 'REVERSED' },
      });

      return reversal;
    });
  }

  async trialBalance(organizationId: string, asOfDate?: Date) {
    const lines = await this.db.journalLine.findMany({
      where: {
        organizationId,
        journalEntry: {
          status: 'POSTED',
          ...(asOfDate ? { entryDate: { lte: asOfDate } } : {}),
        },
      },
      include: {
        account: true,
      },
    });

    const map = new Map<
      string,
      {
        accountId: string;
        code: string;
        name: string;
        debit: Decimal;
        credit: Decimal;
      }
    >();

    for (const line of lines) {
      const current = map.get(line.accountId) ?? {
        accountId: line.accountId,
        code: line.account.code,
        name: line.account.name,
        debit: new Decimal(0),
        credit: new Decimal(0),
      };
      current.debit = current.debit.plus(line.baseDebitAmount.toString());
      current.credit = current.credit.plus(line.baseCreditAmount.toString());
      map.set(line.accountId, current);
    }

    const rows = [...map.values()]
      .map((row) => ({
        accountId: row.accountId,
        code: row.code,
        name: row.name,
        debit: row.debit.toFixed(6),
        credit: row.credit.toFixed(6),
      }))
      .sort((a, b) => a.code.localeCompare(b.code));

    const totalDebit = rows.reduce((sum, r) => sum.plus(r.debit), new Decimal(0));
    const totalCredit = rows.reduce((sum, r) => sum.plus(r.credit), new Decimal(0));

    return {
      rows,
      totalDebit: totalDebit.toFixed(6),
      totalCredit: totalCredit.toFixed(6),
      balanced: totalDebit.equals(totalCredit),
    };
  }
}

export { assertBalanced, toDecimal };
