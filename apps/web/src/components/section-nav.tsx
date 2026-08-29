'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const SALES_TABS = [
  { href: '/app/sales', label: 'Overview', exact: true },
  { href: '/app/invoices', label: 'Invoices' },
  { href: '/app/quotes', label: 'Quotes' },
  { href: '/app/customers', label: 'Customers' },
  { href: '/app/payments', label: 'Payments' },
] as const;

const PURCHASE_TABS = [
  { href: '/app/purchases', label: 'Overview', exact: true },
  { href: '/app/expense', label: 'Expenses' },
  { href: '/app/bills', label: 'Bills' },
  { href: '/app/suppliers', label: 'Suppliers' },
  { href: '/app/documents', label: 'Receipts' },
] as const;

const PAYROLL_TABS = [
  { href: '/app/people', label: 'Employees' },
  { href: '/app/payroll', label: 'Payroll runs' },
] as const;

function TabBar({
  tabs,
}: {
  tabs: ReadonlyArray<{ href: string; label: string; exact?: boolean }>;
}) {
  const pathname = usePathname();
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={clsx(
              'shrink-0 border-b-2 px-3 py-2 text-sm font-semibold transition',
              active
                ? 'border-brand text-brand'
                : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

export function SalesSectionNav() {
  return <TabBar tabs={SALES_TABS} />;
}

export function PurchasesSectionNav() {
  return <TabBar tabs={PURCHASE_TABS} />;
}

export function PayrollSectionNav() {
  return <TabBar tabs={PAYROLL_TABS} />;
}

export function sectionForPath(pathname: string): 'sales' | 'purchases' | 'payroll' | null {
  if (
    pathname.startsWith('/app/sales') ||
    pathname.startsWith('/app/invoices') ||
    pathname.startsWith('/app/quotes') ||
    pathname.startsWith('/app/customers') ||
    pathname.startsWith('/app/payments') ||
    pathname.startsWith('/app/contracts') ||
    pathname.startsWith('/app/projects')
  ) {
    return 'sales';
  }
  if (
    pathname.startsWith('/app/purchases') ||
    pathname.startsWith('/app/expense') ||
    pathname.startsWith('/app/bills') ||
    pathname.startsWith('/app/suppliers') ||
    pathname.startsWith('/app/documents') ||
    pathname.startsWith('/app/owner-money')
  ) {
    return 'purchases';
  }
  if (pathname.startsWith('/app/people') || pathname.startsWith('/app/payroll')) {
    return 'payroll';
  }
  return null;
}
