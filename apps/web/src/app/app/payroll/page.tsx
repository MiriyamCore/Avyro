'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { Money, PageHeader, StatusBadge } from '@/components/ui';
import { PayrollSectionNav } from '@/components/section-nav';

type Period = { id: string; name: string; startDate: string; endDate: string };
type Run = {
  id: string;
  runDate: string;
  status: string;
  journalEntryId?: string | null;
  period: { name: string };
  items: Array<{
    id: string;
    grossPay: string;
    deductions: string;
    netPay: string;
    person: { id: string; name: string };
  }>;
};

export default function PayrollPage() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [periodForm, setPeriodForm] = useState({
    name: new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' }),
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10),
    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
      .toISOString()
      .slice(0, 10),
  });
  const [runPeriodId, setRunPeriodId] = useState('');

  async function load() {
    const [p, r] = await Promise.all([
      api<Period[]>('/api/v1/payroll/periods'),
      api<Run[]>('/api/v1/payroll/runs'),
    ]);
    setPeriods(p);
    setRuns(r);
    if (!runPeriodId && p[0]) setRunPeriodId(p[0].id);
  }

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : 'Unable to load payroll'),
    );
  }, []);

  async function createPeriod(event: FormEvent) {
    event.preventDefault();
    try {
      await api('/api/v1/payroll/periods', {
        method: 'POST',
        body: JSON.stringify(periodForm),
      });
      await load();
      setMessage('Period created');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create period');
    }
  }

  async function createRun() {
    if (!runPeriodId) return;
    try {
      await api('/api/v1/payroll/runs', {
        method: 'POST',
        body: JSON.stringify({
          periodId: runPeriodId,
          runDate: new Date().toISOString().slice(0, 10),
        }),
      });
      await load();
      setMessage('Draft run created from active people compensations');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create run');
    }
  }

  async function postRun(id: string) {
    try {
      await api(`/api/v1/payroll/runs/${id}/post`, { method: 'POST' });
      await load();
      setMessage('Payroll posted (6100 / 2300 / 2230 TDS when deductions > 0)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post payroll');
    }
  }

  return (
    <div className="ac-page">
      <PayrollSectionNav />
      <PageHeader
        title="Payroll"
        description="Create a period, draft a run from people (gross, TDS %, net), then post the journal."
        actions={
          <Link href="/app/people" className="ac-btn-secondary">
            Manage employees
          </Link>
        }
      />
      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}
      {message ? <p className="mb-4 text-sm text-success">{message}</p> : null}

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <form onSubmit={createPeriod} className="ac-card grid gap-3 p-5">
          <h2 className="font-display text-lg font-semibold">Payroll period</h2>
          <input
            className="ac-input"
            value={periodForm.name}
            onChange={(e) => setPeriodForm({ ...periodForm, name: e.target.value })}
          />
          <input
            className="ac-input"
            type="date"
            value={periodForm.startDate}
            onChange={(e) => setPeriodForm({ ...periodForm, startDate: e.target.value })}
          />
          <input
            className="ac-input"
            type="date"
            value={periodForm.endDate}
            onChange={(e) => setPeriodForm({ ...periodForm, endDate: e.target.value })}
          />
          <button type="submit" className="ac-btn-secondary">
            Create period
          </button>
        </form>

        <div className="ac-card grid gap-3 p-5">
          <h2 className="font-display text-lg font-semibold">New draft run</h2>
          <select
            className="ac-input"
            value={runPeriodId}
            onChange={(e) => setRunPeriodId(e.target.value)}
          >
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button type="button" className="ac-btn-primary" onClick={createRun}>
            Create draft from people
          </button>
          <p className="text-xs text-muted">
            TDS uses each person’s TDS %. Posting: Dr 6100, Cr 2300 (net), Cr 2230 (TDS).
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {runs.map((run) => (
          <div key={run.id} className="ac-card p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-display text-lg font-semibold">{run.period.name}</div>
                <div className="text-xs text-muted">{run.runDate.slice(0, 10)}</div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={run.status} />
                {run.status === 'DRAFT' ? (
                  <button
                    type="button"
                    className="ac-btn-primary text-xs"
                    onClick={() => postRun(run.id)}
                  >
                    Post payroll
                  </button>
                ) : null}
              </div>
            </div>
            <table className="ac-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th className="text-right">Gross</th>
                  <th className="text-right">TDS</th>
                  <th className="text-right">Net</th>
                  {run.status === 'POSTED' ? <th></th> : null}
                </tr>
              </thead>
              <tbody>
                {run.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.person.name}</td>
                    <td className="text-right">
                      <Money amount={item.grossPay} />
                    </td>
                    <td className="text-right">
                      <Money amount={item.deductions} />
                    </td>
                    <td className="text-right">
                      <Money amount={item.netPay} />
                    </td>
                    {run.status === 'POSTED' ? (
                      <td className="text-right">
                        <a
                          className="text-xs font-medium text-brand"
                          href={`/api/v1/payroll/runs/${run.id}/payslips/${item.person.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Payslip PDF
                        </a>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {runs.length === 0 ? (
          <p className="text-sm text-muted">No payroll runs yet.</p>
        ) : null}
      </div>
    </div>
  );
}
