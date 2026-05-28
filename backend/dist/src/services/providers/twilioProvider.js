import twilio from 'twilio';
export class TwilioProvider {
    client;
    fromPhoneNumber;
    constructor(accountSid, authToken, fromPhoneNumber) {
        this.client = twilio(accountSid, authToken);
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
