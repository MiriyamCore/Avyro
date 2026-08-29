'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Money } from '@/components/ui';

type Payload = {
  checkout: {
    token: string;
    amount: string;
    currency: string;
    status: string;
    feePercent: string;
  };
  invoice: {
    invoiceNumber: string | null;
    customer: { name: string };
    items: Array<{ description: string; lineTotal: string }>;
  } | null;
  organization: { name: string } | null;
};

export default function PublicPayPage() {
  const params = useParams<{ token: string }>();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch(`/api/v1/gateway/checkout/${params.token}`);
    const body = await res.json();
    if (!res.ok) {
      throw new Error(body?.error?.message ?? 'Checkout not found');
    }
    setData(body);
  }

  useEffect(() => {
    if (!params.token) return;
    load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [params.token]);

  async function pay(success: boolean) {
    setBusy(true);
    setError(null);
    try {
      const path = success ? 'succeed' : 'fail';
      const res = await fetch(`/api/v1/gateway/test/webhook/${params.token}/${path}`, {
        method: 'POST',
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'Payment failed');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4">
        <p className="text-danger">{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 text-muted">
        Loading checkout…
      </main>
    );
  }

  const pending = data.checkout.status === 'PENDING';

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-12">
      <div className="font-display text-2xl font-semibold text-brand">
        {data.organization?.name ?? 'Avyro'}
      </div>
      <div className="ac-card mt-6 p-6">
        <p className="text-sm text-muted">Pay invoice</p>
        <h1 className="mt-1 font-display text-3xl font-semibold">
          {data.invoice?.invoiceNumber ?? 'Invoice'}
        </h1>
        <p className="mt-1 text-ink-soft">{data.invoice?.customer.name}</p>
        <div className="mt-6 font-display text-4xl font-semibold">
          <Money amount={data.checkout.amount} currency={data.checkout.currency} />
        </div>
        <p className="mt-2 text-xs text-muted">
          Test checkout · fee {(Number(data.checkout.feePercent) * 100).toFixed(2)}% on settlement
        </p>
        <ul className="mt-4 space-y-1 text-sm text-ink-soft">
          {data.invoice?.items.map((item, i) => (
            <li key={i}>
              {item.description} — {item.lineTotal}
            </li>
          ))}
        </ul>

        {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

        {pending ? (
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              className="ac-btn-primary"
              disabled={busy}
              onClick={() => pay(true)}
            >
              {busy ? 'Processing…' : 'Pay with Test checkout'}
            </button>
            <button
              type="button"
              className="ac-btn-secondary"
              disabled={busy}
              onClick={() => pay(false)}
            >
              Simulate failure
            </button>
          </div>
        ) : (
          <p className="mt-6 text-sm font-semibold text-success">
            Status: {data.checkout.status.replaceAll('_', ' ')}
          </p>
        )}
      </div>
    </main>
  );
}
