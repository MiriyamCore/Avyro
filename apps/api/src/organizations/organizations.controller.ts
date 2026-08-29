import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import {
  CurrentOrg,
  CurrentUser,
  SessionGuard,
  type OrgMembership,
  type RequestUser,
} from '../auth/session.guard.js';
import { OrganizationsService } from './organizations.service.js';
import { AuditService } from '../audit/audit.service.js';

@Controller('organizations')
@UseGuards(SessionGuard)
export class OrganizationsController {
  constructor(
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

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.organizations.listForUser(user.id);
  }

  @Get('current')
  current(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
  ) {
    const org = this.requireOrg(current);
    return this.organizations.getByIdForUser(org.organizationId, user.id);
  }

  @Put('current')
  async updateCurrent(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      name?: string;
      legalName?: string | null;
      legalType?: string;
      businessActivity?: string | null;
      countryCode?: string;
      baseCurrency?: string;
      timezone?: string;
      fiscalYearStartMonth?: number;
      fiscalYearStartDay?: number;
      address?: string | null;
      phone?: string | null;
      email?: string | null;
      website?: string | null;
      logoUrl?: string | null;
      taxIdentifier?: string | null;
      vatIdentifier?: string | null;
      tradeLicenseNumber?: string | null;
      invoicePrefix?: string | null;
      quotePrefix?: string | null;
      invoiceFooter?: string | null;
      invoicePrimaryColor?: string | null;
      invoiceAccentColor?: string | null;
      invoiceTemplate?: string | null;
      defaultPaymentTermsDays?: number;
      markSetupComplete?: boolean;
    },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    const updated = await this.organizations.updateSettings(org.organizationId, body);
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Organization',
      entityId: updated.id,
      afterJson: {
        name: updated.name,
        setupCompletedAt: updated.setupCompletedAt,
      },
    });
    return updated;
  }

  @Post('current/logo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadLogo(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    const updated = await this.organizations.uploadLogo(org.organizationId, file);
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Organization',
      entityId: updated.id,
      afterJson: { logoUrl: updated.logoUrl },
    });
    return {
      logoUrl: updated.logoUrl,
      publicPath: '/api/v1/organizations/current/logo',
    };
  }

  @Get('current/logo')
  async getLogo(
    @CurrentOrg() current: OrgMembership | null,
    @Res() res: Response,
  ) {
    const org = this.requireOrg(current);
    const { body, contentType } = await this.organizations.getLogo(org.organizationId);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(body);
  }

  @Delete('current/logo')
  async clearLogo(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    const updated = await this.organizations.clearLogo(org.organizationId);
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Organization',
      entityId: updated.id,
      afterJson: { logoUrl: null },
    });
    return { ok: true };
  }

  @Get('current/summary')
  currentSummary(@CurrentOrg() current: OrgMembership | null) {
    return this.requireOrg(current);
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.organizations.getByIdForUser(id, user.id);
  }
}
