import { Queue } from 'bullmq';

export type RunBackupJob = {
  backupId: string;
};

export type ScheduledBackupScanJob = {
  kind: 'scan';
};

export type BackupJob = RunBackupJob | ScheduledBackupScanJob;

let backupQueue: Queue<BackupJob> | null = null;

export function getBackupQueue() {
  if (!backupQueue) {
    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
    backupQueue = new Queue<BackupJob>('backup', {
      connection: { url: redisUrl },
    });
  }
  return backupQueue;
}

export async function enqueueBackup(job: RunBackupJob) {
  const queue = getBackupQueue();
  return queue.add('run', job, {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 50,
    removeOnFail: 25,
  });
}
