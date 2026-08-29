import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '@avyro/database';
import { AccountingPostingService } from '@avyro/accounting';
import { Decimal } from 'decimal.js';
import { createIsolatedOrgFixture } from '@avyro/testing';

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)('API domain flows', () => {
  const createdOrgIds: string[] = [];
  const posting = new AccountingPostingService(prisma);

  afterAll(async () => {
    for (const id of createdOrgIds) {
      await prisma.organization.deleteMany({ where: { id } });
    }
    await prisma.$disconnect();
  });

  async function seedCoa(organizationId: string) {
    const accounts = [
      { code: '1200', name: 'AR', type: 'ASSET' as const },
      { code: '4600', name: 'Revenue', type: 'REVENUE' as const },
      { code: '2230', name: 'TDS Payable', type: 'LIABILITY' as const },
      { code: '6600', name: 'Expense', type: 'EXPENSE' as const },
      { code: '2100', name: 'AP', type: 'LIABILITY' as const },
      { code: '1110', name: 'Bank', type: 'ASSET' as const },
    ];
    for (const a of accounts) {
      await prisma.ledgerAccount.create({
        data: { organizationId, ...a, isPostable: true },
      });
    }
  }

  it('isolates invoice lists per organisation', async () => {
    const a = await createIsolatedOrgFixture(prisma, 'inv-a');
    const b = await createIsolatedOrgFixture(prisma, 'inv-b');
    createdOrgIds.push(a.organization.id, b.organization.id);

    const custA = await prisma.customer.create({
      data: {
        organizationId: a.organization.id,
        customerNumber: 'C-0001',
        name: 'Customer A',
      },
    });
    await prisma.customer.create({
      data: {
        organizationId: b.organization.id,
        customerNumber: 'C-0001',
        name: 'Customer B',
      },
    });

    await prisma.invoice.create({
      data: {
        organizationId: a.organization.id,
        customerId: custA.id,
        issueDate: new Date(),
        dueDate: new Date(),
        invoiceNumber: 'INV-A-1',
        status: 'ISSUED',
        grandTotal: '100',
        amountDue: '100',
      },
    });

    const scoped = await prisma.invoice.findMany({
      where: { organizationId: a.organization.id },
    });
    expect(scoped).toHaveLength(1);
    expect(scoped[0]?.invoiceNumber).toBe('INV-A-1');
  });

  it('posts journals when an invoice is issued (revenue + AR)', async () => {
    const fx = await createIsolatedOrgFixture(prisma, 'issue-inv');
    createdOrgIds.push(fx.organization.id);
    await seedCoa(fx.organization.id);

    const ar = await prisma.ledgerAccount.findFirstOrThrow({
      where: { organizationId: fx.organization.id, code: '1200' },
    });
    const revenue = await prisma.ledgerAccount.findFirstOrThrow({
      where: { organizationId: fx.organization.id, code: '4600' },
    });
    const customer = await prisma.customer.create({
      data: {
        organizationId: fx.organization.id,
        customerNumber: 'C-0001',
        name: 'Buyer',
      },
    });
    const invoice = await prisma.invoice.create({
      data: {
        organizationId: fx.organization.id,
        customerId: customer.id,
        issueDate: new Date('2026-08-01'),
        dueDate: new Date('2026-08-31'),
        invoiceNumber: 'INV-TEST-1',
        status: 'ISSUED',
        subtotal: '1000',
        taxTotal: '0',
        grandTotal: '1000',
        amountDue: '1000',
        revenueAccountId: revenue.id,
      },
    });

    await posting.createJournal({
      organizationId: fx.organization.id,
      entryDate: invoice.issueDate,
      description: `Invoice ${invoice.invoiceNumber}`,
      sourceType: 'invoice',
      sourceId: invoice.id,
      lines: [
        { accountId: ar.id, debitAmount: '1000' },
        { accountId: revenue.id, creditAmount: '1000' },
      ],
    });

    const journals = await prisma.journalEntry.findMany({
      where: { organizationId: fx.organization.id, sourceId: invoice.id },
      include: { lines: true },
    });
    expect(journals).toHaveLength(1);
    expect(journals[0]?.status).toBe('POSTED');
    const debits = journals[0]?.lines.reduce(
      (s, l) => s.plus(l.debitAmount.toString()),
      new Decimal(0),
    );
    expect(debits?.toFixed(2)).toBe('1000.00');
  });

  it('posts payroll TDS to liability when run is posted', async () => {
    const fx = await createIsolatedOrgFixture(prisma, 'payroll-tds');
    createdOrgIds.push(fx.organization.id);
    await seedCoa(fx.organization.id);

    const expense = await prisma.ledgerAccount.findFirstOrThrow({
      where: { organizationId: fx.organization.id, code: '6600' },
    });
    const tds = await prisma.ledgerAccount.findFirstOrThrow({
      where: { organizationId: fx.organization.id, code: '2230' },
    });
    const bank = await prisma.ledgerAccount.findFirstOrThrow({
      where: { organizationId: fx.organization.id, code: '1110' },
    });

    const period = await prisma.payrollPeriod.create({
      data: {
        organizationId: fx.organization.id,
        name: 'Aug 2026',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-31'),
      },
    });
    const person = await prisma.person.create({
      data: {
        organizationId: fx.organization.id,
        name: 'Staff',
      },
    });
    await prisma.employeeCompensation.create({
      data: {
        organizationId: fx.organization.id,
        personId: person.id,
        grossPay: '50000',
        effectiveFrom: new Date('2026-08-01'),
      },
    });
    const run = await prisma.payrollRun.create({
      data: {
        organizationId: fx.organization.id,
        periodId: period.id,
        runDate: new Date('2026-08-31'),
        status: 'DRAFT',
      },
    });
    const gross = new Decimal('50000');
    const tdsAmount = gross.times('0.1');
    const net = gross.minus(tdsAmount);
    await prisma.payrollItem.create({
      data: {
        organizationId: fx.organization.id,
        runId: run.id,
        personId: person.id,
        grossPay: gross.toFixed(6),
        deductions: tdsAmount.toFixed(6),
        netPay: net.toFixed(6),
      },
    });

    await posting.createJournal({
      organizationId: fx.organization.id,
      entryDate: run.runDate,
      description: `Payroll ${period.name}`,
      sourceType: 'payroll_run',
      sourceId: run.id,
      lines: [
        { accountId: expense.id, debitAmount: gross.toFixed(6) },
        { accountId: tds.id, creditAmount: tdsAmount.toFixed(6) },
        { accountId: bank.id, creditAmount: net.toFixed(6) },
      ],
    });

    const tdsLine = await prisma.journalLine.findFirst({
      where: {
        organizationId: fx.organization.id,
        accountId: tds.id,
        creditAmount: { gt: 0 },
      },
    });
    expect(tdsLine?.creditAmount.toString()).toBe('5000.000000');
  });
});
