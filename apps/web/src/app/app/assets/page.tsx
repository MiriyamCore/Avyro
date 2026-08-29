'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Money, PageHeader, StatusBadge } from '@/components/ui';

type Asset = {
  id: string;
  assetNumber: string;
  name: string;
  category?: string | null;
  cost: string;
  purchaseDate: string;
  status: string;
  usefulLifeMonths?: number | null;
  salvageValue?: string;
  assignedTo?: { name: string } | null;
};

type Person = { id: string; name: string };

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [form, setForm] = useState({
    name: '',
    category: 'Computers',
    cost: '',
    purchaseDate: new Date().toISOString().slice(0, 10),
    assignedToId: '',
    usefulLifeMonths: '36',
    salvageValue: '0',
  });

  async function load() {
    const [a, p] = await Promise.all([
      api<Asset[]>('/api/v1/assets'),
      api<Person[]>('/api/v1/people').catch(() => []),
    ]);
    setAssets(a);
    setPeople(p);
  }

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : 'Unable to load assets'),
    );
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await api('/api/v1/assets', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          category: form.category,
          cost: form.cost,
          purchaseDate: form.purchaseDate,
          assignedToId: form.assignedToId || undefined,
          usefulLifeMonths: Number(form.usefulLifeMonths) || 36,
          salvageValue: form.salvageValue || '0',
          depreciationMethod: 'STRAIGHT_LINE',
        }),
      });
      setForm({
        name: '',
        category: 'Computers',
        cost: '',
        purchaseDate: new Date().toISOString().slice(0, 10),
        assignedToId: '',
        usefulLifeMonths: '36',
        salvageValue: '0',
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    }
  }

  async function depreciate(assetId: string) {
    setError(null);
    setNotice(null);
    try {
      const result = await api<{ amount: string; period: string }>(
        `/api/v1/assets/${assetId}/depreciate`,
        {
          method: 'POST',
          body: JSON.stringify({ period }),
        },
      );
      setNotice(`Posted ৳${result.amount} depreciation for ${result.period}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Depreciation failed');
    }
  }

  return (
    <div className="ac-page">
      <PageHeader
        title="Assets"
        description="Fixed asset register with straight-line monthly depreciation to account 1600."
        actions={
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted">Period</span>
            <input
              className="ac-input w-36"
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </label>
        }
      />
      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}
      {notice ? <p className="mb-4 text-sm text-brand">{notice}</p> : null}
      <form onSubmit={onSubmit} className="ac-card mb-6 grid gap-3 p-5 sm:grid-cols-2">
        <input
          className="ac-input"
          placeholder="Name"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className="ac-input"
          placeholder="Category"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        />
        <input
          className="ac-input"
          placeholder="Cost"
          required
          value={form.cost}
          onChange={(e) => setForm({ ...form, cost: e.target.value })}
        />
        <input
          className="ac-input"
          type="date"
          value={form.purchaseDate}
          onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
        />
        <input
          className="ac-input"
          placeholder="Useful life (months)"
          value={form.usefulLifeMonths}
          onChange={(e) => setForm({ ...form, usefulLifeMonths: e.target.value })}
        />
        <input
          className="ac-input"
          placeholder="Salvage value"
          value={form.salvageValue}
          onChange={(e) => setForm({ ...form, salvageValue: e.target.value })}
        />
        <select
          className="ac-input sm:col-span-2"
          value={form.assignedToId}
          onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}
        >
          <option value="">Unassigned</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button type="submit" className="ac-btn-primary sm:col-span-2">
          Add asset
        </button>
      </form>
      <div className="ac-card overflow-x-auto">
        <table className="ac-table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Name</th>
              <th>Life</th>
              <th>Assignee</th>
              <th>Status</th>
              <th className="text-right">Cost</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.id}>
                <td className="font-mono text-xs">{a.assetNumber}</td>
                <td className="font-medium">
                  {a.name}
                  <div className="text-xs text-muted">{a.category}</div>
                </td>
                <td className="text-sm">{a.usefulLifeMonths ?? '—'} mo</td>
                <td>{a.assignedTo?.name ?? '—'}</td>
                <td>
                  <StatusBadge status={a.status} />
                </td>
                <td className="text-right">
                  <Money amount={a.cost} />
                </td>
                <td className="text-right">
                  <button
                    type="button"
                    className="text-xs font-semibold text-brand"
                    onClick={() => depreciate(a.id)}
                  >
                    Depreciate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
