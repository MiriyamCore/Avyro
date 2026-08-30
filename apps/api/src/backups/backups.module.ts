import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { BackupsController } from './backups.controller.js';
import { BackupsService } from './backups.service.js';
import { BackupSchedulerService } from './backup-scheduler.service.js';

@Module({
  imports: [OrganizationsModule, AuditModule],
  controllers: [BackupsController],
  providers: [BackupsService, BackupSchedulerService],
  exports: [BackupsService],
})
export class BackupsModule {}
