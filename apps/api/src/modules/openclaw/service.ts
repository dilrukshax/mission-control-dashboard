import type Database from "better-sqlite3";
import type { OpenClawClientInstance } from "./client.js";
import type { OpenClawAgent } from "./types.js";

export function createOpenClawService(
    db: Database.Database,
    client: OpenClawClientInstance,
) {
    // Merge OpenClaw agents with local DB agent records
    function getMergedAgents(): OpenClawAgent[] {
        const openclawAgents = client.getAgents();

        // Get local DB agents for cross-reference
        const localAgents = db
            .prepare("select id, name, role from agents")
            .all() as Array<{ id: string; name: string; role: string }>;

        const localMap = new Map(localAgents.map((a) => [a.id, a]));

        return openclawAgents.map((agent) => {
            const local = localMap.get(agent.id) || localMap.get(`openclaw-${agent.id}`);
            return {
                ...agent,
                name: agent.identity.name || local?.name || agent.id,
            };
        });
    }

    async function getStatus() {
        const health = await client.checkGatewayHealth();
        const memoryHealth = client.getMemoryHealth();

        return {
            gateway: health,
            memory: memoryHealth,
            agents: client.getAgents().length,
            sessions: client.getSessions().length,
        };
    }

    return {
        getMergedAgents,
        getStatus,
        getAgents: client.getAgents,
        getSessions: client.getSessions,
        checkHealth: client.checkGatewayHealth,
        getMemoryHealth: client.getMemoryHealth,
    };
}

export type OpenClawServiceInstance = ReturnType<typeof createOpenClawService>;
