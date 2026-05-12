export default function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="crm-card p-8 text-center">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-[var(--muted)]">{description}</p>
    </div>
  );
}
