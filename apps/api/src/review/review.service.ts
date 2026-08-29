import { Injectable } from '@nestjs/common';
import { prisma } from '@avyro/database';

@Injectable()
export class ReviewService {
  async queue(organizationId: string) {
    const now = new Date();
    const [
      draftInvoices,
      unmatchedBank,
      unsettledGateway,
      overdueInvoices,
      overdueBills,
      complianceSoon,
    ] = await Promise.all([
      prisma.invoice.findMany({
        where: { organizationId, status: 'DRAFT' },
        include: { customer: true },
        take: 20,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.bankTransaction.findMany({
        where: { organizationId, status: 'IMPORTED' },
        include: { bankAccount: true },
        take: 20,
        orderBy: { txnDate: 'desc' },
      }),
      prisma.gatewayCheckout.findMany({
        where: { organizationId, status: 'SUCCEEDED' },
        take: 20,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.invoice.findMany({
        where: {
          organizationId,
          status: { in: ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE'] },
          dueDate: { lt: now },
          amountDue: { gt: 0 },
        },
        include: { customer: true },
        take: 20,
      }),
      prisma.bill.findMany({
        where: {
          organizationId,
          status: { in: ['OPEN', 'PARTIALLY_PAID'] },
          dueDate: { lt: now },
          amountDue: { gt: 0 },
        },
        include: { supplier: true },
        take: 20,
      }),
      prisma.complianceRecord.findMany({
        where: {
          organizationId,
          status: 'ACTIVE',
          expiresOn: { not: null, lte: new Date(now.getTime() + 60 * 86400000) },
        },
        take: 20,
      }),
    ]);

    const items = [
      ...draftInvoices.map((inv) => ({
        id: `draft-inv-${inv.id}`,
        kind: 'DRAFT_INVOICE',
        severity: 'warn' as const,
        title: `Draft invoice ${inv.invoiceNumber ?? inv.id.slice(-6)}`,
        detail: inv.customer.name,
        href: '/app/invoices',
      })),
      ...unmatchedBank.map((t) => ({
        id: `bank-${t.id}`,
        kind: 'UNMATCHED_BANK',
        severity: 'warn' as const,
        title: `Unmatched bank: ${t.description}`,
        detail: `${t.bankAccount.name} · ${t.amount}`,
        href: '/app/banking',
      })),
      ...unsettledGateway.map((g) => ({
        id: `gw-${g.id}`,
        kind: 'GATEWAY_SETTLE',
        severity: 'warn' as const,
        title: 'Gateway capture awaiting settlement',
        detail: g.id,
        href: '/app/gateway',
      })),
      ...overdueInvoices.map((inv) => ({
        id: `od-inv-${inv.id}`,
        kind: 'OVERDUE_AR',
        severity: 'block' as const,
        title: `Overdue invoice ${inv.invoiceNumber ?? ''}`,
        detail: `${inv.customer.name} · due ${inv.amountDue}`,
        href: '/app/invoices',
      })),
      ...overdueBills.map((bill) => ({
        id: `od-bill-${bill.id}`,
        kind: 'OVERDUE_AP',
        severity: 'block' as const,
        title: `Overdue bill ${bill.billNumber ?? ''}`,
        detail: `${bill.supplier.name} · due ${bill.amountDue}`,
        href: '/app/bills',
      })),
      ...complianceSoon.map((r) => ({
        id: `comp-${r.id}`,
        kind: 'COMPLIANCE_EXPIRY',
        severity: 'warn' as const,
        title: `Expiring: ${r.label}`,
        detail: r.expiresOn ? String(r.expiresOn).slice(0, 10) : '',
        href: '/app/compliance',
      })),
    ];

    return {
      count: items.length,
      items,
    };
  }
}
