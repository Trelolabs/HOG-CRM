import { Request, Response } from 'express';
import { CampaignStatus, CampaignType } from '@prisma/client';
import prisma from '../utils/prisma';
import { sendCampaignWithProvider } from '../services/campaignService';

const CAMPAIGN_TYPES: CampaignType[] = ['EMAIL', 'SMS'];
const CAMPAIGN_STATUSES: CampaignStatus[] = ['DRAFT', 'SCHEDULED', 'SENT', 'FAILED'];

export const createCampaign = async (req: Request, res: Response) => {
    const { type, name, segmentId, content, subject } = req.body;

    if (!type || !name || !segmentId || !content) {
        return res.status(400).json({ error: 'type, name, segmentId and content are required' });
    }
        const normalizedType = String(type).toUpperCase() as CampaignType;
        if (!CAMPAIGN_TYPES.includes(normalizedType)) {
        return res.status(400).json({ error: `Invalid campaign type. Allowed: ${CAMPAIGN_TYPES.join(', ')}` });
    }

    try {
        const segment = await prisma.segment.findUnique({ where: { id: String(segmentId) } });
        if (!segment) {
            return res.status(404).json({ error: 'Segment not found' });
        }

        const campaign = await prisma.campaign.create({
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
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to create campaign', details: error.message });
    }
};

export const getCampaigns = async (req: Request, res: Response) => {
    try {
        const status = String(req.query.status || '').trim().toUpperCase() as CampaignStatus;
        const segmentId = String(req.query.segmentId || '').trim();

        if (status && !CAMPAIGN_STATUSES.includes(status)) {
            return res.status(400).json({ error: `Invalid status. Allowed: ${CAMPAIGN_STATUSES.join(', ')}` });
        }

        const campaigns = await prisma.campaign.findMany({
            where: {
                ...(status ? { status } : {}),
                ...(segmentId ? { segmentId } : {})
            },
            include: { segment: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(campaigns);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch campaigns', details: error.message });
    }
};

export const updateCampaign = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { type, name, segmentId, content, subject, status } = req.body;

    if (
        typeof type === 'undefined' &&
        typeof name === 'undefined' &&
        typeof segmentId === 'undefined' &&
        typeof content === 'undefined' &&
        typeof subject === 'undefined' &&
        typeof status === 'undefined'
    ) {
        return res.status(400).json({ error: 'No fields provided for update' });
    }

    const normalizedType = type ? (String(type).toUpperCase() as CampaignType) : undefined;
    const normalizedStatus = status ? (String(status).toUpperCase() as CampaignStatus) : undefined;

    if (normalizedType && !CAMPAIGN_TYPES.includes(normalizedType)) {
        return res.status(400).json({ error: `Invalid campaign type. Allowed: ${CAMPAIGN_TYPES.join(', ')}` });
    }
    if (normalizedStatus && !CAMPAIGN_STATUSES.includes(normalizedStatus)) {
        return res.status(400).json({ error: `Invalid status. Allowed: ${CAMPAIGN_STATUSES.join(', ')}` });
    }

    try {
        if (segmentId) {
            const segment = await prisma.segment.findUnique({ where: { id: String(segmentId) } });
            if (!segment) {
                return res.status(404).json({ error: 'Segment not found' });
            }
        }

        const campaign = await prisma.campaign.update({
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
    } catch (error: any) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        res.status(500).json({ error: 'Failed to update campaign', details: error.message });
    }
};

export const sendCampaign = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const result = await sendCampaignWithProvider(String(id));

        res.json({
            message: `Campaign processed with ${result.mode} provider mode`,
            campaign: result.campaign
        });
    } catch (error: any) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        res.status(500).json({ error: 'Failed to send campaign', details: error.message });
    }
};

export const sendToLeads = async (req: Request, res: Response) => {
    try {
        const { subject, content, leadIds, attachments, segmentId } = req.body;

        if (!subject || !content) {
            return res.status(400).json({ error: 'Subject and content are required' });
        }

        if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
            return res.status(400).json({ error: 'At least one lead ID is required' });
        }

        if (!segmentId) {
            return res.status(400).json({ error: 'Segment ID is required' });
        }

        // Verify segment exists
        const segment = await prisma.segment.findUnique({ where: { id: segmentId } });
        if (!segment) {
            return res.status(404).json({ error: 'Segment not found' });
        }

        // Create campaign
        const campaign = await prisma.campaign.create({
            data: {
                type: 'EMAIL',
                name: `Campaign - ${new Date().toLocaleString()}`,
                subject,
                content,
                attachments: attachments || null,
                segmentId,
                status: 'SCHEDULED'
            }
        });

        // Get lead emails
        const leads = await prisma.lead.findMany({
            where: { id: { in: leadIds } },
            select: { email: true }
        });

        if (leads.length === 0) {
            return res.status(404).json({ error: 'No leads found with provided IDs' });
        }

        // Add email jobs to queue
        const { emailQueue } = await import('../queues');
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
        await prisma.campaign.update({
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
    } catch (error: any) {
        console.error('Send to leads error:', error);
        res.status(500).json({ error: 'Failed to send emails', details: error.message });
    }
};

import { uploadQueue } from '../queues';

export const uploadFile = async (req: Request, res: Response) => {
    console.log(`[API] Received upload request for file...`);
    try {
        if (!req.file) {
            console.warn(`[API] Upload request failed: No file uploaded`);
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        console.log(`[API] File uploaded successfully to temp storage: ${req.file.path} (${req.file.mimetype})`);
        
        const job = await uploadQueue.add('processFile', {
            filePath: req.file.path,
            originalname: req.file.originalname,
            mimetype: req.file.mimetype
        });

        console.log(`[API] Added processing job ${job.id} to uploadQueue for file ${req.file.originalname}`);
        res.json({ jobId: job.id, message: 'File uploaded and processing started' });
    } catch (error: any) {
        console.error(`[API] Error during upload processing:`, error);
        res.status(500).json({ error: 'Failed to process upload', details: error.message });
    }
};

export const getUploadStatus = async (req: Request, res: Response) => {
    try {
        const { jobId } = req.params;
        const job = await uploadQueue.getJob(jobId as string);
        
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
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to get job status', details: error.message });
    }
};

export const importContacts = async (req: Request, res: Response) => {
    try {
        const { contacts, segmentName } = req.body;

        if (!Array.isArray(contacts)) {
            return res.status(400).json({ error: 'Contacts must be an array' });
        }

        // Create or find segment
        let segmentId = req.body.segmentId;
        if (!segmentId && segmentName) {
            const segment = await prisma.segment.create({
                data: { name: segmentName }
            });
            segmentId = segment.id;
        }

        const inserted: any[] = [];
        const duplicates: any[] = [];

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

        const existingEmails = await prisma.lead.findMany({
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
            } else {
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

                    const data: any = {
                        email,
                        fullName,
                        whatsapp,
                    };
                    if (segmentId) data.segmentId = segmentId;

                    return prisma.lead.upsert({
                        where: { email },
                        update: {
                            fullName: fullName || undefined,
                            whatsapp: whatsapp || undefined,
                        },
                        create: data,
                    });
                });

                const createdLeads = await prisma.$transaction(batch);
                inserted.push(...createdLeads);
            } catch (batchError: any) {
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
    } catch (error: any) {
        console.error('Import error:', error);
        res.status(500).json({ error: 'Failed to import contacts', details: error.message });
    }
};
