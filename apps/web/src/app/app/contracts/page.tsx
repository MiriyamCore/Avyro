'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { EmptyState, Money, PageHeader, StatusBadge } from '@/components/ui';

type Customer = { id: string; name: string; defaultCurrency: string; isRelatedParty: boolean };
type Contract = {
  id: string;
  contractNumber: string;
  title: string;
  billingType: string;
  currency: string;
  contractValue: string | null;
  status: string;
  effectiveDate: string;
  customer: { name: string };
};

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customerId: '',
    title: '',
    effectiveDate: new Date().toISOString().slice(0, 10),
    expiryDate: '',
    billingType: 'RETAINER',
    currency: 'BDT',
    contractValue: '',
    serviceType: 'Software development',
  });

  async function load() {
    const [rows, cust] = await Promise.all([
      api<Contract[]>('/api/v1/contracts'),
      api<Customer[]>('/api/v1/customers'),
    ]);
    setContracts(rows);
    setCustomers(cust);
    if (!form.customerId && cust[0]) {
      const first = cust[0];
      setForm((f) => ({
        ...f,
        customerId: first.id,
        currency: first.defaultCurrency,
      }));
    }
  }

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : 'Unable to load contracts'),
    );
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api('/api/v1/contracts', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          expiryDate: form.expiryDate || undefined,
          contractValue: form.contractValue || undefined,
        }),
      });
      setShowForm(false);
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
        title="Contracts"
        description="Structured commercial agreements with customers."
        actions={
          <button type="button" className="ac-btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : 'New contract'}
          </button>
        }
      />
      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}
      {showForm ? (
        <form onSubmit={onSubmit} className="ac-card mb-6 grid gap-4 p-5 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="ac-label">Customer</span>
            <select
              className="ac-input"
              required
              value={form.customerId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value })}
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="sm:col-span-2">
            <span className="ac-label">Title</span>
            <input
              className="ac-input"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label>
            <span className="ac-label">Effective</span>
            <input
              className="ac-input"
              type="date"
              required
              value={form.effectiveDate}
              onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })}
            />
          </label>
          <label>
            <span className="ac-label">Expiry</span>
            <input
              className="ac-input"
              type="date"
              value={form.expiryDate}
              onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
            />
          </label>
          <label>
            <span className="ac-label">Billing type</span>
            <select
              className="ac-input"
              value={form.billingType}
              onChange={(e) => setForm({ ...form, billingType: e.target.value })}
            >
              {['FIXED', 'MILESTONE', 'MONTHLY', 'RETAINER', 'HOURLY', 'OTHER'].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="ac-label">Value</span>
            <input
              className="ac-input"
              value={form.contractValue}
              onChange={(e) => setForm({ ...form, contractValue: e.target.value })}
            />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="ac-btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save contract'}
            </button>
          </div>
        </form>
      ) : null}
      {contracts.length === 0 ? (
        <EmptyState
          title="No contracts yet"
          description="Capture retainers and project agreements before invoicing."
          action={
            <button type="button" className="ac-btn-primary" onClick={() => setShowForm(true)}>
              New contract
            </button>
          }
        />
      ) : (
        <div className="ac-card overflow-x-auto">
          <table className="ac-table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Title</th>
                <th>Customer</th>
                <th>Billing</th>
                <th>Status</th>
                <th className="text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id}>
                  <td className="font-mono text-xs">{c.contractNumber}</td>
                  <td className="font-medium">{c.title}</td>
                  <td>{c.customer.name}</td>
                  <td>{c.billingType}</td>
                  <td>
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="text-right">
                    {c.contractValue ? (
                      <Money amount={c.contractValue} currency={c.currency} />
                    ) : (
                      '—'
                    )}
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
