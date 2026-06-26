import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface AnalyticsTableRow {
  /** First-column label (the dimension value, e.g. a query or page path). */
  dimension: string;
  /** Pre-formatted metric cells, aligned with `columns` order. */
  cells: string[];
}

/**
 * Generic right-aligned metrics table. `columns` are the numeric metric headers;
 * `dimensionLabel` is the first-column header. Cells arrive pre-formatted.
 */
export function AnalyticsTable({
  title,
  dimensionLabel,
  columns,
  rows,
}: {
  title: string;
  dimensionLabel: string;
  columns: string[];
  rows: AnalyticsTableRow[];
}) {
  return (
    <Card className="border-purple-100 shadow-xl shadow-purple-900/5">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No data for this period.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{dimensionLabel}</TableHead>
                {columns.map((col) => (
                  <TableHead key={col} className="text-right">
                    {col}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.dimension}>
                  <TableCell className="max-w-xs truncate font-medium text-foreground">
                    {row.dimension || "—"}
                  </TableCell>
                  {row.cells.map((cell, i) => (
                    <TableCell key={columns[i] ?? i} className="text-right">
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
