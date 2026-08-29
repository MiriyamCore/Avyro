'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { EmptyState, Money, PageHeader, PageToolbar, SearchField, StatusBadge } from '@/components/ui';
import { SalesSectionNav } from '@/components/section-nav';

type Customer = { id: string; name: string; defaultCurrency: string };
type Invoice = {
  id: string;
  invoiceNumber: string | null;
  status: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  grandTotal: string;
  amountDue: string;
  customer: { name: string };
};

type ItemDraft = { description: string; quantity: string; unitPrice: string };

function InvoicesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showForm, setShowForm] = useState(searchParams.get('new') === '1');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  );
  const [currency, setCurrency] = useState('BDT');
  const [notes, setNotes] = useState('');
  const [taxCodeId, setTaxCodeId] = useState('');
  const [taxCodes, setTaxCodes] = useState<
    Array<{ id: string; code: string; name: string; kind: string; ratePercent: string | null }>
  >([]);
  const [items, setItems] = useState<ItemDraft[]>([
    { description: '', quantity: '1', unitPrice: '' },
  ]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [defaultTermsDays, setDefaultTermsDays] = useState(30);

  async function load() {
    const [inv, cust, taxes, org] = await Promise.all([
      api<Invoice[]>('/api/v1/invoices'),
      api<Customer[]>('/api/v1/customers'),
      api<Array<{ id: string; code: string; name: string; kind: string; ratePercent: string | null }>>(
        '/api/v1/compliance/tax-codes',
      ).catch(() => []),
      api<{ defaultPaymentTermsDays?: number }>('/api/v1/organizations/current').catch(
        () => ({ defaultPaymentTermsDays: 30 }),
      ),
    ]);
    setInvoices(inv);
    setCustomers(cust);
    setTaxCodes(taxes);
    const terms = org.defaultPaymentTermsDays ?? 30;
    setDefaultTermsDays(terms);
    setDueDate(new Date(Date.now() + terms * 86400000).toISOString().slice(0, 10));
    if (!customerId && cust[0]) {
      setCustomerId(cust[0].id);
      setCurrency(cust[0].defaultCurrency);
    }
  }

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : 'Unable to load invoices'),
    );
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const invoice = await api<{ id: string }>('/api/v1/invoices', {
        method: 'POST',
        body: JSON.stringify({
          customerId,
          issueDate,
          dueDate,
          currency,
          notes,
          taxCodeId: taxCodeId || undefined,
          items: items.filter((i) => i.description && i.unitPrice),
        }),
      });
      await api(`/api/v1/invoices/${invoice.id}/issue`, { method: 'POST' });
      setShowForm(false);
      await load();
      router.replace('/app/invoices');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create invoice');
    } finally {
      setSaving(false);
    }
  }

  async function issueDraft(id: string) {
    setError(null);
    try {
      await api(`/api/v1/invoices/${id}/issue`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not issue invoice');
    }
  }

  const filtered = invoices.filter((inv) => {
    if (statusFilter !== 'ALL' && inv.status !== statusFilter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      (inv.invoiceNumber ?? '').toLowerCase().includes(q) ||
      inv.customer.name.toLowerCase().includes(q) ||
      inv.status.toLowerCase().includes(q)
    );
  });

  return (
    <div className="ac-page">
      <PageHeader
        title="Invoices"
        description="Create and issue invoices — the ledger posts automatically."
        actions={
          <button type="button" className="ac-btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : 'New invoice'}
          </button>
        }
      />
      <SalesSectionNav />

      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      {invoices.length > 0 ? (
        <PageToolbar>
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Search number, customer, status…"
          />
          <select
            className="ac-input w-full sm:max-w-[180px]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="ISSUED">Issued</option>
            <option value="SENT">Sent</option>
            <option value="PARTIALLY_PAID">Partially paid</option>
            <option value="PAID">Paid</option>
            <option value="OVERDUE">Overdue</option>
            <option value="CREDITED">Credited</option>
          </select>
        </PageToolbar>
      ) : null}

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
              <span className="ac-label">Invoice date</span>
              <input
                className="ac-input"
                type="date"
                required
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </label>
            <label>
              <span className="ac-label">Due date</span>
              <input
                className="ac-input"
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
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

          <label>
            <span className="ac-label">Notes</span>
            <input
              className="ac-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <label>
            <span className="ac-label">Tax code (optional)</span>
            <select
              className="ac-input"
              value={taxCodeId}
              onChange={(e) => setTaxCodeId(e.target.value)}
            >
              <option value="">None</option>
              {taxCodes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} · {t.kind}
                  {t.ratePercent != null ? ` (${t.ratePercent}%)` : ' (set rate in Compliance)'}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap gap-2">
            <button type="submit" className="ac-btn-primary" disabled={saving || !customers.length}>
              {saving ? 'Creating…' : 'Create & issue'}
            </button>
            {!customers.length ? (
              <Link href="/app/customers?new=1" className="ac-btn-secondary">
                Add a customer first
              </Link>
            ) : null}
          </div>
        </form>
      ) : null}

      {invoices.length === 0 ? (
        <EmptyState
          title="No invoices yet"
          description="Create an invoice for a customer. Issuing it posts accounts receivable and revenue."
          action={
            <button type="button" className="ac-btn-primary" onClick={() => setShowForm(true)}>
              New invoice
            </button>
          }
        />
      ) : (
        <div className="ac-table-wrap">
          <table className="ac-table ac-table-zebra">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Dates</th>
                <th>Status</th>
                <th className="text-right">Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => (
                <tr key={inv.id}>
                  <td className="font-mono text-xs">
                    <Link href={`/app/invoices/${inv.id}`} className="text-brand hover:underline">
                      {inv.invoiceNumber ?? 'Draft'}
                    </Link>
                  </td>
                  <td className="font-medium">{inv.customer.name}</td>
                  <td className="text-xs text-muted">
                    {inv.issueDate.slice(0, 10)}
                    <br />
                    due {inv.dueDate.slice(0, 10)}
                  </td>
                  <td>
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="text-right">
                    <Money amount={inv.grandTotal} currency={inv.currency} />
                    {Number(inv.amountDue) > 0 && inv.status !== 'DRAFT' ? (
                      <div className="text-xs text-muted">
                        due <Money amount={inv.amountDue} currency={inv.currency} />
                      </div>
                    ) : null}
                  </td>
                  <td className="text-right">
                    {inv.status === 'DRAFT' ? (
                      <button
                        type="button"
                        className="ac-btn-secondary text-xs"
                        onClick={() => issueDraft(inv.id)}
                      >
                        Issue
                      </button>
                    ) : Number(inv.amountDue) > 0 ? (
                      <div className="flex flex-col items-end gap-1">
                        <Link
                          href={`/app/payments?invoiceId=${inv.id}`}
                          className="ac-btn-secondary text-xs"
                        >
                          Record payment
                        </Link>
                        <button
                          type="button"
                          className="ac-btn-ghost text-xs"
                          onClick={async () => {
                            setError(null);
                            try {
                              const checkout = await api<{ token: string }>(
                                '/api/v1/gateway/checkouts',
                                {
                                  method: 'POST',
                                  body: JSON.stringify({ invoiceId: inv.id }),
                                },
                              );
                              window.open(`/pay/${checkout.token}`, '_blank');
                            } catch (err) {
                              setError(
                                err instanceof Error
                                  ? err.message
                                  : 'Could not create checkout',
                              );
                            }
                          }}
                        >
                          Pay online
                        </button>
                        <button
                          type="button"
                          className="ac-btn-ghost text-xs"
                          onClick={async () => {
                            setError(null);
                            try {
                              await api(`/api/v1/invoices/${inv.id}/credit`, {
                                method: 'POST',
                                body: JSON.stringify({ reason: 'Full credit' }),
                              });
                              await load();
                            } catch (err) {
                              setError(
                                err instanceof Error ? err.message : 'Could not credit invoice',
                              );
                            }
                          }}
                        >
                          Credit
                        </button>
                        <a
                          className="text-xs font-medium text-brand"
                          href={`/api/v1/invoices/${inv.id}/pdf?v=wave2`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          PDF
                        </a>
                      </div>
                    ) : (
                      <a
                        className="text-xs font-medium text-brand"
                        href={`/api/v1/invoices/${inv.id}/pdf?v=wave2`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        PDF
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 ? (
            <p className="p-6 text-sm text-muted">No invoices match this search.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={<div className="ac-page">Loading…</div>}>
      <InvoicesClient />
    </Suspense>
  );
}
