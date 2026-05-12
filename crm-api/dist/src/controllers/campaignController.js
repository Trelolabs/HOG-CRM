import prisma from '../utils/prisma';
import { sendCampaignWithProvider } from '../services/campaignService';
const CAMPAIGN_TYPES = ['EMAIL', 'SMS'];
const CAMPAIGN_STATUSES = ['DRAFT', 'SCHEDULED', 'SENT', 'FAILED'];
export const createCampaign = async (req, res) => {
    const { type, name, segmentId, content, subject } = req.body;
    if (!type || !name || !segmentId || !content) {
        return res.status(400).json({ error: 'type, name, segmentId and content are required' });
    }
    const normalizedType = String(type).toUpperCase();
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
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create campaign', details: error.message });
    }
};
export const getCampaigns = async (req, res) => {
    try {
        const status = String(req.query.status || '').trim().toUpperCase();
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
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch campaigns', details: error.message });
    }
};
export const updateCampaign = async (req, res) => {
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
    }
    catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        res.status(500).json({ error: 'Failed to update campaign', details: error.message });
    }
};
export const sendCampaign = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await sendCampaignWithProvider(String(id));
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
