import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import leadRoutes from './routes/leadRoutes';
import segmentRoutes from './routes/segmentRoutes';
import campaignRoutes from './routes/campaignRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import toolRoutes from './routes/toolRoutes';

export const createApp = () => {
    const app = express();
    const allowedOrigins = (process.env.CORS_ORIGIN || '*')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);

    app.use(
        cors({
            origin: allowedOrigins.includes('*') ? '*' : allowedOrigins
        })
    );
    app.use(bodyParser.json({ limit: '1mb' }));
    app.use(bodyParser.urlencoded({ extended: true, limit: '1mb' }));

    app.use('/api/leads', leadRoutes);
    app.use('/api/segments', segmentRoutes);
    app.use('/api/campaigns', campaignRoutes);
    app.use('/api/dashboard', dashboardRoutes);
    app.use('/api/tools', toolRoutes);

    app.get('/health', (req, res) => {
        res.json({ status: 'OK', message: 'CRM API is running smoothly' });
    });

    app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
        console.error('Unhandled error:', err.message);
        res.status(500).json({ error: 'Internal Server Error' });
    });

    return app;
};
