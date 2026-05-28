import { Request, Response } from 'express';
import prisma from '../utils/prisma';

export const getDashboardOverview = async (req: Request, res: Response) => {
    try {
        const [totalLeads, qualifiedLeads, contactedLeads, sentCampaigns, recentLeads] = await Promise.all([
            prisma.lead.count(),
            prisma.lead.count({ where: { status: 'QUALIFIED' } }),
            prisma.lead.count({ where: { status: 'CONTACTED' } }),
            prisma.campaign.count({ where: { status: 'SENT' } }),
            prisma.lead.findMany({
                orderBy: { createdAt: 'desc' },
                take: 8,
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                    status: true,
                    createdAt: true
                }
            })
        ]);

        return res.json({
            stats: {
                totalLeads,
                qualifiedLeads,
                contactedLeads,
                sentCampaigns
            },
            recentLeads
        });
    } catch (error: any) {
        return res.status(500).json({ error: 'Failed to fetch dashboard overview', details: error.message });
    }
};
