import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { prisma } from '@avyro/database';
import type { BackupFrequency } from '@avyro/database';
import { AuditService } from '../audit/audit.service.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import {
  executeBackupRecord,
  restoreBackupRecord,
  runScheduledBackupScan,
} from './backup-executor.js';
import {
  buildBackupFilename,
  buildBackupKey,
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
      void runScheduledBackupScan().catch((err) => {
        console.error('[backups] scheduled scan failed', err);
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

    const inFlight = await prisma.backupRecord.count({
      where: {
        organizationId,
        status: { in: ['PENDING', 'RUNNING'] },
      },
    });
    if (inFlight > 0) {
      throw new BadRequestException({
        error: {
          code: 'BACKUP_IN_PROGRESS',
          message: 'A backup is already running for this organisation.',
        },
      });
    }

    const filename = buildBackupFilename();
    const storageKey = buildBackupKey(organizationId, filename);
    const { kind } = resolveBackupStorage();

    const record = await prisma.backupRecord.create({
      data: {
        organizationId,
        storage: kind,
        storageKey,
        filename,
        status: 'PENDING',
        triggeredBy: userId,
      },
    });

    void executeBackupRecord(record.id);
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

    const result = await restoreBackupRecord({ backupId, organizationId });
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
  }
}
