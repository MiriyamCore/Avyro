import path from 'node:path';
import {
  LocalObjectStorage,
  type ObjectStorage,
  storageRoot,
} from '../storage/object-storage.js';
import { isS3Configured, S3ObjectStorage } from '../storage/s3-storage.js';

export type BackupStorageKind = 'LOCAL' | 'S3';

export function backupRoot(): string {
  return (
    process.env.BACKUP_ROOT ??
    path.resolve(process.cwd(), 'data/backups')
  );
}

export function resolveBackupStorage(): {
  kind: BackupStorageKind;
  storage: ObjectStorage;
} {
  if (isS3Configured()) {
    return { kind: 'S3', storage: new S3ObjectStorage() };
  }
  return { kind: 'LOCAL', storage: new LocalObjectStorage(backupRoot()) };
}

export function buildBackupKey(organizationId: string, filename: string) {
  return `${organizationId}/${filename}`;
}

export function buildBackupFilename(now = new Date()) {
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  return `avyro-backup-${stamp}.tar.gz`;
}

export function isBackupDue(
  frequency: 'OFF' | 'DAILY' | 'WEEKLY' | 'MONTHLY',
  lastRunAt: Date | null | undefined,
  now = new Date(),
): boolean {
  if (frequency === 'OFF') return false;
  if (!lastRunAt) return true;

  const elapsedMs = now.getTime() - lastRunAt.getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  switch (frequency) {
    case 'DAILY':
      return elapsedMs >= dayMs;
    case 'WEEKLY':
      return elapsedMs >= 7 * dayMs;
    case 'MONTHLY':
      return elapsedMs >= 30 * dayMs;
    default:
      return false;
  }
}

/** Exposed for tests — where uploaded files live alongside DB dump. */
export function filesBackupSourceRoot() {
  return storageRoot();
}
