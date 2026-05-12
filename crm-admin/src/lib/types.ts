export type LeadStatus = 'NEW' | 'QUALIFIED' | 'CONTACTED' | 'CLOSED';

export interface Segment {
  id: string;
  name: string;
  description?: string | null;
  _count?: { leads: number };
}

export interface Lead {
  id: string;
  fullName: string;
  email: string;
  whatsapp?: string | null;
  businessName?: string | null;
  serviceInterest?: string | null;
  message?: string | null;
  status: LeadStatus;
  segmentId?: string | null;
  segment?: Segment | null;
  createdAt?: string;
}

export interface Campaign {
  id: string;
  type: 'EMAIL' | 'SMS';
  name: string;
  subject?: string | null;
  content: string;
  segmentId: string;
  status: 'DRAFT' | 'SCHEDULED' | 'SENT' | 'FAILED';
  sentAt?: string | null;
  providerMessageId?: string | null;
  failureReason?: string | null;
  attemptedRecipients?: number;
  sentRecipients?: number;
  segment?: Segment;
}
