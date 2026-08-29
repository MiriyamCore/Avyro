import { Module } from '@nestjs/common';
import { SalesController } from './sales.controller.js';
import { SalesService } from './sales.service.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [OrganizationsModule, AuditModule],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
