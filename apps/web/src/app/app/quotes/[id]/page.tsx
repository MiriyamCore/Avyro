'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Money, PageHeader, StatusBadge } from '@/components/ui';

type QuoteDetail = {
  id: string;
  quoteNumber: string | null;
  status: string;
  issueDate: string;
  validUntil: string;
  currency: string;
  grandTotal: string;
  notes?: string | null;
  customer: { id: string; name: string };
  items: Array<{
    id: string;
    description: string;
    quantity: string;
    unitPrice: string;
    lineTotal: string;
  }>;
};

type ItemDraft = { description: string; quantity: string; unitPrice: string };

export default function QuoteDetailPage() {
  const params = useParams<{ id: string }>();
  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [issueDate, setIssueDate] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([]);

  async function load() {
    const row = await api<QuoteDetail>(`/api/v1/quotes/${params.id}`);
    setQuote(row);
    setIssueDate(row.issueDate.slice(0, 10));
    setValidUntil(row.validUntil.slice(0, 10));
    setNotes(row.notes ?? '');
    setItems(
      row.items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
    );
  }

  useEffect(() => {
    if (!params.id) return;
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : 'Unable to load quote'),
    );
  }, [params.id]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!quote) return;
    try {
      await api(`/api/v1/quotes/${quote.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          issueDate,
          validUntil,
          notes,
          items: items.filter((i) => i.description && i.unitPrice),
        }),
      });
      await load();
      setEditing(false);
      setMessage('Quote updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save quote');
    }
  }

  async function convert() {
    if (!quote) return;
    try {
      const invoice = await api<{ id: string }>(`/api/v1/quotes/${quote.id}/convert`, {
        method: 'POST',
      });
      window.location.href = `/app/invoices/${invoice.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not convert quote');
    }
  }

  if (!quote) {
    return <div className="ac-page text-muted">{error ?? 'Loading quote…'}</div>;
  }

  return (
    <div className="ac-page">
      <PageHeader
        title={quote.quoteNumber ?? 'Quote'}
        description={`${quote.customer.name} · valid until ${quote.validUntil.slice(0, 10)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={quote.status} />
            <Link href="/app/quotes" className="ac-btn-secondary">
              Back
            </Link>
            {quote.status !== 'CONVERTED' ? (
              <>
                <button
                  type="button"
                  className="ac-btn-secondary"
                  onClick={() => setEditing((v) => !v)}
                >
                  {editing ? 'Cancel' : 'Edit'}
                </button>
                <a
                  className="ac-btn-secondary"
                  href={`/api/v1/quotes/${quote.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                >
                  PDF
                </a>
                <button type="button" className="ac-btn-primary" onClick={convert}>
                  Convert to invoice
                </button>
              </>
            ) : null}
          </div>
        }
      />
      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}
      {message ? <p className="mb-4 text-sm text-success">{message}</p> : null}

      {editing ? (
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
              <span className="ac-label">Valid until</span>
              <input
                className="ac-input"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </label>
          </div>
          <textarea
            className="ac-input"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes"
          />
          {items.map((item, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr]">
              <input
                className="ac-input"
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
          <button type="submit" className="ac-btn-primary">
            Save quote
          </button>
        </form>
      ) : (
        <div className="ac-card mb-6 p-5">
          <div className="divide-y divide-line text-sm">
            {quote.items.map((item) => (
              <div key={item.id} className="flex justify-between py-2">
                <span>
                  {item.description} × {item.quantity}
                </span>
                <Money amount={item.lineTotal} currency={quote.currency} />
              </div>
            ))}
          </div>
          <div className="mt-4 text-right font-semibold">
            <Money amount={quote.grandTotal} currency={quote.currency} />
          </div>
        </div>
      )}
    </div>
  );
}
