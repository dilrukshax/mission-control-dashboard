import { QuickBuildForm } from "../components/QuickCreateForms";
import { fetchBuildJobs } from "../lib/api";
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
import { Hammer, CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";
// Icons used in build status badges and empty state, stat cards use colored labels
import { timeAgo } from "@/lib/utils";

function buildStatusConfig(status: string) {
  switch (status) {
    case "success": return { variant: "success" as const, icon: CheckCircle2 };
    case "failed": return { variant: "destructive" as const, icon: XCircle };
    case "running": return { variant: "info" as const, icon: Loader2 };
    default: return { variant: "secondary" as const, icon: Clock };
  }
}

export default async function BuildsPage() {
  const jobs = await fetchBuildJobs();

  const successCount = jobs.filter((j) => j.status === "success").length;
  const failedCount = jobs.filter((j) => j.status === "failed").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight leading-tight">Builds</h1>
        <p className="text-sm text-muted-foreground">Build and deployment tracking</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{jobs.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Succeeded</CardTitle>
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{successCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-medium uppercase tracking-wider text-red-600 dark:text-red-400">Failed</CardTitle>
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{failedCount}</div></CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Hammer className="h-4 w-4" />
                Build Queue
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {jobs.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-muted-foreground">
                  <Hammer className="h-10 w-10 opacity-30" />
                  <p className="mt-3 text-sm">No builds yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead className="w-[120px]">Service</TableHead>
                      <TableHead className="w-[120px]">Status</TableHead>
                      <TableHead className="w-[120px] text-right">Started</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => {
                      const sc = buildStatusConfig(job.status);
                      const Icon = sc.icon;
                      return (
                        <TableRow key={job.id}>
                          <TableCell>
                            <div className="font-medium">{job.title}</div>
                            {job.note && (
                              <div className="line-clamp-1 text-xs text-muted-foreground mt-0.5">{job.note}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{job.service}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={sc.variant} className="gap-1">
                              <Icon className="h-3 w-3" />
                              {job.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {timeAgo(job.started_at)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
        <QuickBuildForm />
      </div>
    </div>
  );
}
