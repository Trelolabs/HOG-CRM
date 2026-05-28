import { Request, Response } from 'express';
import prisma from '../utils/prisma';

export const getSegments = async (req: Request, res: Response) => {
    try {
        const segments = await prisma.segment.findMany({
            include: { _count: { select: { leads: true } } }
        });
        res.json(segments);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch segments' });
    }
};

export const createSegment = async (req: Request, res: Response) => {
    const { name, description } = req.body;
    if (!name || !String(name).trim()) {
        return res.status(400).json({ error: 'Segment name is required' });
    }

    try {
        const segment = await prisma.segment.create({
            data: { name: String(name).trim(), description: description?.trim() || null }
        });
        res.status(201).json(segment);
    } catch (error: any) {
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Segment name already exists' });
        }
        res.status(500).json({ error: 'Failed to create segment', details: error.message });
    }
};

export const updateSegment = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, description } = req.body;

    if (typeof name === 'undefined' && typeof description === 'undefined') {
        return res.status(400).json({ error: 'At least one field (name or description) is required' });
    }
    if (typeof name !== 'undefined' && !String(name).trim()) {
        return res.status(400).json({ error: 'Segment name is required' });
    }

    try {
        const segment = await prisma.segment.update({
            where: { id: String(id) },
            data: {
                ...(typeof name !== 'undefined' ? { name: String(name).trim() } : {}),
                ...(typeof description !== 'undefined'
                    ? { description: description ? String(description).trim() : null }
                    : {})
            }
        });

        res.json(segment);
    } catch (error: any) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Segment not found' });
        }
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Segment name already exists' });
        }
        res.status(500).json({ error: 'Failed to update segment', details: error.message });
    }
};

export const deleteSegment = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        await prisma.$transaction([
            prisma.lead.updateMany({
                where: { segmentId: String(id) },
                data: { segmentId: null }
            }),
            prisma.campaign.deleteMany({
                where: { segmentId: String(id) }
            }),
            prisma.segment.delete({
                where: { id: String(id) }
            })
        ]);

        res.status(204).send();
    } catch (error: any) {
        console.error('Failed to delete segment:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Segment not found' });
        }
        if (error.code === 'P2003') {
            return res.status(409).json({ error: 'Segment cannot be deleted because related records still reference it' });
        }
        res.status(500).json({ error: 'Failed to delete segment', details: error.message });
    }
};
