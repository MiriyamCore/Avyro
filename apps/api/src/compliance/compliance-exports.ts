import { prisma } from '@avyro/database';
import { AccountingPostingService } from '@avyro/accounting';
import { Decimal } from 'decimal.js';
import { ReportsService } from '../reports/reports.service.js';

function csvEscape(value: string | number | null | undefined) {
  const s = value == null ? '' : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return { start, end };
}

export async function mushak91WorksheetRows(organizationId: string, year: number, month: number) {
  const { start, end } = monthRange(year, month);
  const salesInvoices = await prisma.invoice.findMany({
    where: {
      organizationId,
      status: { in: ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CREDITED'] },
      issueDate: { gte: start, lte: end },
    },
    include: { customer: true },
  });
  const bills = await prisma.bill.findMany({
    where: {
      organizationId,
      status: { in: ['OPEN', 'PARTIALLY_PAID', 'PAID'] },
      billDate: { gte: start, lte: end },
    },
    include: { supplier: true, items: true },
  });
  const withholdings = await prisma.withholdingEntry.findMany({
    where: {
      organizationId,
      createdAt: { gte: start, lte: new Date(end.getTime() + 86400000) },
    },
  });

  const outputVat = salesInvoices.reduce(
    (s, i) => s.plus(i.taxTotal.toString()),
    new Decimal(0),
  );
  const inputVat = bills.reduce((s, b) => {
    if (b.reverseCharge) return s;
    return s.plus(b.taxTotal.toString());
  }, new Decimal(0));
  const reverseChargeVat = bills
    .filter((b) => b.reverseCharge)
    .reduce((s, b) => s.plus(b.taxTotal.toString()), new Decimal(0));
  const vdsTotal = withholdings
    .filter((w) => w.kind === 'VDS')
    .reduce((s, w) => s.plus(w.amount.toString()), new Decimal(0));

  const headers = ['Section', 'Description', 'Amount (BDT)', 'Count'];
  const rows: string[][] = [
    ['1', 'Output VAT (sales invoices)', outputVat.toFixed(2), String(salesInvoices.length)],
    ['2', 'Input VAT (purchases)', inputVat.toFixed(2), String(bills.filter((b) => !b.reverseCharge).length)],
    ['3', 'Reverse-charge VAT (imported services)', reverseChargeVat.toFixed(2), String(bills.filter((b) => b.reverseCharge).length)],
    ['4', 'VDS withheld', vdsTotal.toFixed(2), String(withholdings.filter((w) => w.kind === 'VDS').length)],
    [
      '5',
      'Net VAT payable (illustrative)',
      outputVat.plus(reverseChargeVat).minus(inputVat).minus(vdsTotal).toFixed(2),
      '',
    ],
  ];
  return {
    period: `${year}-${String(month).padStart(2, '0')}`,
    headers,
    rows,
    summary: {
      outputVat: outputVat.toFixed(2),
      inputVat: inputVat.toFixed(2),
      reverseChargeVat: reverseChargeVat.toFixed(2),
      vdsTotal: vdsTotal.toFixed(2),
      netPayable: outputVat.plus(reverseChargeVat).minus(inputVat).minus(vdsTotal).toFixed(2),
    },
  };
}

export function rowsToCsv(headers: string[], rows: string[][]) {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(row.map((c) => csvEscape(c)).join(','));
  }
  return lines.join('\n') + '\n';
}

export async function mushak621CombinedRows(organizationId: string) {
  const sales = await prisma.invoice.findMany({
    where: {
      organizationId,
      status: { in: ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'] },
    },
    include: { customer: true },
    orderBy: { issueDate: 'asc' },
  });
  const bills = await prisma.bill.findMany({
    where: {
      organizationId,
      status: { in: ['OPEN', 'PARTIALLY_PAID', 'PAID'] },
    },
    include: { supplier: true, items: true },
    orderBy: { billDate: 'asc' },
  });
  const headers = [
    'Date',
    'Direction',
    'Party',
    'Document',
    'Taxable (BDT)',
    'VAT (BDT)',
    'ITC status',
    'Notes',
  ];
  const rows: string[][] = [];
  for (const inv of sales) {
    rows.push([
      inv.issueDate.toISOString().slice(0, 10),
      'SALE',
      inv.customer.name,
      inv.invoiceNumber ?? inv.id,
      inv.subtotal.toString(),
      inv.taxTotal.toString(),
      'N/A',
      '',
    ]);
  }
  for (const bill of bills) {
    const itcStatuses = [...new Set(bill.items.map((i) => i.itcStatus))].join('/');
    rows.push([
      bill.billDate.toISOString().slice(0, 10),
      'PURCHASE',
      bill.supplier.name,
      bill.billNumber ?? bill.id,
      bill.subtotal.toString(),
      bill.taxTotal.toString(),
      itcStatuses || 'CLAIMABLE',
      bill.reverseCharge ? 'Reverse charge' : '',
    ]);
  }
  rows.sort((a, b) => (a[0] ?? '').localeCompare(b[0] ?? ''));
  return { headers, rows };
}

export async function vdsCertificateRows(organizationId: string, form: '6.6' | '6.10') {
  const entries = await prisma.withholdingEntry.findMany({
    where: { organizationId, kind: 'VDS' },
    include: { bill: { include: { supplier: true } }, challan: true },
    orderBy: { createdAt: 'asc' },
  });
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
  const headers = [
    'Certificate ref',
    'Form',
    'Date',
    'Supplier',
    'Supplier BIN',
    'Base (BDT)',
    'Rate %',
    'VDS (BDT)',
    'Challan ref',
    'Issuer BIN',
  ];
  const rows = entries.map((e, idx) => [
    `VDS-${form}-${String(idx + 1).padStart(4, '0')}`,
    `Mushak-${form}`,
    e.createdAt.toISOString().slice(0, 10),
    e.bill?.supplier?.name ?? '',
    e.bill?.supplier?.vatIdentifier ?? '',
    e.baseAmount.toString(),
    e.ratePercent.toString(),
    e.amount.toString(),
    e.challan?.reference ?? '',
    org.vatIdentifier ?? '',
  ]);
  return { headers, rows, organizationName: org.name };
}

export async function creditDebitNoteRows(organizationId: string, kind: 'credit' | 'debit') {
  if (kind === 'credit') {
    const journals = await prisma.journalEntry.findMany({
      where: { organizationId, sourceType: 'credit_note', status: 'POSTED' },
      orderBy: { entryDate: 'desc' },
      take: 200,
    });
    const headers = ['Date', 'Form', 'Invoice ref', 'Description', 'Amount (BDT)'];
    const rows: string[][] = [];
    for (const j of journals) {
      const invoice = j.sourceId
        ? await prisma.invoice.findFirst({ where: { id: j.sourceId, organizationId } })
        : null;
      const debitLine = await prisma.journalLine.findFirst({
        where: { journalEntryId: j.id, debitAmount: { gt: 0 } },
      });
      rows.push([
        j.entryDate.toISOString().slice(0, 10),
        'Mushak-6.7',
        invoice?.invoiceNumber ?? j.sourceId ?? '',
        j.description,
        debitLine?.debitAmount.toString() ?? '',
      ]);
    }
    return { headers, rows, formRef: 'Mushak-6.7 Credit note' };
  }

  const bills = await prisma.bill.findMany({
    where: { organizationId, notes: { contains: 'debit note', mode: 'insensitive' } },
    include: { supplier: true },
    orderBy: { billDate: 'desc' },
    take: 100,
  });
  const headers = ['Date', 'Form', 'Bill ref', 'Supplier', 'Amount (BDT)', 'Notes'];
  const rows = bills.map((b) => [
    b.billDate.toISOString().slice(0, 10),
    'Mushak-6.8',
    b.billNumber ?? b.id,
    b.supplier.name,
    b.grandTotal.toString(),
    b.notes ?? '',
  ]);
  return { headers, rows, formRef: 'Mushak-6.8 Debit note' };
}

export async function buildEReturnEvidencePack(organizationId: string, fiscalYearEnd?: string) {
  const reports = new ReportsService();
  const posting = new AccountingPostingService(prisma);
  const asOf = fiscalYearEnd ?? new Date().toISOString().slice(0, 10);

  const [org, pl, bs, challans, bankAccounts, serviceExports, assets, tb] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: organizationId } }),
    reports.profitAndLoss(organizationId, undefined, asOf),
    reports.balanceSheet(organizationId, asOf),
    prisma.challan.findMany({ where: { organizationId }, orderBy: { paidOn: 'asc' } }),
    prisma.bankAccount.findMany({ where: { organizationId, status: 'ACTIVE' } }),
    prisma.serviceExportRecord.findMany({
      where: { organizationId },
      include: { invoice: { include: { customer: true } } },
    }),
    prisma.asset.findMany({ where: { organizationId } }),
    posting.trialBalance(organizationId, new Date(asOf)),
  ]);

  const bankReconSummaries = await Promise.all(
    bankAccounts.map(async (acct) => {
      const txns = await prisma.bankTransaction.findMany({
        where: { organizationId, bankAccountId: acct.id },
        orderBy: { txnDate: 'desc' },
        take: 500,
      });
      const imported = txns.filter((t) => t.status === 'IMPORTED').length;
      const matched = txns.filter((t) => t.status === 'MATCHED').length;
      const ledgerBalance = tb.rows.find((r) => {
        const la = acct.ledgerAccountId;
        return la;
      });
      const latestBalance = txns.find((t) => t.balance != null)?.balance?.toString() ?? null;
      return {
        bankAccountId: acct.id,
        name: acct.name,
        currency: acct.currency,
        importedUnmatched: imported,
        matched,
        statementBalance: latestBalance,
        openingBalance: acct.openingBalance.toString(),
        ledgerNote: ledgerBalance ? 'See trial balance for ledger cash/bank' : null,
      };
    }),
  );

  const ownerEquity = tb.rows
    .filter((r) => r.code.startsWith('3') && !['3400', '3500'].includes(r.code))
    .map((r) => ({
      code: r.code,
      name: r.name,
      balance: new Decimal(r.credit).minus(r.debit).toFixed(2),
    }));

  return {
    generatedAt: new Date().toISOString(),
    organization: {
      name: org.name,
      legalName: org.legalName,
      taxIdentifier: org.taxIdentifier,
      vatIdentifier: org.vatIdentifier,
      countryCode: org.countryCode,
      fiscalYearStartMonth: org.fiscalYearStartMonth,
    },
    asOf,
    profitAndLoss: pl,
    balanceSheet: bs,
    bankReconciliationSummary: bankReconSummaries,
    challanRegister: challans.map((c) => ({
      id: c.id,
      type: c.type,
      amount: c.amount.toString(),
      paidOn: c.paidOn?.toISOString().slice(0, 10) ?? null,
      reference: c.reference,
      notes: c.notes,
    })),
    exportRemittanceSchedule: serviceExports.map((s) => ({
      id: s.id,
      invoiceNumber: s.invoice?.invoiceNumber,
      customer: s.invoice?.customer?.name,
      formCRef: s.formCRef,
      erqRef: s.erqRef,
      remittanceNotes: s.remittanceNotes,
    })),
    ownerCapitalDrawings: ownerEquity,
    relatedPartyNote: 'See /reports/related-party for related-party schedule',
    assetRegister: assets.map((a) => ({
      id: a.id,
      name: a.name,
      category: a.category,
      cost: a.cost.toString(),
      purchaseDate: a.purchaseDate.toISOString().slice(0, 10),
      status: a.status,
    })),
    disclaimer:
      'Illustrative e-Return evidence pack for sole proprietorship management accounts — not a filed return.',
  };
}
