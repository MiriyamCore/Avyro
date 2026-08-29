import type nodemailer from 'nodemailer';

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

export async function processSendEmailJob(
  data: SendEmailJob,
  transporter: nodemailer.Transporter | null,
) {
  if (!transporter) {
    console.log('[worker] SMTP not configured — email stub:', {
      to: data.to,
      subject: data.subject,
      hasAttachment: Boolean(data.attachment),
    });
    return { stub: true };
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: data.to,
    subject: data.subject,
    text: data.text,
    html: data.html,
    attachments: data.attachment
      ? [
          {
            filename: data.attachment.filename,
            content: Buffer.from(data.attachment.contentBase64, 'base64'),
            contentType: data.attachment.contentType ?? 'application/pdf',
          },
        ]
      : undefined,
  });

  return { sent: true };
}
