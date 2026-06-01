"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const app_1 = require("./app");
const campaignService_1 = require("./services/campaignService");
dotenv_1.default.config();
const requiredEnvVars = ['DATABASE_URL', 'CRM_ADMIN_USERNAME', 'CRM_ADMIN_PASSWORD'];
const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);
if (missingEnvVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}
(0, campaignService_1.validateCampaignProviderConfig)();
// Initialize Workers
require("./workers/uploadWorker");
require("./workers/emailWorker");
const port = Number(process.env.PORT || 4000);
const app = (0, app_1.createApp)();
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
