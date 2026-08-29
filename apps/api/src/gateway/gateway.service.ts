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
import { randomBytes } from 'node:crypto';

@Injectable()
export class GatewayService {
  private readonly posting = new AccountingPostingService(prisma);

  listCheckouts(organizationId: string) {
    return prisma.gatewayCheckout.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getByToken(token: string) {
    const checkout = await prisma.gatewayCheckout.findUnique({
      where: { token },
    });
    if (!checkout) {
      throw new NotFoundException({
        error: { code: 'CHECKOUT_NOT_FOUND', message: 'Checkout not found.' },
      });
    }
    const invoice = await prisma.invoice.findFirst({
      where: { id: checkout.invoiceId, organizationId: checkout.organizationId },
      include: { customer: true, items: true },
    });
    const org = await prisma.organization.findUnique({
      where: { id: checkout.organizationId },
    });
    return { checkout, invoice, organization: org };
  }

  providers() {
    const ssl =
      Boolean(process.env.SSLCOMMERZ_STORE_ID) &&
      Boolean(process.env.SSLCOMMERZ_STORE_PASSWD);
    const bkash =
      Boolean(process.env.BKASH_APP_KEY) && Boolean(process.env.BKASH_APP_SECRET);
    const nagad =
      Boolean(process.env.NAGAD_MERCHANT_ID) && Boolean(process.env.NAGAD_MERCHANT_KEY);
    return {
      providers: [
        {
          id: 'TEST',
          label: 'Test checkout',
          description: 'Full capture → settle → fee → clearing without a live PSP.',
          available: true,
          mode: 'TEST',
        },
        {
          id: 'SSLCOMMERZ',
          label: 'SSLCommerz sandbox',
          description: 'Sandbox hosted checkout when SSLCOMMERZ_* env is set.',
          available: ssl,
          mode: ssl ? 'SANDBOX' : 'DISABLED',
        },
        {
          id: 'BKASH',
          label: 'bKash (stub)',
          description: 'Adapter stub — configure BKASH_APP_KEY and BKASH_APP_SECRET for future integration.',
          available: bkash,
          mode: bkash ? 'CONFIGURED' : 'TEST_ONLY',
        },
        {
          id: 'NAGAD',
          label: 'Nagad (stub)',
          description: 'Adapter stub — configure NAGAD_MERCHANT_ID and NAGAD_MERCHANT_KEY.',
          available: nagad,
          mode: nagad ? 'CONFIGURED' : 'TEST_ONLY',
        },
      ],
    };
  }

  /**
   * Test checkout webhook: customer paid successfully.
   * Posts Dr Clearing / Cr AR (via payment record) without touching bank yet.
   */
  async testSucceed(token: string) {
    return this.captureSuccess(token, 'test');
  }

  /** @deprecated alias */
  mockSucceed(token: string) {
    return this.testSucceed(token);
  }

  private async captureSuccess(token: string, providerTag: string) {
    const checkout = await prisma.gatewayCheckout.findUnique({ where: { token } });
    if (!checkout) {
      throw new NotFoundException({
        error: { code: 'CHECKOUT_NOT_FOUND', message: 'Checkout not found.' },
      });
    }
    if (checkout.status !== 'PENDING') {
      throw new BadRequestException({
        error: {
          code: 'CHECKOUT_NOT_PENDING',
          message: `Checkout is ${checkout.status}.`,
        },
      });
    }

    const invoice = await prisma.invoice.findFirst({
      where: { id: checkout.invoiceId, organizationId: checkout.organizationId },
    });
    if (!invoice) {
      throw new NotFoundException({
        error: { code: 'INVOICE_NOT_FOUND', message: 'Invoice not found.' },
      });
    }

    const amount = new Decimal(checkout.amount.toString());
    const rate = new Decimal(checkout.exchangeRate.toString());
    const feePercent = new Decimal(checkout.feePercent.toString());
    const feeAmount = amount.times(feePercent);
    const ar = await prisma.ledgerAccount.findFirst({
      where: { organizationId: checkout.organizationId, code: '1200' },
    });
    const clearingId = checkout.clearingAccountId;
    if (!ar || !clearingId) {
      throw new BadRequestException({
        error: { code: 'MISSING_ACCOUNTS', message: 'AR or clearing missing.' },
      });
    }

    try {
      const count = await prisma.payment.count({
        where: { organizationId: checkout.organizationId },
      });
      const paymentNumber = `PAY-${String(count + 1).padStart(5, '0')}`;
      const payment = await prisma.payment.create({
        data: {
          organizationId: checkout.organizationId,
          customerId: invoice.customerId,
          invoiceId: invoice.id,
          paymentNumber,
          paymentDate: new Date(),
          amount: amount.toFixed(6),
          currency: checkout.currency,
          exchangeRate: rate.toFixed(8),
          method: 'PAYMENT_GATEWAY',
          destinationAccountId: clearingId,
          reference: `${providerTag}:${token.slice(0, 8)}`,
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

      await this.posting.createJournal({
        organizationId: checkout.organizationId,
        entryDate: new Date(),
        description: `Gateway capture ${paymentNumber}`,
        sourceType: 'gateway_capture',
        sourceId: checkout.id,
        currency: checkout.currency,
        exchangeRate: rate.toString(),
        lines: [
          {
            accountId: clearingId,
            debitAmount: amount.toFixed(6),
            description: paymentNumber,
          },
          {
            accountId: ar.id,
            creditAmount: amount.toFixed(6),
            description: invoice.invoiceNumber ?? invoice.id,
          },
        ],
      });

      return prisma.gatewayCheckout.update({
        where: { id: checkout.id },
        data: {
          status: 'SUCCEEDED',
          providerRef: `${providerTag}_${Date.now()}`,
          feeAmount: feeAmount.toFixed(6),
          paymentId: payment.id,
          succeededAt: new Date(),
        },
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

  async createCheckout(
    organizationId: string,
    body: {
      invoiceId: string;
      feePercent?: string;
      provider?: 'TEST' | 'SSLCOMMERZ' | 'MOCK';
    },
  ) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: body.invoiceId, organizationId },
      include: { customer: true },
    });
    if (!invoice) {
      throw new NotFoundException({
        error: { code: 'INVOICE_NOT_FOUND', message: 'Invoice not found.' },
      });
    }
    if (!['ISSUED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE'].includes(invoice.status)) {
      throw new BadRequestException({
        error: {
          code: 'INVOICE_NOT_PAYABLE',
          message: 'Only issued invoices can be paid online.',
        },
      });
    }
    if (new Decimal(invoice.amountDue.toString()).lte(0)) {
      throw new BadRequestException({
        error: { code: 'NOTHING_DUE', message: 'Invoice has nothing due.' },
      });
    }

    const clearing = await prisma.ledgerAccount.findFirst({
      where: { organizationId, code: '1120' },
    });
    if (!clearing) {
      throw new BadRequestException({
        error: {
          code: 'MISSING_CLEARING',
          message: 'Payment Gateway Clearing account 1120 is missing.',
        },
      });
    }

    let provider: 'TEST' | 'SSLCOMMERZ' =
      body.provider === 'SSLCOMMERZ' ? 'SSLCOMMERZ' : 'TEST';
    if (provider === 'SSLCOMMERZ') {
      const ssl =
        Boolean(process.env.SSLCOMMERZ_STORE_ID) &&
        Boolean(process.env.SSLCOMMERZ_STORE_PASSWD);
      if (!ssl) {
        throw new BadRequestException({
          error: {
            code: 'SSLCOMMERZ_NOT_CONFIGURED',
            message: 'SSLCommerz sandbox env is not configured.',
          },
        });
      }
    }

    const token = randomBytes(24).toString('hex');
    const checkout = await prisma.gatewayCheckout.create({
      data: {
        organizationId,
        invoiceId: invoice.id,
        token,
        amount: invoice.amountDue.toString(),
        currency: invoice.currency,
        exchangeRate: invoice.exchangeRate,
        feePercent: body.feePercent ?? '0.025',
        clearingAccountId: clearing.id,
        provider,
        status: 'PENDING',
      },
    });

    if (provider === 'SSLCOMMERZ') {
      const session = await this.initiateSslCommerz(checkout, invoice);
      return { ...checkout, sslcommerz: session };
    }

    return checkout;
  }

  private async initiateSslCommerz(
    checkout: {
      id: string;
      token: string;
      amount: { toString(): string } | string;
      currency: string;
    },
    invoice: {
      invoiceNumber: string | null;
      customer: { name: string; email?: string | null };
    },
  ) {
    const storeId = process.env.SSLCOMMERZ_STORE_ID!;
    const storePasswd = process.env.SSLCOMMERZ_STORE_PASSWD!;
    const base =
      process.env.SSLCOMMERZ_API_URL ??
      'https://sandbox.sslcommerz.com/gwprocess/v4/api.php';
    const web = process.env.WEB_URL ?? 'http://localhost:3000';
    const successUrl = `${web}/pay/${checkout.token}?ssl=success`;
    const failUrl = `${web}/pay/${checkout.token}?ssl=fail`;
    const cancelUrl = `${web}/pay/${checkout.token}?ssl=cancel`;
    const ipnUrl = `${process.env.API_URL ?? 'http://127.0.0.1:3001'}/api/v1/gateway/sslcommerz/ipn`;

    const params = new URLSearchParams({
      store_id: storeId,
      store_passwd: storePasswd,
      total_amount: new Decimal(checkout.amount.toString()).toFixed(2),
      currency: checkout.currency === 'BDT' ? 'BDT' : checkout.currency,
      tran_id: checkout.token.slice(0, 30),
      success_url: successUrl,
      fail_url: failUrl,
      cancel_url: cancelUrl,
      ipn_url: ipnUrl,
      cus_name: invoice.customer.name,
      cus_email: invoice.customer.email ?? 'billing@example.com',
      cus_add1: 'Dhaka',
      cus_city: 'Dhaka',
      cus_country: 'Bangladesh',
      cus_phone: '01700000000',
      shipping_method: 'NO',
      product_name: invoice.invoiceNumber ?? 'Invoice',
      product_category: 'Service',
      product_profile: 'general',
      value_a: checkout.id,
    });

    try {
      const res = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      const json = (await res.json()) as {
        status?: string;
        GatewayPageURL?: string;
        sessionkey?: string;
        failedreason?: string;
      };
      if (json.status === 'SUCCESS' && json.GatewayPageURL) {
        await prisma.gatewayCheckout.update({
          where: { id: checkout.id },
          data: { providerRef: json.sessionkey ?? json.GatewayPageURL },
        });
        return {
          gatewayPageUrl: json.GatewayPageURL,
          sessionKey: json.sessionkey ?? null,
        };
      }
      return {
        gatewayPageUrl: null,
        sessionKey: null,
        error: json.failedreason ?? 'SSLCommerz session failed',
      };
    } catch (error) {
      return {
        gatewayPageUrl: null,
        sessionKey: null,
        error: error instanceof Error ? error.message : 'SSLCommerz unreachable',
      };
    }
  }

  async sslCommerzIpn(body: { tran_id?: string; status?: string; val_id?: string }) {
    const token = body.tran_id;
    if (!token) {
      throw new BadRequestException({
        error: { code: 'MISSING_TRAN', message: 'tran_id required.' },
      });
    }
    const checkout = await prisma.gatewayCheckout.findFirst({
      where: { token: { startsWith: token.slice(0, 20) } },
    });
    // Prefer exact match on stored token prefix used as tran_id
    const exact =
      (await prisma.gatewayCheckout.findFirst({
        where: { token },
      })) ??
      (await prisma.gatewayCheckout.findFirst({
        where: { token: { startsWith: token } },
      })) ??
      checkout;
    if (!exact) {
      throw new NotFoundException({
        error: { code: 'CHECKOUT_NOT_FOUND', message: 'Checkout not found.' },
      });
    }
    if (body.status === 'VALID' || body.status === 'VALIDATED') {
      return this.captureSuccess(exact.token, 'sslcommerz');
    }
    return this.testFail(exact.token);
  }

  /** Move clearing → bank net of fee; fee expense to 5400. */
  async settle(organizationId: string, checkoutId: string, userId?: string) {
    const checkout = await prisma.gatewayCheckout.findFirst({
      where: { id: checkoutId, organizationId },
    });
    if (!checkout) {
      throw new NotFoundException({
        error: { code: 'CHECKOUT_NOT_FOUND', message: 'Checkout not found.' },
      });
    }
    if (checkout.status !== 'SUCCEEDED') {
      throw new BadRequestException({
        error: {
          code: 'NOT_READY_TO_SETTLE',
          message: 'Only succeeded checkouts can be settled.',
        },
      });
    }

    const clearingId = checkout.clearingAccountId;
    const bank = await prisma.ledgerAccount.findFirst({
      where: { organizationId, code: '1110' },
    });
    const feeAccount = await prisma.ledgerAccount.findFirst({
      where: { organizationId, code: '5400' },
    });
    if (!clearingId || !bank || !feeAccount) {
      throw new BadRequestException({
        error: {
          code: 'MISSING_ACCOUNTS',
          message: 'Clearing, bank, or fee account missing.',
        },
      });
    }

    const amount = new Decimal(checkout.amount.toString());
    const fee = new Decimal(checkout.feeAmount?.toString() ?? '0');
    const net = amount.minus(fee);
    const rate = new Decimal(checkout.exchangeRate.toString());

    try {
      await this.posting.createJournal({
        organizationId,
        entryDate: new Date(),
        description: `Gateway settlement ${checkout.providerRef ?? checkout.id}`,
        sourceType: 'gateway_settlement',
        sourceId: checkout.id,
        currency: checkout.currency,
        exchangeRate: rate.toString(),
        createdById: userId,
        lines: [
          {
            accountId: bank.id,
            debitAmount: net.toFixed(6),
            description: 'Net settlement',
          },
          {
            accountId: feeAccount.id,
            debitAmount: fee.toFixed(6),
            description: 'Gateway processing fee',
          },
          {
            accountId: clearingId,
            creditAmount: amount.toFixed(6),
            description: 'Clear clearing',
          },
        ],
      });

      return prisma.gatewayCheckout.update({
        where: { id: checkout.id },
        data: { status: 'SETTLED', settledAt: new Date() },
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

  async testFail(token: string) {
    const checkout = await prisma.gatewayCheckout.findUnique({ where: { token } });
    if (!checkout) {
      throw new NotFoundException({
        error: { code: 'CHECKOUT_NOT_FOUND', message: 'Checkout not found.' },
      });
    }
    if (checkout.status !== 'PENDING') {
      throw new BadRequestException({
        error: { code: 'CHECKOUT_NOT_PENDING', message: `Checkout is ${checkout.status}.` },
      });
    }
    return prisma.gatewayCheckout.update({
      where: { id: checkout.id },
      data: { status: 'FAILED' },
    });
  }

  mockFail(token: string) {
    return this.testFail(token);
  }
}
