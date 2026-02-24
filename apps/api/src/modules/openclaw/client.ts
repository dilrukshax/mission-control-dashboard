import fs from "node:fs";
import path from "node:path";
import type { OpenClawConfig, OpenClawAgent, OpenClawSession, GatewayStatus } from "./types.js";

const OPENCLAW_ROOT = "/home/dilan/.openclaw";
const CONFIG_PATH = path.join(OPENCLAW_ROOT, "openclaw.json");

export function createOpenClawClient(gatewayUrl: string, token?: string) {
    // ── Read local config ──
    function readConfig(): OpenClawConfig | null {
        try {
            if (!fs.existsSync(CONFIG_PATH)) return null;
            const raw = fs.readFileSync(CONFIG_PATH, "utf8");
            return JSON.parse(raw) as OpenClawConfig;
        } catch {
            return null;
        }
    }

    // ── List agents from local config ──
    function listAgentsFromConfig(): OpenClawAgent[] {
        const config = readConfig();
        if (!config?.agents?.list) return [];

        return config.agents.list.map((a) => ({
            id: a.id,
            name: a.identity?.name ?? a.name ?? a.id,
            workspace: a.workspace ?? config.agents.defaults.workspace,
            identity: {
                name: a.identity?.name ?? a.name ?? a.id,
                theme: a.identity?.theme ?? "",
                emoji: a.identity?.emoji ?? "🤖",
            },
            status: "unknown" as const,
        }));
    }

    // ── Check if agent dirs exist (sign of activity) ──
    function checkAgentActivity(agentId: string): { exists: boolean; lastActivity?: string } {
        const agentDir = path.join(OPENCLAW_ROOT, "agents", agentId);
        if (!fs.existsSync(agentDir)) return { exists: false };

        try {
            const stat = fs.statSync(agentDir);
            return { exists: true, lastActivity: stat.mtime.toISOString() };
        } catch {
            return { exists: false };
        }
    }

    // ── Get agents with status from filesystem ──
    function getAgents(): OpenClawAgent[] {
        const agents = listAgentsFromConfig();
        return agents.map((agent) => {
            const activity = checkAgentActivity(agent.id);
            return {
                ...agent,
                status: activity.exists ? ("online" as const) : ("offline" as const),
                lastSeen: activity.lastActivity,
            };
        });
    }

    // ── Get sessions from logs ──
    function getSessions(): OpenClawSession[] {
        const sessionsDir = path.join(OPENCLAW_ROOT, "completions");
        if (!fs.existsSync(sessionsDir)) return [];

        try {
            const entries = fs.readdirSync(sessionsDir, { withFileTypes: true });
            const sessions: OpenClawSession[] = [];

            for (const entry of entries) {
                if (!entry.isDirectory()) continue;
                const sessionDir = path.join(sessionsDir, entry.name);
                try {
                    const stat = fs.statSync(sessionDir);
                    // Try to count files as proxy for message count
                    const files = fs.readdirSync(sessionDir);
                    sessions.push({
                        id: entry.name,
                        agentId: "main", // default
                        status: "completed",
                        startedAt: stat.birthtime.toISOString(),
                        messageCount: files.length,
                    });
                } catch { /* skip */ }
            }

            return sessions.sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? "")).slice(0, 50);
        } catch {
            return [];
        }
    }

    // ── Gateway health check (attempt HTTP) ──
    async function checkGatewayHealth(): Promise<GatewayStatus> {
        const checkedAt = new Date().toISOString();
        const config = readConfig();
        const agents = listAgentsFromConfig();

        // Try HTTP health check to gateway
        const httpUrl = gatewayUrl.replace(/^ws/, "http");
        const startMs = Date.now();

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(`${httpUrl}/health`, {
                signal: controller.signal,
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            clearTimeout(timeout);
            const latencyMs = Date.now() - startMs;

            if (res.ok) {
                const data = await res.json().catch(() => ({})) as Record<string, unknown>;
                return {
                    connected: true,
                    url: gatewayUrl,
                    latencyMs,
                    version: (data.version as string) ?? config?.meta?.lastTouchedVersion ?? null,
                    agentCount: agents.length,
                    error: null,
                    checkedAt,
                };
            }

            return {
                connected: false,
                url: gatewayUrl,
                latencyMs,
                version: config?.meta?.lastTouchedVersion ?? null,
                agentCount: agents.length,
                error: `HTTP ${res.status}`,
                checkedAt,
            };
        } catch (err) {
            // Gateway not reachable - still return config data
            return {
                connected: false,
                url: gatewayUrl,
                latencyMs: null,
                version: config?.meta?.lastTouchedVersion ?? null,
                agentCount: agents.length,
                error: err instanceof Error ? err.message : "Connection failed",
                checkedAt,
            };
        }
    }

    // ── Memory DB health ──
    function getMemoryHealth(): { exists: boolean; sizeBytes: number | null; path: string } {
        const memPath = path.join(OPENCLAW_ROOT, "memory", "main.sqlite");
        try {
            if (!fs.existsSync(memPath)) return { exists: false, sizeBytes: null, path: memPath };
            const stat = fs.statSync(memPath);
            return { exists: true, sizeBytes: stat.size, path: memPath };
        } catch {
            return { exists: false, sizeBytes: null, path: memPath };
        }
    }

    return {
        readConfig,
        getAgents,
        getSessions,
        checkGatewayHealth,
        getMemoryHealth,
    };
}

export type OpenClawClientInstance = ReturnType<typeof createOpenClawClient>;
