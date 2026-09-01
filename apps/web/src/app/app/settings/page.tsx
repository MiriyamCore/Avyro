'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, ApiError, ORG_LOGO_PATH, restoreBackupUpload, uploadLogo, uploadReceipt } from '@/lib/api';
import { SignOutButton } from '@/components/sign-out-button';
import { PageHeader, StatusBadge } from '@/components/ui';
import {
  applyColorScheme,
  COLOR_SCHEME_EVENT,
  type ColorSchemePreference,
  DEFAULT_COLOR_SCHEME,
} from '@/lib/theme';
import {
  parseSettingsTab,
  SETTINGS_SECTIONS,
  type SettingsTab,
} from '@/components/settings-nav';

type Org = {
  id: string;
  name: string;
  legalName?: string | null;
  legalType: string;
  businessActivity?: string | null;
  countryCode: string;
  baseCurrency: string;
  fiscalYearStartMonth: number;
  taxIdentifier?: string | null;
  vatIdentifier?: string | null;
  tradeLicenseNumber?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  invoicePrefix?: string | null;
  quotePrefix?: string | null;
  invoiceFooter?: string | null;
  invoicePrimaryColor?: string | null;
  invoiceAccentColor?: string | null;
  invoiceTemplate?: string | null;
  defaultPaymentTermsDays?: number;
  role?: string;
};

type Member = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  uiMode: 'SIMPLE' | 'ACCOUNTANT';
  status: string;
};

type Me = {
  user: { id: string; name: string; email: string; colorScheme?: ColorSchemePreference };
  currentOrganization: {
    organizationId: string;
    role: string;
    uiMode: 'SIMPLE' | 'ACCOUNTANT';
  } | null;
};

const MORE_LINKS: { group: string; items: { href: string; label: string; hint: string }[] }[] = [
  {
    group: 'Business setup',
    items: [
      { href: '/app/setup', label: 'Setup wizard', hint: 'Name, TIN, bank, capital' },
      { href: '/app/documents', label: 'Documents', hint: 'Receipts and files' },
      { href: '/app/owner-money', label: 'Owner money', hint: 'Capital in / drawings out' },
    ],
  },
  {
    group: 'Sales extras',
    items: [
      { href: '/app/contracts', label: 'Contracts', hint: 'Client agreements' },
      { href: '/app/projects', label: 'Projects', hint: 'Delivery tracking' },
      { href: '/app/payments', label: 'Payments', hint: 'Mark invoices paid' },
      { href: '/app/gateway', label: 'Payment gateway', hint: 'Test checkout / SSLCommerz' },
    ],
  },
  {
    group: 'Banking & FX',
    items: [
      { href: '/app/fx', label: 'Currencies & FX', hint: 'Rates and foreign accounts' },
      { href: '/app/month-end', label: 'Month-end', hint: 'Close checklist' },
    ],
  },
  {
    group: 'Operations',
    items: [
      { href: '/app/people', label: 'People', hint: 'Staff and TDS %' },
      { href: '/app/assets', label: 'Assets', hint: 'Register and depreciation' },
      { href: '/app/time', label: 'Time', hint: 'Hours for profitability' },
      { href: '/app/compliance', label: 'BD compliance', hint: 'VAT, TDS, Mushak registers' },
    ],
  },
  {
    group: 'Accounting (books)',
    items: [
      { href: '/app/journals', label: 'Journals', hint: 'Manual entries' },
      { href: '/app/accounts', label: 'Chart of accounts', hint: 'CoA including VAT/TDS' },
      { href: '/app/trial-balance', label: 'Trial balance', hint: 'Ledger check' },
      { href: '/app/audit', label: 'Audit log', hint: 'Who changed what' },
    ],
  },
];

const ROLES = ['ACCOUNTANT', 'MANAGER', 'EMPLOYEE', 'AUDITOR'] as const;

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="ac-page text-sm text-muted">Loading settings…</div>}>
      <SettingsPageInner />
    </Suspense>
  );
}

function SettingsPageInner() {
  const searchParams = useSearchParams();
  const tab: SettingsTab = parseSettingsTab(searchParams.get('tab'));
  const sectionMeta = SETTINGS_SECTIONS.find((s) => s.id === tab) ?? SETTINGS_SECTIONS[0]!;
  const [me, setMe] = useState<Me | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [business, setBusiness] = useState({
    name: '',
    legalName: '',
    legalType: 'Sole Proprietorship',
    businessActivity: '',
    taxIdentifier: '',
    vatIdentifier: '',
    tradeLicenseNumber: '',
  });

  const [branding, setBranding] = useState({
    address: '',
    phone: '',
    email: '',
    website: '',
  });

  const [invoiceSettings, setInvoiceSettings] = useState({
    invoicePrefix: 'INV-',
    quotePrefix: 'Q-',
    defaultPaymentTermsDays: 30,
    invoiceFooter: '',
    invoicePrimaryColor: '#0047ff',
    invoiceAccentColor: '#8e24ff',
    invoiceTemplate: 'wave',
  });

  const [logoBust, setLogoBust] = useState(0);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  const [invite, setInvite] = useState({
    name: '',
    email: '',
    password: '',
    role: 'EMPLOYEE' as (typeof ROLES)[number],
    uiMode: 'SIMPLE' as 'SIMPLE' | 'ACCOUNTANT',
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirm: '',
  });

  const [uiMode, setUiMode] = useState<'SIMPLE' | 'ACCOUNTANT'>('SIMPLE');
  const [colorScheme, setColorScheme] = useState<ColorSchemePreference>(DEFAULT_COLOR_SCHEME);
  const isOwner = me?.currentOrganization?.role === 'OWNER';
  const hasLogo = Boolean(org?.logoUrl);

  type BackupRow = {
    id: string;
    storage: string;
    filename: string;
    sizeBytes: string;
    status: string;
    errorMessage: string | null;
    createdAt: string;
    completedAt: string | null;
  };

  type BackupSettings = {
    frequency: 'OFF' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
    lastRunAt: string | null;
    storageTarget: 'LOCAL' | 'S3';
    latestBackup: BackupRow | null;
  };

  const [backupSettings, setBackupSettings] = useState<BackupSettings | null>(null);
  const [backups, setBackups] = useState<BackupRow[]>([]);
  const [backupFrequency, setBackupFrequency] = useState<BackupSettings['frequency']>('OFF');
  const [restoreConfirm, setRestoreConfirm] = useState('');
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [backingUp, setBackingUp] = useState(false);

  function refresh() {
    return Promise.all([
      api<Me>('/api/v1/me'),
      api<Org>('/api/v1/organizations/current'),
      api<Member[]>('/api/v1/members').catch(() => [] as Member[]),
    ]).then(([meRes, orgRes, memberRes]) => {
      setMe(meRes);
      setOrg(orgRes);
      setMembers(memberRes);
      setUiMode(meRes.currentOrganization?.uiMode ?? 'SIMPLE');
      setColorScheme(meRes.user.colorScheme ?? DEFAULT_COLOR_SCHEME);
      setBusiness({
        name: orgRes.name ?? '',
        legalName: orgRes.legalName ?? '',
        legalType: orgRes.legalType ?? 'Sole Proprietorship',
        businessActivity: orgRes.businessActivity ?? '',
        taxIdentifier: orgRes.taxIdentifier ?? '',
        vatIdentifier: orgRes.vatIdentifier ?? '',
        tradeLicenseNumber: orgRes.tradeLicenseNumber ?? '',
      });
      setBranding({
        address: orgRes.address ?? '',
        phone: orgRes.phone ?? '',
        email: orgRes.email ?? '',
        website: orgRes.website ?? '',
      });
      setInvoiceSettings({
        invoicePrefix: orgRes.invoicePrefix ?? 'INV-',
        quotePrefix: orgRes.quotePrefix ?? 'Q-',
        defaultPaymentTermsDays: orgRes.defaultPaymentTermsDays ?? 30,
        invoiceFooter: orgRes.invoiceFooter ?? '',
        invoicePrimaryColor: orgRes.invoicePrimaryColor ?? '#0047ff',
        invoiceAccentColor: orgRes.invoiceAccentColor ?? '#8e24ff',
        invoiceTemplate: orgRes.invoiceTemplate ?? 'wave',
      });
    });
  }

  useEffect(() => {
    refresh().catch((err) =>
      setError(err instanceof ApiError ? err.message : 'Failed to load settings'),
    );
  }, []);

  async function loadBackups() {
    if (!isOwner) return;
    const [settingsRes, listRes] = await Promise.all([
      api<BackupSettings>('/api/v1/backups/settings'),
      api<BackupRow[]>('/api/v1/backups'),
    ]);
    setBackupSettings(settingsRes);
    setBackupFrequency(settingsRes.frequency);
    setBackups(listRes);
  }

  useEffect(() => {
    if (tab === 'backups' && isOwner) {
      loadBackups().catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Failed to load backups'),
      );
    }
  }, [tab, isOwner]);

  useEffect(() => {
    if (tab !== 'backups' || !isOwner) return;
    const inFlight = backups.some((b) => b.status === 'PENDING' || b.status === 'RUNNING');
    if (!inFlight) return;
    const timer = window.setInterval(() => {
      void loadBackups();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [tab, isOwner, backups]);

  async function saveBackupFrequency(e: FormEvent) {
    e.preventDefault();
    if (!isOwner) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await api('/api/v1/backups/settings', {
        method: 'PATCH',
        body: JSON.stringify({ frequency: backupFrequency }),
      });
      setNotice('Backup schedule saved.');
      await loadBackups();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save schedule');
    } finally {
      setSaving(false);
    }
  }

  async function runBackupNow() {
    if (!isOwner) return;
    setBackingUp(true);
    setError(null);
    setNotice(null);
    try {
      await api('/api/v1/backups', { method: 'POST' });
      setNotice('Backup started — refresh in a moment to see status.');
      await loadBackups();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Backup failed to start');
    } finally {
      setBackingUp(false);
    }
  }

  async function restoreUploadedBackup(e: FormEvent) {
    e.preventDefault();
    if (!isOwner || !restoreFile) return;
    setRestoring(true);
    setError(null);
    setNotice(null);
    try {
      await restoreBackupUpload(restoreFile, restoreConfirm);
      setNotice('Restore completed. Reload the app to pick up restored data.');
      setRestoreConfirm('');
      setRestoreFile(null);
      await loadBackups();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Restore failed');
    } finally {
      setRestoring(false);
    }
  }

  function formatBytes(raw: string) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return '—';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function saveBusiness(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await api('/api/v1/organizations/current', {
        method: 'PUT',
        body: JSON.stringify(business),
      });
      setNotice('Business settings saved.');
      await refresh();
      window.dispatchEvent(new Event('ac:org-updated'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function saveBranding(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await api('/api/v1/organizations/current', {
        method: 'PUT',
        body: JSON.stringify(branding),
      });
      setNotice('Branding details saved.');
      await refresh();
      window.dispatchEvent(new Event('ac:org-updated'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function saveInvoices(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await api('/api/v1/organizations/current', {
        method: 'PUT',
        body: JSON.stringify(invoiceSettings),
      });
      setNotice('Invoice settings saved.');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function onLogoFile(file: File | undefined) {
    if (!file) return;
    setUploadingLogo(true);
    setError(null);
    setNotice(null);
    try {
      await uploadLogo(file);
      setLogoBust(Date.now());
      setNotice('Logo uploaded — it will appear on invoices and in the sidebar.');
      await refresh();
      window.dispatchEvent(new Event('ac:org-updated'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Logo upload failed');
    } finally {
      setUploadingLogo(false);
    }
  }

  async function removeLogo() {
    setError(null);
    setNotice(null);
    try {
      await api('/api/v1/organizations/current/logo', { method: 'DELETE' });
      setLogoBust(Date.now());
      setNotice('Logo removed.');
      await refresh();
      window.dispatchEvent(new Event('ac:org-updated'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove logo');
    }
  }

  async function addMember(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await api('/api/v1/members', {
        method: 'POST',
        body: JSON.stringify(invite),
      });
      setInvite({
        name: '',
        email: '',
        password: '',
        role: 'EMPLOYEE',
        uiMode: 'SIMPLE',
      });
      setNotice('Teammate created. They can sign in with the temporary password.');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add member');
    } finally {
      setSaving(false);
    }
  }

  async function patchMember(
    id: string,
    body: Partial<{ role: string; uiMode: string; status: string }>,
  ) {
    setError(null);
    try {
      await api(`/api/v1/members/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Update failed');
    }
  }

  async function resetPassword(id: string, name: string) {
    const password = window.prompt(`Temporary password for ${name} (min 8 chars)`);
    if (!password) return;
    setError(null);
    try {
      await api(`/api/v1/members/${id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      setNotice(`Password reset for ${name}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Reset failed');
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirm) {
      setError('New passwords do not match.');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await api('/api/v1/me/password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirm: '' });
      setNotice('Password updated.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Password change failed');
    } finally {
      setSaving(false);
    }
  }

  async function saveUiMode(mode: 'SIMPLE' | 'ACCOUNTANT') {
    setError(null);
    setNotice(null);
    try {
      await api('/api/v1/me/ui-mode', {
        method: 'PATCH',
        body: JSON.stringify({ uiMode: mode }),
      });
      setUiMode(mode);
      setNotice(
        mode === 'SIMPLE'
          ? 'Simple mode on — left bar stays focused on day-to-day money.'
          : 'Accountant mode saved — ledger tools remain under Settings → More tools.',
      );
      window.dispatchEvent(new CustomEvent('ac:ui-mode', { detail: mode }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update mode');
    }
  }

  async function saveColorScheme(scheme: ColorSchemePreference) {
    setError(null);
    setNotice(null);
    try {
      await api('/api/v1/me/color-scheme', {
        method: 'PATCH',
        body: JSON.stringify({ colorScheme: scheme }),
      });
      setColorScheme(scheme);
      applyColorScheme(scheme);
      setNotice(
        scheme === 'DARK'
          ? 'Dark theme on — deep navy backgrounds with Avyro gradients.'
          : scheme === 'LIGHT'
            ? 'Light theme on — bright paper backgrounds.'
            : 'Theme follows your device appearance.',
      );
      window.dispatchEvent(new CustomEvent(COLOR_SCHEME_EVENT, { detail: scheme }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update theme');
    }
  }

  return (
    <div className="ac-page">
      <PageHeader title={sectionMeta.label} description={sectionMeta.hint} />

      {error ? (
        <div className="mb-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="mb-4 rounded-lg border border-brand/30 bg-brand-soft px-4 py-3 text-sm text-ink">
          {notice}
        </div>
      ) : null}

      {tab === 'business' ? (
        <form onSubmit={saveBusiness} className="ac-card max-w-2xl space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Business name</span>
              <input
                className="ac-input"
                value={business.name}
                onChange={(e) => setBusiness({ ...business, name: e.target.value })}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Legal name</span>
              <input
                className="ac-input"
                value={business.legalName}
                onChange={(e) =>
                  setBusiness({ ...business, legalName: e.target.value })
                }
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Legal type</span>
              <input
                className="ac-input"
                value={business.legalType}
                onChange={(e) =>
                  setBusiness({ ...business, legalType: e.target.value })
                }
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Activity</span>
              <input
                className="ac-input"
                value={business.businessActivity}
                onChange={(e) =>
                  setBusiness({ ...business, businessActivity: e.target.value })
                }
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">TIN</span>
              <input
                className="ac-input"
                value={business.taxIdentifier}
                onChange={(e) =>
                  setBusiness({ ...business, taxIdentifier: e.target.value })
                }
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">BIN / VAT</span>
              <input
                className="ac-input"
                value={business.vatIdentifier}
                onChange={(e) =>
                  setBusiness({ ...business, vatIdentifier: e.target.value })
                }
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Trade license</span>
              <input
                className="ac-input"
                value={business.tradeLicenseNumber}
                onChange={(e) =>
                  setBusiness({
                    ...business,
                    tradeLicenseNumber: e.target.value,
                  })
                }
              />
            </label>
          </div>
          <button type="submit" className="ac-btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save business'}
          </button>
          {org ? (
            <p className="text-xs text-muted">
              {org.countryCode} · {org.baseCurrency} · FY starts month{' '}
              {org.fiscalYearStartMonth}
            </p>
          ) : null}
        </form>
      ) : null}

      {tab === 'branding' ? (
        <div className="grid max-w-3xl gap-6">
          <div className="ac-card space-y-4 p-6">
            <h2 className="font-display text-lg font-semibold">Business logo</h2>
            <p className="text-sm text-ink-soft">
              Shown in the app sidebar and on invoice PDFs. PNG, JPEG, WebP, or SVG up
              to 5&nbsp;MB.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-line bg-paper">
                {hasLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`${ORG_LOGO_PATH}?v=${logoBust || '1'}`}
                    alt="Business logo"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-muted">No logo</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="ac-btn-primary cursor-pointer text-xs">
                  {uploadingLogo ? 'Uploading…' : 'Upload logo'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    disabled={uploadingLogo}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      void onLogoFile(file);
                    }}
                  />
                </label>
                {hasLogo ? (
                  <button type="button" className="ac-btn-secondary text-xs" onClick={removeLogo}>
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <form onSubmit={saveBranding} className="ac-card space-y-4 p-6">
            <h2 className="font-display text-lg font-semibold">Letterhead details</h2>
            <p className="text-sm text-ink-soft">
              Printed on invoices next to your logo.
            </p>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Address</span>
              <textarea
                className="ac-input min-h-[80px]"
                value={branding.address}
                onChange={(e) => setBranding({ ...branding, address: e.target.value })}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-muted">Phone</span>
                <input
                  className="ac-input"
                  value={branding.phone}
                  onChange={(e) => setBranding({ ...branding, phone: e.target.value })}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted">Email</span>
                <input
                  className="ac-input"
                  type="email"
                  value={branding.email}
                  onChange={(e) => setBranding({ ...branding, email: e.target.value })}
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-muted">Website</span>
                <input
                  className="ac-input"
                  value={branding.website}
                  onChange={(e) => setBranding({ ...branding, website: e.target.value })}
                />
              </label>
            </div>
            <button type="submit" className="ac-btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save branding'}
            </button>
          </form>
        </div>
      ) : null}

      {tab === 'invoices' ? (
        <form onSubmit={saveInvoices} className="ac-card max-w-2xl space-y-4 p-6">
          <p className="text-sm text-ink-soft">
            Customize how invoices and quotes are numbered, styled, and what footer text
            appears on PDFs (bank details, payment instructions, thank-you).
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Invoice prefix</span>
              <input
                className="ac-input"
                value={invoiceSettings.invoicePrefix}
                onChange={(e) =>
                  setInvoiceSettings({
                    ...invoiceSettings,
                    invoicePrefix: e.target.value,
                  })
                }
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Quote prefix</span>
              <input
                className="ac-input"
                value={invoiceSettings.quotePrefix}
                onChange={(e) =>
                  setInvoiceSettings({
                    ...invoiceSettings,
                    quotePrefix: e.target.value,
                  })
                }
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-muted">Default payment terms (days)</span>
              <input
                className="ac-input"
                type="number"
                min={0}
                value={invoiceSettings.defaultPaymentTermsDays}
                onChange={(e) =>
                  setInvoiceSettings({
                    ...invoiceSettings,
                    defaultPaymentTermsDays: Number(e.target.value),
                  })
                }
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Header color</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="h-10 w-12 cursor-pointer rounded border border-line"
                  value={invoiceSettings.invoicePrimaryColor}
                  onChange={(e) =>
                    setInvoiceSettings({
                      ...invoiceSettings,
                      invoicePrimaryColor: e.target.value,
                    })
                  }
                />
                <input
                  className="ac-input font-mono text-xs"
                  value={invoiceSettings.invoicePrimaryColor}
                  onChange={(e) =>
                    setInvoiceSettings({
                      ...invoiceSettings,
                      invoicePrimaryColor: e.target.value,
                    })
                  }
                />
              </div>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Accent color</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="h-10 w-12 cursor-pointer rounded border border-line"
                  value={invoiceSettings.invoiceAccentColor}
                  onChange={(e) =>
                    setInvoiceSettings({
                      ...invoiceSettings,
                      invoiceAccentColor: e.target.value,
                    })
                  }
                />
                <input
                  className="ac-input font-mono text-xs"
                  value={invoiceSettings.invoiceAccentColor}
                  onChange={(e) =>
                    setInvoiceSettings({
                      ...invoiceSettings,
                      invoiceAccentColor: e.target.value,
                    })
                  }
                />
              </div>
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-muted">PDF template</span>
              <select
                className="ac-input"
                value={invoiceSettings.invoiceTemplate}
                onChange={(e) =>
                  setInvoiceSettings({
                    ...invoiceSettings,
                    invoiceTemplate: e.target.value,
                  })
                }
              >
                <option value="wave">Wave — colored header + amount due pill</option>
                <option value="classic">Classic — white header, brand underline</option>
                <option value="minimal">Minimal — clean, no banner</option>
              </select>
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Invoice footer / payment notes</span>
            <textarea
              className="ac-input min-h-[120px]"
              placeholder="e.g. Pay to City Bank A/C … · Thank you for your business."
              value={invoiceSettings.invoiceFooter}
              onChange={(e) =>
                setInvoiceSettings({
                  ...invoiceSettings,
                  invoiceFooter: e.target.value,
                })
              }
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="ac-btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save invoice settings'}
            </button>
            <a
              className="ac-btn-secondary text-xs"
              href="/api/v1/invoices/preview/pdf"
              target="_blank"
              rel="noreferrer"
            >
              Preview sample PDF
            </a>
          </div>
          <p className="text-xs text-muted">
            Preview uses your logo (Branding tab), colors, prefix, and footer. Upload a logo
            first for the full effect.
          </p>
        </form>
      ) : null}

      {tab === 'uploads' ? (
        <div className="ac-card max-w-2xl space-y-4 p-6">
          <p className="text-sm text-ink-soft">
            Upload receipts and supporting files. You can also attach files from Expenses
            and Bills.
          </p>
          <label className="ac-btn-primary inline-flex cursor-pointer text-xs">
            {uploadingFile ? 'Uploading…' : 'Upload file'}
            <input
              type="file"
              className="hidden"
              disabled={uploadingFile}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                setUploadingFile(true);
                setError(null);
                setNotice(null);
                try {
                  await uploadReceipt(file);
                  setNotice(`Uploaded ${file.name}. Open Receipts to browse the library.`);
                } catch (err) {
                  setError(err instanceof ApiError ? err.message : 'Upload failed');
                } finally {
                  setUploadingFile(false);
                }
              }}
            />
          </label>
          <div>
            <Link href="/app/documents" className="text-sm font-semibold text-brand">
              Open receipts library →
            </Link>
          </div>
        </div>
      ) : null}

      {tab === 'team' ? (
        <div className="space-y-6">
          {!isOwner ? (
            <p className="text-sm text-ink-soft">
              Only the owner can add or change teammates. You can still see who has
              access.
            </p>
          ) : (
            <form onSubmit={addMember} className="ac-card max-w-2xl space-y-4 p-6">
              <h2 className="font-display text-lg font-semibold">Add teammate</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block text-muted">Name</span>
                  <input
                    className="ac-input"
                    value={invite.name}
                    onChange={(e) => setInvite({ ...invite, name: e.target.value })}
                    required
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-muted">Email</span>
                  <input
                    className="ac-input"
                    type="email"
                    value={invite.email}
                    onChange={(e) => setInvite({ ...invite, email: e.target.value })}
                    required
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-muted">Temporary password</span>
                  <input
                    className="ac-input"
                    type="text"
                    value={invite.password}
                    onChange={(e) =>
                      setInvite({ ...invite, password: e.target.value })
                    }
                    minLength={8}
                    required
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-muted">Role</span>
                  <select
                    className="ac-input"
                    value={invite.role}
                    onChange={(e) =>
                      setInvite({
                        ...invite,
                        role: e.target.value as (typeof ROLES)[number],
                      })
                    }
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-muted">Display mode</span>
                  <select
                    className="ac-input"
                    value={invite.uiMode}
                    onChange={(e) =>
                      setInvite({
                        ...invite,
                        uiMode: e.target.value as 'SIMPLE' | 'ACCOUNTANT',
                      })
                    }
                  >
                    <option value="SIMPLE">Simple</option>
                    <option value="ACCOUNTANT">Accountant</option>
                  </select>
                </label>
              </div>
              <button type="submit" className="ac-btn-primary" disabled={saving}>
                {saving ? 'Creating…' : 'Create teammate'}
              </button>
            </form>
          )}

          <div className="ac-card overflow-hidden">
            <table className="ac-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Mode</th>
                  <th>Status</th>
                  {isOwner ? <th>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td className="font-medium">{m.name}</td>
                    <td>{m.email}</td>
                    <td>
                      {isOwner && m.role !== 'OWNER' ? (
                        <select
                          className="ac-input py-1 text-xs"
                          value={m.role}
                          onChange={(e) =>
                            patchMember(m.id, { role: e.target.value })
                          }
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      ) : (
                        m.role
                      )}
                    </td>
                    <td>
                      {isOwner && m.role !== 'OWNER' ? (
                        <select
                          className="ac-input py-1 text-xs"
                          value={m.uiMode}
                          onChange={(e) =>
                            patchMember(m.id, { uiMode: e.target.value })
                          }
                        >
                          <option value="SIMPLE">Simple</option>
                          <option value="ACCOUNTANT">Accountant</option>
                        </select>
                      ) : (
                        m.uiMode
                      )}
                    </td>
                    <td>
                      <StatusBadge status={m.status} />
                    </td>
                    {isOwner ? (
                      <td className="space-x-2 whitespace-nowrap">
                        {m.role !== 'OWNER' ? (
                          <>
                            <button
                              type="button"
                              className="text-xs font-semibold text-brand"
                              onClick={() => resetPassword(m.id, m.name)}
                            >
                              Reset password
                            </button>
                            {m.status === 'ACTIVE' ? (
                              <button
                                type="button"
                                className="text-xs font-semibold text-danger"
                                onClick={() =>
                                  patchMember(m.id, { status: 'DISABLED' })
                                }
                              >
                                Deactivate
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="text-xs font-semibold text-brand"
                                onClick={() =>
                                  patchMember(m.id, { status: 'ACTIVE' })
                                }
                              >
                                Reactivate
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-muted">Owner</span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === 'backups' ? (
        <div className="space-y-6 max-w-3xl">
          {!isOwner ? (
            <p className="text-sm text-ink-soft">
              Only the organisation owner can manage backups and restore.
            </p>
          ) : (
            <>
              <div className="ac-card space-y-4 p-6">
                <h2 className="font-display text-lg font-semibold">Backup schedule</h2>
                <p className="text-sm text-ink-soft">
                  Avyro builds portable backup archives in-app (no pg_dump or external tools).
                  Each archive contains your organisation data plus uploaded files. Store locally
                  or on S3 when configured — download any completed backup as a single{' '}
                  <code className="text-xs">.tar.gz</code> file.
                </p>
                {backupSettings ? (
                  <p className="text-xs text-muted">
                    Storage target:{' '}
                    <strong>{backupSettings.storageTarget === 'S3' ? 'Amazon S3 / R2' : 'Local disk'}</strong>
                    {backupSettings.lastRunAt
                      ? ` · Last run ${new Date(backupSettings.lastRunAt).toLocaleString()}`
                      : ' · No backup run yet'}
                  </p>
                ) : null}
                <form onSubmit={saveBackupFrequency} className="flex flex-wrap items-end gap-4">
                  <label className="block text-sm">
                    <span className="mb-1 block text-muted">Frequency</span>
                    <select
                      className="ac-input min-w-[10rem]"
                      value={backupFrequency}
                      onChange={(e) =>
                        setBackupFrequency(
                          e.target.value as BackupSettings['frequency'],
                        )
                      }
                    >
                      <option value="OFF">Off</option>
                      <option value="DAILY">Daily</option>
                      <option value="WEEKLY">Weekly</option>
                      <option value="MONTHLY">Monthly</option>
                    </select>
                  </label>
                  <button type="submit" className="ac-btn-secondary" disabled={saving}>
                    Save schedule
                  </button>
                  <button
                    type="button"
                    className="ac-btn-primary"
                    disabled={backingUp}
                    onClick={() => void runBackupNow()}
                  >
                    {backingUp ? 'Starting…' : 'Backup now'}
                  </button>
                </form>
              </div>

              <div className="ac-card space-y-4 p-6">
                <h2 className="font-display text-lg font-semibold">Restore from file</h2>
                <p className="text-sm text-ink-soft">
                  Upload an Avyro backup archive (<code className="text-xs">.tar.gz</code>) downloaded
                  from this or another Avyro instance. This replaces this organisation&apos;s data
                  and uploaded files on this server.
                </p>
                <form onSubmit={restoreUploadedBackup} className="space-y-4">
                  <label className="block text-sm">
                    <span className="mb-1 block text-muted">Backup file</span>
                    <input
                      className="ac-input w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand"
                      type="file"
                      accept=".tar.gz,.tgz,.gz,application/gzip,application/x-gzip,application/x-tar"
                      required
                      onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)}
                    />
                    {restoreFile ? (
                      <p className="mt-1.5 text-xs text-muted">
                        {restoreFile.name} · {formatFileSize(restoreFile.size)}
                      </p>
                    ) : null}
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-muted">Confirmation</span>
                    <input
                      className="ac-input"
                      placeholder="Type RESTORE to confirm"
                      value={restoreConfirm}
                      onChange={(e) => setRestoreConfirm(e.target.value)}
                      required
                    />
                  </label>
                  <button
                    type="submit"
                    className="ac-btn-primary"
                    disabled={
                      restoring ||
                      !restoreFile ||
                      restoreConfirm !== 'RESTORE'
                    }
                  >
                    {restoring ? 'Restoring…' : 'Restore backup'}
                  </button>
                  {restoring ? (
                    <p className="text-xs text-muted">
                      Uploading and restoring — this may take a minute for large archives.
                    </p>
                  ) : null}
                </form>
                <p className="text-xs text-muted">
                  All users should sign out first. This cannot be undone.
                </p>
              </div>

              <div className="ac-card overflow-hidden">
                <div className="border-b border-line px-4 py-3">
                  <h2 className="font-display text-lg font-semibold">Recent backups</h2>
                </div>
                <table className="ac-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>File</th>
                      <th>Size</th>
                      <th>Storage</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backups.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-muted">
                          No backups yet. Run &quot;Backup now&quot; to create one.
                        </td>
                      </tr>
                    ) : (
                      backups.map((b) => (
                        <tr key={b.id}>
                          <td className="whitespace-nowrap text-sm">
                            {new Date(b.createdAt).toLocaleString()}
                          </td>
                          <td className="max-w-[12rem] truncate text-sm">{b.filename}</td>
                          <td className="text-sm">{formatBytes(b.sizeBytes)}</td>
                          <td className="text-sm">{b.storage}</td>
                          <td>
                            <StatusBadge status={b.status} />
                          </td>
                          <td>
                            {b.status === 'COMPLETED' ? (
                              <a
                                href={`/api/v1/backups/${b.id}/download`}
                                className="text-xs font-semibold text-brand"
                              >
                                Download
                              </a>
                            ) : b.errorMessage ? (
                              <span className="text-xs text-danger">{b.errorMessage}</span>
                            ) : (
                              <span className="text-xs text-muted">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      ) : null}

      {tab === 'security' ? (
        <div className="space-y-6">
          <form onSubmit={changePassword} className="ac-card max-w-md space-y-4 p-6">
            <h2 className="font-display text-lg font-semibold">Change password</h2>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Current password</span>
            <input
              className="ac-input"
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) =>
                setPasswordForm({
                  ...passwordForm,
                  currentPassword: e.target.value,
                })
              }
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">New password</span>
            <input
              className="ac-input"
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, newPassword: e.target.value })
              }
              minLength={8}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Confirm new password</span>
            <input
              className="ac-input"
              type="password"
              value={passwordForm.confirm}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, confirm: e.target.value })
              }
              minLength={8}
              required
            />
          </label>
          <button type="submit" className="ac-btn-primary" disabled={saving}>
            {saving ? 'Updating…' : 'Update password'}
          </button>
          </form>

          <div className="ac-card max-w-md space-y-3 p-6">
            <h2 className="font-display text-lg font-semibold">Sign out</h2>
            <p className="text-sm text-ink-soft">
              End your session on this device. You will need to sign in again to continue.
            </p>
            <SignOutButton variant="button" />
          </div>
        </div>
      ) : null}

      {tab === 'display' ? (
        <div className="space-y-6">
          <div className="ac-card max-w-lg space-y-4 p-6">
            <h2 className="font-display text-lg font-semibold">Appearance</h2>
            <p className="text-sm text-ink-soft">
              Choose light or dark theme, or match your device. Dark is the default Avyro look —
              deep navy surfaces with cyan-to-purple gradients.
            </p>
            <div className="flex flex-wrap gap-3">
              {(['DARK', 'LIGHT', 'SYSTEM'] as const).map((scheme) => (
                <button
                  key={scheme}
                  type="button"
                  className={
                    colorScheme === scheme ? 'ac-btn-primary' : 'ac-btn-secondary'
                  }
                  onClick={() => saveColorScheme(scheme)}
                >
                  {scheme === 'DARK' ? 'Dark' : scheme === 'LIGHT' ? 'Light' : 'System'}
                </button>
              ))}
            </div>
          </div>

          <div className="ac-card max-w-lg space-y-4 p-6">
            <h2 className="font-display text-lg font-semibold">Display mode</h2>
            <p className="text-sm text-ink-soft">
              Simple keeps the left bar focused on money in/out. Accountant mode is a
              preference for bookkeepers — ledger tools stay under Settings → More tools.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className={
                  uiMode === 'SIMPLE' ? 'ac-btn-primary' : 'ac-btn-secondary'
                }
                onClick={() => saveUiMode('SIMPLE')}
              >
                Simple
              </button>
              <button
                type="button"
                className={
                  uiMode === 'ACCOUNTANT' ? 'ac-btn-primary' : 'ac-btn-secondary'
                }
                onClick={() => saveUiMode('ACCOUNTANT')}
              >
                Accountant
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'more' ? (
        <div className="space-y-6">
          <p className="max-w-2xl text-sm text-ink-soft">
            Secondary tools live here so the left bar stays short — like Wave’s focused
            menu, tuned for a Bangladesh sole prop (৳, TIN/BIN, Mushak).
          </p>
          {MORE_LINKS.map((group) => (
            <div key={group.group} className="ac-card overflow-hidden">
              <div className="border-b border-line bg-paper px-5 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                {group.group}
              </div>
              <div className="divide-y divide-line">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 transition hover:bg-brand-soft"
                  >
                    <div>
                      <div className="text-sm font-semibold text-ink">{item.label}</div>
                      <div className="text-xs text-muted">{item.hint}</div>
                    </div>
                    <span className="text-xs font-semibold text-brand">Open</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
