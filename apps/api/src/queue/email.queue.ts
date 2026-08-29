import { Queue } from 'bullmq';

export type SendEmailJob = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachment?: {
    filename: string;
    contentBase64: string;
    contentType?: string;
  };
};

let emailQueue: Queue<SendEmailJob> | null = null;

export function getEmailQueue() {
  if (!emailQueue) {
    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
    emailQueue = new Queue<SendEmailJob>('email', {
      connection: { url: redisUrl },
    });
  }
  return emailQueue;
}

export async function enqueueEmail(job: SendEmailJob) {
  const queue = getEmailQueue();
  return queue.add('send', job, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  });
}
