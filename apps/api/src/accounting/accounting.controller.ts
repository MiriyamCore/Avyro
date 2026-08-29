import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentOrg,
  CurrentUser,
  SessionGuard,
  type OrgMembership,
  type RequestUser,
} from '../auth/session.guard.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import { AccountingService } from './accounting.service.js';
import { OpeningBalancesService } from './opening-balances.service.js';
import { AuditService } from '../audit/audit.service.js';

@Controller()
@UseGuards(SessionGuard)
export class AccountingController {
  constructor(
    @Inject(AccountingService) private readonly accounting: AccountingService,
    @Inject(OpeningBalancesService)
    private readonly openingBalances: OpeningBalancesService,
    @Inject(OrganizationsService)
    private readonly organizations: OrganizationsService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  private requireOrg(current: OrgMembership | null): OrgMembership {
    if (!current) {
      throw new ForbiddenException({
        error: {
          code: 'NO_ORGANIZATION',
          message: 'No organisation membership found.',
        },
      });
    }
    return current;
  }

  @Get('accounts')
  listAccounts(@CurrentOrg() current: OrgMembership | null) {
    const org = this.requireOrg(current);
    return this.accounting.listAccounts(org.organizationId);
  }

  @Post('accounts')
  async createAccount(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      code: string;
      name: string;
      type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
      parentId?: string | null;
      isPostable?: boolean;
    },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'ACCOUNTANT');
    const account = await this.accounting.createAccount(org.organizationId, body);
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'CREATE',
      entityType: 'LedgerAccount',
      entityId: account.id,
    });
    return account;
  }

  @Patch('accounts/:id')
  async updateAccount(
    @Param('id') id: string,
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body() body: { name?: string; isPostable?: boolean; active?: boolean },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'ACCOUNTANT');
    return this.accounting.updateAccount(org.organizationId, id, body);
  }

  @Get('periods')
  listPeriods(@CurrentOrg() current: OrgMembership | null) {
    const org = this.requireOrg(current);
    return this.accounting.listPeriods(org.organizationId);
  }

  @Get('journals')
  listJournals(@CurrentOrg() current: OrgMembership | null) {
    const org = this.requireOrg(current);
    return this.accounting.listJournals(org.organizationId);
  }

  @Post('journals')
  async createJournal(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      entryDate: string;
      description: string;
      lines: Array<{
        accountId: string;
        description?: string;
        debitAmount?: string;
        creditAmount?: string;
      }>;
    },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'ACCOUNTANT');
    const entry = await this.accounting.createManualJournal(
      org.organizationId,
      user.id,
      body,
    );
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'POST',
      entityType: 'JournalEntry',
      entityId: entry.id,
      afterJson: { journalNumber: entry.journalNumber },
    });
    return entry;
  }

  @Post('journals/:id/reverse')
  async reverseJournal(
    @Param('id') id: string,
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'ACCOUNTANT');
    const entry = await this.accounting.reverseJournal(org.organizationId, user.id, id);
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'REVERSE',
      entityType: 'JournalEntry',
      entityId: entry.id,
      afterJson: { journalNumber: entry.journalNumber },
    });
    return entry;
  }

  @Post('opening-balances')
  async createOpeningBalances(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      entryDate: string;
      lines: Array<{
        accountId: string;
        description?: string;
        debitAmount?: string;
        creditAmount?: string;
      }>;
    },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'OWNER');
    const entry = await this.openingBalances.postOpeningBalances({
      organizationId: org.organizationId,
      userId: user.id,
      entryDate: new Date(body.entryDate),
      lines: body.lines,
    });
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'POST',
      entityType: 'OpeningBalance',
      entityId: entry.id,
      afterJson: { journalNumber: entry.journalNumber },
    });
    return entry;
  }

  @Post('opening-balances/starting-capital')
  async startingCapital(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      amount: string;
      entryDate: string;
      destination: 'cash' | 'bank';
      bankAccountId?: string;
    },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'OWNER');
    const entry = await this.openingBalances.postStartingCapital({
      organizationId: org.organizationId,
      userId: user.id,
      amount: body.amount,
      entryDate: new Date(body.entryDate),
      destination: body.destination,
      bankAccountId: body.bankAccountId,
    });
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'POST',
      entityType: 'StartingCapital',
      entityId: entry.id,
      afterJson: { journalNumber: entry.journalNumber, amount: body.amount },
    });
    return entry;
  }

  @Get('reports/trial-balance')
  trialBalance(@CurrentOrg() current: OrgMembership | null) {
    const org = this.requireOrg(current);
    return this.accounting.trialBalance(org.organizationId);
  }

  @Get('month-end')
  monthEnd(@CurrentOrg() current: OrgMembership | null) {
    return this.accounting.monthEndChecklist(this.requireOrg(current).organizationId);
  }

  @Post('periods/:id/lock')
  async lockPeriod(
    @Param('id') id: string,
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'ACCOUNTANT');
    const period = await this.accounting.lockPeriod(org.organizationId, id, user.id);
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'LOCK_PERIOD',
      entityType: 'AccountingPeriod',
      entityId: period.id,
      afterJson: { status: period.status },
    });
    return period;
  }
}
