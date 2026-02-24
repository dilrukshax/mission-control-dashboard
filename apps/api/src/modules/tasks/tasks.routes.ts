import { Router } from "express";
import crypto from "node:crypto";
import type Database from "better-sqlite3";
import type { createAuth } from "../../lib/auth.js";
import type { LogActivity } from "../agents/agents.routes.js";
import type { WorkflowServiceInstance } from "../workflow/workflow.service.js";
import { pushEvent } from "../../lib/sse.js";
import { nowIso } from "../../lib/utils.js";

export function taskRoutes(
    db: Database.Database,
    auth: ReturnType<typeof createAuth>,
    logActivity: LogActivity,
    workflow: WorkflowServiceInstance,
) {
    const router = Router();

    router.get("/api/tasks", auth.requireRole("viewer"), (req, res) => {
        const dept = req.query.dept?.toString();
        const rows = dept
            ? db.prepare("select * from tasks where dept = ? order by updated_at desc limit 300").all(dept)
            : db.prepare("select * from tasks order by updated_at desc limit 300").all();
        res.json({ tasks: rows });
    });

    router.post("/api/tasks", auth.requireRole("operator"), (req, res) => {
        const p = req.body as { title?: string; description?: string; dept?: string; status?: string; assigneeAgentId?: string };
        if (!p?.title || !p?.dept) {
            return res.status(400).json({ error: "title and dept are required" });
        }

        const id = crypto.randomUUID();
        const ts = nowIso();
        const status = p.status ?? "todo";

        db.prepare(
            `insert into tasks (id, dept, title, description, status, assignee_agent_id, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(id, p.dept, p.title, p.description ?? null, status, p.assigneeAgentId ?? null, ts, ts);

        db.prepare(
            "insert into task_events (id, task_id, event_type, payload_json, ts) values (?, ?, ?, ?, ?)"
        ).run(crypto.randomUUID(), id, "created", JSON.stringify(p), ts);

        logActivity({ kind: "task", title: `Task created: ${p.title}`, detail: p.description, actor: p.assigneeAgentId, dept: p.dept });
        pushEvent("task.created", p.title);
        res.status(201).json({ ok: true, id });
    });

    router.patch("/api/tasks/:id", auth.requireRole("operator"), (req, res) => {
        const id = req.params.id;
        const p = req.body as {
            title?: string; description?: string; dept?: string; status?: string;
            assigneeAgentId?: string | null; blockers?: string | null;
        };

        const existing = db.prepare("select * from tasks where id = ?").get(id) as Record<string, unknown> | undefined;
        if (!existing) return res.status(404).json({ error: "task not found" });

        const next = {
            title: p.title ?? (existing.title as string),
            description: p.description ?? (existing.description as string | null),
            dept: p.dept ?? (existing.dept as string),
            status: p.status ?? (existing.status as string),
            assigneeAgentId: p.assigneeAgentId === undefined ? (existing.assignee_agent_id as string | null) : p.assigneeAgentId,
            blockers: p.blockers === undefined ? (existing.blockers as string | null) : p.blockers,
        };

        const ts = nowIso();
        db.prepare(
            `update tasks set title=?, description=?, dept=?, status=?, assignee_agent_id=?, blockers=?, updated_at=? where id=?`
        ).run(next.title, next.description, next.dept, next.status, next.assigneeAgentId, next.blockers, ts, id);

        db.prepare(
            "insert into task_events (id, task_id, event_type, payload_json, ts) values (?, ?, ?, ?, ?)"
        ).run(crypto.randomUUID(), id, "updated", JSON.stringify(p), ts);

        logActivity({ kind: "task", title: `Task updated: ${next.title}`, detail: `Status ${next.status}`, actor: next.assigneeAgentId ?? undefined, dept: next.dept });
        pushEvent("task.updated", next.title);
        res.json({ ok: true });
    });

    router.post("/api/tasks/upsert", auth.requireRole("operator"), (req, res) => {
        const p = req.body as any;
        if (!p?.id || !p?.dept || !p?.title || !p?.status) {
            return res.status(400).json({ error: "missing required fields" });
        }

        const ts = nowIso();
        const existing = db.prepare("select id from tasks where id=?").get(p.id);

        if (!existing) {
            db.prepare(
                `insert into tasks (id, dept, title, description, status, assignee_agent_id, owner_agent, eta, blockers, approval_needed, approval_reason, created_at, updated_at, source_session, source_message)
         values (@id, @dept, @title, @description, @status, @assignee_agent_id, @owner_agent, @eta, @blockers, @approval_needed, @approval_reason, @created_at, @updated_at, @source_session, @source_message)`
            ).run({
                id: p.id, dept: p.dept, title: p.title, description: p.description ?? null,
                status: p.status, assignee_agent_id: p.assignee_agent_id ?? null,
                owner_agent: p.owner_agent ?? null, eta: p.eta ?? null, blockers: p.blockers ?? null,
                approval_needed: p.approval_needed === undefined ? null : p.approval_needed ? 1 : 0,
                approval_reason: p.approval_reason ?? null, created_at: ts, updated_at: ts,
                source_session: p.source_session ?? null, source_message: p.source_message ?? null,
            });
        } else {
            db.prepare(
                `update tasks set dept=@dept, title=@title, description=@description, status=@status, assignee_agent_id=@assignee_agent_id, owner_agent=@owner_agent, eta=@eta, blockers=@blockers,
          approval_needed=@approval_needed, approval_reason=@approval_reason, updated_at=@updated_at,
          source_session=@source_session, source_message=@source_message where id=@id`
            ).run({
                id: p.id, dept: p.dept, title: p.title, description: p.description ?? null,
                status: p.status, assignee_agent_id: p.assignee_agent_id ?? null,
                owner_agent: p.owner_agent ?? null, eta: p.eta ?? null, blockers: p.blockers ?? null,
                approval_needed: p.approval_needed === undefined ? null : p.approval_needed ? 1 : 0,
                approval_reason: p.approval_reason ?? null, updated_at: ts,
                source_session: p.source_session ?? null, source_message: p.source_message ?? null,
            });
        }

        db.prepare(
            "insert into task_events (id, task_id, event_type, payload_json, ts) values (?, ?, ?, ?, ?)"
        ).run(crypto.randomUUID(), p.id, "upsert", JSON.stringify(p), ts);

        logActivity({ kind: "task", title: `Task upsert: ${p.title}`, detail: p.status, actor: p.assignee_agent_id, dept: p.dept });
        pushEvent("task.upsert", p.title);
        res.json({ ok: true, id: p.id });
    });

    // ── Workflow: Move task ──
    router.patch("/api/tasks/:id/move", auth.requireRole("operator"), (req, res) => {
        const p = req.body as { toStatus?: string; actor?: string; reason?: string; force?: boolean };
        if (!p.toStatus) return res.status(400).json({ error: "toStatus is required" });

        // Only owners can force-skip transitions
        const role = auth.resolveRole(req);
        if (p.force && role !== "owner") {
            return res.status(403).json({ error: "only owners can force status transitions" });
        }

        const result = workflow.moveTask({
            taskId: req.params.id,
            toStatus: p.toStatus,
            actor: p.actor,
            reason: p.reason,
            force: p.force,
        });

        if (!result.ok) return res.status(400).json({ error: result.error });
        res.json({ ok: true, from: result.from, to: result.to });
    });

    // ── Workflow: Task timeline ──
    router.get("/api/tasks/:id/timeline", auth.requireRole("viewer"), (req, res) => {
        const timeline = workflow.getTaskTimeline(req.params.id);
        res.json({ timeline });
    });

    // ── Process: Ongoing tasks ──
    router.get("/api/process/ongoing", auth.requireRole("viewer"), (_req, res) => {
        const ongoing = workflow.getOngoingProcess();
        res.json(ongoing);
    });

    return router;
}
