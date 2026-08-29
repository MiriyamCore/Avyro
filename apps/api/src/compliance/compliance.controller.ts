import {
  Body,
  Controller,
  BadRequestException,
  ForbiddenException,
  Get,
  Header,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
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
import { ComplianceService } from './compliance.service.js';

@Controller('compliance')
@UseGuards(SessionGuard)
export class ComplianceController {
  constructor(
    @Inject(ComplianceService) private readonly compliance: ComplianceService,
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

  @Get('profile')
  profile(@CurrentOrg() current: OrgMembership | null) {
    return this.compliance.getProfile(this.requireOrg(current).organizationId);
  }

  @Put('profile')
  async updateProfile(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      vatRegistered?: boolean;
      notes?: string;
      taxIdentifier?: string | null;
      vatIdentifier?: string | null;
      tradeLicenseNumber?: string | null;
    },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    const profile = await this.compliance.updateProfile(org.organizationId, body);
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'UPDATE',
      entityType: 'ComplianceProfile',
      entityId: profile.id,
    });
    return profile;
  }

  @Get('records')
  records(@CurrentOrg() current: OrgMembership | null) {
    return this.compliance.listRecords(this.requireOrg(current).organizationId);
  }

  @Post('records')
  async createRecord(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      type: 'TRADE_LICENCE' | 'TIN' | 'BIN_VAT' | 'FORM_C' | 'ERQ' | 'OTHER';
      label: string;
      identifier?: string;
      issuedOn?: string;
      expiresOn?: string;
      notes?: string;
    },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    const record = await this.compliance.createRecord(org.organizationId, body);
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'CREATE',
      entityType: 'ComplianceRecord',
      entityId: record.id,
    });
    return record;
  }

  @Get('tax-codes')
  taxCodes(@CurrentOrg() current: OrgMembership | null) {
    return this.compliance.listTaxCodes(this.requireOrg(current).organizationId);
  }

  @Post('tax-codes/ensure-defaults')
  async ensureTaxCodes(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    return this.compliance.ensureDefaultTaxCodes(org.organizationId);
  }

  @Get('reminders')
  reminders(@CurrentOrg() current: OrgMembership | null) {
    return this.compliance.expiryReminders(this.requireOrg(current).organizationId);
  }

  @Get('challans')
  challans(@CurrentOrg() current: OrgMembership | null) {
    return this.compliance.listChallans(this.requireOrg(current).organizationId);
  }

  @Post('challans')
  async createChallan(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      type: string;
      amount: string;
      paidOn?: string;
      reference?: string;
      notes?: string;
    },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    const row = await this.compliance.createChallan(org.organizationId, body);
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'CREATE',
      entityType: 'Challan',
      entityId: row.id,
    });
    return row;
  }

  @Get('vat-documents')
  vatDocuments(@CurrentOrg() current: OrgMembership | null) {
    return this.compliance.listVatDocuments(this.requireOrg(current).organizationId);
  }

  @Post('vat-documents')
  async createVatDocument(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      type?: 'MUSHAK_6_1' | 'MUSHAK_6_3' | 'MUSHAK_9_1' | 'OTHER';
      partyName?: string;
      invoiceId?: string;
      billId?: string;
      taxableAmount: string;
      vatAmount: string;
      notes?: string;
    },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    return this.compliance.createVatDocument(org.organizationId, body);
  }

  @Get('registers/sales.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="mushak-sales-register.csv"')
  salesRegisterCsv(@CurrentOrg() current: OrgMembership | null) {
    return this.compliance.mushakSalesCsv(this.requireOrg(current).organizationId);
  }

  @Get('registers/purchase.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="mushak-purchase-withholding-register.csv"',
  )
  purchaseRegisterCsv(@CurrentOrg() current: OrgMembership | null) {
    return this.compliance.mushakPurchaseCsv(this.requireOrg(current).organizationId);
  }

  @Get('registers/sales.pdf')
  async salesRegisterPdf(
    @CurrentOrg() current: OrgMembership | null,
    @Res({ passthrough: true }) res: Response,
  ) {
    const org = this.requireOrg(current);
    const pdf = await this.compliance.mushakSalesPdf(org.organizationId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="mushak-sales-register.pdf"',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
    });
    return new StreamableFile(pdf);
  }

  @Get('registers/purchase.pdf')
  async purchaseRegisterPdf(
    @CurrentOrg() current: OrgMembership | null,
    @Res({ passthrough: true }) res: Response,
  ) {
    const org = this.requireOrg(current);
    const pdf = await this.compliance.mushakPurchasePdf(org.organizationId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="mushak-purchase-register.pdf"',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
    });
    return new StreamableFile(pdf);
  }

  @Get('service-exports')
  serviceExports(@CurrentOrg() current: OrgMembership | null) {
    return this.compliance.listServiceExports(this.requireOrg(current).organizationId);
  }

  @Post('service-exports')
  async createServiceExport(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      invoiceId?: string;
      formCRef?: string;
      erqRef?: string;
      remittanceNotes?: string;
      retentionFlag?: boolean;
    },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    return this.compliance.createServiceExport(org.organizationId, body);
  }

  @Get('withholdings')
  withholdings(@CurrentOrg() current: OrgMembership | null) {
    return this.compliance.listWithholdings(this.requireOrg(current).organizationId);
  }

  @Patch('withholdings/:id')
  async linkWithholding(
    @Param('id') id: string,
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body() body: { challanId: string | null },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    const row = await this.compliance.linkWithholdingChallan(
      org.organizationId,
      id,
      body.challanId,
    );
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'UPDATE',
      entityType: 'WithholdingEntry',
      entityId: row.id,
      afterJson: { challanId: body.challanId },
    });
    return row;
  }

  @Put('tax-codes/:id')
  async updateTaxCode(
    @Param('id') id: string,
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body() body: { ratePercent: string | null },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    return this.compliance.updateTaxCodeRate(org.organizationId, id, body.ratePercent);
  }

  private parseYearMonth(year?: string, month?: string) {
    const now = new Date();
    const y = year ? Number(year) : now.getUTCFullYear();
    const m = month ? Number(month) : now.getUTCMonth() + 1;
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
      throw new BadRequestException({
        error: { code: 'INVALID_PERIOD', message: 'year and month query params required.' },
      });
    }
    return { year: y, month: m };
  }

  @Get('registers/mushak-9.1.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="mushak-9.1-worksheet.csv"')
  mushak91Csv(
    @CurrentOrg() current: OrgMembership | null,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const { year: y, month: m } = this.parseYearMonth(year, month);
    return this.compliance.mushak91Csv(this.requireOrg(current).organizationId, y, m);
  }

  @Get('registers/mushak-9.1.pdf')
  async mushak91Pdf(
    @CurrentOrg() current: OrgMembership | null,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const org = this.requireOrg(current);
    const { year: y, month: m } = this.parseYearMonth(year, month);
    const pdf = await this.compliance.mushak91Pdf(org.organizationId, y, m);
    res!.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="mushak-9.1-worksheet.pdf"',
      'Cache-Control': 'no-store',
    });
    return new StreamableFile(pdf);
  }

  @Get('registers/combined-6.2.1.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="mushak-6.2.1-combined.csv"')
  mushak621Csv(@CurrentOrg() current: OrgMembership | null) {
    return this.compliance.mushak621Csv(this.requireOrg(current).organizationId);
  }

  @Get('registers/combined-6.2.1.pdf')
  async mushak621Pdf(
    @CurrentOrg() current: OrgMembership | null,
    @Res({ passthrough: true }) res: Response,
  ) {
    const org = this.requireOrg(current);
    const pdf = await this.compliance.mushak621Pdf(org.organizationId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="mushak-6.2.1-combined.pdf"',
      'Cache-Control': 'no-store',
    });
    return new StreamableFile(pdf);
  }

  @Get('registers/vds-6.6.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="mushak-6.6-vds.csv"')
  vds66Csv(@CurrentOrg() current: OrgMembership | null) {
    return this.compliance.vdsCertificateCsv(this.requireOrg(current).organizationId, '6.6');
  }

  @Get('registers/vds-6.10.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="mushak-6.10-vds.csv"')
  vds610Csv(@CurrentOrg() current: OrgMembership | null) {
    return this.compliance.vdsCertificateCsv(this.requireOrg(current).organizationId, '6.10');
  }

  @Get('registers/vds-6.6.pdf')
  async vds66Pdf(@CurrentOrg() current: OrgMembership | null, @Res({ passthrough: true }) res: Response) {
    const org = this.requireOrg(current);
    const pdf = await this.compliance.vdsCertificatePdf(org.organizationId, '6.6');
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="mushak-6.6-vds.pdf"' });
    return new StreamableFile(pdf);
  }

  @Get('registers/credit-notes-6.7.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="mushak-6.7-credit-notes.csv"')
  creditNotesCsv(@CurrentOrg() current: OrgMembership | null) {
    return this.compliance.creditNoteCsv(this.requireOrg(current).organizationId);
  }

  @Get('registers/credit-notes-6.7.pdf')
  async creditNotesPdf(@CurrentOrg() current: OrgMembership | null, @Res({ passthrough: true }) res: Response) {
    const org = this.requireOrg(current);
    const pdf = await this.compliance.creditNotePdf(org.organizationId);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="mushak-6.7-credit-notes.pdf"' });
    return new StreamableFile(pdf);
  }

  @Get('registers/debit-notes-6.8.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="mushak-6.8-debit-notes.csv"')
  debitNotesCsv(@CurrentOrg() current: OrgMembership | null) {
    return this.compliance.debitNoteCsv(this.requireOrg(current).organizationId);
  }

  @Get('registers/debit-notes-6.8.pdf')
  async debitNotesPdf(@CurrentOrg() current: OrgMembership | null, @Res({ passthrough: true }) res: Response) {
    const org = this.requireOrg(current);
    const pdf = await this.compliance.debitNotePdf(org.organizationId);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="mushak-6.8-debit-notes.pdf"' });
    return new StreamableFile(pdf);
  }

  @Get('e-return-pack')
  eReturnPack(
    @CurrentOrg() current: OrgMembership | null,
    @Query('asOf') asOf?: string,
  ) {
    return this.compliance.eReturnEvidencePack(this.requireOrg(current).organizationId, asOf);
  }
}
