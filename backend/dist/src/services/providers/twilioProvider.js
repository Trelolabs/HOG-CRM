"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwilioProvider = void 0;
const twilio_1 = __importDefault(require("twilio"));
class TwilioProvider {
    client;
    fromPhoneNumber;
    constructor(accountSid, authToken, fromPhoneNumber) {
        this.client = (0, twilio_1.default)(accountSid, authToken);
        this.fromPhoneNumber = fromPhoneNumber;
    }
    async sendSms(payload) {
        const response = await this.client.messages.create({
            from: this.fromPhoneNumber,
            to: payload.to,
            body: payload.body
        });
        return { providerMessageId: response.sid };
    }
}
exports.TwilioProvider = TwilioProvider;
