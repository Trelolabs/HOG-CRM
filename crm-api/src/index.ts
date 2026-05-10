import dotenv from 'dotenv';
import { createApp } from './app';

dotenv.config();

const requiredEnvVars = ['DATABASE_URL', 'CRM_ADMIN_USERNAME', 'CRM_ADMIN_PASSWORD'] as const;
const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

const port = Number(process.env.PORT || 4000);
const app = createApp();

app.listen(port, () => {
    console.log(`
🚀 CRM API Server is live!
-----------------------------------
Port: ${port}
Environment: ${process.env.NODE_ENV || 'development'}
Admin URL: http://localhost:${port}/api
-----------------------------------
    `);
});
