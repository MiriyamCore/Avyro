'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { EmptyState, Money, PageHeader } from '@/components/ui';
import { PurchasesSectionNav } from '@/components/section-nav';

type Bill = {
  id: string;
  billNumber: string | null;
  status: string;
  amountDue: string;
  currency: string;
  supplier: { name: string };
};

type Expense = {
  id: string;
  description: string;
  amount: string;
  currency: string;
  expenseDate: string;
};

type Supplier = { id: string; name: string };

export default function PurchasesHubPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<Bill[]>('/api/v1/bills').catch(() => []),
      api<Expense[]>('/api/v1/expenses').catch(() => []),
      api<Supplier[]>('/api/v1/suppliers').catch(() => []),
    ])
      .then(([b, e, s]) => {
        setBills(b);
        setExpenses(e);
        setSuppliers(s);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load purchases'),
      );
  }, []);

  const openBills = bills.filter(
    (b) => ['OPEN', 'PARTIALLY_PAID'].includes(b.status) && Number(b.amountDue) > 0,
  );
  const youOwe = openBills.reduce((s, b) => s + Number(b.amountDue), 0);

  return (
    <div className="ac-page">
      <PageHeader
        title="Purchases"
        description="Expenses, supplier bills, and receipt files — track what you owe and keep purchase records organised."
        actions={
          <>
            <Link href="/app/expense" className="ac-btn-primary">
              Record expense
            </Link>
            <Link href="/app/bills" className="ac-btn-secondary">
              New bill
            </Link>
          </>
        }
      />
      <PurchasesSectionNav />
      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="ac-card p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            You owe suppliers
          </div>
          <div className="mt-2 font-display text-2xl font-semibold">
            <Money amount={youOwe} />
          </div>
          <Link href="/app/bills" className="mt-3 inline-block text-sm font-medium text-brand">
            Pay bills →
          </Link>
        </div>
        <div className="ac-card p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            Expenses this list
          </div>
          <div className="mt-2 font-display text-2xl font-semibold">{expenses.length}</div>
          <Link href="/app/expense" className="mt-3 inline-block text-sm font-medium text-brand">
            Add expense →
          </Link>
        </div>
        <div className="ac-card p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            Suppliers
          </div>
          <div className="mt-2 font-display text-2xl font-semibold">{suppliers.length}</div>
          <Link href="/app/suppliers" className="mt-3 inline-block text-sm font-medium text-brand">
            Manage suppliers →
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="ac-card p-5">
          <h2 className="font-display text-lg font-semibold">Do next</h2>
          <div className="mt-3 grid gap-2">
            {[
              ['Record expense', '/app/expense', 'Hosting, domains, office — paid now'],
              ['Enter supplier bill', '/app/bills', 'Pay later / track AP'],
              ['Attach receipt', '/app/documents', 'Keep proof for TIN / VAT'],
              ['Owner money', '/app/owner-money', 'Capital in or drawings out'],
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
            Recent expenses
          </div>
          {expenses.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No expenses yet"
                description="Record a payment you already made — Cloudflare, internet, supplies."
                action={
                  <Link href="/app/expense" className="ac-btn-primary">
                    Record expense
                  </Link>
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {expenses.slice(0, 6).map((e) => (
                <li key={e.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div>
                    <div className="font-medium">{e.description}</div>
                    <div className="text-xs text-muted">{e.expenseDate.slice(0, 10)}</div>
                  </div>
                  <Money amount={e.amount} currency={e.currency} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
