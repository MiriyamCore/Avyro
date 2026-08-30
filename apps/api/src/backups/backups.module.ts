import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { BackupsController } from './backups.controller.js';
import { BackupsService } from './backups.service.js';

@Module({
  imports: [OrganizationsModule, AuditModule],
  controllers: [BackupsController],
  providers: [BackupsService],
  exports: [BackupsService],
})
export class BackupsModule {}
