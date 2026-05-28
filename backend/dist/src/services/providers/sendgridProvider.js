import sgMail from '@sendgrid/mail';
export class SendGridProvider {
    fromEmail;
    constructor(apiKey, fromEmail) {
        sgMail.setApiKey(apiKey);
        this.fromEmail = fromEmail;
    }
    async sendEmail(payload) {
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
