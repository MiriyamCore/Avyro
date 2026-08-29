import {
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentOrg,
  SessionGuard,
  type OrgMembership,
} from '../auth/session.guard.js';
import { ReportsService } from './reports.service.js';

@Controller('reports')
@UseGuards(SessionGuard)
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reports: ReportsService) {}

  private requireOrg(current: OrgMembership | null): OrgMembership {
    if (!current) {
      throw new ForbiddenException({
        error: { code: 'NO_ORGANIZATION', message: 'No organisation membership found.' },
      });
    }
    return current;
  }

  @Get('dashboard')
  dashboard(@CurrentOrg() current: OrgMembership | null) {
    return this.reports.dashboard(this.requireOrg(current).organizationId);
  }

  @Get('profit-and-loss')
  pnl(
    @CurrentOrg() current: OrgMembership | null,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.profitAndLoss(this.requireOrg(current).organizationId, from, to);
  }

  @Get('balance-sheet')
  balanceSheet(
    @CurrentOrg() current: OrgMembership | null,
    @Query('asOf') asOf?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.balanceSheet(
      this.requireOrg(current).organizationId,
      asOf ?? to,
    );
  }

  @Get('general-ledger')
  gl(
    @CurrentOrg() current: OrgMembership | null,
    @Query('accountCode') accountCode?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.generalLedger(
      this.requireOrg(current).organizationId,
      accountCode,
      from,
      to,
    );
  }

  @Get('ar-aging')
  arAging(
    @CurrentOrg() current: OrgMembership | null,
    @Query('to') to?: string,
    @Query('asOf') asOf?: string,
  ) {
    return this.reports.arAging(this.requireOrg(current).organizationId, asOf ?? to);
  }

  @Get('ap-aging')
  apAging(
    @CurrentOrg() current: OrgMembership | null,
    @Query('to') to?: string,
    @Query('asOf') asOf?: string,
  ) {
    return this.reports.apAging(this.requireOrg(current).organizationId, asOf ?? to);
  }

  @Get('revenue-by-customer')
  revenueByCustomer(
    @CurrentOrg() current: OrgMembership | null,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.revenueByCustomer(this.requireOrg(current).organizationId, from, to);
  }

  @Get('expense-by-category')
  expenseByCategory(
    @CurrentOrg() current: OrgMembership | null,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.expenseByCategory(this.requireOrg(current).organizationId, from, to);
  }

  @Get('cash-flow')
  cashFlow(
    @CurrentOrg() current: OrgMembership | null,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.cashFlow(this.requireOrg(current).organizationId, from, to);
  }

  @Get('related-party')
  relatedParty(
    @CurrentOrg() current: OrgMembership | null,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.relatedParty(this.requireOrg(current).organizationId, from, to);
  }

  @Get('export-revenue')
  exportRevenue(
    @CurrentOrg() current: OrgMembership | null,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.exportRevenue(this.requireOrg(current).organizationId, from, to);
  }

  @Get('project-profitability')
  projectProfitability(
    @CurrentOrg() current: OrgMembership | null,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.projectProfitability(this.requireOrg(current).organizationId, from, to);
  }
}
