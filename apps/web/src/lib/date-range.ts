export type OrgFiscalSettings = {
  fiscalYearStartMonth?: number;
  fiscalYearStartDay?: number;
};

export function fiscalYearRange(settings?: OrgFiscalSettings, ref = new Date()) {
  const startMonth = (settings?.fiscalYearStartMonth ?? 7) - 1;
  const startDay = settings?.fiscalYearStartDay ?? 1;
  const year =
    ref.getMonth() > startMonth ||
    (ref.getMonth() === startMonth && ref.getDate() >= startDay)
      ? ref.getFullYear()
      : ref.getFullYear() - 1;
  const from = new Date(year, startMonth, startDay);
  const to = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

export function yearToDateRange(ref = new Date()) {
  const from = new Date(ref.getFullYear(), 0, 1);
  const to = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

export function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function reportQuery(from: string, to: string, extra?: Record<string, string>) {
  const params = new URLSearchParams({ from, to, ...extra });
  return `?${params.toString()}`;
}
