'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, uploadReceipt } from '@/lib/api';
import { Money, PageHeader, StatusBadge } from '@/components/ui';
import { PurchasesSectionNav } from '@/components/section-nav';

type Account = {
  id: string;
  code: string;
  name: string;
  type: string;
  isPostable: boolean;
};

type Expense = {
  id: string;
  expenseDate: string;
  description: string;
  amount: string;
  currency: string;
  status: string;
};

export default function RecordExpensePage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [expenseAccountId, setExpenseAccountId] = useState('');
  const [paidFromAccountId, setPaidFromAccountId] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [rows, exp] = await Promise.all([
      api<Account[]>('/api/v1/accounts'),
      api<Expense[]>('/api/v1/expenses'),
    ]);
    setAccounts(rows);
    setExpenses(exp);
    const hosting = rows.find((a) => a.code === '6600');
    const bank =
      rows.find((a) => a.code === '1110') ?? rows.find((a) => a.code === '1101');
    if (hosting && !expenseAccountId) setExpenseAccountId(hosting.id);
    if (bank && !paidFromAccountId) setPaidFromAccountId(bank.id);
  }

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : 'Unable to load expenses'),
    );
  }, []);

  const expenseAccounts = useMemo(
    () =>
      accounts.filter(
        (a) =>
          a.isPostable &&
          (a.type === 'EXPENSE' || a.code.startsWith('5') || a.code.startsWith('6')),
      ),
    [accounts],
  );
  const payFromAccounts = useMemo(
    () =>
      accounts.filter(
        (a) => a.isPostable && (a.code.startsWith('11') || a.code === '2100'),
      ),
    [accounts],
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api('/api/v1/expenses', {
        method: 'POST',
        body: JSON.stringify({
          expenseDate: entryDate,
          description,
          amount,
          categoryAccountId: expenseAccountId,
          paymentAccountId: paidFromAccountId,
        }),
      });
      setAmount('');
      setDescription('');
      await load();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ac-page pb-24 lg:pb-8">
      <PageHeader
        title="Expenses"
        description="Paid from bank or cash. Posts automatically — no debit/credit required."
      />
      <PurchasesSectionNav />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <form
          id="expense-form"
          onSubmit={onSubmit}
          className="ac-card grid h-fit gap-4 p-5"
        >
          <label>
            <span className="ac-label">Date</span>
            <input
              className="ac-input min-h-11 text-base lg:text-sm"
              type="date"
              required
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
            />
          </label>
          <label>
            <span className="ac-label">Amount (BDT)</span>
            <input
              className="ac-input min-h-11 text-base lg:text-sm"
              required
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label>
            <span className="ac-label">Category</span>
            <select
              className="ac-input min-h-11 text-base lg:text-sm"
              required
              value={expenseAccountId}
              onChange={(e) => setExpenseAccountId(e.target.value)}
            >
              <option value="">Select…</option>
              {expenseAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} — {account.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="ac-label">Paid from</span>
            <select
              className="ac-input min-h-11 text-base lg:text-sm"
              required
              value={paidFromAccountId}
              onChange={(e) => setPaidFromAccountId(e.target.value)}
            >
              <option value="">Select…</option>
              {payFromAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} — {account.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="ac-label">Description</span>
            <input
              className="ac-input min-h-11 text-base lg:text-sm"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Cloudflare hosting August"
            />
          </label>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <button
            type="submit"
            className="ac-btn-primary hidden min-h-12 w-full text-base lg:inline-flex"
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Record expense'}
          </button>
        </form>

        <div className="ac-table-wrap">
          <table className="ac-table ac-table-zebra">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Status</th>
                <th className="text-right">Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp) => (
                <tr key={exp.id}>
                  <td>{exp.expenseDate.slice(0, 10)}</td>
                  <td className="font-medium">{exp.description}</td>
                  <td>
                    <StatusBadge status={exp.status} />
                  </td>
                  <td className="text-right">
                    <Money amount={exp.amount} currency={exp.currency} />
                  </td>
                  <td className="text-right">
                    <label className="ac-btn-ghost inline-flex min-h-10 cursor-pointer items-center text-xs">
                      Attach receipt
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,.pdf"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (!file) return;
                          try {
                            await uploadReceipt(file, {
                              entityType: 'Expense',
                              entityId: exp.id,
                            });
                            setError(null);
                            alert('Receipt uploaded. Find it under Documents.');
                          } catch (err) {
                            setError(
                              err instanceof Error
                                ? err.message
                                : 'Could not attach receipt',
                            );
                          }
                        }}
                      />
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {expenses.length === 0 ? (
            <p className="p-6 text-sm text-muted">No expenses recorded yet.</p>
          ) : null}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 p-3 backdrop-blur lg:hidden">
        <button
          type="submit"
          form="expense-form"
          className="ac-btn-primary min-h-12 w-full text-base"
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Record expense'}
        </button>
      </div>
    </div>
  );
}
