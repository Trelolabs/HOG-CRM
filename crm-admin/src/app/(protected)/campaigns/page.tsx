'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/apiClient';
import type { Campaign, Segment } from '@/lib/types';
import PageHeader from '@/components/ui/PageHeader';
import Badge from '@/components/ui/Badge';
import DataTable from '@/components/ui/DataTable';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import TextArea from '@/components/ui/TextArea';
import Button from '@/components/ui/Button';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [form, setForm] = useState({
    type: 'EMAIL',
    name: '',
    subject: '',
    content: '',
    segmentId: '',
  });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const load = useCallback(async () => {
    const [campaignData, segmentData] = await Promise.all([
      apiClient.get<Campaign[]>('/api/campaigns'),
      apiClient.get<Segment[]>('/api/segments'),
    ]);
    setCampaigns(campaignData);
    setSegments(segmentData);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load().catch(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      setCreating(true);
      setErrorMessage('');
      await apiClient.post('/api/campaigns', form);
      setForm({ type: 'EMAIL', name: '', subject: '', content: '', segmentId: '' });
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create campaign');
    } finally {
      setCreating(false);
    }
  };

  const sendCampaign = async (id: string) => {
    try {
      setSendingId(id);
      setErrorMessage('');
      await apiClient.post(`/api/campaigns/${id}/send`, {});
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to send campaign');
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div>
      <PageHeader title="Campaigns" subtitle="Compose and send email/SMS campaigns." />
      {errorMessage ? <p className="mb-3 text-sm text-red-600">{errorMessage}</p> : null}
      <form className="crm-card mb-4 grid gap-3 p-4 md:grid-cols-2" onSubmit={onSubmit}>
        <Select value={form.type} onChange={(e) => setForm((s) => ({ ...s, type: e.target.value }))}>
          <option value="EMAIL">EMAIL</option>
          <option value="SMS">SMS</option>
        </Select>
        <Input placeholder="Campaign name" value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
        <Input placeholder="Subject (optional)" value={form.subject} onChange={(e) => setForm((s) => ({ ...s, subject: e.target.value }))} />
        <Select
          value={form.segmentId}
          onChange={(e) => setForm((s) => ({ ...s, segmentId: e.target.value }))}
        >
          <option value="">Select segment</option>
          {segments.map((segment) => (
            <option key={segment.id} value={segment.id}>
              {segment.name}
            </option>
          ))}
        </Select>
        <TextArea className="md:col-span-2" placeholder="Campaign content" value={form.content} onChange={(e) => setForm((s) => ({ ...s, content: e.target.value }))} />
        <Button className="md:col-span-2" type="submit" loading={creating}>
          Create campaign
        </Button>
      </form>
      <DataTable
        headers={['Name', 'Type', 'Segment', 'Status', 'Actions']}
        loading={loading}
        rows={campaigns.map((campaign) => [
          campaign.name,
          campaign.type,
          campaign.segment?.name || '-',
          <Badge key={`${campaign.id}-status`} value={campaign.status} />,
          <Button
            key={campaign.id}
            variant="ghost"
            onClick={() => sendCampaign(campaign.id)}
            loading={sendingId === campaign.id}
          >
            Send
          </Button>,
        ])}
      />
    </div>
  );
}
