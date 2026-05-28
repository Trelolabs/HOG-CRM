export interface EmailSendRequest {
    to: string;
    subject: string;
    html: string;
}

export interface SmsSendRequest {
    to: string;
    body: string;
}

export interface ProviderSendResult {
    providerMessageId: string;
}

export interface EmailProvider {
    sendEmail(payload: EmailSendRequest): Promise<ProviderSendResult>;
}

export interface SmsProvider {
    sendSms(payload: SmsSendRequest): Promise<ProviderSendResult>;
}
