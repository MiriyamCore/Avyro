import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
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
import { OrganizationsService } from '../organizations/organizations.service.js';
import { AuditService } from '../audit/audit.service.js';
import { OperationsService } from './operations.service.js';

@Controller()
@UseGuards(SessionGuard)
export class OperationsController {
  constructor(
    @Inject(OperationsService) private readonly ops: OperationsService,
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

  @Get('people')
  listPeople(@CurrentOrg() current: OrgMembership | null) {
    return this.ops.listPeople(this.requireOrg(current).organizationId);
  }

  @Get('people/:id')
  getPerson(
    @Param('id') id: string,
    @CurrentOrg() current: OrgMembership | null,
  ) {
    return this.ops.getPerson(this.requireOrg(current).organizationId, id);
  }

  @Post('people')
  async createPerson(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      name: string;
      email?: string;
      phone?: string;
      title?: string;
      nationalId?: string;
      taxIdentifier?: string;
      address?: string;
      bankName?: string;
      bankAccountNumber?: string;
      emergencyContactName?: string;
      emergencyContactPhone?: string;
      hireDate?: string;
      terminationDate?: string;
      status?: 'ACTIVE' | 'INACTIVE' | 'TERMINATED';
      grossPay?: string;
      tdsPercent?: string;
    },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    const person = await this.ops.createPerson(org.organizationId, body);
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'CREATE',
      entityType: 'Person',
      entityId: person.id,
    });
    return person;
  }

  @Patch('people/:id')
  async updatePerson(
    @Param('id') id: string,
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      name?: string;
      email?: string | null;
      phone?: string | null;
      title?: string | null;
      nationalId?: string | null;
      taxIdentifier?: string | null;
      address?: string | null;
      bankName?: string | null;
      bankAccountNumber?: string | null;
      emergencyContactName?: string | null;
      emergencyContactPhone?: string | null;
      hireDate?: string | null;
      terminationDate?: string | null;
      status?: 'ACTIVE' | 'INACTIVE' | 'TERMINATED';
      grossPay?: string;
      tdsPercent?: string | null;
    },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    const person = await this.ops.updatePerson(org.organizationId, id, body);
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Person',
      entityId: person.id,
    });
    return person;
  }

  @Post('people/:id/photo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadPersonPhoto(
    @Param('id') id: string,
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    const person = await this.ops.uploadPersonPhoto(org.organizationId, id, file);
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Person',
      entityId: person.id,
      afterJson: { photoUrl: person.photoUrl },
    });
    return {
      photoUrl: person.photoUrl,
      publicPath: `/api/v1/people/${person.id}/photo`,
    };
  }

  @Get('people/:id/photo')
  async getPersonPhoto(
    @Param('id') id: string,
    @CurrentOrg() current: OrgMembership | null,
    @Res() res: Response,
  ) {
    const org = this.requireOrg(current);
    const { body, contentType } = await this.ops.getPersonPhoto(org.organizationId, id);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(body);
  }

  @Post('people/:id/nid')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadPersonNid(
    @Param('id') id: string,
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    const person = await this.ops.uploadPersonNid(org.organizationId, id, file);
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Person',
      entityId: person.id,
      afterJson: { nidDocumentUrl: person.nidDocumentUrl },
    });
    return {
      nidDocumentUrl: person.nidDocumentUrl,
      publicPath: `/api/v1/people/${person.id}/nid`,
    };
  }

  @Get('people/:id/nid')
  async getPersonNid(
    @Param('id') id: string,
    @CurrentOrg() current: OrgMembership | null,
    @Res() res: Response,
  ) {
    const org = this.requireOrg(current);
    const { body, contentType, filename } = await this.ops.getPersonNid(org.organizationId, id);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(body);
  }

  @Get('assets')
  listAssets(@CurrentOrg() current: OrgMembership | null) {
    return this.ops.listAssets(this.requireOrg(current).organizationId);
  }

  @Post('assets')
  async createAsset(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      name: string;
      category?: string;
      cost: string;
      purchaseDate: string;
      serialNumber?: string;
      assignedToId?: string;
      notes?: string;
      usefulLifeMonths?: number;
      salvageValue?: string;
      depreciationMethod?: string;
    },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    const asset = await this.ops.createAsset(org.organizationId, body);
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'CREATE',
      entityType: 'Asset',
      entityId: asset.id,
    });
    return asset;
  }

  @Post('assets/:id/depreciate')
  async depreciateAsset(
    @Param('id') id: string,
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body() body: { period: string },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'ACCOUNTANT');
    const result = await this.ops.depreciateAsset(
      org.organizationId,
      user.id,
      id,
      body.period,
    );
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'POST',
      entityType: 'AssetDepreciation',
      entityId: id,
      afterJson: result,
    });
    return result;
  }

  @Get('time-entries')
  listTime(@CurrentOrg() current: OrgMembership | null) {
    return this.ops.listTimeEntries(this.requireOrg(current).organizationId);
  }

  @Post('time-entries')
  async createTime(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      personId: string;
      projectId?: string;
      entryDate: string;
      hours: string;
      description?: string;
      billable?: boolean;
      billingRate?: string;
    },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    return this.ops.createTimeEntry(org.organizationId, body);
  }

  @Get('payroll/periods')
  listPeriods(@CurrentOrg() current: OrgMembership | null) {
    return this.ops.listPayrollPeriods(this.requireOrg(current).organizationId);
  }

  @Post('payroll/periods')
  async createPeriod(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body() body: { name: string; startDate: string; endDate: string },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    return this.ops.createPayrollPeriod(org.organizationId, body);
  }

  @Get('payroll/runs')
  listRuns(@CurrentOrg() current: OrgMembership | null) {
    return this.ops.listPayrollRuns(this.requireOrg(current).organizationId);
  }

  @Post('payroll/runs')
  async createRun(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body() body: { periodId: string; runDate: string; notes?: string },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    const run = await this.ops.createPayrollRun(org.organizationId, body);
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'CREATE',
      entityType: 'PayrollRun',
      entityId: run.id,
    });
    return run;
  }

  @Post('payroll/runs/:id/post')
  async postRun(
    @Param('id') id: string,
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'ACCOUNTANT');
    const run = await this.ops.postPayrollRun(org.organizationId, user.id, id);
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'POST',
      entityType: 'PayrollRun',
      entityId: run.id,
      afterJson: { journalEntryId: run.journalEntryId },
    });
    return run;
  }

  @Get('payroll/runs/:runId/payslips/:personId/pdf')
  async payslipPdf(
    @Param('runId') runId: string,
    @Param('personId') personId: string,
    @CurrentOrg() current: OrgMembership | null,
    @Res({ passthrough: true }) res: Response,
  ) {
    const org = this.requireOrg(current);
    const pdf = await this.ops.payslipPdfBuffer(org.organizationId, runId, personId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="payslip-${personId}.pdf"`,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
    });
    return new StreamableFile(pdf);
  }
}
