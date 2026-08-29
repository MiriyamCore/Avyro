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
export class PayablesService {
  private readonly posting = new AccountingPostingService(prisma);

  listSuppliers(organizationId: string) {
    return prisma.supplier.findMany({
      where: { organizationId, status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    });
  }

  async getSupplier(organizationId: string, supplierId: string) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, organizationId },
      include: {
        bills: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!supplier) {
      throw new NotFoundException({
        error: { code: 'SUPPLIER_NOT_FOUND', message: 'Supplier not found.' },
      });
    }
    const openPayable = supplier.bills.reduce(
      (sum, bill) => sum.plus(bill.amountDue.toString()),
      new Decimal(0),
    );
    return {
      ...supplier,
      openPayable: openPayable.toFixed(2),
    };
  }

  async updateSupplier(
    organizationId: string,
    supplierId: string,
    body: {
      name?: string;
      countryCode?: string;
      contactPerson?: string | null;
      address?: string | null;
      billingAddress?: string | null;
      shippingAddress?: string | null;
      email?: string | null;
      phone?: string | null;
      defaultCurrency?: string;
      defaultPaymentTermsDays?: number;
      bankName?: string | null;
      bankAccountNumber?: string | null;
      bankBranch?: string | null;
      taxIdentifier?: string | null;
      vatIdentifier?: string | null;
      notes?: string | null;
    },
  ) {
    const existing = await prisma.supplier.findFirst({
      where: { id: supplierId, organizationId },
    });
    if (!existing) {
      throw new NotFoundException({
        error: { code: 'SUPPLIER_NOT_FOUND', message: 'Supplier not found.' },
      });
    }
    return prisma.supplier.update({
      where: { id: supplierId },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
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
        ...(body.defaultCurrency !== undefined ? { defaultCurrency: body.defaultCurrency } : {}),
        ...(body.defaultPaymentTermsDays !== undefined
          ? { defaultPaymentTermsDays: body.defaultPaymentTermsDays }
          : {}),
        ...(body.bankName !== undefined ? { bankName: body.bankName?.trim() || null } : {}),
        ...(body.bankAccountNumber !== undefined
          ? { bankAccountNumber: body.bankAccountNumber?.trim() || null }
          : {}),
        ...(body.bankBranch !== undefined ? { bankBranch: body.bankBranch?.trim() || null } : {}),
        ...(body.taxIdentifier !== undefined
          ? { taxIdentifier: body.taxIdentifier?.trim() || null }
          : {}),
        ...(body.vatIdentifier !== undefined
          ? { vatIdentifier: body.vatIdentifier?.trim() || null }
          : {}),
        ...(body.notes !== undefined ? { notes: body.notes?.trim() || null } : {}),
      },
    });
  }

  async createSupplier(
    organizationId: string,
    body: {
      name: string;
      countryCode?: string;
      contactPerson?: string;
      address?: string;
      billingAddress?: string;
      shippingAddress?: string;
      email?: string;
      phone?: string;
      defaultCurrency?: string;
      defaultPaymentTermsDays?: number;
      bankName?: string;
      bankAccountNumber?: string;
      bankBranch?: string;
      taxIdentifier?: string;
      vatIdentifier?: string;
      notes?: string;
    },
  ) {
    const count = await prisma.supplier.count({ where: { organizationId } });
    const billing = body.billingAddress ?? body.address;
    return prisma.supplier.create({
      data: {
        organizationId,
        supplierNumber: `SUP-${String(count + 1).padStart(4, '0')}`,
        name: body.name,
        countryCode: body.countryCode ?? 'BD',
        contactPerson: body.contactPerson,
        address: billing,
        billingAddress: billing,
        shippingAddress: body.shippingAddress,
        email: body.email,
        phone: body.phone,
        defaultCurrency: body.defaultCurrency ?? 'BDT',
        defaultPaymentTermsDays: body.defaultPaymentTermsDays ?? 30,
        bankName: body.bankName,
        bankAccountNumber: body.bankAccountNumber,
        bankBranch: body.bankBranch,
        taxIdentifier: body.taxIdentifier,
        vatIdentifier: body.vatIdentifier,
        notes: body.notes,
      },
    });
  }

  listBills(organizationId: string) {
    return prisma.bill.findMany({
      where: { organizationId },
      include: { supplier: true, items: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getBill(organizationId: string, billId: string) {
    const bill = await prisma.bill.findFirst({
      where: { id: billId, organizationId },
      include: { supplier: true, items: true, payments: true },
    });
    if (!bill) {
      throw new NotFoundException({
        error: { code: 'BILL_NOT_FOUND', message: 'Bill not found.' },
      });
    }
    return bill;
  }

  async createBill(
    organizationId: string,
    userId: string,
    body: {
      supplierId: string;
      billDate: string;
      dueDate: string;
      currency?: string;
      exchangeRate?: string;
      supplierReference?: string;
      expenseAccountId?: string;
      taxCodeId?: string;
      reverseCharge?: boolean;
      reverseChargeTaxCodeId?: string;
      notes?: string;
      items: Array<{
        description: string;
        quantity: string;
        unitPrice: string;
        itcStatus?: 'CLAIMABLE' | 'BLOCKED' | 'APPORTIONED' | 'NOT_APPLICABLE';
        itcApportionedPercent?: string;
      }>;
    },
  ) {
    if (!body.items?.length) {
      throw new BadRequestException({
        error: { code: 'NO_ITEMS', message: 'Add at least one line item.' },
      });
    }
    const supplier = await prisma.supplier.findFirst({
      where: { id: body.supplierId, organizationId },
    });
    if (!supplier) {
      throw new BadRequestException({
        error: { code: 'SUPPLIER_NOT_FOUND', message: 'Supplier not found.' },
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
        itcStatus: item.itcStatus ?? 'CLAIMABLE',
        itcApportionedPercent: item.itcApportionedPercent ?? null,
        sortOrder: index,
      };
    });

    let taxTotal = new Decimal(0);
    let taxCodeId: string | undefined;
    let withholdingKind: 'TDS' | 'VDS' | null = null;
    let withholdingRate: Decimal | null = null;
    const vatTaxCodeId = body.reverseCharge
      ? body.reverseChargeTaxCodeId ?? body.taxCodeId
      : body.taxCodeId;
    if (vatTaxCodeId) {
      const taxCode = await prisma.taxCode.findFirst({
        where: { id: vatTaxCodeId, organizationId, active: true },
      });
      if (taxCode?.ratePercent != null) {
        taxTotal = subtotal.times(taxCode.ratePercent.toString()).dividedBy(100);
        taxCodeId = taxCode.id;
        if (taxCode.kind === 'TDS' || taxCode.kind === 'VDS') {
          withholdingKind = taxCode.kind;
          withholdingRate = new Decimal(taxCode.ratePercent.toString());
        }
      } else if (taxCode) {
        taxCodeId = taxCode.id;
      }
    }

    const isWithholding = withholdingKind != null && taxTotal.gt(0) && !body.reverseCharge;
    const grandTotal = body.reverseCharge
      ? subtotal
      : isWithholding
        ? subtotal
        : subtotal.plus(taxTotal);
    const amountDue = isWithholding ? subtotal.minus(taxTotal) : grandTotal;

    const expenseAccount =
      (body.expenseAccountId
        ? await prisma.ledgerAccount.findFirst({
            where: { id: body.expenseAccountId, organizationId },
          })
        : null) ??
      (await prisma.ledgerAccount.findFirst({
        where: { organizationId, code: '6600' },
      }));

    const bill = await prisma.bill.create({
      data: {
        organizationId,
        supplierId: supplier.id,
        billDate: new Date(body.billDate),
        dueDate: new Date(body.dueDate),
        currency: body.currency ?? supplier.defaultCurrency,
        exchangeRate: body.exchangeRate ?? '1',
        supplierReference: body.supplierReference,
        status: 'DRAFT',
        subtotal: subtotal.toFixed(6),
        taxTotal: taxTotal.toFixed(6),
        grandTotal: grandTotal.toFixed(6),
        amountPaid: '0',
        amountDue: amountDue.toFixed(6),
        expenseAccountId: expenseAccount?.id,
        taxCodeId,
        reverseCharge: body.reverseCharge ?? false,
        reverseChargeTaxCodeId: body.reverseCharge ? vatTaxCodeId : null,
        notes: body.notes,
        createdById: userId,
        items: { create: items },
      },
      include: { supplier: true, items: true },
    });

    // stash kind on notes metadata via return — openBill will re-read tax code
    void withholdingRate;
    return bill;
  }

  async openBill(organizationId: string, userId: string, billId: string) {
    const bill = await this.getBill(organizationId, billId);
    if (bill.status !== 'DRAFT') {
      throw new BadRequestException({
        error: { code: 'BILL_ALREADY_OPEN', message: 'Bill is already open.' },
      });
    }
    const ap = await prisma.ledgerAccount.findFirst({
      where: { organizationId, code: '2100' },
    });
    const expenseAccountId =
      bill.expenseAccountId ??
      (
        await prisma.ledgerAccount.findFirst({
          where: { organizationId, code: '6600' },
        })
      )?.id;
    if (!ap || !expenseAccountId) {
      throw new BadRequestException({
        error: {
          code: 'MISSING_ACCOUNTS',
          message: 'Payable or expense account missing.',
        },
      });
    }

    try {
      const count = await prisma.bill.count({
        where: { organizationId, billNumber: { not: null } },
      });
      const billNumber = `BILL-${new Date().getUTCFullYear()}-${String(count + 1).padStart(4, '0')}`;
      const updated = await prisma.bill.update({
        where: { id: bill.id },
        data: { status: 'OPEN', billNumber },
        include: { supplier: true, items: true },
      });

      const subtotal = new Decimal(bill.subtotal.toString());
      const taxTotal = new Decimal(bill.taxTotal.toString());
      const taxCode = bill.taxCodeId
        ? await prisma.taxCode.findFirst({ where: { id: bill.taxCodeId } })
        : null;
      const isWithholding =
        !bill.reverseCharge &&
        taxCode &&
        (taxCode.kind === 'TDS' || taxCode.kind === 'VDS') &&
        taxTotal.gt(0);
      const withholdCode = taxCode?.kind === 'VDS' ? '2240' : '2230';
      const withholdAccount = isWithholding
        ? await prisma.ledgerAccount.findFirst({
            where: { organizationId, code: withholdCode },
          })
        : null;

      const itcAccount = await prisma.ledgerAccount.findFirst({
        where: { organizationId, code: '1210' },
      });
      const vatPayable = await prisma.ledgerAccount.findFirst({
        where: { organizationId, code: '2210' },
      });
      const rcControl = await prisma.ledgerAccount.findFirst({
        where: { organizationId, code: '2250' },
      });

      let lines: Array<{
        accountId: string;
        debitAmount?: string;
        creditAmount?: string;
        description?: string;
      }>;

      if (bill.reverseCharge && taxTotal.gt(0) && itcAccount && (vatPayable || rcControl)) {
        const claimableRatio = bill.items.length
          ? bill.items.reduce((sum, item) => {
              if (item.itcStatus === 'NOT_APPLICABLE' || item.itcStatus === 'BLOCKED') {
                return sum;
              }
              if (item.itcStatus === 'APPORTIONED' && item.itcApportionedPercent != null) {
                return sum.plus(item.itcApportionedPercent.toString()).dividedBy(100);
              }
              return sum.plus(1);
            }, new Decimal(0)).dividedBy(bill.items.length)
          : new Decimal(1);
        const claimableVat = taxTotal.times(claimableRatio);
        const nonClaimableVat = taxTotal.minus(claimableVat);
        const liabilityAccount = rcControl ?? vatPayable!;
        lines = [
          {
            accountId: expenseAccountId,
            debitAmount: subtotal.plus(nonClaimableVat).toFixed(6),
            description: billNumber,
          },
          ...(claimableVat.gt(0)
            ? [
                {
                  accountId: itcAccount.id,
                  debitAmount: claimableVat.toFixed(6),
                  description: `${billNumber} reverse-charge ITC`,
                },
              ]
            : []),
          {
            accountId: ap.id,
            creditAmount: subtotal.toFixed(6),
            description: billNumber,
          },
          {
            accountId: liabilityAccount.id,
            creditAmount: taxTotal.toFixed(6),
            description: `${billNumber} reverse-charge VAT`,
          },
        ];
      } else if (
        taxCode?.kind === 'VAT' &&
        taxTotal.gt(0) &&
        !isWithholding &&
        itcAccount
      ) {
        const claimableVat = bill.items.reduce((sum, item) => {
          const lineVat = subtotal.gt(0)
            ? taxTotal.times(item.lineTotal.toString()).dividedBy(subtotal)
            : new Decimal(0);
          if (item.itcStatus === 'BLOCKED' || item.itcStatus === 'NOT_APPLICABLE') {
            return sum;
          }
          if (item.itcStatus === 'APPORTIONED' && item.itcApportionedPercent != null) {
            return sum.plus(lineVat.times(item.itcApportionedPercent.toString()).dividedBy(100));
          }
          return sum.plus(lineVat);
        }, new Decimal(0));
        const nonClaimableVat = taxTotal.minus(claimableVat);
        lines = [
          {
            accountId: expenseAccountId,
            debitAmount: subtotal.plus(nonClaimableVat).toFixed(6),
            description: billNumber,
          },
          ...(claimableVat.gt(0)
            ? [
                {
                  accountId: itcAccount.id,
                  debitAmount: claimableVat.toFixed(6),
                  description: `${billNumber} ITC`,
                },
              ]
            : []),
          {
            accountId: ap.id,
            creditAmount: subtotal.plus(taxTotal).toFixed(6),
            description: billNumber,
          },
        ];
      } else if (isWithholding && withholdAccount) {
        lines = [
          {
            accountId: expenseAccountId,
            debitAmount: subtotal.toFixed(6),
            description: billNumber,
          },
          {
            accountId: ap.id,
            creditAmount: subtotal.minus(taxTotal).toFixed(6),
            description: billNumber,
          },
          {
            accountId: withholdAccount.id,
            creditAmount: taxTotal.toFixed(6),
            description: `${billNumber} ${taxCode?.kind}`,
          },
        ];
      } else {
        lines = [
          {
            accountId: expenseAccountId,
            debitAmount: bill.grandTotal.toString(),
            description: billNumber,
          },
          {
            accountId: ap.id,
            creditAmount: bill.grandTotal.toString(),
            description: billNumber,
          },
        ];
      }

      await this.posting.createJournal({
        organizationId,
        entryDate: bill.billDate,
        description: `Bill ${billNumber} — ${bill.supplier.name}`,
        sourceType: 'bill',
        sourceId: bill.id,
        currency: bill.currency,
        exchangeRate: bill.exchangeRate.toString(),
        createdById: userId,
        lines,
      });

      if (isWithholding && taxCode) {
        await prisma.withholdingEntry.create({
          data: {
            organizationId,
            kind: taxCode.kind as 'TDS' | 'VDS',
            billId: bill.id,
            baseAmount: subtotal.toFixed(6),
            ratePercent: taxCode.ratePercent?.toString() ?? '0',
            amount: taxTotal.toFixed(6),
            notes: 'Auto-created on bill open.',
          },
        });
      }

      return updated;
    } catch (error) {
      await prisma.bill
        .update({
          where: { id: bill.id },
          data: { status: 'DRAFT', billNumber: null },
        })
        .catch(() => undefined);
      if (error instanceof AccountingError) {
        throw new BadRequestException({
          error: { code: error.code, message: error.message },
        });
      }
      throw error;
    }
  }

  async payBill(
    organizationId: string,
    userId: string,
    body: {
      billId: string;
      paymentDate: string;
      amount: string;
      paymentAccountId?: string;
      reference?: string;
    },
  ) {
    const bill = await this.getBill(organizationId, body.billId);
    if (!['OPEN', 'PARTIALLY_PAID'].includes(bill.status)) {
      throw new BadRequestException({
        error: {
          code: 'BILL_NOT_PAYABLE',
          message: 'Only open bills can be paid.',
        },
      });
    }
    const amount = new Decimal(body.amount);
    const due = new Decimal(bill.amountDue.toString());
    if (amount.lte(0) || amount.gt(due)) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_PAYMENT_AMOUNT',
          message: 'Payment must be > 0 and not exceed amount due.',
        },
      });
    }

    const bank =
      (body.paymentAccountId
        ? await prisma.ledgerAccount.findFirst({
            where: { id: body.paymentAccountId, organizationId },
          })
        : null) ??
      (await prisma.ledgerAccount.findFirst({
        where: { organizationId, code: '1110' },
      }));
    const ap = await prisma.ledgerAccount.findFirst({
      where: { organizationId, code: '2100' },
    });
    if (!bank || !ap) {
      throw new BadRequestException({
        error: {
          code: 'MISSING_ACCOUNTS',
          message: 'Bank or payable account missing.',
        },
      });
    }

    try {
      const count = await prisma.billPayment.count({ where: { organizationId } });
      const paymentNumber = `BPAY-${String(count + 1).padStart(5, '0')}`;
      const payment = await prisma.billPayment.create({
        data: {
          organizationId,
          billId: bill.id,
          paymentNumber,
          paymentDate: new Date(body.paymentDate),
          amount: amount.toFixed(6),
          currency: bill.currency,
          exchangeRate: bill.exchangeRate,
          paymentAccountId: bank.id,
          reference: body.reference,
          status: 'RECORDED',
        },
      });

      const amountPaid = new Decimal(bill.amountPaid.toString()).plus(amount);
      const amountDue = new Decimal(bill.grandTotal.toString()).minus(amountPaid);
      const status = amountDue.lte(0) ? 'PAID' : 'PARTIALLY_PAID';

      await prisma.bill.update({
        where: { id: bill.id },
        data: {
          amountPaid: amountPaid.toFixed(6),
          amountDue: Decimal.max(amountDue, new Decimal(0)).toFixed(6),
          status,
        },
      });

      await this.posting.createJournal({
        organizationId,
        entryDate: new Date(body.paymentDate),
        description: `Bill payment ${paymentNumber} for ${bill.billNumber}`,
        sourceType: 'bill_payment',
        sourceId: payment.id,
        currency: bill.currency,
        exchangeRate: bill.exchangeRate.toString(),
        createdById: userId,
        lines: [
          {
            accountId: ap.id,
            debitAmount: amount.toFixed(6),
            description: paymentNumber,
          },
          {
            accountId: bank.id,
            creditAmount: amount.toFixed(6),
            description: bill.billNumber ?? bill.id,
          },
        ],
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

  payableAging(organizationId: string) {
    return prisma.bill.findMany({
      where: {
        organizationId,
        status: { in: ['OPEN', 'PARTIALLY_PAID'] },
        amountDue: { gt: 0 },
      },
      include: { supplier: true },
      orderBy: { dueDate: 'asc' },
    });
  }
}
