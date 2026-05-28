"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardOverview = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const getDashboardOverview = async (req, res) => {
    try {
        const [totalLeads, qualifiedLeads, contactedLeads, sentCampaigns, recentLeads] = await Promise.all([
            prisma_1.default.lead.count(),
            prisma_1.default.lead.count({ where: { status: 'QUALIFIED' } }),
            prisma_1.default.lead.count({ where: { status: 'CONTACTED' } }),
            prisma_1.default.campaign.count({ where: { status: 'SENT' } }),
            prisma_1.default.lead.findMany({
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
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to fetch dashboard overview', details: error.message });
    }
};
exports.getDashboardOverview = getDashboardOverview;
