import { Router } from "express";
import crypto from "node:crypto";
import type Database from "better-sqlite3";
import type { createAuth } from "../../lib/auth.js";
import type { LogActivity } from "../agents/agents.routes.js";
import { pushEvent } from "../../lib/sse.js";
import { nowIso } from "../../lib/utils.js";

export function activationRoutes(
    db: Database.Database,
    auth: ReturnType<typeof createAuth>,
    logActivity: LogActivity,
) {
    const router = Router();

    // ── List activations ──
    router.get("/api/activations", auth.requireRole("viewer"), (_req, res) => {
        const rows = db.prepare("select * from activations order by created_at desc").all();
        res.json({ activations: rows });
    });

    // ── Create activation ──
    router.post("/api/activations", auth.requireRole("operator"), (req, res) => {
        const p = req.body as {
            name?: string;
            triggerType?: string;
            triggerConfig?: Record<string, unknown>;
            actionType?: string;
            actionConfig?: Record<string, unknown>;
        };

        if (!p.name || !p.triggerType || !p.actionType) {
            return res.status(400).json({ error: "name, triggerType, actionType are required" });
        }

        const id = crypto.randomUUID();
        const ts = nowIso();

        db.prepare(
            `insert into activations (id, name, trigger_type, trigger_config_json, action_type, action_config_json, enabled, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, 1, ?, ?)`
        ).run(
            id,
            p.name,
            p.triggerType,
            JSON.stringify(p.triggerConfig ?? {}),
            p.actionType,
            JSON.stringify(p.actionConfig ?? {}),
            ts,
            ts
        );

        logActivity({ kind: "activation", title: `Activation created: ${p.name}` });
        pushEvent("activation.created", p.name);
        res.status(201).json({ ok: true, id });
    });

    // ── Update activation ──
    router.patch("/api/activations/:id", auth.requireRole("operator"), (req, res) => {
        const existing = db.prepare("select * from activations where id = ?").get(req.params.id) as Record<string, unknown> | undefined;
        if (!existing) return res.status(404).json({ error: "activation not found" });

        const p = req.body as {
            name?: string;
            triggerType?: string;
            triggerConfig?: Record<string, unknown>;
            actionType?: string;
            actionConfig?: Record<string, unknown>;
            enabled?: boolean;
        };

        const ts = nowIso();
        db.prepare(
            `update activations set name=?, trigger_type=?, trigger_config_json=?, action_type=?, action_config_json=?, enabled=?, updated_at=? where id=?`
        ).run(
            p.name ?? existing.name,
            p.triggerType ?? existing.trigger_type,
            p.triggerConfig ? JSON.stringify(p.triggerConfig) : (existing.trigger_config_json as string),
            p.actionType ?? existing.action_type,
            p.actionConfig ? JSON.stringify(p.actionConfig) : (existing.action_config_json as string),
            p.enabled === undefined ? existing.enabled : (p.enabled ? 1 : 0),
            ts,
            req.params.id
        );

        pushEvent("activation.updated", (p.name ?? existing.name) as string);
        res.json({ ok: true });
    });

    // ── Test activation ──
    router.post("/api/activations/:id/test", auth.requireRole("operator"), (req, res) => {
        const activation = db.prepare("select * from activations where id = ?").get(req.params.id) as Record<string, unknown> | undefined;
        if (!activation) return res.status(404).json({ error: "activation not found" });

        const runId = crypto.randomUUID();
        const ts = nowIso();

        // Simulate a test run
        db.prepare(
            `insert into activation_runs (id, activation_id, task_id, status, result_json, error, ts)
       values (?, ?, null, 'test', ?, null, ?)`
        ).run(runId, req.params.id, JSON.stringify({ test: true, triggeredAt: ts }), ts);

        res.json({ ok: true, runId, message: "Test run recorded" });
    });

    // ── List activation runs ──
    router.get("/api/activations/runs", auth.requireRole("viewer"), (req, res) => {
        const activationId = req.query.activationId?.toString();
        const limit = Math.min(Number(req.query.limit) || 100, 500);

        const rows = activationId
            ? db.prepare(
                "select r.*, a.name as activation_name from activation_runs r left join activations a on a.id = r.activation_id where r.activation_id = ? order by r.ts desc limit ?"
            ).all(activationId, limit)
            : db.prepare(
                "select r.*, a.name as activation_name from activation_runs r left join activations a on a.id = r.activation_id order by r.ts desc limit ?"
            ).all(limit);

        res.json({ runs: rows });
    });

    return router;
}
