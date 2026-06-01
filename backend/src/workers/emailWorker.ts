import { Worker } from 'bullmq';
import { redisConnection } from './redisClient';
import { Resend } from 'resend';
import prisma from '../utils/prisma';

const resend = new Resend(process.env.RESEND_API_KEY);

export const emailWorker = new Worker('emailQueue', async job => {
  const { to, subject, html, attachments, campaignId } = job.data;

  console.log(`[EmailWorker] Job ${job.id}: sending to ${to}`);

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || 'team@hogmarketing.com',
    to,
    subject,
    html,
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
