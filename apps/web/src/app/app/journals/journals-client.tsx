'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';

type Account = {
  id: string;
  code: string;
  name: string;
  type: string;
  isPostable: boolean;
};

type Journal = {
  id: string;
  journalNumber: string;
  description: string;
  status: string;
  entryDate: string;
  reversedEntryId?: string | null;
};

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

export default function JournalsClient() {
  const searchParams = useSearchParams();
  const [journals, setJournals] = useState<Journal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showForm, setShowForm] = useState(searchParams.get('new') === '1');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([emptyLine(), emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const postableAccounts = useMemo(
    () => accounts.filter((a) => a.isPostable),
    [accounts],
  );

  async function load() {
    const [journalsJson, accountsJson] = await Promise.all([
      api<Journal[]>('/api/v1/journals'),
      api<Account[]>('/api/v1/accounts'),
    ]);
    setJournals(Array.isArray(journalsJson) ? journalsJson : []);
    setAccounts(Array.isArray(accountsJson) ? accountsJson : []);
  }

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : 'Unable to load journals'),
    );
  }, []);

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payloadLines = lines
        .filter((line) => line.accountId && (line.debitAmount || line.creditAmount))
        .map((line) => ({
          accountId: line.accountId,
          description: line.description || undefined,
          debitAmount: line.debitAmount || undefined,
          creditAmount: line.creditAmount || undefined,
        }));

      const body = await api<{ journalNumber: string }>('/api/v1/journals', {
        method: 'POST',
        body: JSON.stringify({
          entryDate,
          description,
          lines: payloadLines,
        }),
      });
      setSuccess(`Posted ${body.journalNumber}`);
      setDescription('');
      setLines([emptyLine(), emptyLine()]);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not post journal');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ padding: '2.5rem 1.5rem', maxWidth: 980, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <h1 style={{ fontFamily: 'Georgia, serif', marginBottom: 0 }}>Journals</h1>
        <button
          type="button"
          onClick={() => {
            setShowForm((v) => !v);
            setError(null);
            setSuccess(null);
          }}
          style={{
            background: '#0f3d3e',
            color: 'white',
            border: 0,
            borderRadius: 8,
            padding: '0.75rem 1rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {showForm ? 'Cancel' : 'New journal'}
        </button>
      </div>
      <p style={{ color: '#64748b' }}>
        Post a balanced entry (total debits must equal total credits).
      </p>

      {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
      {success ? <p style={{ color: '#166534' }}>{success}</p> : null}

      {showForm ? (
        <form
          onSubmit={onSubmit}
          style={{
            background: 'rgba(255,255,255,0.75)',
            border: '1px solid #dbe3ea',
            borderRadius: 12,
            padding: '1.25rem',
            display: 'grid',
            gap: 12,
            marginBottom: 28,
          }}
        >
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Date</span>
            <input
              type="date"
              required
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              style={{ padding: '0.65rem 0.75rem', borderRadius: 8, border: '1px solid #cbd5e1' }}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Description</span>
            <input
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Owner contribution / Office internet"
              style={{ padding: '0.65rem 0.75rem', borderRadius: 8, border: '1px solid #cbd5e1' }}
            />
          </label>

          <div style={{ display: 'grid', gap: 10 }}>
            <strong>Lines</strong>
            {lines.map((line, index) => (
              <div
                key={index}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1.4fr 1fr 1fr',
                  gap: 8,
                }}
              >
                <select
                  required={index < 2}
                  value={line.accountId}
                  onChange={(e) => updateLine(index, { accountId: e.target.value })}
                  style={{ padding: '0.65rem', borderRadius: 8, border: '1px solid #cbd5e1' }}
                >
                  <option value="">Account…</option>
                  {postableAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} — {account.name}
                    </option>
                  ))}
                </select>
                <input
                  value={line.description}
                  onChange={(e) => updateLine(index, { description: e.target.value })}
                  placeholder="Line note"
                  style={{ padding: '0.65rem', borderRadius: 8, border: '1px solid #cbd5e1' }}
                />
                <input
                  inputMode="decimal"
                  value={line.debitAmount}
                  onChange={(e) =>
                    updateLine(index, {
                      debitAmount: e.target.value,
                      creditAmount: e.target.value ? '' : line.creditAmount,
                    })
                  }
                  placeholder="Debit"
                  style={{ padding: '0.65rem', borderRadius: 8, border: '1px solid #cbd5e1' }}
                />
                <input
                  inputMode="decimal"
                  value={line.creditAmount}
                  onChange={(e) =>
                    updateLine(index, {
                      creditAmount: e.target.value,
                      debitAmount: e.target.value ? '' : line.debitAmount,
                    })
                  }
                  placeholder="Credit"
                  style={{ padding: '0.65rem', borderRadius: 8, border: '1px solid #cbd5e1' }}
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => setLines((prev) => [...prev, emptyLine()])}
              style={{
                justifySelf: 'start',
                background: 'transparent',
                border: '1px solid #94a3b8',
                borderRadius: 8,
                padding: '0.5rem 0.8rem',
                cursor: 'pointer',
              }}
            >
              Add line
            </button>
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{
              background: '#0f3d3e',
              color: 'white',
              border: 0,
              borderRadius: 8,
              padding: '0.85rem 1rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {saving ? 'Posting…' : 'Post journal'}
          </button>
        </form>
      ) : null}

      <ul style={{ paddingLeft: 18 }}>
        {journals.map((j) => (
          <li key={j.id} style={{ marginBottom: 8 }}>
            <strong>{j.journalNumber}</strong> — {j.description} ({j.status})
            {j.status === 'POSTED' ? (
              <button
                type="button"
                style={{ marginLeft: 8, fontSize: 12 }}
                onClick={async () => {
                  await api(`/api/v1/journals/${j.id}/reverse`, { method: 'POST' });
                  await load();
                  setSuccess(`Reversed ${j.journalNumber}`);
                }}
              >
                Reverse
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {!error && journals.length === 0 ? (
        <p>
          No journals yet. <Link href="/app/journals?new=1">Create one</Link>.
        </p>
      ) : null}
    </main>
  );
}
