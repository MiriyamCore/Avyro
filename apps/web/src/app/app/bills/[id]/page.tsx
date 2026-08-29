'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Money, PageHeader, StatusBadge } from '@/components/ui';

type BillDetail = {
  id: string;
  billNumber: string | null;
  status: string;
  billDate: string;
  dueDate: string;
  currency: string;
  subtotal: string;
  taxTotal: string;
  grandTotal: string;
  amountDue: string;
  reverseCharge: boolean;
  notes?: string | null;
  supplier: { id: string; name: string };
  items: Array<{
    id: string;
    description: string;
    quantity: string;
    unitPrice: string;
    lineTotal: string;
    itcStatus: string;
    itcApportionedPercent?: string | null;
  }>;
  payments: Array<{ id: string; paymentNumber: string; amount: string; paymentDate: string }>;
};

export default function BillDetailPage() {
  const params = useParams<{ id: string }>();
  const [bill, setBill] = useState<BillDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');

  async function load() {
    const row = await api<BillDetail>(`/api/v1/bills/${params.id}`);
    setBill(row);
    setPayAmount(row.amountDue);
  }

  useEffect(() => {
    if (!params.id) return;
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : 'Unable to load bill'),
    );
  }, [params.id]);

  async function openBill() {
    if (!bill) return;
    try {
      await api(`/api/v1/bills/${bill.id}/open`, { method: 'POST' });
      await load();
      setMessage('Bill opened and posted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open bill');
    }
  }

  async function payBill() {
    if (!bill) return;
    try {
      await api('/api/v1/bill-payments', {
        method: 'POST',
        body: JSON.stringify({
          billId: bill.id,
          paymentDate: new Date().toISOString().slice(0, 10),
          amount: payAmount,
        }),
      });
      await load();
      setMessage('Payment recorded');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not pay bill');
    }
  }

  if (!bill) {
    return <div className="ac-page text-muted">{error ?? 'Loading bill…'}</div>;
  }

  return (
    <div className="ac-page">
      <PageHeader
        title={bill.billNumber ?? 'Draft bill'}
        description={`${bill.supplier.name} · ${bill.billDate.slice(0, 10)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={bill.status} />
            <Link href="/app/bills" className="ac-btn-secondary">
              Back
            </Link>
            {bill.status === 'DRAFT' ? (
              <button type="button" className="ac-btn-primary" onClick={openBill}>
                Open bill
              </button>
            ) : null}
          </div>
        }
      />
      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}
      {message ? <p className="mb-4 text-sm text-success">{message}</p> : null}

      {bill.reverseCharge ? (
        <p className="ac-card mb-4 p-3 text-sm text-warning">
          Reverse-charge VAT applies to this imported service bill.
        </p>
      ) : null}

      <div className="ac-card mb-6 overflow-x-auto p-5">
        <table className="ac-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit</th>
              <th>Line</th>
              <th>ITC</th>
            </tr>
          </thead>
          <tbody>
            {bill.items.map((item) => (
              <tr key={item.id}>
                <td>{item.description}</td>
                <td>{item.quantity}</td>
                <td>
                  <Money amount={item.unitPrice} currency={bill.currency} />
                </td>
                <td>
                  <Money amount={item.lineTotal} currency={bill.currency} />
                </td>
                <td className="text-xs">
                  {item.itcStatus}
                  {item.itcApportionedPercent ? ` (${item.itcApportionedPercent}%)` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 flex justify-end gap-6 text-sm">
          <span>
            Tax: <Money amount={bill.taxTotal} currency={bill.currency} />
          </span>
          <span className="font-semibold">
            Total: <Money amount={bill.grandTotal} currency={bill.currency} />
          </span>
          <span>
            Due: <Money amount={bill.amountDue} currency={bill.currency} />
          </span>
        </div>
      </div>

      {['OPEN', 'PARTIALLY_PAID'].includes(bill.status) && Number(bill.amountDue) > 0 ? (
        <div className="ac-card mb-6 grid gap-3 p-5 sm:grid-cols-[1fr_auto]">
          <input
            className="ac-input"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            placeholder="Payment amount"
          />
          <button type="button" className="ac-btn-primary" onClick={payBill}>
            Record payment
          </button>
        </div>
      ) : null}

      {bill.payments.length > 0 ? (
        <div className="ac-card divide-y divide-line p-5">
          <h2 className="font-display text-lg font-semibold">Payments</h2>
          {bill.payments.map((p) => (
            <div key={p.id} className="flex justify-between py-2 text-sm">
              <span>
                {p.paymentNumber} · {p.paymentDate.slice(0, 10)}
              </span>
              <Money amount={p.amount} currency={bill.currency} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
