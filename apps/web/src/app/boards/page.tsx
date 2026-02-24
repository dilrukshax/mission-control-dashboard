import { fetchBoards } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/utils";
import Link from "next/link";

const COLUMN_LABELS: Record<string, string> = {
    todo: "To Do",
    in_progress: "In Progress",
    blocked: "Blocked",
    review: "Review",
    done: "Done",
};

export default async function BoardsPage() {
    const boards = await fetchBoards();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[26px] font-bold tracking-tight leading-tight">Boards</h1>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                        Kanban boards for task tracking across the workspace
                    </p>
                </div>
            </div>

            {boards.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="text-sm text-muted-foreground">
                            No boards yet. Create one via the API.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {boards.map((board) => {
                        const totalTasks = Object.values(board.taskCounts).reduce((s, n) => s + n, 0);
                        return (
                            <Link key={board.id} href={`/boards/${board.id}`}>
                                <Card className="cursor-pointer transition-colors hover:border-primary/50">
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-semibold">{board.name}</CardTitle>
                                        <Badge
                                            variant={board.status === "active" ? "default" : "secondary"}
                                            className="text-[10px]"
                                        >
                                            {board.status}
                                        </Badge>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-xs text-muted-foreground mb-2">
                                            {totalTasks} tasks
                                        </p>

                                        {/* Mini column bar */}
                                        {totalTasks > 0 && (
                                            <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-muted">
                                                {Object.entries(board.taskCounts).map(([col, count]) => {
                                                    const percent = (count / totalTasks) * 100;
                                                    const color =
                                                        col === "done"
                                                            ? "bg-emerald-500"
                                                            : col === "blocked"
                                                                ? "bg-red-500"
                                                                : col === "review"
                                                                    ? "bg-amber-500"
                                                                    : col === "in_progress"
                                                                        ? "bg-blue-500"
                                                                        : "bg-muted-foreground/30";
                                                    return (
                                                        <div
                                                            key={col}
                                                            className={`${color} rounded-sm`}
                                                            style={{ width: `${percent}%` }}
                                                            title={`${COLUMN_LABELS[col] ?? col}: ${count}`}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        )}

                                        <div className="mt-3 flex flex-wrap gap-1">
                                            {Object.entries(board.taskCounts).map(([col, count]) => (
                                                <span
                                                    key={col}
                                                    className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                                                >
                                                    {COLUMN_LABELS[col] ?? col}: {count}
                                                </span>
                                            ))}
                                        </div>

                                        <p className="mt-3 text-[11px] text-muted-foreground">
                                            Updated {timeAgo(board.updated_at)}
                                        </p>
                                    </CardContent>
                                </Card>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
