import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@avyro/database';
import {
  AccountingError,
  AccountingPostingService,
} from '@avyro/accounting';
import { Decimal } from 'decimal.js';
import { LocalObjectStorage } from '../storage/object-storage.js';

@Injectable()
export class OperationsService {
  private readonly posting = new AccountingPostingService(prisma);

  listPeople(organizationId: string) {
    return prisma.person.findMany({
      where: { organizationId },
      include: { compensations: { orderBy: { effectiveFrom: 'desc' }, take: 1 } },
      orderBy: { name: 'asc' },
    });
  }

  getPerson(organizationId: string, personId: string) {
    return prisma.person.findFirstOrThrow({
      where: { id: personId, organizationId },
      include: { compensations: { orderBy: { effectiveFrom: 'desc' }, take: 1 } },
    });
  }

  createPerson(
    organizationId: string,
    body: {
      name: string;
      email?: string;
      phone?: string;
      title?: string;
      nationalId?: string;
      taxIdentifier?: string;
      address?: string;
      bankName?: string;
      bankAccountNumber?: string;
      emergencyContactName?: string;
      emergencyContactPhone?: string;
      hireDate?: string;
      terminationDate?: string;
      status?: 'ACTIVE' | 'INACTIVE' | 'TERMINATED';
      grossPay?: string;
      tdsPercent?: string;
    },
  ) {
    return prisma.person.create({
      data: {
        organizationId,
        name: body.name.trim(),
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || null,
        title: body.title?.trim() || null,
        nationalId: body.nationalId?.trim() || null,
        taxIdentifier: body.taxIdentifier?.trim() || null,
        address: body.address?.trim() || null,
        bankName: body.bankName?.trim() || null,
        bankAccountNumber: body.bankAccountNumber?.trim() || null,
        emergencyContactName: body.emergencyContactName?.trim() || null,
        emergencyContactPhone: body.emergencyContactPhone?.trim() || null,
        hireDate: body.hireDate ? new Date(body.hireDate) : null,
        terminationDate: body.terminationDate ? new Date(body.terminationDate) : null,
        status: body.status ?? 'ACTIVE',
        tdsPercent: body.tdsPercent ?? null,
        compensations: body.grossPay
          ? {
              create: {
                organizationId,
                effectiveFrom: new Date(),
                grossPay: body.grossPay,
              },
            }
          : undefined,
      },
      include: { compensations: { orderBy: { effectiveFrom: 'desc' }, take: 1 } },
    });
  }

  async updatePerson(
    organizationId: string,
    personId: string,
    body: {
      name?: string;
      email?: string | null;
      phone?: string | null;
      title?: string | null;
      nationalId?: string | null;
      taxIdentifier?: string | null;
      address?: string | null;
      bankName?: string | null;
      bankAccountNumber?: string | null;
      emergencyContactName?: string | null;
      emergencyContactPhone?: string | null;
      hireDate?: string | null;
      terminationDate?: string | null;
      status?: 'ACTIVE' | 'INACTIVE' | 'TERMINATED';
      grossPay?: string;
      tdsPercent?: string | null;
    },
  ) {
    const existing = await prisma.person.findFirst({
      where: { id: personId, organizationId },
    });
    if (!existing) {
      throw new BadRequestException({
        error: { code: 'PERSON_NOT_FOUND', message: 'Person not found.' },
      });
    }

    const person = await prisma.person.update({
      where: { id: personId },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.email !== undefined ? { email: body.email?.trim() || null } : {}),
        ...(body.phone !== undefined ? { phone: body.phone?.trim() || null } : {}),
        ...(body.title !== undefined ? { title: body.title?.trim() || null } : {}),
        ...(body.nationalId !== undefined ? { nationalId: body.nationalId?.trim() || null } : {}),
        ...(body.taxIdentifier !== undefined
          ? { taxIdentifier: body.taxIdentifier?.trim() || null }
          : {}),
        ...(body.address !== undefined ? { address: body.address?.trim() || null } : {}),
        ...(body.bankName !== undefined ? { bankName: body.bankName?.trim() || null } : {}),
        ...(body.bankAccountNumber !== undefined
          ? { bankAccountNumber: body.bankAccountNumber?.trim() || null }
          : {}),
        ...(body.emergencyContactName !== undefined
          ? { emergencyContactName: body.emergencyContactName?.trim() || null }
          : {}),
        ...(body.emergencyContactPhone !== undefined
          ? { emergencyContactPhone: body.emergencyContactPhone?.trim() || null }
          : {}),
        ...(body.hireDate !== undefined
          ? { hireDate: body.hireDate ? new Date(body.hireDate) : null }
          : {}),
        ...(body.terminationDate !== undefined
          ? { terminationDate: body.terminationDate ? new Date(body.terminationDate) : null }
          : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.tdsPercent !== undefined ? { tdsPercent: body.tdsPercent } : {}),
      },
    });

    if (body.grossPay) {
      await prisma.employeeCompensation.create({
        data: {
          organizationId,
          personId: person.id,
          effectiveFrom: new Date(),
          grossPay: body.grossPay,
        },
      });
    }

    return prisma.person.findFirstOrThrow({
      where: { id: person.id },
      include: { compensations: { orderBy: { effectiveFrom: 'desc' }, take: 1 } },
    });
  }

  listAssets(organizationId: string) {
    return prisma.asset.findMany({
      where: { organizationId },
      include: { assignedTo: true },
      orderBy: { purchaseDate: 'desc' },
    });
  }

  async createAsset(
    organizationId: string,
    body: {
      name: string;
      category?: string;
      cost: string;
      purchaseDate: string;
      serialNumber?: string;
      assignedToId?: string;
      notes?: string;
      usefulLifeMonths?: number;
      salvageValue?: string;
      depreciationMethod?: string;
    },
  ) {
    const count = await prisma.asset.count({ where: { organizationId } });
    return prisma.asset.create({
      data: {
        organizationId,
        assetNumber: `AST-${String(count + 1).padStart(4, '0')}`,
        name: body.name,
        category: body.category,
        cost: body.cost,
        purchaseDate: new Date(body.purchaseDate),
        serialNumber: body.serialNumber,
        assignedToId: body.assignedToId,
        notes: body.notes,
        usefulLifeMonths: body.usefulLifeMonths ?? 36,
        salvageValue: body.salvageValue ?? '0',
        depreciationMethod: body.depreciationMethod ?? 'STRAIGHT_LINE',
      },
      include: { assignedTo: true },
    });
  }

  async depreciateAsset(
    organizationId: string,
    userId: string,
    assetId: string,
    period: string,
  ) {
    if (!/^\d{4}-\d{2}$/.test(period)) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_PERIOD',
          message: 'Period must be YYYY-MM.',
        },
      });
    }
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, organizationId, status: 'ACTIVE' },
    });
    if (!asset) {
      throw new BadRequestException({
        error: { code: 'ASSET_NOT_FOUND', message: 'Active asset not found.' },
      });
    }
    const months = asset.usefulLifeMonths;
    if (!months || months <= 0) {
      throw new BadRequestException({
        error: {
          code: 'NO_USEFUL_LIFE',
          message: 'Set useful life (months) before depreciating.',
        },
      });
    }

    const sourceId = `${asset.id}:${period}`;
    const existing = await prisma.journalEntry.findFirst({
      where: {
        organizationId,
        sourceType: 'asset_depreciation',
        sourceId,
        status: 'POSTED',
      },
    });
    if (existing) {
      throw new BadRequestException({
        error: {
          code: 'ALREADY_DEPRECIATED',
          message: `Depreciation already posted for ${period}.`,
        },
      });
    }

    const cost = new Decimal(asset.cost.toString());
    const salvage = new Decimal(asset.salvageValue.toString());
    const monthly = cost.minus(salvage).dividedBy(months);
    if (monthly.lte(0)) {
      throw new BadRequestException({
        error: {
          code: 'ZERO_DEPRECIATION',
          message: 'Monthly depreciation is zero.',
        },
      });
    }

    let expense = await prisma.ledgerAccount.findFirst({
      where: { organizationId, code: '6960' },
    });
    if (!expense) {
      const parent = await prisma.ledgerAccount.findFirst({
        where: { organizationId, code: '6000' },
      });
      expense = await prisma.ledgerAccount.create({
        data: {
          organizationId,
          code: '6960',
          name: 'Depreciation',
          type: 'EXPENSE',
          parentId: parent?.id,
          isPostable: true,
          isSystem: true,
        },
      });
    }
    const accum = await prisma.ledgerAccount.findFirst({
      where: { organizationId, code: '1600' },
    });
    if (!accum) {
      throw new BadRequestException({
        error: {
          code: 'MISSING_ACCUM_DEPR',
          message: 'Account 1600 Accumulated Depreciation is missing.',
        },
      });
    }

    const entryDate = new Date(`${period}-01T12:00:00.000Z`);
    // Last day of month for posting date
    entryDate.setUTCMonth(entryDate.getUTCMonth() + 1);
    entryDate.setUTCDate(0);

    try {
      const journal = await this.posting.createJournal({
        organizationId,
        entryDate,
        description: `Depreciation ${asset.assetNumber} ${period}`,
        sourceType: 'asset_depreciation',
        sourceId,
        createdById: userId,
        lines: [
          {
            accountId: expense.id,
            debitAmount: monthly.toFixed(6),
            description: `${asset.name} straight-line`,
          },
          {
            accountId: accum.id,
            creditAmount: monthly.toFixed(6),
            description: `${asset.name} accumulated`,
          },
        ],
        post: true,
      });
      return {
        assetId: asset.id,
        period,
        amount: monthly.toFixed(2),
        journalEntryId: journal.id,
      };
    } catch (error) {
      if (error instanceof AccountingError) {
        throw new BadRequestException({
          error: { code: error.code, message: error.message },
        });
      }
      throw error;
    }
  }

  listTimeEntries(organizationId: string) {
    return prisma.timeEntry.findMany({
      where: { organizationId },
      include: { person: true },
      orderBy: { entryDate: 'desc' },
      take: 200,
    });
  }

  createTimeEntry(
    organizationId: string,
    body: {
      personId: string;
      projectId?: string;
      entryDate: string;
      hours: string;
      description?: string;
      billable?: boolean;
      billingRate?: string;
    },
  ) {
    if (!body.personId) {
      throw new BadRequestException({
        error: { code: 'PERSON_REQUIRED', message: 'Person is required.' },
      });
    }
    return prisma.timeEntry.create({
      data: {
        organizationId,
        personId: body.personId,
        projectId: body.projectId,
        entryDate: new Date(body.entryDate),
        hours: body.hours,
        description: body.description,
        billable: body.billable ?? true,
        billingRate: body.billingRate,
      },
      include: { person: true },
    });
  }

  listPayrollPeriods(organizationId: string) {
    return prisma.payrollPeriod.findMany({
      where: { organizationId },
      include: { runs: { orderBy: { runDate: 'desc' } } },
      orderBy: { startDate: 'desc' },
    });
  }

  createPayrollPeriod(
    organizationId: string,
    body: { name: string; startDate: string; endDate: string },
  ) {
    return prisma.payrollPeriod.create({
      data: {
        organizationId,
        name: body.name,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
      },
    });
  }

  async createPayrollRun(
    organizationId: string,
    body: { periodId: string; runDate: string; notes?: string },
  ) {
    const period = await prisma.payrollPeriod.findFirst({
      where: { id: body.periodId, organizationId },
    });
    if (!period) {
      throw new BadRequestException({
        error: { code: 'PERIOD_NOT_FOUND', message: 'Payroll period not found.' },
      });
    }
    const people = await prisma.person.findMany({
      where: { organizationId, status: 'ACTIVE' },
      include: {
        compensations: { orderBy: { effectiveFrom: 'desc' }, take: 1 },
      },
    });
    const run = await prisma.payrollRun.create({
      data: {
        organizationId,
        periodId: period.id,
        runDate: new Date(body.runDate),
        status: 'DRAFT',
        notes: body.notes,
      },
    });

    for (const person of people) {
      const gross = new Decimal(person.compensations[0]?.grossPay?.toString() ?? '0');
      if (gross.lte(0)) continue;
      const tdsRate = new Decimal(person.tdsPercent?.toString() ?? '0');
      const deductions = tdsRate.gt(0)
        ? gross.times(tdsRate).dividedBy(100)
        : new Decimal(0);
      const net = gross.minus(deductions);
      await prisma.payrollItem.create({
        data: {
          organizationId,
          runId: run.id,
          personId: person.id,
          grossPay: gross.toFixed(6),
          deductions: deductions.toFixed(6),
          netPay: net.toFixed(6),
        },
      });
      await prisma.payslip.create({
        data: {
          organizationId,
          runId: run.id,
          personId: person.id,
          grossPay: gross.toFixed(6),
          deductions: deductions.toFixed(6),
          netPay: net.toFixed(6),
        },
      });
    }

    return prisma.payrollRun.findFirstOrThrow({
      where: { id: run.id },
      include: { items: { include: { person: true } }, payslips: true, period: true },
    });
  }

  async postPayrollRun(organizationId: string, userId: string, runId: string) {
    const run = await prisma.payrollRun.findFirst({
      where: { id: runId, organizationId },
      include: { items: true, period: true },
    });
    if (!run) {
      throw new BadRequestException({
        error: { code: 'RUN_NOT_FOUND', message: 'Payroll run not found.' },
      });
    }
    if (run.status !== 'DRAFT') {
      throw new BadRequestException({
        error: { code: 'RUN_NOT_DRAFT', message: 'Only draft runs can be posted.' },
      });
    }
    if (run.items.length === 0) {
      throw new BadRequestException({
        error: { code: 'EMPTY_RUN', message: 'No payroll items to post.' },
      });
    }

    const salaries = await prisma.ledgerAccount.findFirst({
      where: { organizationId, code: '6100' },
    });
    const payable = await prisma.ledgerAccount.findFirst({
      where: { organizationId, code: '2300' },
    });
    const tdsPayable =
      (await prisma.ledgerAccount.findFirst({
        where: { organizationId, code: '2230' },
      })) ??
      (await prisma.ledgerAccount.findFirst({
        where: { organizationId, code: '2220' },
      }));
    if (!salaries || !payable) {
      throw new BadRequestException({
        error: {
          code: 'MISSING_ACCOUNTS',
          message: 'Salaries (6100) or Payroll Payable (2300) missing.',
        },
      });
    }

    const gross = run.items.reduce(
      (s, i) => s.plus(i.grossPay.toString()),
      new Decimal(0),
    );
    const deductions = run.items.reduce(
      (s, i) => s.plus(i.deductions.toString()),
      new Decimal(0),
    );
    const net = run.items.reduce((s, i) => s.plus(i.netPay.toString()), new Decimal(0));

    const lines: Array<{
      accountId: string;
      debitAmount?: string;
      creditAmount?: string;
      description: string;
    }> = [
      {
        accountId: salaries.id,
        debitAmount: gross.toFixed(6),
        description: `Payroll ${run.period.name}`,
      },
      {
        accountId: payable.id,
        creditAmount: net.toFixed(6),
        description: `Payroll ${run.period.name} net`,
      },
    ];
    if (deductions.gt(0)) {
      if (!tdsPayable) {
        throw new BadRequestException({
          error: {
            code: 'MISSING_TDS_ACCOUNT',
            message: 'TDS Payable (2230) missing for payroll deductions.',
          },
        });
      }
      lines.push({
        accountId: tdsPayable.id,
        creditAmount: deductions.toFixed(6),
        description: `Payroll TDS ${run.period.name}`,
      });
    }

    try {
      const journal = await this.posting.createJournal({
        organizationId,
        entryDate: run.runDate,
        description: `Payroll run — ${run.period.name}`,
        sourceType: 'payroll_run',
        sourceId: run.id,
        createdById: userId,
        lines,
        post: true,
      });
      return prisma.payrollRun.update({
        where: { id: run.id },
        data: { status: 'POSTED', journalEntryId: journal.id },
        include: { items: { include: { person: true } }, period: true },
      });
    } catch (error) {
      if (error instanceof AccountingError) {
        throw new BadRequestException({
          error: { code: error.code, message: error.message },
        });
      }
      throw error;
    }
  }

  listPayrollRuns(organizationId: string) {
    return prisma.payrollRun.findMany({
      where: { organizationId },
      include: {
        period: true,
        items: { include: { person: true } },
        payslips: { include: { person: true } },
      },
      orderBy: { runDate: 'desc' },
    });
  }

  async payslipPdfBuffer(organizationId: string, runId: string, personId: string) {
    const run = await prisma.payrollRun.findFirst({
      where: { id: runId, organizationId },
      include: { period: true },
    });
    if (!run) {
      throw new BadRequestException({
        error: { code: 'RUN_NOT_FOUND', message: 'Payroll run not found.' },
      });
    }
    if (run.status !== 'POSTED') {
      throw new BadRequestException({
        error: {
          code: 'RUN_NOT_POSTED',
          message: 'Payslips are available after the payroll run is posted.',
        },
      });
    }
    const payslip = await prisma.payslip.findFirst({
      where: { runId, personId, organizationId },
      include: { person: true },
    });
    if (!payslip) {
      throw new BadRequestException({
        error: { code: 'PAYSLIP_NOT_FOUND', message: 'Payslip not found for this employee.' },
      });
    }

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    let logo: Buffer | null = null;
    if (org.logoUrl) {
      try {
        const { LocalObjectStorage } = await import('../storage/object-storage.js');
        logo = await new LocalObjectStorage().getObject(org.logoUrl);
      } catch {
        logo = null;
      }
    }

    const { buildPayslipPdf } = await import('./payslip-pdf.js');
    return buildPayslipPdf({
      organizationName: org.name,
      legalName: org.legalName,
      organizationAddress: org.address,
      organizationPhone: org.phone,
      organizationEmail: org.email,
      taxIdentifier: org.taxIdentifier,
      logo,
      primaryColor: org.invoicePrimaryColor,
      accentColor: org.invoiceAccentColor,
      periodName: run.period.name,
      periodStart: run.period.startDate.toISOString().slice(0, 10),
      periodEnd: run.period.endDate.toISOString().slice(0, 10),
      runDate: run.runDate.toISOString().slice(0, 10),
      employeeName: payslip.person.name,
      employeeTitle: payslip.person.title,
      nationalId: payslip.person.nationalId,
      taxIdentifierEmployee: payslip.person.taxIdentifier,
      bankName: payslip.person.bankName,
      bankAccountNumber: payslip.person.bankAccountNumber,
      grossPay: payslip.grossPay.toString(),
      deductions: payslip.deductions.toString(),
      netPay: payslip.netPay.toString(),
    });
  }

  private async requirePerson(organizationId: string, personId: string) {
    const person = await prisma.person.findFirst({
      where: { id: personId, organizationId },
    });
    if (!person) {
      throw new NotFoundException({
        error: { code: 'PERSON_NOT_FOUND', message: 'Person not found.' },
      });
    }
    return person;
  }

  async uploadPersonPhoto(
    organizationId: string,
    personId: string,
    file: Express.Multer.File,
  ) {
    await this.requirePerson(organizationId, personId);
    const buffer = file?.buffer;
    if (!buffer?.length) {
      throw new BadRequestException({
        error: { code: 'NO_FILE', message: 'A photo file is required.' },
      });
    }
    const mime = file.mimetype || '';
    if (!mime.startsWith('image/')) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_PHOTO_TYPE',
          message: 'Photo must be an image (PNG, JPEG, or WebP).',
        },
      });
    }
    const ext =
      mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'bin';
    const storage = new LocalObjectStorage();
    const key = `${organizationId}/people/${personId}/photo.${ext}`;
    await storage.putObject({ key, body: buffer, contentType: mime });
    return prisma.person.update({
      where: { id: personId },
      data: { photoUrl: key },
    });
  }

  async getPersonPhoto(organizationId: string, personId: string) {
    const person = await this.requirePerson(organizationId, personId);
    if (!person.photoUrl) {
      throw new NotFoundException({
        error: { code: 'PHOTO_NOT_FOUND', message: 'No photo uploaded.' },
      });
    }
    const storage = new LocalObjectStorage();
    const body = await storage.getObject(person.photoUrl);
    const ext = person.photoUrl.split('.').pop()?.toLowerCase();
    const contentType =
      ext === 'png'
        ? 'image/png'
        : ext === 'jpg' || ext === 'jpeg'
          ? 'image/jpeg'
          : ext === 'webp'
            ? 'image/webp'
            : 'application/octet-stream';
    return { body, contentType };
  }

  async uploadPersonNid(
    organizationId: string,
    personId: string,
    file: Express.Multer.File,
  ) {
    await this.requirePerson(organizationId, personId);
    const buffer = file?.buffer;
    if (!buffer?.length) {
      throw new BadRequestException({
        error: { code: 'NO_FILE', message: 'An NID document is required.' },
      });
    }
    const mime = file.mimetype || '';
    const allowed =
      mime.startsWith('image/') || mime === 'application/pdf' || mime === 'application/octet-stream';
    if (!allowed) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_NID_TYPE',
          message: 'NID copy must be an image or PDF.',
        },
      });
    }
    const ext =
      mime === 'application/pdf'
        ? 'pdf'
        : mime === 'image/png'
          ? 'png'
          : mime === 'image/jpeg'
            ? 'jpg'
            : mime === 'image/webp'
              ? 'webp'
              : 'bin';
    const storage = new LocalObjectStorage();
    const key = `${organizationId}/people/${personId}/nid.${ext}`;
    await storage.putObject({
      key,
      body: buffer,
      contentType: mime === 'application/octet-stream' ? 'application/pdf' : mime,
    });
    return prisma.person.update({
      where: { id: personId },
      data: { nidDocumentUrl: key },
    });
  }

  async getPersonNid(organizationId: string, personId: string) {
    const person = await this.requirePerson(organizationId, personId);
    if (!person.nidDocumentUrl) {
      throw new NotFoundException({
        error: { code: 'NID_NOT_FOUND', message: 'No NID document uploaded.' },
      });
    }
    const storage = new LocalObjectStorage();
    const body = await storage.getObject(person.nidDocumentUrl);
    const ext = person.nidDocumentUrl.split('.').pop()?.toLowerCase();
    const contentType = ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : 'image/jpeg';
    return { body, contentType, filename: `nid-${personId}.${ext ?? 'pdf'}` };
  }
}
