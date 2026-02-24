import { fetchWorkQueue } from "./lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  blocked: "text-red-600 dark:text-red-400",
  review: "text-amber-600 dark:text-amber-400",
  in_progress: "text-blue-600 dark:text-blue-400",
  todo: "text-muted-foreground",
};

const STATUS_BADGES: Record<string, "default" | "secondary" | "destructive"> = {
  blocked: "destructive",
  review: "default",
  in_progress: "default",
  todo: "secondary",
};

type QueueTask = {
  id: string;
  title: string;
  status: string;
  assignee_agent_id?: string | null;
  priority?: number;
  due_at?: string | null;
  updated_at: string;
  board_id?: string | null;
};

function TaskRow({ task }: { task: QueueTask }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 hover:bg-accent/30 transition-colors">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{task.title}</p>
        <p className="text-xs text-muted-foreground">
          {task.assignee_agent_id ? task.assignee_agent_id : "unassigned"}
          <span className="mx-1">·</span>
          {timeAgo(task.updated_at)}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-4">
        {(task.priority ?? 0) > 0 && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">
            P{task.priority}
          </span>
        )}
        {task.due_at && (
          <span className="text-[10px] text-amber-600 dark:text-amber-400">
            Due {new Date(task.due_at).toLocaleDateString()}
          </span>
        )}
        <Badge variant={STATUS_BADGES[task.status] ?? "secondary"} className="text-[10px]">
          {task.status.replace("_", " ")}
        </Badge>
      </div>
    </div>
  );
}

function QueueSection({
  title,
  icon,
  tasks,
  colorClass,
}: {
  title: string;
  icon: string;
  tasks: QueueTask[];
  colorClass?: string;
}) {
  if (tasks.length === 0) return null;
  return (
    <div>
      <h2 className={`text-base font-semibold mb-2 flex items-center gap-2 ${colorClass ?? ""}`}>
        <span>{icon}</span>
        <span>{title}</span>
        <span className="text-sm font-normal text-muted-foreground">({tasks.length})</span>
      </h2>
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">{tasks.map((t) => <TaskRow key={t.id} task={t} />)}</div>
        </CardContent>
      </Card>
    </div>
  );
}

export default async function WorkQueuePage() {
  const queue = await fetchWorkQueue();
  const { kpi, sections } = queue;

  const kpiCards = [
    { label: "Active", value: kpi.totalActive, color: "" },
    { label: "Blocked", value: kpi.blocked, color: kpi.blocked > 0 ? "text-red-600 dark:text-red-400" : "", border: kpi.blocked > 0 ? "border-red-500/40" : "" },
    { label: "Overdue", value: kpi.overdue, color: kpi.overdue > 0 ? "text-amber-600 dark:text-amber-400" : "" },
    { label: "Stale", value: kpi.stale, color: kpi.stale > 0 ? "text-orange-600 dark:text-orange-400" : "" },
    { label: "Review", value: kpi.needsReview, color: kpi.needsReview > 0 ? "text-blue-600 dark:text-blue-400" : "" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight leading-tight">Work Queue</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          What needs attention right now
        </p>
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {kpiCards.map((k) => (
          <Card key={k.label} className={("border" in k && k.border) ? k.border : ""}>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {k.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-4">
              <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Queue Sections (priority order) ── */}
      <QueueSection title="Blocked" icon="🚫" tasks={sections.blocked} colorClass="text-red-600 dark:text-red-400" />
      <QueueSection title="Needs Review" icon="👀" tasks={sections.needsReview} colorClass="text-amber-600 dark:text-amber-400" />
      <QueueSection title="Due Today" icon="⏰" tasks={sections.dueToday} />
      <QueueSection title="Stale (>24h)" icon="⚠️" tasks={sections.stale} colorClass="text-orange-600 dark:text-orange-400" />
      <QueueSection title="Unassigned" icon="📋" tasks={sections.unassigned} />
      <QueueSection title="In Progress" icon="🔧" tasks={sections.inProgress} colorClass="text-blue-600 dark:text-blue-400" />

      {kpi.totalActive === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg font-medium">All clear 🎉</p>
            <p className="mt-1 text-sm text-muted-foreground">No tasks need attention right now.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
