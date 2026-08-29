'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { PageHeader } from '@/components/ui';

type Currency = {
  id: string;
  code: string;
  name: string;
  symbol?: string | null;
  isBase: boolean;
  rates: Array<{ rateToBase: string; rateDate: string }>;
};

type Rate = {
  id: string;
  rateDate: string;
  rateToBase: string;
  source: string;
  currency: { code: string; name: string };
};

export default function FxPage() {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    currencyCode: 'USD',
    rateDate: new Date().toISOString().slice(0, 10),
    rateToBase: '120',
  });

  async function load() {
    const [c, r] = await Promise.all([
      api<Currency[]>('/api/v1/fx/currencies'),
      api<Rate[]>('/api/v1/fx/rates'),
    ]);
    setCurrencies(c);
    setRates(r);
    const firstForeign = c.find((x) => !x.isBase);
    if (firstForeign) {
      setForm((prev) => ({
        ...prev,
        currencyCode: firstForeign.code,
        rateToBase: firstForeign.rates[0]?.rateToBase ?? prev.rateToBase,
      }));
    }
  }

  useEffect(() => {
    load().catch(async (err) => {
      if (err instanceof ApiError) setError(err.message);
      else setError('Unable to load FX');
    });
  }, []);

  async function ensureDefaults() {
    setError(null);
    try {
      await api('/api/v1/fx/currencies/ensure-defaults', { method: 'POST' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not seed currencies');
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await api('/api/v1/fx/rates', { method: 'POST', body: JSON.stringify(form) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save rate');
    }
  }

  return (
    <div className="ac-page">
      <PageHeader
        title="Currencies & FX"
        description="BDT is base. Set rates as BDT per 1 unit of foreign currency. Payments at a different rate post FX gain/loss."
        actions={
          <button type="button" className="ac-btn-secondary" onClick={ensureDefaults}>
            Seed BDT/GBP/USD/EUR
          </button>
        }
      />
      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="ac-card p-5">
          <h2 className="font-display text-lg font-semibold">Currencies</h2>
          <div className="mt-3 divide-y divide-line">
            {currencies.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <div className="font-medium">
                    {c.code} {c.isBase ? '(base)' : ''}
                  </div>
                  <div className="text-xs text-muted">{c.name}</div>
                </div>
                <div className="font-mono text-xs">
                  {c.isBase
                    ? '1'
                    : c.rates[0]
                      ? c.rates[0].rateToBase
                      : '—'}
                </div>
              </div>
            ))}
            {currencies.length === 0 ? (
              <p className="py-4 text-sm text-muted">No currencies yet — seed defaults.</p>
            ) : null}
          </div>
        </div>

        <form onSubmit={onSubmit} className="ac-card grid gap-3 p-5">
          <h2 className="font-display text-lg font-semibold">Set rate</h2>
          <label>
            <span className="ac-label">Currency</span>
            <select
              className="ac-input"
              value={form.currencyCode}
              onChange={(e) => setForm({ ...form, currencyCode: e.target.value })}
            >
              {currencies
                .filter((c) => !c.isBase)
                .map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code}
                  </option>
                ))}
              {currencies.filter((c) => !c.isBase).length === 0
                ? ['USD', 'GBP', 'EUR'].map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))
                : null}
            </select>
          </label>
          <label>
            <span className="ac-label">Date</span>
            <input
              className="ac-input"
              type="date"
              value={form.rateDate}
              onChange={(e) => setForm({ ...form, rateDate: e.target.value })}
            />
          </label>
          <label>
            <span className="ac-label">BDT per 1 unit</span>
            <input
              className="ac-input"
              required
              value={form.rateToBase}
              onChange={(e) => setForm({ ...form, rateToBase: e.target.value })}
            />
          </label>
          <button type="submit" className="ac-btn-primary">
            Save rate
          </button>
        </form>
      </div>

      <div className="ac-card mt-6 overflow-x-auto">
        <table className="ac-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Currency</th>
              <th>Rate → BDT</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((r) => (
              <tr key={r.id}>
                <td>{r.rateDate.slice(0, 10)}</td>
                <td>{r.currency.code}</td>
                <td className="font-mono">{r.rateToBase}</td>
                <td>{r.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rates.length === 0 ? (
          <p className="p-6 text-sm text-muted">No exchange rates yet.</p>
        ) : null}
      </div>
    </div>
  );
}
