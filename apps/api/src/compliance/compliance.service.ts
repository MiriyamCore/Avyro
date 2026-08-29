import { BadRequestException, Injectable } from '@nestjs/common';
import { prisma } from '@avyro/database';

@Injectable()
export class ComplianceService {
  async getProfile(organizationId: string) {
    let profile = await prisma.complianceProfile.findUnique({
      where: { organizationId },
    });
    if (!profile) {
      profile = await prisma.complianceProfile.create({
        data: { organizationId, countryCode: 'BD', vatRegistered: false },
      });
    }
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    return {
      ...profile,
      taxIdentifier: org.taxIdentifier,
      vatIdentifier: org.vatIdentifier,
      tradeLicenseNumber: org.tradeLicenseNumber,
      legalName: org.legalName,
      name: org.name,
    };
  }

  async updateProfile(
    organizationId: string,
    body: {
      vatRegistered?: boolean;
      notes?: string;
      taxIdentifier?: string | null;
      vatIdentifier?: string | null;
      tradeLicenseNumber?: string | null;
    },
  ) {
    await this.getProfile(organizationId);
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        taxIdentifier: body.taxIdentifier,
        vatIdentifier: body.vatIdentifier,
        tradeLicenseNumber: body.tradeLicenseNumber,
      },
    });
    return prisma.complianceProfile.update({
      where: { organizationId },
      data: {
        vatRegistered: body.vatRegistered,
        notes: body.notes,
      },
    });
  }

  listRecords(organizationId: string) {
    return prisma.complianceRecord.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  createRecord(
    organizationId: string,
    body: {
      type: 'TRADE_LICENCE' | 'TIN' | 'BIN_VAT' | 'FORM_C' | 'ERQ' | 'OTHER';
      label: string;
      identifier?: string;
      issuedOn?: string;
      expiresOn?: string;
      notes?: string;
    },
  ) {
    return prisma.complianceRecord.create({
      data: {
        organizationId,
        type: body.type,
        label: body.label,
        identifier: body.identifier,
        issuedOn: body.issuedOn ? new Date(body.issuedOn) : null,
        expiresOn: body.expiresOn ? new Date(body.expiresOn) : null,
        notes: body.notes,
      },
    });
  }

  listTaxCodes(organizationId: string) {
    return prisma.taxCode.findMany({
      where: { organizationId, active: true },
      orderBy: [{ kind: 'asc' }, { code: 'asc' }],
    });
  }

  async ensureDefaultTaxCodes(organizationId: string) {
    const defaults = [
      {
        code: 'VAT-STD',
        name: 'Standard VAT',
        kind: 'VAT',
        ratePercent: '15',
        notes: 'Starter default 15% — confirm with your accountant before filing.',
      },
      {
        code: 'VAT-ZERO-EXPORT',
        name: 'Zero-rated export services',
        kind: 'VAT',
        ratePercent: '0',
        notes: 'Zero-rated export of services (confirm eligibility).',
      },
      {
        code: 'TDS-SVC',
        name: 'TDS on services',
        kind: 'TDS',
        ratePercent: '10',
        notes: 'Starter 10% on services — section and rate are configurable.',
      },
      {
        code: 'VDS-SVC',
        name: 'VDS on services',
        kind: 'VDS',
        ratePercent: '5',
        notes: 'Starter 5% VDS on services — confirm current rule.',
      },
    ];
    const from = new Date('2024-07-01');
    for (const row of defaults) {
      const existing = await prisma.taxCode.findFirst({
        where: { organizationId, code: row.code, effectiveFrom: from },
      });
      if (!existing) {
        await prisma.taxCode.create({
          data: {
            organizationId,
            code: row.code,
            name: row.name,
            kind: row.kind,
            ratePercent: row.ratePercent,
            effectiveFrom: from,
            notes: row.notes,
          },
        });
      } else if (existing.ratePercent == null) {
        await prisma.taxCode.update({
          where: { id: existing.id },
          data: {
            ratePercent: row.ratePercent,
            name: row.name,
            notes: row.notes,
          },
        });
      }
    }
    return this.listTaxCodes(organizationId);
  }

  expiryReminders(organizationId: string) {
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 60);
    return prisma.complianceRecord.findMany({
      where: {
        organizationId,
        expiresOn: { lte: horizon, not: null },
        status: 'ACTIVE',
      },
      orderBy: { expiresOn: 'asc' },
    });
  }

  listChallans(organizationId: string) {
    return prisma.challan.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  createChallan(
    organizationId: string,
    body: {
      type: string;
      amount: string;
      paidOn?: string;
      reference?: string;
      notes?: string;
    },
  ) {
    return prisma.challan.create({
      data: {
        organizationId,
        type: body.type,
        amount: body.amount,
        paidOn: body.paidOn ? new Date(body.paidOn) : null,
        reference: body.reference,
        notes: body.notes,
      },
    });
  }

  listVatDocuments(organizationId: string) {
    return prisma.vatDocument.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  createVatDocument(
    organizationId: string,
    body: {
      type?: 'MUSHAK_6_1' | 'MUSHAK_6_3' | 'MUSHAK_9_1' | 'OTHER';
      partyName?: string;
      invoiceId?: string;
      billId?: string;
      taxableAmount: string;
      vatAmount: string;
      notes?: string;
    },
  ) {
    return prisma.vatDocument.create({
      data: {
        organizationId,
        type: body.type ?? 'OTHER',
        partyName: body.partyName,
        invoiceId: body.invoiceId,
        billId: body.billId,
        taxableAmount: body.taxableAmount,
        vatAmount: body.vatAmount,
        status: 'DRAFT',
        notes: body.notes,
      },
    });
  }

  listServiceExports(organizationId: string) {
    return prisma.serviceExportRecord.findMany({
      where: { organizationId },
      include: { invoice: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  createServiceExport(
    organizationId: string,
    body: {
      invoiceId?: string;
      formCRef?: string;
      erqRef?: string;
      remittanceNotes?: string;
      retentionFlag?: boolean;
    },
  ) {
    return prisma.serviceExportRecord.create({
      data: {
        organizationId,
        invoiceId: body.invoiceId,
        formCRef: body.formCRef,
        erqRef: body.erqRef,
        remittanceNotes: body.remittanceNotes,
        retentionFlag: body.retentionFlag ?? false,
      },
    });
  }

  listWithholdings(organizationId: string) {
    return prisma.withholdingEntry.findMany({
      where: { organizationId },
      include: { challan: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async linkWithholdingChallan(
    organizationId: string,
    withholdingId: string,
    challanId: string | null,
  ) {
    const entry = await prisma.withholdingEntry.findFirst({
      where: { id: withholdingId, organizationId },
    });
    if (!entry) {
      throw new BadRequestException({
        error: {
          code: 'WITHHOLDING_NOT_FOUND',
          message: 'Withholding entry not found.',
        },
      });
    }
    if (challanId) {
      const challan = await prisma.challan.findFirst({
        where: { id: challanId, organizationId },
      });
      if (!challan) {
        throw new BadRequestException({
          error: { code: 'CHALLAN_NOT_FOUND', message: 'Challan not found.' },
        });
      }
    }
    return prisma.withholdingEntry.update({
      where: { id: entry.id },
      data: { challanId },
      include: { challan: true },
    });
  }

  private csvEscape(value: string | number | null | undefined) {
    const s = value == null ? '' : String(value);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  async mushakSalesCsv(organizationId: string) {
    const docs = await prisma.vatDocument.findMany({
      where: {
        organizationId,
        OR: [{ type: 'MUSHAK_6_3' }, { invoiceId: { not: null } }],
      },
      include: {
        invoice: {
          include: { customer: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    const header = [
      'date',
      'type',
      'party',
      'invoice_id',
      'invoice_number',
      'taxable_amount',
      'vat_amount',
      'status',
      'notes',
    ];
    const lines = [header.join(',')];
    for (const d of docs) {
      lines.push(
        [
          d.createdAt.toISOString().slice(0, 10),
          d.type,
          this.csvEscape(d.partyName ?? d.invoice?.customer?.name ?? ''),
          d.invoiceId ?? '',
          this.csvEscape(d.invoice?.invoiceNumber ?? ''),
          d.taxableAmount.toString(),
          d.vatAmount.toString(),
          d.status,
          this.csvEscape(d.notes),
        ].join(','),
      );
    }
    // Also include issued invoices with tax when no VatDocument exists yet
    if (docs.length === 0) {
      const invoices = await prisma.invoice.findMany({
        where: {
          organizationId,
          status: { in: ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'PAID'] },
          taxTotal: { gt: 0 },
        },
        include: { customer: true },
        orderBy: { issueDate: 'asc' },
      });
      for (const inv of invoices) {
        lines.push(
          [
            inv.issueDate.toISOString().slice(0, 10),
            'INVOICE',
            this.csvEscape(inv.customer.name),
            inv.id,
            this.csvEscape(inv.invoiceNumber),
            inv.subtotal.toString(),
            inv.taxTotal.toString(),
            inv.status,
            '',
          ].join(','),
        );
      }
    }
    return lines.join('\n') + '\n';
  }

  async mushakPurchaseCsv(organizationId: string) {
    const docs = await prisma.vatDocument.findMany({
      where: {
        organizationId,
        OR: [{ type: 'MUSHAK_6_1' }, { billId: { not: null } }],
      },
      include: { bill: { include: { supplier: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const withholdings = await prisma.withholdingEntry.findMany({
      where: { organizationId },
      include: { bill: { include: { supplier: true } }, challan: true },
      orderBy: { createdAt: 'asc' },
    });
    const header = [
      'date',
      'source',
      'kind',
      'party',
      'bill_id',
      'base_amount',
      'rate_percent',
      'tax_or_vat_amount',
      'challan_ref',
      'notes',
    ];
    const lines = [header.join(',')];
    for (const d of docs) {
      lines.push(
        [
          d.createdAt.toISOString().slice(0, 10),
          'VAT_DOCUMENT',
          d.type,
          this.csvEscape(d.partyName ?? d.bill?.supplier?.name ?? ''),
          d.billId ?? '',
          d.taxableAmount.toString(),
          '',
          d.vatAmount.toString(),
          '',
          this.csvEscape(d.notes),
        ].join(','),
      );
    }
    for (const w of withholdings) {
      lines.push(
        [
          w.createdAt.toISOString().slice(0, 10),
          'WITHHOLDING',
          w.kind,
          this.csvEscape(w.bill?.supplier?.name ?? ''),
          w.billId ?? '',
          w.baseAmount.toString(),
          w.ratePercent.toString(),
          w.amount.toString(),
          this.csvEscape(w.challan?.reference ?? ''),
          this.csvEscape(w.notes),
        ].join(','),
      );
    }
    return lines.join('\n') + '\n';
  }

  async updateTaxCodeRate(
    organizationId: string,
    taxCodeId: string,
    ratePercent: string | null,
  ) {
    const code = await prisma.taxCode.findFirst({
      where: { id: taxCodeId, organizationId },
    });
    if (!code) {
      throw new BadRequestException({
        error: { code: 'TAX_CODE_NOT_FOUND', message: 'Tax code not found.' },
      });
    }
    return prisma.taxCode.update({
      where: { id: code.id },
      data: { ratePercent },
    });
  }

  private async mushakSalesRows(organizationId: string) {
    const docs = await prisma.vatDocument.findMany({
      where: {
        organizationId,
        OR: [{ type: 'MUSHAK_6_3' }, { invoiceId: { not: null } }],
      },
      include: {
        invoice: {
          include: { customer: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    const headers = [
      'Date',
      'Type',
      'Party',
      'Invoice #',
      'Taxable (BDT)',
      'VAT (BDT)',
      'Status',
      'Notes',
    ];
    const rows: string[][] = [];
    for (const d of docs) {
      rows.push([
        d.createdAt.toISOString().slice(0, 10),
        d.type,
        d.partyName ?? d.invoice?.customer?.name ?? '',
        d.invoice?.invoiceNumber ?? '',
        d.taxableAmount.toString(),
        d.vatAmount.toString(),
        d.status,
        d.notes ?? '',
      ]);
    }
    if (docs.length === 0) {
      const invoices = await prisma.invoice.findMany({
        where: {
          organizationId,
          status: { in: ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'PAID'] },
          taxTotal: { gt: 0 },
        },
        include: { customer: true },
        orderBy: { issueDate: 'asc' },
      });
      for (const inv of invoices) {
        rows.push([
          inv.issueDate.toISOString().slice(0, 10),
          'INVOICE',
          inv.customer.name,
          inv.invoiceNumber ?? '',
          inv.subtotal.toString(),
          inv.taxTotal.toString(),
          inv.status,
          '',
        ]);
      }
    }
    return { headers, rows };
  }

  private async mushakPurchaseRows(organizationId: string) {
    const docs = await prisma.vatDocument.findMany({
      where: {
        organizationId,
        OR: [{ type: 'MUSHAK_6_1' }, { billId: { not: null } }],
      },
      include: { bill: { include: { supplier: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const withholdings = await prisma.withholdingEntry.findMany({
      where: { organizationId },
      include: { bill: { include: { supplier: true } }, challan: true },
      orderBy: { createdAt: 'asc' },
    });
    const headers = [
      'Date',
      'Source',
      'Kind',
      'Party',
      'Bill ref',
      'Base (BDT)',
      'Rate %',
      'Tax/VAT (BDT)',
      'Challan',
      'Notes',
    ];
    const rows: string[][] = [];
    for (const d of docs) {
      rows.push([
        d.createdAt.toISOString().slice(0, 10),
        'VAT_DOCUMENT',
        d.type,
        d.partyName ?? d.bill?.supplier?.name ?? '',
        d.billId ?? '',
        d.taxableAmount.toString(),
        '',
        d.vatAmount.toString(),
        '',
        d.notes ?? '',
      ]);
    }
    for (const w of withholdings) {
      rows.push([
        w.createdAt.toISOString().slice(0, 10),
        'WITHHOLDING',
        w.kind,
        w.bill?.supplier?.name ?? '',
        w.billId ?? '',
        w.baseAmount.toString(),
        w.ratePercent.toString(),
        w.amount.toString(),
        w.challan?.reference ?? '',
        w.notes ?? '',
      ]);
    }
    return { headers, rows };
  }

  async mushakSalesPdf(organizationId: string) {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    const { headers, rows } = await this.mushakSalesRows(organizationId);
    const { buildMushakRegisterPdf } = await import('./mushak-register-pdf.js');
    return buildMushakRegisterPdf({
      organizationName: org.name,
      taxIdentifier: org.taxIdentifier,
      vatIdentifier: org.vatIdentifier,
      title: 'Mushak-6.3 — Sales Register (VAT)',
      formRef: 'Mushak-6.3 / Sales VAT register',
      headers,
      rows,
      generatedAt: new Date().toISOString().slice(0, 10),
    });
  }

  async mushakPurchasePdf(organizationId: string) {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    const { headers, rows } = await this.mushakPurchaseRows(organizationId);
    const { buildMushakRegisterPdf } = await import('./mushak-register-pdf.js');
    return buildMushakRegisterPdf({
      organizationName: org.name,
      taxIdentifier: org.taxIdentifier,
      vatIdentifier: org.vatIdentifier,
      title: 'Mushak-6.1 — Purchase Register (VAT / Withholding)',
      formRef: 'Mushak-6.1 / Purchase & withholding register',
      headers,
      rows,
      generatedAt: new Date().toISOString().slice(0, 10),
    });
  }

  async mushak91Csv(organizationId: string, year: number, month: number) {
    const { headers, rows } = await import('./compliance-exports.js').then((m) =>
      m.mushak91WorksheetRows(organizationId, year, month),
    );
    return import('./compliance-exports.js').then((m) => m.rowsToCsv(headers, rows));
  }

  async mushak91Pdf(organizationId: string, year: number, month: number) {
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
    const { headers, rows, period } = await import('./compliance-exports.js').then((m) =>
      m.mushak91WorksheetRows(organizationId, year, month),
    );
    const { buildMushakRegisterPdf } = await import('./mushak-register-pdf.js');
    return buildMushakRegisterPdf({
      organizationName: org.name,
      taxIdentifier: org.taxIdentifier,
      vatIdentifier: org.vatIdentifier,
      title: `Mushak-9.1 — Monthly VAT worksheet (${period})`,
      formRef: 'Mushak-9.1 / Monthly VAT return worksheet (export only)',
      headers,
      rows,
      generatedAt: new Date().toISOString().slice(0, 10),
    });
  }

  async mushak621Csv(organizationId: string) {
    const { headers, rows } = await import('./compliance-exports.js').then((m) =>
      m.mushak621CombinedRows(organizationId),
    );
    return import('./compliance-exports.js').then((m) => m.rowsToCsv(headers, rows));
  }

  async mushak621Pdf(organizationId: string) {
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
    const { headers, rows } = await import('./compliance-exports.js').then((m) =>
      m.mushak621CombinedRows(organizationId),
    );
    const { buildMushakRegisterPdf } = await import('./mushak-register-pdf.js');
    return buildMushakRegisterPdf({
      organizationName: org.name,
      taxIdentifier: org.taxIdentifier,
      vatIdentifier: org.vatIdentifier,
      title: 'Mushak-6.2.1 — Combined purchase-sales register',
      formRef: 'Mushak-6.2.1 / Purchase-sales register',
      headers,
      rows,
      generatedAt: new Date().toISOString().slice(0, 10),
    });
  }

  async vdsCertificateCsv(organizationId: string, form: '6.6' | '6.10') {
    const { headers, rows } = await import('./compliance-exports.js').then((m) =>
      m.vdsCertificateRows(organizationId, form),
    );
    return import('./compliance-exports.js').then((m) => m.rowsToCsv(headers, rows));
  }

  async vdsCertificatePdf(organizationId: string, form: '6.6' | '6.10') {
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
    const { headers, rows } = await import('./compliance-exports.js').then((m) =>
      m.vdsCertificateRows(organizationId, form),
    );
    const { buildMushakRegisterPdf } = await import('./mushak-register-pdf.js');
    return buildMushakRegisterPdf({
      organizationName: org.name,
      taxIdentifier: org.taxIdentifier,
      vatIdentifier: org.vatIdentifier,
      title: `Mushak-${form} — VDS certificate register`,
      formRef: `Mushak-${form} / VAT deducted at source certificates`,
      headers,
      rows,
      generatedAt: new Date().toISOString().slice(0, 10),
    });
  }

  async creditNoteCsv(organizationId: string) {
    const { headers, rows } = await import('./compliance-exports.js').then((m) =>
      m.creditDebitNoteRows(organizationId, 'credit'),
    );
    return import('./compliance-exports.js').then((m) => m.rowsToCsv(headers, rows));
  }

  async creditNotePdf(organizationId: string) {
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
    const { headers, rows } = await import('./compliance-exports.js').then((m) =>
      m.creditDebitNoteRows(organizationId, 'credit'),
    );
    const { buildMushakRegisterPdf } = await import('./mushak-register-pdf.js');
    return buildMushakRegisterPdf({
      organizationName: org.name,
      taxIdentifier: org.taxIdentifier,
      vatIdentifier: org.vatIdentifier,
      title: 'Mushak-6.7 — Credit notes',
      formRef: 'Mushak-6.7 / Credit note register',
      headers,
      rows,
      generatedAt: new Date().toISOString().slice(0, 10),
    });
  }

  async debitNoteCsv(organizationId: string) {
    const { headers, rows } = await import('./compliance-exports.js').then((m) =>
      m.creditDebitNoteRows(organizationId, 'debit'),
    );
    return import('./compliance-exports.js').then((m) => m.rowsToCsv(headers, rows));
  }

  async debitNotePdf(organizationId: string) {
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
    const { headers, rows } = await import('./compliance-exports.js').then((m) =>
      m.creditDebitNoteRows(organizationId, 'debit'),
    );
    const { buildMushakRegisterPdf } = await import('./mushak-register-pdf.js');
    return buildMushakRegisterPdf({
      organizationName: org.name,
      taxIdentifier: org.taxIdentifier,
      vatIdentifier: org.vatIdentifier,
      title: 'Mushak-6.8 — Debit notes',
      formRef: 'Mushak-6.8 / Debit note register',
      headers,
      rows,
      generatedAt: new Date().toISOString().slice(0, 10),
    });
  }

  eReturnEvidencePack(organizationId: string, fiscalYearEnd?: string) {
    return import('./compliance-exports.js').then((m) =>
      m.buildEReturnEvidencePack(organizationId, fiscalYearEnd),
    );
  }
}
