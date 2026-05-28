"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
const leadRoutes_1 = __importDefault(require("./routes/leadRoutes"));
const segmentRoutes_1 = __importDefault(require("./routes/segmentRoutes"));
const campaignRoutes_1 = __importDefault(require("./routes/campaignRoutes"));
const dashboardRoutes_1 = __importDefault(require("./routes/dashboardRoutes"));
const toolRoutes_1 = __importDefault(require("./routes/toolRoutes"));
const createApp = () => {
    const app = (0, express_1.default)();
    const allowedOrigins = (process.env.CORS_ORIGIN || '*')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
    app.use((0, cors_1.default)({
        origin: allowedOrigins.includes('*') ? '*' : allowedOrigins
    }));
    app.use(body_parser_1.default.json({ limit: '1mb' }));
    app.use(body_parser_1.default.urlencoded({ extended: true, limit: '1mb' }));
    app.use('/api/leads', leadRoutes_1.default);
    app.use('/api/segments', segmentRoutes_1.default);
    app.use('/api/campaigns', campaignRoutes_1.default);
    app.use('/api/dashboard', dashboardRoutes_1.default);
    app.use('/api/tools', toolRoutes_1.default);
    app.get('/health', (req, res) => {
        res.json({ status: 'OK', message: 'CRM API is running smoothly' });
    });
    app.use((err, req, res, next) => {
        console.error('Unhandled error:', err.message);
        res.status(500).json({ error: 'Internal Server Error' });
    });
    return app;
};
exports.createApp = createApp;
