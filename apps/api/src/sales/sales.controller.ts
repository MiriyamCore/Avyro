import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  CurrentOrg,
  CurrentUser,
  SessionGuard,
  type OrgMembership,
  type RequestUser,
} from '../auth/session.guard.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import { SalesService } from './sales.service.js';
import { AuditService } from '../audit/audit.service.js';

@Controller()
@UseGuards(SessionGuard)
export class SalesController {
  constructor(
    @Inject(SalesService) private readonly sales: SalesService,
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

  @Get('dashboard')
  dashboard(@CurrentOrg() current: OrgMembership | null) {
    return this.sales.dashboard(this.requireOrg(current).organizationId);
  }

  @Get('quotes')
  listQuotes(@CurrentOrg() current: OrgMembership | null) {
    return this.sales.listQuotes(this.requireOrg(current).organizationId);
  }

  @Post('quotes')
  async createQuote(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      customerId: string;
      issueDate: string;
      validUntil: string;
      currency?: string;
      exchangeRate?: string;
      notes?: string;
      items: Array<{ description: string; quantity: string; unitPrice: string }>;
    },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    const quote = await this.sales.createQuote(org.organizationId, user.id, body);
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'CREATE',
      entityType: 'Quote',
      entityId: quote.id,
    });
    return quote;
  }

  @Get('quotes/:id')
  getQuote(@Param('id') id: string, @CurrentOrg() current: OrgMembership | null) {
    return this.sales.getQuote(this.requireOrg(current).organizationId, id);
  }

  @Patch('quotes/:id')
  async updateQuote(
    @Param('id') id: string,
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      issueDate?: string;
      validUntil?: string;
      currency?: string;
      notes?: string | null;
      status?: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'CONVERTED' | 'VOID';
      items?: Array<{ description: string; quantity: string; unitPrice: string }>;
    },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    return this.sales.updateQuote(org.organizationId, id, body);
  }

  @Post('quotes/:id/convert')
  async convertQuote(
    @Param('id') id: string,
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    const invoice = await this.sales.convertQuoteToInvoice(
      org.organizationId,
      user.id,
      id,
    );
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'CONVERT',
      entityType: 'Quote',
      entityId: id,
      afterJson: { invoiceId: invoice.id },
    });
    return invoice;
  }

  @Get('quotes/:id/pdf')
  async quotePdf(
    @Param('id') id: string,
    @CurrentOrg() current: OrgMembership | null,
    @Res({ passthrough: true }) res: Response,
  ) {
    const org = this.requireOrg(current);
    const pdf = await this.sales.quotePdfBuffer(org.organizationId, id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="quote-${id}.pdf"`,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
    });
    return new StreamableFile(pdf);
  }

  @Get('customers')
  listCustomers(@CurrentOrg() current: OrgMembership | null) {
    return this.sales.listCustomers(this.requireOrg(current).organizationId);
  }

  @Get('customers/:id')
  getCustomer(
    @Param('id') id: string,
    @CurrentOrg() current: OrgMembership | null,
  ) {
    return this.sales.getCustomer360(this.requireOrg(current).organizationId, id);
  }

  @Post('customers')
  async createCustomer(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      name: string;
      legalName?: string;
      type?: 'BUSINESS' | 'INDIVIDUAL' | 'GOVERNMENT' | 'OTHER';
      countryCode?: string;
      email?: string;
      phone?: string;
      defaultCurrency?: string;
      isRelatedParty?: boolean;
      notes?: string;
    },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    const customer = await this.sales.createCustomer(org.organizationId, body);
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'CREATE',
      entityType: 'Customer',
      entityId: customer.id,
      afterJson: { name: customer.name },
    });
    return customer;
  }

  @Patch('customers/:id')
  async updateCustomer(
    @Param('id') id: string,
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      name?: string;
      legalName?: string | null;
      type?: 'BUSINESS' | 'INDIVIDUAL' | 'GOVERNMENT' | 'OTHER';
      countryCode?: string;
      address?: string | null;
      email?: string | null;
      phone?: string | null;
      website?: string | null;
      taxIdentifier?: string | null;
      vatIdentifier?: string | null;
      defaultCurrency?: string;
      defaultPaymentTermsDays?: number;
      isRelatedParty?: boolean;
      notes?: string | null;
    },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    const customer = await this.sales.updateCustomer(org.organizationId, id, body);
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Customer',
      entityId: customer.id,
    });
    return customer;
  }

  @Get('contracts')
  listContracts(@CurrentOrg() current: OrgMembership | null) {
    return this.sales.listContracts(this.requireOrg(current).organizationId);
  }

  @Post('contracts')
  async createContract(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      customerId: string;
      title: string;
      description?: string;
      effectiveDate: string;
      expiryDate?: string;
      billingType?: 'FIXED' | 'MILESTONE' | 'MONTHLY' | 'RETAINER' | 'HOURLY' | 'OTHER';
      currency?: string;
      contractValue?: string;
      paymentTerms?: string;
      serviceType?: string;
      status?: 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED' | 'COMPLETED';
    },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    const contract = await this.sales.createContract(org.organizationId, body);
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'CREATE',
      entityType: 'Contract',
      entityId: contract.id,
    });
    return contract;
  }

  @Patch('contracts/:id')
  async updateContract(
    @Param('id') id: string,
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      title?: string;
      description?: string | null;
      effectiveDate?: string;
      expiryDate?: string | null;
      billingType?: 'FIXED' | 'MILESTONE' | 'MONTHLY' | 'RETAINER' | 'HOURLY' | 'OTHER';
      currency?: string;
      contractValue?: string | null;
      paymentTerms?: string | null;
      serviceType?: string | null;
      status?: 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED' | 'COMPLETED';
    },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    return this.sales.updateContract(org.organizationId, id, body);
  }

  @Get('projects')
  listProjects(@CurrentOrg() current: OrgMembership | null) {
    return this.sales.listProjects(this.requireOrg(current).organizationId);
  }

  @Post('projects')
  async createProject(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      customerId: string;
      contractId?: string;
      name: string;
      description?: string;
      startDate?: string;
      endDate?: string;
      currency?: string;
      budgetAmount?: string;
      status?: 'PLANNED' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
    },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    const project = await this.sales.createProject(org.organizationId, body);
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'CREATE',
      entityType: 'Project',
      entityId: project.id,
    });
    return project;
  }

  @Patch('projects/:id')
  async updateProject(
    @Param('id') id: string,
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      name?: string;
      description?: string | null;
      startDate?: string | null;
      endDate?: string | null;
      currency?: string;
      budgetAmount?: string | null;
      status?: 'PLANNED' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
    },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    return this.sales.updateProject(org.organizationId, id, body);
  }

  @Get('invoices')
  listInvoices(@CurrentOrg() current: OrgMembership | null) {
    return this.sales.listInvoices(this.requireOrg(current).organizationId);
  }

  @Get('invoices/:id')
  getInvoice(
    @Param('id') id: string,
    @CurrentOrg() current: OrgMembership | null,
  ) {
    return this.sales.getInvoice(this.requireOrg(current).organizationId, id);
  }

  @Patch('invoices/:id')
  async updateInvoice(
    @Param('id') id: string,
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      issueDate?: string;
      dueDate?: string;
      currency?: string;
      notes?: string | null;
      taxCodeId?: string | null;
      items?: Array<{ description: string; quantity: string; unitPrice: string }>;
    },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    const invoice = await this.sales.updateInvoice(org.organizationId, id, body);
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Invoice',
      entityId: invoice.id,
    });
    return invoice;
  }

  @Get('invoices/preview/pdf')
  async invoicePreviewPdf(
    @CurrentOrg() current: OrgMembership | null,
    @Res({ passthrough: true }) res: Response,
  ) {
    const org = this.requireOrg(current);
    const pdf = await this.sales.invoicePreviewPdfBuffer(org.organizationId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="invoice-preview.pdf"',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
    });
    return new StreamableFile(pdf);
  }

  @Get('invoices/:id/pdf')
  async invoicePdf(
    @Param('id') id: string,
    @CurrentOrg() current: OrgMembership | null,
    @Res({ passthrough: true }) res: Response,
  ) {
    const org = this.requireOrg(current);
    const pdf = await this.sales.invoicePdfBuffer(org.organizationId, id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="invoice-${id}.pdf"`,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
    });
    return new StreamableFile(pdf);
  }

  @Post('invoices')
  async createInvoice(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      customerId: string;
      issueDate: string;
      dueDate: string;
      currency?: string;
      exchangeRate?: string;
      notes?: string;
      taxCodeId?: string;
      items: Array<{ description: string; quantity: string; unitPrice: string }>;
    },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    const invoice = await this.sales.createInvoice(org.organizationId, user.id, body);
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'CREATE',
      entityType: 'Invoice',
      entityId: invoice.id,
    });
    return invoice;
  }

  @Post('invoices/:id/issue')
  async issueInvoice(
    @Param('id') id: string,
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    const invoice = await this.sales.issueInvoice(org.organizationId, user.id, id);
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'ISSUE',
      entityType: 'Invoice',
      entityId: invoice.id,
      afterJson: { invoiceNumber: invoice.invoiceNumber },
    });
    return invoice;
  }

  @Post('invoices/:id/credit')
  async creditInvoice(
    @Param('id') id: string,
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body() body: { amount?: string; reason?: string },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    const invoice = await this.sales.creditInvoice(org.organizationId, user.id, id, body);
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'CREDIT',
      entityType: 'Invoice',
      entityId: invoice.id,
      afterJson: { status: invoice.status, amountDue: invoice.amountDue },
    });
    return invoice;
  }

  @Get('payments')
  listPayments(@CurrentOrg() current: OrgMembership | null) {
    return this.sales.listPayments(this.requireOrg(current).organizationId);
  }

  @Post('payments')
  async recordPayment(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      invoiceId: string;
      paymentDate: string;
      amount: string;
      method?: 'BANK_TRANSFER' | 'CARD' | 'PAYMENT_GATEWAY' | 'CASH' | 'CHEQUE' | 'OTHER';
      exchangeRate?: string;
      destinationAccountId?: string;
      reference?: string;
    },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    const payment = await this.sales.recordPayment(org.organizationId, user.id, body);
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'CREATE',
      entityType: 'Payment',
      entityId: payment.id,
    });
    return payment;
  }

  @Get('expenses')
  listExpenses(@CurrentOrg() current: OrgMembership | null) {
    return this.sales.listExpenses(this.requireOrg(current).organizationId);
  }

  @Post('expenses')
  async createExpense(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      expenseDate: string;
      description: string;
      amount: string;
      categoryAccountId: string;
      paymentAccountId: string;
    },
  ) {
    const org = this.requireOrg(current);
    await this.organizations.requireRole(org.organizationId, user.id, 'MANAGER');
    const expense = await this.sales.createExpense(org.organizationId, user.id, body);
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'CREATE',
      entityType: 'Expense',
      entityId: expense.id,
    });
    return expense;
  }
}
