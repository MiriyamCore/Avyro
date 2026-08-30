import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { prisma } from '@avyro/database';
import type { BackupFrequency } from '@avyro/database';
import { readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AuditService } from '../audit/audit.service.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import { createBackupArchive, restoreBackupArchive } from './backup-db.js';
import {
  buildBackupFilename,
  buildBackupKey,
  isBackupDue,
  resolveBackupStorage,
} from './backup-storage.js';

const FREQUENCIES = ['OFF', 'DAILY', 'WEEKLY', 'MONTHLY'] as const;

function serializeBackup(record: {
  id: string;
  organizationId: string;
  storage: string;
  storageKey: string;
  filename: string;
  sizeBytes: bigint;
  status: string;
  errorMessage: string | null;
  triggeredBy: string | null;
  createdAt: Date;
  completedAt: Date | null;
}) {
  return {
    id: record.id,
    organizationId: record.organizationId,
    storage: record.storage,
    storageKey: record.storageKey,
    filename: record.filename,
    sizeBytes: record.sizeBytes.toString(),
    status: record.status,
    errorMessage: record.errorMessage,
    triggeredBy: record.triggeredBy,
    createdAt: record.createdAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class BackupsService implements OnModuleInit {
  private schedulerTimer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(OrganizationsService)
    private readonly organizations: OrganizationsService,
    @Inject(AuditService)
    private readonly audit: AuditService,
  ) {}

  onModuleInit() {
    const intervalMs = Number(process.env.BACKUP_SCHEDULER_INTERVAL_MS ?? 15 * 60 * 1000);
    this.schedulerTimer = setInterval(() => {
      void this.runDueScheduledBackups().catch((err) => {
        console.error('[backups] scheduled run failed', err);
      });
    }, intervalMs);
  }

  async getSettings(organizationId: string, userId: string) {
    await this.organizations.requireRole(organizationId, userId, 'OWNER');
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    const { kind } = resolveBackupStorage();
    const latest = await prisma.backupRecord.findFirst({
      where: { organizationId, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
    });
    return {
      frequency: org.backupFrequency,
      lastRunAt: org.backupLastRunAt?.toISOString() ?? null,
      storageTarget: kind,
      latestBackup: latest ? serializeBackup(latest) : null,
    };
  }

  async updateSettings(
    organizationId: string,
    userId: string,
    frequency: BackupFrequency,
  ) {
    await this.organizations.requireRole(organizationId, userId, 'OWNER');
    if (!FREQUENCIES.includes(frequency)) {
      throw new BadRequestException({
        error: { code: 'INVALID_FREQUENCY', message: 'Invalid backup frequency.' },
      });
    }
    const org = await prisma.organization.update({
      where: { id: organizationId },
      data: { backupFrequency: frequency },
    });
    await this.audit.write({
      organizationId,
      userId,
      action: 'UPDATE',
      entityType: 'BackupSettings',
      entityId: organizationId,
      afterJson: { frequency },
    });
    return {
      frequency: org.backupFrequency,
      lastRunAt: org.backupLastRunAt?.toISOString() ?? null,
    };
  }

  async list(organizationId: string, userId: string) {
    await this.organizations.requireRole(organizationId, userId, 'OWNER');
    const records = await prisma.backupRecord.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return records.map(serializeBackup);
  }

  async triggerBackup(organizationId: string, userId: string) {
    await this.organizations.requireRole(organizationId, userId, 'OWNER');
    const record = await this.startBackup(organizationId, userId);
    void this.executeBackup(record.id).catch((err) => {
      console.error(`[backups] backup ${record.id} failed`, err);
    });
    return serializeBackup(record);
  }

  async restore(
    organizationId: string,
    userId: string,
    backupId: string,
    confirm: string,
  ) {
    await this.organizations.requireRole(organizationId, userId, 'OWNER');
    if (confirm !== 'RESTORE') {
      throw new BadRequestException({
        error: {
          code: 'CONFIRMATION_REQUIRED',
          message: 'Type RESTORE in the confirm field to proceed.',
        },
      });
    }

    const record = await prisma.backupRecord.findFirst({
      where: { id: backupId, organizationId, status: 'COMPLETED' },
    });
    if (!record) {
      throw new NotFoundException({
        error: { code: 'BACKUP_NOT_FOUND', message: 'Backup not found.' },
      });
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new BadRequestException({
        error: { code: 'NO_DATABASE_URL', message: 'DATABASE_URL is not configured.' },
      });
    }

    const tmpPath = path.join(os.tmpdir(), `avyro-restore-${backupId}.tar.gz`);
    const { storage } = resolveBackupStorage();
    const body = await storage.getObject(record.storageKey);
    await writeFile(tmpPath, body);

    try {
      const result = await restoreBackupArchive({
        databaseUrl,
        archivePath: tmpPath,
      });
      await this.audit.write({
        organizationId,
        userId,
        action: 'RESTORE',
        entityType: 'BackupRecord',
        entityId: backupId,
        afterJson: { restoredSqlBytes: result.restoredSqlBytes },
      });
      return {
        restored: true,
        backupId,
        restoredSqlBytes: result.restoredSqlBytes,
      };
    } finally {
      await rm(tmpPath, { force: true });
    }
  }

  private async startBackup(organizationId: string, triggeredBy: string) {
    const filename = buildBackupFilename();
    const storageKey = buildBackupKey(organizationId, filename);
    const { kind } = resolveBackupStorage();

    return prisma.backupRecord.create({
      data: {
        organizationId,
        storage: kind,
        storageKey,
        filename,
        status: 'PENDING',
        triggeredBy,
      },
    });
  }

  private async executeBackup(recordId: string) {
    const record = await prisma.backupRecord.update({
      where: { id: recordId },
      data: { status: 'RUNNING' },
    });

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      await prisma.backupRecord.update({
        where: { id: recordId },
        data: {
          status: 'FAILED',
          errorMessage: 'DATABASE_URL is not configured.',
          completedAt: new Date(),
        },
      });
      return;
    }

    const tmpPath = path.join(os.tmpdir(), record.filename);

    try {
      await createBackupArchive({
        databaseUrl,
        organizationId: record.organizationId,
        outputPath: tmpPath,
      });

      const body = await readFile(tmpPath);
      const { storage } = resolveBackupStorage();
      await storage.putObject({
        key: record.storageKey,
        body,
        contentType: 'application/gzip',
      });

      await prisma.backupRecord.update({
        where: { id: recordId },
        data: {
          status: 'COMPLETED',
          sizeBytes: BigInt(body.length),
          completedAt: new Date(),
          errorMessage: null,
        },
      });

      await prisma.organization.update({
        where: { id: record.organizationId },
        data: { backupLastRunAt: new Date() },
      });
    } catch (err) {
      await prisma.backupRecord.update({
        where: { id: recordId },
        data: {
          status: 'FAILED',
          errorMessage: err instanceof Error ? err.message : String(err),
          completedAt: new Date(),
        },
      });
    } finally {
      await rm(tmpPath, { force: true });
    }
  }

  private async runDueScheduledBackups() {
    const orgs = await prisma.organization.findMany({
      where: { backupFrequency: { not: 'OFF' } },
      select: { id: true, backupFrequency: true, backupLastRunAt: true },
    });

    for (const org of orgs) {
      if (!isBackupDue(org.backupFrequency, org.backupLastRunAt)) continue;
      const running = await prisma.backupRecord.findFirst({
        where: {
          organizationId: org.id,
          status: { in: ['PENDING', 'RUNNING'] },
        },
      });
      if (running) continue;

      const record = await this.startBackup(org.id, 'scheduler');
      await this.executeBackup(record.id);
    }
  }
}
