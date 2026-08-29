'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  api,
  ApiError,
  previewBankStatementPdf,
  type ParsedBankStatementRow,
} from '@/lib/api';
import { EmptyState, Money, PageHeader, StatusBadge } from '@/components/ui';

type BankAccount = {
  id: string;
  name: string;
  bankName?: string | null;
  currency: string;
  accountNumberMasked?: string | null;
  _count?: { transactions: number };
};

type Txn = {
  id: string;
  txnDate: string;
  description: string;
  amount: string;
  status: string;
  bankAccount: { name: string; currency: string };
};

type Suggestion = { id: string; type: string; label: string; amount: string };

type PdfPreviewRow = ParsedBankStatementRow & { included: boolean; key: string };

export default function BankingPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [csv, setCsv] = useState(
    'date,description,amount,balance,externalId\n2026-08-10,Inoryum payment,75000,158500,ebl-1\n2026-08-09,Cloudflare,-2500,83500,ebl-2\n',
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [matchFor, setMatchFor] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [form, setForm] = useState({
    name: 'EBL Business BDT',
    bankName: 'Eastern Bank',
    accountNumberMasked: '****4521',
    currency: 'BDT',
  });
  const [transfer, setTransfer] = useState({
    fromBankAccountId: '',
    toBankAccountId: '',
    amount: '',
    transferDate: new Date().toISOString().slice(0, 10),
    description: '',
  });
  const [recon, setRecon] = useState<
    Array<{
      bankAccountId: string;
      name: string;
      ledgerBalance: string;
      statementBalance: string | null;
      unexplainedCount: number;
      difference: string | null;
    }>
  >([]);
  const [pdfPreview, setPdfPreview] = useState<PdfPreviewRow[]>([]);
  const [pdfWarnings, setPdfWarnings] = useState<string[]>([]);
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'csv' | 'pdf'>('csv');

  async function load() {
    const [acc, transactions, reconRows] = await Promise.all([
      api<BankAccount[]>('/api/v1/banking/accounts'),
      api<Txn[]>('/api/v1/banking/transactions'),
      api<typeof recon>('/api/v1/banking/reconciliation').catch(() => []),
    ]);
    setAccounts(acc);
    setTxns(transactions);
    setRecon(reconRows);
    if (!selectedId && acc[0]) setSelectedId(acc[0].id);
    if (!transfer.fromBankAccountId && acc[0]) {
      const first = acc[0];
      const second = acc[1];
      setTransfer((t) => ({
        ...t,
        fromBankAccountId: first.id,
        toBankAccountId: second?.id ?? first.id,
      }));
    }
  }

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : 'Unable to load banking'),
    );
  }, []);

  async function createAccount(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await api('/api/v1/banking/accounts', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      await load();
      setMessage('Bank account created');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account');
    }
  }

  async function importCsv(event: FormEvent) {
    event.preventDefault();
    if (!selectedId) return;
    setError(null);
    try {
      const result = await api<{ imported: number; skipped: number }>(
        `/api/v1/banking/accounts/${selectedId}/import`,
        { method: 'POST', body: JSON.stringify({ csv }) },
      );
      setMessage(`Imported ${result.imported}, skipped ${result.skipped}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    }
  }

  async function onFile(file: File) {
    if (!selectedId) return;
    setError(null);
    try {
      const name = file.name.toLowerCase();
      if (name.endsWith('.pdf')) {
        setImportMode('pdf');
        const result = await previewBankStatementPdf(selectedId, file);
        setPdfFileName(file.name);
        setPdfWarnings(result.warnings);
        setPdfPreview(
          result.rows.map((row, index) => ({
            ...row,
            included: true,
            key: `${row.date}-${index}-${row.description.slice(0, 20)}`,
          })),
        );
        if (result.rows.length === 0) {
          setError(result.warnings[0] ?? 'No transactions found in PDF.');
        } else {
          setMessage(
            `Parsed ${result.rows.length} transaction(s) from ${file.name} — review before importing.`,
          );
        }
        return;
      }
      if (name.endsWith('.csv') || name.endsWith('.txt')) {
        const text = await file.text();
        setCsv(text);
        const result = await api<{ imported: number; skipped: number }>(
          `/api/v1/banking/accounts/${selectedId}/import`,
          { method: 'POST', body: JSON.stringify({ csv: text }) },
        );
        setMessage(`Imported ${result.imported} from ${file.name}`);
        await load();
        return;
      }
      if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        const XLSX = await import('xlsx');
        const buf = await file.arrayBuffer();
        const workbook = XLSX.read(buf, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          setError('Spreadsheet has no sheets.');
          return;
        }
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
          setError('Spreadsheet sheet could not be read.');
          return;
        }
        const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
          header: 1,
          raw: false,
        }) as string[][];
        const dataRows = rows.slice(1).filter((r) => r && r.length >= 3);
        const result = await api<{ imported: number; skipped: number }>(
          `/api/v1/banking/accounts/${selectedId}/import`,
          { method: 'POST', body: JSON.stringify({ rows: dataRows }) },
        );
        setMessage(`Imported ${result.imported} from ${file.name}`);
        await load();
        return;
      }
      setError('Use .csv, .xlsx, or .pdf');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'File import failed');
    }
  }

  function updatePdfRow(key: string, field: keyof PdfPreviewRow, value: string | boolean) {
    setPdfPreview((rows) =>
      rows.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    );
  }

  async function confirmPdfImport() {
    if (!selectedId) return;
    const selected = pdfPreview.filter((r) => r.included);
    if (selected.length === 0) {
      setError('Select at least one transaction to import.');
      return;
    }
    setError(null);
    try {
      const rows = selected.map((r) => [
        r.date,
        r.description,
        r.amount,
        r.balance ?? '',
        r.externalId ?? `${r.date}|${r.description}|${r.amount}`,
      ]);
      const result = await api<{ imported: number; skipped: number }>(
        `/api/v1/banking/accounts/${selectedId}/import`,
        { method: 'POST', body: JSON.stringify({ rows }) },
      );
      setMessage(`Imported ${result.imported} from PDF, skipped ${result.skipped}`);
      setPdfPreview([]);
      setPdfWarnings([]);
      setPdfFileName(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF import failed');
    }
  }

  async function openMatch(txnId: string) {
    setError(null);
    setMatchFor(txnId);
    try {
      const res = await api<{
        payments: Suggestion[];
        expenses: Suggestion[];
        billPayments: Suggestion[];
      }>(`/api/v1/banking/transactions/${txnId}/suggestions`);
      setSuggestions([...res.payments, ...res.expenses, ...res.billPayments]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load suggestions');
    }
  }

  async function confirmMatch(suggestion: Suggestion) {
    if (!matchFor) return;
    try {
      await api(`/api/v1/banking/transactions/${matchFor}/match`, {
        method: 'POST',
        body: JSON.stringify({
          matchedType: suggestion.type,
          matchedId: suggestion.id,
        }),
      });
      setMessage(`Matched to ${suggestion.label}`);
      setMatchFor(null);
      setSuggestions([]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Match failed');
    }
  }

  async function ignoreTxn(txnId: string) {
    try {
      await api(`/api/v1/banking/transactions/${txnId}/ignore`, { method: 'POST' });
      setMessage('Transaction ignored');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ignore failed');
    }
  }

  async function doTransfer(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await api('/api/v1/banking/transfers', {
        method: 'POST',
        body: JSON.stringify(transfer),
      });
      setMessage('Transfer recorded');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transfer failed');
    }
  }

  return (
    <div className="ac-page">
      <PageHeader
        title="Banking"
        description="Import CSV, XLSX, or PDF statements, pick matches, transfer between accounts."
      />
      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}
      {message ? <p className="mb-4 text-sm text-success">{message}</p> : null}

      {recon.length > 0 ? (
        <div className="ac-card mb-6 p-5">
          <h2 className="font-display text-lg font-semibold">Reconciliation summary</h2>
          <div className="mt-3 divide-y divide-line text-sm">
            {recon.map((row) => (
              <div key={row.bankAccountId} className="flex flex-wrap justify-between gap-2 py-3">
                <div>
                  <div className="font-medium">{row.name}</div>
                  <div className="text-xs text-muted">
                    Ledger {row.ledgerBalance} BDT
                    {row.statementBalance ? ` · Statement ${row.statementBalance}` : ''}
                  </div>
                </div>
                <div className="text-right text-xs">
                  <div>{row.unexplainedCount} unmatched import(s)</div>
                  {row.difference ? (
                    <div className="text-warning">Difference {row.difference}</div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={createAccount} className="ac-card grid gap-3 p-5">
          <h2 className="font-display text-lg font-semibold">Add bank account</h2>
          <input
            className="ac-input"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            className="ac-input"
            placeholder="Bank"
            value={form.bankName}
            onChange={(e) => setForm({ ...form, bankName: e.target.value })}
          />
          <button type="submit" className="ac-btn-primary">
            Create account
          </button>
          <div className="space-y-2 pt-2">
            {accounts.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                  selectedId === a.id ? 'border-brand bg-brand-soft' : 'border-line'
                }`}
                onClick={() => setSelectedId(a.id)}
              >
                <div className="font-medium">{a.name}</div>
                <div className="text-xs text-muted">
                  {a.bankName} · {a._count?.transactions ?? 0} transactions
                </div>
              </button>
            ))}
          </div>
        </form>

        <div className="ac-card grid gap-3 p-5">
          <h2 className="font-display text-lg font-semibold">Import statement</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-lg border px-3 py-1.5 text-xs ${
                importMode === 'csv' ? 'border-brand bg-brand-soft' : 'border-line'
              }`}
              onClick={() => setImportMode('csv')}
            >
              CSV / XLSX
            </button>
            <button
              type="button"
              className={`rounded-lg border px-3 py-1.5 text-xs ${
                importMode === 'pdf' ? 'border-brand bg-brand-soft' : 'border-line'
              }`}
              onClick={() => setImportMode('pdf')}
            >
              PDF (BD banks)
            </button>
          </div>

          {importMode === 'csv' ? (
            <>
              <p className="text-xs text-muted">
                CSV columns: date, description, amount [, balance] [, externalId]. XLSX first
                sheet, same column order.
              </p>
              <textarea
                className="ac-input min-h-32 font-mono text-xs"
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="ac-btn-secondary"
                  disabled={!selectedId}
                  onClick={() => importCsv({ preventDefault() {} } as FormEvent)}
                >
                  Import pasted CSV
                </button>
                <label className="ac-btn-ghost cursor-pointer">
                  Upload CSV / XLSX
                  <input
                    type="file"
                    accept=".csv,.txt,.xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void onFile(file);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-muted">
                Upload a text-based PDF bank statement (EBL, BRAC, City, etc.). Review parsed
                rows before confirming import. Scanned/image PDFs are not supported.
              </p>
              <label className="ac-btn-secondary inline-flex w-fit cursor-pointer">
                Upload PDF statement
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  disabled={!selectedId}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void onFile(file);
                    e.target.value = '';
                  }}
                />
              </label>
              {pdfFileName ? (
                <p className="text-xs text-muted">File: {pdfFileName}</p>
              ) : null}
              {pdfWarnings.length > 0 ? (
                <ul className="space-y-1 text-xs text-warning">
                  {pdfWarnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}
              {pdfPreview.length > 0 ? (
                <div className="space-y-3">
                  <div className="overflow-x-auto rounded-lg border border-line">
                    <table className="ac-table text-xs">
                      <thead>
                        <tr>
                          <th className="w-10">Import</th>
                          <th>Date</th>
                          <th>Description</th>
                          <th className="text-right">Amount</th>
                          <th className="text-right">Balance</th>
                          <th>Confidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pdfPreview.map((row) => (
                          <tr key={row.key}>
                            <td>
                              <input
                                type="checkbox"
                                checked={row.included}
                                onChange={(e) =>
                                  updatePdfRow(row.key, 'included', e.target.checked)
                                }
                              />
                            </td>
                            <td>
                              <input
                                className="ac-input w-28 py-1 text-xs"
                                value={row.date}
                                onChange={(e) => updatePdfRow(row.key, 'date', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                className="ac-input min-w-40 py-1 text-xs"
                                value={row.description}
                                onChange={(e) =>
                                  updatePdfRow(row.key, 'description', e.target.value)
                                }
                              />
                            </td>
                            <td>
                              <input
                                className="ac-input w-24 py-1 text-right text-xs"
                                value={row.amount}
                                onChange={(e) => updatePdfRow(row.key, 'amount', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                className="ac-input w-24 py-1 text-right text-xs"
                                value={row.balance ?? ''}
                                onChange={(e) => updatePdfRow(row.key, 'balance', e.target.value)}
                              />
                            </td>
                            <td className="text-muted">{row.confidence}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="ac-btn-primary"
                      disabled={!selectedId}
                      onClick={() => void confirmPdfImport()}
                    >
                      Import {pdfPreview.filter((r) => r.included).length} selected row(s)
                    </button>
                    <button
                      type="button"
                      className="ac-btn-ghost"
                      onClick={() => {
                        setPdfPreview([]);
                        setPdfWarnings([]);
                        setPdfFileName(null);
                      }}
                    >
                      Clear preview
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {accounts.length >= 1 ? (
        <form onSubmit={doTransfer} className="ac-card mt-6 grid gap-3 p-5 sm:grid-cols-2">
          <h2 className="font-display text-lg font-semibold sm:col-span-2">Transfer</h2>
          <label>
            <span className="ac-label">From</span>
            <select
              className="ac-input"
              value={transfer.fromBankAccountId}
              onChange={(e) => setTransfer({ ...transfer, fromBankAccountId: e.target.value })}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="ac-label">To</span>
            <select
              className="ac-input"
              value={transfer.toBankAccountId}
              onChange={(e) => setTransfer({ ...transfer, toBankAccountId: e.target.value })}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="ac-label">Amount</span>
            <input
              className="ac-input"
              required
              value={transfer.amount}
              onChange={(e) => setTransfer({ ...transfer, amount: e.target.value })}
            />
          </label>
          <label>
            <span className="ac-label">Date</span>
            <input
              className="ac-input"
              type="date"
              value={transfer.transferDate}
              onChange={(e) => setTransfer({ ...transfer, transferDate: e.target.value })}
            />
          </label>
          <button type="submit" className="ac-btn-primary sm:col-span-2">
            Record transfer
          </button>
        </form>
      ) : null}

      {matchFor ? (
        <div className="ac-card mt-6 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Pick a match</h2>
            <button type="button" className="ac-btn-ghost text-xs" onClick={() => setMatchFor(null)}>
              Cancel
            </button>
          </div>
          {suggestions.length === 0 ? (
            <p className="text-sm text-muted">No suggestions for this amount.</p>
          ) : (
            <div className="space-y-2">
              {suggestions.map((s) => (
                <button
                  key={`${s.type}-${s.id}`}
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg border border-line px-3 py-2 text-left text-sm hover:bg-brand-soft"
                  onClick={() => confirmMatch(s)}
                >
                  <span>
                    <span className="text-xs uppercase text-muted">{s.type}</span>
                    <br />
                    {s.label}
                  </span>
                  <Money amount={s.amount} />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <div className="mt-6">
        {txns.length === 0 ? (
          <EmptyState
            title="No bank transactions"
            description="Create a bank account and import a sample CSV to start reconciling."
          />
        ) : (
          <div className="ac-card overflow-x-auto">
            <table className="ac-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Account</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th className="text-right">Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {txns.map((t) => (
                  <tr key={t.id}>
                    <td>{t.txnDate.slice(0, 10)}</td>
                    <td>{t.bankAccount.name}</td>
                    <td className="font-medium">{t.description}</td>
                    <td>
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="text-right">
                      <Money amount={t.amount} currency={t.bankAccount.currency} />
                    </td>
                    <td className="text-right">
                      {t.status === 'IMPORTED' ? (
                        <div className="flex flex-col items-end gap-1">
                          <button
                            type="button"
                            className="ac-btn-secondary text-xs"
                            onClick={() => openMatch(t.id)}
                          >
                            Match…
                          </button>
                          <button
                            type="button"
                            className="ac-btn-ghost text-xs"
                            onClick={() => ignoreTxn(t.id)}
                          >
                            Ignore
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
