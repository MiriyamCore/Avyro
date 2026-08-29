'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Money, PageHeader, StatusBadge } from '@/components/ui';

type Customer360 = {
  id: string;
  customerNumber: string;
  name: string;
  legalName?: string | null;
  type: string;
  contactPerson?: string | null;
  countryCode: string;
  address?: string | null;
  billingAddress?: string | null;
  shippingAddress?: string | null;
  defaultCurrency: string;
  defaultPaymentTermsDays: number;
  creditLimit?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  taxIdentifier?: string | null;
  vatIdentifier?: string | null;
  notes?: string | null;
  isRelatedParty: boolean;
  openReceivable: string;
  invoices: Array<{
    id: string;
    invoiceNumber: string | null;
    status: string;
    grandTotal: string;
    amountDue: string;
    currency: string;
  }>;
  payments: Array<{
    id: string;
    paymentNumber: string;
    amount: string;
    currency: string;
    paymentDate: string;
  }>;
  quotes: Array<{ id: string; quoteNumber: string | null; status: string; grandTotal: string; currency: string }>;
  contracts: Array<{ id: string; contractNumber: string; title: string; status: string }>;
  projects: Array<{ id: string; projectCode: string; name: string; status: string }>;
};

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Customer360 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    legalName: '',
    contactPerson: '',
    countryCode: 'BD',
    address: '',
    billingAddress: '',
    shippingAddress: '',
    defaultCurrency: 'BDT',
    defaultPaymentTermsDays: 30,
    creditLimit: '',
    email: '',
    phone: '',
    website: '',
    taxIdentifier: '',
    vatIdentifier: '',
    notes: '',
    isRelatedParty: false,
  });

  async function load() {
    const row = await api<Customer360>(`/api/v1/customers/${params.id}`);
    setData(row);
    setForm({
      name: row.name,
      legalName: row.legalName ?? '',
      contactPerson: row.contactPerson ?? '',
      countryCode: row.countryCode,
      address: row.address ?? '',
      billingAddress: row.billingAddress ?? row.address ?? '',
      shippingAddress: row.shippingAddress ?? '',
      defaultCurrency: row.defaultCurrency,
      defaultPaymentTermsDays: row.defaultPaymentTermsDays,
      creditLimit: row.creditLimit ?? '',
      email: row.email ?? '',
      phone: row.phone ?? '',
      website: row.website ?? '',
      taxIdentifier: row.taxIdentifier ?? '',
      vatIdentifier: row.vatIdentifier ?? '',
      notes: row.notes ?? '',
      isRelatedParty: row.isRelatedParty,
    });
  }

  useEffect(() => {
    if (!params.id) return;
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : 'Unable to load customer'),
    );
  }, [params.id]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/api/v1/customers/${params.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...form,
          legalName: form.legalName || null,
          contactPerson: form.contactPerson || null,
          address: form.billingAddress || form.address || null,
          billingAddress: form.billingAddress || null,
          shippingAddress: form.shippingAddress || null,
          creditLimit: form.creditLimit || null,
          email: form.email || null,
          phone: form.phone || null,
          website: form.website || null,
          taxIdentifier: form.taxIdentifier || null,
          vatIdentifier: form.vatIdentifier || null,
          notes: form.notes || null,
        }),
      });
      await load();
      setEditing(false);
      setMessage('Customer updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save customer');
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <div className="ac-page">
        <p className="text-danger">{error}</p>
        <Link href="/app/customers" className="ac-btn-secondary mt-4">
          Back
        </Link>
      </div>
    );
  }

  if (!data) {
    return <div className="ac-page text-muted">Loading customer…</div>;
  }

  return (
    <div className="ac-page">
      <PageHeader
        title={data.name}
        description={`${data.customerNumber} · ${data.countryCode} · ${data.defaultCurrency}`}
        actions={
          <>
            {data.isRelatedParty ? <StatusBadge status="RELATED" /> : null}
            <Link href="/app/customers" className="ac-btn-secondary">
              Back
            </Link>
            <button type="button" className="ac-btn-secondary" onClick={() => setEditing((v) => !v)}>
              {editing ? 'Cancel' : 'Edit'}
            </button>
            <Link href="/app/invoices?new=1" className="ac-btn-primary">
              New invoice
            </Link>
          </>
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
            <span className="ac-label">Legal name</span>
            <input
              className="ac-input"
              value={form.legalName}
              onChange={(e) => setForm({ ...form, legalName: e.target.value })}
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
            <span className="ac-label">Currency</span>
            <input
              className="ac-input"
              value={form.defaultCurrency}
              onChange={(e) => setForm({ ...form, defaultCurrency: e.target.value.toUpperCase() })}
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
          <button type="submit" className="ac-btn-primary sm:col-span-2" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="ac-card p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            Open receivable
          </div>
          <div className="mt-2 font-display text-2xl font-semibold">
            <Money amount={data.openReceivable} currency={data.defaultCurrency} />
          </div>
        </div>
        <div className="ac-card p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Contact</div>
          <div className="mt-2 text-sm">
            {data.contactPerson ?? '—'}
            {data.phone ? <div className="text-muted">{data.phone}</div> : null}
          </div>
        </div>
        <div className="ac-card p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Activity</div>
          <div className="mt-2 text-sm text-ink-soft">
            {data.invoices.length} invoices · {data.contracts.length} contracts ·{' '}
            {data.projects.length} projects
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Invoices">
          {data.invoices.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between gap-3 border-b border-line py-3 text-sm">
              <div>
                <div className="font-medium">
                  <Link href={`/app/invoices/${inv.id}`} className="text-brand hover:underline">
                    {inv.invoiceNumber ?? 'Draft'}
                  </Link>
                </div>
                <StatusBadge status={inv.status} />
              </div>
              <div className="text-right">
                <Money amount={inv.grandTotal} currency={inv.currency} />
                <div className="text-xs text-muted">
                  due <Money amount={inv.amountDue} currency={inv.currency} />
                </div>
                <a
                  className="text-xs font-medium text-brand"
                  href={`/api/v1/invoices/${inv.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                >
                  PDF
                </a>
              </div>
            </div>
          ))}
          {data.invoices.length === 0 ? <Empty>No invoices</Empty> : null}
        </Section>
        <Section title="Payments">
          {data.payments.map((p) => (
            <div key={p.id} className="flex justify-between border-b border-line py-3 text-sm">
              <div>
                <div className="font-medium">{p.paymentNumber}</div>
                <div className="text-xs text-muted">{p.paymentDate.slice(0, 10)}</div>
              </div>
              <Money amount={p.amount} currency={p.currency} />
            </div>
          ))}
          {data.payments.length === 0 ? <Empty>No payments</Empty> : null}
        </Section>
        <Section title="Contracts">
          {data.contracts.map((c) => (
            <div key={c.id} className="flex justify-between border-b border-line py-3 text-sm">
              <div className="font-medium">
                {c.contractNumber} — {c.title}
              </div>
              <StatusBadge status={c.status} />
            </div>
          ))}
          {data.contracts.length === 0 ? <Empty>No contracts</Empty> : null}
        </Section>
        <Section title="Projects">
          {data.projects.map((p) => (
            <div key={p.id} className="flex justify-between border-b border-line py-3 text-sm">
              <div className="font-medium">
                {p.projectCode} — {p.name}
              </div>
              <StatusBadge status={p.status} />
            </div>
          ))}
          {data.projects.length === 0 ? <Empty>No projects</Empty> : null}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="ac-card p-5">
      <h2 className="mb-2 font-display text-lg font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-sm text-muted">{children}</p>;
}
