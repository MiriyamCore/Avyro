import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentMemberships,
  CurrentOrg,
  CurrentUser,
  SessionGuard,
  type OrgMembership,
  type RequestUser,
} from './auth/session.guard.js';
import { OrganizationsService } from './organizations/organizations.service.js';

@Controller('me')
@UseGuards(SessionGuard)
export class MeController {
  constructor(
    @Inject(OrganizationsService)
    private readonly organizations: OrganizationsService,
  ) {}

  @Get()
  me(
    @CurrentUser() user: RequestUser,
    @CurrentMemberships() memberships: OrgMembership[],
    @CurrentOrg() organization: OrgMembership | null,
  ) {
    return {
      user,
      memberships,
      currentOrganization: organization,
    };
  }

  @Post('password')
  changePassword(
    @CurrentUser() user: RequestUser,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    return this.organizations.changeOwnPassword(
      user.id,
      body.currentPassword,
      body.newPassword,
    );
  }

  @Patch('ui-mode')
  async updateUiMode(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body() body: { uiMode: 'SIMPLE' | 'ACCOUNTANT' },
  ) {
    if (!current) {
      throw new ForbiddenException({
        error: {
          code: 'NO_ORGANIZATION',
          message: 'No organisation membership found.',
        },
      });
    }
    const membership = await this.organizations.updateOwnUiMode(
      current.organizationId,
      user.id,
      body.uiMode,
    );
    return { uiMode: membership.uiMode };
  }
}
