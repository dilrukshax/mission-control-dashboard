import { fetchAgents, fetchTasks, fetchMemoryNotes } from "@/app/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Bot,
  Building2,
  Briefcase,
  Brain,
  Clock,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { timeAgo, formatDate } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";

function getInitials(name: string) {
  return name
    .split(/[\s-]+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function statusIcon(status: string) {
  switch (status) {
    case "done": return CheckCircle2;
    case "in_progress": return Loader2;
    case "blocked": return AlertTriangle;
    default: return Circle;
  }
}

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);

  const [agents, allTasks, memoryNotes] = await Promise.all([
    fetchAgents(),
    fetchTasks(),
    fetchMemoryNotes(decodedId),
  ]);

  const agent = agents.find((a) => a.id === decodedId);
  if (!agent) return notFound();

  const assignedTasks = allTasks.filter(
    (t) => t.assignee_agent_id === decodedId || t.owner_agent === decodedId
  );

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link href="/">
        <Button variant="ghost" size="sm" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
      </Link>

      {/* Agent header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
                {getInitials(agent.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold">{agent.name}</h1>
                <Badge
                  variant={
                    agent.current_status === "active"
                      ? "success"
                      : agent.current_status === "sleeping"
                        ? "secondary"
                        : "warning"
                  }
                >
                  {agent.current_status ?? "unknown"}
                </Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Bot className="h-4 w-4" />
                  {agent.role}
                </span>
                <span className="flex items-center gap-1">
                  <Building2 className="h-4 w-4" />
                  {agent.dept}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {agent.last_checkin_at
                    ? `Last check-in ${timeAgo(agent.last_checkin_at)}`
                    : "Never checked in"}
                </span>
              </div>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">Agent ID</div>
              <div className="font-mono text-sm">{agent.id}</div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <Briefcase className="h-3 w-3" /> Current Task
              </div>
              <div className="text-sm">{agent.current_task ?? "None"}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">Previous Task</div>
              <div className="text-sm">{agent.previous_task ?? "None"}</div>
            </div>
          </div>

          {agent.note && (
            <div className="mt-4 rounded-lg bg-muted p-3">
              <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
                <Brain className="h-3 w-3" /> Latest Note
              </div>
              <p className="text-sm">{agent.note}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assigned tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Assigned Tasks ({assignedTasks.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {assignedTasks.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-muted-foreground">
              <Briefcase className="h-8 w-8 opacity-30" />
              <p className="mt-2 text-sm">No tasks assigned</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="w-[100px]">Dept</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[100px] text-right">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignedTasks.map((t) => {
                  const Icon = statusIcon(t.status);
                  return (
                    <TableRow key={t.id}>
                      <TableCell>
                        <div className="font-medium">{t.title}</div>
                        {t.description && (
                          <div className="line-clamp-1 text-xs text-muted-foreground">{t.description}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{t.dept}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            t.status === "done" ? "success" :
                            t.status === "in_progress" ? "info" :
                            t.status === "blocked" ? "warning" : "secondary"
                          }
                          className="gap-1"
                        >
                          <Icon className="h-3 w-3" />
                          {t.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {timeAgo(t.updated_at)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Memory notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Memory Notes ({memoryNotes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {memoryNotes.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-muted-foreground">
              <Brain className="h-8 w-8 opacity-30" />
              <p className="mt-2 text-sm">No memory notes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {memoryNotes.slice(0, 50).map((note) => (
                <div key={note.id} className="rounded-lg border p-3">
                  <p className="text-sm">{note.note}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatDate(note.created_at)}
                    <Badge variant="outline" className="text-[10px]">{note.dept}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
