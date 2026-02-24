import { Router } from "express";
import crypto from "node:crypto";
import type Database from "better-sqlite3";
import type { createAuth } from "../../lib/auth.js";
import { pushEvent } from "../../lib/sse.js";
import { nowIso } from "../../lib/utils.js";

export function createLogActivity(db: Database.Database) {
    return function logActivity(params: {
        kind: string;
        title: string;
        detail?: string;
        actor?: string;
        dept?: string;
    }) {
        db.prepare(
            `insert into activity_events (id, kind, title, detail, actor, dept, ts)
       values (?, ?, ?, ?, ?, ?, ?)`
        ).run(
            crypto.randomUUID(),
            params.kind,
            params.title,
            params.detail ?? null,
            params.actor ?? null,
            params.dept ?? null,
            nowIso()
        );
    };
}

export type LogActivity = ReturnType<typeof createLogActivity>;

export function agentRoutes(
    db: Database.Database,
    auth: ReturnType<typeof createAuth>,
    logActivity: LogActivity,
) {
    const router = Router();

    router.get("/api/agents", auth.requireRole("viewer"), (_req, res) => {
        const rows = db
            .prepare(
                `select a.id, a.name, a.role, a.dept,
           c.status as current_status, c.current_task, c.previous_task, c.note, c.ts as last_checkin_at
         from agents a
         left join agent_checkins c on c.id = (
           select c2.id from agent_checkins c2 where c2.agent_id = a.id order by c2.ts desc limit 1
         )
         order by a.name asc`
            )
            .all();
        res.json({ agents: rows });
    });

    router.post("/api/agents/upsert", auth.requireRole("operator"), (req, res) => {
        const p = req.body as { id?: string; name?: string; role?: string; dept?: string };
        if (!p.id || !p.name || !p.dept) {
            return res.status(400).json({ error: "id, name, dept are required" });
        }

        const ts = nowIso();
        db.prepare(
            `insert into agents (id, name, role, dept, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?)
       on conflict(id) do update set name=excluded.name, role=excluded.role, dept=excluded.dept, updated_at=excluded.updated_at`
        ).run(p.id, p.name, p.role ?? "Team", p.dept, ts, ts);

        logActivity({ kind: "agent", title: `Agent upsert: ${p.name}`, dept: p.dept, actor: p.id });
        pushEvent("agent.upsert", p.name);
        res.json({ ok: true, id: p.id });
    });

    router.post("/api/agents/replace", auth.requireRole("operator"), (req, res) => {
        const p = req.body as { agents?: Array<{ id: string; name: string; role?: string; dept: string }> };
        if (!Array.isArray(p.agents)) {
            return res.status(400).json({ error: "agents array is required" });
        }

        const ts = nowIso();
        const tx = db.transaction(() => {
            db.prepare("delete from agents").run();
            const ins = db.prepare(
                `insert into agents (id, name, role, dept, created_at, updated_at) values (?, ?, ?, ?, ?, ?)`
            );
            for (const a of p.agents!) {
                ins.run(a.id, a.name, a.role ?? "Team", a.dept, ts, ts);
            }
        });
        tx();

        logActivity({ kind: "agent", title: `Agents replaced (${p.agents.length})` });
        pushEvent("agent.replace", String(p.agents.length));
        res.json({ ok: true, count: p.agents.length });
    });

    router.post("/api/agents/checkin", auth.requireRole("operator"), (req, res) => {
        const p = req.body as {
            agentId?: string;
            status?: "active" | "sleeping";
            currentTask?: string;
            previousTask?: string;
            note?: string;
        };

        if (!p?.agentId || !p?.status) {
            return res.status(400).json({ error: "agentId and status are required" });
        }

        const exists = db.prepare("select id from agents where id = ?").get(p.agentId);
        if (!exists) return res.status(404).json({ error: "agent not found" });

        const ts = nowIso();
        db.prepare(
            `insert into agent_checkins (id, agent_id, status, current_task, previous_task, note, ts)
       values (?, ?, ?, ?, ?, ?, ?)`
        ).run(crypto.randomUUID(), p.agentId, p.status, p.currentTask ?? null, p.previousTask ?? null, p.note ?? null, ts);

        logActivity({ kind: "checkin", title: `Agent ${p.agentId} checked in`, detail: p.currentTask ?? p.note, actor: p.agentId });
        pushEvent("agent.checkin", p.agentId);
        res.json({ ok: true });
    });

    return router;
}
