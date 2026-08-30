import { describe, expect, it } from 'vitest';
import {
  buildBackupFilename,
  buildBackupKey,
  isBackupDue,
  resolveBackupStorage,
} from './backup-storage.js';

describe('backup-storage', () => {
  it('builds org-scoped storage keys', () => {
    expect(buildBackupKey('org_1', 'test.tar.gz')).toBe('org_1/test.tar.gz');
  });

  it('builds timestamped filenames', () => {
    const name = buildBackupFilename(new Date('2026-08-30T12:00:00.000Z'));
    expect(name).toMatch(/^avyro-backup-2026-08-30T12-00-00-000Z\.tar\.gz$/);
  });

  it('detects due daily backups', () => {
    const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000);
    expect(isBackupDue('DAILY', yesterday)).toBe(true);
    expect(isBackupDue('OFF', yesterday)).toBe(false);
  });

  it('defaults to local storage when S3 is not configured', () => {
    const prev = {
      bucket: process.env.S3_BUCKET,
      key: process.env.AWS_ACCESS_KEY_ID,
      secret: process.env.AWS_SECRET_ACCESS_KEY,
    };
    delete process.env.S3_BUCKET;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;

    expect(resolveBackupStorage().kind).toBe('LOCAL');

    process.env.S3_BUCKET = prev.bucket;
    process.env.AWS_ACCESS_KEY_ID = prev.key;
    process.env.AWS_SECRET_ACCESS_KEY = prev.secret;
  });
});
