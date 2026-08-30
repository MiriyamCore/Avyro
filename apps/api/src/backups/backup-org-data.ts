import { prisma } from '@avyro/database';
import {
  type PortableBackupPayload,
  serializeForBackup,
} from './backup-serialize.js';

const orgWhere = (organizationId: string) => ({ organizationId });

export async function exportOrganizationData(
  organizationId: string,
): Promise<PortableBackupPayload> {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
  });
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: organization.workspaceId },
  });

  const memberships = await prisma.membership.findMany({
    where: orgWhere(organizationId),
  });
  const userIds = [...new Set(memberships.map((m) => m.userId))];
  const users =
    userIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: userIds } } })
      : [];
  const accounts =
    userIds.length > 0
      ? await prisma.account.findMany({ where: { userId: { in: userIds } } })
      : [];

  const [
    auditLogs,
    documents,
    documentLinks,
    ledgerAccounts,
    accountingPeriods,
    journalEntries,
    journalLines,
    customers,
    invoices,
    payments,
    expenses,
    quotes,
    contracts,
    projects,
    suppliers,
    bills,
    billPayments,
    bankAccounts,
    bankTransactions,
    currencies,
    exchangeRates,
    gatewayCheckouts,
    complianceProfile,
    complianceRecords,
    taxCodes,
    vatDocuments,
    withholdingEntries,
    challans,
    serviceExportRecords,
    people,
    assets,
    timeEntries,
    payrollPeriods,
    payrollRuns,
  ] = await Promise.all([
    prisma.auditLog.findMany({ where: orgWhere(organizationId) }),
    prisma.document.findMany({ where: orgWhere(organizationId) }),
    prisma.documentLink.findMany({ where: orgWhere(organizationId) }),
    prisma.ledgerAccount.findMany({ where: orgWhere(organizationId) }),
    prisma.accountingPeriod.findMany({ where: orgWhere(organizationId) }),
    prisma.journalEntry.findMany({ where: orgWhere(organizationId) }),
    prisma.journalLine.findMany({ where: orgWhere(organizationId) }),
    prisma.customer.findMany({ where: orgWhere(organizationId) }),
    prisma.invoice.findMany({ where: orgWhere(organizationId) }),
    prisma.payment.findMany({ where: orgWhere(organizationId) }),
    prisma.expense.findMany({ where: orgWhere(organizationId) }),
    prisma.quote.findMany({ where: orgWhere(organizationId) }),
    prisma.contract.findMany({ where: orgWhere(organizationId) }),
    prisma.project.findMany({ where: orgWhere(organizationId) }),
    prisma.supplier.findMany({ where: orgWhere(organizationId) }),
    prisma.bill.findMany({ where: orgWhere(organizationId) }),
    prisma.billPayment.findMany({ where: orgWhere(organizationId) }),
    prisma.bankAccount.findMany({ where: orgWhere(organizationId) }),
    prisma.bankTransaction.findMany({ where: orgWhere(organizationId) }),
    prisma.currency.findMany({ where: orgWhere(organizationId) }),
    prisma.exchangeRate.findMany({ where: orgWhere(organizationId) }),
    prisma.gatewayCheckout.findMany({ where: orgWhere(organizationId) }),
    prisma.complianceProfile.findUnique({ where: { organizationId } }),
    prisma.complianceRecord.findMany({ where: orgWhere(organizationId) }),
    prisma.taxCode.findMany({ where: orgWhere(organizationId) }),
    prisma.vatDocument.findMany({ where: orgWhere(organizationId) }),
    prisma.withholdingEntry.findMany({ where: orgWhere(organizationId) }),
    prisma.challan.findMany({ where: orgWhere(organizationId) }),
    prisma.serviceExportRecord.findMany({ where: orgWhere(organizationId) }),
    prisma.person.findMany({ where: orgWhere(organizationId) }),
    prisma.asset.findMany({ where: orgWhere(organizationId) }),
    prisma.timeEntry.findMany({ where: orgWhere(organizationId) }),
    prisma.payrollPeriod.findMany({ where: orgWhere(organizationId) }),
    prisma.payrollRun.findMany({ where: orgWhere(organizationId) }),
  ]);

  const invoiceIds = invoices.map((i) => i.id);
  const quoteIds = quotes.map((q) => q.id);
  const billIds = bills.map((b) => b.id);
  const personIds = people.map((p) => p.id);
  const payrollRunIds = payrollRuns.map((r) => r.id);

  const [invoiceItems, quoteItems, billItems, employeeCompensations, payrollItems, payslips] =
    await Promise.all([
      invoiceIds.length
        ? prisma.invoiceItem.findMany({ where: { invoiceId: { in: invoiceIds } } })
        : [],
      quoteIds.length
        ? prisma.quoteItem.findMany({ where: { quoteId: { in: quoteIds } } })
        : [],
      billIds.length
        ? prisma.billItem.findMany({ where: { billId: { in: billIds } } })
        : [],
      personIds.length
        ? prisma.employeeCompensation.findMany({
            where: { personId: { in: personIds } },
          })
        : [],
      payrollRunIds.length
        ? prisma.payrollItem.findMany({
            where: { runId: { in: payrollRunIds } },
          })
        : [],
      payrollRunIds.length
        ? prisma.payslip.findMany({ where: { runId: { in: payrollRunIds } } })
        : [],
    ]);

  return {
    version: 2,
    format: 'avyro-portable',
    organizationId,
    exportedAt: new Date().toISOString(),
    organization: serializeForBackup(organization),
    workspace: serializeForBackup(workspace),
    memberships: serializeForBackup(memberships) as unknown[],
    users: serializeForBackup(users) as unknown[],
    accounts: serializeForBackup(accounts) as unknown[],
    auditLogs: serializeForBackup(auditLogs) as unknown[],
    documents: serializeForBackup(documents) as unknown[],
    documentLinks: serializeForBackup(documentLinks) as unknown[],
    ledgerAccounts: serializeForBackup(ledgerAccounts) as unknown[],
    accountingPeriods: serializeForBackup(accountingPeriods) as unknown[],
    journalEntries: serializeForBackup(journalEntries) as unknown[],
    journalLines: serializeForBackup(journalLines) as unknown[],
    customers: serializeForBackup(customers) as unknown[],
    invoices: serializeForBackup(invoices) as unknown[],
    invoiceItems: serializeForBackup(invoiceItems) as unknown[],
    payments: serializeForBackup(payments) as unknown[],
    expenses: serializeForBackup(expenses) as unknown[],
    quotes: serializeForBackup(quotes) as unknown[],
    quoteItems: serializeForBackup(quoteItems) as unknown[],
    contracts: serializeForBackup(contracts) as unknown[],
    projects: serializeForBackup(projects) as unknown[],
    suppliers: serializeForBackup(suppliers) as unknown[],
    bills: serializeForBackup(bills) as unknown[],
    billItems: serializeForBackup(billItems) as unknown[],
    billPayments: serializeForBackup(billPayments) as unknown[],
    bankAccounts: serializeForBackup(bankAccounts) as unknown[],
    bankTransactions: serializeForBackup(bankTransactions) as unknown[],
    currencies: serializeForBackup(currencies) as unknown[],
    exchangeRates: serializeForBackup(exchangeRates) as unknown[],
    gatewayCheckouts: serializeForBackup(gatewayCheckouts) as unknown[],
    complianceProfile: complianceProfile
      ? (serializeForBackup(complianceProfile) as unknown)
      : null,
    complianceRecords: serializeForBackup(complianceRecords) as unknown[],
    taxCodes: serializeForBackup(taxCodes) as unknown[],
    vatDocuments: serializeForBackup(vatDocuments) as unknown[],
    withholdingEntries: serializeForBackup(withholdingEntries) as unknown[],
    challans: serializeForBackup(challans) as unknown[],
    serviceExportRecords: serializeForBackup(serviceExportRecords) as unknown[],
    people: serializeForBackup(people) as unknown[],
    employeeCompensations: serializeForBackup(employeeCompensations) as unknown[],
    assets: serializeForBackup(assets) as unknown[],
    timeEntries: serializeForBackup(timeEntries) as unknown[],
    payrollPeriods: serializeForBackup(payrollPeriods) as unknown[],
    payrollRuns: serializeForBackup(payrollRuns) as unknown[],
    payrollItems: serializeForBackup(payrollItems) as unknown[],
    payslips: serializeForBackup(payslips) as unknown[],
  };
}

async function clearOrganizationData(organizationId: string, tx: typeof prisma) {
  await tx.payslip.deleteMany({ where: { organizationId } });
  await tx.payrollItem.deleteMany({ where: { organizationId } });
  await tx.payrollRun.deleteMany({ where: { organizationId } });
  await tx.payrollPeriod.deleteMany({ where: { organizationId } });
  await tx.timeEntry.deleteMany({ where: { organizationId } });
  await tx.employeeCompensation.deleteMany({
    where: { person: { organizationId } },
  });
  await tx.asset.deleteMany({ where: { organizationId } });
  await tx.person.deleteMany({ where: { organizationId } });
  await tx.bankTransaction.deleteMany({ where: { organizationId } });
  await tx.billPayment.deleteMany({ where: { organizationId } });
  await tx.billItem.deleteMany({ where: { bill: { organizationId } } });
  await tx.bill.deleteMany({ where: { organizationId } });
  await tx.payment.deleteMany({ where: { organizationId } });
  await tx.invoiceItem.deleteMany({ where: { invoice: { organizationId } } });
  await tx.invoice.deleteMany({ where: { organizationId } });
  await tx.quoteItem.deleteMany({ where: { quote: { organizationId } } });
  await tx.quote.deleteMany({ where: { organizationId } });
  await tx.expense.deleteMany({ where: { organizationId } });
  await tx.project.deleteMany({ where: { organizationId } });
  await tx.contract.deleteMany({ where: { organizationId } });
  await tx.customer.deleteMany({ where: { organizationId } });
  await tx.supplier.deleteMany({ where: { organizationId } });
  await tx.journalLine.deleteMany({ where: { organizationId } });
  await tx.journalEntry.deleteMany({ where: { organizationId } });
  await tx.accountingPeriod.deleteMany({ where: { organizationId } });
  await tx.ledgerAccount.deleteMany({ where: { organizationId } });
  await tx.documentLink.deleteMany({ where: { organizationId } });
  await tx.document.deleteMany({ where: { organizationId } });
  await tx.gatewayCheckout.deleteMany({ where: { organizationId } });
  await tx.exchangeRate.deleteMany({ where: { organizationId } });
  await tx.currency.deleteMany({ where: { organizationId } });
  await tx.bankAccount.deleteMany({ where: { organizationId } });
  await tx.serviceExportRecord.deleteMany({ where: { organizationId } });
  await tx.challan.deleteMany({ where: { organizationId } });
  await tx.withholdingEntry.deleteMany({ where: { organizationId } });
  await tx.vatDocument.deleteMany({ where: { organizationId } });
  await tx.taxCode.deleteMany({ where: { organizationId } });
  await tx.complianceRecord.deleteMany({ where: { organizationId } });
  await tx.complianceProfile.deleteMany({ where: { organizationId } });
  await tx.auditLog.deleteMany({ where: { organizationId } });
  await tx.backupRecord.deleteMany({ where: { organizationId } });
}

export async function restoreOrganizationData(
  organizationId: string,
  payload: PortableBackupPayload,
) {
  if (payload.organizationId !== organizationId) {
    throw new Error('Backup belongs to a different organisation.');
  }
  if (payload.format !== 'avyro-portable' || payload.version !== 2) {
    throw new Error('Unsupported backup format. Expected avyro-portable v2.');
  }

  await prisma.$transaction(async (tx) => {
    await clearOrganizationData(organizationId, tx as typeof prisma);

    const orgData = payload.organization as Record<string, unknown>;
    const { id: _id, workspaceId: _ws, createdAt: _ca, ...orgUpdate } = orgData;
    await tx.organization.update({
      where: { id: organizationId },
      data: orgUpdate as Parameters<typeof tx.organization.update>[0]['data'],
    });

    const batch = async <T>(rows: T[], fn: (batch: T[]) => Promise<unknown>) => {
      if (!rows?.length) return;
      await fn(rows);
    };

    await batch(payload.users, (rows) =>
      tx.user.createMany({ data: rows as never[], skipDuplicates: true }),
    );
    await batch(payload.accounts, (rows) =>
      tx.account.createMany({ data: rows as never[], skipDuplicates: true }),
    );
    await batch(payload.memberships, (rows) =>
      tx.membership.createMany({ data: rows as never[], skipDuplicates: true }),
    );
    await batch(payload.ledgerAccounts, (rows) =>
      tx.ledgerAccount.createMany({ data: rows as never[] }),
    );
    await batch(payload.accountingPeriods, (rows) =>
      tx.accountingPeriod.createMany({ data: rows as never[] }),
    );
    await batch(payload.customers, (rows) =>
      tx.customer.createMany({ data: rows as never[] }),
    );
    await batch(payload.suppliers, (rows) =>
      tx.supplier.createMany({ data: rows as never[] }),
    );
    await batch(payload.contracts, (rows) =>
      tx.contract.createMany({ data: rows as never[] }),
    );
    await batch(payload.projects, (rows) =>
      tx.project.createMany({ data: rows as never[] }),
    );
    await batch(payload.taxCodes, (rows) =>
      tx.taxCode.createMany({ data: rows as never[] }),
    );
    await batch(payload.currencies, (rows) =>
      tx.currency.createMany({ data: rows as never[] }),
    );
    await batch(payload.bankAccounts, (rows) =>
      tx.bankAccount.createMany({ data: rows as never[] }),
    );
    await batch(payload.people, (rows) =>
      tx.person.createMany({ data: rows as never[] }),
    );
    await batch(payload.journalEntries, (rows) =>
      tx.journalEntry.createMany({ data: rows as never[] }),
    );
    await batch(payload.journalLines, (rows) =>
      tx.journalLine.createMany({ data: rows as never[] }),
    );
    await batch(payload.quotes, (rows) =>
      tx.quote.createMany({ data: rows as never[] }),
    );
    await batch(payload.quoteItems, (rows) =>
      tx.quoteItem.createMany({ data: rows as never[] }),
    );
    await batch(payload.invoices, (rows) =>
      tx.invoice.createMany({ data: rows as never[] }),
    );
    await batch(payload.invoiceItems, (rows) =>
      tx.invoiceItem.createMany({ data: rows as never[] }),
    );
    await batch(payload.payments, (rows) =>
      tx.payment.createMany({ data: rows as never[] }),
    );
    await batch(payload.expenses, (rows) =>
      tx.expense.createMany({ data: rows as never[] }),
    );
    await batch(payload.bills, (rows) =>
      tx.bill.createMany({ data: rows as never[] }),
    );
    await batch(payload.billItems, (rows) =>
      tx.billItem.createMany({ data: rows as never[] }),
    );
    await batch(payload.billPayments, (rows) =>
      tx.billPayment.createMany({ data: rows as never[] }),
    );
    await batch(payload.bankTransactions, (rows) =>
      tx.bankTransaction.createMany({ data: rows as never[] }),
    );
    await batch(payload.exchangeRates, (rows) =>
      tx.exchangeRate.createMany({ data: rows as never[] }),
    );
    await batch(payload.documents, (rows) =>
      tx.document.createMany({ data: rows as never[] }),
    );
    await batch(payload.documentLinks, (rows) =>
      tx.documentLink.createMany({ data: rows as never[] }),
    );
    await batch(payload.gatewayCheckouts, (rows) =>
      tx.gatewayCheckout.createMany({ data: rows as never[] }),
    );
    if (payload.complianceProfile) {
      await tx.complianceProfile.create({
        data: payload.complianceProfile as never,
      });
    }
    await batch(payload.complianceRecords, (rows) =>
      tx.complianceRecord.createMany({ data: rows as never[] }),
    );
    await batch(payload.vatDocuments, (rows) =>
      tx.vatDocument.createMany({ data: rows as never[] }),
    );
    await batch(payload.withholdingEntries, (rows) =>
      tx.withholdingEntry.createMany({ data: rows as never[] }),
    );
    await batch(payload.challans, (rows) =>
      tx.challan.createMany({ data: rows as never[] }),
    );
    await batch(payload.serviceExportRecords, (rows) =>
      tx.serviceExportRecord.createMany({ data: rows as never[] }),
    );
    await batch(payload.employeeCompensations, (rows) =>
      tx.employeeCompensation.createMany({ data: rows as never[] }),
    );
    await batch(payload.assets, (rows) =>
      tx.asset.createMany({ data: rows as never[] }),
    );
    await batch(payload.timeEntries, (rows) =>
      tx.timeEntry.createMany({ data: rows as never[] }),
    );
    await batch(payload.payrollPeriods, (rows) =>
      tx.payrollPeriod.createMany({ data: rows as never[] }),
    );
    await batch(payload.payrollRuns, (rows) =>
      tx.payrollRun.createMany({ data: rows as never[] }),
    );
    await batch(payload.payrollItems, (rows) =>
      tx.payrollItem.createMany({ data: rows as never[] }),
    );
    await batch(payload.payslips, (rows) =>
      tx.payslip.createMany({ data: rows as never[] }),
    );
  });

  return { restored: true };
}
