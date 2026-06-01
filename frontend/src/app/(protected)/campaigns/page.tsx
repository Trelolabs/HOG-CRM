'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/apiClient';
import type { Campaign, Lead, ComposeData } from '@/lib/types';
import PageHeader from '@/components/ui/PageHeader';
import Badge from '@/components/ui/Badge';
import DataTable from '@/components/ui/DataTable';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import EmptyState from '@/components/ui/EmptyState';
import ComposeModal from '@/components/ComposeModal';
import UploadModal from '@/components/UploadModal';
import { Search, Plus } from 'lucide-react';

export default function CampaignsPage() {
  const [activeTab, setActiveTab] = useState<'contacts' | 'campaigns'>('contacts');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [contacts, setContacts] = useState<Lead[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [segmentName, setSegmentName] = useState<string>('');
  const [segmentId, setSegmentId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [sendingCampaign, setSendingCampaign] = useState(false);

  const [showUpload, setShowUpload] = useState(false);
  const [showCompose, setShowCompose] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [addEmailInput, setAddEmailInput] = useState('');
  const [addingEmail, setAddingEmail] = useState(false);

  const loadCampaigns = useCallback(async () => {
    try {
      const data = await apiClient.get<Campaign[]>('/api/campaigns');
      setCampaigns(data);
    } catch (err) {
      console.error('Failed to load campaigns', err);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadCampaigns().finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadCampaigns]);

  const handleUploadedContacts = (newContacts: Lead[], newSegmentName: string, newSegmentId: string) => {
    setContacts(newContacts);
    setSegmentName(newSegmentName);
    setSegmentId(newSegmentId);
    setSelectedIds(new Set(newContacts.map(c => c.id)));
    setActiveTab('contacts');
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(contacts.map(c => c.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectContact = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const handleAddEmail = async () => {
    const email = addEmailInput.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      toast.error('Invalid email format');
      return;
    }
    setAddingEmail(true);
    try {
      await apiClient.post('/api/campaigns/import', {
        contacts: [{ email, fullName: '', whatsapp: '' }],
        segmentName: segmentName || 'Manual',
        segmentId: segmentId || undefined,
      });
      const res = await apiClient.get<{ data: Lead[] }>(`/api/leads?segmentId=${segmentId}&limit=1000`);
      setContacts(res.data || []);
      setAddEmailInput('');
      toast.success('Email added');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add email');
    } finally {
      setAddingEmail(false);
    }
  };

  const filteredContacts = contacts.filter(c =>
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSendEmail = async (composeData: ComposeData) => {
    if (selectedIds.size === 0) {
      toast.error('No contacts selected');
      return;
    }

    if (!segmentId) {
      toast.error('No segment selected');
      return;
    }

    setSendingCampaign(true);
    try {
      const response = await apiClient.post<any>('/api/campaigns/send-direct', {
        subject: composeData.subject,
        content: composeData.content,
        leadIds: Array.from(selectedIds),
        segmentId,
        attachments: composeData.attachments.length > 0 ? composeData.attachments : undefined,
      });

      toast.success(`Sending emails to ${response.count} contacts. Campaign created!`);
      await loadCampaigns();
      setSelectedIds(new Set());
    } catch (err: any) {
      toast.error(err.message || 'Failed to send emails');
    } finally {
      setSendingCampaign(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="📧 Campaign Manager"
        subtitle="Import contacts and send targeted mass emails"
        action={<Button onClick={() => setShowUpload(true)}>☁ Upload Contacts</Button>}
      />

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[var(--background)] rounded-xl border border-[var(--border)] w-fit">
        {(['contacts', 'campaigns'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab
                ? 'bg-white border border-[var(--border)] text-[var(--foreground)] shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            {tab === 'contacts'
              ? `Contacts${contacts.length > 0 ? ` (${contacts.length})` : ''}`
              : `Campaigns${campaigns.length > 0 ? ` (${campaigns.length})` : ''}`}
          </button>
        ))}
      </div>


      {/* CONTACTS TAB */}
      {activeTab === 'contacts' && (
        <div className="space-y-4">
          {contacts.length === 0 ? (
            <EmptyState>
              Upload a file or add emails manually to get started
            </EmptyState>
          ) : (
            <>
              {/* Search + Add Email Toolbar */}
              <div className="crm-card p-4 flex gap-4 items-center justify-between">
                <div className="flex-1 flex gap-2">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--muted)] w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search emails..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="crm-input w-full pl-9"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="Enter email..."
                    value={addEmailInput}
                    onChange={(e) => setAddEmailInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddEmail()}
                    className="crm-input w-48"
                  />
                  <Button onClick={handleAddEmail} loading={addingEmail} className="flex gap-1">
                    <Plus className="w-4 h-4" /> Add
                  </Button>
                </div>
              </div>

              {/* Action Bar */}
              <div className="crm-card p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === contacts.length && contacts.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium">All</span>
                  </label>
                  <span className="text-sm text-gray-400">
                    {selectedIds.size} of {contacts.length} selected
                  </span>
                  {segmentName && (
                    <span className="text-sm text-gray-400">
                      • Segment: <span className="font-medium">{segmentName}</span>
                    </span>
                  )}
                </div>
                <Button
                  onClick={() => setShowCompose(true)}
                  disabled={selectedIds.size === 0 || sendingCampaign}
                  loading={sendingCampaign}
                >
                  ✉ Send Email
                </Button>
              </div>

              {/* Table */}
              <div className="crm-card overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--background)] border-b border-[var(--border)]">
                    <tr>
                      <th className="px-4 py-3 w-12">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === filteredContacts.length && filteredContacts.length > 0}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="w-4 h-4"
                        />
                      </th>
                      <th className="px-4 py-3 font-semibold text-[var(--foreground)]">Email</th>
                      <th className="px-4 py-3 font-semibold text-[var(--foreground)]">Name</th>
                      <th className="px-4 py-3 font-semibold text-[var(--foreground)]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContacts.map((contact) => (
                      <tr key={contact.id} className="border-b border-[var(--border)] hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(contact.id)}
                            onChange={(e) => handleSelectContact(contact.id, e.target.checked)}
                            className="w-4 h-4"
                          />
                        </td>
                        <td className="px-4 py-3 text-blue-600 font-medium">{contact.email}</td>
                        <td className="px-4 py-3 text-[var(--foreground)]">{contact.fullName || '—'}</td>
                        <td className="px-4 py-3"><Badge value={contact.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* CAMPAIGNS TAB */}
      {activeTab === 'campaigns' && (
        <div className="crm-card p-4">
          {campaigns.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-400">No campaigns sent yet</p>
            </div>
          ) : (
            <DataTable
              headers={['Name', 'Type', 'Recipients', 'Status', 'Sent At']}
              loading={loading}
              rows={campaigns.map((campaign) => [
                campaign.name,
                campaign.type,
                campaign.attemptedRecipients || '—',
                <Badge key={`${campaign.id}-status`} value={campaign.status} />,
                campaign.sentAt ? new Date(campaign.sentAt).toLocaleDateString() : '—',
              ])}
            />
          )}
        </div>
      )}

      {/* MODALS */}
      <UploadModal open={showUpload} onClose={() => setShowUpload(false)} onImported={handleUploadedContacts} />
      <ComposeModal
        open={showCompose}
        recipientCount={selectedIds.size}
        onClose={() => setShowCompose(false)}
        onSend={handleSendEmail}
      />
    </div>
  );
}
