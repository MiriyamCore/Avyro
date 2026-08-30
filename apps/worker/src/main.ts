import 'dotenv/config';
import { Worker } from 'bullmq';
import nodemailer from 'nodemailer';
import { processSendEmailJob, type SendEmailJob } from './jobs/send-email.js';
import {
  processBackupJob,
  type BackupWorkerJob,
} from './jobs/run-backup.js';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

const smtpConfigured =
  Boolean(process.env.SMTP_HOST) &&
  Boolean(process.env.SMTP_FROM);

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    })
  : null;

const emailWorker = new Worker<SendEmailJob>(
  'email',
  async (job) => processSendEmailJob(job.data, transporter),
  { connection: { url: redisUrl } },
);

emailWorker.on('completed', (job) => {
  console.log(`[worker] email job ${job.id} completed`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`[worker] email job ${job?.id} failed`, err);
});

const backupWorker = new Worker<BackupWorkerJob>(
  'backup',
  async (job) => processBackupJob(job.data),
  { connection: { url: redisUrl } },
);

backupWorker.on('completed', (job) => {
  console.log(`[worker] backup job ${job.id} completed`);
});

backupWorker.on('failed', (job, err) => {
  console.error(`[worker] backup job ${job?.id} failed`, err);
});

console.log(
  `[worker] listening on email queue (SMTP ${smtpConfigured ? 'enabled' : 'log-only stub'})`,
);
console.log('[worker] listening on backup queue');
