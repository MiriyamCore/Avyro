import 'dotenv/config';
import { Worker } from 'bullmq';
import nodemailer from 'nodemailer';
import { processSendEmailJob, type SendEmailJob } from './jobs/send-email.js';

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

const worker = new Worker<SendEmailJob>(
  'email',
  async (job) => processSendEmailJob(job.data, transporter),
  { connection: { url: redisUrl } },
);

worker.on('completed', (job) => {
  console.log(`[worker] email job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[worker] email job ${job?.id} failed`, err);
});

console.log(
  `[worker] listening on email queue (SMTP ${smtpConfigured ? 'enabled' : 'log-only stub'})`,
);
