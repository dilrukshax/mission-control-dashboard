import { Router } from "express";
import type Database from "better-sqlite3";
import type { createAuth } from "../../lib/auth.js";
import type { WorkflowServiceInstance } from "./workflow.service.js";

/**
 * Workflow & process routes — the single authoritative module for
 * task state transitions, work queue, and KPI stats.
 */
export function workflowRoutes(
    db: Database.Database,
    auth: ReturnType<typeof createAuth>,
    workflow: WorkflowServiceInstance,
) {
    const router = Router();

    // ── Move task (strict transitions) ──
    router.patch("/api/tasks/:id/move", auth.requireRole("operator"), (req, res) => {
        const p = req.body as { toStatus?: string; actor?: string; reason?: string; force?: boolean };
        if (!p.toStatus) return res.status(400).json({ error: "toStatus is required" });

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

    // ── Task timeline ──
    router.get("/api/tasks/:id/timeline", auth.requireRole("viewer"), (req, res) => {
        const timeline = workflow.getTaskTimeline(req.params.id);
        res.json({ timeline });
    });

    // ── Work queue (operator's default view) ──
    router.get("/api/process/queue", auth.requireRole("viewer"), (_req, res) => {
        const now = new Date();
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

        const blocked = db
            .prepare("select * from tasks where status = 'blocked' order by updated_at desc")
            .all() as Array<Record<string, unknown>>;

        const needsReview = db
            .prepare("select * from tasks where status = 'review' order by updated_at desc")
            .all() as Array<Record<string, unknown>>;

        const dueToday = db
            .prepare("select * from tasks where due_at is not null and due_at <= ? and status not in ('done','blocked') order by due_at asc")
            .all(todayEnd) as Array<Record<string, unknown>>;

        const unassigned = db
            .prepare("select * from tasks where assignee_agent_id is null and status not in ('done','blocked','review') order by priority desc, created_at asc")
            .all() as Array<Record<string, unknown>>;

        const inProgress = db
            .prepare("select * from tasks where status = 'in_progress' order by priority desc, updated_at desc")
            .all() as Array<Record<string, unknown>>;

        // Stale: in_progress for > 24h with no update
        const staleThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        const stale = db
            .prepare("select * from tasks where status = 'in_progress' and updated_at < ? order by updated_at asc")
            .all(staleThreshold) as Array<Record<string, unknown>>;

        // KPI strip
        const totalActive = db
            .prepare("select count(*) as cnt from tasks where status != 'done'")
            .get() as { cnt: number };

        const overdueCount = db
            .prepare("select count(*) as cnt from tasks where due_at is not null and due_at < ? and status not in ('done')")
            .get(now.toISOString()) as { cnt: number };

        res.json({
            kpi: {
                totalActive: totalActive.cnt,
                blocked: blocked.length,
                overdue: overdueCount.cnt,
                stale: stale.length,
                needsReview: needsReview.length,
            },
            sections: {
                blocked,
                needsReview,
                dueToday,
                unassigned,
                inProgress,
                stale,
            },
        });
    });

    // ── Ongoing process ──
    router.get("/api/process/ongoing", auth.requireRole("viewer"), (_req, res) => {
        const ongoing = workflow.getOngoingProcess();
        res.json(ongoing);
    });

    // ── KPI stats (cycle time, throughput, bottlenecks) ──
    router.get("/api/process/stats", auth.requireRole("viewer"), (_req, res) => {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

        // Cycle time: avg (completed_at - started_at) for done tasks
        const cycleTimes = db
            .prepare(
                `select started_at, completed_at from tasks
         where status = 'done' and started_at is not null and completed_at is not null
         order by completed_at desc limit 50`
            )
            .all() as Array<{ started_at: string; completed_at: string }>;

        let avgCycleHours: number | null = null;
        if (cycleTimes.length > 0) {
            const totalMs = cycleTimes.reduce((sum, t) => {
                return sum + (new Date(t.completed_at).getTime() - new Date(t.started_at).getTime());
            }, 0);
            avgCycleHours = Math.round((totalMs / cycleTimes.length / (1000 * 60 * 60)) * 10) / 10;
        }

        // Throughput: tasks completed this week
        const throughput = db
            .prepare("select count(*) as cnt from tasks where status = 'done' and completed_at >= ?")
            .get(weekAgo) as { cnt: number };

        // Bottleneck: column with most tasks stuck longest
        const columnDwell = db
            .prepare(
                `select coalesce(column_key, status) as col, count(*) as cnt,
                avg(julianday('now') - julianday(updated_at)) * 24 as avg_hours
         from tasks where status != 'done'
         group by col order by avg_hours desc limit 1`
            )
            .get() as { col: string; cnt: number; avg_hours: number } | undefined;

        // Stale count
        const staleThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        const staleCount = db
            .prepare("select count(*) as cnt from tasks where status = 'in_progress' and updated_at < ?")
            .get(staleThreshold) as { cnt: number };

        // Activation stats
        const activationSuccess = db
            .prepare("select count(*) as cnt from activation_runs where status = 'success' and ts >= ?")
            .get(weekAgo) as { cnt: number };
        const activationFail = db
            .prepare("select count(*) as cnt from activation_runs where status = 'error' and ts >= ?")
            .get(weekAgo) as { cnt: number };

        res.json({
            avgCycleHours,
            throughputThisWeek: throughput.cnt,
            bottleneck: columnDwell
                ? { column: columnDwell.col, taskCount: columnDwell.cnt, avgHours: Math.round(columnDwell.avg_hours * 10) / 10 }
                : null,
            staleInProgress: staleCount.cnt,
            activations: {
                successThisWeek: activationSuccess.cnt,
                failedThisWeek: activationFail.cnt,
            },
        });
    });

    return router;
}
