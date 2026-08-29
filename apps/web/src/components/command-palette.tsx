'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';

type Action = {
  id: string;
  label: string;
  hint: string;
  href: string;
  keywords: string;
};

const ACTIONS: Action[] = [
  {
    id: 'sales',
    label: 'Sales',
    hint: 'Invoices, quotes, customers',
    href: '/app/sales',
    keywords: 'sales invoices quotes customers payments',
  },
  {
    id: 'purchases',
    label: 'Purchases',
    hint: 'Expenses, bills, receipts',
    href: '/app/purchases',
    keywords: 'purchases expenses bills suppliers receipts',
  },
  {
    id: 'invoice',
    label: 'New invoice',
    hint: 'Bill a customer',
    href: '/app/invoices?new=1',
    keywords: 'invoice bill sales create',
  },
  {
    id: 'expense',
    label: 'Record expense',
    hint: 'Money out',
    href: '/app/expense',
    keywords: 'expense spend cost hosting',
  },
  {
    id: 'payment',
    label: 'Record payment',
    hint: 'Customer paid',
    href: '/app/payments',
    keywords: 'payment receive money',
  },
  {
    id: 'customer',
    label: 'Add customer',
    hint: 'Who you invoice',
    href: '/app/customers?new=1',
    keywords: 'customer client',
  },
  {
    id: 'quote',
    label: 'New quote',
    hint: 'Estimate before invoice',
    href: '/app/quotes?new=1',
    keywords: 'quote estimate',
  },
  {
    id: 'bill',
    label: 'New supplier bill',
    hint: 'Accounts payable',
    href: '/app/bills',
    keywords: 'bill supplier payable',
  },
  {
    id: 'owner',
    label: 'Owner money',
    hint: 'Put in or take out',
    href: '/app/owner-money',
    keywords: 'owner drawings capital',
  },
  {
    id: 'payroll',
    label: 'Payroll',
    hint: 'Pay people',
    href: '/app/payroll',
    keywords: 'payroll salary wages',
  },
  {
    id: 'people',
    label: 'People',
    hint: 'Employees',
    href: '/app/people',
    keywords: 'people employee staff',
  },
  {
    id: 'review',
    label: 'Accountant review',
    hint: 'Queue of items needing attention',
    href: '/app/review',
    keywords: 'review accountant queue draft unmatched',
  },
  {
    id: 'setup',
    label: 'Business setup',
    hint: 'Name, TIN, bank, invoices',
    href: '/app/setup',
    keywords: 'setup onboarding wizard business tin bin bank',
  },
  {
    id: 'settings',
    label: 'Settings',
    hint: 'Team, branding, invoices',
    href: '/app/settings',
    keywords: 'settings team password mode teammate logo branding invoice',
  },
  {
    id: 'branding',
    label: 'Logo & branding',
    hint: 'Upload logo and letterhead',
    href: '/app/settings?tab=branding',
    keywords: 'logo branding letterhead address phone',
  },
  {
    id: 'invoice-settings',
    label: 'Invoice customization',
    hint: 'Prefix, terms, footer',
    href: '/app/settings?tab=invoices',
    keywords: 'invoice prefix quote footer payment terms',
  },
  {
    id: 'more',
    label: 'More tools',
    hint: 'Compliance, assets, journals…',
    href: '/app/settings?tab=more',
    keywords: 'more tools compliance assets journals chart accounts audit',
  },
  {
    id: 'uploads',
    label: 'Uploads',
    hint: 'Receipts and files',
    href: '/app/settings?tab=uploads',
    keywords: 'upload receipts documents files',
  },
  {
    id: 'documents',
    label: 'Documents',
    hint: 'Receipts and files',
    href: '/app/documents',
    keywords: 'documents receipts files upload',
  },
  {
    id: 'compliance',
    label: 'BD compliance',
    hint: 'VAT, TDS, Mushak',
    href: '/app/compliance',
    keywords: 'compliance vat tds mushak bin tin',
  },
  {
    id: 'assets',
    label: 'Assets',
    hint: 'Depreciation',
    href: '/app/assets',
    keywords: 'assets depreciation fixed',
  },
  {
    id: 'month-end',
    label: 'Month-end checklist',
    hint: 'Close the books',
    href: '/app/month-end',
    keywords: 'close month period lock',
  },
  {
    id: 'reports',
    label: 'Reports',
    hint: 'P&L and balance sheet',
    href: '/app/reports',
    keywords: 'report profit loss',
  },
  {
    id: 'banking',
    label: 'Banking',
    hint: 'Import and reconcile',
    href: '/app/banking',
    keywords: 'bank reconcile import',
  },
  {
    id: 'gateway',
    label: 'Payment gateway',
    hint: 'Test checkout',
    href: '/app/gateway',
    keywords: 'gateway checkout online sslcommerz',
  },
  {
    id: 'trial',
    label: 'Trial balance',
    hint: 'Check the ledger',
    href: '/app/trial-balance',
    keywords: 'trial balance ledger',
  },
  {
    id: 'journals',
    label: 'Journals',
    hint: 'Manual ledger entries',
    href: '/app/journals',
    keywords: 'journal entry ledger accountant',
  },
];

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ACTIONS;
    return ACTIONS.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        a.hint.toLowerCase().includes(q) ||
        a.keywords.includes(q),
    );
  }, [query]);

  useEffect(() => {
    setActive(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange(!open);
      }
      if (event.key === 'Escape' && open) {
        onOpenChange(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 px-4 pt-[12vh] backdrop-blur-[2px]"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="ac-card w-full max-w-lg overflow-hidden shadow-[0_24px_60px_rgba(20,32,31,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-line px-4 py-3">
          <input
            autoFocus
            className="w-full bg-transparent text-base outline-none placeholder:text-muted"
            placeholder="Create or jump to…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, filtered.length - 1));
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              }
              if (e.key === 'Enter' && filtered[active]) {
                e.preventDefault();
                go(filtered[active].href);
              }
            }}
          />
        </div>
        <div className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">No matches</p>
          ) : (
            filtered.map((action, index) => (
              <button
                key={action.id}
                type="button"
                className={clsx(
                  'flex w-full items-center justify-between px-4 py-2.5 text-left text-sm',
                  index === active ? 'bg-brand-soft' : 'hover:bg-paper',
                )}
                onMouseEnter={() => setActive(index)}
                onClick={() => go(action.href)}
              >
                <span className="font-semibold text-ink">{action.label}</span>
                <span className="text-xs text-muted">{action.hint}</span>
              </button>
            ))
          )}
        </div>
        <div className="border-t border-line px-4 py-2 text-[11px] text-muted">
          ↑↓ navigate · Enter open · Esc close · ⌘K toggle
        </div>
      </div>
    </div>
  );
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  return { open, setOpen };
}
