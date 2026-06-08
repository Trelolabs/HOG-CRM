import { CampaignType } from '@prisma/client';
import prisma from '../utils/prisma';
import { EmailProvider, SmsProvider } from './providers/types';
import { SendGridProvider } from './providers/sendgridProvider';
import { TwilioProvider } from './providers/twilioProvider';

type ProviderMode = 'mock' | 'live';

const providerMode = (process.env.CAMPAIGN_PROVIDER_MODE || 'mock').toLowerCase() as ProviderMode;

const getMissingEnvVarsForLiveMode = () => {
    const required = ['RESEND_API_KEY', 'EMAIL_FROM'];
    return required.filter((key) => !process.env[key]);
};

const createProviders = (): { emailProvider: EmailProvider; smsProvider: SmsProvider } => {
    if (providerMode === 'mock') {
        return {
            emailProvider: {
                sendEmail: async () => ({ providerMessageId: `mock-email-${Date.now()}` })
            },
            smsProvider: {
                sendSms: async () => ({ providerMessageId: `mock-sms-${Date.now()}` })
            }
        };
    }

    const missingVars = getMissingEnvVarsForLiveMode();
    if (missingVars.length > 0) {
        throw new Error(`Live provider mode is missing environment variables: ${missingVars.join(', ')}`);
    }

    return {
        emailProvider: {
            sendEmail: async () => ({ providerMessageId: `resend-${Date.now()}` })
        },
        smsProvider: null
    };


};

type CampaignSendResult = {
    status: 'SENT' | 'FAILED' | 'SCHEDULED';
    attemptedRecipients: number;
    sentRecipients: number;
    providerMessageId: string | null;
    failureReason: string | null;
};

import { emailQueue, smsQueue } from '../queues';

const sendEmailCampaign = async (segmentId: string, subject: string, content: string, campaignId: string): Promise<CampaignSendResult> => {
    const recipients = await prisma.lead.findMany({
        where: { 
            segmentId, 
            email: { not: '' } 
        },
        select: { 
            id: true,
            fullName: true,
            email: true,
            whatsapp: true,
            businessName: true
        }
    });

    if (recipients.length === 0) {
        return {
            status: 'FAILED',
            attemptedRecipients: 0,
            sentRecipients: 0,
            providerMessageId: null,
            failureReason: 'No email recipients available in selected segment'
        };
    }

    // Add jobs to queue
    const jobs = recipients.map(recipient => ({
        name: 'sendEmail',
        data: {
            to: String(recipient.email),
            subject,
            html: content,
            recipient,
            campaignId
        }
    }));
    
    await emailQueue.addBulk(jobs);

    return {
        status: 'SCHEDULED',
        attemptedRecipients: recipients.length,
        sentRecipients: 0,
        providerMessageId: null,
        failureReason: null
    };
};

const sendSmsCampaign = async (segmentId: string, content: string, campaignId: string): Promise<CampaignSendResult> => {
    const recipients = await prisma.lead.findMany({
        where: {
            segmentId,
            whatsapp: { not: '' }
        },
        select: {
            id: true,
            fullName: true,
            email: true,
            whatsapp: true,
            businessName: true
        }
    });

    const validRecipients = recipients.filter(r => r.whatsapp && r.whatsapp.trim() !== '');

    if (validRecipients.length === 0) {
        return {
            status: 'FAILED',
            attemptedRecipients: 0,
            sentRecipients: 0,
            providerMessageId: null,
            failureReason: 'No SMS recipients available in selected segment'
        };
    }

    // Add jobs to queue
    const jobs = validRecipients.map(recipient => ({
        name: 'sendSms',
        data: {
            to: String(recipient.whatsapp),
            body: content,
            recipient,
            campaignId
        }
    }));

    await smsQueue.addBulk(jobs);

    return {
        status: 'SCHEDULED',
        attemptedRecipients: validRecipients.length,
        sentRecipients: 0,
        providerMessageId: null,
        failureReason: null
    };
};

export const sendCampaignWithProvider = async (campaignId: string) => {
    const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        include: { segment: true }
    });

    if (!campaign) {
        const notFoundError = new Error('Campaign not found');
        (notFoundError as Error & { code?: string }).code = 'P2025';
        throw notFoundError;
    }
    
    if (campaign.status === 'SENT' || campaign.status === 'SCHEDULED') {
        return {
            mode: providerMode,
            campaign
        };
    }

    const result =
        campaign.type === CampaignType.EMAIL
            ? await sendEmailCampaign(campaign.segmentId, campaign.subject || campaign.name, campaign.content, campaign.id)
            : await sendSmsCampaign(campaign.segmentId, campaign.content, campaign.id);

    const updatedCampaign = await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
            status: result.status,
            sentAt: result.status === 'SENT' ? new Date() : null,
            attemptedRecipients: result.attemptedRecipients,
            sentRecipients: result.sentRecipients,
            providerMessageId: result.providerMessageId,
            failureReason: result.failureReason
        },
        include: { segment: true }
    });

    return {
        mode: providerMode,
        campaign: updatedCampaign
    };
};

export const validateCampaignProviderConfig = () => {
    if (providerMode !== 'live') return;
    const missingVars = getMissingEnvVarsForLiveMode();
    if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables for live campaign delivery: ${missingVars.join(', ')}`);
    }
};
