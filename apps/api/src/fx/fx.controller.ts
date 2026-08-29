import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Post,
  Query,
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
import { AuditService } from '../audit/audit.service.js';
import { FxService } from './fx.service.js';

@Controller('fx')
@UseGuards(SessionGuard)
export class FxController {
  constructor(
    @Inject(FxService) private readonly fx: FxService,
    @Inject(OrganizationsService)
    private readonly organizations: OrganizationsService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  private requireOrg(current: OrgMembership | null): OrgMembership {
    if (!current) {
      throw new ForbiddenException({
        error: { code: 'NO_ORGANIZATION', message: 'No organisation membership found.' },
      });
    }
    return current;
  }

  @Get('currencies')
  listCurrencies(@CurrentOrg() current: OrgMembership | null) {
    return this.fx.listCurrencies(this.requireOrg(current).organizationId);
  }

  @Post('currencies/ensure-defaults')
  async ensureDefaults(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    return this.fx.ensureDefaults(org.organizationId);
  }

  @Get('rates')
  listRates(
    @CurrentOrg() current: OrgMembership | null,
    @Query('currency') currency?: string,
  ) {
    return this.fx.listRates(this.requireOrg(current).organizationId, currency);
  }

  @Get('rates/lookup')
  lookup(
    @CurrentOrg() current: OrgMembership | null,
    @Query('currency') currency: string,
    @Query('date') date: string,
  ) {
    return this.fx.rateOnDate(
      this.requireOrg(current).organizationId,
      currency,
      date || new Date().toISOString().slice(0, 10),
    );
  }

  @Post('rates')
  async setRate(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body()
    body: { currencyCode: string; rateDate: string; rateToBase: string; source?: string },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    const rate = await this.fx.setRate(org.organizationId, body);
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'UPSERT',
      entityType: 'ExchangeRate',
      entityId: rate.id,
      afterJson: { currency: body.currencyCode, rateToBase: body.rateToBase },
    });
    return rate;
  }
}
