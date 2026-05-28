import Spinner from './Spinner';

export default function DataTable({
  headers,
  rows,
  loading = false,
  emptyMessage = 'No records found.',
  headerClassNames = [],
}: {
  headers: string[];
  rows: React.ReactNode[][];
  loading?: boolean;
  emptyMessage?: string;
  headerClassNames?: string[];
}) {
  return (
    <div className="crm-card overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-50">
          <tr>
            {headers.map((header, index) => (
              <th key={header} className={`px-3 py-2 font-medium text-zinc-600 ${headerClassNames[index] || ''}`}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr className="border-t border-[var(--border)]">
              <td className="px-3 py-8 text-center" colSpan={headers.length}>
                <div className="flex items-center justify-center gap-2 text-[var(--muted)]">
                  <Spinner dark />
                  Loading data...
                </div>
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr className="border-t border-[var(--border)]">
              <td className="px-3 py-8 text-center text-[var(--muted)]" colSpan={headers.length}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={index} className="border-t border-[var(--border)]">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-3 py-2">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
