export default function Badge({ value }: { value: string }) {
  const color =
    value === 'NEW'
      ? 'bg-blue-50 text-blue-700'
      : value === 'QUALIFIED'
      ? 'bg-emerald-50 text-emerald-700'
      : value === 'CONTACTED'
      ? 'bg-amber-50 text-amber-700'
      : value === 'SENT'
      ? 'bg-emerald-50 text-emerald-700'
      : 'bg-zinc-100 text-zinc-700';

  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>{value}</span>;
}
