'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { PageHeader } from '@/components/ui';

type Account = {
  id: string;
  code: string;
  name: string;
  type: string;
  isPostable: boolean;
  active: boolean;
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: '',
    name: '',
    type: 'EXPENSE',
    isPostable: true,
  });

  async function load() {
    const rows = await api<Account[]>('/api/v1/accounts');
    setAccounts(rows);
  }

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : 'Unable to load accounts'),
    );
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    try {
      await api('/api/v1/accounts', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setForm({ code: '', name: '', type: 'EXPENSE', isPostable: true });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account');
    }
  }

  return (
    <div className="ac-page">
      <PageHeader
        title="Chart of accounts"
        description="Bangladesh software-business defaults, including VAT/TDS/VDS and FX accounts."
        actions={
          <Link href="/app/opening-balances" className="ac-btn-secondary text-xs">
            Opening balances
          </Link>
        }
      />
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <form onSubmit={onCreate} className="ac-card mb-6 grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5">
        <input
          className="ac-input"
          placeholder="Code"
          required
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
        />
        <input
          className="ac-input sm:col-span-2"
          placeholder="Name"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <select
          className="ac-input"
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
        >
          {['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <button type="submit" className="ac-btn-secondary">
          Add account
        </button>
      </form>

      <div className="ac-card overflow-x-auto">
        <table className="ac-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Type</th>
              <th>Postable</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td className="font-mono text-xs">{a.code}</td>
                <td className={a.isPostable ? 'font-medium' : 'text-muted'}>{a.name}</td>
                <td>{a.type}</td>
                <td>{a.isPostable ? 'Yes' : 'No'}</td>
                <td>
                  <button
                    type="button"
                    className="text-xs text-brand"
                    onClick={async () => {
                      await api(`/api/v1/accounts/${a.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ isPostable: !a.isPostable }),
                      });
                      await load();
                    }}
                  >
                    Toggle postable
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
