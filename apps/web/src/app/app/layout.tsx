'use client';

import { ReactNode, useEffect, useState } from 'react';
import { AppShell } from '@/components/ui';
import { api, setActiveOrganizationId } from '@/lib/api';

type MeResponse = {
  user: { name: string };
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
      })
      .catch(() => setMe(null));
    api<OrgResponse>('/api/v1/organizations/current')
      .then((org) => setHasLogo(Boolean(org.logoUrl)))
      .catch(() => setHasLogo(false));
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
