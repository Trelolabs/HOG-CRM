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
exports.exportExcel = exports.importCSV = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const csv_parse_1 = require("csv-parse");
const xlsx = __importStar(require("xlsx"));
const fs_1 = __importDefault(require("fs"));
const util_1 = require("util");
const unlinkAsync = (0, util_1.promisify)(fs_1.default.unlink);
const ALLOWED_STATUSES = ['NEW', 'QUALIFIED', 'CONTACTED', 'CLOSED'];
const importCSV = async (req, res) => {
    if (!req.file)
        return res.status(400).json({ error: 'No file uploaded' });
    const filePath = req.file.path;
    const rows = [];
    try {
        await new Promise((resolve, reject) => {
            fs_1.default.createReadStream(filePath)
                .pipe((0, csv_parse_1.parse)({ columns: true, skip_empty_lines: true, trim: true }))
                .on('data', (data) => rows.push(data))
                .on('end', () => resolve())
                .on('error', (error) => reject(error));
        });
        const errors = [];
        const preparedRows = [];
        rows.forEach((row, index) => {
            const fullName = (row.fullName || row.name || '').trim();
            const email = (row.email || '').trim().toLowerCase();
            const whatsapp = (row.whatsapp || row.phone || row.mobile || '').trim();
            const statusValue = (row.status || 'NEW').trim().toUpperCase();
            if (!fullName || !email || !whatsapp) {
                errors.push({ row: index + 2, error: 'fullName/name, email, and whatsapp/phone/mobile are required' });
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
                whatsapp,
                businessName: (row.businessName || row.company || '').trim() || undefined,
                serviceInterest: (row.serviceInterest || '').trim() || undefined,
                message: (row.message || '').trim() || undefined,
                status: statusValue
            });
        });
        const importResult = await prisma_1.default.lead.createMany({
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
exports.importCSV = importCSV;
const exportExcel = async (req, res) => {
    try {
        const status = String(req.query.status || '').trim().toUpperCase();
        const segmentId = String(req.query.segmentId || '').trim();
        if (status && !ALLOWED_STATUSES.includes(status)) {
            return res.status(400).json({ error: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}` });
        }
        const leads = await prisma_1.default.lead.findMany({
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
exports.exportExcel = exportExcel;
