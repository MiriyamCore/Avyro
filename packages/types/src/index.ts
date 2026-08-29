export type RoleName =
  | 'OWNER'
  | 'ACCOUNTANT'
  | 'MANAGER'
  | 'EMPLOYEE'
  | 'AUDITOR';

export type UiMode = 'SIMPLE' | 'ACCOUNTANT';

export type OrganizationStatus = 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

export type JournalStatus = 'DRAFT' | 'POSTED' | 'REVERSED';

export type PeriodStatus = 'OPEN' | 'SOFT_CLOSED' | 'LOCKED';

export type AccountType =
  | 'ASSET'
  | 'LIABILITY'
  | 'EQUITY'
  | 'REVENUE'
  | 'EXPENSE';

export interface OrganizationContext {
  organizationId: string;
  userId: string;
  role: RoleName;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
