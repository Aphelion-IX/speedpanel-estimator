// =============================================================================
// Table
// =============================================================================
// Generic shared table -- replaces the raw <table> markup duplicated across
// ~10 files (AdminUsersPage, AdminRolesPage, repeatableRowEditor,
// OrderLineItemsTable, LineItemAllocationTable, ProformaInvoicePage,
// QuickOrderPage, wallsCard, wallConfig, scheduleCards). Columns are a
// render-prop (`cell`) rather than a plain field accessor so callers that
// need an editable input per cell (the calculator's wall-config tables) can
// still use this instead of hand-rolling their own <table>.
// =============================================================================
export type TableColumn<T> = {
  key: string;
  header: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  cell: (row: T, index: number) => React.ReactNode;
};

const alignCx = (align: TableColumn<unknown>["align"]) =>
  align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";

export const Table = <T,>({ columns, rows, rowKey, className = "", rowStyle, rowClassName, onRowClick }: {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string | number;
  className?: string;
  // Per-row inline style (e.g. dimming an excluded/cancelled row) -- rare
  // enough not to warrant a whole extra column, common enough (order line
  // items, delivery allocations) to build in once here.
  rowStyle?: (row: T, index: number) => React.CSSProperties | undefined;
  // Per-row extra class (e.g. highlighting the active/selected row) --
  // separate from rowStyle since it needs Tailwind's dark: variants, which
  // inline style can't express.
  rowClassName?: (row: T, index: number) => string | undefined;
  // Makes each row clickable (e.g. WallsSummaryTable's "select this wall")
  // without every caller re-implementing the row/cursor/hover wiring.
  onRowClick?: (row: T, index: number) => void;
}) => (
  <div className={`overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-600 ${className}`}>
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="bg-slate-50 dark:bg-slate-900/60">
          {columns.map(col => (
            <th
              key={col.key}
              className={`border-b border-slate-200 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 dark:border-slate-600 dark:text-slate-300 ${alignCx(col.align)}`}
            >
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={rowKey(row, i)}
            style={rowStyle?.(row, i)}
            onClick={onRowClick ? () => onRowClick(row, i) : undefined}
            className={`border-t border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60 ${onRowClick ? "cursor-pointer" : ""} ${rowClassName?.(row, i) ?? ""}`}
          >
            {columns.map(col => (
              <td key={col.key} className={`px-4 py-3 ${alignCx(col.align)} ${col.align === "right" ? "tabular-nums" : ""} ${col.className ?? ""}`}>
                {col.cell(row, i)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
