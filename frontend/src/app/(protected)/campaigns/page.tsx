'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/apiClient';
import type { Campaign, Lead, Segment, ComposeData } from '@/lib/types';
import PageHeader from '@/components/ui/PageHeader';
import Badge from '@/components/ui/Badge';
import DataTable from '@/components/ui/DataTable';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ComposeModal from '@/components/ComposeModal';
import UploadModal from '@/components/UploadModal';
import { Search, Plus, Upload, Users, ChevronRight } from 'lucide-react';

export default function CampaignsPage() {
  const [activeTab, setActiveTab] = useState<'contacts' | 'campaigns'>('contacts');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [contacts, setContacts] = useState<Lead[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [segmentName, setSegmentName] = useState<string>('');
  const [segmentId, setSegmentId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadingContacts, setLoadingContacts] = useState(false);
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
    } catch { /* silent */ }
  }, []);

  const loadSegments = useCallback(async () => {
    try {
      const data = await apiClient.get<Segment[]>('/api/segments');
      setSegments(data);
    } catch { /* silent */ }
  }, []);

  const loadContactsForSegment = useCallback(async (id: string, name: string) => {
    setLoadingContacts(true);
    setSegmentId(id);
    setSegmentName(name);
    setSearchQuery('');
    setSelectedIds(new Set());
    try {
      const res = await apiClient.get<{ data: Lead[] }>(`/api/leads?segmentId=${id}&limit=1000`);
      const leads = res.data || [];
      setContacts(leads);
      setSelectedIds(new Set(leads.map((c: Lead) => c.id)));
    } catch {
      toast.error('Failed to load contacts');
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      Promise.all([loadCampaigns(), loadSegments()]).finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadCampaigns, loadSegments]);

  const handleUploadedContacts = (newContacts: Lead[], newSegmentName: string, newSegmentId: string) => {
    setContacts(newContacts);
    setSegmentName(newSegmentName);
    setSegmentId(newSegmentId);
    setSelectedIds(new Set(newContacts.map(c => c.id)));
    setActiveTab('contacts');
    loadSegments();
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredContacts.map(c => c.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectContact = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) newSet.add(id);
    else newSet.delete(id);
    setSelectedIds(newSet);
  };

  const handleAddEmail = async () => {
    if (!segmentId) {
      toast.error('Select a list first');
      return;
    }
    const email = addEmailInput.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      toast.error('Enter valid email (e.g., user@example.com)');
      return;
    }
    setAddingEmail(true);
    try {
      await apiClient.post('/api/campaigns/import', {
        contacts: [{ email, fullName: '', whatsapp: '' }],
        segmentName: segmentName || 'Manual',
        segmentId: segmentId,
      });
      const res = await apiClient.get<{ data: Lead[] }>(`/api/leads?segmentId=${segmentId}&limit=1000`);
      setContacts(res.data || []);
      setAddEmailInput('');
      loadSegments();
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
    if (selectedIds.size === 0) { toast.error('No contacts selected'); return; }
    if (!segmentId) { toast.error('No segment selected'); return; }

    setSendingCampaign(true);
    try {
      const response = await apiClient.post<any>('/api/campaigns/send-direct', {
        subject: composeData.subject,
        content: composeData.content,
        leadIds: Array.from(selectedIds),
        segmentId,
        attachments: composeData.attachments.length > 0 ? composeData.attachments : undefined,
      });
      toast.success(`Sending to ${response.count} contacts. Campaign created!`);
      await loadCampaigns();
      setSelectedIds(new Set());
      // Refresh contacts to show CONTACTED status
      await loadContactsForSegment(segmentId, segmentName);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send emails');
    } finally {
      setSendingCampaign(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Campaign Manager"
        subtitle="Upload contact lists and send targeted emails"
        action={
          <Button onClick={() => setShowUpload(true)}>
            <Upload className="w-4 h-4" /> Upload File
          </Button>
        }
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
              ? `Contacts${segments.length > 0 ? ` (${segments.length} lists)` : ''}`
              : `Campaigns${campaigns.length > 0 ? ` (${campaigns.length})` : ''}`}
          </button>
        ))}
      </div>

      {/* CONTACTS TAB */}
      {activeTab === 'contacts' && (
        <div className="grid grid-cols-[260px_1fr] gap-4 items-start">

          {/* LEFT: Segment List */}
          <div className="crm-card overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
              <span className="text-sm font-semibold text-[var(--foreground)]">Lists</span>
              <button
                onClick={() => setShowUpload(true)}
                className="flex items-center gap-1 text-xs text-[var(--primary)] hover:opacity-80 font-semibold"
              >
                <Plus className="w-3.5 h-3.5" /> Upload
              </button>
            </div>

            {loading ? (
              <div className="p-4 text-center text-sm text-[var(--muted)]">Loading...</div>
            ) : segments.length === 0 ? (
              <div className="p-6 text-center">
                <Upload className="w-8 h-8 text-[var(--muted)] mx-auto mb-2" />
                <p className="text-xs text-[var(--muted)]">No lists yet. Upload a file to start.</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {segments.map(seg => {
                  const isActive = seg.id === segmentId;
                  return (
                    <button
                      key={seg.id}
                      onClick={() => loadContactsForSegment(seg.id, seg.name)}
                      className={`w-full text-left px-4 py-3 transition-colors flex items-center justify-between group ${
                        isActive ? 'bg-[var(--primary)]/5 border-l-2 border-[var(--primary)]' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold truncate ${isActive ? 'text-[var(--primary)]' : 'text-[var(--foreground)]'}`}>
                          {seg.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Users className="w-3 h-3 text-[var(--muted)]" />
                          <span className="text-xs text-[var(--muted)]">
                            {seg._count?.leads ?? 0} leads
                          </span>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[var(--primary)]' : 'text-[var(--muted)] opacity-0 group-hover:opacity-100'} transition-opacity`} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT: Contacts Panel */}
          <div className="space-y-3">
            {!segmentId ? (
              <div className="crm-card p-16 text-center">
                <Users className="w-12 h-12 text-[var(--muted)] mx-auto mb-3" />
                <p className="text-sm font-semibold text-[var(--foreground)] mb-1">Select a list</p>
                <p className="text-xs text-[var(--muted)]">Choose a list from the left or upload a new file</p>
              </div>
            ) : loadingContacts ? (
              <div className="crm-card p-16 text-center text-sm text-[var(--muted)]">Loading contacts...</div>
            ) : (
              <>
                {/* Segment header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-[var(--foreground)]">{segmentName}</h2>
                    <p className="text-xs text-[var(--muted)]">{contacts.length} contacts</p>
                  </div>
                </div>

                {/* Search + Add Email */}
                <div className="crm-card p-3 flex gap-3 items-center">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search emails..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="crm-input w-full pl-9 py-2"
                    />
                  </div>
                  <input
                    type="email"
                    placeholder="Add email..."
                    value={addEmailInput}
                    onChange={(e) => setAddEmailInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddEmail()}
                    className="crm-input w-44 py-2"
                  />
                  <Button onClick={handleAddEmail} loading={addingEmail}>
                    <Plus className="w-4 h-4" /> Add
                  </Button>
                </div>

                {/* Action Bar */}
                <div className="crm-card px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === filteredContacts.length && filteredContacts.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium">All</span>
                    </label>
                    <span className="text-sm text-[var(--muted)]">
                      {selectedIds.size} of {filteredContacts.length} selected
                      {searchQuery && ` (filtered)`}
                    </span>
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
                {filteredContacts.length === 0 ? (
                  <div className="crm-card p-8 text-center text-sm text-[var(--muted)]">
                    {searchQuery ? 'No results match your search' : 'No contacts in this list'}
                  </div>
                ) : (
                  <div className="crm-card overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[var(--background)] border-b border-[var(--border)]">
                        <tr>
                          <th className="px-4 py-3 w-10">
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
                        {filteredContacts.map(contact => (
                          <tr key={contact.id} className="border-b border-[var(--border)] hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-2.5">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(contact.id)}
                                onChange={(e) => handleSelectContact(contact.id, e.target.checked)}
                                className="w-4 h-4"
                              />
                            </td>
                            <td className="px-4 py-2.5 text-blue-600 font-medium">{contact.email}</td>
                            <td className="px-4 py-2.5 text-[var(--foreground)]">{contact.fullName || '—'}</td>
                            <td className="px-4 py-2.5"><Badge value={contact.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* CAMPAIGNS TAB */}
      {activeTab === 'campaigns' && (
        <div className="crm-card overflow-hidden">
          {campaigns.length === 0 ? (
            <div className="p-16 text-center">
              <p className="text-sm text-[var(--muted)]">No campaigns sent yet</p>
            </div>
          ) : (
            <DataTable
              headers={['Name', 'Type', 'Attempted', 'Sent', 'Status', 'Date']}
              loading={loading}
              rows={campaigns.map(campaign => [
                campaign.name,
                campaign.type,
                campaign.attemptedRecipients ?? '—',
                campaign.sentRecipients ?? '—',
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
