'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { PageHeader } from '@/components/ui';

type Item = {
  id: string;
  kind: string;
  severity: 'warn' | 'block';
  title: string;
  detail: string;
  href: string;
};

export default function ReviewPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ items: Item[] }>('/api/v1/review/queue')
      .then((res) => setItems(res.items))
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load review queue'),
      );
  }, []);

  return (
    <div className="ac-page">
      <PageHeader
        title="Accountant review"
        description="Drafts, unmatched bank lines, overdue balances, and compliance reminders that need a human look."
      />
      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}
      {items.length === 0 && !error ? (
        <div className="ac-card p-8 text-center text-sm text-ink-soft">
          Queue is clear — nothing urgent to review.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={`ac-card flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between ${
                item.severity === 'block' ? 'bg-danger-soft/40' : 'bg-warning-soft/40'
              }`}
            >
              <div>
                <div className="text-xs text-muted">
                  {item.kind.replaceAll('_', ' ')}
                </div>
                <div className="font-semibold text-ink">{item.title}</div>
                <p className="text-sm text-ink-soft">{item.detail}</p>
              </div>
              <Link href={item.href} className="ac-btn-secondary shrink-0 text-xs">
                Open
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
