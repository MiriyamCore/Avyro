'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { PageHeader } from '@/components/ui';

type Account = { id: string; code: string; name: string; type: string; isPostable: boolean };

type LineDraft = {
  accountId: string;
  description: string;
  debitAmount: string;
  creditAmount: string;
};

const emptyLine = (): LineDraft => ({
  accountId: '',
  description: '',
  debitAmount: '',
  creditAmount: '',
});

export default function OpeningBalancesPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<LineDraft[]>([emptyLine(), emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api<Account[]>('/api/v1/accounts')
      .then(setAccounts)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load accounts'),
      );
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const result = await api<{ journalNumber: string }>('/api/v1/opening-balances', {
        method: 'POST',
        body: JSON.stringify({
          entryDate,
          lines: lines
            .filter((l) => l.accountId && (l.debitAmount || l.creditAmount))
            .map((l) => ({
              accountId: l.accountId,
              description: l.description || undefined,
              debitAmount: l.debitAmount || undefined,
              creditAmount: l.creditAmount || undefined,
            })),
        }),
      });
      setMessage(`Opening balances posted as ${result.journalNumber}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post opening balances');
    }
  }

  const postable = accounts.filter((a) => a.isPostable);

  return (
    <div className="ac-page">
      <PageHeader
        title="Opening balances"
        description="Post opening balance journal entries for accounts at go-live or year start."
      />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {message ? <p className="text-sm text-success">{message}</p> : null}
      <form onSubmit={onSubmit} className="ac-card grid gap-4 p-5">
        <label>
          <span className="ac-label">Entry date</span>
          <input
            className="ac-input"
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
          />
        </label>
        {lines.map((line, index) => (
          <div key={index} className="grid gap-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
            <select
              className="ac-input"
              value={line.accountId}
              onChange={(e) =>
                setLines((prev) =>
                  prev.map((row, i) => (i === index ? { ...row, accountId: e.target.value } : row)),
                )
              }
            >
              <option value="">Account…</option>
              {postable.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
            <input
              className="ac-input"
              placeholder="Debit"
              value={line.debitAmount}
              onChange={(e) =>
                setLines((prev) =>
                  prev.map((row, i) => (i === index ? { ...row, debitAmount: e.target.value } : row)),
                )
              }
            />
            <input
              className="ac-input"
              placeholder="Credit"
              value={line.creditAmount}
              onChange={(e) =>
                setLines((prev) =>
                  prev.map((row, i) =>
                    i === index ? { ...row, creditAmount: e.target.value } : row,
                  ),
                )
              }
            />
            <input
              className="ac-input"
              placeholder="Memo"
              value={line.description}
              onChange={(e) =>
                setLines((prev) =>
                  prev.map((row, i) =>
                    i === index ? { ...row, description: e.target.value } : row,
                  ),
                )
              }
            />
          </div>
        ))}
        <div className="flex gap-2">
          <button
            type="button"
            className="ac-btn-secondary"
            onClick={() => setLines((prev) => [...prev, emptyLine()])}
          >
            Add line
          </button>
          <button type="submit" className="ac-btn-primary">
            Post opening balances
          </button>
        </div>
      </form>
    </div>
  );
}
