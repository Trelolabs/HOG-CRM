import { Worker } from 'bullmq';
import { redisConnection } from './redisClient';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const emailWorker = new Worker('emailQueue', async job => {
  const { to, subject, html, attachments } = job.data;
  
  try {
    const data = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'team@hogmarketing.com',
      to,
      subject,
      html,
      attachments
    });
    
    return data;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}, { connection: redisConnection as any });

emailWorker.on('completed', job => {
  console.log(`${job.id} has completed!`);
});

emailWorker.on('failed', (job, err) => {
  console.log(`${job?.id} has failed with ${err.message}`);
});
