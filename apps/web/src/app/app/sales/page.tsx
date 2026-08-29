'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { EmptyState, Money, PageHeader } from '@/components/ui';
import { SalesSectionNav } from '@/components/section-nav';

type Invoice = {
  id: string;
  invoiceNumber: string | null;
  status: string;
  amountDue: string;
  currency: string;
  customer: { name: string };
};

type Customer = { id: string; name: string };

export default function SalesHubPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<Invoice[]>('/api/v1/invoices'),
      api<Customer[]>('/api/v1/customers'),
    ])
      .then(([inv, cust]) => {
        setInvoices(inv);
        setCustomers(cust);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load sales'),
      );
  }, []);

  const open = invoices.filter((i) =>
    ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE'].includes(i.status),
  );
  const owed = open.reduce((s, i) => s + Number(i.amountDue), 0);
  const overdue = invoices.filter((i) => i.status === 'OVERDUE' || (Number(i.amountDue) > 0 && i.status === 'OVERDUE'));

  return (
    <div className="ac-page">
      <PageHeader
        title="Sales"
        description="Invoice customers, send quotes, and record payments — like Wave’s Sales & Payments, for ৳."
        actions={
          <>
            <Link href="/app/invoices?new=1" className="ac-btn-primary">
              New invoice
            </Link>
            <Link href="/app/quotes?new=1" className="ac-btn-secondary">
              New quote
            </Link>
          </>
        }
      />
      <SalesSectionNav />
      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="ac-card p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            Customers owe you
          </div>
          <div className="mt-2 font-display text-2xl font-semibold">
            <Money amount={owed} />
          </div>
          <Link href="/app/invoices" className="mt-3 inline-block text-sm font-medium text-brand">
            Open invoices →
          </Link>
        </div>
        <div className="ac-card p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            Open invoices
          </div>
          <div className="mt-2 font-display text-2xl font-semibold">{open.length}</div>
          <Link href="/app/payments" className="mt-3 inline-block text-sm font-medium text-brand">
            Record a payment →
          </Link>
        </div>
        <div className="ac-card p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            Customers
          </div>
          <div className="mt-2 font-display text-2xl font-semibold">{customers.length}</div>
          <Link href="/app/customers?new=1" className="mt-3 inline-block text-sm font-medium text-brand">
            Add customer →
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="ac-card p-5">
          <h2 className="font-display text-lg font-semibold">Do next</h2>
          <div className="mt-3 grid gap-2">
            {[
              ['Create invoice', '/app/invoices?new=1', 'Bill work you finished'],
              ['Send a quote', '/app/quotes?new=1', 'Estimate before you start'],
              ['Add customer', '/app/customers?new=1', 'Who you invoice'],
              ['Mark paid', '/app/payments', 'Bank transfer or cash received'],
            ].map(([label, href, hint]) => (
              <Link
                key={href}
                href={href!}
                className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5 hover:bg-brand-soft"
              >
                <div>
                  <div className="text-sm font-semibold">{label}</div>
                  <div className="text-xs text-muted">{hint}</div>
                </div>
                <span className="text-xs font-semibold text-brand">Go</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="ac-card overflow-hidden">
          <div className="border-b border-line px-5 py-3 font-display text-lg font-semibold">
            Recent invoices
          </div>
          {invoices.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No invoices yet"
                description="Create a customer, then issue your first invoice in BDT."
                action={
                  <Link href="/app/invoices?new=1" className="ac-btn-primary">
                    New invoice
                  </Link>
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {invoices.slice(0, 6).map((inv) => (
                <li key={inv.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div>
                    <div className="font-medium">
                      {inv.invoiceNumber ?? 'Draft'} · {inv.customer.name}
                    </div>
                    <div className="text-xs text-muted">{inv.status.replaceAll('_', ' ')}</div>
                  </div>
                  <Money amount={inv.amountDue} currency={inv.currency} />
                </li>
              ))}
            </ul>
          )}
          {overdue.length > 0 ? (
            <div className="border-t border-line bg-amber-50 px-5 py-2 text-xs text-warning">
              {overdue.length} overdue — chase payment or record receipt.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
