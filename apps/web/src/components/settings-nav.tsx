'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import clsx from 'clsx';

export type SettingsTab =
  | 'business'
  | 'branding'
  | 'invoices'
  | 'uploads'
  | 'team'
  | 'backups'
  | 'security'
  | 'display'
  | 'more';

export const SETTINGS_SECTIONS: {
  id: SettingsTab;
  label: string;
  hint: string;
}[] = [
  { id: 'business', label: 'Business', hint: 'Name, TIN, BIN' },
  { id: 'branding', label: 'Logo & branding', hint: 'Logo and letterhead' },
  { id: 'invoices', label: 'Invoices', hint: 'Prefix, terms, footer' },
  { id: 'uploads', label: 'Uploads', hint: 'Receipts and files' },
  { id: 'team', label: 'Team', hint: 'Members and roles' },
  { id: 'backups', label: 'Backups', hint: 'Schedule and restore' },
  { id: 'security', label: 'Security', hint: 'Password' },
  { id: 'display', label: 'Display', hint: 'Theme & navigation mode' },
  { id: 'more', label: 'More tools', hint: 'Compliance, books, extras' },
];

export function settingsHref(tab: SettingsTab = 'business') {
  return tab === 'business' ? '/app/settings' : `/app/settings?tab=${tab}`;
}

export function parseSettingsTab(raw: string | null): SettingsTab {
  if (
    raw === 'branding' ||
    raw === 'invoices' ||
    raw === 'uploads' ||
    raw === 'team' ||
    raw === 'backups' ||
    raw === 'security' ||
    raw === 'display' ||
    raw === 'more'
  ) {
    return raw;
  }
  return 'business';
}

export function SettingsSidebarNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = parseSettingsTab(searchParams.get('tab'));
  const onSettings = pathname.startsWith('/app/settings');

  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
      {SETTINGS_SECTIONS.map((section) => {
        const activeSection = onSettings && active === section.id;
        return (
          <Link
            key={section.id}
            href={settingsHref(section.id)}
            className={clsx(
              'block rounded-md px-2.5 py-2 transition duration-150',
              activeSection
                ? 'bg-paper-elevated text-ink shadow-sm ring-1 ring-line'
                : 'text-ink-soft hover:bg-paper-elevated/60 hover:text-ink',
            )}
          >
            <div className="text-sm font-medium">{section.label}</div>
            <div
              className={clsx(
                'mt-0.5 text-xs leading-snug',
                activeSection ? 'text-muted' : 'text-muted',
              )}
            >
              {section.hint}
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
