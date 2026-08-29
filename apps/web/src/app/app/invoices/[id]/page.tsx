'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Money, PageHeader, StatusBadge } from '@/components/ui';

type InvoiceDetail = {
  id: string;
  invoiceNumber: string | null;
  status: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  subtotal: string;
  taxTotal: string;
  grandTotal: string;
  amountPaid: string;
  amountDue: string;
  notes?: string | null;
  taxCodeId?: string | null;
  customer: { id: string; name: string };
  items: Array<{
    id: string;
    description: string;
    quantity: string;
    unitPrice: string;
    lineTotal: string;
  }>;
  payments: Array<{
    id: string;
    paymentNumber: string;
    amount: string;
    paymentDate: string;
  }>;
};

type ItemDraft = { description: string; quantity: string; unitPrice: string };

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [taxCodes, setTaxCodes] = useState<
    Array<{ id: string; code: string; name: string; kind: string; ratePercent: string | null }>
  >([]);
  const [taxCodeId, setTaxCodeId] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');

  async function load() {
    const [inv, taxes] = await Promise.all([
      api<InvoiceDetail>(`/api/v1/invoices/${params.id}`),
      api<Array<{ id: string; code: string; name: string; kind: string; ratePercent: string | null }>>(
        '/api/v1/compliance/tax-codes',
      ).catch(() => []),
    ]);
    setInvoice(inv);
    setTaxCodes(taxes);
    setIssueDate(inv.issueDate.slice(0, 10));
    setDueDate(inv.dueDate.slice(0, 10));
    setNotes(inv.notes ?? '');
    setTaxCodeId(inv.taxCodeId ?? '');
    setItems(
      inv.items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
    );
  }

  useEffect(() => {
    if (!params.id) return;
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : 'Unable to load invoice'),
    );
  }, [params.id]);

  async function issue() {
    if (!invoice) return;
    try {
      await api(`/api/v1/invoices/${invoice.id}/issue`, { method: 'POST' });
      await load();
      setMessage('Invoice issued');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not issue invoice');
    }
  }

  async function credit() {
    if (!invoice) return;
    try {
      await api(`/api/v1/invoices/${invoice.id}/credit`, {
        method: 'POST',
        body: JSON.stringify({
          amount: creditAmount || undefined,
          reason: creditReason || 'Credit note',
        }),
      });
      await load();
      setMessage('Credit applied');
      setCreditAmount('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not credit invoice');
    }
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!invoice) return;
    setSaving(true);
    setError(null);
    try {
      await api(`/api/v1/invoices/${invoice.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          issueDate,
          dueDate,
          notes,
          taxCodeId: taxCodeId || null,
          items: items.filter((i) => i.description && i.unitPrice),
        }),
      });
      await load();
      setEditing(false);
      setMessage('Invoice updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save invoice');
    } finally {
      setSaving(false);
    }
  }

  if (error && !invoice) {
    return (
      <div className="ac-page">
        <p className="text-danger">{error}</p>
        <Link href="/app/invoices" className="ac-btn-secondary mt-4">
          Back
        </Link>
      </div>
    );
  }

  if (!invoice) {
    return <div className="ac-page text-muted">Loading invoice…</div>;
  }

  const isDraft = invoice.status === 'DRAFT';

  return (
    <div className="ac-page">
      <PageHeader
        title={invoice.invoiceNumber ?? 'Draft invoice'}
        description={`${invoice.customer.name} · ${invoice.issueDate.slice(0, 10)} — due ${invoice.dueDate.slice(0, 10)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={invoice.status} />
            <Link href="/app/invoices" className="ac-btn-secondary">
              Back
            </Link>
            {isDraft ? (
              <>
                <button
                  type="button"
                  className="ac-btn-secondary"
                  onClick={() => setEditing((v) => !v)}
                >
                  {editing ? 'Cancel edit' : 'Edit'}
                </button>
                <button type="button" className="ac-btn-primary" onClick={issue}>
                  Issue
                </button>
              </>
            ) : (
              <>
                <a
                  className="ac-btn-secondary"
                  href={`/api/v1/invoices/${invoice.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                >
                  PDF
                </a>
                {Number(invoice.amountDue) > 0 ? (
                  <>
                    <Link
                      href={`/app/payments?invoiceId=${invoice.id}`}
                      className="ac-btn-primary"
                    >
                      Record payment
                    </Link>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        className="ac-input w-28 py-1 text-xs"
                        placeholder="Credit amt"
                        value={creditAmount}
                        onChange={(e) => setCreditAmount(e.target.value)}
                      />
                      <input
                        className="ac-input w-36 py-1 text-xs"
                        placeholder="Reason"
                        value={creditReason}
                        onChange={(e) => setCreditReason(e.target.value)}
                      />
                      <button type="button" className="ac-btn-ghost" onClick={credit}>
                        Apply credit
                      </button>
                    </div>
                  </>
                ) : null}
              </>
            )}
          </div>
        }
      />

      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}
      {message ? <p className="mb-4 text-sm text-success">{message}</p> : null}

      {editing && isDraft ? (
        <form onSubmit={onSave} className="ac-card mb-6 grid gap-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="ac-label">Issue date</span>
              <input
                className="ac-input"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </label>
            <label>
              <span className="ac-label">Due date</span>
              <input
                className="ac-input"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </label>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-semibold">Line items</div>
            {items.map((item, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr]">
                <input
                  className="ac-input"
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((row, i) =>
                        i === index ? { ...row, description: e.target.value } : row,
                      ),
                    )
                  }
                />
                <input
                  className="ac-input"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((row, i) =>
                        i === index ? { ...row, quantity: e.target.value } : row,
                      ),
                    )
                  }
                />
                <input
                  className="ac-input"
                  placeholder="Rate"
                  value={item.unitPrice}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((row, i) =>
                        i === index ? { ...row, unitPrice: e.target.value } : row,
                      ),
                    )
                  }
                />
              </div>
            ))}
            <button
              type="button"
              className="ac-btn-ghost"
              onClick={() =>
                setItems((prev) => [...prev, { description: '', quantity: '1', unitPrice: '' }])
              }
            >
              Add line
            </button>
          </div>
          <label>
            <span className="ac-label">Notes</span>
            <input className="ac-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <label>
            <span className="ac-label">Tax code</span>
            <select
              className="ac-input"
              value={taxCodeId}
              onChange={(e) => setTaxCodeId(e.target.value)}
            >
              <option value="">None</option>
              {taxCodes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} · {t.kind}
                  {t.ratePercent != null ? ` (${t.ratePercent}%)` : ''}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="ac-btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save draft'}
          </button>
        </form>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <div className="ac-card p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Subtotal</div>
          <div className="mt-2 font-display text-xl font-semibold">
            <Money amount={invoice.subtotal} currency={invoice.currency} />
          </div>
        </div>
        <div className="ac-card p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Tax</div>
          <div className="mt-2 font-display text-xl font-semibold">
            <Money amount={invoice.taxTotal} currency={invoice.currency} />
          </div>
        </div>
        <div className="ac-card p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Total</div>
          <div className="mt-2 font-display text-xl font-semibold">
            <Money amount={invoice.grandTotal} currency={invoice.currency} />
          </div>
        </div>
        <div className="ac-card p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Amount due</div>
          <div className="mt-2 font-display text-xl font-semibold">
            <Money amount={invoice.amountDue} currency={invoice.currency} />
          </div>
        </div>
      </div>

      <div className="ac-card overflow-x-auto p-5">
        <h2 className="mb-3 font-display text-lg font-semibold">Line items</h2>
        <table className="ac-table">
          <thead>
            <tr>
              <th>Description</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Rate</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id}>
                <td>{item.description}</td>
                <td className="text-right">{item.quantity}</td>
                <td className="text-right">
                  <Money amount={item.unitPrice} currency={invoice.currency} />
                </td>
                <td className="text-right">
                  <Money amount={item.lineTotal} currency={invoice.currency} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {invoice.notes ? (
          <p className="mt-4 text-sm text-muted">
            <span className="font-semibold text-ink">Notes:</span> {invoice.notes}
          </p>
        ) : null}
      </div>

      {invoice.payments.length > 0 ? (
        <div className="ac-card mt-6 p-5">
          <h2 className="mb-3 font-display text-lg font-semibold">Payments</h2>
          {invoice.payments.map((p) => (
            <div key={p.id} className="flex justify-between border-b border-line py-3 text-sm">
              <div>
                <div className="font-medium">{p.paymentNumber}</div>
                <div className="text-xs text-muted">{p.paymentDate.slice(0, 10)}</div>
              </div>
              <Money amount={p.amount} currency={invoice.currency} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
