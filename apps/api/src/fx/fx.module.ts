import { Module } from '@nestjs/common';
import { FxController } from './fx.controller.js';
import { FxService } from './fx.service.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [OrganizationsModule, AuditModule],
  controllers: [FxController],
  providers: [FxService],
  exports: [FxService],
})
export class FxModule {}
