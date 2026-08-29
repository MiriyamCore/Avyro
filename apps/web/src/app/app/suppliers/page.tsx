'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { EmptyState, PageHeader, StatusBadge } from '@/components/ui';
import { PurchasesSectionNav } from '@/components/section-nav';

type Supplier = {
  id: string;
  supplierNumber: string;
  name: string;
  contactPerson?: string | null;
  countryCode: string;
  defaultCurrency: string;
  defaultPaymentTermsDays?: number;
  email?: string | null;
  phone?: string | null;
  status: string;
};

const EMPTY_FORM = {
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
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  async function load() {
    setSuppliers(await api<Supplier[]>('/api/v1/suppliers'));
  }

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : 'Unable to load suppliers'),
    );
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api('/api/v1/suppliers', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          contactPerson: form.contactPerson || undefined,
          billingAddress: form.billingAddress || undefined,
          shippingAddress: form.shippingAddress || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          taxIdentifier: form.taxIdentifier || undefined,
          vatIdentifier: form.vatIdentifier || undefined,
          bankName: form.bankName || undefined,
          bankAccountNumber: form.bankAccountNumber || undefined,
          bankBranch: form.bankBranch || undefined,
          notes: form.notes || undefined,
        }),
      });
      setShowForm(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ac-page">
      <PageHeader
        title="Suppliers"
        description="Vendors you pay — contact, TIN/BIN, bank details, and payment terms."
        actions={
          <button type="button" className="ac-btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : 'Add supplier'}
          </button>
        }
      />
      <PurchasesSectionNav />
      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}
      {showForm ? (
        <form onSubmit={onSubmit} className="ac-card mb-6 space-y-6 p-5">
          <div className="ac-form-section">
            <div className="ac-form-section-title">Identity</div>
            <div className="grid gap-4 sm:grid-cols-2">
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
                <span className="ac-label">Phone</span>
                <input
                  className="ac-input"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </label>
              <label className="sm:col-span-2">
                <span className="ac-label">Email</span>
                <input
                  className="ac-input"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>
            </div>
          </div>
          <div className="ac-form-section">
            <div className="ac-form-section-title">Addresses & tax</div>
            <div className="grid gap-4 sm:grid-cols-2">
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
            </div>
          </div>
          <div className="ac-form-section">
            <div className="ac-form-section-title">Bank & terms</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="ac-label">Bank name</span>
                <input
                  className="ac-input"
                  value={form.bankName}
                  onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                />
              </label>
              <label>
                <span className="ac-label">Branch</span>
                <input
                  className="ac-input"
                  value={form.bankBranch}
                  onChange={(e) => setForm({ ...form, bankBranch: e.target.value })}
                />
              </label>
              <label className="sm:col-span-2">
                <span className="ac-label">Account number</span>
                <input
                  className="ac-input"
                  value={form.bankAccountNumber}
                  onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })}
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
                <span className="ac-label">Currency</span>
                <input
                  className="ac-input"
                  value={form.defaultCurrency}
                  onChange={(e) =>
                    setForm({ ...form, defaultCurrency: e.target.value.toUpperCase() })
                  }
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
            </div>
          </div>
          <button type="submit" className="ac-btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save supplier'}
          </button>
        </form>
      ) : null}
      {suppliers.length === 0 ? (
        <EmptyState
          title="No suppliers yet"
          description="Add Cloudflare, domain registrars, freelancers, and other vendors."
          action={
            <button type="button" className="ac-btn-primary" onClick={() => setShowForm(true)}>
              Add supplier
            </button>
          }
        />
      ) : (
        <div className="ac-table-wrap">
          <table className="ac-table ac-table-zebra">
            <thead>
              <tr>
                <th>Number</th>
                <th>Name</th>
                <th>Contact</th>
                <th>Terms</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td className="font-mono text-xs">{s.supplierNumber}</td>
                  <td className="font-medium">
                    <Link href={`/app/suppliers/${s.id}`} className="text-brand hover:underline">
                      {s.name}
                    </Link>
                  </td>
                  <td className="text-sm">{s.contactPerson ?? s.phone ?? '—'}</td>
                  <td className="text-sm">
                    {s.defaultPaymentTermsDays ?? 30} days · {s.defaultCurrency}
                  </td>
                  <td>
                    <StatusBadge status={s.status} />
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
