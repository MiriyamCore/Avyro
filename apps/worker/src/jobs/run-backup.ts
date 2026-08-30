export type BackupWorkerJob =
  | { backupId: string }
  | { kind: 'scan' };

async function loadExecutor() {
  return (
    // @ts-expect-error compiled API module has no worker-local types
    import('../../../api/dist/backups/backup-executor.js') as Promise<{
      executeBackupRecord: (id: string) => Promise<void>;
      runScheduledBackupScan: () => Promise<{ started: number }>;
    }>
  );
}

export async function processBackupJob(data: BackupWorkerJob) {
  const executor = await loadExecutor();

  if ('kind' in data && data.kind === 'scan') {
    const result = await executor.runScheduledBackupScan();
    console.log(`[worker] scheduled backup scan started ${result.started} job(s)`);
    return result;
  }

  if ('backupId' in data) {
    await executor.executeBackupRecord(data.backupId);
  }
}

const scanIntervalMs = 15 * 60 * 1000;

setInterval(() => {
  void processBackupJob({ kind: 'scan' }).catch((err) => {
    console.error('[worker] scheduled backup scan failed', err);
  });
}, scanIntervalMs);

console.log('[worker] scheduled backup scan every 15 minutes');
