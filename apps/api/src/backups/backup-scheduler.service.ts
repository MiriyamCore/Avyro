import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  executeBackupRecord,
  reconcileStaleBackups,
  runScheduledBackupScan,
} from './backup-executor.js';

@Injectable()
export class BackupSchedulerService implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | null = null;

  onModuleInit() {
    const intervalMs = Number(process.env.BACKUP_SCHEDULER_INTERVAL_MS ?? 900_000);
    void reconcileStaleBackups().catch((err) => {
      console.error('[backups] stale backup reconcile failed', err);
    });
    void runScheduledBackupScan().catch((err) => {
      console.error('[backups] initial scheduled scan failed', err);
    });
    this.timer = setInterval(() => {
      void reconcileStaleBackups().catch((err) => {
        console.error('[backups] stale backup reconcile failed', err);
      });
      void runScheduledBackupScan().catch((err) => {
        console.error('[backups] scheduled scan failed', err);
      });
    }, intervalMs);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}

/** @deprecated Use dispatchBackup from backup-executor. */
export async function runBackupInline(recordId: string) {
  await executeBackupRecord(recordId);
}
