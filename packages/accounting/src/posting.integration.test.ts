import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '@avyro/database';
import { AccountingError, AccountingPostingService } from './index.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)('AccountingPostingService integration', () => {
  const posting = new AccountingPostingService(prisma);
  let organizationId = '';
  let cashId = '';
  let capitalId = '';

  afterAll(async () => {
    if (organizationId) {
      await prisma.journalLine.deleteMany({ where: { organizationId } });
      await prisma.journalEntry.deleteMany({ where: { organizationId } });
      await prisma.ledgerAccount.deleteMany({ where: { organizationId } });
      await prisma.organization.deleteMany({ where: { id: organizationId } });
    }
    await prisma.$disconnect();
  });

  it('posts a balanced owner contribution and keeps trial balance balanced', async () => {
    const workspace = await prisma.workspace.create({
      data: {
        name: 'Posting WS',
        slug: `posting-${Date.now()}`,
      },
    });
    const organization = await prisma.organization.create({
      data: {
        workspaceId: workspace.id,
        name: 'Posting Org',
        fiscalYearStartMonth: 7,
        fiscalYearStartDay: 1,
      },
    });
    organizationId = organization.id;

    const cash = await prisma.ledgerAccount.create({
      data: {
        organizationId,
        code: '1101',
        name: 'Cash',
        type: 'ASSET',
      },
    });
    const capital = await prisma.ledgerAccount.create({
      data: {
        organizationId,
        code: '3100',
        name: 'Owner Capital',
        type: 'EQUITY',
      },
    });
    cashId = cash.id;
    capitalId = capital.id;

    const entry = await posting.createJournal({
      organizationId,
      entryDate: new Date('2026-08-01'),
      description: 'Owner contribution',
      sourceType: 'owner_contribution',
      lines: [
        { accountId: cashId, debitAmount: '100000.00' },
        { accountId: capitalId, creditAmount: '100000.00' },
      ],
    });

    expect(entry.status).toBe('POSTED');
    expect(entry.lines).toHaveLength(2);

    const tb = await posting.trialBalance(organizationId);
    expect(tb.balanced).toBe(true);
    expect(tb.totalDebit).toBe('100000.000000');
    expect(tb.totalCredit).toBe('100000.000000');
  });

  it('rejects unbalanced journals', async () => {
    await expect(
      posting.createJournal({
        organizationId,
        entryDate: new Date('2026-08-02'),
        description: 'Bad',
        lines: [
          { accountId: cashId, debitAmount: '10' },
          { accountId: capitalId, creditAmount: '9' },
        ],
      }),
    ).rejects.toBeInstanceOf(AccountingError);
  });

  it('reverses a posted journal without editing the original lines in place', async () => {
    const original = await prisma.journalEntry.findFirst({
      where: { organizationId, status: 'POSTED' },
      include: { lines: true },
    });
    expect(original).toBeTruthy();

    const reversal = await posting.reverseJournal({
      organizationId,
      journalEntryId: original!.id,
      reason: 'Correction',
    });

    expect(reversal.status).toBe('POSTED');
    const refreshed = await prisma.journalEntry.findUnique({ where: { id: original!.id } });
    expect(refreshed?.status).toBe('REVERSED');

    const tb = await posting.trialBalance(organizationId);
    expect(tb.balanced).toBe(true);
    expect(tb.totalDebit).toBe(tb.totalCredit);
  });
});
