'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { COLOR_SCHEME_EVENT, resolveColorScheme, type ColorSchemePreference } from '@/lib/theme';

type MonthlyPoint = {
  month: string;
  label: string;
  revenue: string;
  expenses: string;
  profit: string;
};

type DashboardChartsProps = {
  monthlyTrend: MonthlyPoint[];
  arBuckets: Record<string, string>;
  apBuckets: Record<string, string>;
};

function toNum(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatBdt(value: number) {
  return `৳${value.toLocaleString('en-BD', { maximumFractionDigits: 0 })}`;
}

function agingData(buckets: Record<string, string>) {
  return [
    { name: 'Current', amount: toNum(buckets.current ?? '0') },
    { name: '1–30', amount: toNum(buckets['1-30'] ?? '0') },
    { name: '31–60', amount: toNum(buckets['31-60'] ?? '0') },
    { name: '61–90', amount: toNum(buckets['61-90'] ?? '0') },
    { name: '90+', amount: toNum(buckets['90+'] ?? '0') },
  ];
}

const LIGHT_CHART_COLORS = {
  revenue: '#0047ff',
  expenses: '#a3a3a3',
  profit: '#8e24ff',
  receivable: '#00b4ff',
  payable: '#737373',
  grid: '#f5f5f5',
  axis: '#a3a3a3',
  tooltipBg: '#ffffff',
  tooltipBorder: '#e5e5e5',
};

const DARK_CHART_COLORS = {
  revenue: '#7d89ff',
  expenses: '#858a99',
  profit: '#bd20ff',
  receivable: '#00b7ff',
  payable: '#667085',
  grid: 'rgba(255, 255, 255, 0.06)',
  axis: '#a1a1aa',
  tooltipBg: '#111113',
  tooltipBorder: 'rgba(255, 255, 255, 0.09)',
};

function useChartTheme() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    function sync() {
      setIsDark(document.documentElement.classList.contains('dark'));
    }

    sync();

    function onColorScheme(event: Event) {
      const detail = (event as CustomEvent<ColorSchemePreference>).detail;
      if (detail) {
        setIsDark(resolveColorScheme(detail) === 'dark');
        return;
      }
      sync();
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onMedia = () => sync();

    window.addEventListener(COLOR_SCHEME_EVENT, onColorScheme);
    media.addEventListener('change', onMedia);
    return () => {
      window.removeEventListener(COLOR_SCHEME_EVENT, onColorScheme);
      media.removeEventListener('change', onMedia);
    };
  }, []);

  return useMemo(() => {
    const colors = isDark ? DARK_CHART_COLORS : LIGHT_CHART_COLORS;
    const tooltipStyle = {
      borderRadius: 6,
      border: `1px solid ${colors.tooltipBorder}`,
      fontSize: 12,
      boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.45)' : '0 1px 3px rgba(0,0,0,0.06)',
      padding: '8px 12px',
      background: colors.tooltipBg,
      color: isDark ? '#f5f5f3' : '#0a0a0a',
    };
    return { colors, tooltipStyle };
  }, [isDark]);
}

function ChartCard({
  title,
  subtitle,
  legend,
  children,
}: {
  title: string;
  subtitle: string;
  legend?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="ac-card ac-card-body min-w-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="ac-section-title">{title}</h3>
          <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
        </div>
        {legend}
      </div>
      <div className="mt-4 h-64">{children}</div>
    </div>
  );
}

export function DashboardCharts({ monthlyTrend, arBuckets, apBuckets }: DashboardChartsProps) {
  const { colors: CHART_COLORS, tooltipStyle } = useChartTheme();

  const trendData = monthlyTrend.map((m) => ({
    label: m.label,
    revenue: toNum(m.revenue),
    expenses: toNum(m.expenses),
    profit: toNum(m.profit),
  }));

  const arAgingData = agingData(arBuckets);
  const apAgingData = agingData(apBuckets);

  return (
    <div className="mt-10 space-y-6">
      <div>
        <h2 className="text-base font-semibold text-ink">Trends</h2>
        <p className="mt-0.5 text-sm text-muted">Last 6 months · BDT</p>
      </div>

      <div className="ac-trends-grid">
        <ChartCard
          title="Money in vs out"
          subtitle="Monthly revenue and expenses"
          legend={
            <div className="flex shrink-0 gap-4 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS.revenue }} />
                In
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS.expenses }} />
                Out
              </span>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={6}>
              <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART_COLORS.axis }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: CHART_COLORS.axis }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatBdt(v)}
                width={72}
              />
              <Tooltip formatter={(value) => formatBdt(Number(value ?? 0))} contentStyle={tooltipStyle} />
              <Bar dataKey="revenue" name="Money in" fill={CHART_COLORS.revenue} radius={[3, 3, 0, 0]} maxBarSize={28} />
              <Bar dataKey="expenses" name="Money out" fill={CHART_COLORS.expenses} radius={[3, 3, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Profit trend" subtitle="Operating profit by month">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART_COLORS.axis }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: CHART_COLORS.axis }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatBdt(v)}
                width={72}
              />
              <Tooltip formatter={(value) => formatBdt(Number(value ?? 0))} contentStyle={tooltipStyle} />
              <Line
                type="monotone"
                dataKey="profit"
                name="Profit"
                stroke={CHART_COLORS.profit}
                strokeWidth={2}
                dot={{ r: 3, fill: CHART_COLORS.profit, strokeWidth: 0 }}
                activeDot={{ r: 4, fill: CHART_COLORS.profit, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Receivables aging" subtitle="Outstanding by due-date bucket">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={arAgingData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: CHART_COLORS.axis }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: CHART_COLORS.axis }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatBdt(v)}
                width={72}
              />
              <Tooltip formatter={(value) => formatBdt(Number(value ?? 0))} contentStyle={tooltipStyle} />
              <Bar dataKey="amount" name="Receivable" fill={CHART_COLORS.receivable} radius={[3, 3, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Payables aging" subtitle="Open bills by due-date bucket">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={apAgingData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: CHART_COLORS.axis }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: CHART_COLORS.axis }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatBdt(v)}
                width={72}
              />
              <Tooltip formatter={(value) => formatBdt(Number(value ?? 0))} contentStyle={tooltipStyle} />
              <Bar dataKey="amount" name="Payable" fill={CHART_COLORS.payable} radius={[3, 3, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
