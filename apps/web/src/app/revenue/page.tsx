import { QuickRevenueForm } from "../components/QuickCreateForms";
import { fetchRevenue } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DollarSign } from "lucide-react";
import { formatCurrency, timeAgo } from "@/lib/utils";

export default async function RevenuePage() {
  const { snapshots, totalUsd } = await fetchRevenue();

  const sources = [...new Set(snapshots.map((s) => s.source))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight leading-tight">Revenue</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Revenue tracking and snapshots</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(totalUsd)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-medium uppercase tracking-wider text-blue-600 dark:text-blue-400">Snapshots</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{snapshots.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{sources.length}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {sources.map((s) => (
                <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="h-4 w-4" />
                Revenue Snapshots
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {snapshots.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-muted-foreground">
                  <DollarSign className="h-10 w-10 opacity-30" />
                  <p className="mt-3 text-sm">No revenue snapshots yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Amount</TableHead>
                      <TableHead className="w-[120px]">Source</TableHead>
                      <TableHead className="w-[120px]">Period</TableHead>
                      <TableHead className="w-[120px] text-right">Captured</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {snapshots.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(s.amount_usd)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{s.source}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {s.period ?? "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {timeAgo(s.captured_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
        <QuickRevenueForm />
      </div>
    </div>
  );
}
