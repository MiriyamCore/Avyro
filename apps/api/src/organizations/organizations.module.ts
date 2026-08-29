import { Module } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller.js';
import { MembersController } from './members.controller.js';
import { OrganizationsService } from './organizations.service.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [AuditModule],
  controllers: [OrganizationsController, MembersController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}