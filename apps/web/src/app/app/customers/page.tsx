'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { EmptyState, PageHeader, PageToolbar, SearchField, StatusBadge } from '@/components/ui';
import { SalesSectionNav } from '@/components/section-nav';

type Customer = {
  id: string;
  customerNumber: string;
  name: string;
  contactPerson?: string | null;
  countryCode: string;
  defaultCurrency: string;
  defaultPaymentTermsDays?: number;
  isRelatedParty: boolean;
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
  creditLimit: '',
  email: '',
  phone: '',
  taxIdentifier: '',
  vatIdentifier: '',
  notes: '',
  isRelatedParty: false,
};

function CustomersClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showForm, setShowForm] = useState(searchParams.get('new') === '1');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [query, setQuery] = useState('');
  const [relatedOnly, setRelatedOnly] = useState(false);

  async function load() {
    const rows = await api<Customer[]>('/api/v1/customers');
    setCustomers(rows);
  }

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : 'Unable to load customers'),
    );
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api('/api/v1/customers', {
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
          creditLimit: form.creditLimit || undefined,
          notes: form.notes || undefined,
        }),
      });
      setShowForm(false);
      setForm(EMPTY_FORM);
      await load();
      router.replace('/app/customers');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save customer');
    } finally {
      setSaving(false);
    }
  }

  const filtered = customers.filter((c) => {
    if (relatedOnly && !c.isRelatedParty) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.customerNumber.toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (c.contactPerson ?? '').toLowerCase().includes(q) ||
      c.countryCode.toLowerCase().includes(q)
    );
  });

  return (
    <div className="ac-page">
      <PageHeader
        title="Customers"
        description="Companies and people you invoice — with BD billing, TIN/BIN, and payment terms."
        actions={
          <button type="button" className="ac-btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : 'Add customer'}
          </button>
        }
      />
      <SalesSectionNav />

      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      {customers.length > 0 ? (
        <PageToolbar>
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Search name, number, contact, email…"
          />
          <label className="flex shrink-0 items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              className="rounded border-line text-brand focus:ring-brand/20"
              checked={relatedOnly}
              onChange={(e) => setRelatedOnly(e.target.checked)}
            />
            Related parties only
          </label>
        </PageToolbar>
      ) : null}

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
                  placeholder="Inoryum Ltd"
                />
              </label>
              <label>
                <span className="ac-label">Contact person</span>
                <input
                  className="ac-input"
                  value={form.contactPerson}
                  onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                  placeholder="Accounts payable contact"
                />
              </label>
              <label>
                <span className="ac-label">Phone</span>
                <input
                  className="ac-input"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+880 1XXX XXXXXX"
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
            <div className="ac-form-section-title">Addresses</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="ac-label">Billing address</span>
                <textarea
                  className="ac-input min-h-[72px]"
                  value={form.billingAddress}
                  onChange={(e) => setForm({ ...form, billingAddress: e.target.value })}
                  placeholder="House / road, area, district"
                />
              </label>
              <label className="sm:col-span-2">
                <span className="ac-label">Shipping address</span>
                <textarea
                  className="ac-input min-h-[72px]"
                  value={form.shippingAddress}
                  onChange={(e) => setForm({ ...form, shippingAddress: e.target.value })}
                  placeholder="Leave blank if same as billing"
                />
              </label>
            </div>
          </div>

          <div className="ac-form-section">
            <div className="ac-form-section-title">Tax & terms</div>
            <div className="grid gap-4 sm:grid-cols-2">
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
                <span className="ac-label">Country</span>
                <input
                  className="ac-input"
                  value={form.countryCode}
                  onChange={(e) => setForm({ ...form, countryCode: e.target.value.toUpperCase() })}
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
                <span className="ac-label">Credit limit (BDT)</span>
                <input
                  className="ac-input"
                  inputMode="decimal"
                  value={form.creditLimit}
                  onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
                  placeholder="Optional"
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
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.isRelatedParty}
                  onChange={(e) => setForm({ ...form, isRelatedParty: e.target.checked })}
                />
                Related party
              </label>
            </div>
          </div>

          <button type="submit" className="ac-btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save customer'}
          </button>
        </form>
      ) : null}

      {customers.length === 0 ? (
        <EmptyState
          title="No customers yet"
          description="Add the companies or people you invoice."
          action={
            <button type="button" className="ac-btn-primary" onClick={() => setShowForm(true)}>
              Add first customer
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
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td className="font-mono text-xs">{c.customerNumber}</td>
                  <td className="font-medium">
                    <Link href={`/app/customers/${c.id}`} className="hover:text-brand">
                      {c.name}
                    </Link>
                    <div className="text-xs text-muted">{c.email ?? c.phone ?? '—'}</div>
                  </td>
                  <td className="text-sm">{c.contactPerson ?? '—'}</td>
                  <td className="text-sm">
                    {c.defaultPaymentTermsDays ?? 30} days · {c.defaultCurrency}
                  </td>
                  <td>{c.isRelatedParty ? <StatusBadge status="RELATED" /> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 ? (
            <p className="p-6 text-sm text-muted">No customers match this search.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function CustomersPage() {
  return (
    <Suspense fallback={<div className="ac-page">Loading…</div>}>
      <CustomersClient />
    </Suspense>
  );
}
