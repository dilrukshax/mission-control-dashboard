import type { Task } from "../lib/api";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Clock, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { timeAgo } from "@/lib/utils";

function statusConfig(status: string) {
  switch (status) {
    case "done":
      return { variant: "success" as const, icon: CheckCircle2, label: "Done" };
    case "in_progress":
      return { variant: "info" as const, icon: Loader2, label: "In Progress" };
    case "blocked":
      return { variant: "warning" as const, icon: AlertTriangle, label: "Blocked" };
    case "todo":
    default:
      return { variant: "secondary" as const, icon: Circle, label: "To Do" };
  }
}

export function TaskTable({ tasks, showDept = true }: { tasks: Task[]; showDept?: boolean }) {
  if (tasks.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center py-12 text-center">
        <Circle className="h-10 w-10 text-muted-foreground/30" />
        <p className="mt-3 text-sm text-muted-foreground">No tasks yet</p>
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            {showDept && <TableHead className="w-[140px]">Department</TableHead>}
            <TableHead>Title</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead className="w-[140px]">Assignee</TableHead>
            <TableHead className="w-[100px] text-right">Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.slice(0, 100).map((t) => {
            const sc = statusConfig(t.status);
            const StatusIcon = sc.icon;
            return (
              <TableRow key={t.id}>
                {showDept && (
                  <TableCell>
                    <Badge variant="outline" className="text-xs font-normal">
                      {t.dept}
                    </Badge>
                  </TableCell>
                )}
                <TableCell>
                  <div className="font-medium">{t.title}</div>
                  {t.description && (
                    <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {t.description}
                    </div>
                  )}
                  {t.blockers && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-3 w-3" />
                      {t.blockers}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={sc.variant} className="gap-1">
                    <StatusIcon className="h-3 w-3" />
                    {sc.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {t.assignee_agent_id ?? "—"}
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">
                  <div className="flex items-center justify-end gap-1">
                    <Clock className="h-3 w-3" />
                    {timeAgo(t.updated_at)}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
