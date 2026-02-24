import { fetchGatewayStatus, fetchOpenClawAgents, fetchOpenClawSessions } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/utils";

function formatBytes(bytes: number | null): string {
    if (bytes === null || bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default async function GatewayPage() {
    const [status, agents, sessions] = await Promise.all([
        fetchGatewayStatus(),
        fetchOpenClawAgents(),
        fetchOpenClawSessions(),
    ]);

    const gw = status.gateway;
    const onlineAgents = agents.filter((a) => a.status === "online").length;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-[26px] font-bold tracking-tight leading-tight">
                    OpenClaw Gateway
                </h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                    Live connection status, agents, and sessions from the OpenClaw runtime
                </p>
            </div>

            {/* ── Status Cards ── */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Gateway</CardTitle>
                        <Badge
                            variant={gw.connected ? "default" : "destructive"}
                            className="text-[10px]"
                        >
                            {gw.connected ? "Connected" : "Offline"}
                        </Badge>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground truncate">{gw.url}</p>
                        {gw.latencyMs !== null && (
                            <p className="mt-1 text-xs text-muted-foreground">
                                Latency: <span className="font-medium text-foreground">{gw.latencyMs}ms</span>
                            </p>
                        )}
                        {gw.error && (
                            <p className="mt-1 text-xs text-red-500 dark:text-red-400 truncate">
                                {gw.error}
                            </p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Version</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">{gw.version ?? "—"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Checked {timeAgo(gw.checkedAt)}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Agents</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">
                            {onlineAgents}<span className="text-base font-normal text-muted-foreground">/{agents.length}</span>
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">online</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Memory DB</CardTitle>
                        <Badge
                            variant={status.memory.exists ? "default" : "secondary"}
                            className="text-[10px]"
                        >
                            {status.memory.exists ? "Active" : "Missing"}
                        </Badge>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">
                            {status.memory.sizeBytes !== null ? formatBytes(status.memory.sizeBytes) : "—"}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* ── Agents Grid ── */}
            <div>
                <h2 className="text-lg font-semibold mb-3">Agents</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {agents.map((agent) => (
                        <Card key={agent.id} className="relative overflow-hidden">
                            <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-2">
                                <span className="text-2xl">{agent.identity.emoji}</span>
                                <div className="flex-1 min-w-0">
                                    <CardTitle className="text-sm font-semibold truncate">
                                        {agent.identity.name}
                                    </CardTitle>
                                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                        {agent.id}
                                    </p>
                                </div>
                                <Badge
                                    variant={agent.status === "online" ? "default" : "secondary"}
                                    className="text-[10px] shrink-0"
                                >
                                    {agent.status}
                                </Badge>
                            </CardHeader>
                            <CardContent>
                                {agent.identity.theme && (
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                        {agent.identity.theme}
                                    </p>
                                )}
                                <p className="mt-2 text-[11px] text-muted-foreground truncate">
                                    📁 {agent.workspace}
                                </p>
                                {agent.lastSeen && (
                                    <p className="mt-1 text-[11px] text-muted-foreground">
                                        Last seen: {timeAgo(agent.lastSeen)}
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* ── Sessions ── */}
            {sessions.length > 0 && (
                <div>
                    <h2 className="text-lg font-semibold mb-3">Recent Sessions</h2>
                    <Card>
                        <CardContent className="p-0">
                            <div className="divide-y">
                                {sessions.map((session) => (
                                    <div key={session.id} className="flex items-center justify-between px-4 py-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium truncate">{session.id}</p>
                                            <p className="text-xs text-muted-foreground">
                                                Agent: {session.agentId} · {session.messageCount} messages
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Badge
                                                variant={session.status === "active" ? "default" : "secondary"}
                                                className="text-[10px]"
                                            >
                                                {session.status}
                                            </Badge>
                                            {session.startedAt && (
                                                <span className="text-[11px] text-muted-foreground">
                                                    {timeAgo(session.startedAt)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {sessions.length === 0 && (
                <Card>
                    <CardContent className="py-8 text-center">
                        <p className="text-sm text-muted-foreground">No recent sessions found</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
