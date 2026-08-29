'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { PageHeader } from '@/components/ui';

type Entry = {
  id: string;
  entryDate: string;
  hours: string;
  description?: string | null;
  billable: boolean;
  billingRate?: string | null;
  projectId?: string | null;
  person?: { name: string } | null;
};

type Person = { id: string; name: string };
type Project = { id: string; name: string; projectCode: string };

export default function TimePage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    personId: '',
    projectId: '',
    entryDate: new Date().toISOString().slice(0, 10),
    hours: '8',
    billingRate: '',
    description: '',
    billable: true,
  });

  async function load() {
    const [e, p, proj] = await Promise.all([
      api<Entry[]>('/api/v1/time-entries'),
      api<Person[]>('/api/v1/people').catch(() => []),
      api<Project[]>('/api/v1/projects').catch(() => []),
    ]);
    setEntries(e);
    setPeople(p);
    setProjects(proj);
    if (!form.personId && p[0]) {
      const first = p[0];
      setForm((f) => ({ ...f, personId: first.id }));
    }
  }

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : 'Unable to load time'),
    );
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.personId) {
      setError('Select a person.');
      return;
    }
    try {
      await api('/api/v1/time-entries', {
        method: 'POST',
        body: JSON.stringify({
          personId: form.personId,
          projectId: form.projectId || undefined,
          entryDate: form.entryDate,
          hours: form.hours,
          description: form.description || undefined,
          billable: form.billable,
          billingRate: form.billingRate || undefined,
        }),
      });
      setForm((f) => ({ ...f, hours: '8', description: '', billingRate: '' }));
      setError(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    }
  }

  return (
    <div className="ac-page">
      <PageHeader
        title="Time"
        description="Track hours by person and project. Values feed the project profitability report."
      />
      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}
      <form onSubmit={onSubmit} className="ac-card mb-6 grid gap-3 p-5 sm:grid-cols-2">
        <select
          className="ac-input"
          required
          value={form.personId}
          onChange={(e) => setForm({ ...form, personId: e.target.value })}
        >
          <option value="">Person…</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          className="ac-input"
          value={form.projectId}
          onChange={(e) => setForm({ ...form, projectId: e.target.value })}
        >
          <option value="">Project (optional)</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.projectCode} — {p.name}
            </option>
          ))}
        </select>
        <input
          className="ac-input"
          type="date"
          value={form.entryDate}
          onChange={(e) => setForm({ ...form, entryDate: e.target.value })}
        />
        <input
          className="ac-input"
          placeholder="Hours"
          required
          value={form.hours}
          onChange={(e) => setForm({ ...form, hours: e.target.value })}
        />
        <input
          className="ac-input"
          placeholder="Billing rate (BDT/hr)"
          value={form.billingRate}
          onChange={(e) => setForm({ ...form, billingRate: e.target.value })}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.billable}
            onChange={(e) => setForm({ ...form, billable: e.target.checked })}
          />
          Billable
        </label>
        <input
          className="ac-input sm:col-span-2"
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <button type="submit" className="ac-btn-primary sm:col-span-2">
          Add time
        </button>
      </form>
      <div className="ac-card overflow-x-auto">
        <table className="ac-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Person</th>
              <th>Hours</th>
              <th>Rate</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td>{e.entryDate.slice(0, 10)}</td>
                <td>{e.person?.name ?? '—'}</td>
                <td className="font-mono">{e.hours}</td>
                <td className="font-mono text-sm">{e.billingRate ?? '—'}</td>
                <td>
                  {e.description}
                  {e.billable ? (
                    <span className="ml-2 text-xs text-muted">billable</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
