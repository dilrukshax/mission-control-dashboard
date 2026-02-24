import { fetchBoardTasks, fetchBoardDetail } from "../../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/utils";

const COLUMN_COLORS: Record<string, string> = {
    todo: "border-l-muted-foreground/40",
    in_progress: "border-l-blue-500",
    blocked: "border-l-red-500",
    review: "border-l-amber-500",
    done: "border-l-emerald-500",
};

const STATUS_BADGES: Record<string, "default" | "secondary" | "destructive"> = {
    todo: "secondary",
    in_progress: "default",
    blocked: "destructive",
    review: "default",
    done: "secondary",
};

function PriorityDots({ priority }: { priority: number }) {
    const dots = Math.min(Math.max(priority, 0), 5);
    return (
        <span className="flex items-center gap-0.5" title={`Priority: ${priority}`}>
            {Array.from({ length: 5 }).map((_, i) => (
                <span
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full ${i < dots ? "bg-primary" : "bg-muted-foreground/20"
                        }`}
                />
            ))}
        </span>
    );
}

export default async function BoardDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const [{ board, columns }, { tasks }] = await Promise.all([
        fetchBoardDetail(id),
        fetchBoardTasks(id),
    ]);

    // Group tasks by column_key
    const tasksByColumn: Record<string, typeof tasks> = {};
    for (const col of columns) {
        tasksByColumn[col.key] = [];
    }
    for (const task of tasks) {
        const col = task.column_key ?? task.status ?? "todo";
        if (!tasksByColumn[col]) tasksByColumn[col] = [];
        tasksByColumn[col].push(task);
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[26px] font-bold tracking-tight leading-tight">
                        {board.name}
                    </h1>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                        {board.dept} · {tasks.length} tasks · Updated {timeAgo(board.updated_at)}
                    </p>
                </div>
                <Badge variant={board.status === "active" ? "default" : "secondary"}>
                    {board.status}
                </Badge>
            </div>

            {/* ── Kanban Columns ── */}
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(200px, 1fr))` }}>
                {columns.map((col) => {
                    const colTasks = tasksByColumn[col.key] ?? [];
                    const colorClass = COLUMN_COLORS[col.key] ?? "border-l-muted-foreground/30";
                    return (
                        <div key={col.id} className="space-y-2">
                            {/* Column header */}
                            <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        {col.title}
                                    </span>
                                    <span className="text-[10px] font-medium text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">
                                        {colTasks.length}
                                    </span>
                                </div>
                                {col.wip_limit !== null && col.wip_limit > 0 && (
                                    <span className={`text-[10px] ${colTasks.length > col.wip_limit ? "text-red-500 font-bold" : "text-muted-foreground"}`}>
                                        WIP: {colTasks.length}/{col.wip_limit}
                                    </span>
                                )}
                            </div>

                            {/* Task cards */}
                            <div className="space-y-2 min-h-[200px] p-2 rounded-lg bg-muted/30">
                                {colTasks.map((task) => (
                                    <Card
                                        key={task.id}
                                        className={`border-l-[3px] ${colorClass} shadow-sm`}
                                    >
                                        <CardContent className="p-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="text-xs font-medium leading-tight line-clamp-2">
                                                    {task.title}
                                                </p>
                                                <PriorityDots priority={task.priority} />
                                            </div>

                                            {task.description && (
                                                <p className="mt-1 text-[11px] text-muted-foreground line-clamp-1">
                                                    {task.description}
                                                </p>
                                            )}

                                            <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                                                <span>
                                                    {task.assignee_agent_id ?? "unassigned"}
                                                </span>
                                                <span>{timeAgo(task.updated_at)}</span>
                                            </div>

                                            {task.due_at && (
                                                <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">
                                                    Due: {new Date(task.due_at).toLocaleDateString()}
                                                </p>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}

                                {colTasks.length === 0 && (
                                    <p className="py-8 text-center text-xs text-muted-foreground/50">
                                        No tasks
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
