import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from './auth.js';
import { prisma } from '@avyro/database';
import type { RoleName } from '@avyro/types';

export type RequestUser = {
  id: string;
  email: string;
  name: string;
};

export type OrgMembership = {
  organizationId: string;
  workspaceId: string;
  role: RoleName;
  uiMode: 'SIMPLE' | 'ACCOUNTANT';
  organizationName: string;
  setupCompletedAt: string | null;
};

@Injectable()
export class SessionGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (!session?.user) {
      throw new UnauthorizedException({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Sign in required.',
        },
      });
    }

    request.user = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    } satisfies RequestUser;

    const memberships = await prisma.membership.findMany({
      where: { userId: session.user.id, status: 'ACTIVE' },
      include: { organization: true },
      orderBy: { createdAt: 'asc' },
    });

    request.memberships = memberships.map(
      (m): OrgMembership => ({
        organizationId: m.organizationId,
        workspaceId: m.workspaceId,
        role: m.role,
        uiMode: m.uiMode,
        organizationName: m.organization.name,
        setupCompletedAt: m.organization.setupCompletedAt
          ? m.organization.setupCompletedAt.toISOString()
          : null,
      }),
    );

    const headerOrg = request.headers['x-organization-id'] as string | undefined;
    const selected =
      (headerOrg
        ? request.memberships.find((m: OrgMembership) => m.organizationId === headerOrg)
        : undefined) ?? request.memberships[0];

    request.organizationContext = selected ?? null;

    return true;
  }
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().user as RequestUser;
});

export const CurrentOrg = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().organizationContext as OrgMembership | null;
});

export const CurrentMemberships = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().memberships as OrgMembership[];
});
