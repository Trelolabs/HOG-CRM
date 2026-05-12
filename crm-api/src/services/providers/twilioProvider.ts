import twilio from 'twilio';
import { SmsProvider, SmsSendRequest, ProviderSendResult } from './types';

export class TwilioProvider implements SmsProvider {
    private readonly client: ReturnType<typeof twilio>;
    private readonly fromPhoneNumber: string;

    constructor(accountSid: string, authToken: string, fromPhoneNumber: string) {
        this.client = twilio(accountSid, authToken);
        this.fromPhoneNumber = fromPhoneNumber;
    }

    async sendSms(payload: SmsSendRequest): Promise<ProviderSendResult> {
        const response = await this.client.messages.create({
            from: this.fromPhoneNumber,
            to: payload.to,
            body: payload.body
        });

        return { providerMessageId: response.sid };
    }
}
