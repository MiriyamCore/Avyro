import { Injectable } from '@nestjs/common';
import { prisma } from '@avyro/database';
import { AccountingPostingService } from '@avyro/accounting';
import { Decimal } from 'decimal.js';

@Injectable()
export class ReportsService {
  private readonly posting = new AccountingPostingService(prisma);

  private parseRange(from?: string, to?: string) {
    return {
      fromDate: from ? new Date(from) : undefined,
      toDate: to ? new Date(to) : undefined,
    };
  }

  async dashboard(organizationId: string) {
    const now = new Date();
    const monthlyTrend: Array<{
      month: string;
      label: string;
      revenue: string;
      expenses: string;
      profit: string;
    }> = [];

    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      const monthKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
      const label = start.toLocaleString('en-GB', { month: 'short', year: '2-digit' });

      const [invoices, expenses] = await Promise.all([
        prisma.invoice.findMany({
          where: {
            organizationId,
            status: { in: ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CREDITED'] },
            issueDate: { gte: start, lte: end },
          },
        }),
        prisma.expense.findMany({
          where: {
            organizationId,
            status: 'RECORDED',
            expenseDate: { gte: start, lte: end },
          },
        }),
      ]);

      const revenue = invoices.reduce(
        (sum, inv) =>
          sum.plus(new Decimal(inv.grandTotal.toString()).times(inv.exchangeRate.toString())),
        new Decimal(0),
      );
      const expenseTotal = expenses.reduce(
        (sum, exp) =>
          sum.plus(new Decimal(exp.amount.toString()).times(exp.exchangeRate.toString())),
        new Decimal(0),
      );

      monthlyTrend.push({
        month: monthKey,
        label,
        revenue: revenue.toFixed(2),
        expenses: expenseTotal.toFixed(2),
        profit: revenue.minus(expenseTotal).toFixed(2),
      });
    }

    const arRows = await this.arAging(organizationId);
    const apRows = await this.apAging(organizationId);
    const arTotal = arRows.reduce(
      (s, r) => s.plus(r.amountDue),
      new Decimal(0),
    );
    const apTotal = apRows.reduce(
      (s, r) => s.plus(r.amountDue),
      new Decimal(0),
    );

    const tb = await this.posting.trialBalance(organizationId);
    const cash = tb.rows
      .filter((r) => r.code.startsWith('11'))
      .reduce(
        (sum, row) => sum.plus(new Decimal(row.debit).minus(row.credit)),
        new Decimal(0),
      );

    const bucketTotals = (rows: Array<{ bucket: string; amountDue: string }>) => {
      const buckets = { current: '0', '1-30': '0', '31-60': '0', '61-90': '0', '90+': '0' };
      for (const row of rows) {
        const key = row.bucket as keyof typeof buckets;
        if (key in buckets) {
          buckets[key] = new Decimal(buckets[key]).plus(row.amountDue).toFixed(2);
        }
      }
      return buckets;
    };

    return {
      monthlyTrend,
      cash: cash.toFixed(2),
      accountsReceivable: arTotal.toFixed(2),
      accountsPayable: apTotal.toFixed(2),
      arBuckets: bucketTotals(arRows),
      apBuckets: bucketTotals(apRows),
    };
  }

  async trialBalance(organizationId: string, asOf?: string) {
    return this.posting.trialBalance(
      organizationId,
      asOf ? new Date(asOf) : undefined,
    );
  }

  async profitAndLoss(organizationId: string, from?: string, to?: string) {
    const tb = await this.posting.trialBalance(
      organizationId,
      to ? new Date(to) : undefined,
    );
    const revenue = tb.rows.filter((r) => r.code.startsWith('4') || r.code === '3400');
    const expenses = tb.rows.filter(
      (r) => r.code.startsWith('5') || r.code.startsWith('6') || r.code === '3500',
    );

    const revenueTotal = revenue.reduce(
      (sum, r) => sum.plus(new Decimal(r.credit).minus(r.debit)),
      new Decimal(0),
    );
    const expenseTotal = expenses.reduce(
      (sum, r) => sum.plus(new Decimal(r.debit).minus(r.credit)),
      new Decimal(0),
    );

    return {
      from: from ?? null,
      to: to ?? null,
      revenue: revenue.map((r) => ({
        code: r.code,
        name: r.name,
        amount: new Decimal(r.credit).minus(r.debit).toFixed(2),
        href: `/app/reports?tab=gl&accountCode=${encodeURIComponent(r.code)}`,
      })),
      expenses: expenses.map((r) => ({
        code: r.code,
        name: r.name,
        amount: new Decimal(r.debit).minus(r.credit).toFixed(2),
        href: `/app/reports?tab=gl&accountCode=${encodeURIComponent(r.code)}`,
      })),
      totalRevenue: revenueTotal.toFixed(2),
      totalExpenses: expenseTotal.toFixed(2),
      netProfit: revenueTotal.minus(expenseTotal).toFixed(2),
    };
  }

  async balanceSheet(organizationId: string, asOf?: string) {
    const tb = await this.posting.trialBalance(
      organizationId,
      asOf ? new Date(asOf) : undefined,
    );
    const assets = tb.rows.filter((r) => r.code.startsWith('1'));
    const liabilities = tb.rows.filter((r) => r.code.startsWith('2'));
    const equity = tb.rows.filter(
      (r) => r.code.startsWith('3') && r.code !== '3400' && r.code !== '3500',
    );

    const mapSide = (
      rows: typeof tb.rows,
      side: 'asset' | 'credit-normal',
    ) =>
      rows.map((r) => {
        const amount =
          side === 'asset'
            ? new Decimal(r.debit).minus(r.credit)
            : new Decimal(r.credit).minus(r.debit);
        return {
          code: r.code,
          name: r.name,
          amount: amount.toFixed(2),
          href: `/app/reports?tab=gl&accountCode=${encodeURIComponent(r.code)}`,
        };
      });

    const assetRows = mapSide(assets, 'asset');
    const liabilityRows = mapSide(liabilities, 'credit-normal');
    const equityRows = mapSide(equity, 'credit-normal');

    // Include current P&L in equity
    const pl = await this.profitAndLoss(organizationId, undefined, asOf);
    equityRows.push({
      code: 'PL',
      name: 'Current period profit/(loss)',
      amount: pl.netProfit,
      href: '/app/reports?tab=pnl',
    });

    const totalAssets = assetRows.reduce(
      (s, r) => s.plus(r.amount),
      new Decimal(0),
    );
    const totalLiabEq = [...liabilityRows, ...equityRows].reduce(
      (s, r) => s.plus(r.amount),
      new Decimal(0),
    );

    return {
      asOf: asOf ?? null,
      assets: assetRows.filter((r) => !new Decimal(r.amount).isZero()),
      liabilities: liabilityRows.filter((r) => !new Decimal(r.amount).isZero()),
      equity: equityRows.filter((r) => !new Decimal(r.amount).isZero()),
      totalAssets: totalAssets.toFixed(2),
      totalLiabilitiesAndEquity: totalLiabEq.toFixed(2),
      balanced: totalAssets.toFixed(2) === totalLiabEq.toFixed(2),
    };
  }

  async generalLedger(
    organizationId: string,
    accountCode?: string,
    from?: string,
    to?: string,
  ) {
    const { fromDate, toDate } = this.parseRange(from, to);
    const lines = await prisma.journalLine.findMany({
      where: {
        organizationId,
        journalEntry: {
          status: 'POSTED',
          ...(fromDate || toDate
            ? {
                entryDate: {
                  ...(fromDate ? { gte: fromDate } : {}),
                  ...(toDate ? { lte: toDate } : {}),
                },
              }
            : {}),
        },
        ...(accountCode ? { account: { code: accountCode } } : {}),
      },
      include: {
        account: true,
        journalEntry: true,
      },
      orderBy: [{ journalEntry: { entryDate: 'asc' } }, { createdAt: 'asc' }],
      take: 500,
    });

    return lines.map((line) => ({
      id: line.id,
      date: line.journalEntry.entryDate,
      journalNumber: line.journalEntry.journalNumber,
      description: line.description ?? line.journalEntry.description,
      accountCode: line.account.code,
      accountName: line.account.name,
      debit: line.baseDebitAmount.toString(),
      credit: line.baseCreditAmount.toString(),
      currency: line.currency,
      originalDebit: line.debitAmount.toString(),
      originalCredit: line.creditAmount.toString(),
    }));
  }

  async arAging(organizationId: string, asOf?: string) {
    const asOfDate = asOf ? new Date(asOf) : new Date();
    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId,
        status: { in: ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE'] },
        amountDue: { gt: 0 },
        issueDate: { lte: asOfDate },
      },
      include: { customer: true },
      orderBy: { dueDate: 'asc' },
    });
    const today = asOfDate;
    return invoices.map((inv) => {
      const due = new Date(inv.dueDate);
      const days = Math.floor((today.getTime() - due.getTime()) / 86400000);
      const bucket =
        days <= 0 ? 'current' : days <= 30 ? '1-30' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '90+';
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customer: inv.customer.name,
        dueDate: inv.dueDate,
        currency: inv.currency,
        amountDue: inv.amountDue.toString(),
        daysPastDue: Math.max(days, 0),
        bucket,
        href: `/app/invoices`,
      };
    });
  }

  async apAging(organizationId: string, asOf?: string) {
    const asOfDate = asOf ? new Date(asOf) : new Date();
    const bills = await prisma.bill.findMany({
      where: {
        organizationId,
        status: { in: ['OPEN', 'PARTIALLY_PAID'] },
        amountDue: { gt: 0 },
        billDate: { lte: asOfDate },
      },
      include: { supplier: true },
      orderBy: { dueDate: 'asc' },
    });
    const today = asOfDate;
    return bills.map((bill) => {
      const due = new Date(bill.dueDate);
      const days = Math.floor((today.getTime() - due.getTime()) / 86400000);
      const bucket =
        days <= 0 ? 'current' : days <= 30 ? '1-30' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '90+';
      return {
        id: bill.id,
        billNumber: bill.billNumber,
        supplier: bill.supplier.name,
        dueDate: bill.dueDate,
        currency: bill.currency,
        amountDue: bill.amountDue.toString(),
        daysPastDue: Math.max(days, 0),
        bucket,
        href: `/app/bills`,
      };
    });
  }

  async revenueByCustomer(organizationId: string, from?: string, to?: string) {
    const { fromDate, toDate } = this.parseRange(from, to);
    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId,
        status: { in: ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CREDITED'] },
        ...(fromDate || toDate
          ? {
              issueDate: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
      },
      include: { customer: true },
    });
    const map = new Map<
      string,
      { customerId: string; customer: string; revenue: Decimal; currency: string }
    >();
    for (const inv of invoices) {
      const key = inv.customerId;
      const current = map.get(key) ?? {
        customerId: inv.customerId,
        customer: inv.customer.name,
        revenue: new Decimal(0),
        currency: inv.currency,
      };
      current.revenue = current.revenue.plus(
        new Decimal(inv.grandTotal.toString()).times(inv.exchangeRate.toString()),
      );
      map.set(key, current);
    }
    return [...map.values()]
      .map((r) => ({
        customerId: r.customerId,
        customer: r.customer,
        revenueBdt: r.revenue.toFixed(2),
        href: `/app/customers/${r.customerId}`,
      }))
      .sort((a, b) => Number(b.revenueBdt) - Number(a.revenueBdt));
  }

  async expenseByCategory(organizationId: string, from?: string, to?: string) {
    const { fromDate, toDate } = this.parseRange(from, to);
    const expenses = await prisma.expense.findMany({
      where: {
        organizationId,
        status: 'RECORDED',
        ...(fromDate || toDate
          ? {
              expenseDate: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
      },
    });
    const accounts = await prisma.ledgerAccount.findMany({
      where: { organizationId },
    });
    const byId = new Map(accounts.map((a) => [a.id, a]));
    const map = new Map<string, Decimal>();
    for (const exp of expenses) {
      const acc = byId.get(exp.categoryAccountId);
      const key = acc ? `${acc.code} ${acc.name}` : exp.categoryAccountId;
      map.set(
        key,
        (map.get(key) ?? new Decimal(0)).plus(
          new Decimal(exp.amount.toString()).times(exp.exchangeRate.toString()),
        ),
      );
    }
    return [...map.entries()]
      .map(([category, amount]) => {
        const code = category.split(' ')[0];
        return {
          category,
          amountBdt: amount.toFixed(2),
          href: code ? `/app/reports?tab=gl&accountCode=${encodeURIComponent(code)}` : '/app/expense',
        };
      })
      .sort((a, b) => Number(b.amountBdt) - Number(a.amountBdt));
  }

  private async accountMovement(
    organizationId: string,
    from: Date | undefined,
    to: Date | undefined,
    codePrefix: string | ((code: string) => boolean),
  ) {
    const accounts = await prisma.ledgerAccount.findMany({
      where: { organizationId, isPostable: true },
    });
    const match =
      typeof codePrefix === 'string'
        ? (code: string) => code.startsWith(codePrefix)
        : codePrefix;
    const ids = accounts.filter((a) => match(a.code)).map((a) => a.id);
    if (ids.length === 0) return new Decimal(0);

    const lines = await prisma.journalLine.findMany({
      where: {
        organizationId,
        accountId: { in: ids },
        journalEntry: {
          status: 'POSTED',
          ...(from || to
            ? {
                entryDate: {
                  ...(from ? { gte: from } : {}),
                  ...(to ? { lte: to } : {}),
                },
              }
            : {}),
        },
      },
    });
    return lines.reduce(
      (sum, line) =>
        sum
          .plus(line.baseDebitAmount.toString())
          .minus(line.baseCreditAmount.toString()),
      new Decimal(0),
    );
  }

  async cashFlow(organizationId: string, from?: string, to?: string) {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    const pl = await this.profitAndLoss(organizationId, from, to);
    const netIncome = new Decimal(pl.netProfit);

    // Operating adjustments: increase in AR uses cash; increase in AP provides cash
    const arChange = await this.accountMovement(organizationId, fromDate, toDate, '1200');
    const apChange = await this.accountMovement(organizationId, fromDate, toDate, '2100');
    // Asset-normal: positive change = outflow for AR
    const operatingAdjustments = [
      {
        label: 'Decrease/(increase) in accounts receivable',
        amount: arChange.neg().toFixed(2),
        href: '/app/reports?tab=ar',
      },
      {
        label: 'Increase/(decrease) in accounts payable',
        amount: apChange.neg().toFixed(2),
        href: '/app/reports?tab=ap',
      },
    ];
    const operatingTotal = netIncome
      .plus(arChange.neg())
      .plus(apChange.neg());

    const investingMove = await this.accountMovement(organizationId, fromDate, toDate, (c) =>
      c.startsWith('15'),
    );
    const investing = [
      {
        label: 'Purchase/(disposal) of fixed assets',
        amount: investingMove.neg().toFixed(2),
        href: '/app/reports?tab=gl&accountCode=1500',
      },
    ];
    const investingTotal = investingMove.neg();

    const capitalMove = await this.accountMovement(organizationId, fromDate, toDate, (c) =>
      c.startsWith('31') || c.startsWith('32'),
    );
    // Equity credit-normal: credit increase shows as negative debit-credit movement
    const financing = [
      {
        label: 'Owner capital introduced/(drawings)',
        amount: capitalMove.neg().toFixed(2),
        href: '/app/owner-money',
      },
    ];
    const financingTotal = capitalMove.neg();

    const cashMove = await this.accountMovement(organizationId, fromDate, toDate, (c) =>
      c.startsWith('11'),
    );
    const netChange = operatingTotal.plus(investingTotal).plus(financingTotal);

    return {
      from: from ?? null,
      to: to ?? null,
      operating: {
        netIncome: netIncome.toFixed(2),
        adjustments: operatingAdjustments,
        total: operatingTotal.toFixed(2),
        href: '/app/reports?tab=pnl',
      },
      investing: { rows: investing, total: investingTotal.toFixed(2) },
      financing: { rows: financing, total: financingTotal.toFixed(2) },
      netChangeInCash: netChange.toFixed(2),
      cashAccountMovement: cashMove.toFixed(2),
      note: 'Indirect cash flow from posted journals (operating / investing / financing classification).',
    };
  }

  async relatedParty(organizationId: string, from?: string, to?: string) {
    const { fromDate, toDate } = this.parseRange(from, to);
    const customers = await prisma.customer.findMany({
      where: { organizationId, isRelatedParty: true },
      orderBy: { name: 'asc' },
    });
    const rows = [];
    for (const customer of customers) {
      const invoices = await prisma.invoice.findMany({
        where: {
          organizationId,
          customerId: customer.id,
          status: { in: ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CREDITED'] },
          ...(fromDate || toDate
            ? {
                issueDate: {
                  ...(fromDate ? { gte: fromDate } : {}),
                  ...(toDate ? { lte: toDate } : {}),
                },
              }
            : {}),
        },
      });
      const payments = await prisma.payment.findMany({
        where: {
          organizationId,
          customerId: customer.id,
          status: 'RECORDED',
          ...(fromDate || toDate
            ? {
                paymentDate: {
                  ...(fromDate ? { gte: fromDate } : {}),
                  ...(toDate ? { lte: toDate } : {}),
                },
              }
            : {}),
        },
      });
      const openAr = invoices.reduce(
        (s, inv) => s.plus(inv.amountDue.toString()),
        new Decimal(0),
      );
      const billed = invoices.reduce(
        (s, inv) =>
          s.plus(
            new Decimal(inv.grandTotal.toString()).times(inv.exchangeRate.toString()),
          ),
        new Decimal(0),
      );
      const received = payments.reduce(
        (s, p) =>
          s.plus(new Decimal(p.amount.toString()).times(p.exchangeRate.toString())),
        new Decimal(0),
      );
      const contracts = await prisma.contract.count({
        where: { organizationId, customerId: customer.id, isRelatedParty: true },
      });
      rows.push({
        customerId: customer.id,
        customer: customer.name,
        countryCode: customer.countryCode,
        currency: customer.defaultCurrency,
        billedBdt: billed.toFixed(2),
        receivedBdt: received.toFixed(2),
        openAr: openAr.toFixed(2),
        relatedContracts: contracts,
        href: `/app/customers/${customer.id}`,
      });
    }
    return { rows, totalOpenAr: rows.reduce((s, r) => s.plus(r.openAr), new Decimal(0)).toFixed(2) };
  }

  async exportRevenue(organizationId: string, from?: string, to?: string) {
    const { fromDate, toDate } = this.parseRange(from, to);
    const tb = await this.posting.trialBalance(organizationId, toDate);
    const exportAccount = tb.rows.find((r) => r.code === '4600');
    const exportLedger = exportAccount
      ? new Decimal(exportAccount.credit).minus(exportAccount.debit)
      : new Decimal(0);

    const foreignInvoices = await prisma.invoice.findMany({
      where: {
        organizationId,
        currency: { not: 'BDT' },
        status: { in: ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CREDITED'] },
        ...(fromDate || toDate
          ? {
              issueDate: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
      },
      include: { customer: true },
      orderBy: { issueDate: 'desc' },
    });

    const invoices = foreignInvoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      customer: inv.customer.name,
      issueDate: inv.issueDate,
      currency: inv.currency,
      originalAmount: inv.grandTotal.toString(),
      bdtAmount: new Decimal(inv.grandTotal.toString())
        .times(inv.exchangeRate.toString())
        .toFixed(2),
      status: inv.status,
      href: '/app/invoices',
    }));

    const foreignTotalBdt = invoices.reduce(
      (s, r) => s.plus(r.bdtAmount),
      new Decimal(0),
    );

    return {
      exportLedgerAccount: {
        code: '4600',
        name: exportAccount?.name ?? 'Export Service Revenue',
        amount: exportLedger.toFixed(2),
        href: '/app/reports?tab=gl&accountCode=4600',
      },
      foreignCurrencyInvoices: invoices,
      foreignTotalBdt: foreignTotalBdt.toFixed(2),
      note: 'Export revenue combines CoA 4600 activity and non-BDT invoices (proxy for service exports).',
    };
  }

  async projectProfitability(organizationId: string, from?: string, to?: string) {
    const { fromDate, toDate } = this.parseRange(from, to);
    const entries = await prisma.timeEntry.findMany({
      where: {
        organizationId,
        ...(fromDate || toDate
          ? {
              entryDate: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
      },
      include: { person: true },
    });
    const projects = await prisma.project.findMany({
      where: { organizationId },
    });
    const byProject = new Map<
      string,
      {
        projectId: string | null;
        projectName: string;
        hours: Decimal;
        billableValue: Decimal;
        byPerson: Map<string, { person: string; hours: Decimal; value: Decimal }>;
      }
    >();

    const keyFor = (projectId: string | null) => projectId ?? '__none__';
    const nameFor = (projectId: string | null) => {
      if (!projectId) return 'Unassigned';
      return projects.find((p) => p.id === projectId)?.name ?? projectId;
    };

    for (const e of entries) {
      const key = keyFor(e.projectId);
      let bucket = byProject.get(key);
      if (!bucket) {
        bucket = {
          projectId: e.projectId,
          projectName: nameFor(e.projectId),
          hours: new Decimal(0),
          billableValue: new Decimal(0),
          byPerson: new Map(),
        };
        byProject.set(key, bucket);
      }
      const hours = new Decimal(e.hours.toString());
      const rate = new Decimal(e.billingRate?.toString() ?? '0');
      const value = e.billable ? hours.times(rate) : new Decimal(0);
      bucket.hours = bucket.hours.plus(hours);
      bucket.billableValue = bucket.billableValue.plus(value);
      const personKey = e.personId ?? 'unknown';
      const personName = e.person?.name ?? 'Unknown';
      const personRow = bucket.byPerson.get(personKey) ?? {
        person: personName,
        hours: new Decimal(0),
        value: new Decimal(0),
      };
      personRow.hours = personRow.hours.plus(hours);
      personRow.value = personRow.value.plus(value);
      bucket.byPerson.set(personKey, personRow);
    }

    const rows = [...byProject.values()].map((b) => ({
      projectId: b.projectId,
      project: b.projectName,
      hours: b.hours.toFixed(2),
      billableValue: b.billableValue.toFixed(2),
      people: [...b.byPerson.values()].map((p) => ({
        person: p.person,
        hours: p.hours.toFixed(2),
        billableValue: p.value.toFixed(2),
      })),
    }));

    const totals = rows.reduce(
      (s, r) => ({
        hours: s.hours.plus(r.hours),
        billableValue: s.billableValue.plus(r.billableValue),
      }),
      { hours: new Decimal(0), billableValue: new Decimal(0) },
    );

    return {
      rows,
      totals: {
        hours: totals.hours.toFixed(2),
        billableValue: totals.billableValue.toFixed(2),
      },
    };
  }
}
