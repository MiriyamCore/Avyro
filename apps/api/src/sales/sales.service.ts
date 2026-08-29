import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@avyro/database';
import {
  AccountingError,
  AccountingPostingService,
} from '@avyro/accounting';
import { Decimal } from 'decimal.js';

@Injectable()
export class SalesService {
  private readonly posting = new AccountingPostingService(prisma);

  listQuotes(organizationId: string) {
    return prisma.quote.findMany({
      where: { organizationId },
      include: { customer: true, items: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async createQuote(
    organizationId: string,
    userId: string,
    body: {
      customerId: string;
      issueDate: string;
      validUntil: string;
      currency?: string;
      exchangeRate?: string;
      notes?: string;
      items: Array<{ description: string; quantity: string; unitPrice: string }>;
    },
  ) {
    if (!body.items?.length) {
      throw new BadRequestException({
        error: { code: 'NO_ITEMS', message: 'Add at least one line item.' },
      });
    }
    const customer = await prisma.customer.findFirst({
      where: { id: body.customerId, organizationId },
    });
    if (!customer) {
      throw new BadRequestException({
        error: { code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found.' },
      });
    }

    let subtotal = new Decimal(0);
    const items = body.items.map((item, index) => {
      const quantity = new Decimal(item.quantity || 0);
      const unitPrice = new Decimal(item.unitPrice || 0);
      const lineTotal = quantity.times(unitPrice);
      subtotal = subtotal.plus(lineTotal);
      return {
        description: item.description,
        quantity: quantity.toFixed(6),
        unitPrice: unitPrice.toFixed(6),
        lineTotal: lineTotal.toFixed(6),
        sortOrder: index,
      };
    });

    const count = await prisma.quote.count({ where: { organizationId } });
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { quotePrefix: true },
    });
    const prefix = (org.quotePrefix?.trim() || 'Q-').replace(/-+$/, '-') || 'Q-';
    const quoteNumber = `${prefix}${new Date().getUTCFullYear()}-${String(count + 1).padStart(4, '0')}`;

    return prisma.quote.create({
      data: {
        organizationId,
        customerId: customer.id,
        quoteNumber,
        issueDate: new Date(body.issueDate),
        validUntil: new Date(body.validUntil),
        currency: body.currency ?? customer.defaultCurrency,
        exchangeRate: body.exchangeRate ?? '1',
        status: 'SENT',
        subtotal: subtotal.toFixed(6),
        taxTotal: '0',
        grandTotal: subtotal.toFixed(6),
        notes: body.notes,
        createdById: userId,
        items: { create: items },
      },
      include: { customer: true, items: true },
    });
  }

  async updateQuote(
    organizationId: string,
    quoteId: string,
    body: {
      issueDate?: string;
      validUntil?: string;
      currency?: string;
      notes?: string | null;
      status?: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'CONVERTED' | 'VOID';
      items?: Array<{ description: string; quantity: string; unitPrice: string }>;
    },
  ) {
    const quote = await this.getQuote(organizationId, quoteId);
    if (quote.status === 'CONVERTED') {
      throw new BadRequestException({
        error: { code: 'QUOTE_CONVERTED', message: 'Converted quotes cannot be edited.' },
      });
    }

    let subtotal = new Decimal(quote.subtotal.toString());
    let itemsUpdate:
      | {
          deleteMany: Record<string, never>;
          create: Array<{
            description: string;
            quantity: string;
            unitPrice: string;
            lineTotal: string;
            sortOrder: number;
          }>;
        }
      | undefined;

    if (body.items?.length) {
      subtotal = new Decimal(0);
      const items = body.items.map((item, index) => {
        const quantity = new Decimal(item.quantity || 0);
        const unitPrice = new Decimal(item.unitPrice || 0);
        const lineTotal = quantity.times(unitPrice);
        subtotal = subtotal.plus(lineTotal);
        return {
          description: item.description,
          quantity: quantity.toFixed(6),
          unitPrice: unitPrice.toFixed(6),
          lineTotal: lineTotal.toFixed(6),
          sortOrder: index,
        };
      });
      itemsUpdate = { deleteMany: {}, create: items };
    }

    return prisma.quote.update({
      where: { id: quote.id },
      data: {
        ...(body.issueDate ? { issueDate: new Date(body.issueDate) } : {}),
        ...(body.validUntil ? { validUntil: new Date(body.validUntil) } : {}),
        ...(body.currency ? { currency: body.currency } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(body.status ? { status: body.status } : {}),
        ...(itemsUpdate
          ? {
              subtotal: subtotal.toFixed(6),
              grandTotal: subtotal.toFixed(6),
              items: itemsUpdate,
            }
          : {}),
      },
      include: { customer: true, items: true },
    });
  }

  async convertQuoteToInvoice(
    organizationId: string,
    userId: string,
    quoteId: string,
  ) {
    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, organizationId },
      include: { items: true, customer: true },
    });
    if (!quote) {
      throw new NotFoundException({
        error: { code: 'QUOTE_NOT_FOUND', message: 'Quote not found.' },
      });
    }
    if (quote.status === 'CONVERTED') {
      throw new BadRequestException({
        error: { code: 'QUOTE_ALREADY_CONVERTED', message: 'Quote already converted.' },
      });
    }

    const invoice = await this.createInvoice(organizationId, userId, {
      customerId: quote.customerId,
      issueDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      currency: quote.currency,
      exchangeRate: quote.exchangeRate.toString(),
      notes: quote.notes ?? undefined,
      items: quote.items.map((item) => ({
        description: item.description,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(),
      })),
    });

    const issued = await this.issueInvoice(organizationId, userId, invoice.id);
    await prisma.quote.update({
      where: { id: quote.id },
      data: { status: 'CONVERTED', convertedInvoiceId: issued.id },
    });
    return issued;
  }

  listCustomers(organizationId: string) {
    return prisma.customer.findMany({
      where: { organizationId, status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    });
  }

  async createCustomer(
    organizationId: string,
    body: {
      name: string;
      legalName?: string;
      type?: 'BUSINESS' | 'INDIVIDUAL' | 'GOVERNMENT' | 'OTHER';
      countryCode?: string;
      contactPerson?: string;
      address?: string;
      billingAddress?: string;
      shippingAddress?: string;
      email?: string;
      phone?: string;
      defaultCurrency?: string;
      defaultPaymentTermsDays?: number;
      creditLimit?: string;
      isRelatedParty?: boolean;
      notes?: string;
      taxIdentifier?: string;
      vatIdentifier?: string;
    },
  ) {
    const count = await prisma.customer.count({ where: { organizationId } });
    const customerNumber = `CUS-${String(count + 1).padStart(4, '0')}`;
    const billing = body.billingAddress ?? body.address;
    return prisma.customer.create({
      data: {
        organizationId,
        customerNumber,
        name: body.name,
        legalName: body.legalName,
        type: body.type ?? 'BUSINESS',
        countryCode: body.countryCode ?? 'BD',
        contactPerson: body.contactPerson,
        address: billing ?? body.address,
        billingAddress: billing,
        shippingAddress: body.shippingAddress,
        email: body.email,
        phone: body.phone,
        taxIdentifier: body.taxIdentifier,
        vatIdentifier: body.vatIdentifier,
        defaultCurrency: body.defaultCurrency ?? 'BDT',
        defaultPaymentTermsDays: body.defaultPaymentTermsDays ?? 30,
        creditLimit: body.creditLimit ?? null,
        isRelatedParty: body.isRelatedParty ?? false,
        notes: body.notes,
      },
    });
  }

  async updateCustomer(
    organizationId: string,
    customerId: string,
    body: {
      name?: string;
      legalName?: string | null;
      type?: 'BUSINESS' | 'INDIVIDUAL' | 'GOVERNMENT' | 'OTHER';
      countryCode?: string;
      contactPerson?: string | null;
      address?: string | null;
      billingAddress?: string | null;
      shippingAddress?: string | null;
      email?: string | null;
      phone?: string | null;
      website?: string | null;
      taxIdentifier?: string | null;
      vatIdentifier?: string | null;
      defaultCurrency?: string;
      defaultPaymentTermsDays?: number;
      creditLimit?: string | null;
      isRelatedParty?: boolean;
      notes?: string | null;
    },
  ) {
    const existing = await prisma.customer.findFirst({
      where: { id: customerId, organizationId },
    });
    if (!existing) {
      throw new NotFoundException({
        error: { code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found.' },
      });
    }
    return prisma.customer.update({
      where: { id: customerId },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.legalName !== undefined ? { legalName: body.legalName?.trim() || null } : {}),
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(body.countryCode !== undefined ? { countryCode: body.countryCode } : {}),
        ...(body.contactPerson !== undefined
          ? { contactPerson: body.contactPerson?.trim() || null }
          : {}),
        ...(body.address !== undefined ? { address: body.address?.trim() || null } : {}),
        ...(body.billingAddress !== undefined
          ? { billingAddress: body.billingAddress?.trim() || null }
          : {}),
        ...(body.shippingAddress !== undefined
          ? { shippingAddress: body.shippingAddress?.trim() || null }
          : {}),
        ...(body.email !== undefined ? { email: body.email?.trim() || null } : {}),
        ...(body.phone !== undefined ? { phone: body.phone?.trim() || null } : {}),
        ...(body.website !== undefined ? { website: body.website?.trim() || null } : {}),
        ...(body.taxIdentifier !== undefined
          ? { taxIdentifier: body.taxIdentifier?.trim() || null }
          : {}),
        ...(body.vatIdentifier !== undefined
          ? { vatIdentifier: body.vatIdentifier?.trim() || null }
          : {}),
        ...(body.defaultCurrency !== undefined ? { defaultCurrency: body.defaultCurrency } : {}),
        ...(body.defaultPaymentTermsDays !== undefined
          ? { defaultPaymentTermsDays: body.defaultPaymentTermsDays }
          : {}),
        ...(body.creditLimit !== undefined ? { creditLimit: body.creditLimit } : {}),
        ...(body.isRelatedParty !== undefined ? { isRelatedParty: body.isRelatedParty } : {}),
        ...(body.notes !== undefined ? { notes: body.notes?.trim() || null } : {}),
      },
    });
  }

  listInvoices(organizationId: string) {
    return prisma.invoice.findMany({
      where: { organizationId },
      include: { customer: true, items: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getInvoice(organizationId: string, invoiceId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId },
      include: { customer: true, items: true, payments: true },
    });
    if (!invoice) {
      throw new NotFoundException({
        error: { code: 'INVOICE_NOT_FOUND', message: 'Invoice not found.' },
      });
    }
    return invoice;
  }

  async updateInvoice(
    organizationId: string,
    invoiceId: string,
    body: {
      issueDate?: string;
      dueDate?: string;
      currency?: string;
      notes?: string | null;
      taxCodeId?: string | null;
      items?: Array<{ description: string; quantity: string; unitPrice: string }>;
    },
  ) {
    const invoice = await this.getInvoice(organizationId, invoiceId);
    if (invoice.status !== 'DRAFT') {
      throw new BadRequestException({
        error: {
          code: 'INVOICE_NOT_DRAFT',
          message: 'Only draft invoices can be edited.',
        },
      });
    }

    let subtotal = new Decimal(invoice.subtotal.toString());
    let taxTotal = new Decimal(invoice.taxTotal.toString());
    let grandTotal = new Decimal(invoice.grandTotal.toString());
    let taxCodeId = invoice.taxCodeId;

    if (body.items?.length) {
      subtotal = new Decimal(0);
      const items = body.items.map((item, index) => {
        const quantity = new Decimal(item.quantity || 0);
        const unitPrice = new Decimal(item.unitPrice || 0);
        const lineTotal = quantity.times(unitPrice);
        subtotal = subtotal.plus(lineTotal);
        return {
          description: item.description,
          quantity: quantity.toFixed(6),
          unitPrice: unitPrice.toFixed(6),
          lineTotal: lineTotal.toFixed(6),
          sortOrder: index,
        };
      });

      taxTotal = new Decimal(0);
      const effectiveTaxCodeId =
        body.taxCodeId !== undefined ? body.taxCodeId : invoice.taxCodeId;
      if (effectiveTaxCodeId) {
        const taxCode = await prisma.taxCode.findFirst({
          where: { id: effectiveTaxCodeId, organizationId, active: true },
        });
        if (taxCode?.ratePercent != null) {
          taxTotal = subtotal.times(taxCode.ratePercent.toString()).dividedBy(100);
        }
        taxCodeId = taxCode?.id ?? null;
      } else {
        taxCodeId = null;
      }
      grandTotal = subtotal.plus(taxTotal);

      await prisma.invoiceItem.deleteMany({ where: { invoiceId: invoice.id } });
      await prisma.invoiceItem.createMany({
        data: items.map((item) => ({ ...item, invoiceId: invoice.id })),
      });
    } else if (body.taxCodeId !== undefined) {
      taxCodeId = body.taxCodeId;
      taxTotal = new Decimal(0);
      if (body.taxCodeId) {
        const taxCode = await prisma.taxCode.findFirst({
          where: { id: body.taxCodeId, organizationId, active: true },
        });
        if (taxCode?.ratePercent != null) {
          taxTotal = subtotal.times(taxCode.ratePercent.toString()).dividedBy(100);
        }
      }
      grandTotal = subtotal.plus(taxTotal);
    }

    return prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        ...(body.issueDate !== undefined ? { issueDate: new Date(body.issueDate) } : {}),
        ...(body.dueDate !== undefined ? { dueDate: new Date(body.dueDate) } : {}),
        ...(body.currency !== undefined ? { currency: body.currency } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(body.items !== undefined || body.taxCodeId !== undefined
          ? {
              subtotal: subtotal.toFixed(6),
              taxTotal: taxTotal.toFixed(6),
              grandTotal: grandTotal.toFixed(6),
              amountDue: grandTotal.minus(invoice.amountPaid.toString()).toFixed(6),
              taxCodeId,
            }
          : {}),
      },
      include: { customer: true, items: true, payments: true },
    });
  }

  async createInvoice(
    organizationId: string,
    userId: string,
    body: {
      customerId: string;
      issueDate: string;
      dueDate: string;
      currency?: string;
      exchangeRate?: string;
      notes?: string;
      taxCodeId?: string;
      items: Array<{ description: string; quantity: string; unitPrice: string }>;
    },
  ) {
    if (!body.items?.length) {
      throw new BadRequestException({
        error: { code: 'NO_ITEMS', message: 'Add at least one line item.' },
      });
    }

    const customer = await prisma.customer.findFirst({
      where: { id: body.customerId, organizationId },
    });
    if (!customer) {
      throw new BadRequestException({
        error: { code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found.' },
      });
    }

    let subtotal = new Decimal(0);
    const items = body.items.map((item, index) => {
      const quantity = new Decimal(item.quantity || 0);
      const unitPrice = new Decimal(item.unitPrice || 0);
      const lineTotal = quantity.times(unitPrice);
      subtotal = subtotal.plus(lineTotal);
      return {
        description: item.description,
        quantity: quantity.toFixed(6),
        unitPrice: unitPrice.toFixed(6),
        lineTotal: lineTotal.toFixed(6),
        sortOrder: index,
      };
    });

    let taxTotal = new Decimal(0);
    let taxCodeId: string | undefined;
    if (body.taxCodeId) {
      const taxCode = await prisma.taxCode.findFirst({
        where: { id: body.taxCodeId, organizationId, active: true },
      });
      if (taxCode?.ratePercent != null) {
        taxTotal = subtotal.times(taxCode.ratePercent.toString()).dividedBy(100);
        taxCodeId = taxCode.id;
      } else if (taxCode) {
        taxCodeId = taxCode.id;
      }
    }

    const grandTotal = subtotal.plus(taxTotal);

    const revenue =
      (await prisma.ledgerAccount.findFirst({
        where: {
          organizationId,
          code: customer.countryCode === 'BD' ? '4500' : '4600',
        },
      })) ??
      (await prisma.ledgerAccount.findFirst({
        where: { organizationId, code: '4100' },
      }));

    return prisma.invoice.create({
      data: {
        organizationId,
        customerId: customer.id,
        issueDate: new Date(body.issueDate),
        dueDate: new Date(body.dueDate),
        currency: body.currency ?? customer.defaultCurrency,
        exchangeRate: body.exchangeRate ?? '1',
        status: 'DRAFT',
        subtotal: subtotal.toFixed(6),
        taxTotal: taxTotal.toFixed(6),
        grandTotal: grandTotal.toFixed(6),
        amountPaid: '0',
        amountDue: grandTotal.toFixed(6),
        notes: body.notes,
        taxCodeId,
        revenueAccountId: revenue?.id,
        createdById: userId,
        items: { create: items },
      },
      include: { customer: true, items: true },
    });
  }

  async issueInvoice(organizationId: string, userId: string, invoiceId: string) {
    const invoice = await this.getInvoice(organizationId, invoiceId);
    if (invoice.status !== 'DRAFT') {
      throw new BadRequestException({
        error: {
          code: 'INVOICE_ALREADY_ISSUED',
          message: 'This invoice has already been issued.',
        },
      });
    }

    const ar = await prisma.ledgerAccount.findFirst({
      where: { organizationId, code: '1200' },
    });
    const revenueAccountId =
      invoice.revenueAccountId ??
      (
        await prisma.ledgerAccount.findFirst({
          where: { organizationId, code: '4600' },
        })
      )?.id;

    if (!ar || !revenueAccountId) {
      throw new BadRequestException({
        error: {
          code: 'MISSING_ACCOUNTS',
          message: 'Receivable or revenue account missing from chart of accounts.',
        },
      });
    }

    const taxTotal = new Decimal(invoice.taxTotal.toString());
    const subtotal = new Decimal(invoice.subtotal.toString());
    const vatPayable = taxTotal.gt(0)
      ? await prisma.ledgerAccount.findFirst({
          where: { organizationId, code: '2210' },
        })
      : null;

    try {
      const year = new Date(invoice.issueDate).getUTCFullYear();
      const issuedCount = await prisma.invoice.count({
        where: {
          organizationId,
          invoiceNumber: { not: null },
        },
      });
      const orgNumbering = await prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { invoicePrefix: true },
      });
      const invPrefix =
        (orgNumbering.invoicePrefix?.trim() || 'INV-').replace(/-+$/, '-') || 'INV-';
      const invoiceNumber = `${invPrefix}${year}-${String(issuedCount + 1).padStart(4, '0')}`;

      const updated = await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: 'ISSUED',
          invoiceNumber,
          issuedAt: new Date(),
        },
        include: { customer: true, items: true },
      });

      const lines = [
        {
          accountId: ar.id,
          debitAmount: invoice.grandTotal.toString(),
          description: invoiceNumber,
        },
        {
          accountId: revenueAccountId,
          creditAmount: subtotal.toString(),
          description: invoiceNumber,
        },
      ];
      if (vatPayable && taxTotal.gt(0)) {
        lines.push({
          accountId: vatPayable.id,
          creditAmount: taxTotal.toFixed(6),
          description: `${invoiceNumber} VAT`,
        });
      }

      await this.posting.createJournal({
        organizationId,
        entryDate: invoice.issueDate,
        description: `Invoice ${invoiceNumber} — ${invoice.customer.name}`,
        sourceType: 'invoice',
        sourceId: invoice.id,
        currency: invoice.currency,
        exchangeRate: invoice.exchangeRate.toString(),
        createdById: userId,
        lines,
      });

      if (taxTotal.gt(0) || invoice.taxCodeId) {
        await prisma.vatDocument.create({
          data: {
            organizationId,
            type: 'OTHER',
            partyName: invoice.customer.name,
            invoiceId: invoice.id,
            taxableAmount: subtotal.toFixed(6),
            vatAmount: taxTotal.toFixed(6),
            status: 'RECORDED',
            notes: 'Auto-created on invoice issue for Mushak sales register export.',
          },
        });
      }

      if (invoice.currency !== 'BDT') {
        await prisma.serviceExportRecord.create({
          data: {
            organizationId,
            invoiceId: invoice.id,
            remittanceNotes: 'Foreign-currency invoice — attach Form-C/ERQ evidence when available.',
            retentionFlag: false,
          },
        });
      }

      return updated;
    } catch (error) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: 'DRAFT', invoiceNumber: null, issuedAt: null },
      }).catch(() => undefined);
      if (error instanceof AccountingError) {
        throw new BadRequestException({
          error: { code: error.code, message: error.message },
        });
      }
      throw error;
    }
  }

  listPayments(organizationId: string) {
    return prisma.payment.findMany({
      where: { organizationId },
      include: { customer: true, invoice: true },
      orderBy: { paymentDate: 'desc' },
      take: 100,
    });
  }

  async recordPayment(
    organizationId: string,
    userId: string,
    body: {
      invoiceId: string;
      paymentDate: string;
      amount: string;
      method?: 'BANK_TRANSFER' | 'CARD' | 'PAYMENT_GATEWAY' | 'CASH' | 'CHEQUE' | 'OTHER';
      destinationAccountId?: string;
      reference?: string;
      /** Settlement rate to base (BDT per 1 foreign). Defaults to invoice rate. */
      exchangeRate?: string;
    },
  ) {
    const invoice = await this.getInvoice(organizationId, body.invoiceId);
    if (!['ISSUED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE'].includes(invoice.status)) {
      throw new BadRequestException({
        error: {
          code: 'INVOICE_NOT_PAYABLE',
          message: 'Only issued invoices can receive payments.',
        },
      });
    }

    const amount = new Decimal(body.amount);
    const due = new Decimal(invoice.amountDue.toString());
    if (amount.lte(0) || amount.gt(due)) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_PAYMENT_AMOUNT',
          message: 'Payment must be greater than zero and not exceed amount due.',
        },
      });
    }

    const bank =
      (body.destinationAccountId
        ? await prisma.ledgerAccount.findFirst({
            where: { id: body.destinationAccountId, organizationId },
          })
        : null) ??
      (await prisma.ledgerAccount.findFirst({
        where: { organizationId, code: '1110' },
      })) ??
      (await prisma.ledgerAccount.findFirst({
        where: { organizationId, code: '1101' },
      }));
    const ar = await prisma.ledgerAccount.findFirst({
      where: { organizationId, code: '1200' },
    });
    const fxGain = await prisma.ledgerAccount.findFirst({
      where: { organizationId, code: '3400' },
    });
    const fxLoss = await prisma.ledgerAccount.findFirst({
      where: { organizationId, code: '3500' },
    });
    if (!bank || !ar) {
      throw new BadRequestException({
        error: {
          code: 'MISSING_ACCOUNTS',
          message: 'Bank or receivable account missing.',
        },
      });
    }

    const invoiceRate = new Decimal(invoice.exchangeRate.toString());
    const paymentRate = new Decimal(body.exchangeRate ?? invoice.exchangeRate.toString());
    const arBase = amount.times(invoiceRate);
    const bankBase = amount.times(paymentRate);
    const fxDiff = bankBase.minus(arBase);

    try {
      const count = await prisma.payment.count({ where: { organizationId } });
      const paymentNumber = `PAY-${String(count + 1).padStart(5, '0')}`;
      const payment = await prisma.payment.create({
        data: {
          organizationId,
          customerId: invoice.customerId,
          invoiceId: invoice.id,
          paymentNumber,
          paymentDate: new Date(body.paymentDate),
          amount: amount.toFixed(6),
          currency: invoice.currency,
          exchangeRate: paymentRate.toFixed(8),
          method: body.method ?? 'BANK_TRANSFER',
          destinationAccountId: bank.id,
          reference: body.reference,
          status: 'RECORDED',
        },
      });

      const amountPaid = new Decimal(invoice.amountPaid.toString()).plus(amount);
      const amountDue = new Decimal(invoice.grandTotal.toString()).minus(amountPaid);
      const status = amountDue.lte(0) ? 'PAID' : 'PARTIALLY_PAID';

      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: amountPaid.toFixed(6),
          amountDue: Decimal.max(amountDue, new Decimal(0)).toFixed(6),
          status,
          paidAt: status === 'PAID' ? new Date() : null,
        },
      });

      // Post in base currency so FX difference balances cleanly
      const lines: Array<{
        accountId: string;
        debitAmount?: string;
        creditAmount?: string;
        description?: string;
      }> = [
        {
          accountId: bank.id,
          debitAmount: bankBase.toFixed(6),
          description: `${paymentNumber} (${amount} ${invoice.currency} @ ${paymentRate})`,
        },
        {
          accountId: ar.id,
          creditAmount: arBase.toFixed(6),
          description: invoice.invoiceNumber ?? invoice.id,
        },
      ];

      if (fxDiff.gt(0)) {
        if (!fxGain) {
          throw new BadRequestException({
            error: { code: 'MISSING_FX_GAIN', message: 'FX Gain account 3400 missing.' },
          });
        }
        lines.push({
          accountId: fxGain.id,
          creditAmount: fxDiff.toFixed(6),
          description: 'FX gain on receipt',
        });
      } else if (fxDiff.lt(0)) {
        if (!fxLoss) {
          throw new BadRequestException({
            error: { code: 'MISSING_FX_LOSS', message: 'FX Loss account 3500 missing.' },
          });
        }
        lines.push({
          accountId: fxLoss.id,
          debitAmount: fxDiff.abs().toFixed(6),
          description: 'FX loss on receipt',
        });
      }

      await this.posting.createJournal({
        organizationId,
        entryDate: new Date(body.paymentDate),
        description: `Payment ${paymentNumber} for ${invoice.invoiceNumber}`,
        sourceType: 'payment',
        sourceId: payment.id,
        currency: 'BDT',
        exchangeRate: '1',
        createdById: userId,
        lines,
      });

      return payment;
    } catch (error) {
      if (error instanceof AccountingError) {
        throw new BadRequestException({
          error: { code: error.code, message: error.message },
        });
      }
      throw error;
    }
  }

  async dashboard(organizationId: string) {
    const [invoices, expenses, tb, overdue, openBills] = await Promise.all([
      prisma.invoice.findMany({
        where: { organizationId, status: { in: ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'] } },
      }),
      prisma.expense.findMany({ where: { organizationId, status: 'RECORDED' } }),
      this.posting.trialBalance(organizationId),
      prisma.invoice.count({
        where: {
          organizationId,
          status: { in: ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE'] },
          dueDate: { lt: new Date() },
          amountDue: { gt: 0 },
        },
      }),
      prisma.bill.findMany({
        where: {
          organizationId,
          status: { in: ['OPEN', 'PARTIALLY_PAID'] },
          amountDue: { gt: 0 },
        },
      }),
    ]);

    const revenue = invoices.reduce(
      (sum, inv) =>
        sum.plus(
          new Decimal(inv.grandTotal.toString()).times(inv.exchangeRate.toString()),
        ),
      new Decimal(0),
    );
    const expenseTotal = expenses.reduce(
      (sum, exp) =>
        sum.plus(new Decimal(exp.amount.toString()).times(exp.exchangeRate.toString())),
      new Decimal(0),
    );
    const owedToUs = invoices.reduce(
      (sum, inv) =>
        sum.plus(
          new Decimal(inv.amountDue.toString()).times(inv.exchangeRate.toString()),
        ),
      new Decimal(0),
    );

    const owedToSuppliers = openBills.reduce(
      (sum, bill) =>
        sum.plus(
          new Decimal(bill.amountDue.toString()).times(bill.exchangeRate.toString()),
        ),
      new Decimal(0),
    );

    const cash = tb.rows
      .filter((r) => ['1101', '1110', '1120', '1130', '1140'].includes(r.code))
      .reduce(
        (sum, row) => sum.plus(new Decimal(row.debit).minus(row.credit)),
        new Decimal(0),
      );

    return {
      revenue: revenue.toFixed(2),
      expenses: expenseTotal.toFixed(2),
      operatingProfit: revenue.minus(expenseTotal).toFixed(2),
      cash: cash.toFixed(2),
      moneyOwedToUs: owedToUs.toFixed(2),
      moneyOwedToSuppliers: owedToSuppliers.toFixed(2),
      overdueInvoices: overdue,
      needsAttention: [] as string[],
    };
  }

  async creditInvoice(
    organizationId: string,
    userId: string,
    invoiceId: string,
    body: { amount?: string; reason?: string },
  ) {
    const invoice = await this.getInvoice(organizationId, invoiceId);
    if (!['ISSUED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE', 'PAID'].includes(invoice.status)) {
      throw new BadRequestException({
        error: {
          code: 'INVOICE_NOT_CREDITABLE',
          message: 'Only issued invoices can be credited.',
        },
      });
    }

    const due = new Decimal(invoice.amountDue.toString());
    const creditAmount = body.amount ? new Decimal(body.amount) : due;
    if (creditAmount.lte(0) || creditAmount.gt(due)) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_CREDIT_AMOUNT',
          message: 'Credit amount must be greater than zero and not exceed amount due.',
        },
      });
    }

    const ar = await prisma.ledgerAccount.findFirst({
      where: { organizationId, code: '1200' },
    });
    const revenueAccountId =
      invoice.revenueAccountId ??
      (
        await prisma.ledgerAccount.findFirst({
          where: { organizationId, code: '4600' },
        })
      )?.id;
    if (!ar || !revenueAccountId) {
      throw new BadRequestException({
        error: {
          code: 'MISSING_ACCOUNTS',
          message: 'Receivable or revenue account missing.',
        },
      });
    }

    try {
      const amountDue = due.minus(creditAmount);
      const status = amountDue.lte(0) ? 'CREDITED' : invoice.status;

      const updated = await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          amountDue: Decimal.max(amountDue, new Decimal(0)).toFixed(6),
          status,
          notes: [invoice.notes, body.reason ? `Credit: ${body.reason}` : null]
            .filter(Boolean)
            .join('\n'),
        },
        include: { customer: true, items: true },
      });

      await this.posting.createJournal({
        organizationId,
        entryDate: new Date(),
        description: `Credit note for ${invoice.invoiceNumber}${body.reason ? ` — ${body.reason}` : ''}`,
        sourceType: 'credit_note',
        sourceId: invoice.id,
        currency: invoice.currency,
        exchangeRate: invoice.exchangeRate.toString(),
        createdById: userId,
        lines: [
          {
            accountId: revenueAccountId,
            debitAmount: creditAmount.toFixed(6),
            description: invoice.invoiceNumber ?? invoice.id,
          },
          {
            accountId: ar.id,
            creditAmount: creditAmount.toFixed(6),
            description: invoice.invoiceNumber ?? invoice.id,
          },
        ],
      });

      return updated;
    } catch (error) {
      if (error instanceof AccountingError) {
        throw new BadRequestException({
          error: { code: error.code, message: error.message },
        });
      }
      throw error;
    }
  }

  async createExpense(
    organizationId: string,
    userId: string,
    body: {
      expenseDate: string;
      description: string;
      amount: string;
      categoryAccountId: string;
      paymentAccountId: string;
      reverseCharge?: boolean;
      reverseChargeTaxCodeId?: string;
    },
  ) {
    try {
      const baseAmount = new Decimal(body.amount);
      let vatAmount = new Decimal(0);
      if (body.reverseCharge && body.reverseChargeTaxCodeId) {
        const taxCode = await prisma.taxCode.findFirst({
          where: { id: body.reverseChargeTaxCodeId, organizationId, active: true },
        });
        if (taxCode?.ratePercent != null) {
          vatAmount = baseAmount.times(taxCode.ratePercent.toString()).dividedBy(100);
        }
      }

      const expense = await prisma.expense.create({
        data: {
          organizationId,
          expenseDate: new Date(body.expenseDate),
          description: body.description,
          amount: body.amount,
          categoryAccountId: body.categoryAccountId,
          paymentAccountId: body.paymentAccountId,
          reverseCharge: body.reverseCharge ?? false,
          reverseChargeTaxCodeId: body.reverseChargeTaxCodeId ?? null,
          createdById: userId,
          status: 'RECORDED',
        },
      });

      const lines: Array<{
        accountId: string;
        debitAmount?: string;
        creditAmount?: string;
      }> = [{ accountId: body.categoryAccountId, debitAmount: body.amount }];

      if (vatAmount.gt(0)) {
        const itc = await prisma.ledgerAccount.findFirst({
          where: { organizationId, code: '1210' },
        });
        const rcControl = await prisma.ledgerAccount.findFirst({
          where: { organizationId, code: '2250' },
        });
        if (itc && rcControl) {
          lines.push({ accountId: itc.id, debitAmount: vatAmount.toFixed(6) });
          lines.push({ accountId: rcControl.id, creditAmount: vatAmount.toFixed(6) });
        }
      }

      lines.push({
        accountId: body.paymentAccountId,
        creditAmount: baseAmount.toFixed(6),
      });

      await this.posting.createJournal({
        organizationId,
        entryDate: new Date(body.expenseDate),
        description: body.description,
        sourceType: 'expense',
        sourceId: expense.id,
        createdById: userId,
        lines,
      });

      return expense;
    } catch (error) {
      if (error instanceof AccountingError) {
        throw new BadRequestException({
          error: { code: error.code, message: error.message },
        });
      }
      throw error;
    }
  }

  listExpenses(organizationId: string) {
    return prisma.expense.findMany({
      where: { organizationId },
      orderBy: { expenseDate: 'desc' },
      take: 100,
    });
  }

  async getCustomer360(organizationId: string, customerId: string) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, organizationId },
      include: {
        invoices: { orderBy: { createdAt: 'desc' }, take: 50 },
        payments: { orderBy: { paymentDate: 'desc' }, take: 50 },
        quotes: { orderBy: { createdAt: 'desc' }, take: 50 },
        contracts: { orderBy: { createdAt: 'desc' }, take: 50 },
        projects: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!customer) {
      throw new NotFoundException({
        error: { code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found.' },
      });
    }
    const openReceivable = customer.invoices.reduce(
      (sum, inv) => sum.plus(inv.amountDue.toString()),
      new Decimal(0),
    );
    return {
      ...customer,
      openReceivable: openReceivable.toFixed(2),
    };
  }

  listContracts(organizationId: string) {
    return prisma.contract.findMany({
      where: { organizationId },
      include: { customer: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async createContract(
    organizationId: string,
    body: {
      customerId: string;
      title: string;
      description?: string;
      effectiveDate: string;
      expiryDate?: string;
      billingType?: 'FIXED' | 'MILESTONE' | 'MONTHLY' | 'RETAINER' | 'HOURLY' | 'OTHER';
      currency?: string;
      contractValue?: string;
      paymentTerms?: string;
      serviceType?: string;
      status?: 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED' | 'COMPLETED';
    },
  ) {
    const customer = await prisma.customer.findFirst({
      where: { id: body.customerId, organizationId },
    });
    if (!customer) {
      throw new BadRequestException({
        error: { code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found.' },
      });
    }
    const count = await prisma.contract.count({ where: { organizationId } });
    return prisma.contract.create({
      data: {
        organizationId,
        customerId: customer.id,
        contractNumber: `CTR-${String(count + 1).padStart(4, '0')}`,
        title: body.title,
        description: body.description,
        effectiveDate: new Date(body.effectiveDate),
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
        billingType: body.billingType ?? 'FIXED',
        currency: body.currency ?? customer.defaultCurrency,
        contractValue: body.contractValue,
        paymentTerms: body.paymentTerms,
        serviceType: body.serviceType,
        isRelatedParty: customer.isRelatedParty,
        status: body.status ?? 'ACTIVE',
      },
      include: { customer: true },
    });
  }

  async updateContract(
    organizationId: string,
    contractId: string,
    body: {
      title?: string;
      description?: string | null;
      effectiveDate?: string;
      expiryDate?: string | null;
      billingType?: 'FIXED' | 'MILESTONE' | 'MONTHLY' | 'RETAINER' | 'HOURLY' | 'OTHER';
      currency?: string;
      contractValue?: string | null;
      paymentTerms?: string | null;
      serviceType?: string | null;
      status?: 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED' | 'COMPLETED';
    },
  ) {
    const existing = await prisma.contract.findFirst({
      where: { id: contractId, organizationId },
    });
    if (!existing) {
      throw new NotFoundException({
        error: { code: 'CONTRACT_NOT_FOUND', message: 'Contract not found.' },
      });
    }
    return prisma.contract.update({
      where: { id: existing.id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.effectiveDate ? { effectiveDate: new Date(body.effectiveDate) } : {}),
        ...(body.expiryDate !== undefined
          ? { expiryDate: body.expiryDate ? new Date(body.expiryDate) : null }
          : {}),
        ...(body.billingType ? { billingType: body.billingType } : {}),
        ...(body.currency ? { currency: body.currency } : {}),
        ...(body.contractValue !== undefined ? { contractValue: body.contractValue } : {}),
        ...(body.paymentTerms !== undefined ? { paymentTerms: body.paymentTerms } : {}),
        ...(body.serviceType !== undefined ? { serviceType: body.serviceType } : {}),
        ...(body.status ? { status: body.status } : {}),
      },
      include: { customer: true },
    });
  }

  listProjects(organizationId: string) {
    return prisma.project.findMany({
      where: { organizationId },
      include: { customer: true, contract: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async createProject(
    organizationId: string,
    body: {
      customerId: string;
      contractId?: string;
      name: string;
      description?: string;
      startDate?: string;
      endDate?: string;
      currency?: string;
      budgetAmount?: string;
      status?: 'PLANNED' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
    },
  ) {
    const customer = await prisma.customer.findFirst({
      where: { id: body.customerId, organizationId },
    });
    if (!customer) {
      throw new BadRequestException({
        error: { code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found.' },
      });
    }
    const count = await prisma.project.count({ where: { organizationId } });
    return prisma.project.create({
      data: {
        organizationId,
        customerId: customer.id,
        contractId: body.contractId,
        projectCode: `PRJ-${String(count + 1).padStart(4, '0')}`,
        name: body.name,
        description: body.description,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        currency: body.currency ?? customer.defaultCurrency,
        budgetAmount: body.budgetAmount,
        status: body.status ?? 'ACTIVE',
      },
      include: { customer: true, contract: true },
    });
  }

  async updateProject(
    organizationId: string,
    projectId: string,
    body: {
      name?: string;
      description?: string | null;
      startDate?: string | null;
      endDate?: string | null;
      currency?: string;
      budgetAmount?: string | null;
      status?: 'PLANNED' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
    },
  ) {
    const existing = await prisma.project.findFirst({
      where: { id: projectId, organizationId },
    });
    if (!existing) {
      throw new NotFoundException({
        error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found.' },
      });
    }
    return prisma.project.update({
      where: { id: existing.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.startDate !== undefined
          ? { startDate: body.startDate ? new Date(body.startDate) : null }
          : {}),
        ...(body.endDate !== undefined
          ? { endDate: body.endDate ? new Date(body.endDate) : null }
          : {}),
        ...(body.currency ? { currency: body.currency } : {}),
        ...(body.budgetAmount !== undefined ? { budgetAmount: body.budgetAmount } : {}),
        ...(body.status ? { status: body.status } : {}),
      },
      include: { customer: true, contract: true },
    });
  }

  async invoicePdfBuffer(organizationId: string, invoiceId: string) {
    const invoice = await this.getInvoice(organizationId, invoiceId);
    return this.buildOrgInvoicePdf(organizationId, {
      invoiceNumber: invoice.invoiceNumber ?? 'DRAFT',
      issueDate: invoice.issueDate.toISOString().slice(0, 10),
      dueDate: invoice.dueDate.toISOString().slice(0, 10),
      currency: invoice.currency,
      customerName: invoice.customer.name,
      customerLegalName: invoice.customer.legalName,
      customerAddress: invoice.customer.address,
      customerEmail: invoice.customer.email,
      customerPhone: invoice.customer.phone,
      customerCountry: invoice.customer.countryCode,
      customerTaxId: invoice.customer.taxIdentifier,
      customerVatId: invoice.customer.vatIdentifier,
      notes: invoice.notes,
      terms: invoice.terms,
      items: invoice.items.map((item) => ({
        description: item.description,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(),
        lineTotal: item.lineTotal.toString(),
      })),
      subtotal: invoice.subtotal.toString(),
      taxTotal: invoice.taxTotal.toString(),
      grandTotal: invoice.grandTotal.toString(),
      amountPaid: invoice.amountPaid.toString(),
      amountDue: invoice.amountDue.toString(),
      status: invoice.status,
    });
  }

  async invoicePreviewPdfBuffer(organizationId: string) {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    const prefix = (org.invoicePrefix?.trim() || 'INV-').replace(/-+$/, '-') || 'INV-';
    const sampleNumber = `${prefix}${new Date().getUTCFullYear()}-0001`;
    const today = new Date().toISOString().slice(0, 10);
    const due = new Date(Date.now() + (org.defaultPaymentTermsDays ?? 30) * 86400000)
      .toISOString()
      .slice(0, 10);
    return this.buildOrgInvoicePdf(organizationId, {
      invoiceNumber: sampleNumber,
      issueDate: today,
      dueDate: due,
      currency: org.baseCurrency,
      customerName: 'Sample Customer Ltd.',
      customerLegalName: 'Sample Customer Limited',
      customerAddress: 'House 12, Road 5, Gulshan-2, Dhaka 1212',
      customerEmail: 'accounts@samplecustomer.bd',
      customerPhone: '+880 1712 345678',
      customerCountry: 'BD',
      customerTaxId: '123456789012',
      customerVatId: null,
      notes: 'Sample invoice for preview — customize logo, colors, and footer in Settings.',
      terms: `Payment due within ${org.defaultPaymentTermsDays ?? 30} days.`,
      items: [
        {
          description: 'Professional services — August 2026',
          quantity: '1',
          unitPrice: '50000',
          lineTotal: '50000',
        },
        {
          description: 'VAT (15%)',
          quantity: '1',
          unitPrice: '7500',
          lineTotal: '7500',
        },
      ],
      subtotal: '50000',
      taxTotal: '7500',
      grandTotal: '57500',
      amountPaid: '0',
      amountDue: '57500',
      status: 'ISSUED',
    });
  }

  private async buildOrgInvoicePdf(
    organizationId: string,
    invoice: {
      invoiceNumber: string;
      issueDate: string;
      dueDate: string;
      currency: string;
      customerName: string;
      customerLegalName?: string | null;
      customerAddress?: string | null;
      customerEmail?: string | null;
      customerPhone?: string | null;
      customerCountry?: string | null;
      customerTaxId?: string | null;
      customerVatId?: string | null;
      notes?: string | null;
      terms?: string | null;
      items: Array<{ description: string; quantity: string; unitPrice: string; lineTotal: string }>;
      subtotal: string;
      taxTotal: string;
      grandTotal: string;
      amountPaid: string;
      amountDue: string;
      status: string;
      documentKind?: 'invoice' | 'quote';
    },
  ) {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    let logo: Buffer | null = null;
    if (org.logoUrl) {
      try {
        const { LocalObjectStorage } = await import('../storage/object-storage.js');
        logo = await new LocalObjectStorage().getObject(org.logoUrl);
      } catch {
        logo = null;
      }
    }
    const { buildInvoicePdf } = await import('./invoice-pdf.js');
    return buildInvoicePdf({
      organizationName: org.name,
      legalName: org.legalName,
      legalType: org.legalType,
      organizationAddress: org.address,
      organizationPhone: org.phone,
      organizationEmail: org.email,
      organizationWebsite: org.website,
      taxIdentifier: org.taxIdentifier,
      vatIdentifier: org.vatIdentifier,
      tradeLicenseNumber: org.tradeLicenseNumber,
      logo,
      invoiceFooter: org.invoiceFooter,
      primaryColor: org.invoicePrimaryColor,
      accentColor: org.invoiceAccentColor,
      template: org.invoiceTemplate,
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      currency: invoice.currency,
      customerName: invoice.customerName,
      customerLegalName: invoice.customerLegalName,
      customerAddress: invoice.customerAddress,
      customerEmail: invoice.customerEmail,
      customerPhone: invoice.customerPhone,
      customerCountry: invoice.customerCountry,
      customerTaxId: invoice.customerTaxId,
      customerVatId: invoice.customerVatId,
      notes: invoice.notes,
      terms: invoice.terms,
      items: invoice.items,
      subtotal: invoice.subtotal,
      taxTotal: invoice.taxTotal,
      grandTotal: invoice.grandTotal,
      amountPaid: invoice.amountPaid,
      amountDue: invoice.amountDue,
      status: invoice.status,
      documentKind: invoice.documentKind,
    });
  }

  async getQuote(organizationId: string, quoteId: string) {
    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, organizationId },
      include: { customer: true, items: true },
    });
    if (!quote) {
      throw new NotFoundException({
        error: { code: 'QUOTE_NOT_FOUND', message: 'Quote not found.' },
      });
    }
    return quote;
  }

  async quotePdfBuffer(organizationId: string, quoteId: string) {
    const quote = await this.getQuote(organizationId, quoteId);
    return this.buildOrgInvoicePdf(organizationId, {
      documentKind: 'quote',
      invoiceNumber: quote.quoteNumber ?? 'DRAFT',
      issueDate: quote.issueDate.toISOString().slice(0, 10),
      dueDate: quote.validUntil.toISOString().slice(0, 10),
      currency: quote.currency,
      customerName: quote.customer.name,
      customerLegalName: quote.customer.legalName,
      customerAddress: quote.customer.address,
      customerEmail: quote.customer.email,
      customerPhone: quote.customer.phone,
      customerCountry: quote.customer.countryCode,
      customerTaxId: quote.customer.taxIdentifier,
      customerVatId: quote.customer.vatIdentifier,
      notes: quote.notes,
      terms: null,
      items: quote.items.map((item) => ({
        description: item.description,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(),
        lineTotal: item.lineTotal.toString(),
      })),
      subtotal: quote.subtotal.toString(),
      taxTotal: quote.taxTotal.toString(),
      grandTotal: quote.grandTotal.toString(),
      amountPaid: '0',
      amountDue: quote.grandTotal.toString(),
      status: quote.status,
    });
  }
}
