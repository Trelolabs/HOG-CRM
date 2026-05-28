'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/apiClient';
import type { Lead } from '@/lib/types';
import PageHeader from '@/components/ui/PageHeader';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';

export default function DashboardPage() {
  const [recentLeads, setRecentLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState({
    totalLeads: 0,
    qualifiedLeads: 0,
    contactedLeads: 0,
    sentCampaigns: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<{ stats: typeof stats; recentLeads: Lead[] }>('/api/dashboard/overview')
      .then((response) => {
        setStats(response.stats);
        setRecentLeads(response.recentLeads || []);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader title="Dashboard Overview" subtitle="Snapshot of lead and campaign activity." />
      <div className="mb-4 grid gap-4 md:grid-cols-4">
        <StatCard label="Total Leads" value={stats.totalLeads} />
        <StatCard label="Qualified Leads" value={stats.qualifiedLeads} />
        <StatCard label="Contacted Leads" value={stats.contactedLeads} />
        <StatCard label="Sent Campaigns" value={stats.sentCampaigns} />
      </div>
      <div className="crm-card p-4">
        <h3 className="mb-3 font-semibold">Recent Leads</h3>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-[var(--muted)]">
            <Spinner dark />
            Loading dashboard data...
          </div>
        ) : (
          <div className="space-y-2">
            {recentLeads.map((lead) => (
              <div key={lead.id} className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                <div>
                  <p className="font-medium">{lead.fullName}</p>
                  <p className="text-xs text-[var(--muted)]">{lead.email}</p>
                </div>
                <Badge value={lead.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="crm-card p-4">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}
