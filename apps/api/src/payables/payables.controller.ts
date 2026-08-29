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
import {
  CurrentOrg,
  CurrentUser,
  SessionGuard,
  type OrgMembership,
  type RequestUser,
} from '../auth/session.guard.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import { AuditService } from '../audit/audit.service.js';
import { PayablesService } from './payables.service.js';

@Controller()
@UseGuards(SessionGuard)
export class PayablesController {
  constructor(
    @Inject(PayablesService) private readonly payables: PayablesService,
    @Inject(OrganizationsService)
    private readonly organizations: OrganizationsService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  private requireOrg(current: OrgMembership | null): OrgMembership {
    if (!current) {
      throw new ForbiddenException({
        error: { code: 'NO_ORGANIZATION', message: 'No organisation membership found.' },
      });
    }
    return current;
  }

  @Get('suppliers')
  listSuppliers(@CurrentOrg() current: OrgMembership | null) {
    return this.payables.listSuppliers(this.requireOrg(current).organizationId);
  }

  @Post('suppliers')
  async createSupplier(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      name: string;
      countryCode?: string;
      email?: string;
      phone?: string;
      defaultCurrency?: string;
      taxIdentifier?: string;
      vatIdentifier?: string;
      notes?: string;
    },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    const supplier = await this.payables.createSupplier(org.organizationId, body);
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'CREATE',
      entityType: 'Supplier',
      entityId: supplier.id,
    });
    return supplier;
  }

  @Get('suppliers/:id')
  getSupplier(@Param('id') id: string, @CurrentOrg() current: OrgMembership | null) {
    return this.payables.getSupplier(this.requireOrg(current).organizationId, id);
  }

  @Patch('suppliers/:id')
  async updateSupplier(
    @Param('id') id: string,
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      name?: string;
      countryCode?: string;
      email?: string | null;
      phone?: string | null;
      defaultCurrency?: string;
      taxIdentifier?: string | null;
      vatIdentifier?: string | null;
      notes?: string | null;
    },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    const supplier = await this.payables.updateSupplier(org.organizationId, id, body);
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Supplier',
      entityId: supplier.id,
    });
    return supplier;
  }

  @Get('bills')
  listBills(@CurrentOrg() current: OrgMembership | null) {
    return this.payables.listBills(this.requireOrg(current).organizationId);
  }

  @Get('bills/aging')
  payableAging(@CurrentOrg() current: OrgMembership | null) {
    return this.payables.payableAging(this.requireOrg(current).organizationId);
  }

  @Get('bills/:id')
  getBill(@Param('id') id: string, @CurrentOrg() current: OrgMembership | null) {
    return this.payables.getBill(this.requireOrg(current).organizationId, id);
  }

  @Post('bills')
  async createBill(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      supplierId: string;
      billDate: string;
      dueDate: string;
      currency?: string;
      exchangeRate?: string;
      supplierReference?: string;
      expenseAccountId?: string;
      taxCodeId?: string;
      notes?: string;
      items: Array<{ description: string; quantity: string; unitPrice: string }>;
    },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    const bill = await this.payables.createBill(org.organizationId, user.id, body);
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'CREATE',
      entityType: 'Bill',
      entityId: bill.id,
    });
    return bill;
  }

  @Post('bills/:id/open')
  async openBill(
    @Param('id') id: string,
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    const bill = await this.payables.openBill(org.organizationId, user.id, id);
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'OPEN',
      entityType: 'Bill',
      entityId: bill.id,
      afterJson: { billNumber: bill.billNumber },
    });
    return bill;
  }

  @Post('bill-payments')
  async payBill(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      billId: string;
      paymentDate: string;
      amount: string;
      paymentAccountId?: string;
      reference?: string;
    },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    const payment = await this.payables.payBill(org.organizationId, user.id, body);
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'CREATE',
      entityType: 'BillPayment',
      entityId: payment.id,
    });
    return payment;
  }
}
