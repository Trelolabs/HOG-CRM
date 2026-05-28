"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSegment = exports.updateSegment = exports.createSegment = exports.getSegments = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const getSegments = async (req, res) => {
    try {
        const segments = await prisma_1.default.segment.findMany({
            include: { _count: { select: { leads: true } } }
        });
        res.json(segments);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch segments' });
    }
};
exports.getSegments = getSegments;
const createSegment = async (req, res) => {
    const { name, description } = req.body;
    if (!name || !String(name).trim()) {
        return res.status(400).json({ error: 'Segment name is required' });
    }
    try {
        const segment = await prisma_1.default.segment.create({
            data: { name: String(name).trim(), description: description?.trim() || null }
        });
        res.status(201).json(segment);
    }
    catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Segment name already exists' });
        }
        res.status(500).json({ error: 'Failed to create segment', details: error.message });
    }
};
exports.createSegment = createSegment;
const updateSegment = async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;
    if (typeof name === 'undefined' && typeof description === 'undefined') {
        return res.status(400).json({ error: 'At least one field (name or description) is required' });
    }
    if (typeof name !== 'undefined' && !String(name).trim()) {
        return res.status(400).json({ error: 'Segment name is required' });
    }
    try {
        const segment = await prisma_1.default.segment.update({
            where: { id: String(id) },
            data: {
                ...(typeof name !== 'undefined' ? { name: String(name).trim() } : {}),
                ...(typeof description !== 'undefined'
                    ? { description: description ? String(description).trim() : null }
                    : {})
            }
        });
        res.json(segment);
    }
    catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Segment not found' });
        }
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Segment name already exists' });
        }
        res.status(500).json({ error: 'Failed to update segment', details: error.message });
    }
};
exports.updateSegment = updateSegment;
const deleteSegment = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma_1.default.$transaction([
            prisma_1.default.lead.updateMany({
                where: { segmentId: String(id) },
                data: { segmentId: null }
            }),
            prisma_1.default.campaign.deleteMany({
                where: { segmentId: String(id) }
            }),
            prisma_1.default.segment.delete({
                where: { id: String(id) }
            })
        ]);
        res.status(204).send();
    }
    catch (error) {
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
exports.deleteSegment = deleteSegment;
