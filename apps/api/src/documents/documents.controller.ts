import {
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Body,
  Res,
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
import { DocumentsService } from './documents.service.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import { AuditService } from '../audit/audit.service.js';

@Controller()
@UseGuards(SessionGuard)
export class DocumentsController {
  constructor(
    @Inject(DocumentsService) private readonly documents: DocumentsService,
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

  @Get('documents')
  list(@CurrentOrg() current: OrgMembership | null) {
    return this.documents.list(this.requireOrg(current).organizationId);
  }

  @Get('documents/:id/download')
  async download(
    @CurrentOrg() current: OrgMembership | null,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const org = this.requireOrg(current);
    const { document, file } = await this.documents.download(org.organizationId, id);
    res.setHeader('Content-Type', document.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${document.originalFilename.replace(/"/g, '')}"`,
    );
    return file;
  }

  @Post('receipts')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  async uploadReceipt(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
    @Body()
    body: {
      entityType?: 'Expense' | 'Bill';
      entityId?: string;
      label?: string;
    },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'EMPLOYEE');
    const document = await this.documents.uploadReceipt(
      org.organizationId,
      user.id,
      file,
      body,
    );
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'CREATE',
      entityType: 'Document',
      entityId: document.id,
      afterJson: {
        filename: document.originalFilename,
        entityType: body.entityType,
        entityId: body.entityId,
      },
    });
    return document;
  }
}
