'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { DashboardCharts } from '@/components/dashboard-charts';
import {
  AlertCard,
  EmptyState,
  Money,
  PageHeader,
  QuickActionTile,
  StatCard,
} from '@/components/ui';

type Dashboard = {
  revenue: string;
  expenses: string;
  operatingProfit: string;
  cash: string;
  moneyOwedToUs: string;
  moneyOwedToSuppliers: string;
  overdueInvoices: number;
  needsAttention: string[];
};

type DashboardChartsData = {
  monthlyTrend: Array<{
    month: string;
    label: string;
    revenue: string;
    expenses: string;
    profit: string;
  }>;
  arBuckets: Record<string, string>;
  apBuckets: Record<string, string>;
};

type Me = {
  user: { name: string };
  currentOrganization?: { setupCompletedAt?: string | null } | null;
};

type MonthEndSummary = {
  period: { name: string; status: string };
  summary: { blockers: number; warnings: number; readyToLock: boolean };
};

type AttentionItem = {
  key: string;
  label: string;
  href: string;
};

const QUICK_ICONS = {
  monthEnd: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M4.5 8.25h15M4.5 19.5A2.25 2.25 0 006.75 21.75h10.5A2.25 2.25 0 0019.5 19.5V8.25H4.5v11.25z" />
    </svg>
  ),
  payment: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  ),
  quote: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
};

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [charts, setCharts] = useState<DashboardChartsData | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [monthEnd, setMonthEnd] = useState<MonthEndSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<Dashboard>('/api/v1/dashboard'),
      api<DashboardChartsData>('/api/v1/reports/dashboard').catch(() => null),
      api<Me>('/api/v1/me'),
      api<MonthEndSummary>('/api/v1/month-end').catch(() => null),
    ])
      .then(([dash, chartData, profile, meCheck]) => {
        setData(dash);
        setCharts(chartData);
        setMe(profile);
        setMonthEnd(meCheck);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load dashboard'),
      );
  }, []);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const setupNeeded = me && !me.currentOrganization?.setupCompletedAt;
  const periodLabel = new Date().toLocaleString('en-GB', {
    month: 'long',
    year: 'numeric',
  });

  const attentionItems = useMemo<AttentionItem[]>(() => {
    if (!data) return [];

    const items: AttentionItem[] = [];

    if (data.overdueInvoices > 0) {
      items.push({
        key: 'overdue-invoices',
        label: `Follow up on ${data.overdueInvoices} overdue invoice${data.overdueInvoices > 1 ? 's' : ''}`,
        href: '/app/invoices',
      });
    }

    if (monthEnd && monthEnd.period.status !== 'LOCKED') {
      items.push({
        key: 'month-end',
        label: monthEnd.summary.readyToLock
          ? `Month-end · ${monthEnd.period.name} — ready to lock`
          : `Month-end · ${monthEnd.period.name} — ${monthEnd.summary.blockers} blocker(s), ${monthEnd.summary.warnings} warning(s)`,
        href: '/app/month-end',
      });
    }

    for (const item of data.needsAttention) {
      if (!item.toLowerCase().includes('overdue invoice')) {
        items.push({
          key: `needs-${item}`,
          label: item,
          href: '/app/review',
        });
      }
    }

    return items;
  }, [data, monthEnd]);

  if (error) {
    return (
      <div className="ac-page">
        <p className="text-danger">{error}</p>
        <Link href="/login" className="ac-btn-primary mt-4">
          Sign in
        </Link>
      </div>
    );
  }

  const isEmpty =
    data && Number(data.revenue) === 0 && Number(data.expenses) === 0;

  const profitPositive = data ? Number(data.operatingProfit) >= 0 : true;

  return (
    <div className="ac-page">
      <PageHeader
        eyebrow={periodLabel}
        title={`${greeting}${me ? `, ${me.user.name.split(' ')[0]}` : ''}`}
        description="Key balances, actions, and trends — each shown once."
        actions={
          <>
            <Link href="/app/invoices?new=1" className="ac-btn-primary">
              Create invoice
            </Link>
            <Link href="/app/expense" className="ac-btn-secondary">
              Record expense
            </Link>
          </>
        }
      />

      {!data ? (
        <div className="flex items-center gap-3 text-muted">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand/20 border-t-brand" />
          Loading dashboard…
        </div>
      ) : (
        <>
          {setupNeeded ? (
            <div className="mb-6">
              <AlertCard
                variant="info"
                title="Finish setup"
                action={
                  <Link href="/app/setup" className="ac-btn-primary ac-btn-sm shrink-0">
                    Continue setup
                  </Link>
                }
              >
                Confirm business name, TIN/BIN, bank, and invoice defaults.
              </AlertCard>
            </div>
          ) : null}

          {isEmpty ? (
            <div className="mb-8">
              <EmptyState
                title="Get money moving"
                description="Add a customer → create an invoice → record payment. Or log an expense you already paid."
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Link href="/app/customers?new=1" className="ac-btn-primary">
                      Add customer
                    </Link>
                    <Link href="/app/invoices?new=1" className="ac-btn-secondary">
                      Create invoice
                    </Link>
                    <Link href="/app/expense" className="ac-btn-ghost">
                      Record expense
                    </Link>
                  </div>
                }
              />
            </div>
          ) : null}

          <div className="ac-kpi-grid">
            <StatCard
              className="ac-kpi-profit"
              label={`Profit · ${periodLabel}`}
              value={<Money amount={data.operatingProfit} truncate={false} />}
              hint={
                <div className="space-y-0.5">
                  <p>
                    Income <Money amount={data.revenue} truncate={false} />
                  </p>
                  <p>
                    Expenses <Money amount={data.expenses} truncate={false} />
                  </p>
                </div>
              }
              href="/app/reports?tab=pnl"
              trend={
                profitPositive
                  ? { label: 'Operating profit', positive: true }
                  : { label: 'Operating loss', positive: false }
              }
            />
            <StatCard
              className="ac-kpi-cash"
              label="Cash & bank"
              value={<Money amount={data.cash} truncate={false} />}
              hint="Available balance across bank accounts"
              href="/app/banking"
            />
            <StatCard
              className="ac-kpi-receivables"
              label="Customers owe you"
              value={<Money amount={data.moneyOwedToUs} truncate={false} />}
              hint="Outstanding receivables"
              href="/app/sales"
              trend={
                data.overdueInvoices > 0
                  ? { label: `${data.overdueInvoices} overdue`, positive: false }
                  : undefined
              }
            />
            <StatCard
              className="ac-kpi-payables"
              label="You owe suppliers"
              value={<Money amount={data.moneyOwedToSuppliers} truncate={false} />}
              hint="Open bills to pay"
              href="/app/purchases"
              trend={
                Number(data.moneyOwedToSuppliers) > 0
                  ? { label: 'Bills to pay', positive: false }
                  : { label: 'All clear', positive: true }
              }
            />
          </div>

          <div className="mt-6">
            <div className="ac-card ac-card-body">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-medium text-ink">Needs attention</h2>
                  <p className="mt-0.5 text-xs text-muted">Items that need your action</p>
                </div>
                {attentionItems.length > 0 ? (
                  <span className="ac-badge-warning">{attentionItems.length}</span>
                ) : null}
              </div>
              {attentionItems.length === 0 ? (
                <p className="text-sm text-muted">You&apos;re all caught up — nothing needs action right now.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {attentionItems.map((item) => (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        className="flex items-center gap-3 py-3 text-sm transition hover:text-ink"
                      >
                        <span className="flex-1 text-ink-soft">{item.label}</span>
                        <svg className="h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {charts ? (
            <DashboardCharts
              monthlyTrend={charts.monthlyTrend}
              arBuckets={charts.arBuckets}
              apBuckets={charts.apBuckets}
            />
          ) : null}

          <div className="mt-10">
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <h2 className="text-base font-semibold text-ink">Quick actions</h2>
              <p className="text-xs text-muted">
                <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
                {' '}command palette
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <QuickActionTile href="/app/month-end" label="Month-end" area="Close the books" icon={QUICK_ICONS.monthEnd} />
              <QuickActionTile href="/app/payments" label="Record payment" area="Apply to invoices" icon={QUICK_ICONS.payment} />
              <QuickActionTile href="/app/quotes?new=1" label="Create quote" area="Send before invoicing" icon={QUICK_ICONS.quote} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
