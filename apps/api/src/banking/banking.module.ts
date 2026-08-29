import { Module } from '@nestjs/common';
import { BankingController } from './banking.controller.js';
import { BankingService } from './banking.service.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [OrganizationsModule, AuditModule],
  controllers: [BankingController],
  providers: [BankingService],
  exports: [BankingService],
})
export class BankingModule {}
