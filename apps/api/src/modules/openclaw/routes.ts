import { Router } from "express";
import type { createAuth } from "../../lib/auth.js";
import type { OpenClawServiceInstance } from "./service.js";

export function openclawRoutes(
    auth: ReturnType<typeof createAuth>,
    service: OpenClawServiceInstance,
) {
    const router = Router();

    router.get("/api/openclaw/health", auth.requireRole("viewer"), async (_req, res) => {
        try {
            const health = await service.checkHealth();
            res.json(health);
        } catch (err) {
            res.status(500).json({ error: "Failed to check gateway health", detail: String(err) });
        }
    });

    router.get("/api/openclaw/status", auth.requireRole("viewer"), async (_req, res) => {
        try {
            const status = await service.getStatus();
            res.json(status);
        } catch (err) {
            res.status(500).json({ error: "Failed to get status", detail: String(err) });
        }
    });

    router.get("/api/openclaw/agents", auth.requireRole("viewer"), (_req, res) => {
        try {
            const agents = service.getMergedAgents();
            res.json({ agents });
        } catch (err) {
            res.status(500).json({ error: "Failed to get agents", detail: String(err) });
        }
    });

    router.get("/api/openclaw/sessions", auth.requireRole("viewer"), (_req, res) => {
        try {
            const sessions = service.getSessions();
            res.json({ sessions });
        } catch (err) {
            res.status(500).json({ error: "Failed to get sessions", detail: String(err) });
        }
    });

    router.get("/api/openclaw/memory/health", auth.requireRole("viewer"), (_req, res) => {
        try {
            const health = service.getMemoryHealth();
            res.json(health);
        } catch (err) {
            res.status(500).json({ error: "Failed to check memory health", detail: String(err) });
        }
    });

    return router;
}
