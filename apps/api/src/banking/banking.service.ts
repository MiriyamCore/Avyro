import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@avyro/database';
import {
  AccountingError,
  AccountingPostingService,
} from '@avyro/accounting';
import { Decimal } from 'decimal.js';
import {
  parseBankStatementPdf,
  type ParseBankStatementPdfResult,
} from './bank-statement-pdf.js';

@Injectable()
export class BankingService {
  private readonly posting = new AccountingPostingService(prisma);

  listAccounts(organizationId: string) {
    return prisma.bankAccount.findMany({
      where: { organizationId, status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      include: { _count: { select: { transactions: true } } },
    });
  }

  async createAccount(
    organizationId: string,
    body: {
      name: string;
      bankName?: string;
      accountNumberMasked?: string;
      currency?: string;
      ledgerAccountId?: string;
      openingBalance?: string;
    },
  ) {
    const ledger =
      (body.ledgerAccountId
        ? await prisma.ledgerAccount.findFirst({
            where: { id: body.ledgerAccountId, organizationId },
          })
        : null) ??
      (await prisma.ledgerAccount.findFirst({
        where: { organizationId, code: '1110' },
      }));
    if (!ledger) {
      throw new BadRequestException({
        error: {
          code: 'MISSING_LEDGER_ACCOUNT',
          message: 'Link a cash/bank ledger account.',
        },
      });
    }
    return prisma.bankAccount.create({
      data: {
        organizationId,
        name: body.name,
        bankName: body.bankName,
        accountNumberMasked: body.accountNumberMasked,
        currency: body.currency ?? 'BDT',
        ledgerAccountId: ledger.id,
        openingBalance: body.openingBalance ?? '0',
      },
    });
  }

  listTransactions(organizationId: string, bankAccountId?: string) {
    return prisma.bankTransaction.findMany({
      where: {
        organizationId,
        ...(bankAccountId ? { bankAccountId } : {}),
      },
      include: { bankAccount: true },
      orderBy: { txnDate: 'desc' },
      take: 200,
    });
  }

  /**
   * Import simple CSV: date,description,amount[,balance][,externalId]
   * Amount: positive = money in, negative = money out.
   */
  async importCsv(
    organizationId: string,
    bankAccountId: string,
    csvText: string,
  ) {
    const account = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, organizationId },
    });
    if (!account) {
      throw new NotFoundException({
        error: { code: 'BANK_ACCOUNT_NOT_FOUND', message: 'Bank account not found.' },
      });
    }

    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      throw new BadRequestException({
        error: { code: 'EMPTY_CSV', message: 'CSV needs a header and at least one row.' },
      });
    }

    const batchId = `IMP-${Date.now()}`;
    let imported = 0;
    let skipped = 0;

    for (const line of lines.slice(1)) {
      const parts = line.split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
      if (parts.length < 3) {
        skipped += 1;
        continue;
      }
      const [dateRaw, description, amountRaw, balanceRaw, externalRaw] = parts;
      const amount = new Decimal(amountRaw || 0);
      if (amount.isZero()) {
        skipped += 1;
        continue;
      }
      if (!dateRaw || !description) {
        skipped += 1;
        continue;
      }
      const externalId = externalRaw || `${dateRaw}|${description}|${amountRaw}`;
      try {
        await prisma.bankTransaction.create({
          data: {
            organizationId,
            bankAccountId,
            txnDate: new Date(dateRaw),
            description,
            amount: amount.toFixed(6),
            balance: balanceRaw ? new Decimal(balanceRaw).toFixed(6) : null,
            externalId,
            status: 'IMPORTED',
            importBatchId: batchId,
          },
        });
        imported += 1;
      } catch {
        skipped += 1;
      }
    }

    return { batchId, imported, skipped };
  }

  async ignoreTransaction(organizationId: string, txnId: string) {
    const txn = await prisma.bankTransaction.findFirst({
      where: { id: txnId, organizationId },
    });
    if (!txn) {
      throw new NotFoundException({
        error: { code: 'TXN_NOT_FOUND', message: 'Transaction not found.' },
      });
    }
    return prisma.bankTransaction.update({
      where: { id: txn.id },
      data: { status: 'IGNORED', matchedType: null, matchedId: null },
    });
  }

  async importRows(
    organizationId: string,
    bankAccountId: string,
    rows: Array<Array<string>>,
  ) {
    const header = ['date', 'description', 'amount', 'balance', 'externalId'];
    const body = rows
      .filter((r) => r.length >= 3)
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    return this.importCsv(organizationId, bankAccountId, `${header.join(',')}\n${body}`);
  }

  async previewPdfStatement(
    organizationId: string,
    bankAccountId: string,
    pdfBuffer: Buffer,
  ): Promise<ParseBankStatementPdfResult> {
    const account = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, organizationId },
    });
    if (!account) {
      throw new NotFoundException({
        error: { code: 'BANK_ACCOUNT_NOT_FOUND', message: 'Bank account not found.' },
      });
    }
    if (!pdfBuffer?.length) {
      throw new BadRequestException({
        error: { code: 'EMPTY_PDF', message: 'PDF file is empty.' },
      });
    }
    return parseBankStatementPdf(pdfBuffer);
  }

  async matchTransaction(
    organizationId: string,
    txnId: string,
    body: { matchedType: 'payment' | 'expense' | 'bill_payment'; matchedId: string },
  ) {
    const txn = await prisma.bankTransaction.findFirst({
      where: { id: txnId, organizationId },
    });
    if (!txn) {
      throw new NotFoundException({
        error: { code: 'TXN_NOT_FOUND', message: 'Transaction not found.' },
      });
    }
    return prisma.bankTransaction.update({
      where: { id: txn.id },
      data: {
        status: 'MATCHED',
        matchedType: body.matchedType,
        matchedId: body.matchedId,
      },
    });
  }

  async suggestMatches(organizationId: string, txnId: string) {
    const txn = await prisma.bankTransaction.findFirst({
      where: { id: txnId, organizationId },
    });
    if (!txn) {
      throw new NotFoundException({
        error: { code: 'TXN_NOT_FOUND', message: 'Transaction not found.' },
      });
    }
    const amount = new Decimal(txn.amount.toString()).abs();
    const payments = await prisma.payment.findMany({
      where: {
        organizationId,
        amount: amount.toFixed(6),
        status: 'RECORDED',
      },
      include: { invoice: true, customer: true },
      take: 10,
    });
    const expenses = await prisma.expense.findMany({
      where: {
        organizationId,
        amount: amount.toFixed(6),
        status: 'RECORDED',
      },
      take: 10,
    });
    const billPayments = await prisma.billPayment.findMany({
      where: {
        organizationId,
        amount: amount.toFixed(6),
        status: 'RECORDED',
      },
      include: { bill: true },
      take: 10,
    });
    return {
      payments: payments.map((p) => ({
        id: p.id,
        type: 'payment' as const,
        label: `${p.paymentNumber} ${p.customer?.name ?? ''} ${p.invoice?.invoiceNumber ?? ''}`.trim(),
        amount: p.amount.toString(),
      })),
      expenses: expenses.map((e) => ({
        id: e.id,
        type: 'expense' as const,
        label: e.description,
        amount: e.amount.toString(),
      })),
      billPayments: billPayments.map((p) => ({
        id: p.id,
        type: 'bill_payment' as const,
        label: `${p.paymentNumber} ${p.bill.billNumber ?? ''}`.trim(),
        amount: p.amount.toString(),
      })),
    };
  }

  async reconciliationSummary(organizationId: string, bankAccountId?: string) {
    const accounts = await prisma.bankAccount.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
        ...(bankAccountId ? { id: bankAccountId } : {}),
      },
    });
    const tb = await this.posting.trialBalance(organizationId);

    return Promise.all(
      accounts.map(async (acct) => {
        const txns = await prisma.bankTransaction.findMany({
          where: { organizationId, bankAccountId: acct.id },
          orderBy: { txnDate: 'desc' },
        });
        const imported = txns.filter((t) => t.status === 'IMPORTED');
        const matched = txns.filter((t) => t.status === 'MATCHED');
        const ignored = txns.filter((t) => t.status === 'IGNORED');
        const ledgerRow = tb.rows.find((r) => r.code === '1110' || r.name === acct.name);
        const ledgerBalance = ledgerRow
          ? new Decimal(ledgerRow.debit).minus(ledgerRow.credit)
          : new Decimal(acct.openingBalance.toString());
        const statementBalance = txns.find((t) => t.balance != null)?.balance ?? null;
        const unexplained = imported.reduce(
          (s, t) => s.plus(t.amount.toString()),
          new Decimal(0),
        );
        return {
          bankAccountId: acct.id,
          name: acct.name,
          currency: acct.currency,
          ledgerBalance: ledgerBalance.toFixed(2),
          statementBalance: statementBalance?.toString() ?? null,
          unexplainedCount: imported.length,
          unexplainedNet: unexplained.toFixed(2),
          matchedCount: matched.length,
          ignoredCount: ignored.length,
          difference:
            statementBalance != null
              ? new Decimal(statementBalance.toString()).minus(ledgerBalance).toFixed(2)
              : null,
          recentUnmatched: imported.slice(0, 10).map((t) => ({
            id: t.id,
            txnDate: t.txnDate.toISOString().slice(0, 10),
            description: t.description,
            amount: t.amount.toString(),
          })),
        };
      }),
    );
  }

  async transfer(
    organizationId: string,
    userId: string,
    body: {
      fromBankAccountId: string;
      toBankAccountId: string;
      amount: string;
      transferDate: string;
      description?: string;
    },
  ) {
    const from = await prisma.bankAccount.findFirst({
      where: { id: body.fromBankAccountId, organizationId },
    });
    const to = await prisma.bankAccount.findFirst({
      where: { id: body.toBankAccountId, organizationId },
    });
    if (!from || !to) {
      throw new BadRequestException({
        error: { code: 'BANK_ACCOUNT_NOT_FOUND', message: 'Bank accounts not found.' },
      });
    }
    const amount = new Decimal(body.amount);
    if (amount.lte(0)) {
      throw new BadRequestException({
        error: { code: 'INVALID_AMOUNT', message: 'Transfer amount must be positive.' },
      });
    }

    try {
      const journal = await this.posting.createJournal({
        organizationId,
        entryDate: new Date(body.transferDate),
        description: body.description ?? `Transfer ${from.name} → ${to.name}`,
        sourceType: 'bank_transfer',
        createdById: userId,
        lines: [
          { accountId: to.ledgerAccountId, debitAmount: amount.toFixed(6) },
          { accountId: from.ledgerAccountId, creditAmount: amount.toFixed(6) },
        ],
      });

      await prisma.bankTransaction.createMany({
        data: [
          {
            organizationId,
            bankAccountId: from.id,
            txnDate: new Date(body.transferDate),
            description: body.description ?? `Transfer to ${to.name}`,
            amount: amount.neg().toFixed(6),
            status: 'TRANSFER',
            matchedType: 'bank_transfer',
            matchedId: journal.id,
            externalId: `xfer-out-${journal.id}`,
          },
          {
            organizationId,
            bankAccountId: to.id,
            txnDate: new Date(body.transferDate),
            description: body.description ?? `Transfer from ${from.name}`,
            amount: amount.toFixed(6),
            status: 'TRANSFER',
            matchedType: 'bank_transfer',
            matchedId: journal.id,
            externalId: `xfer-in-${journal.id}`,
          },
        ],
      });

      return { journalId: journal.id };
    } catch (error) {
      if (error instanceof AccountingError) {
        throw new BadRequestException({
          error: { code: error.code, message: error.message },
        });
      }
      throw error;
    }
  }
}
