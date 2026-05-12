import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';

export default function ToolsPage() {
  return (
    <div>
      <PageHeader title="Tools" subtitle="Reserved for future utilities." />
      <EmptyState
        title="No tools enabled yet"
        description="Import and export actions are now available directly in the Leads section."
      />
    </div>
  );
}
