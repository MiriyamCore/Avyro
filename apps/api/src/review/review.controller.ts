import {
  Controller,
  ForbiddenException,
  Get,
  Inject,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentOrg,
  SessionGuard,
  type OrgMembership,
} from '../auth/session.guard.js';
import { ReviewService } from './review.service.js';

@Controller('review')
@UseGuards(SessionGuard)
export class ReviewController {
  constructor(@Inject(ReviewService) private readonly review: ReviewService) {}

  private requireOrg(current: OrgMembership | null): OrgMembership {
    if (!current) {
      throw new ForbiddenException({
        error: { code: 'NO_ORGANIZATION', message: 'No organisation membership found.' },
      });
    }
    return current;
  }

  @Get('queue')
  queue(@CurrentOrg() current: OrgMembership | null) {
    return this.review.queue(this.requireOrg(current).organizationId);
  }
}
