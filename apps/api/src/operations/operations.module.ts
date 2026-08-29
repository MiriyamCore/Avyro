import { Module } from '@nestjs/common';
import { OperationsController } from './operations.controller.js';
import { OperationsService } from './operations.service.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [OrganizationsModule, AuditModule],
  controllers: [OperationsController],
  providers: [OperationsService],
  exports: [OperationsService],
})
export class OperationsModule {}
