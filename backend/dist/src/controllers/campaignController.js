"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importContacts = exports.getUploadStatus = exports.uploadFile = exports.sendToLeads = exports.sendCampaign = exports.updateCampaign = exports.getCampaigns = exports.createCampaign = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const campaignService_1 = require("../services/campaignService");
const CAMPAIGN_TYPES = ['EMAIL', 'SMS'];
const CAMPAIGN_STATUSES = ['DRAFT', 'SCHEDULED', 'SENT', 'FAILED'];
const createCampaign = async (req, res) => {
    const { type, name, segmentId, content, subject } = req.body;
    if (!type || !name || !segmentId || !content) {
        return res.status(400).json({ error: 'type, name, segmentId and content are required' });
    }
    const normalizedType = String(type).toUpperCase();
    if (!CAMPAIGN_TYPES.includes(normalizedType)) {
        return res.status(400).json({ error: `Invalid campaign type. Allowed: ${CAMPAIGN_TYPES.join(', ')}` });
    }
    try {
        const segment = await prisma_1.default.segment.findUnique({ where: { id: String(segmentId) } });
        if (!segment) {
            return res.status(404).json({ error: 'Segment not found' });
        }
        const campaign = await prisma_1.default.campaign.create({
            data: {
                type: normalizedType,
                name: String(name).trim(),
                segmentId: String(segmentId),
                content: String(content),
                subject: subject?.trim() || null,
                status: 'DRAFT'
            },
            include: { segment: true }
        });
        res.status(201).json(campaign);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create campaign', details: error.message });
    }
};
exports.createCampaign = createCampaign;
const getCampaigns = async (req, res) => {
    try {
        const status = String(req.query.status || '').trim().toUpperCase();
        const segmentId = String(req.query.segmentId || '').trim();
        if (status && !CAMPAIGN_STATUSES.includes(status)) {
            return res.status(400).json({ error: `Invalid status. Allowed: ${CAMPAIGN_STATUSES.join(', ')}` });
        }
        const campaigns = await prisma_1.default.campaign.findMany({
            where: {
                ...(status ? { status } : {}),
                ...(segmentId ? { segmentId } : {})
            },
            include: { segment: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(campaigns);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch campaigns', details: error.message });
    }
};
exports.getCampaigns = getCampaigns;
const updateCampaign = async (req, res) => {
    const { id } = req.params;
    const { type, name, segmentId, content, subject, status } = req.body;
    if (typeof type === 'undefined' &&
        typeof name === 'undefined' &&
        typeof segmentId === 'undefined' &&
        typeof content === 'undefined' &&
        typeof subject === 'undefined' &&
        typeof status === 'undefined') {
        return res.status(400).json({ error: 'No fields provided for update' });
    }
    const normalizedType = type ? String(type).toUpperCase() : undefined;
    const normalizedStatus = status ? String(status).toUpperCase() : undefined;
    if (normalizedType && !CAMPAIGN_TYPES.includes(normalizedType)) {
        return res.status(400).json({ error: `Invalid campaign type. Allowed: ${CAMPAIGN_TYPES.join(', ')}` });
    }
    if (normalizedStatus && !CAMPAIGN_STATUSES.includes(normalizedStatus)) {
        return res.status(400).json({ error: `Invalid status. Allowed: ${CAMPAIGN_STATUSES.join(', ')}` });
    }
    try {
        if (segmentId) {
            const segment = await prisma_1.default.segment.findUnique({ where: { id: String(segmentId) } });
            if (!segment) {
                return res.status(404).json({ error: 'Segment not found' });
            }
        }
        const campaign = await prisma_1.default.campaign.update({
            where: { id: String(id) },
            data: {
                ...(normalizedType ? { type: normalizedType } : {}),
                ...(name ? { name: String(name).trim() } : {}),
                ...(typeof segmentId !== 'undefined' ? { segmentId: String(segmentId) } : {}),
                ...(content ? { content: String(content) } : {}),
                ...(typeof subject !== 'undefined' ? { subject: subject ? String(subject).trim() : null } : {}),
                ...(normalizedStatus ? { status: normalizedStatus } : {})
            },
            include: { segment: true }
        });
        res.json(campaign);
    }
    catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        res.status(500).json({ error: 'Failed to update campaign', details: error.message });
    }
};
exports.updateCampaign = updateCampaign;
const sendCampaign = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await (0, campaignService_1.sendCampaignWithProvider)(String(id));
        res.json({
            message: `Campaign processed with ${result.mode} provider mode`,
            campaign: result.campaign
        });
    }
    catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        res.status(500).json({ error: 'Failed to send campaign', details: error.message });
    }
};
exports.sendCampaign = sendCampaign;
const sendToLeads = async (req, res) => {
    try {
        const { subject, content, leadIds, attachments } = req.body;
        if (!subject || !content) {
            return res.status(400).json({ error: 'Subject and content are required' });
        }
        if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
            return res.status(400).json({ error: 'At least one lead ID is required' });
        }
        // Create campaign
        const campaign = await prisma_1.default.campaign.create({
            data: {
                type: 'EMAIL',
                name: `Campaign - ${new Date().toLocaleString()}`,
                subject,
                content,
                attachments: attachments || null,
                segmentId: 'direct-send',
                status: 'SCHEDULED'
            }
        });
        // Get lead emails
        const leads = await prisma_1.default.lead.findMany({
            where: { id: { in: leadIds } },
            select: { email: true }
        });
        if (leads.length === 0) {
            return res.status(404).json({ error: 'No leads found with provided IDs' });
        }
        // Add email jobs to queue
        const { emailQueue } = await Promise.resolve().then(() => __importStar(require('../queues')));
        const jobs = leads.map(lead => ({
            name: 'sendEmail',
            data: {
                to: lead.email,
                subject,
                html: content,
                attachments: attachments || undefined
            }
        }));
        await emailQueue.addBulk(jobs);
        // Update campaign
        await prisma_1.default.campaign.update({
            where: { id: campaign.id },
            data: {
                status: 'SCHEDULED',
                attemptedRecipients: leads.length
            }
        });
        res.status(201).json({
            message: `Sending emails to ${leads.length} contacts`,
            campaignId: campaign.id,
            count: leads.length
        });
    }
    catch (error) {
        console.error('Send to leads error:', error);
        res.status(500).json({ error: 'Failed to send emails', details: error.message });
    }
};
exports.sendToLeads = sendToLeads;
const queues_1 = require("../queues");
const uploadFile = async (req, res) => {
    console.log(`[API] Received upload request for file...`);
    try {
        if (!req.file) {
            console.warn(`[API] Upload request failed: No file uploaded`);
            return res.status(400).json({ error: 'No file uploaded' });
        }
        console.log(`[API] File uploaded successfully to temp storage: ${req.file.path} (${req.file.mimetype})`);
        const job = await queues_1.uploadQueue.add('processFile', {
            filePath: req.file.path,
            originalname: req.file.originalname,
            mimetype: req.file.mimetype
        });
        console.log(`[API] Added processing job ${job.id} to uploadQueue for file ${req.file.originalname}`);
        res.json({ jobId: job.id, message: 'File uploaded and processing started' });
    }
    catch (error) {
        console.error(`[API] Error during upload processing:`, error);
        res.status(500).json({ error: 'Failed to process upload', details: error.message });
    }
};
exports.uploadFile = uploadFile;
const getUploadStatus = async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await queues_1.uploadQueue.getJob(jobId);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        const state = await job.getState();
        const progress = job.progress;
        const result = job.returnvalue;
        const failedReason = job.failedReason;
        res.json({
            id: job.id,
            state,
            progress,
            result,
            failedReason
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get job status', details: error.message });
    }
};
exports.getUploadStatus = getUploadStatus;
const importContacts = async (req, res) => {
    try {
        const { contacts, segmentName } = req.body;
        if (!Array.isArray(contacts)) {
            return res.status(400).json({ error: 'Contacts must be an array' });
        }
        // Create or find segment
        let segmentId = req.body.segmentId;
        if (!segmentId && segmentName) {
            const segment = await prisma_1.default.segment.create({
                data: { name: segmentName }
            });
            segmentId = segment.id;
        }
        const inserted = [];
        const duplicates = [];
        // Filter out contacts with no email
        const validContacts = contacts.filter(c => {
            const email = c.email || c.Email || c['E-mail'] || '';
            return email && email.toString().toLowerCase().includes('@');
        });
        // If no valid contacts, just create segment and return success
        if (validContacts.length === 0) {
            return res.status(201).json({
                message: `Segment created: ${segmentName}. No contacts to import.`,
                segmentId,
                imported: 0,
                duplicates: 0,
            });
        }
        // Check for duplicates
        const emailsToImport = validContacts.map(c => {
            const email = c.email || c.Email || c['E-mail'] || '';
            return email.toString().toLowerCase().trim();
        });
        const existingEmails = await prisma_1.default.lead.findMany({
            where: { email: { in: emailsToImport } },
            select: { email: true, id: true }
        });
        const existingEmailSet = new Set(existingEmails.map(e => e.email?.toLowerCase()));
        // Separate duplicates from new contacts
        const newContacts = [];
        for (const contact of validContacts) {
            const email = (contact.email || contact.Email || contact['E-mail'] || '').toString().toLowerCase().trim();
            if (existingEmailSet.has(email)) {
                duplicates.push({ email });
            }
            else {
                newContacts.push(contact);
            }
        }
        // Import new contacts in batches
        if (newContacts.length > 0) {
            try {
                const batch = newContacts.map(contact => {
                    const email = (contact.email || contact.Email || contact['E-mail'] || '').toString().toLowerCase().trim();
                    const fullName = contact.fullName || contact.name || contact.Name ||
                        (contact.firstName ? `${contact.firstName} ${contact.lastName || ''}`.trim() : '') ||
                        '';
                    const whatsapp = contact.whatsapp || contact.phone || contact.Phone || '';
                    const data = {
                        email,
                        fullName,
                        whatsapp,
                    };
                    if (segmentId)
                        data.segmentId = segmentId;
                    return prisma_1.default.lead.upsert({
                        where: { email },
                        update: {
                            fullName: fullName || undefined,
                            whatsapp: whatsapp || undefined,
                        },
                        create: data,
                    });
                });
                const createdLeads = await prisma_1.default.$transaction(batch);
                inserted.push(...createdLeads);
            }
            catch (batchError) {
                console.error('Batch import error:', batchError);
                throw batchError;
            }
        }
        res.status(201).json({
            message: `Imported ${inserted.length} contacts. ${duplicates.length} already exist.`,
            segmentId,
            imported: inserted.length,
            duplicates: duplicates.length,
        });
    }
    catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ error: 'Failed to import contacts', details: error.message });
    }
};
exports.importContacts = importContacts;
