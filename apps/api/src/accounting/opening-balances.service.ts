import { BadRequestException, Injectable } from '@nestjs/common';
import { prisma } from '@avyro/database';
import { AccountingPostingService } from '@avyro/accounting';
import { Decimal } from 'decimal.js';

/** Guided opening balances via a single controlled opening journal. */
@Injectable()
export class OpeningBalancesService {
  private readonly posting = new AccountingPostingService(prisma);

  async postOpeningBalances(input: {
    organizationId: string;
    userId: string;
    entryDate: Date;
    lines: Array<{
      accountId: string;
      debitAmount?: string;
      creditAmount?: string;
      description?: string;
    }>;
  }) {
    return this.posting.createJournal({
      organizationId: input.organizationId,
      entryDate: input.entryDate,
      description: 'Opening balances',
      sourceType: 'opening_balance',
      createdById: input.userId,
      lines: input.lines,
      post: true,
    });
  }

  /**
   * Simple Mode: "I started the business with ৳50,000".
   * Posts Dr Cash/Bank, Cr Owner Capital (3100).
   */
  async postStartingCapital(input: {
    organizationId: string;
    userId: string;
    amount: string;
    entryDate: Date;
    destination: 'cash' | 'bank';
    bankAccountId?: string;
  }) {
    const amount = new Decimal(input.amount || 0);
    if (!amount.isFinite() || amount.lte(0)) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_AMOUNT',
          message: 'Starting capital must be greater than zero.',
        },
      });
    }

    const existing = await prisma.journalEntry.findFirst({
      where: {
        organizationId: input.organizationId,
        sourceType: 'opening_balance',
        description: { startsWith: 'Starting capital' },
        status: 'POSTED',
      },
    });
    if (existing) {
      throw new BadRequestException({
        error: {
          code: 'STARTING_CAPITAL_EXISTS',
          message:
            'Starting capital was already recorded. Use Owner money for later contributions.',
        },
      });
    }

    const capital = await prisma.ledgerAccount.findFirst({
      where: { organizationId: input.organizationId, code: '3100', isPostable: true },
    });
    if (!capital) {
      throw new BadRequestException({
        error: {
          code: 'MISSING_CAPITAL_ACCOUNT',
          message: 'Owner Capital account (3100) is missing.',
        },
      });
    }

    let assetAccountId: string;
    if (input.destination === 'bank') {
      if (!input.bankAccountId) {
        throw new BadRequestException({
          error: {
            code: 'BANK_REQUIRED',
            message: 'Choose a bank account for starting capital.',
          },
        });
      }
      const bank = await prisma.bankAccount.findFirst({
        where: { id: input.bankAccountId, organizationId: input.organizationId },
      });
      if (!bank) {
        throw new BadRequestException({
          error: { code: 'BANK_NOT_FOUND', message: 'Bank account not found.' },
        });
      }
      assetAccountId = bank.ledgerAccountId;
      await prisma.bankAccount.update({
        where: { id: bank.id },
        data: { openingBalance: amount.toFixed(6) },
      });
    } else {
      const cash =
        (await prisma.ledgerAccount.findFirst({
          where: { organizationId: input.organizationId, code: '1101', isPostable: true },
        })) ??
        (await prisma.ledgerAccount.findFirst({
          where: { organizationId: input.organizationId, code: '1110', isPostable: true },
        }));
      if (!cash) {
        throw new BadRequestException({
          error: {
            code: 'MISSING_CASH_ACCOUNT',
            message: 'Cash account is missing from the chart of accounts.',
          },
        });
      }
      assetAccountId = cash.id;
    }

    const amountStr = amount.toFixed(6);
    return this.posting.createJournal({
      organizationId: input.organizationId,
      entryDate: input.entryDate,
      description: `Starting capital — owner funds ${amountStr}`,
      sourceType: 'opening_balance',
      createdById: input.userId,
      lines: [
        {
          accountId: assetAccountId,
          debitAmount: amountStr,
          description: 'Opening cash / bank',
        },
        {
          accountId: capital.id,
          creditAmount: amountStr,
          description: 'Owner capital introduced',
        },
      ],
      post: true,
    });
  }
}
