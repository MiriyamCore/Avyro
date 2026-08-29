import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@avyro/database';
import { enqueueEmail } from '../queue/email.queue.js';

@Injectable()
export class NotificationsService {
  async enqueueInvoiceEmail(
    organizationId: string,
    invoiceId: string,
    to: string,
    attachPdf: boolean,
  ) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId },
      include: { customer: true, items: true },
    });
    if (!invoice) {
      throw new NotFoundException({
        error: { code: 'INVOICE_NOT_FOUND', message: 'Invoice not found.' },
      });
    }
    if (!to?.includes('@')) {
      throw new BadRequestException({
        error: { code: 'INVALID_EMAIL', message: 'Valid recipient email required.' },
      });
    }

    let attachment:
      | { filename: string; contentBase64: string; contentType?: string }
      | undefined;
    if (attachPdf) {
      const org = await prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
      });
      const { buildInvoicePdf } = await import('../sales/invoice-pdf.js');
      const pdf = await buildInvoicePdf({
        organizationName: org.name,
        legalName: org.legalName,
        organizationAddress: org.address,
        organizationEmail: org.email,
        organizationPhone: org.phone,
        taxIdentifier: org.taxIdentifier,
        vatIdentifier: org.vatIdentifier,
        tradeLicenseNumber: org.tradeLicenseNumber,
        invoiceFooter: org.invoiceFooter,
        primaryColor: org.invoicePrimaryColor,
        accentColor: org.invoiceAccentColor,
        invoiceNumber: invoice.invoiceNumber ?? 'DRAFT',
        issueDate: invoice.issueDate.toISOString().slice(0, 10),
        dueDate: invoice.dueDate.toISOString().slice(0, 10),
        currency: invoice.currency,
        customerName: invoice.customer.name,
        items: invoice.items.map((i) => ({
          description: i.description,
          quantity: i.quantity.toString(),
          unitPrice: i.unitPrice.toString(),
          lineTotal: i.lineTotal.toString(),
        })),
        subtotal: invoice.subtotal.toString(),
        taxTotal: invoice.taxTotal.toString(),
        grandTotal: invoice.grandTotal.toString(),
        amountPaid: invoice.amountPaid.toString(),
        amountDue: invoice.amountDue.toString(),
        status: invoice.status,
      });
      attachment = {
        filename: `${invoice.invoiceNumber ?? invoice.id}.pdf`,
        contentBase64: pdf.toString('base64'),
        contentType: 'application/pdf',
      };
    }

    const job = await enqueueEmail({
      to,
      subject: `Invoice ${invoice.invoiceNumber ?? ''}`.trim(),
      text: `Invoice ${invoice.invoiceNumber ?? invoice.id} — amount due ${invoice.amountDue} ${invoice.currency}.`,
      attachment,
    });

    return { queued: true, jobId: job.id };
  }
}
