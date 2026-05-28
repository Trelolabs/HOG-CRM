import { CampaignType } from '@prisma/client';
import prisma from '../utils/prisma';
import { SendGridProvider } from './providers/sendgridProvider';
const providerMode = (process.env.CAMPAIGN_PROVIDER_MODE || 'mock').toLowerCase();
const getMissingEnvVarsForLiveMode = () => {
    const required = ['SENDGRID_API_KEY', 'SENDGRID_FROM_EMAIL']; //Let's add 't'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER' later
    return required.filter((key) => !process.env[key]);
};
const createProviders = () => {
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
        emailProvider: new SendGridProvider(String(process.env.SENDGRID_API_KEY), String(process.env.SENDGRID_FROM_EMAIL)),
        smsProvider: null
        // smsProvider: new TwilioProvider(
        //     String(process.env.TWILIO_ACCOUNT_SID),
        //     String(process.env.TWILIO_AUTH_TOKEN),
        //     String(process.env.TWILIO_PHONE_NUMBER)
        // )
    };
};
const sendEmailCampaign = async (segmentId, subject, content, emailProvider) => {
    const recipients = await prisma.lead.findMany({
        where: { segmentId, email: {
                not: ''
            } },
        select: { email: true }
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
    const settled = await Promise.allSettled(recipients.map((recipient) => emailProvider.sendEmail({
        to: String(recipient.email),
        subject,
        html: content
    })));
    const successResults = settled.filter((entry) => entry.status === 'fulfilled');
    const failedResults = settled.filter((entry) => entry.status === 'rejected');
    return {
        status: successResults.length > 0 ? 'SENT' : 'FAILED',
        attemptedRecipients: recipients.length,
        sentRecipients: successResults.length,
        providerMessageId: successResults[0]?.value.providerMessageId || null,
        failureReason: failedResults.length ? `${failedResults.length} email sends failed` : null
    };
};
const sendSmsCampaign = async (segmentId, content, smsProvider) => {
    const recipients = await prisma.lead.findMany({
        where: { segmentId, whatsapp: { not: null } },
        select: { whatsapp: true }
    });
    if (recipients.length === 0) {
        return {
            status: 'FAILED',
            attemptedRecipients: 0,
            sentRecipients: 0,
            providerMessageId: null,
            failureReason: 'No SMS recipients available in selected segment'
        };
    }
    const settled = await Promise.allSettled(recipients.map((recipient) => smsProvider.sendSms({
        to: String(recipient.whatsapp),
        body: content
    })));
    const successResults = settled.filter((entry) => entry.status === 'fulfilled');
    const failedResults = settled.filter((entry) => entry.status === 'rejected');
    return {
        status: successResults.length > 0 ? 'SENT' : 'FAILED',
        attemptedRecipients: recipients.length,
        sentRecipients: successResults.length,
        providerMessageId: successResults[0]?.value.providerMessageId || null,
        failureReason: failedResults.length ? `${failedResults.length} SMS sends failed` : null
    };
};
export const sendCampaignWithProvider = async (campaignId) => {
    const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        include: { segment: true }
    });
    if (!campaign) {
        const notFoundError = new Error('Campaign not found');
        notFoundError.code = 'P2025';
        throw notFoundError;
    }
    if (campaign.status === 'SENT') {
        return {
            mode: providerMode,
            campaign
        };
    }
    const { emailProvider } = createProviders();
    const result = campaign.type === CampaignType.EMAIL
        ? await sendEmailCampaign(campaign.segmentId, campaign.subject || campaign.name, campaign.content, emailProvider) : null;
    // : await sendSmsCampaign(campaign.segmentId, campaign.content, smsProvider);
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
    if (providerMode !== 'live')
        return;
    const missingVars = getMissingEnvVarsForLiveMode();
    if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables for live campaign delivery: ${missingVars.join(', ')}`);
    }
};
