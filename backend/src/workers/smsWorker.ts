import { Worker } from 'bullmq';
import { redisConnection } from './redisClient';
import prisma from '../utils/prisma';
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
const authToken = process.env.TWILIO_AUTH_TOKEN || '';
const fromNumber = process.env.TWILIO_SENDER_NUMBER || '';

// Lazy initialization of Twilio client to avoid errors if credentials aren't loaded yet
let client: twilio.Twilio | null = null;
const getTwilioClient = () => {
  if (!client && accountSid && authToken) {
    client = twilio(accountSid, authToken);
  }
  return client;
};

function normalizePhoneNumber(phone: string): string {
  const cleaned = phone.replace(/[\s\-().]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('00')) return '+' + cleaned.slice(2);
  if (/^\d{10}$/.test(cleaned)) return '+91' + cleaned;
  if (/^91\d{10}$/.test(cleaned)) return '+' + cleaned;
  if (/^1\d{10}$/.test(cleaned)) return '+' + cleaned;
  return '+' + cleaned;
}

export const smsWorker = new Worker('smsQueue', async job => {
  const { to, body, recipient, campaignId } = job.data;

  if (!to || to.trim() === '' || to === 'null') {
    console.warn(`[SMSWorker] Job ${job.id}: skipping — no valid phone number`);
    return { skipped: true };
  }

  // Replace template placeholders if recipient details are provided
  let messageBody = body;
  if (recipient) {
    messageBody = body
      .replace(/{{name}}/g, recipient.fullName || '')
      .replace(/{{fullName}}/g, recipient.fullName || '')
      .replace(/{{email}}/g, recipient.email || '')
      .replace(/{{whatsapp}}/g, recipient.whatsapp || '')
      .replace(/{{phone}}/g, recipient.whatsapp || '')
      .replace(/{{business}}/g, recipient.businessName || '');
  }

  console.log(`[SMSWorker] Job ${job.id}: sending to ${to}`);

  // In live mode, send via Twilio
  if (process.env.CAMPAIGN_PROVIDER_MODE === 'live') {
    if (!accountSid || !authToken || !fromNumber) {
      throw new Error('Twilio credentials not configured');
    }
    const twilioClient = getTwilioClient();
    if (!twilioClient) {
      throw new Error('Failed to initialize Twilio client');
    }
    const normalizedTo = normalizePhoneNumber(to);
    const response = await twilioClient.messages.create({
      from: fromNumber,
      to: normalizedTo,
      body: messageBody,
    });
    console.log(`[SMSWorker] Sent to ${normalizedTo} (original: ${to}), sid: ${response.sid}`);
  } else {
    console.log(`[SMSWorker] Mock send to ${to}: ${messageBody}`);
  }

  // Increment campaign sentRecipients and check if all jobs are done
  if (campaignId) {
    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: { sentRecipients: { increment: 1 } }
    });

    // Mark campaign as SENT if all recipients have been processed
    if (updatedCampaign.sentRecipients >= updatedCampaign.attemptedRecipients && updatedCampaign.status !== 'SENT') {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'SENT', sentAt: new Date() }
      });
    }
  }

  return { to };
}, {
  connection: redisConnection as any,
});

smsWorker.on('completed', job => {
  console.log(`[SMSWorker] Job ${job.id} completed`);
});

smsWorker.on('failed', (job, err) => {
  console.error(`[SMSWorker] Job ${job?.id} failed: ${err.message}`);
});
