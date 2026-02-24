import { fetchActivations, fetchActivationRuns } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/utils";

const TRIGGER_LABELS: Record<string, string> = {
    task_blocked: "Task → Blocked",
    task_overdue: "Task Overdue",
    task_stale: "Task Stale (In Progress)",
    gateway_offline: "Gateway Offline",
};

const ACTION_LABELS: Record<string, string> = {
    create_alert: "Create Alert",
    auto_assign: "Auto-Assign",
    webhook: "Webhook / Discord",
    create_task: "Create Follow-Up",
};

export default async function ActivationsPage() {
    const [activations, runs] = await Promise.all([
        fetchActivations(),
        fetchActivationRuns(),
    ]);

    const successRuns = runs.filter((r) => r.status === "success").length;
    const failedRuns = runs.filter((r) => r.status === "error").length;
    const testRuns = runs.filter((r) => r.status === "test").length;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-[26px] font-bold tracking-tight leading-tight">
                    Activations
                </h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                    Automation rules with triggers, actions, and execution history
                </p>
            </div>

            {/* ── Stats ── */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Rules</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold">{activations.length}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {activations.filter((a) => a.enabled).length} enabled
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Runs</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold">{runs.length}</p>
                        <p className="mt-1 text-xs text-muted-foreground">total executions</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Success</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                            {successRuns}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">successful runs</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Failed</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                            {failedRuns}
                        </p>
                        {testRuns > 0 && (
                            <p className="mt-1 text-xs text-muted-foreground">
                                {testRuns} test runs
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ── Activation Rules ── */}
            <div>
                <h2 className="text-lg font-semibold mb-3">Rules</h2>
                {activations.length === 0 ? (
                    <Card>
                        <CardContent className="py-8 text-center">
                            <p className="text-sm text-muted-foreground">
                                No activation rules yet. Create one via the API.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-3">
                        {activations.map((act) => (
                            <Card key={act.id}>
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <Badge
                                                variant={act.enabled ? "default" : "secondary"}
                                                className="text-[10px] shrink-0"
                                            >
                                                {act.enabled ? "Active" : "Disabled"}
                                            </Badge>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold truncate">{act.name}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    <span className="font-medium">
                                                        {TRIGGER_LABELS[act.trigger_type] ?? act.trigger_type}
                                                    </span>
                                                    {" → "}
                                                    <span className="font-medium">
                                                        {ACTION_LABELS[act.action_type] ?? act.action_type}
                                                    </span>
                                                </p>
                                            </div>
                                        </div>
                                        <span className="text-[11px] text-muted-foreground shrink-0">
                                            Created {timeAgo(act.created_at)}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Recent Runs ── */}
            <div>
                <h2 className="text-lg font-semibold mb-3">Recent Runs</h2>
                {runs.length === 0 ? (
                    <Card>
                        <CardContent className="py-8 text-center">
                            <p className="text-sm text-muted-foreground">No execution history yet.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardContent className="p-0">
                            <div className="divide-y">
                                {runs.slice(0, 50).map((run) => (
                                    <div
                                        key={run.id}
                                        className="flex items-center justify-between px-4 py-3"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium truncate">
                                                {run.activation_name}
                                            </p>
                                            {run.error && (
                                                <p className="mt-0.5 text-[11px] text-red-500 dark:text-red-400 truncate">
                                                    {run.error}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0 ml-4">
                                            <Badge
                                                variant={
                                                    run.status === "success"
                                                        ? "default"
                                                        : run.status === "error"
                                                            ? "destructive"
                                                            : "secondary"
                                                }
                                                className="text-[10px]"
                                            >
                                                {run.status}
                                            </Badge>
                                            <span className="text-[11px] text-muted-foreground">
                                                {timeAgo(run.ts)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
