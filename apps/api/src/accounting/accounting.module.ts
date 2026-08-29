import { Module } from '@nestjs/common';
import { AccountingController } from './accounting.controller.js';
import { AccountingService } from './accounting.service.js';
import { OpeningBalancesService } from './opening-balances.service.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [OrganizationsModule, AuditModule],
  controllers: [AccountingController],
  providers: [AccountingService, OpeningBalancesService],
  exports: [AccountingService, OpeningBalancesService],
})
export class AccountingModule {}
