"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCampaignProviderConfig = exports.sendCampaignWithProvider = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../utils/prisma"));
const providerMode = (process.env.CAMPAIGN_PROVIDER_MODE || 'mock').toLowerCase();
const getMissingEnvVarsForLiveMode = () => {
    const required = ['RESEND_API_KEY', 'EMAIL_FROM'];
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
        emailProvider: {
            sendEmail: async () => ({ providerMessageId: `resend-${Date.now()}` })
        },
        smsProvider: null
    };
};
const queues_1 = require("../queues");
const sendEmailCampaign = async (segmentId, subject, content, campaignId) => {
    const recipients = await prisma_1.default.lead.findMany({
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
    await queues_1.emailQueue.addBulk(jobs);
    return {
        status: 'SCHEDULED',
        attemptedRecipients: recipients.length,
        sentRecipients: 0,
        providerMessageId: null,
        failureReason: null
    };
};
const sendSmsCampaign = async (segmentId, content, campaignId) => {
    const recipients = await prisma_1.default.lead.findMany({
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
    await queues_1.smsQueue.addBulk(jobs);
    return {
        status: 'SCHEDULED',
        attemptedRecipients: validRecipients.length,
        sentRecipients: 0,
        providerMessageId: null,
        failureReason: null
    };
};
const sendCampaignWithProvider = async (campaignId) => {
    const campaign = await prisma_1.default.campaign.findUnique({
        where: { id: campaignId },
        include: { segment: true }
    });
    if (!campaign) {
        const notFoundError = new Error('Campaign not found');
        notFoundError.code = 'P2025';
        throw notFoundError;
    }
    if (campaign.status === 'SENT' || campaign.status === 'SCHEDULED') {
        return {
            mode: providerMode,
            campaign
        };
    }
    const result = campaign.type === client_1.CampaignType.EMAIL
        ? await sendEmailCampaign(campaign.segmentId, campaign.subject || campaign.name, campaign.content, campaign.id)
        : await sendSmsCampaign(campaign.segmentId, campaign.content, campaign.id);
    const updatedCampaign = await prisma_1.default.campaign.update({
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
exports.sendCampaignWithProvider = sendCampaignWithProvider;
const validateCampaignProviderConfig = () => {
    if (providerMode !== 'live')
        return;
    const missingVars = getMissingEnvVarsForLiveMode();
    if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables for live campaign delivery: ${missingVars.join(', ')}`);
    }
};
exports.validateCampaignProviderConfig = validateCampaignProviderConfig;
