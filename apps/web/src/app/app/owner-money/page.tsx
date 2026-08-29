'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { PageHeader } from '@/components/ui';

type Account = { id: string; code: string; name: string; isPostable: boolean };
type ActionType = 'contribution' | 'withdrawal';

export default function OwnerMoneyPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [action, setAction] = useState<ActionType>('contribution');
  const [amount, setAmount] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [bankAccountId, setBankAccountId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<Account[]>('/api/v1/accounts')
      .then((rows) => {
        setAccounts(rows);
        const preferred =
          rows.find((a) => a.code === '1110') ??
          rows.find((a) => a.code === '1101') ??
          rows.find((a) => a.isPostable);
        if (preferred) setBankAccountId(preferred.id);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load accounts'),
      );
  }, []);

  const capitalAccount = useMemo(() => accounts.find((a) => a.code === '3100'), [accounts]);
  const drawingsAccount = useMemo(() => accounts.find((a) => a.code === '3200'), [accounts]);
  const bankOptions = useMemo(
    () => accounts.filter((a) => a.isPostable && a.code.startsWith('11')),
    [accounts],
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (!bankAccountId || !capitalAccount || !drawingsAccount) {
        throw new Error('Required accounts are missing');
      }
      const equityId =
        action === 'contribution' ? capitalAccount.id : drawingsAccount.id;
      const lines =
        action === 'contribution'
          ? [
              { accountId: bankAccountId, debitAmount: amount },
              { accountId: equityId, creditAmount: amount },
            ]
          : [
              { accountId: equityId, debitAmount: amount },
              { accountId: bankAccountId, creditAmount: amount },
            ];
      await api('/api/v1/journals', {
        method: 'POST',
        body: JSON.stringify({
          entryDate,
          description:
            notes ||
            (action === 'contribution'
              ? 'Put personal money into business'
              : 'Take money out for personal use'),
          lines,
        }),
      });
      router.push('/app/journals');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ac-page max-w-2xl">
      <PageHeader
        title="Owner money"
        description="Put personal money in or take drawings out — never booked as operating expense. For first-time start-up funds (e.g. ৳50,000), use Business setup → Starting capital."
      />
      <form onSubmit={onSubmit} className="ac-card grid gap-4 p-5">
        <label>
          <span className="ac-label">What happened?</span>
          <select
            className="ac-input"
            value={action}
            onChange={(e) => setAction(e.target.value as ActionType)}
          >
            <option value="contribution">Put personal money into business</option>
            <option value="withdrawal">Take money out for personal use</option>
          </select>
        </label>
        <label>
          <span className="ac-label">Date</span>
          <input
            className="ac-input"
            type="date"
            required
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
          />
        </label>
        <label>
          <span className="ac-label">Amount (BDT)</span>
          <input
            className="ac-input"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label>
          <span className="ac-label">Bank / cash account</span>
          <select
            className="ac-input"
            required
            value={bankAccountId}
            onChange={(e) => setBankAccountId(e.target.value)}
          >
            {bankOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="ac-label">Notes</span>
          <input className="ac-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button type="submit" className="ac-btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Record'}
        </button>
      </form>
    </div>
  );
}
