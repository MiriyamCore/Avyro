'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { EmptyState, Money, PageHeader, StatusBadge } from '@/components/ui';

type Invoice = {
  id: string;
  invoiceNumber: string | null;
  amountDue: string;
  currency: string;
  status: string;
  customer: { name: string };
};

type Checkout = {
  id: string;
  token: string;
  amount: string;
  currency: string;
  status: string;
  feeAmount: string | null;
  invoiceId: string;
  providerRef: string | null;
};

export default function GatewayPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [invoiceId, setInvoiceId] = useState('');
  const [provider, setProvider] = useState('TEST');
  const [providers, setProviders] = useState<
    Array<{ id: string; label: string; available: boolean }>
  >([{ id: 'TEST', label: 'Test checkout', available: true }]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const [inv, cos, prov] = await Promise.all([
      api<Invoice[]>('/api/v1/invoices'),
      api<Checkout[]>('/api/v1/gateway/checkouts'),
      api<{ providers: Array<{ id: string; label: string; available: boolean }> }>(
        '/api/v1/gateway/providers',
      ).catch(() => ({ providers: [{ id: 'TEST', label: 'Test checkout', available: true }] })),
    ]);
    setInvoices(
      inv.filter(
        (i) =>
          ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE'].includes(i.status) &&
          Number(i.amountDue) > 0,
      ),
    );
    setCheckouts(cos);
    setProviders(prov.providers);
    if (!invoiceId && inv[0]) setInvoiceId(inv[0].id);
  }

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : 'Unable to load gateway'),
    );
  }, []);

  async function createCheckout(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const checkout = await api<Checkout & { sslcommerz?: { gatewayPageUrl?: string | null } }>(
        '/api/v1/gateway/checkouts',
        {
          method: 'POST',
          body: JSON.stringify({ invoiceId, provider }),
        },
      );
      if (checkout.sslcommerz?.gatewayPageUrl) {
        setMessage(`SSLCommerz session ready — ${checkout.sslcommerz.gatewayPageUrl}`);
      } else {
        setMessage(`Checkout created — share /pay/${checkout.token}`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create checkout');
    }
  }

  async function settle(id: string) {
    setError(null);
    try {
      await api(`/api/v1/gateway/checkouts/${id}/settle`, { method: 'POST' });
      setMessage('Settled to bank (net of fee)');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Settle failed');
    }
  }

  return (
    <div className="ac-page">
      <PageHeader
        title="Payment gateway"
        description="Test checkout (and SSLCommerz sandbox when configured): capture to clearing (1120), settle to bank with fee (5400). Manual mark-paid remains on Payments."
      />
      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}
      {message ? <p className="mb-4 text-sm text-success">{message}</p> : null}

      <form onSubmit={createCheckout} className="ac-card mb-6 grid gap-4 p-5 sm:grid-cols-[1fr_auto_auto]">
        <label>
          <span className="ac-label">Invoice to collect</span>
          <select
            className="ac-input"
            required
            value={invoiceId}
            onChange={(e) => setInvoiceId(e.target.value)}
          >
            <option value="">Select…</option>
            {invoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.invoiceNumber} — {inv.customer.name} (due {inv.amountDue} {inv.currency})
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="ac-label">Provider</span>
          <select
            className="ac-input"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            {providers
              .filter((p) => p.available)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
          </select>
        </label>
        <div className="flex items-end">
          <button type="submit" className="ac-btn-primary" disabled={!invoices.length}>
            Create checkout link
          </button>
        </div>
      </form>

      {checkouts.length === 0 ? (
        <EmptyState
          title="No gateway checkouts"
          description="Create a checkout for an issued invoice, then open the public pay page."
        />
      ) : (
        <div className="ac-card overflow-x-auto">
          <table className="ac-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Amount</th>
                <th>Fee</th>
                <th>Link</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {checkouts.map((c) => (
                <tr key={c.id}>
                  <td>
                    <StatusBadge status={c.status} />
                  </td>
                  <td>
                    <Money amount={c.amount} currency={c.currency} />
                  </td>
                  <td>
                    {c.feeAmount ? <Money amount={c.feeAmount} currency={c.currency} /> : '—'}
                  </td>
                  <td>
                    <a
                      className="font-mono text-xs text-brand"
                      href={`/pay/${c.token}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      /pay/{c.token.slice(0, 8)}…
                    </a>
                  </td>
                  <td className="text-right">
                    {c.status === 'SUCCEEDED' ? (
                      <button
                        type="button"
                        className="ac-btn-secondary text-xs"
                        onClick={() => settle(c.id)}
                      >
                        Settle
                      </button>
                    ) : null}
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
