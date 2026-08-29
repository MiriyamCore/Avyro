'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Money, PageHeader, StatusBadge } from '@/components/ui';

type SupplierDetail = {
  id: string;
  supplierNumber: string;
  name: string;
  contactPerson?: string | null;
  countryCode: string;
  address?: string | null;
  billingAddress?: string | null;
  shippingAddress?: string | null;
  defaultCurrency: string;
  defaultPaymentTermsDays?: number;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankBranch?: string | null;
  email?: string | null;
  phone?: string | null;
  taxIdentifier?: string | null;
  vatIdentifier?: string | null;
  notes?: string | null;
  openPayable: string;
  bills: Array<{
    id: string;
    billNumber: string | null;
    status: string;
    grandTotal: string;
    amountDue: string;
    currency: string;
  }>;
};

export default function SupplierDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<SupplierDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    contactPerson: '',
    countryCode: 'BD',
    billingAddress: '',
    shippingAddress: '',
    defaultCurrency: 'BDT',
    defaultPaymentTermsDays: 30,
    email: '',
    phone: '',
    taxIdentifier: '',
    vatIdentifier: '',
    bankName: '',
    bankAccountNumber: '',
    bankBranch: '',
    notes: '',
  });

  async function load() {
    const row = await api<SupplierDetail>(`/api/v1/suppliers/${params.id}`);
    setData(row);
    setForm({
      name: row.name,
      contactPerson: row.contactPerson ?? '',
      countryCode: row.countryCode,
      billingAddress: row.billingAddress ?? row.address ?? '',
      shippingAddress: row.shippingAddress ?? '',
      defaultCurrency: row.defaultCurrency,
      defaultPaymentTermsDays: row.defaultPaymentTermsDays ?? 30,
      email: row.email ?? '',
      phone: row.phone ?? '',
      taxIdentifier: row.taxIdentifier ?? '',
      vatIdentifier: row.vatIdentifier ?? '',
      bankName: row.bankName ?? '',
      bankAccountNumber: row.bankAccountNumber ?? '',
      bankBranch: row.bankBranch ?? '',
      notes: row.notes ?? '',
    });
  }

  useEffect(() => {
    if (!params.id) return;
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : 'Unable to load supplier'),
    );
  }, [params.id]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/api/v1/suppliers/${params.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...form,
          contactPerson: form.contactPerson || null,
          billingAddress: form.billingAddress || null,
          shippingAddress: form.shippingAddress || null,
          email: form.email || null,
          phone: form.phone || null,
          taxIdentifier: form.taxIdentifier || null,
          vatIdentifier: form.vatIdentifier || null,
          bankName: form.bankName || null,
          bankAccountNumber: form.bankAccountNumber || null,
          bankBranch: form.bankBranch || null,
          notes: form.notes || null,
        }),
      });
      await load();
      setEditing(false);
      setMessage('Supplier updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save supplier');
    } finally {
      setSaving(false);
    }
  }

  if (error && !data) {
    return (
      <div className="ac-page">
        <p className="text-danger">{error}</p>
        <Link href="/app/suppliers" className="ac-btn-secondary mt-4">
          Back
        </Link>
      </div>
    );
  }

  if (!data) {
    return <div className="ac-page text-muted">Loading supplier…</div>;
  }

  return (
    <div className="ac-page">
      <PageHeader
        title={data.name}
        description={`${data.supplierNumber} · ${data.countryCode} · ${data.defaultCurrency}`}
        actions={
          <div className="flex gap-2">
            <Link href="/app/suppliers" className="ac-btn-secondary">
              Back
            </Link>
            <button type="button" className="ac-btn-primary" onClick={() => setEditing((v) => !v)}>
              {editing ? 'Cancel' : 'Edit'}
            </button>
          </div>
        }
      />

      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}
      {message ? <p className="mb-4 text-sm text-success">{message}</p> : null}

      {editing ? (
        <form onSubmit={onSave} className="ac-card mb-6 grid gap-4 p-5 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="ac-label">Name</span>
            <input
              className="ac-input"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            <span className="ac-label">Contact person</span>
            <input
              className="ac-input"
              value={form.contactPerson}
              onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
            />
          </label>
          <label>
            <span className="ac-label">Country</span>
            <input
              className="ac-input"
              value={form.countryCode}
              onChange={(e) => setForm({ ...form, countryCode: e.target.value.toUpperCase() })}
            />
          </label>
          <label className="sm:col-span-2">
            <span className="ac-label">Billing address</span>
            <textarea
              className="ac-input min-h-[72px]"
              value={form.billingAddress}
              onChange={(e) => setForm({ ...form, billingAddress: e.target.value })}
            />
          </label>
          <label className="sm:col-span-2">
            <span className="ac-label">Shipping address</span>
            <textarea
              className="ac-input min-h-[72px]"
              value={form.shippingAddress}
              onChange={(e) => setForm({ ...form, shippingAddress: e.target.value })}
            />
          </label>
          <label>
            <span className="ac-label">Currency</span>
            <input
              className="ac-input"
              value={form.defaultCurrency}
              onChange={(e) => setForm({ ...form, defaultCurrency: e.target.value.toUpperCase() })}
            />
          </label>
          <label>
            <span className="ac-label">Email</span>
            <input
              className="ac-input"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label>
            <span className="ac-label">Phone</span>
            <input
              className="ac-input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </label>
          <label>
            <span className="ac-label">TIN</span>
            <input
              className="ac-input"
              value={form.taxIdentifier}
              onChange={(e) => setForm({ ...form, taxIdentifier: e.target.value })}
            />
          </label>
          <label>
            <span className="ac-label">BIN / VAT</span>
            <input
              className="ac-input"
              value={form.vatIdentifier}
              onChange={(e) => setForm({ ...form, vatIdentifier: e.target.value })}
            />
          </label>
          <label>
            <span className="ac-label">Payment terms (days)</span>
            <input
              className="ac-input"
              type="number"
              value={form.defaultPaymentTermsDays}
              onChange={(e) =>
                setForm({ ...form, defaultPaymentTermsDays: Number(e.target.value) || 30 })
              }
            />
          </label>
          <label>
            <span className="ac-label">Bank name</span>
            <input
              className="ac-input"
              value={form.bankName}
              onChange={(e) => setForm({ ...form, bankName: e.target.value })}
            />
          </label>
          <label>
            <span className="ac-label">Bank branch</span>
            <input
              className="ac-input"
              value={form.bankBranch}
              onChange={(e) => setForm({ ...form, bankBranch: e.target.value })}
            />
          </label>
          <label className="sm:col-span-2">
            <span className="ac-label">Bank account</span>
            <input
              className="ac-input"
              value={form.bankAccountNumber}
              onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })}
            />
          </label>
          <label className="sm:col-span-2">
            <span className="ac-label">Notes</span>
            <textarea
              className="ac-input min-h-[60px]"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
          <button type="submit" className="ac-btn-primary sm:col-span-2" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="ac-card p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            Open payable
          </div>
          <div className="mt-2 font-display text-2xl font-semibold">
            <Money amount={data.openPayable} currency={data.defaultCurrency} />
          </div>
        </div>
        <div className="ac-card p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Email</div>
          <div className="mt-2 text-sm">{data.email ?? '—'}</div>
        </div>
        <div className="ac-card p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">TIN / BIN</div>
          <div className="mt-2 text-sm">
            {data.taxIdentifier ?? '—'}
            {data.vatIdentifier ? ` · ${data.vatIdentifier}` : ''}
          </div>
        </div>
      </div>

      <div className="ac-card p-5">
        <h2 className="mb-2 font-display text-lg font-semibold">Bills</h2>
        {data.bills.map((bill) => (
          <div key={bill.id} className="flex items-center justify-between gap-3 border-b border-line py-3 text-sm">
            <div>
              <div className="font-medium">{bill.billNumber ?? 'Draft'}</div>
              <StatusBadge status={bill.status} />
            </div>
            <div className="text-right">
              <Money amount={bill.grandTotal} currency={bill.currency} />
              <div className="text-xs text-muted">
                due <Money amount={bill.amountDue} currency={bill.currency} />
              </div>
            </div>
          </div>
        ))}
        {data.bills.length === 0 ? <p className="py-4 text-sm text-muted">No bills</p> : null}
      </div>
    </div>
  );
}
