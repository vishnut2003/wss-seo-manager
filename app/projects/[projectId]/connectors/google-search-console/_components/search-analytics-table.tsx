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
import type { SearchAnalyticsRow } from "@/lib/google/search-console";
import { formatCtr, formatNumber, formatPosition } from "./format";

export function SearchAnalyticsTable({
  title,
  dimensionLabel,
  rows,
}: {
  title: string;
  dimensionLabel: string;
  rows: SearchAnalyticsRow[];
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
                <TableHead className="text-right">Clicks</TableHead>
                <TableHead className="text-right">Impressions</TableHead>
                <TableHead className="text-right">CTR</TableHead>
                <TableHead className="text-right">Position</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.keys?.[0] ?? ""}>
                  <TableCell className="max-w-xs truncate font-medium text-foreground">
                    {row.keys?.[0] ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(row.clicks)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(row.impressions)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCtr(row.ctr)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatPosition(row.position)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
