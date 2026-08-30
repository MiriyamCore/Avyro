import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { prisma } from '@avyro/database';
import type { RoleName } from '@avyro/types';
import { hashPassword, verifyPassword } from 'better-auth/crypto';
import { LocalObjectStorage } from '../storage/object-storage.js';

const credentialIssuer = 'local:credential';

const ROLE_RANK: Record<RoleName, number> = {
  OWNER: 100,
  ACCOUNTANT: 80,
  MANAGER: 60,
  EMPLOYEE: 40,
  AUDITOR: 20,
};

@Injectable()
export class OrganizationsService {
  async listForUser(userId: string) {
    const memberships = await prisma.membership.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { organization: true, workspace: true },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      legalName: m.organization.legalName,
      countryCode: m.organization.countryCode,
      baseCurrency: m.organization.baseCurrency,
      timezone: m.organization.timezone,
      fiscalYearStartMonth: m.organization.fiscalYearStartMonth,
      fiscalYearStartDay: m.organization.fiscalYearStartDay,
      taxIdentifier: m.organization.taxIdentifier,
      vatIdentifier: m.organization.vatIdentifier,
      setupCompletedAt: m.organization.setupCompletedAt,
      role: m.role,
      uiMode: m.uiMode,
      workspaceId: m.workspaceId,
      workspaceName: m.workspace.name,
    }));
  }

  async getScoped(organizationId: string, userId: string) {
    const membership = await prisma.membership.findUnique({
      where: {
        organizationId_userId: { organizationId, userId },
      },
      include: { organization: true },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenException({
        error: {
          code: 'ORG_ACCESS_DENIED',
          message: 'You do not have access to this organisation.',
        },
      });
    }

    return membership;
  }

  async requireRole(
    organizationId: string,
    userId: string,
    minimum: RoleName,
  ) {
    const membership = await this.getScoped(organizationId, userId);
    if (ROLE_RANK[membership.role] < ROLE_RANK[minimum]) {
      throw new ForbiddenException({
        error: {
          code: 'INSUFFICIENT_ROLE',
          message: `Requires ${minimum} role or higher.`,
        },
      });
    }
    return membership;
  }

  async getByIdForUser(organizationId: string, userId: string) {
    const membership = await this.getScoped(organizationId, userId);
    const org = membership.organization;
    if (!org) {
      throw new NotFoundException({
        error: { code: 'ORG_NOT_FOUND', message: 'Organisation not found.' },
      });
    }
    return {
      ...org,
      role: membership.role,
      uiMode: membership.uiMode,
    };
  }

  async updateSettings(
    organizationId: string,
    body: {
      name?: string;
      legalName?: string | null;
      legalType?: string;
      businessActivity?: string | null;
      countryCode?: string;
      baseCurrency?: string;
      timezone?: string;
      fiscalYearStartMonth?: number;
      fiscalYearStartDay?: number;
      address?: string | null;
      phone?: string | null;
      email?: string | null;
      website?: string | null;
      logoUrl?: string | null;
      taxIdentifier?: string | null;
      vatIdentifier?: string | null;
      tradeLicenseNumber?: string | null;
      invoicePrefix?: string | null;
      quotePrefix?: string | null;
      invoiceFooter?: string | null;
      invoicePrimaryColor?: string | null;
      invoiceAccentColor?: string | null;
      invoiceTemplate?: string | null;
      defaultPaymentTermsDays?: number;
      markSetupComplete?: boolean;
    },
  ) {
    return prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.legalName !== undefined ? { legalName: body.legalName } : {}),
        ...(body.legalType !== undefined ? { legalType: body.legalType } : {}),
        ...(body.businessActivity !== undefined
          ? { businessActivity: body.businessActivity }
          : {}),
        ...(body.countryCode !== undefined ? { countryCode: body.countryCode } : {}),
        ...(body.baseCurrency !== undefined ? { baseCurrency: body.baseCurrency } : {}),
        ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
        ...(body.fiscalYearStartMonth !== undefined
          ? { fiscalYearStartMonth: body.fiscalYearStartMonth }
          : {}),
        ...(body.fiscalYearStartDay !== undefined
          ? { fiscalYearStartDay: body.fiscalYearStartDay }
          : {}),
        ...(body.address !== undefined ? { address: body.address } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.website !== undefined ? { website: body.website } : {}),
        ...(body.logoUrl !== undefined ? { logoUrl: body.logoUrl } : {}),
        ...(body.taxIdentifier !== undefined ? { taxIdentifier: body.taxIdentifier } : {}),
        ...(body.vatIdentifier !== undefined ? { vatIdentifier: body.vatIdentifier } : {}),
        ...(body.tradeLicenseNumber !== undefined
          ? { tradeLicenseNumber: body.tradeLicenseNumber }
          : {}),
        ...(body.invoicePrefix !== undefined ? { invoicePrefix: body.invoicePrefix } : {}),
        ...(body.quotePrefix !== undefined ? { quotePrefix: body.quotePrefix } : {}),
        ...(body.invoiceFooter !== undefined ? { invoiceFooter: body.invoiceFooter } : {}),
        ...(body.invoicePrimaryColor !== undefined
          ? { invoicePrimaryColor: body.invoicePrimaryColor }
          : {}),
        ...(body.invoiceAccentColor !== undefined
          ? { invoiceAccentColor: body.invoiceAccentColor }
          : {}),
        ...(body.invoiceTemplate !== undefined ? { invoiceTemplate: body.invoiceTemplate } : {}),
        ...(body.defaultPaymentTermsDays !== undefined
          ? { defaultPaymentTermsDays: body.defaultPaymentTermsDays }
          : {}),
        ...(body.markSetupComplete ? { setupCompletedAt: new Date() } : {}),
      },
    });
  }

  async uploadLogo(organizationId: string, file: Express.Multer.File) {
    const buffer = file?.buffer;
    if (!buffer?.length) {
      throw new BadRequestException({
        error: { code: 'NO_FILE', message: 'A logo file is required.' },
      });
    }
    const mime = file.mimetype || '';
    if (!mime.startsWith('image/')) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_LOGO_TYPE',
          message: 'Logo must be an image (PNG, JPEG, WebP, or SVG).',
        },
      });
    }
    const ext =
      mime === 'image/png'
        ? 'png'
        : mime === 'image/jpeg'
          ? 'jpg'
          : mime === 'image/webp'
            ? 'webp'
            : mime === 'image/svg+xml'
              ? 'svg'
              : 'bin';
    const storage = new LocalObjectStorage();
    const key = `${organizationId}/branding/logo.${ext}`;
    await storage.putObject({
      key,
      body: buffer,
      contentType: mime,
    });
    return prisma.organization.update({
      where: { id: organizationId },
      data: { logoUrl: key },
    });
  }

  async getLogo(organizationId: string) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { logoUrl: true },
    });
    if (!org?.logoUrl) {
      throw new NotFoundException({
        error: { code: 'LOGO_NOT_FOUND', message: 'No logo uploaded.' },
      });
    }
    const storage = new LocalObjectStorage();
    const body = await storage.getObject(org.logoUrl);
    const ext = org.logoUrl.split('.').pop()?.toLowerCase();
    const contentType =
      ext === 'png'
        ? 'image/png'
        : ext === 'jpg' || ext === 'jpeg'
          ? 'image/jpeg'
          : ext === 'webp'
            ? 'image/webp'
            : ext === 'svg'
              ? 'image/svg+xml'
              : 'application/octet-stream';
    return { body, contentType };
  }

  async clearLogo(organizationId: string) {
    return prisma.organization.update({
      where: { id: organizationId },
      data: { logoUrl: null },
    });
  }

  listMembers(organizationId: string) {
    return prisma.membership
      .findMany({
        where: { organizationId },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'asc' },
      })
      .then((rows) =>
        rows.map((m) => ({
          id: m.id,
          userId: m.userId,
          name: m.user.name,
          email: m.user.email,
          role: m.role,
          uiMode: m.uiMode,
          status: m.status,
          createdAt: m.createdAt,
        })),
      );
  }

  async createMember(
    organizationId: string,
    actorUserId: string,
    body: {
      name: string;
      email: string;
      password: string;
      role: RoleName;
      uiMode?: 'SIMPLE' | 'ACCOUNTANT';
    },
  ) {
    await this.requireRole(organizationId, actorUserId, 'OWNER');
    if (body.role === 'OWNER') {
      throw new BadRequestException({
        error: {
          code: 'OWNER_NOT_ASSIGNABLE',
          message: 'Cannot create another OWNER this way.',
        },
      });
    }
    if (!body.password || body.password.length < 8) {
      throw new BadRequestException({
        error: {
          code: 'WEAK_PASSWORD',
          message: 'Password must be at least 8 characters.',
        },
      });
    }

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    const email = body.email.trim().toLowerCase();
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const passwordHash = await hashPassword(body.password);
      user = await prisma.user.create({
        data: {
          name: body.name.trim(),
          email,
          emailVerified: true,
          accounts: {
            create: {
              issuer: credentialIssuer,
              accountId: email,
              providerId: 'credential',
              password: passwordHash,
            },
          },
        },
      });
    } else {
      const existing = await prisma.membership.findUnique({
        where: {
          organizationId_userId: { organizationId, userId: user.id },
        },
      });
      if (existing && existing.status === 'ACTIVE') {
        throw new BadRequestException({
          error: {
            code: 'MEMBER_EXISTS',
            message: 'This person is already a member.',
          },
        });
      }
      const passwordHash = await hashPassword(body.password);
      const account = await prisma.account.findFirst({
        where: { userId: user.id, providerId: 'credential', issuer: credentialIssuer },
      });
      if (account) {
        await prisma.account.update({
          where: { id: account.id },
          data: { password: passwordHash },
        });
      } else {
        await prisma.account.create({
          data: {
            userId: user.id,
            issuer: credentialIssuer,
            accountId: email,
            providerId: 'credential',
            password: passwordHash,
          },
        });
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { name: body.name.trim() },
      });
    }

    const membership = await prisma.membership.upsert({
      where: {
        organizationId_userId: { organizationId, userId: user.id },
      },
      update: {
        role: body.role,
        uiMode: body.uiMode ?? 'SIMPLE',
        status: 'ACTIVE',
      },
      create: {
        workspaceId: org.workspaceId,
        organizationId,
        userId: user.id,
        role: body.role,
        uiMode: body.uiMode ?? 'SIMPLE',
        status: 'ACTIVE',
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return {
      id: membership.id,
      userId: membership.userId,
      name: membership.user.name,
      email: membership.user.email,
      role: membership.role,
      uiMode: membership.uiMode,
      status: membership.status,
    };
  }

  async updateMember(
    organizationId: string,
    actorUserId: string,
    membershipId: string,
    body: {
      role?: RoleName;
      uiMode?: 'SIMPLE' | 'ACCOUNTANT';
      status?: 'ACTIVE' | 'DISABLED';
    },
  ) {
    await this.requireRole(organizationId, actorUserId, 'OWNER');
    const membership = await prisma.membership.findFirst({
      where: { id: membershipId, organizationId },
      include: { user: true },
    });
    if (!membership) {
      throw new NotFoundException({
        error: { code: 'MEMBER_NOT_FOUND', message: 'Member not found.' },
      });
    }
    if (membership.role === 'OWNER' && (body.role || body.status === 'DISABLED')) {
      throw new BadRequestException({
        error: {
          code: 'OWNER_PROTECTED',
          message: 'Cannot change or disable the OWNER membership.',
        },
      });
    }
    if (body.role === 'OWNER') {
      throw new BadRequestException({
        error: {
          code: 'OWNER_NOT_ASSIGNABLE',
          message: 'Cannot promote to OWNER here.',
        },
      });
    }

    const updated = await prisma.membership.update({
      where: { id: membership.id },
      data: {
        ...(body.role !== undefined ? { role: body.role } : {}),
        ...(body.uiMode !== undefined ? { uiMode: body.uiMode } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return {
      id: updated.id,
      userId: updated.userId,
      name: updated.user.name,
      email: updated.user.email,
      role: updated.role,
      uiMode: updated.uiMode,
      status: updated.status,
    };
  }

  async resetMemberPassword(
    organizationId: string,
    actorUserId: string,
    membershipId: string,
    password: string,
  ) {
    await this.requireRole(organizationId, actorUserId, 'OWNER');
    if (!password || password.length < 8) {
      throw new BadRequestException({
        error: {
          code: 'WEAK_PASSWORD',
          message: 'Password must be at least 8 characters.',
        },
      });
    }
    const membership = await prisma.membership.findFirst({
      where: { id: membershipId, organizationId },
    });
    if (!membership) {
      throw new NotFoundException({
        error: { code: 'MEMBER_NOT_FOUND', message: 'Member not found.' },
      });
    }
    const passwordHash = await hashPassword(password);
    const account = await prisma.account.findFirst({
      where: { userId: membership.userId, providerId: 'credential', issuer: credentialIssuer },
    });
    if (!account) {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: membership.userId },
      });
      await prisma.account.create({
        data: {
          userId: user.id,
          issuer: credentialIssuer,
          accountId: user.email,
          providerId: 'credential',
          password: passwordHash,
        },
      });
    } else {
      await prisma.account.update({
        where: { id: account.id },
        data: { password: passwordHash },
      });
    }
    return { ok: true };
  }

  async updateOwnUiMode(
    organizationId: string,
    userId: string,
    uiMode: 'SIMPLE' | 'ACCOUNTANT',
  ) {
    const membership = await this.getScoped(organizationId, userId);
    return prisma.membership.update({
      where: { id: membership.id },
      data: { uiMode },
    });
  }

  async changeOwnPassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException({
        error: {
          code: 'WEAK_PASSWORD',
          message: 'New password must be at least 8 characters.',
        },
      });
    }
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const account = await prisma.account.findFirst({
      where: { userId, providerId: 'credential' },
    });
    if (!account?.password) {
      throw new BadRequestException({
        error: {
          code: 'NO_PASSWORD',
          message: 'No password credential on this account.',
        },
      });
    }
    const valid = await verifyPassword({
      hash: account.password,
      password: currentPassword,
    });
    if (!valid) {
      throw new ForbiddenException({
        error: {
          code: 'INVALID_PASSWORD',
          message: 'Current password is incorrect.',
        },
      });
    }
    const passwordHash = await hashPassword(newPassword);
    await prisma.account.update({
      where: { id: account.id },
      data: { password: passwordHash },
    });
    return { ok: true, email: user.email };
  }
}
