import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';

const mockPrisma = vi.hoisted(() => ({
    lead: {
        create: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        createMany: vi.fn(),
        updateMany: vi.fn()
    },
    segment: {
        findMany: vi.fn(),
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn()
    },
    campaign: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        deleteMany: vi.fn()
    },
    $transaction: vi.fn()
}));

vi.mock('../src/utils/prisma', () => ({
    default: mockPrisma
}));

const basicAuth = `Basic ${Buffer.from('admin:secret').toString('base64')}`;

describe('CRM API endpoints', () => {
    beforeEach(() => {
        process.env.CRM_ADMIN_USERNAME = 'admin';
        process.env.CRM_ADMIN_PASSWORD = 'secret';
        vi.clearAllMocks();
    });

    it('blocks protected endpoint without auth', async () => {
        const app = createApp();
        const response = await request(app).get('/api/leads');
        expect(response.status).toBe(401);
    });

    it('creates lead via public endpoint', async () => {
        mockPrisma.lead.create.mockResolvedValue({
            id: 'lead_1',
            fullName: 'Alex Admin',
            email: 'alex@example.com'
        });

        const app = createApp();
        const response = await request(app).post('/api/leads').send({
            fullName: 'Alex Admin',
            email: 'alex@example.com',
            whatsapp: '+1234567890'
        });

        expect(response.status).toBe(201);
        expect(response.body.email).toBe('alex@example.com');
    });

    it('rejects lead creation without mobile number', async () => {
        const app = createApp();
        const response = await request(app).post('/api/leads').send({
            fullName: 'Alex Admin',
            email: 'alex@example.com'
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('mobile number');
    });

    it('returns paginated leads for admin', async () => {
        mockPrisma.lead.findMany.mockResolvedValue([{ id: 'lead_1', email: 'alex@example.com' }]);
        mockPrisma.lead.count.mockResolvedValue(1);

        const app = createApp();
        const response = await request(app)
            .get('/api/leads?page=1&limit=10&search=alex')
            .set('Authorization', basicAuth);

        expect(response.status).toBe(200);
        expect(response.body.meta.total).toBe(1);
        expect(response.body.data).toHaveLength(1);
    });

    it('updates lead status and segment', async () => {
        mockPrisma.segment.findUnique.mockResolvedValue({ id: 'seg_1' });
        mockPrisma.lead.update.mockResolvedValue({
            id: 'lead_1',
            status: 'QUALIFIED',
            segmentId: 'seg_1'
        });

        const app = createApp();
        const response = await request(app)
            .patch('/api/leads/lead_1')
            .set('Authorization', basicAuth)
            .send({ status: 'QUALIFIED', segmentId: 'seg_1' });

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('QUALIFIED');
    });

    it('creates and updates segment', async () => {
        mockPrisma.segment.create.mockResolvedValue({ id: 'seg_1', name: 'SMB' });
        mockPrisma.segment.update.mockResolvedValue({ id: 'seg_1', name: 'SMB Updated' });

        const app = createApp();
        const createResponse = await request(app)
            .post('/api/segments')
            .set('Authorization', basicAuth)
            .send({ name: 'SMB' });

        const updateResponse = await request(app)
            .patch('/api/segments/seg_1')
            .set('Authorization', basicAuth)
            .send({ name: 'SMB Updated' });

        expect(createResponse.status).toBe(201);
        expect(updateResponse.status).toBe(200);
        expect(updateResponse.body.name).toBe('SMB Updated');
    });

    it('creates and sends campaign', async () => {
        mockPrisma.segment.findUnique.mockResolvedValue({ id: 'seg_1', name: 'SMB' });
        mockPrisma.campaign.create.mockResolvedValue({
            id: 'camp_1',
            type: 'EMAIL',
            status: 'DRAFT',
            segmentId: 'seg_1',
            name: 'Launch',
            subject: 'Launch',
            content: 'Campaign content'
        });
        mockPrisma.campaign.findUnique.mockResolvedValue({
            id: 'camp_1',
            type: 'EMAIL',
            status: 'DRAFT',
            segmentId: 'seg_1',
            name: 'Launch',
            subject: 'Launch',
            content: 'Campaign content'
        });
        mockPrisma.lead.findMany.mockResolvedValue([{ email: 'alex@example.com' }]);
        mockPrisma.campaign.update.mockResolvedValue({
            id: 'camp_1',
            type: 'EMAIL',
            status: 'SENT'
        });

        const app = createApp();
        const createResponse = await request(app)
            .post('/api/campaigns')
            .set('Authorization', basicAuth)
            .send({
                type: 'EMAIL',
                name: 'Launch',
                segmentId: 'seg_1',
                content: 'Campaign content'
            });

        const sendResponse = await request(app)
            .post('/api/campaigns/camp_1/send')
            .set('Authorization', basicAuth);

        expect(createResponse.status).toBe(201);
        expect(sendResponse.status).toBe(200);
        expect(sendResponse.body.campaign.status).toBe('SENT');
    });

    it('validates csv import and exports xlsx', async () => {
        mockPrisma.lead.findMany.mockResolvedValue([
            {
                id: 'lead_1',
                fullName: 'Alex',
                email: 'alex@example.com',
                whatsapp: '+1234567890',
                businessName: null,
                serviceInterest: null,
                status: 'NEW',
                segment: null,
                createdAt: new Date()
            }
        ]);

        const app = createApp();
        const importResponse = await request(app)
            .post('/api/tools/import')
            .set('Authorization', basicAuth);

        const exportResponse = await request(app)
            .get('/api/tools/export')
            .set('Authorization', basicAuth);

        expect(importResponse.status).toBe(400);
        expect(exportResponse.status).toBe(200);
        expect(exportResponse.headers['content-type']).toContain(
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
    });
});
