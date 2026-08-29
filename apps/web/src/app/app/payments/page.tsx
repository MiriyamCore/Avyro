'use client';

import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { EmptyState, Money, PageHeader, StatusBadge } from '@/components/ui';
import { SalesSectionNav } from '@/components/section-nav';

type Invoice = {
  id: string;
  invoiceNumber: string | null;
  status: string;
  currency: string;
  amountDue: string;
  customer: { name: string };
};

type Payment = {
  id: string;
  paymentNumber: string;
  paymentDate: string;
  amount: string;
  currency: string;
  status: string;
  customer?: { name: string } | null;
  invoice?: { invoiceNumber: string | null } | null;
};

function PaymentsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselected = searchParams.get('invoiceId') ?? '';
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceId, setInvoiceId] = useState(preselected);
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const openInvoices = useMemo(
    () =>
      invoices.filter(
        (i) =>
          ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE'].includes(i.status) &&
          Number(i.amountDue) > 0,
      ),
    [invoices],
  );

  async function load() {
    const [pays, invs] = await Promise.all([
      api<Payment[]>('/api/v1/payments'),
      api<Invoice[]>('/api/v1/invoices'),
    ]);
    setPayments(pays);
    setInvoices(invs);
  }

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : 'Unable to load payments'),
    );
  }, []);

  useEffect(() => {
    const selected = openInvoices.find((i) => i.id === invoiceId);
    if (selected) {
      setAmount(String(Number(selected.amountDue)));
      // Prefer lookup; fall back empty so user can set settlement rate
      api<{ rateToBase?: string }>(
        `/api/v1/fx/rates/lookup?currency=${selected.currency}&date=${paymentDate}`,
      )
        .then((r) => setExchangeRate(r?.rateToBase ?? ''))
        .catch(() => setExchangeRate(''));
    }
  }, [invoiceId, openInvoices, paymentDate]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api('/api/v1/payments', {
        method: 'POST',
        body: JSON.stringify({
          invoiceId,
          paymentDate,
          amount,
          reference,
          method: 'BANK_TRANSFER',
          ...(exchangeRate ? { exchangeRate } : {}),
        }),
      });
      setReference('');
      await load();
      router.replace('/app/payments');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record payment');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ac-page">
      <PageHeader
        title="Payments"
        description="Record customer payments against issued invoices."
      />
      <SalesSectionNav />

      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      <form onSubmit={onSubmit} className="ac-card mb-6 grid gap-4 p-5 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="ac-label">Invoice</span>
          <select
            className="ac-input"
            required
            value={invoiceId}
            onChange={(e) => setInvoiceId(e.target.value)}
          >
            <option value="">Select unpaid invoice…</option>
            {openInvoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.invoiceNumber} — {inv.customer.name} (due {inv.amountDue} {inv.currency})
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="ac-label">Payment date</span>
          <input
            className="ac-input"
            type="date"
            required
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
          />
        </label>
        <label>
          <span className="ac-label">Amount</span>
          <input
            className="ac-input"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label>
          <span className="ac-label">Settlement rate (BDT per 1)</span>
          <input
            className="ac-input"
            value={exchangeRate}
            onChange={(e) => setExchangeRate(e.target.value)}
            placeholder="Leave blank to use invoice rate"
          />
        </label>
        <label className="sm:col-span-2">
          <span className="ac-label">Reference</span>
          <input
            className="ac-input"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Bank transfer ref"
          />
        </label>
        <div>
          <button type="submit" className="ac-btn-primary" disabled={saving || !openInvoices.length}>
            {saving ? 'Saving…' : 'Record payment'}
          </button>
        </div>
      </form>

      {payments.length === 0 ? (
        <EmptyState
          title="No payments yet"
          description="When a customer pays, record it here to clear receivables."
        />
      ) : (
        <div className="ac-table-wrap">
          <table className="ac-table ac-table-zebra">
            <thead>
              <tr>
                <th>Payment</th>
                <th>Customer / Invoice</th>
                <th>Date</th>
                <th>Status</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono text-xs">{p.paymentNumber}</td>
                  <td>
                    <div className="font-medium">{p.customer?.name ?? '—'}</div>
                    <div className="text-xs text-muted">{p.invoice?.invoiceNumber}</div>
                  </td>
                  <td>{p.paymentDate.slice(0, 10)}</td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="text-right">
                    <Money amount={p.amount} currency={p.currency} />
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

export default function PaymentsPage() {
  return (
    <Suspense fallback={<div className="ac-page">Loading…</div>}>
      <PaymentsClient />
    </Suspense>
  );
}
