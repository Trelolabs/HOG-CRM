import prisma from '../utils/prisma';
import { parse } from 'csv-parse';
import * as xlsx from 'xlsx';
import fs from 'fs';
import { promisify } from 'util';
const unlinkAsync = promisify(fs.unlink);
const ALLOWED_STATUSES = ['NEW', 'QUALIFIED', 'CONTACTED', 'CLOSED'];
export const importCSV = async (req, res) => {
    if (!req.file)
        return res.status(400).json({ error: 'No file uploaded' });
    const filePath = req.file.path;
    const rows = [];
    try {
        await new Promise((resolve, reject) => {
            fs.createReadStream(filePath)
                .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }))
                .on('data', (data) => rows.push(data))
                .on('end', () => resolve())
                .on('error', (error) => reject(error));
        });
        const errors = [];
        const preparedRows = [];
        rows.forEach((row, index) => {
            const fullName = (row.fullName || row.name || '').trim();
            const email = (row.email || '').trim().toLowerCase();
            const statusValue = (row.status || 'NEW').trim().toUpperCase();
            if (!fullName || !email) {
                errors.push({ row: index + 2, error: 'fullName/name and email are required' });
                return;
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                errors.push({ row: index + 2, error: `Invalid email format: ${email}` });
                return;
            }
            if (!ALLOWED_STATUSES.includes(statusValue)) {
                errors.push({
                    row: index + 2,
                    error: `Invalid status '${statusValue}'. Allowed: ${ALLOWED_STATUSES.join(', ')}`
                });
                return;
            }
            preparedRows.push({
                fullName,
                email,
                whatsapp: (row.whatsapp || row.phone || '').trim() || undefined,
                businessName: (row.businessName || row.company || '').trim() || undefined,
                serviceInterest: (row.serviceInterest || '').trim() || undefined,
                message: (row.message || '').trim() || undefined,
                status: statusValue
            });
        });
        const importResult = await prisma.lead.createMany({
            data: preparedRows,
            skipDuplicates: true
        });
        res.json({
            message: `Import completed. ${importResult.count} leads created.`,
            count: importResult.count,
            totalRows: rows.length,
            failedRows: errors.length,
            errors
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to process CSV data', details: error.message });
    }
    finally {
        await unlinkAsync(filePath).catch(() => undefined);
    }
};
export const exportExcel = async (req, res) => {
    try {
        const status = String(req.query.status || '').trim().toUpperCase();
        const segmentId = String(req.query.segmentId || '').trim();
        if (status && !ALLOWED_STATUSES.includes(status)) {
            return res.status(400).json({ error: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}` });
        }
        const leads = await prisma.lead.findMany({
            where: {
                ...(status ? { status } : {}),
                ...(segmentId ? { segmentId } : {})
            },
            include: { segment: { select: { name: true } } }
        });
        const worksheet = xlsx.utils.json_to_sheet(leads.map(l => ({
            ID: l.id,
            Name: l.fullName,
            Email: l.email,
            WhatsApp: l.whatsapp,
            Business: l.businessName,
            Interest: l.serviceInterest,
            Status: l.status,
            Segment: l.segment?.name || 'Unassigned',
            CreatedAt: l.createdAt
        })));
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Leads');
        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Disposition', 'attachment; filename=leads_export.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to generate export', details: error.message });
    }
};
