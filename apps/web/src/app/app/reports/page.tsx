'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { fiscalYearRange, reportQuery, type OrgFiscalSettings } from '@/lib/date-range';
import { Money, PageHeader, StatusBadge, TabPills } from '@/components/ui';

type Tab =
  | 'pnl'
  | 'bs'
  | 'cash'
  | 'ar'
  | 'ap'
  | 'gl'
  | 'revenue'
  | 'expense'
  | 'related'
  | 'export'
  | 'projects';

const TAB_PATHS: Record<Tab, string> = {
  pnl: '/api/v1/reports/profit-and-loss',
  bs: '/api/v1/reports/balance-sheet',
  cash: '/api/v1/reports/cash-flow',
  ar: '/api/v1/reports/ar-aging',
  ap: '/api/v1/reports/ap-aging',
  gl: '/api/v1/reports/general-ledger',
  revenue: '/api/v1/reports/revenue-by-customer',
  expense: '/api/v1/reports/expense-by-category',
  related: '/api/v1/reports/related-party',
  export: '/api/v1/reports/export-revenue',
  projects: '/api/v1/reports/project-profitability',
};

function ReportsClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initial = (searchParams.get('tab') as Tab) || 'pnl';
  const accountCode = searchParams.get('accountCode') ?? undefined;
  const urlFrom = searchParams.get('from') ?? undefined;
  const urlTo = searchParams.get('to') ?? undefined;
  const [tab, setTab] = useState<Tab>(
    ['pnl', 'bs', 'cash', 'ar', 'ap', 'gl', 'revenue', 'expense', 'related', 'export', 'projects'].includes(
      initial,
    )
      ? initial
      : 'pnl',
  );
  const [from, setFrom] = useState(urlFrom ?? '');
  const [to, setTo] = useState(urlTo ?? '');
  const [rangeReady, setRangeReady] = useState(Boolean(urlFrom && urlTo));
  const [data, setData] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (urlFrom && urlTo) {
      setFrom(urlFrom);
      setTo(urlTo);
      setRangeReady(true);
      return;
    }
    api<OrgFiscalSettings>('/api/v1/organizations/current')
      .then((org) => {
        const range = fiscalYearRange(org);
        setFrom(range.from);
        setTo(range.to);
        setRangeReady(true);
      })
      .catch(() => {
        const now = new Date();
        const y = now.getFullYear();
        setFrom(`${y}-01-01`);
        setTo(now.toISOString().slice(0, 10));
        setRangeReady(true);
      });
  }, [urlFrom, urlTo]);

  const dateQuery = useMemo(() => {
    if (!from || !to) return '';
    return reportQuery(from, to);
  }, [from, to]);

  useEffect(() => {
    if (!rangeReady || !dateQuery) return;
    setData(null);
    setError(null);
    let cancelled = false;
    let path = TAB_PATHS[tab];
    if (tab === 'gl' && accountCode) {
      path = `${TAB_PATHS.gl}${reportQuery(from, to, { accountCode })}`;
    } else if (tab === 'bs') {
      path = `${TAB_PATHS.bs}?to=${encodeURIComponent(to)}`;
    } else if (['ar', 'ap'].includes(tab)) {
      path = `${TAB_PATHS[tab]}?to=${encodeURIComponent(to)}`;
    } else if (['pnl', 'cash', 'revenue', 'expense', 'related', 'export', 'projects'].includes(tab)) {
      path = `${TAB_PATHS[tab]}${dateQuery}`;
    }
    api(path)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Unable to load report');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tab, accountCode, dateQuery, rangeReady, from, to]);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'pnl', label: 'Profit & Loss' },
    { id: 'bs', label: 'Balance Sheet' },
    { id: 'cash', label: 'Cash flow' },
    { id: 'ar', label: 'AR aging' },
    { id: 'ap', label: 'AP aging' },
    { id: 'gl', label: 'General ledger' },
    { id: 'revenue', label: 'Revenue by customer' },
    { id: 'expense', label: 'Expense by category' },
    { id: 'related', label: 'Related party' },
    { id: 'export', label: 'Export revenue' },
    { id: 'projects', label: 'Project profitability' },
  ];

  function selectTab(next: Tab) {
    setError(null);
    setTab(next);
    const params = new URLSearchParams();
    params.set('tab', next);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    router.replace(`/app/reports?${params.toString()}`);
  }

  function applyRange() {
    const params = new URLSearchParams();
    params.set('tab', tab);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (tab === 'gl' && accountCode) params.set('accountCode', accountCode);
    router.replace(`/app/reports?${params.toString()}`);
  }

  return (
    <div className="ac-page">
      <PageHeader
        eyebrow="Financial statements"
        title="Reports"
        description="Financial statements and operational views. Amounts in BDT base where converted."
      />

      <div className="ac-sticky-bar">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="block text-sm">
            <span className="ac-label">From</span>
            <input
              className="ac-input"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="ac-label">To</span>
            <input
              className="ac-input"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <button type="button" className="ac-btn-primary" onClick={applyRange}>
            Run report
          </button>
          <p className="text-xs text-muted sm:ml-auto sm:self-center">
            Defaults to current fiscal year · AR/AP use &quot;To&quot; as as-of date
          </p>
        </div>
      </div>

      <div className="mb-6 overflow-x-auto pb-1">
        <TabPills tabs={tabs} active={tab} onSelect={selectTab} />
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {!data && !error ? <p className="text-muted">Loading…</p> : null}
      {data ? <ReportBody tab={tab} data={data} from={from} to={to} onOpenGl={(code) => {
        setTab('gl');
        const params = new URLSearchParams({ tab: 'gl', accountCode: code });
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        router.replace(`/app/reports?${params.toString()}`);
      }} /> : null}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="ac-page">Loading…</div>}>
      <ReportsClient />
    </Suspense>
  );
}

function asRows<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function ReportBody({
  tab,
  data,
  from,
  to,
  onOpenGl,
}: {
  tab: Tab;
  data: unknown;
  from: string;
  to: string;
  onOpenGl: (code: string) => void;
}) {
  if (tab === 'pnl') {
    const d = data as {
      from?: string | null;
      to?: string | null;
      totalRevenue: string;
      totalExpenses: string;
      netProfit: string;
      revenue?: Array<{ code: string; name: string; amount: string; href?: string }>;
      expenses?: Array<{ code: string; name: string; amount: string; href?: string }>;
    };
    const revenue = asRows(d.revenue);
    const expenses = asRows(d.expenses);
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {(from || d.from || to || d.to) ? (
          <p className="text-sm text-muted lg:col-span-2">
            Period: {from || d.from || '—'} to {to || d.to || '—'}
          </p>
        ) : null}
        <div className="ac-card p-5">
          <h2 className="font-display text-lg font-semibold">Revenue</h2>
          {revenue.map((r) => (
            <Row
              key={r.code}
              label={`${r.code} ${r.name}`}
              amount={r.amount}
              href={r.href}
              onCodeClick={() => onOpenGl(r.code)}
            />
          ))}
          <Row label="Total revenue" amount={d.totalRevenue ?? '0.00'} bold />
        </div>
        <div className="ac-card p-5">
          <h2 className="font-display text-lg font-semibold">Expenses</h2>
          {expenses.map((r) => (
            <Row
              key={r.code}
              label={`${r.code} ${r.name}`}
              amount={r.amount}
              href={r.href}
              onCodeClick={() => onOpenGl(r.code)}
            />
          ))}
          <Row label="Total expenses" amount={d.totalExpenses ?? '0.00'} bold />
          <Row label="Net profit" amount={d.netProfit ?? '0.00'} bold />
        </div>
      </div>
    );
  }

  if (tab === 'bs') {
    const d = data as {
      assets?: Array<{ code: string; name: string; amount: string; href?: string }>;
      liabilities?: Array<{ code: string; name: string; amount: string; href?: string }>;
      equity?: Array<{ code: string; name: string; amount: string; href?: string }>;
      totalAssets: string;
      totalLiabilitiesAndEquity: string;
      balanced: boolean;
    };
    const assets = asRows(d.assets);
    const liabilities = asRows(d.liabilities);
    const equity = asRows(d.equity);
    return (
      <div className="space-y-4">
        <p className={d.balanced ? 'text-sm text-success' : 'text-sm text-danger'}>
          {d.balanced ? 'Balance sheet balances' : 'Out of balance'}
        </p>
        <div className="grid gap-4 lg:grid-cols-3">
          <Sheet title="Assets" rows={assets} total={d.totalAssets} onOpenGl={onOpenGl} />
          <Sheet title="Liabilities" rows={liabilities} onOpenGl={onOpenGl} />
          <Sheet
            title="Equity"
            rows={equity}
            total={d.totalLiabilitiesAndEquity}
            onOpenGl={onOpenGl}
          />
        </div>
      </div>
    );
  }

  if (tab === 'cash') {
    const d = data as {
      operating: {
        netIncome: string;
        adjustments?: Array<{ label: string; amount: string; href?: string }>;
        total: string;
      };
      investing: { rows?: Array<{ label: string; amount: string; href?: string }>; total: string };
      financing: { rows?: Array<{ label: string; amount: string; href?: string }>; total: string };
      netChangeInCash: string;
      cashAccountMovement: string;
      note: string;
    };
    const operatingAdjustments = asRows(d.operating?.adjustments);
    const investingRows = asRows(d.investing?.rows);
    const financingRows = asRows(d.financing?.rows);
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">{d.note}</p>
        <div className="ac-card p-5">
          <h2 className="font-display text-lg font-semibold">Operating</h2>
          <Row label="Net income" amount={d.operating?.netIncome ?? '0.00'} bold />
          {operatingAdjustments.map((r) => (
            <Row key={r.label} label={r.label} amount={r.amount} href={r.href} />
          ))}
          <Row label="Cash from operations" amount={d.operating?.total ?? '0.00'} bold />
        </div>
        <div className="ac-card p-5">
          <h2 className="font-display text-lg font-semibold">Investing</h2>
          {investingRows.map((r) => (
            <Row key={r.label} label={r.label} amount={r.amount} href={r.href} />
          ))}
          <Row label="Total investing" amount={d.investing?.total ?? '0.00'} bold />
        </div>
        <div className="ac-card p-5">
          <h2 className="font-display text-lg font-semibold">Financing</h2>
          {financingRows.map((r) => (
            <Row key={r.label} label={r.label} amount={r.amount} href={r.href} />
          ))}
          <Row label="Total financing" amount={d.financing?.total ?? '0.00'} bold />
        </div>
        <div className="ac-card p-5">
          <Row label="Net change in cash (derived)" amount={d.netChangeInCash} bold />
          <Row label="Cash account movement (11xx)" amount={d.cashAccountMovement} />
        </div>
      </div>
    );
  }

  if (tab === 'ar' || tab === 'ap') {
    const rows = asRows(data as Array<Record<string, string | number>> | null | undefined);
    return (
      <div className="ac-table-wrap">
        <table className="ac-table ac-table-zebra">
          <thead>
            <tr>
              <th>{tab === 'ar' ? 'Invoice' : 'Bill'}</th>
              <th>{tab === 'ar' ? 'Customer' : 'Supplier'}</th>
              <th>Due</th>
              <th>Bucket</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)}>
                <td className="font-mono text-xs">
                  {r.href ? (
                    <Link href={String(r.href)} className="text-brand hover:underline">
                      {String(r.invoiceNumber ?? r.billNumber ?? '')}
                    </Link>
                  ) : (
                    String(r.invoiceNumber ?? r.billNumber ?? '')
                  )}
                </td>
                <td>{String(r.customer ?? r.supplier)}</td>
                <td>{String(r.dueDate).slice(0, 10)}</td>
                <td>{String(r.bucket)}</td>
                <td className="text-right">
                  <Money amount={String(r.amountDue)} currency={String(r.currency)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="p-6 text-sm text-muted">Nothing outstanding.</p> : null}
      </div>
    );
  }

  if (tab === 'gl') {
    const rows = asRows(data as Array<Record<string, string>> | null | undefined);
    return (
      <div className="ac-table-wrap">
        <table className="ac-table ac-table-zebra">
          <thead>
            <tr>
              <th>Date</th>
              <th>Journal</th>
              <th>Account</th>
              <th>Description</th>
              <th className="text-right">Debit</th>
              <th className="text-right">Credit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{String(r.date).slice(0, 10)}</td>
                <td className="font-mono text-xs">
                  <Link href="/app/journals" className="text-brand hover:underline">
                    {r.journalNumber}
                  </Link>
                </td>
                <td>
                  <button
                    type="button"
                    className="text-left text-brand hover:underline"
                    onClick={() => onOpenGl(r.accountCode ?? '')}
                  >
                    {r.accountCode} {r.accountName}
                  </button>
                </td>
                <td>{r.description}</td>
                <td className="text-right">
                  <Money amount={r.debit ?? '0'} />
                </td>
                <td className="text-right">
                  <Money amount={r.credit ?? '0'} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (tab === 'related') {
    const d = data as {
      rows?: Array<{
        customerId: string;
        customer: string;
        billedBdt: string;
        receivedBdt: string;
        openAr: string;
        relatedContracts: number;
        href: string;
      }>;
      totalOpenAr: string;
    };
    const rows = asRows(d.rows);
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink-soft">
          Open AR with related parties: <Money amount={d.totalOpenAr ?? '0.00'} />
        </p>
        <div className="ac-table-wrap">
          <table className="ac-table ac-table-zebra">
            <thead>
              <tr>
                <th>Customer</th>
                <th className="text-right">Billed (BDT)</th>
                <th className="text-right">Received (BDT)</th>
                <th className="text-right">Open AR</th>
                <th>Contracts</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.customerId}>
                  <td>
                    <Link href={r.href} className="font-medium text-brand hover:underline">
                      {r.customer}
                    </Link>
                  </td>
                  <td className="text-right">
                    <Money amount={r.billedBdt} />
                  </td>
                  <td className="text-right">
                    <Money amount={r.receivedBdt} />
                  </td>
                  <td className="text-right">
                    <Money amount={r.openAr} />
                  </td>
                  <td>{r.relatedContracts}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-muted">No related-party customers.</p>
          ) : null}
        </div>
      </div>
    );
  }

  if (tab === 'export') {
    const d = data as {
      exportLedgerAccount: { code: string; name: string; amount: string; href: string };
      foreignCurrencyInvoices?: Array<{
        id: string;
        invoiceNumber: string | null;
        customer: string;
        currency: string;
        originalAmount: string;
        bdtAmount: string;
        status: string;
        href: string;
      }>;
      foreignTotalBdt: string;
      note: string;
    };
    const foreignCurrencyInvoices = asRows(d.foreignCurrencyInvoices);
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">{d.note}</p>
        <div className="ac-card p-5">
          <Row
            label={`${d.exportLedgerAccount.code} ${d.exportLedgerAccount.name}`}
            amount={d.exportLedgerAccount.amount}
            href={d.exportLedgerAccount.href}
            onCodeClick={() => onOpenGl('4600')}
            bold
          />
          <Row label="Foreign-currency invoices (BDT)" amount={d.foreignTotalBdt} />
        </div>
        <div className="ac-table-wrap">
          <table className="ac-table ac-table-zebra">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Currency</th>
                <th className="text-right">Original</th>
                <th className="text-right">BDT</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {foreignCurrencyInvoices.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono text-xs">
                    <Link href={r.href} className="text-brand hover:underline">
                      {r.invoiceNumber ?? '—'}
                    </Link>
                  </td>
                  <td>{r.customer}</td>
                  <td>{r.currency}</td>
                  <td className="text-right">
                    <Money amount={r.originalAmount} currency={r.currency} />
                  </td>
                  <td className="text-right">
                    <Money amount={r.bdtAmount} />
                  </td>
                  <td>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {foreignCurrencyInvoices.length === 0 ? (
            <p className="p-6 text-sm text-muted">No foreign-currency invoices yet.</p>
          ) : null}
        </div>
      </div>
    );
  }

  if (tab === 'projects') {
    const d = data as {
      rows?: Array<{
        projectId: string | null;
        project: string;
        hours: string;
        billableValue: string;
        people?: Array<{ person: string; hours: string; billableValue: string }>;
      }>;
      totals: { hours: string; billableValue: string };
    };
    const rows = asRows(d.rows);
    return (
      <div className="space-y-4">
        <div className="ac-card p-5">
          <Row label="Total hours" amount={d.totals?.hours ?? '0.00'} />
          <Row label="Billable value" amount={d.totals?.billableValue ?? '0.00'} bold />
        </div>
        <div className="ac-table-wrap">
          <table className="ac-table ac-table-zebra">
            <thead>
              <tr>
                <th>Project</th>
                <th className="text-right">Hours</th>
                <th className="text-right">Billable value</th>
                <th>People</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.projectId ?? r.project}>
                  <td className="font-medium">{r.project}</td>
                  <td className="text-right font-mono">{r.hours}</td>
                  <td className="text-right">
                    <Money amount={r.billableValue} />
                  </td>
                  <td className="text-xs text-muted">
                    {asRows(r.people)
                      .map((p) => `${p.person} (${p.hours}h)`)
                      .join(' · ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-muted">No time entries yet.</p>
          ) : null}
        </div>
      </div>
    );
  }

  const rows = asRows(data as Array<Record<string, string>> | null | undefined);
  return (
    <div className="ac-table-wrap">
      <table className="ac-table ac-table-zebra">
        <thead>
          <tr>
            <th>{tab === 'revenue' ? 'Customer' : 'Category'}</th>
            <th className="text-right">Amount (BDT)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>
                {r.href ? (
                  <Link href={r.href} className="text-brand hover:underline">
                    {r.customer ?? r.category}
                  </Link>
                ) : (
                  r.customer ?? r.category
                )}
              </td>
              <td className="text-right">
                <Money amount={r.revenueBdt ?? r.amountBdt ?? '0'} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({
  label,
  amount,
  bold,
  href,
  onCodeClick,
}: {
  label: string;
  amount: string;
  bold?: boolean;
  href?: string;
  onCodeClick?: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-between border-b border-line py-2 text-sm ${
        bold ? 'font-semibold' : ''
      }`}
    >
      {href || onCodeClick ? (
        <button
          type="button"
          className="text-left text-brand hover:underline"
          onClick={() => {
            if (onCodeClick) onCodeClick();
            else if (href) window.location.href = href;
          }}
        >
          {label}
        </button>
      ) : (
        <span>{label}</span>
      )}
      <Money amount={amount} />
    </div>
  );
}

function Sheet({
  title,
  rows = [],
  total,
  onOpenGl,
}: {
  title: string;
  rows?: Array<{ code: string; name: string; amount: string; href?: string }>;
  total?: string;
  onOpenGl: (code: string) => void;
}) {
  const safeRows = asRows(rows);
  return (
    <div className="ac-card p-5">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {safeRows.map((r) => (
        <Row
          key={r.code}
          label={`${r.code} ${r.name}`}
          amount={r.amount}
          href={r.href}
          onCodeClick={r.code !== 'PL' ? () => onOpenGl(r.code) : undefined}
        />
      ))}
      {total ? <Row label="Total" amount={total} bold /> : null}
    </div>
  );
}
