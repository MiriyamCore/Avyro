import { Controller, ForbiddenException, Get, Inject, Query, UseGuards } from '@nestjs/common';
import {
  CurrentOrg,
  SessionGuard,
  type OrgMembership,
} from '../auth/session.guard.js';
import { AuditService } from './audit.service.js';

@Controller('audit')
@UseGuards(SessionGuard)
export class AuditController {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  @Get()
  list(
    @CurrentOrg() current: OrgMembership | null,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    if (!current) {
      throw new ForbiddenException({
        error: {
          code: 'NO_ORGANIZATION',
          message: 'No organisation membership found.',
        },
      });
    }
    return this.audit.list(current.organizationId, {
      action,
      entityType,
      entityId,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }
}
