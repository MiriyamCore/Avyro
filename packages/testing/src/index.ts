import { PrismaClient, RoleName } from '@avyro/database';

export async function createIsolatedOrgFixture(db: PrismaClient, label: string) {
  const workspace = await db.workspace.create({
    data: {
      name: `Workspace ${label}`,
      slug: `ws-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    },
  });

  const user = await db.user.create({
    data: {
      name: `User ${label}`,
      email: `${label}-${Date.now()}@example.test`,
    },
  });

  const organization = await db.organization.create({
    data: {
      workspaceId: workspace.id,
      name: `Org ${label}`,
      countryCode: 'BD',
      baseCurrency: 'BDT',
      timezone: 'Asia/Dhaka',
      fiscalYearStartMonth: 7,
      fiscalYearStartDay: 1,
    },
  });

  await db.membership.create({
    data: {
      workspaceId: workspace.id,
      organizationId: organization.id,
      userId: user.id,
      role: RoleName.OWNER,
    },
  });

  return { workspace, user, organization };
}

export function requireOrganizationId(organizationId: string | undefined): string {
  if (!organizationId) {
    throw new Error('organizationId is required');
  }
  return organizationId;
}
