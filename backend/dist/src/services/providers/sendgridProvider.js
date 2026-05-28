"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SendGridProvider = void 0;
const mail_1 = __importDefault(require("@sendgrid/mail"));
class SendGridProvider {
    fromEmail;
    constructor(apiKey, fromEmail) {
        mail_1.default.setApiKey(apiKey);
        this.fromEmail = fromEmail;
    }
    async sendEmail(payload) {
        const [response] = await mail_1.default.send({
            to: payload.to,
            from: this.fromEmail,
            subject: payload.subject,
            html: payload.html
        });
        return {
            providerMessageId: response.headers['x-message-id'] || `sendgrid-${Date.now()}`
        };
    }
}
exports.SendGridProvider = SendGridProvider;
