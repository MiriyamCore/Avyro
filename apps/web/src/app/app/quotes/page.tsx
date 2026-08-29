'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { EmptyState, Money, PageHeader, StatusBadge } from '@/components/ui';
import { SalesSectionNav } from '@/components/section-nav';

type Customer = { id: string; name: string; defaultCurrency: string };
type Quote = {
  id: string;
  quoteNumber: string | null;
  status: string;
  issueDate: string;
  validUntil: string;
  currency: string;
  grandTotal: string;
  customer: { name: string };
};

type ItemDraft = { description: string; quantity: string; unitPrice: string };

function QuotesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showForm, setShowForm] = useState(searchParams.get('new') === '1');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState(
    new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
  );
  const [currency, setCurrency] = useState('BDT');
  const [items, setItems] = useState<ItemDraft[]>([
    { description: '', quantity: '1', unitPrice: '' },
  ]);

  async function load() {
    const [rows, cust] = await Promise.all([
      api<Quote[]>('/api/v1/quotes'),
      api<Customer[]>('/api/v1/customers'),
    ]);
    setQuotes(rows);
    setCustomers(cust);
    if (!customerId && cust[0]) {
      setCustomerId(cust[0].id);
      setCurrency(cust[0].defaultCurrency);
    }
  }

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : 'Unable to load quotes'),
    );
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api('/api/v1/quotes', {
        method: 'POST',
        body: JSON.stringify({
          customerId,
          issueDate,
          validUntil,
          currency,
          items: items.filter((i) => i.description && i.unitPrice),
        }),
      });
      setShowForm(false);
      await load();
      router.replace('/app/quotes');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create quote');
    } finally {
      setSaving(false);
    }
  }

  async function convert(id: string) {
    setError(null);
    try {
      await api(`/api/v1/quotes/${id}/convert`, { method: 'POST' });
      await load();
      router.push('/app/invoices');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not convert quote');
    }
  }

  return (
    <div className="ac-page">
      <PageHeader
        title="Quotes"
        description="Send estimates, then convert accepted quotes into invoices."
        actions={
          <button type="button" className="ac-btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : 'New quote'}
          </button>
        }
      />
      <SalesSectionNav />

      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      {showForm ? (
        <form onSubmit={onSubmit} className="ac-card mb-6 grid gap-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="ac-label">Customer</span>
              <select
                className="ac-input"
                required
                value={customerId}
                onChange={(e) => {
                  const id = e.target.value;
                  setCustomerId(id);
                  const c = customers.find((x) => x.id === id);
                  if (c) setCurrency(c.defaultCurrency);
                }}
              >
                <option value="">Select…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="ac-label">Currency</span>
              <input
                className="ac-input"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              />
            </label>
            <label>
              <span className="ac-label">Quote date</span>
              <input
                className="ac-input"
                type="date"
                required
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </label>
            <label>
              <span className="ac-label">Valid until</span>
              <input
                className="ac-input"
                type="date"
                required
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </label>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-semibold">Line items</div>
            {items.map((item, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr]">
                <input
                  className="ac-input"
                  placeholder="Description"
                  required={index === 0}
                  value={item.description}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((row, i) =>
                        i === index ? { ...row, description: e.target.value } : row,
                      ),
                    )
                  }
                />
                <input
                  className="ac-input"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((row, i) =>
                        i === index ? { ...row, quantity: e.target.value } : row,
                      ),
                    )
                  }
                />
                <input
                  className="ac-input"
                  placeholder="Rate"
                  value={item.unitPrice}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((row, i) =>
                        i === index ? { ...row, unitPrice: e.target.value } : row,
                      ),
                    )
                  }
                />
              </div>
            ))}
            <button
              type="button"
              className="ac-btn-ghost"
              onClick={() =>
                setItems((prev) => [...prev, { description: '', quantity: '1', unitPrice: '' }])
              }
            >
              Add line
            </button>
          </div>
          <button type="submit" className="ac-btn-primary" disabled={saving || !customers.length}>
            {saving ? 'Saving…' : 'Save quote'}
          </button>
        </form>
      ) : null}

      {quotes.length === 0 ? (
        <EmptyState
          title="No quotes yet"
          description="Create a quote for a customer, then convert it when they accept."
          action={
            <button type="button" className="ac-btn-primary" onClick={() => setShowForm(true)}>
              New quote
            </button>
          }
        />
      ) : (
        <div className="ac-card overflow-x-auto">
          <table className="ac-table">
            <thead>
              <tr>
                <th>Quote</th>
                <th>Customer</th>
                <th>Valid until</th>
                <th>Status</th>
                <th className="text-right">Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id}>
                  <td className="font-mono text-xs">{q.quoteNumber}</td>
                  <td className="font-medium">{q.customer.name}</td>
                  <td>{q.validUntil.slice(0, 10)}</td>
                  <td>
                    <StatusBadge status={q.status} />
                  </td>
                  <td className="text-right">
                    <Money amount={q.grandTotal} currency={q.currency} />
                  </td>
                  <td className="text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Link href={`/app/quotes/${q.id}`} className="text-xs font-medium text-brand">
                        Open
                      </Link>
                      <a
                        className="text-xs font-medium text-brand"
                        href={`/api/v1/quotes/${q.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        PDF
                      </a>
                      {q.status !== 'CONVERTED' ? (
                        <button
                          type="button"
                          className="ac-btn-secondary text-xs"
                          onClick={() => convert(q.id)}
                        >
                          Convert to invoice
                        </button>
                      ) : (
                        <Link href="/app/invoices" className="text-xs font-medium text-brand">
                          View invoices →
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function QuotesPage() {
  return (
    <Suspense fallback={<div className="ac-page">Loading…</div>}>
      <QuotesClient />
    </Suspense>
  );
}
