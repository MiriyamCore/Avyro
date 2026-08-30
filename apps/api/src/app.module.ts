import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { OrganizationsModule } from './organizations/organizations.module.js';
import { AccountingModule } from './accounting/accounting.module.js';
import { MeController } from './me.controller.js';
import { AuditModule } from './audit/audit.module.js';
import { SessionGuard } from './auth/session.guard.js';
import { SalesModule } from './sales/sales.module.js';
import { PayablesModule } from './payables/payables.module.js';
import { BankingModule } from './banking/banking.module.js';
import { FxModule } from './fx/fx.module.js';
import { GatewayModule } from './gateway/gateway.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { ComplianceModule } from './compliance/compliance.module.js';
import { ReviewModule } from './review/review.module.js';
import { OperationsModule } from './operations/operations.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { BackupsModule } from './backups/backups.module.js';

@Module({
  imports: [
    OrganizationsModule,
    AccountingModule,
    AuditModule,
    SalesModule,
    PayablesModule,
    BankingModule,
    FxModule,
    GatewayModule,
    ReportsModule,
    ComplianceModule,
    ReviewModule,
    OperationsModule,
    DocumentsModule,
    NotificationsModule,
    BackupsModule,
  ],
  controllers: [HealthController, MeController],
  providers: [SessionGuard],
})
export class AppModule {}
