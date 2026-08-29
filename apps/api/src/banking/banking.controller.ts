import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  CurrentOrg,
  CurrentUser,
  SessionGuard,
  type OrgMembership,
  type RequestUser,
} from '../auth/session.guard.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import { AuditService } from '../audit/audit.service.js';
import { BankingService } from './banking.service.js';

@Controller('banking')
@UseGuards(SessionGuard)
export class BankingController {
  constructor(
    @Inject(BankingService) private readonly banking: BankingService,
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

  @Get('accounts')
  listAccounts(@CurrentOrg() current: OrgMembership | null) {
    return this.banking.listAccounts(this.requireOrg(current).organizationId);
  }

  @Post('accounts')
  async createAccount(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      name: string;
      bankName?: string;
      accountNumberMasked?: string;
      currency?: string;
      ledgerAccountId?: string;
      openingBalance?: string;
    },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    const account = await this.banking.createAccount(org.organizationId, body);
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'CREATE',
      entityType: 'BankAccount',
      entityId: account.id,
    });
    return account;
  }

  @Get('transactions')
  listTransactions(
    @CurrentOrg() current: OrgMembership | null,
    @Query('bankAccountId') bankAccountId?: string,
  ) {
    return this.banking.listTransactions(
      this.requireOrg(current).organizationId,
      bankAccountId,
    );
  }

  @Post('accounts/:id/import')
  async importCsv(
    @Param('id') id: string,
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body() body: { csv?: string; rows?: Array<Array<string>> },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    const result = body.rows?.length
      ? await this.banking.importRows(org.organizationId, id, body.rows)
      : await this.banking.importCsv(org.organizationId, id, body.csv ?? '');
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'IMPORT',
      entityType: 'BankTransaction',
      entityId: id,
      afterJson: result,
    });
    return result;
  }

  @Post('accounts/:id/import/pdf/preview')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  async previewPdfImport(
    @Param('id') id: string,
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    if (!file) {
      throw new BadRequestException({
        error: { code: 'FILE_REQUIRED', message: 'PDF file is required.' },
      });
    }
    const mime = file.mimetype?.toLowerCase() ?? '';
    if (mime !== 'application/pdf' && !file.originalname.toLowerCase().endsWith('.pdf')) {
      throw new BadRequestException({
        error: { code: 'INVALID_FILE_TYPE', message: 'Upload a PDF bank statement.' },
      });
    }
    return this.banking.previewPdfStatement(org.organizationId, id, file.buffer);
  }

  @Post('transactions/:id/ignore')
  async ignore(
    @Param('id') id: string,
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    const txn = await this.banking.ignoreTransaction(org.organizationId, id);
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'IGNORE',
      entityType: 'BankTransaction',
      entityId: txn.id,
    });
    return txn;
  }

  @Get('transactions/:id/suggestions')
  suggestions(
    @Param('id') id: string,
    @CurrentOrg() current: OrgMembership | null,
  ) {
    return this.banking.suggestMatches(this.requireOrg(current).organizationId, id);
  }

  @Post('transactions/:id/match')
  async match(
    @Param('id') id: string,
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body() body: { matchedType: 'payment' | 'expense' | 'bill_payment'; matchedId: string },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    const txn = await this.banking.matchTransaction(org.organizationId, id, body);
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'MATCH',
      entityType: 'BankTransaction',
      entityId: txn.id,
      afterJson: body,
    });
    return txn;
  }

  @Post('transfers')
  async transfer(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      fromBankAccountId: string;
      toBankAccountId: string;
      amount: string;
      transferDate: string;
      description?: string;
    },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    return this.banking.transfer(org.organizationId, user.id, body);
  }

  @Get('reconciliation')
  reconciliation(
    @CurrentOrg() current: OrgMembership | null,
    @Query('bankAccountId') bankAccountId?: string,
  ) {
    return this.banking.reconciliationSummary(
      this.requireOrg(current).organizationId,
      bankAccountId,
    );
  }
}
