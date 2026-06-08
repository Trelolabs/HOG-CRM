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
console.log('[Startup] Initializing workers...');
Promise.resolve().then(() => __importStar(require('./workers/uploadWorker'))).then(() => console.log('[Startup] UploadWorker initialized')).catch(err => console.error('[Startup] UploadWorker failed:', err));
Promise.resolve().then(() => __importStar(require('./workers/emailWorker'))).then(() => console.log('[Startup] EmailWorker initialized')).catch(err => console.error('[Startup] EmailWorker failed:', err));
Promise.resolve().then(() => __importStar(require('./workers/smsWorker'))).then(() => console.log('[Startup] SMSWorker initialized')).catch(err => console.error('[Startup] SMSWorker failed:', err));
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
