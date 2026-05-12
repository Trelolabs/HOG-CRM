import sgMail from '@sendgrid/mail';
import { EmailProvider, EmailSendRequest, ProviderSendResult } from './types';

export class SendGridProvider implements EmailProvider {
    private readonly fromEmail: string;

    constructor(apiKey: string, fromEmail: string) {
        sgMail.setApiKey(apiKey);
        this.fromEmail = fromEmail;
    }

    async sendEmail(payload: EmailSendRequest): Promise<ProviderSendResult> {
        const [response] = await sgMail.send({
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
