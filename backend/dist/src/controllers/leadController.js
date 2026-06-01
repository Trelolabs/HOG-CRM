"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteLead = exports.updateLead = exports.getLeads = exports.createLead = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const LEAD_STATUSES = ['NEW', 'QUALIFIED', 'CONTACTED', 'CLOSED'];
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const createLead = async (req, res) => {
    try {
        const { fullName, email, whatsapp, businessName, serviceInterest, message } = req.body;
        const whatsappValue = String(whatsapp || req.body.phone || req.body.mobile || '').trim();
        if (!fullName || !email || !whatsappValue) {
            return res.status(400).json({ error: 'Full name, email, and mobile number are required' });
        }
        if (!isValidEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }
        const lead = await prisma_1.default.lead.create({
            data: {
                fullName: String(fullName).trim(),
                email: String(email).trim().toLowerCase(),
                whatsapp: whatsappValue,
                businessName: businessName?.trim() || null,
                serviceInterest: serviceInterest?.trim() || null,
                message: message?.trim() || null,
                status: 'NEW'
            }
        });
        res.status(201).json(lead);
    }
    catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'A lead with this email already exists' });
        }
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
};
exports.createLead = createLead;
const getLeads = async (req, res) => {
    try {
        const page = Math.max(1, Number(req.query.page || 1));
        const limit = Math.min(10000, Math.max(1, Number(req.query.limit || 20)));
        const search = String(req.query.search || '').trim();
        const status = String(req.query.status || '').trim().toUpperCase();
        const segmentId = String(req.query.segmentId || '').trim();
        const sortBy = ['createdAt', 'updatedAt', 'fullName', 'email', 'status'].includes(String(req.query.sortBy))
            ? String(req.query.sortBy)
            : 'createdAt';
        const sortOrder = String(req.query.sortOrder).toLowerCase() === 'asc' ? 'asc' : 'desc';
        if (status && !LEAD_STATUSES.includes(status)) {
            return res.status(400).json({ error: `Invalid status. Allowed: ${LEAD_STATUSES.join(', ')}` });
        }
        const where = {
            ...(status ? { status } : {}),
            ...(segmentId ? { segmentId } : {}),
            ...(search
                ? {
                    OR: [
                        { fullName: { contains: search, mode: 'insensitive' } },
                        { email: { contains: search, mode: 'insensitive' } },
                        { businessName: { contains: search, mode: 'insensitive' } },
                        { whatsapp: { contains: search, mode: 'insensitive' } }
                    ]
                }
                : {})
        };
        const [leads, total] = await Promise.all([
            prisma_1.default.lead.findMany({
                where,
                include: { segment: true },
                orderBy: { [sortBy]: sortOrder },
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma_1.default.lead.count({ where })
        ]);
        res.json({
            data: leads,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch leads' });
    }
};
exports.getLeads = getLeads;
const updateLead = async (req, res) => {
    const { id } = req.params;
    const { status, segmentId } = req.body;
    try {
        if (!status && typeof segmentId === 'undefined') {
            return res.status(400).json({ error: 'At least one field (status or segmentId) must be provided' });
        }
        if (status && !LEAD_STATUSES.includes(String(status).toUpperCase())) {
            return res.status(400).json({ error: `Invalid status. Allowed: ${LEAD_STATUSES.join(', ')}` });
        }
        if (segmentId) {
            const segment = await prisma_1.default.segment.findUnique({ where: { id: String(segmentId) } });
            if (!segment) {
                return res.status(404).json({ error: 'Segment not found' });
            }
        }
        const lead = await prisma_1.default.lead.update({
            where: { id: id },
            data: {
                ...(status ? { status: String(status).toUpperCase() } : {}),
                ...(typeof segmentId !== 'undefined'
                    ? { segmentId: segmentId ? String(segmentId) : null }
                    : {})
            },
            include: { segment: true }
        });
        res.json(lead);
    }
    catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Lead not found' });
        }
        res.status(500).json({ error: 'Failed to update lead', details: error.message });
    }
};
exports.updateLead = updateLead;
const deleteLead = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma_1.default.lead.delete({ where: { id: id } });
        res.status(204).send();
    }
    catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Lead not found' });
        }
        res.status(500).json({ error: 'Failed to delete lead', details: error.message });
    }
};
exports.deleteLead = deleteLead;
