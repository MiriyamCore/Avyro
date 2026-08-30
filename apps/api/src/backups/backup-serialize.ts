/** JSON-safe serialization for Prisma rows (Decimal, BigInt, Date). */
export function serializeForBackup(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => {
      if (typeof v === 'bigint') return v.toString();
      if (v instanceof Date) return v.toISOString();
      if (
        v !== null &&
        typeof v === 'object' &&
        'toFixed' in v &&
        typeof (v as { toFixed: unknown }).toFixed === 'function'
      ) {
        return (v as { toString: () => string }).toString();
      }
      return v;
    }),
  );
}

export type PortableBackupPayload = {
  version: 2;
  format: 'avyro-portable';
  organizationId: string;
  exportedAt: string;
  organization: unknown;
  workspace: unknown;
  memberships: unknown[];
  users: unknown[];
  accounts: unknown[];
  auditLogs: unknown[];
  documents: unknown[];
  documentLinks: unknown[];
  ledgerAccounts: unknown[];
  accountingPeriods: unknown[];
  journalEntries: unknown[];
  journalLines: unknown[];
  customers: unknown[];
  invoices: unknown[];
  invoiceItems: unknown[];
  payments: unknown[];
  expenses: unknown[];
  quotes: unknown[];
  quoteItems: unknown[];
  contracts: unknown[];
  projects: unknown[];
  suppliers: unknown[];
  bills: unknown[];
  billItems: unknown[];
  billPayments: unknown[];
  bankAccounts: unknown[];
  bankTransactions: unknown[];
  currencies: unknown[];
  exchangeRates: unknown[];
  gatewayCheckouts: unknown[];
  complianceProfile: unknown | null;
  complianceRecords: unknown[];
  taxCodes: unknown[];
  vatDocuments: unknown[];
  withholdingEntries: unknown[];
  challans: unknown[];
  serviceExportRecords: unknown[];
  people: unknown[];
  employeeCompensations: unknown[];
  assets: unknown[];
  timeEntries: unknown[];
  payrollPeriods: unknown[];
  payrollRuns: unknown[];
  payrollItems: unknown[];
  payslips: unknown[];
};
