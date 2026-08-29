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
import { OrganizationsService } from './organizations.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { RoleName } from '@avyro/types';

@Controller('members')
@UseGuards(SessionGuard)
export class MembersController {
  constructor(
    @Inject(OrganizationsService)
    private readonly organizations: OrganizationsService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  private requireOrg(current: OrgMembership | null): OrgMembership {
    if (!current) {
      throw new ForbiddenException({
        error: {
          code: 'NO_ORGANIZATION',
          message: 'No organisation membership found.',
        },
      });
    }
    return current;
  }

  @Get()
  list(@CurrentOrg() current: OrgMembership | null) {
    const org = this.requireOrg(current);
    return this.organizations.listMembers(org.organizationId);
  }

  @Post()
  async create(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      name: string;
      email: string;
      password: string;
      role: RoleName;
      uiMode?: 'SIMPLE' | 'ACCOUNTANT';
    },
  ) {
    const org = this.requireOrg(current);
    const member = await this.organizations.createMember(
      org.organizationId,
      user.id,
      body,
    );
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'CREATE',
      entityType: 'Membership',
      entityId: member.id,
      afterJson: {
        email: member.email,
        role: member.role,
        uiMode: member.uiMode,
      },
    });
    return member;
  }

  @Patch(':id')
  async update(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body()
    body: {
      role?: RoleName;
      uiMode?: 'SIMPLE' | 'ACCOUNTANT';
      status?: 'ACTIVE' | 'DISABLED';
    },
  ) {
    const org = this.requireOrg(current);
    const member = await this.organizations.updateMember(
      org.organizationId,
      user.id,
      id,
      body,
    );
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Membership',
      entityId: member.id,
      afterJson: body,
    });
    return member;
  }

  @Post(':id/reset-password')
  async resetPassword(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { password: string },
  ) {
    const org = this.requireOrg(current);
    const result = await this.organizations.resetMemberPassword(
      org.organizationId,
      user.id,
      id,
      body.password,
    );
    await this.audit.write({
      organizationId: org.organizationId,
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Membership',
      entityId: id,
      afterJson: { passwordReset: true },
    });
    return result;
  }
}
