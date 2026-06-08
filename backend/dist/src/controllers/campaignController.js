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
        const type = String(req.query.type || '').trim().toUpperCase();
        if (status && !CAMPAIGN_STATUSES.includes(status)) {
            return res.status(400).json({ error: `Invalid status. Allowed: ${CAMPAIGN_STATUSES.join(', ')}` });
        }
        if (type && !CAMPAIGN_TYPES.includes(type)) {
            return res.status(400).json({ error: `Invalid type. Allowed: ${CAMPAIGN_TYPES.join(', ')}` });
        }
        const campaigns = await prisma_1.default.campaign.findMany({
            where: {
                ...(status ? { status } : {}),
                ...(segmentId ? { segmentId } : {}),
                ...(type ? { type } : {})
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
        const { type = 'EMAIL', subject, content, leadIds, attachments, segmentId } = req.body;
        const normalizedType = String(type).toUpperCase();
        if (normalizedType === 'EMAIL' && !subject) {
            return res.status(400).json({ error: 'Subject is required for EMAIL campaigns' });
        }
        if (!content) {
            return res.status(400).json({ error: 'Content is required' });
        }
        if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
            return res.status(400).json({ error: 'At least one lead ID is required' });
        }
        if (!segmentId) {
            return res.status(400).json({ error: 'Segment ID is required' });
        }
        // Verify segment exists
        const segment = await prisma_1.default.segment.findUnique({ where: { id: segmentId } });
        if (!segment) {
            return res.status(404).json({ error: 'Segment not found' });
        }
        // Create campaign
        const campaign = await prisma_1.default.campaign.create({
            data: {
                type: normalizedType,
                name: `Campaign - ${new Date().toLocaleString()}`,
                subject: normalizedType === 'EMAIL' ? subject : null,
                content,
                attachments: normalizedType === 'EMAIL' ? (attachments || null) : null,
                segmentId,
                status: 'SCHEDULED'
            }
        });
        // Get lead details
        const leads = await prisma_1.default.lead.findMany({
            where: {
                id: { in: leadIds },
                ...(normalizedType === 'EMAIL' ? { email: { not: '' } } : { whatsapp: { not: '' } })
            },
            select: {
                id: true,
                fullName: true,
                email: true,
                whatsapp: true,
                businessName: true
            }
        });
        if (leads.length === 0) {
            return res.status(404).json({ error: normalizedType === 'EMAIL' ? 'No leads with valid email addresses found' : 'No leads with valid WhatsApp/phone numbers found' });
        }
        // Add jobs to correct queue with retry logic
        if (normalizedType === 'EMAIL') {
            const { emailQueue } = await Promise.resolve().then(() => __importStar(require('../queues')));
            const jobs = leads.map(lead => ({
                name: 'sendEmail',
                data: {
                    to: lead.email,
                    subject,
                    html: content,
                    attachments: attachments || undefined,
                    recipient: lead,
                    campaignId: campaign.id
                },
                opts: {
                    attempts: 3,
                    backoff: { type: 'exponential', delay: 3000 }
                }
            }));
            await emailQueue.addBulk(jobs);
            console.log(`[SendToLeads] Enqueued ${jobs.length} jobs to emailQueue`);
        }
        else {
            const { smsQueue } = await Promise.resolve().then(() => __importStar(require('../queues')));
            const jobs = leads.map(lead => ({
                name: 'sendSms',
                data: {
                    to: lead.whatsapp,
                    body: content,
                    recipient: lead,
                    campaignId: campaign.id
                },
                opts: {
                    attempts: 3,
                    backoff: { type: 'exponential', delay: 3000 }
                }
            }));
            await smsQueue.addBulk(jobs);
            console.log(`[SendToLeads] Enqueued ${jobs.length} jobs to smsQueue`);
        }
        // Mark leads as CONTACTED
        await prisma_1.default.lead.updateMany({
            where: { id: { in: leads.map(l => l.id) } },
            data: { status: 'CONTACTED' }
        });
        console.log(`[SendToLeads] Marked ${leads.length} leads as CONTACTED`);
        // Update campaign
        await prisma_1.default.campaign.update({
            where: { id: campaign.id },
            data: {
                status: 'SCHEDULED',
                attemptedRecipients: leads.length
            }
        });
        res.status(201).json({
            message: normalizedType === 'EMAIL' ? `Sending emails to ${leads.length} contacts` : `Sending SMS to ${leads.length} contacts`,
            campaignId: campaign.id,
            count: leads.length
        });
    }
    catch (error) {
        console.error('Send to leads error:', error);
        res.status(500).json({ error: 'Failed to send campaign', details: error.message });
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
        const { campaignType = 'EMAIL' } = req.body;
        const filePath = req.file.path;
        console.log(`[API] File uploaded to: ${filePath} (${req.file.mimetype}) for campaign type: ${campaignType}`);
        const job = await queues_1.uploadQueue.add('processFile', {
            filePath,
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            campaignType: campaignType.toUpperCase()
        });
        console.log(`[API] Added job ${job.id} for file ${req.file.originalname}`);
        res.json({ jobId: job.id, message: 'File uploaded and processing started' });
    }
    catch (error) {
        console.error(`[API] Error during upload:`, error);
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
    const t0 = Date.now();
    try {
        console.log('[Import] Starting import');
        const { contacts, segmentName, campaignType } = req.body;
        if (!Array.isArray(contacts)) {
            return res.status(400).json({ error: 'Contacts must be an array' });
        }
        if (!campaignType) {
            return res.status(400).json({ error: 'campaignType is required (EMAIL or SMS)' });
        }
        const normalizedCampaignType = String(campaignType).toUpperCase();
        if (!['EMAIL', 'SMS'].includes(normalizedCampaignType)) {
            return res.status(400).json({ error: 'Invalid campaignType. Allowed: EMAIL, SMS' });
        }
        console.log(`[Import] Received ${contacts.length} contacts for ${normalizedCampaignType}`);
        // Create or find segment
        let segmentId = req.body.segmentId;
        if (!segmentId && segmentName) {
            console.log(`[Import] Finding/creating segment: ${segmentName}`);
            let segment = await prisma_1.default.segment.findUnique({
                where: { name: segmentName }
            });
            if (!segment) {
                segment = await prisma_1.default.segment.create({
                    data: { name: segmentName, campaignType: normalizedCampaignType }
                });
                console.log(`[Import] Created segment ${segment.id} for ${normalizedCampaignType}`);
            }
            else if (segment.campaignType !== normalizedCampaignType) {
                const elapsed = Date.now() - t0;
                console.error(`[Import] Error after ${elapsed}ms: Segment ${segmentName} exists for a different campaign type`);
                return res.status(409).json({ error: `A segment named "${segmentName}" already exists for ${segment.campaignType} campaigns. Please use a different name.` });
            }
            else {
                console.log(`[Import] Found existing segment ${segment.id} for ${normalizedCampaignType}`);
            }
            segmentId = segment.id;
        }
        const inserted = [];
        const duplicates = [];
        // Contacts are already filtered by type (email/sms) during upload extraction
        const validContacts = contacts;
        console.log(`[Import] Valid contacts: ${validContacts.length}/${contacts.length}`);
        // If no valid contacts, just create segment and return success
        if (validContacts.length === 0) {
            return res.status(201).json({
                message: `Segment created: ${segmentName}. No contacts to import.`,
                segmentId,
                imported: 0,
                duplicates: 0,
            });
        }
        // Check for duplicates — type-aware dedup logic
        console.log(`[Import] Checking for duplicates...`);
        const t1 = Date.now();
        let existingSet = new Set();
        let dedupeKey;
        if (normalizedCampaignType === 'EMAIL') {
            // EMAIL: dedup by email address
            const emailsToImport = validContacts.map(c => {
                const email = c.email || c.Email || c['E-mail'] || '';
                return email.toString().toLowerCase().trim();
            });
            const t2 = Date.now();
            const existingEmails = await prisma_1.default.lead.findMany({
                where: { email: { in: emailsToImport } },
                select: { email: true }
            });
            const t3 = Date.now();
            existingSet = new Set(existingEmails.map(e => e.email?.toLowerCase()));
            dedupeKey = 'email';
            console.log(`[Import] Mapped emails: ${t2 - t1}ms, DB query: ${t3 - t2}ms, Found ${existingSet.size} existing emails`);
        }
        else {
            // SMS: dedup by phone/whatsapp
            const phonesToImport = validContacts.map(c => {
                const phone = c.whatsapp || c.phone || c.Phone || '';
                return phone.toString().trim();
            });
            const t2 = Date.now();
            const existingPhones = await prisma_1.default.lead.findMany({
                where: { whatsapp: { in: phonesToImport } },
                select: { whatsapp: true }
            });
            const t3 = Date.now();
            existingSet = new Set(existingPhones.map(p => p.whatsapp?.trim()));
            dedupeKey = 'whatsapp';
            console.log(`[Import] Mapped phones: ${t2 - t1}ms, DB query: ${t3 - t2}ms, Found ${existingSet.size} existing phone numbers`);
        }
        // Separate duplicates from new contacts
        const newContacts = [];
        for (const contact of validContacts) {
            const key = dedupeKey === 'email'
                ? (contact.email || contact.Email || contact['E-mail'] || '').toString().toLowerCase().trim()
                : (contact.whatsapp || contact.phone || contact.Phone || '').toString().trim();
            if (existingSet.has(key)) {
                duplicates.push({ [dedupeKey]: key });
            }
            else {
                newContacts.push(contact);
            }
        }
        console.log(`[Import] Will import ${newContacts.length} new contacts, ${duplicates.length} duplicates`);
        // Import new contacts via bulk createMany (single SQL statement, not 600 round-trips)
        let importedCount = 0;
        if (newContacts.length > 0) {
            try {
                const rows = newContacts.map(contact => {
                    const fullName = contact.fullName || contact.name || contact.Name ||
                        (contact.firstName ? `${contact.firstName} ${contact.lastName || ''}`.trim() : '') || '';
                    let email;
                    let whatsapp;
                    if (normalizedCampaignType === 'EMAIL') {
                        email = (contact.email || contact.Email || contact['E-mail'] || '').toString().toLowerCase().trim();
                        whatsapp = contact.whatsapp || contact.phone || contact.Phone || '';
                    }
                    else {
                        // SMS: whatsapp is the primary key, email is synthetic to satisfy DB constraint
                        whatsapp = (contact.whatsapp || contact.phone || contact.Phone || '').toString().trim();
                        const sanitizedPhone = whatsapp.replace(/[^\d+]/g, '');
                        email = `sms-${sanitizedPhone}@placeholder.invalid`;
                    }
                    const data = { email, fullName, whatsapp };
                    if (segmentId)
                        data.segmentId = segmentId;
                    return data;
                });
                console.log(`[Import] createMany for ${rows.length} contacts...`);
                const t0 = Date.now();
                const result = await prisma_1.default.lead.createMany({ data: rows, skipDuplicates: true });
                const elapsed = Date.now() - t0;
                console.log(`[Import] createMany done in ${elapsed}ms. Imported: ${result.count}`);
                importedCount = result.count;
            }
            catch (batchError) {
                console.error('[Import] createMany error:', batchError);
                throw batchError;
            }
        }
        // Update existing contacts to belong to the segment (re-import case)
        if (existingSet.size > 0 && segmentId) {
            console.log(`[Import] Updating ${existingSet.size} existing contacts with segment...`);
            if (dedupeKey === 'email') {
                await prisma_1.default.lead.updateMany({
                    where: { email: { in: [...existingSet] } },
                    data: { segmentId }
                });
            }
            else {
                await prisma_1.default.lead.updateMany({
                    where: { whatsapp: { in: [...existingSet] } },
                    data: { segmentId }
                });
            }
        }
        const elapsed = Date.now() - t0;
        console.log(`[Import] Import complete. Imported: ${importedCount}, Duplicates: ${duplicates.length}. Total time: ${elapsed}ms`);
        res.status(201).json({
            message: `Imported ${importedCount} contacts. ${duplicates.length} already exist.`,
            segmentId,
            imported: importedCount,
            duplicates: duplicates.length,
        });
    }
    catch (error) {
        const elapsed = Date.now() - t0;
        console.error(`[Import] Error after ${elapsed}ms:`, error);
        res.status(500).json({ error: 'Failed to import contacts', details: error.message });
    }
};
exports.importContacts = importContacts;
