import { readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { prisma } from '@avyro/database';
import {
  createBackupArchive,
  isLegacySqlBackup,
  restoreBackupArchive,
} from './backup-db.js';
import { restoreLegacySqlBackup } from './backup-legacy.js';
import {
  buildBackupFilename,
  buildBackupKey,
  isBackupDue,
  resolveBackupStorage,
} from './backup-storage.js';
import { enqueueBackup } from '../queue/backup.queue.js';

function logBackupError(label: string, err: unknown) {
  console.error(`[backups] ${label}`, err);
}

/** Run in the API by default; set BACKUP_USE_QUEUE=true when the worker app is running. */
export function dispatchBackup(recordId: string) {
  if (process.env.BACKUP_USE_QUEUE === 'true') {
    void enqueueBackup({ backupId: recordId }).catch(() => {
      void executeBackupRecord(recordId).catch((err) => {
        logBackupError('inline backup failed after queue error', err);
      });
    });
    return;
  }

  void executeBackupRecord(recordId).catch((err) => {
    logBackupError('inline backup failed', err);
  });
}

/** Pick up backups stuck in the queue when no worker is consuming jobs. */
export async function reconcileStaleBackups(maxAgeMs = 60_000) {
  const cutoff = new Date(Date.now() - maxAgeMs);
  const stale = await prisma.backupRecord.findMany({
    where: {
      status: 'PENDING',
      createdAt: { lt: cutoff },
    },
    select: { id: true },
  });

  for (const record of stale) {
    dispatchBackup(record.id);
  }

  return stale.length;
}

export async function executeBackupRecord(recordId: string) {
  const record = await prisma.backupRecord.update({
    where: { id: recordId },
    data: { status: 'RUNNING', errorMessage: null },
  });

  const tmpPath = path.join(os.tmpdir(), record.filename);

  try {
    await createBackupArchive({
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

export async function runScheduledBackupScan() {
  const orgs = await prisma.organization.findMany({
    where: { backupFrequency: { not: 'OFF' }, status: 'ACTIVE' },
    select: { id: true, backupFrequency: true, backupLastRunAt: true },
  });

  let started = 0;
  for (const org of orgs) {
    if (!isBackupDue(org.backupFrequency, org.backupLastRunAt)) continue;

    const running = await prisma.backupRecord.findFirst({
      where: {
        organizationId: org.id,
        status: { in: ['PENDING', 'RUNNING'] },
      },
    });
    if (running) continue;

    const filename = buildBackupFilename();
    const storageKey = buildBackupKey(org.id, filename);
    const { kind } = resolveBackupStorage();

    const record = await prisma.backupRecord.create({
      data: {
        organizationId: org.id,
        storage: kind,
        storageKey,
        filename,
        status: 'PENDING',
        triggeredBy: 'scheduler',
      },
    });

    void dispatchBackup(record.id);
    started += 1;
  }

  return { started };
}

export async function restoreBackupFile(options: {
  organizationId: string;
  archivePath: string;
}) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured.');
  }

  const legacy = await isLegacySqlBackup(options.archivePath);
  if (legacy) {
    return await restoreLegacySqlBackup({
      databaseUrl,
      archivePath: options.archivePath,
      organizationId: options.organizationId,
    });
  }
  return await restoreBackupArchive({
    archivePath: options.archivePath,
    organizationId: options.organizationId,
  });
}

export async function restoreBackupRecord(options: {
  backupId: string;
  organizationId: string;
}) {
  const record = await prisma.backupRecord.findFirst({
    where: {
      id: options.backupId,
      organizationId: options.organizationId,
      status: 'COMPLETED',
    },
  });
  if (!record) {
    throw new Error('Backup not found or not completed.');
  }

  const tmpPath = path.join(os.tmpdir(), `avyro-restore-${options.backupId}.tar.gz`);
  const { storage } = resolveBackupStorage();
  const body = await storage.getObject(record.storageKey);
  await writeFile(tmpPath, body);

  try {
    return await restoreBackupFile({
      archivePath: tmpPath,
      organizationId: options.organizationId,
    });
  } finally {
    await rm(tmpPath, { force: true });
  }
}
