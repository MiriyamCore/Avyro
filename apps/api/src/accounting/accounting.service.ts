import { BadRequestException, Injectable } from '@nestjs/common';
import { prisma } from '@avyro/database';
import { AccountingError, AccountingPostingService } from '@avyro/accounting';

@Injectable()
export class AccountingService {
  private readonly posting = new AccountingPostingService(prisma);

  listAccounts(organizationId: string) {
    return prisma.ledgerAccount.findMany({
      where: { organizationId, active: true },
      orderBy: { code: 'asc' },
    });
  }

  listPeriods(organizationId: string) {
    return prisma.accountingPeriod.findMany({
      where: { organizationId },
      orderBy: { startDate: 'desc' },
    });
  }

  listJournals(organizationId: string) {
    return prisma.journalEntry.findMany({
      where: { organizationId },
      include: { lines: true },
      orderBy: { entryDate: 'desc' },
      take: 100,
    });
  }

  async createManualJournal(
    organizationId: string,
    userId: string,
    body: {
      entryDate: string;
      description: string;
      lines: Array<{
        accountId: string;
        description?: string;
        debitAmount?: string;
        creditAmount?: string;
      }>;
    },
  ) {
    try {
      return await this.posting.createJournal({
        organizationId,
        entryDate: new Date(body.entryDate),
        description: body.description,
        sourceType: 'manual',
        createdById: userId,
        lines: body.lines,
        post: true,
      });
    } catch (error) {
      if (error instanceof AccountingError) {
        throw new BadRequestException({
          error: { code: error.code, message: error.message },
        });
      }
      throw error;
    }
  }

  async trialBalance(organizationId: string) {
    return this.posting.trialBalance(organizationId);
  }

  async createAccount(
    organizationId: string,
    body: {
      code: string;
      name: string;
      type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
      parentId?: string | null;
      isPostable?: boolean;
    },
  ) {
    const existing = await prisma.ledgerAccount.findFirst({
      where: { organizationId, code: body.code },
    });
    if (existing) {
      throw new BadRequestException({
        error: { code: 'ACCOUNT_EXISTS', message: 'Account code already exists.' },
      });
    }
    return prisma.ledgerAccount.create({
      data: {
        organizationId,
        code: body.code,
        name: body.name,
        type: body.type,
        parentId: body.parentId ?? null,
        isPostable: body.isPostable ?? true,
        active: true,
      },
    });
  }

  async updateAccount(
    organizationId: string,
    accountId: string,
    body: { name?: string; isPostable?: boolean; active?: boolean },
  ) {
    const account = await prisma.ledgerAccount.findFirst({
      where: { id: accountId, organizationId },
    });
    if (!account) {
      throw new BadRequestException({
        error: { code: 'ACCOUNT_NOT_FOUND', message: 'Account not found.' },
      });
    }
    return prisma.ledgerAccount.update({
      where: { id: account.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.isPostable !== undefined ? { isPostable: body.isPostable } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
      },
    });
  }

  async reverseJournal(organizationId: string, userId: string, journalId: string) {
    const entry = await prisma.journalEntry.findFirst({
      where: { id: journalId, organizationId, status: 'POSTED' },
    });
    if (!entry) {
      throw new BadRequestException({
        error: {
          code: 'JOURNAL_NOT_REVERSIBLE',
          message: 'Posted journal not found or already reversed.',
        },
      });
    }
    const existingReversal = await prisma.journalEntry.findFirst({
      where: { organizationId, reversedEntryId: entry.id },
    });
    if (existingReversal) {
      throw new BadRequestException({
        error: { code: 'ALREADY_REVERSED', message: 'Journal already has a reversal.' },
      });
    }
    try {
      return await this.posting.reverseJournal({
        organizationId,
        journalEntryId: entry.id,
        reversedById: userId,
        reason: `Reversal of ${entry.journalNumber}`,
      });
    } catch (error) {
      if (error instanceof AccountingError) {
        throw new BadRequestException({
          error: { code: error.code, message: error.message },
        });
      }
      throw error;
    }
  }

  async lockPeriod(organizationId: string, periodId: string, userId: string) {
    const period = await prisma.accountingPeriod.findFirst({
      where: { id: periodId, organizationId },
    });
    if (!period) {
      throw new BadRequestException({
        error: { code: 'PERIOD_NOT_FOUND', message: 'Period not found.' },
      });
    }
    if (period.status === 'LOCKED') {
      return period;
    }
    const tb = await this.posting.trialBalance(organizationId);
    if (!tb.balanced) {
      throw new BadRequestException({
        error: {
          code: 'TRIAL_BALANCE_UNBALANCED',
          message: 'Cannot lock period while the trial balance is out of balance.',
        },
      });
    }
    return prisma.accountingPeriod.update({
      where: { id: period.id },
      data: {
        status: 'LOCKED',
        closedAt: new Date(),
        closedById: userId,
      },
    });
  }

  async monthEndChecklist(organizationId: string) {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

    let period = await prisma.accountingPeriod.findFirst({
      where: {
        organizationId,
        startDate: monthStart,
        endDate: monthEnd,
      },
    });
    if (!period) {
      period = await prisma.accountingPeriod.create({
        data: {
          organizationId,
          name: monthStart.toLocaleString('en-GB', {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
          }),
          startDate: monthStart,
          endDate: monthEnd,
          status: 'OPEN',
        },
      });
    }

    const [tb, overdueInvoices, overdueBills, unmatchedBank, unsettledGateway, reminders] =
      await Promise.all([
        this.posting.trialBalance(organizationId),
        prisma.invoice.count({
          where: {
            organizationId,
            status: { in: ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE'] },
            dueDate: { lt: now },
            amountDue: { gt: 0 },
          },
        }),
        prisma.bill.count({
          where: {
            organizationId,
            status: { in: ['OPEN', 'PARTIALLY_PAID'] },
            dueDate: { lt: now },
            amountDue: { gt: 0 },
          },
        }),
        prisma.bankTransaction.count({
          where: { organizationId, status: 'IMPORTED' },
        }),
        prisma.gatewayCheckout.count({
          where: { organizationId, status: 'SUCCEEDED' },
        }),
        prisma.complianceRecord.count({
          where: {
            organizationId,
            status: 'ACTIVE',
            expiresOn: {
              not: null,
              lte: new Date(now.getTime() + 60 * 86400000),
            },
          },
        }),
      ]);

    type Check = {
      id: string;
      label: string;
      status: 'ok' | 'warn' | 'block';
      detail: string;
      href: string;
    };

    const checks: Check[] = [
      {
        id: 'trial-balance',
        label: 'Trial balance is balanced',
        status: tb.balanced ? 'ok' : 'block',
        detail: tb.balanced
          ? `Debit ${tb.totalDebit} = Credit ${tb.totalCredit}`
          : 'Books are out of balance — fix journals before locking.',
        href: '/app/trial-balance',
      },
      {
        id: 'overdue-invoices',
        label: 'No overdue customer invoices',
        status: overdueInvoices === 0 ? 'ok' : 'warn',
        detail:
          overdueInvoices === 0
            ? 'All receivables are current'
            : `${overdueInvoices} overdue invoice(s)`,
        href: '/app/invoices',
      },
      {
        id: 'overdue-bills',
        label: 'No overdue supplier bills',
        status: overdueBills === 0 ? 'ok' : 'warn',
        detail:
          overdueBills === 0
            ? 'No past-due payables'
            : `${overdueBills} overdue bill(s)`,
        href: '/app/bills',
      },
      {
        id: 'bank-match',
        label: 'Bank transactions matched',
        status: unmatchedBank === 0 ? 'ok' : 'warn',
        detail:
          unmatchedBank === 0
            ? 'No unmatched imports'
            : `${unmatchedBank} imported transaction(s) still unmatched`,
        href: '/app/banking',
      },
      {
        id: 'gateway-settle',
        label: 'Gateway captures settled',
        status: unsettledGateway === 0 ? 'ok' : 'warn',
        detail:
          unsettledGateway === 0
            ? 'No pending settlements'
            : `${unsettledGateway} capture(s) waiting to settle to bank`,
        href: '/app/gateway',
      },
      {
        id: 'compliance',
        label: 'Compliance records not expiring soon',
        status: reminders === 0 ? 'ok' : 'warn',
        detail:
          reminders === 0
            ? 'No expiries in the next 60 days'
            : `${reminders} record(s) expire within 60 days`,
        href: '/app/compliance',
      },
      {
        id: 'period-lock',
        label: 'Accounting period locked',
        status: period.status === 'LOCKED' ? 'ok' : 'warn',
        detail:
          period.status === 'LOCKED'
            ? `${period.name} is locked`
            : `${period.name} is still open — lock when checks are clear`,
        href: '/app/month-end',
      },
    ];

    const blockers = checks.filter((c) => c.status === 'block').length;
    const warnings = checks.filter((c) => c.status === 'warn').length;

    return {
      period,
      checks,
      summary: {
        blockers,
        warnings,
        readyToLock: blockers === 0 && period.status === 'OPEN',
      },
    };
  }
}
