import { Worker } from 'bullmq';
import { redisConnection } from './redisClient';
import { Resend } from 'resend';
import prisma from '../utils/prisma';

const resend = new Resend(process.env.RESEND_API_KEY);

export const emailWorker = new Worker('emailQueue', async job => {
  const { to, subject, html, attachments, recipient, campaignId } = job.data;

  // Render template placeholders if recipient details are provided
  let emailHtml = html;
  let emailSubject = subject;
  if (recipient) {
    const replaceVars = (text: string) => {
      if (!text) return text;
      return text
        .replace(/{{name}}/g, recipient.fullName || '')
        .replace(/{{fullName}}/g, recipient.fullName || '')
        .replace(/{{email}}/g, recipient.email || '')
        .replace(/{{whatsapp}}/g, recipient.whatsapp || '')
        .replace(/{{phone}}/g, recipient.whatsapp || '')
        .replace(/{{business}}/g, recipient.businessName || '');
    };
    emailHtml = replaceVars(html);
    emailSubject = replaceVars(subject);
  }

  console.log(`[EmailWorker] Job ${job.id}: sending to ${to}`);

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || 'team@hogmarketing.com',
    to,
    subject: emailSubject,
    html: emailHtml,
    attachments
  });

  if (error) {
    console.error(`[EmailWorker] Resend error for ${to}:`, JSON.stringify(error));
    throw new Error(`Resend: ${error.name} — ${error.message}`);
  }

  console.log(`[EmailWorker] Sent to ${to}, id: ${data?.id}`);

  // Increment campaign sentRecipients
  if (campaignId) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { sentRecipients: { increment: 1 } }
    });
  }

  return { id: data?.id };
}, {
  connection: redisConnection as any,
});

emailWorker.on('completed', job => {
  console.log(`[EmailWorker] Job ${job.id} completed`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`[EmailWorker] Job ${job?.id} failed: ${err.message}`);
});
