import { Router } from "express";
import crypto from "node:crypto";
import type Database from "better-sqlite3";
import type { createAuth } from "../../lib/auth.js";
import type { LogActivity } from "../agents/agents.routes.js";
import { pushEvent } from "../../lib/sse.js";
import { nowIso } from "../../lib/utils.js";

export function contentRoutes(
    db: Database.Database,
    auth: ReturnType<typeof createAuth>,
    logActivity: LogActivity,
) {
    const router = Router();

    // ── Content Drops ──
    router.get("/api/content-drops", auth.requireRole("viewer"), (_req, res) => {
        const rows = db.prepare("select * from content_drops order by created_at desc limit 200").all();
        res.json({ contentDrops: rows });
    });

    router.post("/api/content-drops", auth.requireRole("operator"), (req, res) => {
        const p = req.body as { title?: string; agentId?: string; contentType?: string; contentPreview?: string; link?: string; status?: string };
        if (!p?.title || !p?.contentType) {
            return res.status(400).json({ error: "title and contentType required" });
        }
        db.prepare(
            `insert into content_drops (id, title, dept, agent_id, content_type, content_preview, link, status, created_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(crypto.randomUUID(), p.title, "general", p.agentId ?? null, p.contentType, p.contentPreview ?? null, p.link ?? null, p.status ?? "submitted", nowIso());

        logActivity({ kind: "content", title: `Content drop: ${p.title}`, detail: p.contentType, actor: p.agentId });
        pushEvent("content.created", p.title);
        res.status(201).json({ ok: true });
    });

    // ── Build Jobs ──
    router.get("/api/build-jobs", auth.requireRole("viewer"), (_req, res) => {
        const rows = db.prepare("select * from build_jobs order by started_at desc limit 200").all();
        res.json({ buildJobs: rows });
    });

    router.post("/api/build-jobs", auth.requireRole("operator"), (req, res) => {
        const p = req.body as { title?: string; service?: string; status?: string; note?: string; finishedAt?: string };
        if (!p?.title || !p?.service || !p?.status) {
            return res.status(400).json({ error: "title, service, status required" });
        }
        db.prepare(
            `insert into build_jobs (id, title, service, status, started_at, finished_at, note) values (?, ?, ?, ?, ?, ?, ?)`
        ).run(crypto.randomUUID(), p.title, p.service, p.status, nowIso(), p.finishedAt ?? null, p.note ?? null);

        logActivity({ kind: "build", title: `Build ${p.status}: ${p.title}`, detail: p.note });
        pushEvent("build.created", p.title);
        res.status(201).json({ ok: true });
    });

    // ── Revenue ──
    router.get("/api/revenue", auth.requireRole("viewer"), (_req, res) => {
        const snapshots = db.prepare("select * from revenue_snapshots order by captured_at desc limit 120").all() as { amount_usd: number }[];
        const totalUsd = snapshots.reduce((sum, row) => sum + (row.amount_usd ?? 0), 0);
        res.json({ snapshots, totalUsd });
    });

    router.post("/api/revenue", auth.requireRole("operator"), (req, res) => {
        const p = req.body as { source?: string; amountUsd?: number; period?: string };
        if (!p?.source || typeof p.amountUsd !== "number") {
            return res.status(400).json({ error: "source and amountUsd required" });
        }
        db.prepare(
            `insert into revenue_snapshots (id, source, amount_usd, period, captured_at) values (?, ?, ?, ?, ?)`
        ).run(crypto.randomUUID(), p.source, p.amountUsd, p.period ?? null, nowIso());

        logActivity({ kind: "revenue", title: `Revenue snapshot: $${p.amountUsd.toFixed(2)}`, detail: p.source });
        pushEvent("revenue.created", p.source);
        res.status(201).json({ ok: true });
    });

    // ── Memory Notes ──
    router.get("/api/memory-notes", auth.requireRole("viewer"), (req, res) => {
        const agentId = req.query.agentId?.toString();
        const rows = agentId
            ? db.prepare("select * from memory_notes where agent_id=? order by created_at desc limit 100").all(agentId)
            : db.prepare("select * from memory_notes order by created_at desc limit 300").all();
        res.json({ memoryNotes: rows });
    });

    // ── Activity ──
    router.get("/api/activity", auth.requireRole("viewer"), (_req, res) => {
        const rows = db.prepare("select * from activity_events order by ts desc limit 300").all();
        res.json({ activity: rows });
    });

    return router;
}
