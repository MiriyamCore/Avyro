import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { AccountType, RoleName, UiMode } from '../src/generated/prisma/client.js';
import { hashPassword } from 'better-auth/crypto';
import { prisma } from '../src/index.js';

const envPath = resolve(import.meta.dirname, '../../../.env');
if (existsSync(envPath)) {
  loadEnv({ path: envPath, override: false });
}

/** Better Auth 1.7 local credential issuer (`createLocalAccountIssuer('credential')`). */
const credentialIssuer = 'local:credential';

type SeedAccount = {
  code: string;
  name: string;
  type: AccountType;
  parentCode?: string;
  isPostable?: boolean;
};

/** Default CoA including Bangladesh VAT/TDS/VDS/FX/ERQ accounts (SPEC §11 + §151.13). */
const DEFAULT_ACCOUNTS: SeedAccount[] = [
  { code: '1000', name: 'Assets', type: 'ASSET', isPostable: false },
  { code: '1100', name: 'Cash & Bank', type: 'ASSET', parentCode: '1000', isPostable: false },
  { code: '1101', name: 'Cash', type: 'ASSET', parentCode: '1100' },
  { code: '1110', name: 'EBL Business BDT', type: 'ASSET', parentCode: '1100' },
  { code: '1120', name: 'Payment Gateway Clearing', type: 'ASSET', parentCode: '1100' },
  { code: '1130', name: 'Foreign Currency Account', type: 'ASSET', parentCode: '1100' },
  { code: '1140', name: 'ERQ / FC Retention', type: 'ASSET', parentCode: '1100' },
  { code: '1200', name: 'Accounts Receivable', type: 'ASSET', parentCode: '1000' },
  { code: '1210', name: 'VAT Receivable / ITC', type: 'ASSET', parentCode: '1000' },
  { code: '1300', name: 'Prepayments', type: 'ASSET', parentCode: '1000' },
  { code: '1400', name: 'Deposits', type: 'ASSET', parentCode: '1000' },
  { code: '1500', name: 'Fixed Assets', type: 'ASSET', parentCode: '1000', isPostable: false },
  { code: '1510', name: 'Computers', type: 'ASSET', parentCode: '1500' },
  { code: '1520', name: 'Office Equipment', type: 'ASSET', parentCode: '1500' },
  { code: '1530', name: 'Furniture', type: 'ASSET', parentCode: '1500' },
  { code: '1600', name: 'Accumulated Depreciation', type: 'ASSET', parentCode: '1000' },

  { code: '2000', name: 'Liabilities', type: 'LIABILITY', isPostable: false },
  { code: '2100', name: 'Accounts Payable', type: 'LIABILITY', parentCode: '2000' },
  { code: '2200', name: 'Tax Payable', type: 'LIABILITY', parentCode: '2000' },
  { code: '2210', name: 'VAT Payable', type: 'LIABILITY', parentCode: '2000' },
  { code: '2220', name: 'Withholding Tax Payable', type: 'LIABILITY', parentCode: '2000' },
  { code: '2230', name: 'TDS Payable', type: 'LIABILITY', parentCode: '2000' },
  { code: '2240', name: 'VDS Payable', type: 'LIABILITY', parentCode: '2000' },
  { code: '2250', name: 'Reverse Charge VAT Control', type: 'LIABILITY', parentCode: '2000' },
  { code: '2300', name: 'Payroll Payable', type: 'LIABILITY', parentCode: '2000' },
  { code: '2400', name: 'Accrued Expenses', type: 'LIABILITY', parentCode: '2000' },

  { code: '3000', name: "Owner's Equity", type: 'EQUITY', isPostable: false },
  { code: '3100', name: 'Owner Capital', type: 'EQUITY', parentCode: '3000' },
  { code: '3200', name: 'Owner Drawings', type: 'EQUITY', parentCode: '3000' },
  { code: '3300', name: 'Retained Earnings / Current Earnings', type: 'EQUITY', parentCode: '3000' },
  { code: '3400', name: 'FX Gain', type: 'REVENUE', parentCode: '3000' },
  { code: '3500', name: 'FX Loss', type: 'EXPENSE', parentCode: '3000' },

  { code: '4000', name: 'Revenue', type: 'REVENUE', isPostable: false },
  { code: '4100', name: 'Software Development', type: 'REVENUE', parentCode: '4000' },
  { code: '4200', name: 'Software Consultancy', type: 'REVENUE', parentCode: '4000' },
  { code: '4300', name: 'SaaS Revenue', type: 'REVENUE', parentCode: '4000' },
  { code: '4400', name: 'Maintenance & Support', type: 'REVENUE', parentCode: '4000' },
  { code: '4500', name: 'Domestic Service Revenue', type: 'REVENUE', parentCode: '4000' },
  { code: '4600', name: 'Export Service Revenue', type: 'REVENUE', parentCode: '4000' },
  { code: '4700', name: 'Other Revenue', type: 'REVENUE', parentCode: '4000' },

  { code: '5000', name: 'Direct Costs', type: 'EXPENSE', isPostable: false },
  { code: '5100', name: 'Subcontractors', type: 'EXPENSE', parentCode: '5000' },
  { code: '5200', name: 'Client Infrastructure', type: 'EXPENSE', parentCode: '5000' },
  { code: '5300', name: 'Project Software', type: 'EXPENSE', parentCode: '5000' },
  { code: '5400', name: 'Payment Processing Fees', type: 'EXPENSE', parentCode: '5000' },

  { code: '6000', name: 'Operating Expenses', type: 'EXPENSE', isPostable: false },
  { code: '6100', name: 'Salaries', type: 'EXPENSE', parentCode: '6000' },
  { code: '6200', name: 'Office Rent', type: 'EXPENSE', parentCode: '6000' },
  { code: '6300', name: 'Electricity', type: 'EXPENSE', parentCode: '6000' },
  { code: '6400', name: 'Internet', type: 'EXPENSE', parentCode: '6000' },
  { code: '6500', name: 'Telephone', type: 'EXPENSE', parentCode: '6000' },
  { code: '6600', name: 'Hosting & Servers', type: 'EXPENSE', parentCode: '6000' },
  { code: '6700', name: 'Software Subscriptions', type: 'EXPENSE', parentCode: '6000' },
  { code: '6800', name: 'Domains', type: 'EXPENSE', parentCode: '6000' },
  { code: '6900', name: 'Accounting & Legal', type: 'EXPENSE', parentCode: '6000' },
  { code: '6910', name: 'Banking Fees', type: 'EXPENSE', parentCode: '6000' },
  { code: '6920', name: 'Marketing', type: 'EXPENSE', parentCode: '6000' },
  { code: '6930', name: 'Equipment', type: 'EXPENSE', parentCode: '6000' },
  { code: '6940', name: 'Travel', type: 'EXPENSE', parentCode: '6000' },
  { code: '6950', name: 'Miscellaneous', type: 'EXPENSE', parentCode: '6000' },
  { code: '6960', name: 'Depreciation', type: 'EXPENSE', parentCode: '6000' },
];

async function seedChartOfAccounts(organizationId: string) {
  const byCode = new Map<string, string>();

  for (const account of DEFAULT_ACCOUNTS) {
    const parentId = account.parentCode ? byCode.get(account.parentCode) : undefined;
    const created = await prisma.ledgerAccount.create({
      data: {
        organizationId,
        code: account.code,
        name: account.name,
        type: account.type,
        parentId: parentId ?? null,
        isPostable: account.isPostable ?? true,
        isSystem: true,
      },
    });
    byCode.set(account.code, created.id);
  }
}

async function main() {
  const email = process.env.SEED_OWNER_EMAIL ?? 'owner@demo.local';
  const password = process.env.SEED_OWNER_PASSWORD ?? 'ChangeMeNow1!';
  const name = process.env.SEED_OWNER_NAME ?? 'Demo Owner';
  const workspaceName = process.env.SEED_WORKSPACE_NAME ?? 'Demo Workspace';
  const workspaceSlug = process.env.SEED_WORKSPACE_SLUG ?? 'demo-workspace';
  const orgName = process.env.SEED_ORG_NAME ?? 'Demo Trading Co';
  const includeDemoData =
    (process.env.SEED_DEMO_DATA ??
      (process.env.NODE_ENV === 'production' ? 'false' : 'true')) === 'true';

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email },
    update: { name, emailVerified: true },
    create: {
      email,
      name,
      emailVerified: true,
    },
  });

  const existingCredential = await prisma.account.findFirst({
    where: { userId: user.id, providerId: 'credential', issuer: credentialIssuer },
  });

  if (existingCredential) {
    await prisma.account.update({
      where: { id: existingCredential.id },
      data: { accountId: user.id, password: passwordHash },
    });
  } else {
    await prisma.account.create({
      data: {
        userId: user.id,
        accountId: user.id,
        providerId: 'credential',
        issuer: credentialIssuer,
        password: passwordHash,
      },
    });
  }

  const workspace = await prisma.workspace.upsert({
    where: { slug: workspaceSlug },
    update: { name: workspaceName },
    create: {
      name: workspaceName,
      slug: workspaceSlug,
    },
  });

  let organization = await prisma.organization.findFirst({
    where: { workspaceId: workspace.id, name: orgName },
  });

  if (!organization) {
    organization = await prisma.organization.create({
      data: {
        workspaceId: workspace.id,
        name: orgName,
        legalName: orgName,
        legalType: 'Sole Proprietorship',
        businessActivity: 'General Trading',
        countryCode: 'BD',
        baseCurrency: 'BDT',
        timezone: 'Asia/Dhaka',
        fiscalYearStartMonth: 7,
        fiscalYearStartDay: 1,
        // Do not seed real TIN/BIN
        taxIdentifier: null,
        vatIdentifier: null,
      },
    });
  }

  await prisma.membership.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: user.id,
      },
    },
    update: {
      role: RoleName.OWNER,
      status: 'ACTIVE',
      uiMode: UiMode.SIMPLE,
    },
    create: {
      workspaceId: workspace.id,
      organizationId: organization.id,
      userId: user.id,
      role: RoleName.OWNER,
      uiMode: UiMode.SIMPLE,
      status: 'ACTIVE',
    },
  });

  const accountCount = await prisma.ledgerAccount.count({
    where: { organizationId: organization.id },
  });
  if (accountCount === 0) {
    await seedChartOfAccounts(organization.id);
  }

  // Opening fiscal period for current BD income year slice (dev convenience)
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  const existingPeriod = await prisma.accountingPeriod.findFirst({
    where: {
      organizationId: organization.id,
      startDate: monthStart,
      endDate: monthEnd,
    },
  });
  if (!existingPeriod) {
    await prisma.accountingPeriod.create({
      data: {
        organizationId: organization.id,
        name: monthStart.toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
        startDate: monthStart,
        endDate: monthEnd,
        status: 'OPEN',
      },
    });
  }

  if (includeDemoData) {
    const inoryum = await prisma.customer.findFirst({
      where: { organizationId: organization.id, name: 'Inoryum Ltd' },
    });
    if (!inoryum) {
      await prisma.customer.create({
        data: {
          organizationId: organization.id,
          customerNumber: 'CUS-0001',
          name: 'Inoryum Ltd',
          legalName: 'Inoryum Ltd',
          type: 'BUSINESS',
          countryCode: 'GB',
          defaultCurrency: 'GBP',
          isRelatedParty: true,
          email: 'billing@inoryum.example',
          notes: 'Related-party UK customer (SPEC seed)',
        },
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      organizationId: organization.id,
      userId: user.id,
      action: 'SEED',
      entityType: 'Organization',
      entityId: organization.id,
      afterJson: { name: organization.name },
    },
  });

  console.log('Seed complete');
  console.log(`  Owner: ${email}`);
  console.log(`  Organisation: ${organization.name} (${organization.id})`);
  if (includeDemoData) {
    console.log('  Related-party customer: Inoryum Ltd (GBP)');
  }
  console.log('  TIN/BIN left empty (owner must enter real values)');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
