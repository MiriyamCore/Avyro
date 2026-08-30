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
import type { BackupFrequency } from '@avyro/database';
import {
  CurrentOrg,
  CurrentUser,
  SessionGuard,
  type OrgMembership,
  type RequestUser,
} from '../auth/session.guard.js';
import { BackupsService } from './backups.service.js';

@Controller('backups')
@UseGuards(SessionGuard)
export class BackupsController {
  constructor(@Inject(BackupsService) private readonly backups: BackupsService) {}

  private requireOrg(current: OrgMembership | null): OrgMembership {
    if (!current) {
      throw new ForbiddenException({
        error: { code: 'NO_ORGANIZATION', message: 'No organisation membership found.' },
      });
    }
    return current;
  }

  @Get()
  list(@CurrentOrg() current: OrgMembership | null, @CurrentUser() user: RequestUser) {
    const org = this.requireOrg(current);
    return this.backups.list(org.organizationId, user.id);
  }

  @Get('settings')
  settings(@CurrentOrg() current: OrgMembership | null, @CurrentUser() user: RequestUser) {
    const org = this.requireOrg(current);
    return this.backups.getSettings(org.organizationId, user.id);
  }

  @Patch('settings')
  updateSettings(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body() body: { frequency: BackupFrequency },
  ) {
    const org = this.requireOrg(current);
    return this.backups.updateSettings(org.organizationId, user.id, body.frequency);
  }

  @Post()
  create(@CurrentOrg() current: OrgMembership | null, @CurrentUser() user: RequestUser) {
    const org = this.requireOrg(current);
    return this.backups.triggerBackup(org.organizationId, user.id);
  }

  @Post(':id/restore')
  restore(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { confirm: string },
  ) {
    const org = this.requireOrg(current);
    return this.backups.restore(org.organizationId, user.id, id, body.confirm);
  }
}
