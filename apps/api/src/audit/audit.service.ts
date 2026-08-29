import { Injectable } from '@nestjs/common';
import { prisma, type Prisma } from '@avyro/database';

@Injectable()
export class AuditService {
  write(input: {
    organizationId?: string;
    userId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    beforeJson?: Prisma.InputJsonValue;
    afterJson?: Prisma.InputJsonValue;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        beforeJson: input.beforeJson,
        afterJson: input.afterJson,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }

  list(
    organizationId: string,
    options?: {
      action?: string;
      entityType?: string;
      entityId?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    const page = Math.max(1, options?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options?.pageSize ?? 50));
    const where = {
      organizationId,
      ...(options?.action ? { action: options.action } : {}),
      ...(options?.entityType ? { entityType: options.entityType } : {}),
      ...(options?.entityId ? { entityId: options.entityId } : {}),
    };
    return prisma.auditLog
      .findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      })
      .then(async (rows) => {
        const total = await prisma.auditLog.count({ where });
        return {
          data: rows.map((r) => ({
            id: r.id,
            action: r.action,
            entityType: r.entityType,
            entityId: r.entityId,
            actorName: r.user?.name ?? null,
            actorEmail: r.user?.email ?? null,
            userId: r.userId,
            beforeJson: r.beforeJson,
            afterJson: r.afterJson,
            createdAt: r.createdAt.toISOString(),
          })),
          pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        };
      });
  }
}
