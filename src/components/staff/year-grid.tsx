import type { YearGrid } from "@/lib/record";
import { MONTH_SHORT_NAMES } from "@/lib/fiscal-year";
import { formatHours } from "@/lib/hours";
import { cn } from "@/lib/utils";

const CELL_STYLES = {
  hours: "bg-[var(--session-hours-bg)] text-[var(--session-hours-fg)]",
  TA: "bg-[var(--session-ta-bg)] text-[var(--session-ta-fg)]",
  SA: "bg-[var(--session-sa-bg)] text-[var(--session-sa-fg)]",
  H: "bg-[var(--session-h-bg)] text-[var(--session-h-fg)]",
} as const;

export function YearGridTable({ grid, live }: { grid: YearGrid; live: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] border-collapse text-xs print:min-w-0 print:text-[8px]" aria-label="Hours tutored by day and month">
        <thead>
          <tr>
            <th scope="col" className="w-8 border border-gray-300 bg-gray-50 px-1 py-1 text-center font-medium text-gray-700">
              Day
            </th>
            {grid.columns.map((c) => (
              <th
                key={c.month}
                scope="col"
                className={cn(
                  "relative border border-gray-300 bg-gray-50 px-1 py-1 text-center font-medium text-gray-700",
                  c.source === "none" && "text-gray-400",
                )}
              >
                <span className="block">{MONTH_SHORT_NAMES[c.month - 1]}</span>
                <span className="block text-[9px] font-normal text-gray-400 print:text-[7px]">
                  {c.source === "submitted" ? `v${c.version}` : c.source === "live" ? "live" : "Not submitted"}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 31 }, (_, i) => (
            <tr key={i}>
              <th scope="row" className="border border-gray-300 bg-gray-50 px-1 text-center font-medium text-gray-600 print:py-0 print:leading-[1.15]">
                {i + 1}
              </th>
              {grid.columns.map((c) => {
                const cell = c.cells[i];
                const invalidDay = i + 1 > new Date(c.year, c.month, 0).getDate();
                return (
                  <td
                    key={c.month}
                    className={cn(
                      "h-5 border border-gray-200 px-1 text-center tabular-nums print:h-auto print:py-0 print:leading-[1.15]",
                      invalidDay && "bg-gray-100",
                      cell && (cell.code ? CELL_STYLES[cell.code] : CELL_STYLES.hours),
                      cell && "font-semibold",
                      live && cell && "italic",
                    )}
                  >
                    {cell ? (cell.code ? cell.code : formatHours(cell.hours)) : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className="border border-gray-300 bg-gray-50 px-1 py-1 text-center font-medium text-gray-700">
              Total
            </th>
            {grid.columns.map((c) => (
              <td key={c.month} className="border border-gray-300 bg-gray-50 px-1 py-1 text-center font-semibold tabular-nums text-gray-900">
                {c.source === "none" ? "" : formatHours(c.total)}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
      <p className="mt-2 text-right text-sm text-gray-900 print:mt-1 print:text-xs">
        <span className="font-medium">Total hours for the year:</span> {formatHours(grid.grandTotal)}
      </p>
    </div>
  );
}
