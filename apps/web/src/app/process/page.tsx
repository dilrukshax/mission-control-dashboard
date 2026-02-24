import { fetchProcessStats, fetchOngoingProcess } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/utils";

const COLUMN_LABELS: Record<string, string> = {
    todo: "To Do",
    in_progress: "In Progress",
    blocked: "Blocked",
    review: "Review",
};

export default async function ProcessPage() {
    const [stats, ongoing] = await Promise.all([
        fetchProcessStats(),
        fetchOngoingProcess(),
    ]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-[26px] font-bold tracking-tight leading-tight">Process</h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                    KPIs, bottlenecks, and operational health
                </p>
            </div>

            {/* ── KPI Cards ── */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg Cycle Time</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold">
                            {stats.avgCycleHours !== null ? `${stats.avgCycleHours}h` : "—"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">start → done</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Throughput</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                            {stats.throughputThisWeek}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">completed this week</p>
                    </CardContent>
                </Card>

                <Card className={stats.staleInProgress > 0 ? "border-orange-500/40" : ""}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Stale Tasks</CardTitle>
                        {stats.staleInProgress > 0 && (
                            <Badge variant="destructive" className="text-[10px]">⚠️</Badge>
                        )}
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                            {stats.staleInProgress}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">in-progress &gt;24h no update</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Automations</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold">
                            <span className="text-emerald-600 dark:text-emerald-400">{stats.activations.successThisWeek}</span>
                            <span className="text-muted-foreground mx-1">/</span>
                            <span className="text-red-600 dark:text-red-400">{stats.activations.failedThisWeek}</span>
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">success / failed this week</p>
                    </CardContent>
                </Card>
            </div>

            {/* ── Bottleneck ── */}
            {stats.bottleneck && (
                <Card className="border-amber-500/30">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">🔥</span>
                            <div>
                                <p className="text-sm font-semibold">
                                    Bottleneck: <span className="text-amber-600 dark:text-amber-400">{COLUMN_LABELS[stats.bottleneck.column] ?? stats.bottleneck.column}</span>
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {stats.bottleneck.taskCount} tasks · avg {stats.bottleneck.avgHours}h dwell time
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── Ongoing by Status ── */}
            <div>
                <h2 className="text-lg font-semibold mb-3">Active Tasks by Status</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {(["blocked", "in_progress", "review", "todo"] as const).map((status) => {
                        const tasks = ongoing.byColumn[status] ?? [];
                        return (
                            <Card key={status}>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                        {COLUMN_LABELS[status]} ({tasks.length})
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                                    {tasks.length === 0 ? (
                                        <p className="text-xs text-muted-foreground/50 py-4 text-center">None</p>
                                    ) : (
                                        tasks.map((task) => (
                                            <div key={task.id} className="text-xs p-2 rounded bg-muted/50">
                                                <p className="font-medium truncate">{task.title}</p>
                                                <p className="text-muted-foreground mt-0.5">
                                                    {task.assignee_agent_id ?? "unassigned"} · {timeAgo(task.updated_at)}
                                                </p>
                                            </div>
                                        ))
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
