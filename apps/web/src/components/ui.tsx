'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ReactNode, Suspense, useEffect, useState } from 'react';
import clsx from 'clsx';
import { CommandPalette } from '@/components/command-palette';
import { sectionForPath } from '@/components/section-nav';
import {
  parseSettingsTab,
  SETTINGS_SECTIONS,
  SettingsSidebarNav,
  settingsHref,
} from '@/components/settings-nav';
import { AvyroIcon, PoweredByAvyro } from '@/components/avyro-brand';
import { SignOutButton } from '@/components/sign-out-button';

function OrgMark({
  hasLogo,
  logoBust,
  className = 'h-10 w-10',
}: {
  hasLogo?: boolean;
  logoBust?: number;
  className?: string;
}) {
  if (hasLogo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/v1/organizations/current/logo?v=${logoBust ?? 1}`}
        alt=""
        className={`rounded-lg border border-line/80 object-contain shadow-sm ${className}`}
      />
    );
  }

  return <AvyroIcon className={className} />;
}

type NavItem = {
  href: string;
  label: string;
  exact?: boolean;
  minRole?: 'EMPLOYEE' | 'MANAGER' | 'ACCOUNTANT' | 'OWNER' | 'AUDITOR';
  icon?: ReactNode;
};

const ROLE_RANK: Record<string, number> = {
  AUDITOR: 1,
  EMPLOYEE: 2,
  MANAGER: 3,
  ACCOUNTANT: 4,
  OWNER: 5,
};

function roleAtLeast(role: string | undefined, min: NavItem['minRole']) {
  if (!min) return true;
  if (!role) return false;
  if (role === 'AUDITOR') return min === 'AUDITOR';
  return (ROLE_RANK[role] ?? 0) >= (ROLE_RANK[min] ?? 99);
}

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    dashboard: (
      <svg className="h-4 w-4 shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
    review: (
      <svg className="h-4 w-4 shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    sales: (
      <svg className="h-4 w-4 shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 0v-.375c0-.621.504-1.125 1.125-1.125h20.25M12 10.5h.008v.008H12V10.5zm0 3h.008v.008H12V13.5z" />
      </svg>
    ),
    purchases: (
      <svg className="h-4 w-4 shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    ),
    banking: (
      <svg className="h-4 w-4 shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
      </svg>
    ),
    payroll: (
      <svg className="h-4 w-4 shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    people: (
      <svg className="h-4 w-4 shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
    reports: (
      <svg className="h-4 w-4 shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    audit: (
      <svg className="h-4 w-4 shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
    settings: (
      <svg className="h-4 w-4 shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  };
  return paths[name] ?? null;
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item);
  return (
    <Link
      href={item.href}
      className={active ? 'ac-nav-link-active' : 'ac-nav-link-inactive'}
    >
      {item.icon}
      {item.label}
    </Link>
  );
}

function SettingsShellSidebar({
  orgName,
  hasLogo,
  logoBust,
}: {
  orgName?: string;
  hasLogo?: boolean;
  logoBust?: number;
}) {
  return (
    <aside className="ac-sidebar hidden lg:flex lg:flex-col">
      <div className="border-b border-line px-4 py-5">
        <Link
          href="/app"
          className="ac-nav-link-inactive mb-4 inline-flex w-full"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to app
        </Link>
        <div className="flex items-center gap-3">
          <OrgMark hasLogo={hasLogo} logoBust={logoBust} />
          <div className="min-w-0">
            <div className="text-base font-semibold text-ink">Settings</div>
            <div className="mt-0.5 truncate text-xs text-muted">
              {orgName ?? 'Your organisation'}
            </div>
          </div>
        </div>
      </div>
      <Suspense fallback={<div className="flex-1" />}>
        <SettingsSidebarNav />
      </Suspense>
      <div className="border-t border-line p-3">
        <SignOutButton className="mb-3 px-2.5" />
        <PoweredByAvyro />
      </div>
    </aside>
  );
}

function MainShellSidebar({
  pathname,
  orgName,
  userName,
  mode,
  section,
  salesOpen,
  purchasesOpen,
  setSalesOpen,
  setPurchasesOpen,
  onCreate,
  hasLogo,
  logoBust,
  role,
  memberships,
  onOrgSwitch,
}: {
  pathname: string;
  orgName?: string;
  userName?: string;
  mode: 'SIMPLE' | 'ACCOUNTANT';
  section: 'sales' | 'purchases' | 'payroll' | null;
  salesOpen: boolean;
  purchasesOpen: boolean;
  setSalesOpen: (fn: (v: boolean) => boolean) => void;
  setPurchasesOpen: (fn: (v: boolean) => boolean) => void;
  onCreate: () => void;
  hasLogo?: boolean;
  logoBust?: number;
  role?: string;
  memberships?: Array<{ organizationId: string; organizationName: string }>;
  onOrgSwitch?: (organizationId: string) => void;
}) {
  const showCreate = roleAtLeast(role, 'MANAGER');
  const showSales = role !== 'AUDITOR' && roleAtLeast(role, 'EMPLOYEE');
  const showPurchases = role !== 'AUDITOR' && roleAtLeast(role, 'MANAGER');
  const showBanking = roleAtLeast(role, 'MANAGER');
  const showPayroll = roleAtLeast(role, 'MANAGER');
  const showReports = true;

  return (
    <aside className="ac-sidebar hidden lg:flex lg:flex-col">
      {/* Logo area */}
      <div className="border-b border-line px-4 py-5">
        <Link href="/app" className="mb-3 flex items-center gap-3">
          <OrgMark hasLogo={hasLogo} logoBust={logoBust} />
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-ink">
              {orgName ?? 'Your organisation'}
            </div>
          </div>
        </Link>

        {memberships && memberships.length > 1 ? (
          <select
            className="ac-input ac-btn-sm mt-3 w-full text-xs"
            value={memberships.find((m) => m.organizationName === orgName)?.organizationId ?? ''}
            onChange={(e) => onOrgSwitch?.(e.target.value)}
          >
            {memberships.map((m) => (
              <option key={m.organizationId} value={m.organizationId}>
                {m.organizationName}
              </option>
            ))}
          </select>
        ) : null}

        {showCreate ? (
          <button
            type="button"
            className="ac-btn-primary ac-btn-sm mt-3 w-full"
            onClick={onCreate}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Create new
          </button>
        ) : null}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <div className="ac-nav-group-label">Overview</div>
        <div className="space-y-0.5">
          <NavLink
            item={{ href: '/app', label: 'Dashboard', exact: true, icon: <NavIcon name="dashboard" /> }}
            pathname={pathname}
          />
          {roleAtLeast(role, 'MANAGER') ? (
            <NavLink
              item={{ href: '/app/review', label: 'Review', icon: <NavIcon name="review" /> }}
              pathname={pathname}
            />
          ) : null}
        </div>

        {showSales ? (
          <div>
            <div className="ac-nav-group-label">Sales</div>
            <div className="flex items-center">
              <Link
                href="/app/sales"
                className="ac-nav-link-inactive flex-1"
              >
                <NavIcon name="sales" />
                Sales
              </Link>
              <button
                type="button"
                className="mr-2 rounded-md p-1 text-muted transition hover:bg-surface hover:text-ink"
                aria-label={salesOpen ? 'Collapse sales' : 'Expand sales'}
                onClick={() => setSalesOpen((v) => !v)}
              >
                <svg
                  className={clsx('h-3.5 w-3.5 transition', salesOpen ? 'rotate-180' : '')}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
            </div>
            {salesOpen ? (
              <div className="ac-nav-sub mt-1">
                <NavLink item={{ href: '/app/invoices', label: 'Invoices' }} pathname={pathname} />
                <NavLink item={{ href: '/app/quotes', label: 'Quotes' }} pathname={pathname} />
                <NavLink item={{ href: '/app/customers', label: 'Customers' }} pathname={pathname} />
                <NavLink item={{ href: '/app/payments', label: 'Payments' }} pathname={pathname} />
              </div>
            ) : null}
          </div>
        ) : null}

        {showPurchases ? (
          <div>
            <div className="ac-nav-group-label">Purchases</div>
            <div className="flex items-center">
              <Link href="/app/purchases" className="ac-nav-link-inactive flex-1">
                <NavIcon name="purchases" />
                Purchases
              </Link>
              <button
                type="button"
                className="mr-2 rounded-md p-1 text-muted transition hover:bg-surface hover:text-ink"
                aria-label={purchasesOpen ? 'Collapse purchases' : 'Expand purchases'}
                onClick={() => setPurchasesOpen((v) => !v)}
              >
                <svg
                  className={clsx('h-3.5 w-3.5 transition', purchasesOpen ? 'rotate-180' : '')}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
            </div>
            {purchasesOpen ? (
              <div className="ac-nav-sub mt-1">
                <NavLink item={{ href: '/app/expense', label: 'Expenses' }} pathname={pathname} />
                <NavLink item={{ href: '/app/bills', label: 'Bills' }} pathname={pathname} />
                <NavLink item={{ href: '/app/suppliers', label: 'Suppliers' }} pathname={pathname} />
                <NavLink item={{ href: '/app/documents', label: 'Receipts' }} pathname={pathname} />
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="ac-nav-group-label">Finance</div>
        <div className="space-y-0.5">
          {showBanking ? (
            <NavLink item={{ href: '/app/banking', label: 'Banking', icon: <NavIcon name="banking" /> }} pathname={pathname} />
          ) : null}
          {showPayroll ? (
            <>
              <NavLink item={{ href: '/app/people', label: 'People', icon: <NavIcon name="people" /> }} pathname={pathname} />
              <NavLink item={{ href: '/app/payroll', label: 'Payroll', icon: <NavIcon name="payroll" /> }} pathname={pathname} />
            </>
          ) : null}
          {showReports ? (
            <NavLink item={{ href: '/app/reports', label: 'Reports', icon: <NavIcon name="reports" /> }} pathname={pathname} />
          ) : null}
          {role === 'AUDITOR' ? (
            <NavLink item={{ href: '/app/audit', label: 'Audit log', icon: <NavIcon name="audit" /> }} pathname={pathname} />
          ) : null}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-line p-3">
        <Link
          href="/app/settings"
          className={clsx(
            pathname.startsWith('/app/settings') ? 'ac-nav-link-active' : 'ac-nav-link-inactive',
            'w-full',
          )}
        >
          <NavIcon name="settings" />
          <span className="flex-1">Settings</span>
          <span className="rounded-md bg-surface px-2 py-0.5 text-[10px] font-medium text-muted">
            {mode === 'ACCOUNTANT' ? 'Pro' : 'Simple'}
          </span>
        </Link>
        {userName ? (
          <div className="mt-2 flex items-center gap-2.5 rounded-md px-3 py-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface text-xs font-medium text-ink-soft">
              {userName.split(/\s+/).map((p) => p[0]?.toUpperCase()).slice(0, 2).join('')}
            </div>
            <div className="min-w-0 flex-1 truncate text-xs text-muted">{userName}</div>
            <SignOutButton />
          </div>
        ) : (
          <div className="mt-2 px-3">
            <SignOutButton />
          </div>
        )}
        <PoweredByAvyro align="left" className="mt-3 px-2.5" />
      </div>
    </aside>
  );
}

function MobileSettingsTabs() {
  const searchParams = useSearchParams();
  const active = parseSettingsTab(searchParams.get('tab'));
  return (
    <div className="flex gap-1 overflow-x-auto px-3 py-2">
      <Link href="/app" className="ac-tab-pill-inactive shrink-0">
        ← App
      </Link>
      {SETTINGS_SECTIONS.map((section) => (
        <Link
          key={section.id}
          href={settingsHref(section.id)}
          className={active === section.id ? 'ac-tab-pill-active shrink-0' : 'ac-tab-pill-inactive shrink-0'}
        >
          {section.label}
        </Link>
      ))}
    </div>
  );
}

export function AppShell({
  children,
  orgName,
  userName,
  uiMode = 'SIMPLE',
  role,
  memberships = [],
  hasLogo = false,
}: {
  children: ReactNode;
  orgName?: string;
  userName?: string;
  uiMode?: 'SIMPLE' | 'ACCOUNTANT';
  role?: string;
  memberships?: Array<{ organizationId: string; organizationName: string; role?: string }>;
  hasLogo?: boolean;
}) {
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mode, setMode] = useState(uiMode);
  const [logoOn, setLogoOn] = useState(hasLogo);
  const [logoBust, setLogoBust] = useState(0);
  const section = sectionForPath(pathname);
  const [salesOpen, setSalesOpen] = useState(section === 'sales');
  const [purchasesOpen, setPurchasesOpen] = useState(section === 'purchases');
  const inSettings = pathname.startsWith('/app/settings');
  const [activeOrgName, setActiveOrgName] = useState(orgName);

  useEffect(() => {
    setActiveOrgName(orgName);
  }, [orgName]);

  function handleOrgSwitch(organizationId: string) {
    import('@/lib/api').then(({ setActiveOrganizationId }) => {
      setActiveOrganizationId(organizationId);
      const next = memberships.find((m) => m.organizationId === organizationId);
      if (next) setActiveOrgName(next.organizationName);
      window.location.reload();
    });
  }

  useEffect(() => {
    setMode(uiMode);
  }, [uiMode]);

  useEffect(() => {
    setLogoOn(hasLogo);
  }, [hasLogo]);

  useEffect(() => {
    if (section === 'sales') setSalesOpen(true);
    if (section === 'purchases') setPurchasesOpen(true);
  }, [section]);

  useEffect(() => {
    function onMode(event: Event) {
      const detail = (event as CustomEvent<'SIMPLE' | 'ACCOUNTANT'>).detail;
      if (detail === 'SIMPLE' || detail === 'ACCOUNTANT') setMode(detail);
    }
    function onOrgUpdated() {
      setLogoBust(Date.now());
      fetch('/api/v1/organizations/current', { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((org: { logoUrl?: string | null } | null) => {
          if (org) setLogoOn(Boolean(org.logoUrl));
        })
        .catch(() => undefined);
    }
    window.addEventListener('ac:ui-mode', onMode);
    window.addEventListener('ac:org-updated', onOrgUpdated);
    return () => {
      window.removeEventListener('ac:ui-mode', onMode);
      window.removeEventListener('ac:org-updated', onOrgUpdated);
    };
  }, []);

  const mobileNav: NavItem[] = [
    { href: '/app', label: 'Home', exact: true },
    { href: '/app/sales', label: 'Sales' },
    { href: '/app/purchases', label: 'Purchases' },
    { href: '/app/banking', label: 'Banking' },
    { href: '/app/reports', label: 'Reports' },
    { href: '/app/settings', label: 'Settings' },
  ];

  return (
    <div className="ac-shell">
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      {inSettings ? (
        <SettingsShellSidebar orgName={orgName} hasLogo={logoOn} logoBust={logoBust} />
      ) : (
        <MainShellSidebar
          pathname={pathname}
          orgName={activeOrgName}
          userName={userName}
          mode={mode}
          section={section}
          salesOpen={salesOpen}
          purchasesOpen={purchasesOpen}
          setSalesOpen={setSalesOpen}
          setPurchasesOpen={setPurchasesOpen}
          onCreate={() => setPaletteOpen(true)}
          hasLogo={logoOn}
          logoBust={logoBust}
          role={role}
          memberships={memberships}
          onOrgSwitch={handleOrgSwitch}
        />
      )}

      <div className="ac-main">
        <header className="sticky top-0 z-20 border-b border-line bg-paper-elevated/95 backdrop-blur-sm lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <Link href="/app" className="flex min-w-0 items-center gap-2">
              <OrgMark hasLogo={logoOn} logoBust={logoBust} className="h-8 w-8" />
              <span className="truncate text-sm font-semibold text-ink">
                {inSettings ? 'Settings' : activeOrgName ?? 'Your organisation'}
              </span>
            </Link>
            {!inSettings ? (
              <button
                type="button"
                className="ac-btn-primary ac-btn-sm"
                onClick={() => setPaletteOpen(true)}
              >
                Create
              </button>
            ) : (
              <Link href="/app" className="ac-btn-secondary ac-btn-sm">
                Back
              </Link>
            )}
          </div>
          {inSettings ? (
            <Suspense fallback={null}>
              <MobileSettingsTabs />
            </Suspense>
          ) : (
            <div className="flex gap-1 overflow-x-auto border-t border-line px-3 py-2">
              {mobileNav.map((item) => {
                const active = isActive(pathname, item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={active ? 'ac-tab-pill-active shrink-0' : 'ac-tab-pill-inactive shrink-0'}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}
        </header>
        {children}
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        {eyebrow ? <p className="mb-1 text-sm text-muted">{eyebrow}</p> : null}
        <h1 className="ac-display">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function PageToolbar({ children }: { children: ReactNode }) {
  return <div className="ac-toolbar">{children}</div>;
}

export function TabPills<T extends string>({
  tabs,
  active,
  onSelect,
}: {
  tabs: Array<{ id: T; label: string }>;
  active: T;
  onSelect: (id: T) => void;
}) {
  return (
    <div className="ac-tab-pills">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          className={active === t.id ? 'ac-tab-pill-active' : 'ac-tab-pill-inactive'}
          onClick={() => onSelect(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Money({
  amount,
  currency = 'BDT',
  className,
  truncate = true,
}: {
  amount: string | number;
  currency?: string;
  className?: string;
  /** When false, show the full amount (wrap/scale) instead of ellipsis. */
  truncate?: boolean;
}) {
  const n = typeof amount === 'string' ? Number(amount) : amount;
  const symbols: Record<string, string> = { BDT: '৳', GBP: '£', USD: '$', EUR: '€' };
  const formatted = Number.isFinite(n)
    ? n.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : String(amount);
  const display = `${symbols[currency] ?? `${currency} `}${formatted}`;
  return (
    <span
      className={clsx(
        'font-mono tabular-nums tracking-tight',
        truncate ? 'inline-block max-w-full truncate' : 'inline break-words',
        className,
      )}
      title={truncate ? display : undefined}
    >
      {display}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: 'ac-badge-neutral',
    ISSUED: 'ac-badge-neutral',
    SENT: 'ac-badge-neutral',
    POSTED: 'ac-badge-success',
    RECORDED: 'ac-badge-success',
    PAID: 'ac-badge-success',
    ACTIVE: 'ac-badge-success',
    RELATED: 'ac-badge-warning',
    PARTIALLY_PAID: 'ac-badge-warning',
    OVERDUE: 'ac-badge-danger',
    CREDITED: 'ac-badge-warning',
    CONVERTED: 'ac-badge-success',
    ACCEPTED: 'ac-badge-success',
    DECLINED: 'ac-badge-danger',
    SETTLED: 'ac-badge-success',
    SUCCEEDED: 'ac-badge-success',
    PENDING: 'ac-badge-warning',
    FAILED: 'ac-badge-danger',
    OPEN: 'ac-badge-neutral',
    MATCHED: 'ac-badge-success',
    IMPORTED: 'ac-badge-neutral',
    TRANSFER: 'ac-badge-warning',
    IGNORED: 'ac-badge-neutral',
    LOCKED: 'ac-badge-success',
    VOID: 'ac-badge-danger',
    REVERSED: 'ac-badge-warning',
  };
  return <span className={map[status] ?? 'ac-badge-neutral'}>{status.replaceAll('_', ' ')}</span>;
}

function EmptyIllustration() {
  return (
    <svg
      className="mx-auto h-16 w-16 text-muted/30"
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden
    >
      <rect x="20" y="30" width="80" height="60" rx="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M35 50h50M35 62h35M35 74h25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="ac-card px-6 py-12 text-center">
      <EmptyIllustration />
      <h2 className="mt-4 text-base font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder = 'Search…',
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={clsx('ac-input-wrap flex-1', className)}>
      <svg
        className="ac-input-icon h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
      <input
        className="ac-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

export function AlertCard({
  variant = 'info',
  title,
  children,
  action,
}: {
  variant?: 'info' | 'warning' | 'success';
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const cls = {
    info: 'ac-alert-info',
    warning: 'ac-alert-warning',
    success: 'ac-alert-success',
  }[variant];
  return (
    <div className={cls}>
      <div className="flex-1">
        <div className="text-sm font-semibold text-ink">{title}</div>
        {children ? <div className="mt-1 text-sm text-ink-soft">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function QuickActionTile({
  href,
  label,
  area,
  icon,
}: {
  href: string;
  label: string;
  area: string;
  icon: ReactNode;
}) {
  return (
    <Link href={href} className="ac-quick-tile">
      <div className="ac-quick-tile-icon">{icon}</div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink">{label}</div>
        <div className="text-xs text-muted">{area}</div>
      </div>
      <svg className="ml-auto h-4 w-4 shrink-0 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </Link>
  );
}

export function StatCard({
  label,
  value,
  hint,
  href,
  trend,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  href?: string;
  trend?: { label: string; positive?: boolean };
  className?: string;
  /** @deprecated accent borders removed — kept for call-site compatibility */
  accent?: 'brand' | 'accent' | 'success' | 'warning';
}) {
  const inner = (
    <div>
      <div className="text-sm text-muted">{label}</div>
      <div className="ac-stat-value-lg mt-1">{value}</div>
      {trend ? (
        <span
          className={clsx(
            'mt-2 inline-flex',
            trend.positive ? 'ac-badge-success' : 'ac-badge-danger',
          )}
        >
          {trend.label}
        </span>
      ) : null}
      {hint ? (
        <div className="mt-2 text-xs leading-relaxed text-muted">
          {typeof hint === 'string' ? <p className="line-clamp-2">{hint}</p> : hint}
        </div>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className={clsx('ac-card-hover ac-card-body block min-w-0', className)}>
        {inner}
      </Link>
    );
  }
  return <div className={clsx('ac-card ac-card-body min-w-0', className)}>{inner}</div>;
}

export function PersonAvatar({
  personId,
  name,
  hasPhoto,
  bust = 0,
  size = 'md',
}: {
  personId: string;
  name: string;
  hasPhoto?: boolean;
  bust?: number;
  size?: 'sm' | 'md';
}) {
  const dim = size === 'sm' ? 'h-9 w-9 text-sm' : 'h-11 w-11 text-base';
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
  if (hasPhoto) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/v1/people/${personId}/photo?v=${bust}`}
        alt=""
        className={`${dim} shrink-0 rounded-full border border-line object-cover`}
      />
    );
  }
  return (
    <div
      className={`${dim} flex shrink-0 items-center justify-center rounded-full border border-line bg-surface font-medium text-ink-soft`}
      aria-hidden
    >
      {initials || '?'}
    </div>
  );
}
