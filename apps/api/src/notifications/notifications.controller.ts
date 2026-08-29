import {
  Body,
  Controller,
  ForbiddenException,
  Inject,
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
import { NotificationsService } from './notifications.service.js';

@Controller('notifications')
@UseGuards(SessionGuard)
export class NotificationsController {
  constructor(
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(OrganizationsService)
    private readonly organizations: OrganizationsService,
  ) {}

  @Post('email/invoice')
  async emailInvoice(
    @CurrentOrg() current: OrgMembership | null,
    @CurrentUser() user: RequestUser,
    @Body() body: { invoiceId: string; to: string; attachPdf?: boolean },
  ) {
    if (!current) {
      throw new ForbiddenException({
        error: { code: 'NO_ORGANIZATION', message: 'No organisation membership found.' },
      });
    }
    await this.organizations.requireRole(current.organizationId, user.id, 'MANAGER');
    return this.notifications.enqueueInvoiceEmail(
      current.organizationId,
      body.invoiceId,
      body.to,
      body.attachPdf ?? true,
    );
  }
}
