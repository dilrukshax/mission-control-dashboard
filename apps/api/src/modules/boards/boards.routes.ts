import { Router } from "express";
import crypto from "node:crypto";
import type Database from "better-sqlite3";
import type { createAuth } from "../../lib/auth.js";
import type { LogActivity } from "../agents/agents.routes.js";
import { pushEvent } from "../../lib/sse.js";
import { nowIso, slugify } from "../../lib/utils.js";

const DEFAULT_COLUMNS = [
    { key: "todo", title: "To Do", position: 0 },
    { key: "in_progress", title: "In Progress", position: 1 },
    { key: "blocked", title: "Blocked", position: 2 },
    { key: "review", title: "Review", position: 3 },
    { key: "done", title: "Done", position: 4 },
];

export function boardRoutes(
    db: Database.Database,
    auth: ReturnType<typeof createAuth>,
    logActivity: LogActivity,
) {
    const router = Router();

    // ── List boards ──
    router.get("/api/boards", auth.requireRole("viewer"), (req, res) => {
        const dept = req.query.dept?.toString();
        const rows = dept
            ? db.prepare("select * from boards where dept = ? order by updated_at desc").all(dept)
            : db.prepare("select * from boards order by updated_at desc").all();

        // Attach column counts
        const boards = (rows as Array<Record<string, unknown>>).map((board) => {
            const taskCounts = db
                .prepare(
                    `select coalesce(column_key, status) as col, count(*) as cnt
           from tasks where board_id = ? group by col`
                )
                .all(board.id) as Array<{ col: string; cnt: number }>;
            return { ...board, taskCounts: Object.fromEntries(taskCounts.map((r) => [r.col, r.cnt])) };
        });

        res.json({ boards });
    });

    // ── Create board ──
    router.post("/api/boards", auth.requireRole("operator"), (req, res) => {
        const p = req.body as { name?: string; dept?: string; ownerAgent?: string };
        if (!p.name || !p.dept) {
            return res.status(400).json({ error: "name and dept are required" });
        }

        const id = crypto.randomUUID();
        const slug = slugify(p.name);
        const ts = nowIso();

        db.prepare(
            `insert into boards (id, name, slug, dept, owner_agent, status, created_at, updated_at)
       values (?, ?, ?, ?, ?, 'active', ?, ?)`
        ).run(id, p.name, slug, p.dept, p.ownerAgent ?? null, ts, ts);

        // Create default columns
        for (const col of DEFAULT_COLUMNS) {
            db.prepare(
                `insert into board_columns (id, board_id, key, title, position) values (?, ?, ?, ?, ?)`
            ).run(crypto.randomUUID(), id, col.key, col.title, col.position);
        }

        logActivity({ kind: "board", title: `Board created: ${p.name}`, dept: p.dept });
        pushEvent("board.created", p.name);
        res.status(201).json({ ok: true, id, slug });
    });

    // ── Get board ──
    router.get("/api/boards/:id", auth.requireRole("viewer"), (req, res) => {
        const board = db.prepare("select * from boards where id = ? or slug = ?").get(req.params.id, req.params.id);
        if (!board) return res.status(404).json({ error: "board not found" });

        const columns = db
            .prepare("select * from board_columns where board_id = ? order by position asc")
            .all((board as Record<string, unknown>).id);

        res.json({ board, columns });
    });

    // ── Update board ──
    router.patch("/api/boards/:id", auth.requireRole("operator"), (req, res) => {
        const p = req.body as { name?: string; status?: string; ownerAgent?: string };
        const existing = db.prepare("select * from boards where id = ?").get(req.params.id) as Record<string, unknown> | undefined;
        if (!existing) return res.status(404).json({ error: "board not found" });

        const ts = nowIso();
        db.prepare(
            `update boards set name=?, status=?, owner_agent=?, updated_at=? where id=?`
        ).run(
            p.name ?? existing.name,
            p.status ?? existing.status,
            p.ownerAgent === undefined ? existing.owner_agent : p.ownerAgent,
            ts,
            req.params.id
        );

        pushEvent("board.updated", (p.name ?? existing.name) as string);
        res.json({ ok: true });
    });

    // ── List tasks on a board ──
    router.get("/api/boards/:id/tasks", auth.requireRole("viewer"), (req, res) => {
        const boardId = req.params.id;
        // Resolve by id or slug
        const board = db.prepare("select id from boards where id = ? or slug = ?").get(boardId, boardId) as { id: string } | undefined;
        if (!board) return res.status(404).json({ error: "board not found" });

        const tasks = db
            .prepare(
                `select * from tasks where board_id = ? order by priority desc, updated_at desc`
            )
            .all(board.id);

        const columns = db
            .prepare("select * from board_columns where board_id = ? order by position asc")
            .all(board.id);

        res.json({ tasks, columns });
    });

    // ── Add task to board ──
    router.post("/api/boards/:id/tasks", auth.requireRole("operator"), (req, res) => {
        const boardId = req.params.id;
        const board = db.prepare("select id, dept from boards where id = ? or slug = ?").get(boardId, boardId) as { id: string; dept: string } | undefined;
        if (!board) return res.status(404).json({ error: "board not found" });

        const p = req.body as {
            title?: string; description?: string; assigneeAgentId?: string;
            priority?: number; dueAt?: string; columnKey?: string;
        };
        if (!p.title) return res.status(400).json({ error: "title is required" });

        const id = crypto.randomUUID();
        const ts = nowIso();
        const columnKey = p.columnKey ?? "todo";

        db.prepare(
            `insert into tasks (id, dept, title, description, status, assignee_agent_id, board_id, column_key, priority, due_at, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(id, board.dept, p.title, p.description ?? null, columnKey, p.assigneeAgentId ?? null, board.id, columnKey, p.priority ?? 0, p.dueAt ?? null, ts, ts);

        db.prepare(
            "insert into task_events (id, task_id, event_type, payload_json, ts) values (?, ?, ?, ?, ?)"
        ).run(crypto.randomUUID(), id, "created", JSON.stringify({ ...p, boardId: board.id }), ts);

        logActivity({ kind: "task", title: `Board task: ${p.title}`, dept: board.dept, actor: p.assigneeAgentId });
        pushEvent("task.created", p.title);
        res.status(201).json({ ok: true, id });
    });

    return router;
}
