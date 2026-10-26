import { cn } from "@/lib/utils";

export function DataTable({
  columns,
  rows,
  caption,
  className,
}: {
  columns: string[];
  rows: React.ReactNode[][];
  caption?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-line bg-white",
        className,
      )}
    >
      <div className="no-scrollbar overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          {caption ? (
            <caption className="border-b border-line bg-soft/60 px-5 py-3 text-left text-[13px] font-medium text-muted">
              {caption}
            </caption>
          ) : null}
          <thead>
            <tr className="border-b border-line bg-soft/40">
              {columns.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="px-5 py-3.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="transition-colors hover:bg-soft/50">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-5 py-4 align-middle text-ink-soft">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
