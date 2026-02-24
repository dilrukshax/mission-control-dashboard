import crypto from "node:crypto";
import type Database from "better-sqlite3";
import { nowIso } from "../../lib/utils.js";
import { pushEvent } from "../../lib/sse.js";
import type { LogActivity } from "../agents/agents.routes.js";

// ── Valid status transitions ─────────────────────────────
const VALID_TRANSITIONS: Record<string, string[]> = {
    todo: ["in_progress", "blocked"],
    in_progress: ["review", "blocked", "done"],
    review: ["in_progress", "done", "blocked"],
    blocked: ["todo", "in_progress"],
    done: [], // terminal — owner can force-reopen via separate endpoint
};

export type MoveResult =
    | { ok: true; from: string; to: string }
    | { ok: false; error: string };

export function createWorkflowService(db: Database.Database, logActivity: LogActivity) {
    /**
     * Move a task to a new status/column.
     * Enforces state machine. Records transition + event + activity.
     */
    function moveTask(params: {
        taskId: string;
        toStatus: string;
        actor?: string;
        reason?: string;
        force?: boolean;
    }): MoveResult {
        const task = db.prepare("select id, status, title, dept, board_id from tasks where id = ?").get(params.taskId) as
            | { id: string; status: string; title: string; dept: string; board_id: string | null }
            | undefined;

        if (!task) return { ok: false, error: "task not found" };

        const fromStatus = task.status;
        const toStatus = params.toStatus;

        if (fromStatus === toStatus) return { ok: false, error: "already in this status" };

        // Check allowed transition (unless forced by owner)
        if (!params.force) {
            const allowed = VALID_TRANSITIONS[fromStatus] ?? [];
            if (!allowed.includes(toStatus)) {
                return { ok: false, error: `cannot move from '${fromStatus}' to '${toStatus}'` };
            }
        }

        const ts = nowIso();

        // 1) Update task status + column_key + timestamps
        const updates: Record<string, unknown> = { status: toStatus, column_key: toStatus, updated_at: ts };
        if (toStatus === "in_progress" && fromStatus === "todo") updates.started_at = ts;
        if (toStatus === "done") updates.completed_at = ts;

        const setClauses = Object.keys(updates).map((k) => `${k}=@${k}`).join(", ");
        db.prepare(`update tasks set ${setClauses} where id=@id`).run({ ...updates, id: params.taskId });

        // 2) Insert task_transitions
        db.prepare(
            `insert into task_transitions (id, task_id, from_status, to_status, actor, reason, ts)
       values (?, ?, ?, ?, ?, ?, ?)`
        ).run(crypto.randomUUID(), params.taskId, fromStatus, toStatus, params.actor ?? null, params.reason ?? null, ts);

        // 3) Insert task_events
        db.prepare(
            "insert into task_events (id, task_id, event_type, payload_json, ts) values (?, ?, ?, ?, ?)"
        ).run(
            crypto.randomUUID(),
            params.taskId,
            "moved",
            JSON.stringify({ from: fromStatus, to: toStatus, actor: params.actor, reason: params.reason }),
            ts
        );

        // 4) Push SSE event
        pushEvent("task.moved", `${task.title}: ${fromStatus} → ${toStatus}`);

        // 5) Log to activity_events
        logActivity({
            kind: "task",
            title: `Task moved: ${task.title}`,
            detail: `${fromStatus} → ${toStatus}${params.reason ? ` (${params.reason})` : ""}`,
            actor: params.actor,
            dept: task.dept,
        });

        return { ok: true, from: fromStatus, to: toStatus };
    }

    /**
     * Get full timeline for a task (transitions + events merged, sorted by ts desc).
     */
    function getTaskTimeline(taskId: string) {
        const transitions = db
            .prepare("select id, from_status, to_status, actor, reason, ts from task_transitions where task_id = ? order by ts desc")
            .all(taskId) as Array<{ id: string; from_status: string; to_status: string; actor: string | null; reason: string | null; ts: string }>;

        const events = db
            .prepare("select id, event_type, payload_json, ts from task_events where task_id = ? order by ts desc")
            .all(taskId) as Array<{ id: string; event_type: string; payload_json: string; ts: string }>;

        const timeline = [
            ...transitions.map((t) => ({
                id: t.id,
                type: "transition" as const,
                from: t.from_status,
                to: t.to_status,
                actor: t.actor,
                detail: t.reason,
                ts: t.ts,
            })),
            ...events.map((e) => ({
                id: e.id,
                type: "event" as const,
                eventType: e.event_type,
                payload: e.payload_json,
                ts: e.ts,
            })),
        ].sort((a, b) => b.ts.localeCompare(a.ts));

        return timeline;
    }

    /**
     * Get all ongoing (non-done) tasks grouped by board/column/assignee.
     */
    function getOngoingProcess() {
        const tasks = db
            .prepare(
                `select t.*, b.name as board_name, b.slug as board_slug
         from tasks t
         left join boards b on b.id = t.board_id
         where t.status != 'done'
         order by t.priority desc, t.updated_at desc`
            )
            .all() as Array<Record<string, unknown>>;

        // Group by column_key
        const byColumn: Record<string, unknown[]> = {};
        for (const task of tasks) {
            const col = (task.column_key as string) || (task.status as string) || "todo";
            if (!byColumn[col]) byColumn[col] = [];
            byColumn[col].push(task);
        }

        // Stats
        const total = tasks.length;
        const blocked = tasks.filter((t) => t.status === "blocked").length;
        const inProgress = tasks.filter((t) => t.status === "in_progress").length;
        const review = tasks.filter((t) => t.status === "review").length;

        return { total, blocked, inProgress, review, byColumn, tasks };
    }

    return { moveTask, getTaskTimeline, getOngoingProcess, VALID_TRANSITIONS };
}

export type WorkflowServiceInstance = ReturnType<typeof createWorkflowService>;
