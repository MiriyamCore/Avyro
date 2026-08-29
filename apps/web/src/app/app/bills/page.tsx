'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { EmptyState, Money, PageHeader, StatusBadge } from '@/components/ui';
import { PurchasesSectionNav } from '@/components/section-nav';
import { api, ApiError, uploadReceipt } from '@/lib/api';

type Supplier = { id: string; name: string; defaultCurrency: string };
type Bill = {
  id: string;
  billNumber: string | null;
  status: string;
  billDate: string;
  dueDate: string;
  currency: string;
  grandTotal: string;
  amountDue: string;
  supplier: { name: string };
};

type ItemDraft = {
  description: string;
  quantity: string;
  unitPrice: string;
  itcStatus: string;
};

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
  );
  const [currency, setCurrency] = useState('BDT');
  const [taxCodeId, setTaxCodeId] = useState('');
  const [taxCodes, setTaxCodes] = useState<
    Array<{ id: string; code: string; kind: string; ratePercent: string | null }>
  >([]);
  const [reverseCharge, setReverseCharge] = useState(false);
  const [items, setItems] = useState<ItemDraft[]>([
    { description: '', quantity: '1', unitPrice: '', itcStatus: 'CLAIMABLE' },
  ]);
  const [payBillId, setPayBillId] = useState('');
  const [payAmount, setPayAmount] = useState('');

  const openBills = useMemo(
    () =>
      bills.filter(
        (b) => ['OPEN', 'PARTIALLY_PAID'].includes(b.status) && Number(b.amountDue) > 0,
      ),
    [bills],
  );

  async function load() {
    const [rows, sup, taxes] = await Promise.all([
      api<Bill[]>('/api/v1/bills'),
      api<Supplier[]>('/api/v1/suppliers'),
      api<typeof taxCodes>('/api/v1/compliance/tax-codes').catch(() => []),
    ]);
    setBills(rows);
    setSuppliers(sup);
    setTaxCodes(taxes);
    if (!supplierId && sup[0]) {
      setSupplierId(sup[0].id);
      setCurrency(sup[0].defaultCurrency);
    }
  }

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : 'Unable to load bills'),
    );
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const bill = await api<{ id: string }>('/api/v1/bills', {
        method: 'POST',
        body: JSON.stringify({
          supplierId,
          billDate,
          dueDate,
          currency,
          taxCodeId: taxCodeId || undefined,
          reverseCharge,
          items: items.filter((i) => i.description && i.unitPrice),
        }),
      });
      await api(`/api/v1/bills/${bill.id}/open`, { method: 'POST' });
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create bill');
    } finally {
      setSaving(false);
    }
  }

  async function payBill(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await api('/api/v1/bill-payments', {
        method: 'POST',
        body: JSON.stringify({
          billId: payBillId,
          paymentDate: new Date().toISOString().slice(0, 10),
          amount: payAmount,
        }),
      });
      setPayAmount('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not pay bill');
    }
  }

  return (
    <div className="ac-page">
      <PageHeader
        title="Bills"
        description="Supplier invoices — opening a bill posts expense and accounts payable."
        actions={
          <button type="button" className="ac-btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : 'New bill'}
          </button>
        }
      />
      <PurchasesSectionNav />
      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      {showForm ? (
        <form onSubmit={onSubmit} className="ac-card mb-6 grid gap-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="ac-label">Supplier</span>
              <select
                className="ac-input"
                required
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
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
              <span className="ac-label">Bill date</span>
              <input
                className="ac-input"
                type="date"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
              />
            </label>
            <label>
              <span className="ac-label">Due date</span>
              <input
                className="ac-input"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </label>
          </div>
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
                  {t.ratePercent != null
                    ? ` (${t.ratePercent}%)`
                    : ' (set rate in Compliance)'}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="ac-btn-primary" disabled={saving || !suppliers.length}>
            {saving ? 'Saving…' : 'Create & open'}
          </button>
        </form>
      ) : null}

      <form onSubmit={payBill} className="ac-card mb-6 grid gap-4 p-5 sm:grid-cols-3">
        <label className="sm:col-span-2">
          <span className="ac-label">Pay open bill</span>
          <select
            className="ac-input"
            required
            value={payBillId}
            onChange={(e) => {
              setPayBillId(e.target.value);
              const b = openBills.find((x) => x.id === e.target.value);
              if (b) setPayAmount(String(Number(b.amountDue)));
            }}
          >
            <option value="">Select…</option>
            {openBills.map((b) => (
              <option key={b.id} value={b.id}>
                {b.billNumber} — {b.supplier.name} (due {b.amountDue} {b.currency})
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="ac-label">Amount</span>
          <input
            className="ac-input"
            required
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
          />
        </label>
        <button type="submit" className="ac-btn-secondary" disabled={!openBills.length}>
          Record bill payment
        </button>
      </form>

      {bills.length === 0 ? (
        <EmptyState
          title="No bills yet"
          description="Record a supplier bill to track payables."
          action={
            <button type="button" className="ac-btn-primary" onClick={() => setShowForm(true)}>
              New bill
            </button>
          }
        />
      ) : (
        <div className="ac-table-wrap">
          <table className="ac-table ac-table-zebra">
            <thead>
              <tr>
                <th>Bill</th>
                <th>Supplier</th>
                <th>Due</th>
                <th>Status</th>
                <th className="text-right">Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {bills.map((b) => (
                <tr key={b.id}>
                  <td className="font-mono text-xs">
                    <Link href={`/app/bills/${b.id}`} className="text-brand">
                      {b.billNumber ?? 'Draft'}
                    </Link>
                  </td>
                  <td className="font-medium">{b.supplier.name}</td>
                  <td>{b.dueDate.slice(0, 10)}</td>
                  <td>
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="text-right">
                    <Money amount={b.grandTotal} currency={b.currency} />
                  </td>
                  <td className="text-right">
                    <label className="ac-btn-ghost inline-flex cursor-pointer items-center text-xs">
                      Attach receipt
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,.pdf"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (!file) return;
                          try {
                            await uploadReceipt(file, {
                              entityType: 'Bill',
                              entityId: b.id,
                            });
                            setError(null);
                          } catch (err) {
                            setError(
                              err instanceof Error
                                ? err.message
                                : 'Could not attach receipt',
                            );
                          }
                        }}
                      />
                    </label>
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
