import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '@avyro/database';
import { createIsolatedOrgFixture } from './index.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)('organisation isolation', () => {
  const createdOrgIds: string[] = [];

  afterAll(async () => {
    for (const id of createdOrgIds) {
      await prisma.organization.deleteMany({ where: { id } });
    }
    await prisma.$disconnect();
  });

  it('does not return another organisation ledger accounts', async () => {
    const a = await createIsolatedOrgFixture(prisma, 'a');
    const b = await createIsolatedOrgFixture(prisma, 'b');
    createdOrgIds.push(a.organization.id, b.organization.id);

    await prisma.ledgerAccount.create({
      data: {
        organizationId: a.organization.id,
        code: '1101',
        name: 'Cash A',
        type: 'ASSET',
      },
    });

    await prisma.ledgerAccount.create({
      data: {
        organizationId: b.organization.id,
        code: '1101',
        name: 'Cash B',
        type: 'ASSET',
      },
    });

    const scopedToA = await prisma.ledgerAccount.findMany({
      where: { organizationId: a.organization.id },
    });

    expect(scopedToA).toHaveLength(1);
    expect(scopedToA[0]?.name).toBe('Cash A');
    expect(scopedToA.every((row) => row.organizationId === a.organization.id)).toBe(true);
  });

  it('rejects cross-organisation journal account usage pattern', async () => {
    const a = await createIsolatedOrgFixture(prisma, 'cross-a');
    const b = await createIsolatedOrgFixture(prisma, 'cross-b');
    createdOrgIds.push(a.organization.id, b.organization.id);

    const foreignAccount = await prisma.ledgerAccount.create({
      data: {
        organizationId: b.organization.id,
        code: '4100',
        name: 'Revenue B',
        type: 'REVENUE',
      },
    });

    const accountsInA = await prisma.ledgerAccount.findMany({
      where: {
        organizationId: a.organization.id,
        id: foreignAccount.id,
      },
    });

    expect(accountsInA).toHaveLength(0);
  });
});
