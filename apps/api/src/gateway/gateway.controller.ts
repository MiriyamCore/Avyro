import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
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
import { AuditService } from '../audit/audit.service.js';
import { GatewayService } from './gateway.service.js';

@Controller('gateway')
export class GatewayController {
  constructor(
    @Inject(GatewayService) private readonly gateway: GatewayService,
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

  @Get('providers')
  @UseGuards(SessionGuard)
  providers() {
    return this.gateway.providers();
  }

  /** Public checkout payload by token (no session). */
  @Get('checkout/:token')
  getCheckout(@Param('token') token: string) {
    return this.gateway.getByToken(token);
  }

  /** Test checkout webhook — success. */
  @Post('test/webhook/:token/succeed')
  testSucceed(@Param('token') token: string) {
    return this.gateway.testSucceed(token);
  }

  @Post('test/webhook/:token/fail')
  testFail(@Param('token') token: string) {
    return this.gateway.testFail(token);
  }

  /** Compatibility aliases for older Test checkout URLs. */
  @Post('mock/webhook/:token/succeed')
  mockSucceed(@Param('token') token: string) {
    return this.gateway.mockSucceed(token);
  }

  @Post('mock/webhook/:token/fail')
  mockFail(@Param('token') token: string) {
    return this.gateway.mockFail(token);
  }

  @Post('sslcommerz/ipn')
  sslIpn(
    @Body() body: { tran_id?: string; status?: string; val_id?: string },
  ) {
    return this.gateway.sslCommerzIpn(body);
  }

  @Get('checkouts')
  @UseGuards(SessionGuard)
  list(@CurrentOrg() current: OrgMembership | null) {
    return this.gateway.listCheckouts(this.requireOrg(current).organizationId);
  }

  @Post('checkouts')
  @UseGuards(SessionGuard)
  async create(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      invoiceId: string;
      feePercent?: string;
      provider?: 'TEST' | 'SSLCOMMERZ' | 'MOCK';
    },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    const checkout = await this.gateway.createCheckout(org.organizationId, body);
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'CREATE',
      entityType: 'GatewayCheckout',
      entityId: checkout.id,
    });
    return checkout;
  }

  @Post('checkouts/:id/settle')
  @UseGuards(SessionGuard)
  async settle(
    @Param('id') id: string,
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    const checkout = await this.gateway.settle(org.organizationId, id, user.id);
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'SETTLE',
      entityType: 'GatewayCheckout',
      entityId: checkout.id,
    });
    return checkout;
  }
}
