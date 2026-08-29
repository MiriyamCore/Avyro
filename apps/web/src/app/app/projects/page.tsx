'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { EmptyState, Money, PageHeader, StatusBadge } from '@/components/ui';

type Customer = { id: string; name: string; defaultCurrency: string };
type Contract = { id: string; title: string; contractNumber: string };
type Project = {
  id: string;
  projectCode: string;
  name: string;
  status: string;
  currency: string;
  budgetAmount: string | null;
  customer: { name: string };
  contract?: { title: string } | null;
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customerId: '',
    contractId: '',
    name: '',
    startDate: new Date().toISOString().slice(0, 10),
    budgetAmount: '',
    currency: 'BDT',
  });

  async function load() {
    const [rows, cust, ctr] = await Promise.all([
      api<Project[]>('/api/v1/projects'),
      api<Customer[]>('/api/v1/customers'),
      api<Contract[]>('/api/v1/contracts'),
    ]);
    setProjects(rows);
    setCustomers(cust);
    setContracts(ctr);
    if (!form.customerId && cust[0]) {
      const first = cust[0];
      setForm((f) => ({ ...f, customerId: first.id, currency: first.defaultCurrency }));
    }
  }

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : 'Unable to load projects'),
    );
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api('/api/v1/projects', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          contractId: form.contractId || undefined,
          budgetAmount: form.budgetAmount || undefined,
          status: 'ACTIVE',
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
        title="Projects"
        description="Lightweight delivery containers linked to customers and contracts."
        actions={
          <button type="button" className="ac-btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : 'New project'}
          </button>
        }
      />
      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}
      {showForm ? (
        <form onSubmit={onSubmit} className="ac-card mb-6 grid gap-4 p-5 sm:grid-cols-2">
          <label>
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
          <label>
            <span className="ac-label">Contract (optional)</span>
            <select
              className="ac-input"
              value={form.contractId}
              onChange={(e) => setForm({ ...form, contractId: e.target.value })}
            >
              <option value="">None</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.contractNumber} — {c.title}
                </option>
              ))}
            </select>
          </label>
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
            <span className="ac-label">Start date</span>
            <input
              className="ac-input"
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </label>
          <label>
            <span className="ac-label">Budget</span>
            <input
              className="ac-input"
              value={form.budgetAmount}
              onChange={(e) => setForm({ ...form, budgetAmount: e.target.value })}
            />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="ac-btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save project'}
            </button>
          </div>
        </form>
      ) : null}
      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create a project to group invoices and work for a customer."
          action={
            <button type="button" className="ac-btn-primary" onClick={() => setShowForm(true)}>
              New project
            </button>
          }
        />
      ) : (
        <div className="ac-card overflow-x-auto">
          <table className="ac-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Customer</th>
                <th>Status</th>
                <th className="text-right">Budget</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono text-xs">{p.projectCode}</td>
                  <td className="font-medium">{p.name}</td>
                  <td>{p.customer.name}</td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="text-right">
                    {p.budgetAmount ? (
                      <Money amount={p.budgetAmount} currency={p.currency} />
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
