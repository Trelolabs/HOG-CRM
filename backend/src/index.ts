import dotenv from 'dotenv';
import { createApp } from './app';
import { validateCampaignProviderConfig } from './services/campaignService';

dotenv.config();

const requiredEnvVars = ['DATABASE_URL', 'CRM_ADMIN_USERNAME', 'CRM_ADMIN_PASSWORD'] as const;
const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}
validateCampaignProviderConfig();

// Initialize Workers
console.log('[Startup] Initializing workers...');
import('./workers/uploadWorker').then(() => console.log('[Startup] UploadWorker initialized')).catch(err => console.error('[Startup] UploadWorker failed:', err));
import('./workers/emailWorker').then(() => console.log('[Startup] EmailWorker initialized')).catch(err => console.error('[Startup] EmailWorker failed:', err));

const port = Number(process.env.PORT || 4000);
const app = createApp();

app.listen(port, '0.0.0.0', () => {
    console.log(`
🚀 CRM API Server is live!
-----------------------------------
Port: ${port}
Environment: ${process.env.NODE_ENV || 'development'}
Admin URL: http://localhost:${port}/api
-----------------------------------
    `);
});
