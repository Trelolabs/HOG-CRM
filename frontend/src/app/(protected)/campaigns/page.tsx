'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/apiClient';
import type { Campaign, Lead, ComposeData } from '@/lib/types';
import PageHeader from '@/components/ui/PageHeader';
import Badge from '@/components/ui/Badge';
import DataTable from '@/components/ui/DataTable';
import Button from '@/components/ui/Button';
import ComposeModal from '@/components/ComposeModal';
import UploadModal from '@/components/UploadModal';

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

      toast.success(`Sending emails to ${response.count} contacts...`);
      await loadCampaigns();
      setSelectedIds(new Set());
      setContacts([]);
      setSegmentName('');
      setSegmentId('');
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
      <div className="border-b border-gray-700 flex gap-6">
        <button
          onClick={() => setActiveTab('contacts')}
          className={`pb-3 font-medium transition-colors ${
            activeTab === 'contacts'
              ? 'border-b-2 border-blue-500 text-white'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Contacts {contacts.length > 0 && `(${contacts.length})`}
        </button>
        <button
          onClick={() => setActiveTab('campaigns')}
          className={`pb-3 font-medium transition-colors ${
            activeTab === 'campaigns'
              ? 'border-b-2 border-blue-500 text-white'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Campaigns {campaigns.length > 0 && `(${campaigns.length})`}
        </button>
      </div>

      {/* CONTACTS TAB */}
      {activeTab === 'contacts' && (
        <div className="space-y-4">
          {contacts.length === 0 ? (
            <div className="crm-card p-12 text-center">
              <p className="text-gray-400 mb-4">No contacts imported yet</p>
              <Button onClick={() => setShowUpload(true)}>Upload Contacts</Button>
            </div>
          ) : (
            <>
              {/* Toolbar */}
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
                  <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-gray-700">
                    <tr>
                      <th className="px-4 py-3 w-12">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === contacts.length && contacts.length > 0}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="w-4 h-4"
                        />
                      </th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Phone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((contact) => (
                      <tr key={contact.id} className="border-b border-gray-700 hover:bg-gray-800/30">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(contact.id)}
                            onChange={(e) => handleSelectContact(contact.id, e.target.checked)}
                            className="w-4 h-4"
                          />
                        </td>
                        <td className="px-4 py-3 text-blue-400">{contact.email}</td>
                        <td className="px-4 py-3">{contact.fullName || '—'}</td>
                        <td className="px-4 py-3 text-gray-400">{contact.whatsapp || '—'}</td>
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
