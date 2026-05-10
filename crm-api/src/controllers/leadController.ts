import { Request, Response } from 'express';
import prisma from '../utils/prisma';

const LEAD_STATUSES = ['NEW', 'QUALIFIED', 'CONTACTED', 'CLOSED'] as const;

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const createLead = async (req: Request, res: Response) => {
    try {
        const { fullName, email, whatsapp, businessName, serviceInterest, message } = req.body;

        if (!fullName || !email) {
            return res.status(400).json({ error: 'Full name and email are required' });
        }
        if (!isValidEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        const lead = await prisma.lead.create({
            data: {
                fullName: String(fullName).trim(),
                email: String(email).trim().toLowerCase(),
                whatsapp: whatsapp?.trim() || null,
                businessName: businessName?.trim() || null,
                serviceInterest: serviceInterest?.trim() || null,
                message: message?.trim() || null,
                status: 'NEW'
            }
        });

        res.status(201).json(lead);
    } catch (error: any) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'A lead with this email already exists' });
        }
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
};

export const getLeads = async (req: Request, res: Response) => {
    try {
        const page = Math.max(1, Number(req.query.page || 1));
        const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
        const search = String(req.query.search || '').trim();
        const status = String(req.query.status || '').trim().toUpperCase();
        const segmentId = String(req.query.segmentId || '').trim();
        const sortBy = ['createdAt', 'updatedAt', 'fullName', 'email', 'status'].includes(String(req.query.sortBy))
            ? String(req.query.sortBy)
            : 'createdAt';
        const sortOrder = String(req.query.sortOrder).toLowerCase() === 'asc' ? 'asc' : 'desc';

        if (status && !LEAD_STATUSES.includes(status as (typeof LEAD_STATUSES)[number])) {
            return res.status(400).json({ error: `Invalid status. Allowed: ${LEAD_STATUSES.join(', ')}` });
        }

        const where = {
            ...(status ? { status } : {}),
            ...(segmentId ? { segmentId } : {}),
            ...(search
                ? {
                      OR: [
                          { fullName: { contains: search, mode: 'insensitive' as const } },
                          { email: { contains: search, mode: 'insensitive' as const } },
                          { businessName: { contains: search, mode: 'insensitive' as const } }
                      ]
                  }
                : {})
        };

        const [leads, total] = await Promise.all([
            prisma.lead.findMany({
                where,
                include: { segment: true },
                orderBy: { [sortBy]: sortOrder },
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma.lead.count({ where })
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
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch leads' });
    }
};

export const updateLead = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, segmentId } = req.body;
    try {
        if (!status && typeof segmentId === 'undefined') {
            return res.status(400).json({ error: 'At least one field (status or segmentId) must be provided' });
        }

        if (status && !LEAD_STATUSES.includes(String(status).toUpperCase() as (typeof LEAD_STATUSES)[number])) {
            return res.status(400).json({ error: `Invalid status. Allowed: ${LEAD_STATUSES.join(', ')}` });
        }

        if (segmentId) {
            const segment = await prisma.segment.findUnique({ where: { id: String(segmentId) } });
            if (!segment) {
                return res.status(404).json({ error: 'Segment not found' });
            }
        }

        const lead = await prisma.lead.update({
            where: { id: id as string },
            data: {
                ...(status ? { status: String(status).toUpperCase() } : {}),
                ...(typeof segmentId !== 'undefined'
                    ? { segmentId: segmentId ? String(segmentId) : null }
                    : {})
            },
            include: { segment: true }
        });
        res.json(lead);
    } catch (error: any) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Lead not found' });
        }
        res.status(500).json({ error: 'Failed to update lead', details: error.message });
    }
};

export const deleteLead = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        await prisma.lead.delete({ where: { id: id as string } });
        res.status(204).send();
    } catch (error: any) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Lead not found' });
        }
        res.status(500).json({ error: 'Failed to delete lead', details: error.message });
    }
};
