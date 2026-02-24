// ── OpenClaw domain types ──────────────────────────────

export type OpenClawAgentConfig = {
    id: string;
    name?: string;
    workspace?: string;
    agentDir?: string;
    identity?: {
        name?: string;
        theme?: string;
        emoji?: string;
    };
};

export type OpenClawAgent = {
    id: string;
    name: string;
    workspace: string;
    identity: {
        name: string;
        theme: string;
        emoji: string;
    };
    status: "online" | "offline" | "unknown";
    lastSeen?: string;
};

export type OpenClawSession = {
    id: string;
    agentId: string;
    status: "active" | "completed" | "error" | "unknown";
    startedAt?: string;
    messageCount: number;
};

export type GatewayStatus = {
    connected: boolean;
    url: string;
    latencyMs: number | null;
    version: string | null;
    agentCount: number;
    error: string | null;
    checkedAt: string;
};

export type OpenClawConfig = {
    meta: {
        lastTouchedVersion: string;
        lastTouchedAt: string;
    };
    agents: {
        defaults: {
            model: { primary: string };
            workspace: string;
            maxConcurrent: number;
            subagents: { maxConcurrent: number };
        };
        list: OpenClawAgentConfig[];
    };
};
