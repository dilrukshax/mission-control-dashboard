import { fetchOngoingProcess } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/utils";

const COLUMN_LABELS: Record<string, string> = {
    todo: "To Do",
    in_progress: "In Progress",
    blocked: "Blocked",
    review: "Review",
};

const COLUMN_ICONS: Record<string, string> = {
    todo: "📋",
    in_progress: "🔧",
    blocked: "🚫",
    review: "👀",
};

export default async function ProcessPage() {
    const process = await fetchOngoingProcess();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-[26px] font-bold tracking-tight leading-tight">
                    Ongoing Process
                </h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                    Real-time view of all active tasks across all boards
                </p>
            </div>

            {/* ── KPI Cards ── */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Active</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold">{process.total}</p>
                        <p className="mt-1 text-xs text-muted-foreground">non-done tasks</p>
                    </CardContent>
                </Card>

                <Card className={process.blocked > 0 ? "border-red-500/40" : ""}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Blocked</CardTitle>
                        {process.blocked > 0 && (
                            <Badge variant="destructive" className="text-[10px]">
                                ⚠️ {process.blocked}
                            </Badge>
                        )}
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                            {process.blocked}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">needs attention</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                            {process.inProgress}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">currently active</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">In Review</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                            {process.review}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">awaiting review</p>
                    </CardContent>
                </Card>
            </div>

            {/* ── Tasks by Column ── */}
            {Object.entries(process.byColumn).map(([column, tasks]) => (
                <div key={column}>
                    <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <span>{COLUMN_ICONS[column] ?? "📌"}</span>
                        <span>{COLUMN_LABELS[column] ?? column}</span>
                        <span className="text-sm font-normal text-muted-foreground">
                            ({tasks.length})
                        </span>
                    </h2>
                    <Card>
                        <CardContent className="p-0">
                            <div className="divide-y">
                                {tasks.map((task) => (
                                    <div
                                        key={task.id}
                                        className="flex items-center justify-between px-4 py-3"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium truncate">{task.title}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {task.assignee_agent_id ? ` · ${task.assignee_agent_id}` : null}
                                                {typeof (task as Record<string, unknown>).board_name === "string" ? ` · ${(task as Record<string, unknown>).board_name as string}` : null}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0 ml-4">
                                            {task.priority > 0 && (
                                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                                                    P{task.priority}
                                                </span>
                                            )}
                                            {task.due_at && (
                                                <span className="text-[10px] text-amber-600 dark:text-amber-400">
                                                    Due {new Date(task.due_at).toLocaleDateString()}
                                                </span>
                                            )}
                                            <span className="text-[11px] text-muted-foreground">
                                                {timeAgo(task.updated_at)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            ))}

            {process.total === 0 && (
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="text-sm text-muted-foreground">
                            No ongoing tasks. All caught up! 🎉
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
