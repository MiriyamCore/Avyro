import { readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { prisma } from '@avyro/database';
import { createBackupArchive, restoreBackupArchive } from './backup-db.js';
import {
  buildBackupFilename,
  buildBackupKey,
  isBackupDue,
  resolveBackupStorage,
} from './backup-storage.js';

export async function executeBackupRecord(recordId: string) {
  const record = await prisma.backupRecord.update({
    where: { id: recordId },
    data: { status: 'RUNNING', errorMessage: null },
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

    void executeBackupRecord(record.id);
    started += 1;
  }

  return { started };
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

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured.');
  }

  const tmpPath = path.join(os.tmpdir(), `avyro-restore-${options.backupId}.tar.gz`);
  const { storage } = resolveBackupStorage();
  const body = await storage.getObject(record.storageKey);
  await writeFile(tmpPath, body);

  try {
    return await restoreBackupArchive({
      databaseUrl,
      archivePath: tmpPath,
      organizationId: options.organizationId,
    });
  } finally {
    await rm(tmpPath, { force: true });
  }
}
