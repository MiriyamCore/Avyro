'use client';

import { ReactNode, useEffect, useState } from 'react';
import { AppShell } from '@/components/ui';
import { api, setActiveOrganizationId } from '@/lib/api';
import {
  applyColorScheme,
  COLOR_SCHEME_EVENT,
  type ColorSchemePreference,
  DEFAULT_COLOR_SCHEME,
} from '@/lib/theme';

type MeResponse = {
  user: { name: string; colorScheme?: ColorSchemePreference };
  memberships: Array<{
    organizationId: string;
    organizationName: string;
    role: 'OWNER' | 'ACCOUNTANT' | 'MANAGER' | 'EMPLOYEE' | 'AUDITOR';
    uiMode: 'SIMPLE' | 'ACCOUNTANT';
  }>;
  currentOrganization: {
    organizationId: string;
    organizationName: string;
    role: 'OWNER' | 'ACCOUNTANT' | 'MANAGER' | 'EMPLOYEE' | 'AUDITOR';
    uiMode: 'SIMPLE' | 'ACCOUNTANT';
  } | null;
};

type OrgResponse = {
  logoUrl?: string | null;
};

export default function AuthenticatedAppLayout({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [hasLogo, setHasLogo] = useState(false);

  useEffect(() => {
    api<MeResponse>('/api/v1/me')
      .then((data) => {
        setMe(data);
        if (data.currentOrganization?.organizationId) {
          setActiveOrganizationId(data.currentOrganization.organizationId);
        }
        const scheme = data.user.colorScheme ?? DEFAULT_COLOR_SCHEME;
        applyColorScheme(scheme);
      })
      .catch(() => setMe(null));
    api<OrgResponse>('/api/v1/organizations/current')
      .then((org) => setHasLogo(Boolean(org.logoUrl)))
      .catch(() => setHasLogo(false));
  }, []);

  useEffect(() => {
    function onColorScheme(event: Event) {
      const detail = (event as CustomEvent<ColorSchemePreference>).detail;
      if (detail === 'LIGHT' || detail === 'DARK' || detail === 'SYSTEM') {
        applyColorScheme(detail);
      }
    }

    window.addEventListener(COLOR_SCHEME_EVENT, onColorScheme);
    return () => window.removeEventListener(COLOR_SCHEME_EVENT, onColorScheme);
  }, []);

  return (
    <AppShell
      orgName={me?.currentOrganization?.organizationName}
      userName={me?.user.name}
      uiMode={me?.currentOrganization?.uiMode ?? 'SIMPLE'}
      role={me?.currentOrganization?.role}
      memberships={me?.memberships ?? []}
      hasLogo={hasLogo}
    >
      {children}
    </AppShell>
  );
}
