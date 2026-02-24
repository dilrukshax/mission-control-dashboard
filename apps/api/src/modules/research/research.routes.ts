import { Router } from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import type { Env } from "../../env.js";
import type { createAuth } from "../../lib/auth.js";
import type { LogActivity } from "../agents/agents.routes.js";
import { pushEvent } from "../../lib/sse.js";
import { nowIso, dateOnly, slugify } from "../../lib/utils.js";
import { getMarkdownFiles, scoreText, summarizeMatch } from "./research.service.js";

export function researchRoutes(
    db: Database.Database,
    env: Env,
    auth: ReturnType<typeof createAuth>,
    logActivity: LogActivity,
) {
    const router = Router();

    router.post("/api/research/intake", auth.requireRole("operator"), (req, res) => {
        const p = req.body as { topic?: string; market?: string; outputNeeded?: string; deadline?: string; requester?: string; agentId?: string };
        if (!p.topic || !p.market || !p.outputNeeded) {
            return res.status(400).json({ error: "topic, market, outputNeeded are required" });
        }

        const ts = nowIso();
        const taskId = crypto.randomUUID();
        const assignee = p.agentId ?? "scout";
        const title = `Research: ${p.topic}`;
        const description = [
            `Market: ${p.market}`, `Output needed: ${p.outputNeeded}`,
            p.deadline ? `Deadline: ${p.deadline}` : null,
            p.requester ? `Requester: ${p.requester}` : null,
        ].filter(Boolean).join("\n");

        db.prepare(
            `insert into tasks (id, dept, title, description, status, assignee_agent_id, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(taskId, "research-intel", title, description, "todo", assignee, ts, ts);

        db.prepare(
            "insert into task_events (id, task_id, event_type, payload_json, ts) values (?, ?, ?, ?, ?)"
        ).run(crypto.randomUUID(), taskId, "research_intake", JSON.stringify(p), ts);

        const date = dateOnly();
        const fileName = `${date} - ${slugify(p.topic)}.md`;
        const relPath = path.join("01-Market", "Research Requests", fileName);
        const absPath = path.join(env.OBSIDIAN_COMPANY_ROOT, relPath);
        fs.mkdirSync(path.dirname(absPath), { recursive: true });

        const note = `# Research Request - ${p.topic}\n\n## Brief\n- Topic: ${p.topic}\n- Market: ${p.market}\n- Output Needed: ${p.outputNeeded}\n- Deadline: ${p.deadline ?? "TBD"}\n- Requester: ${p.requester ?? "unknown"}\n- Assigned Agent: ${assignee}\n- Task ID: ${taskId}\n\n## Expected Deliverable\n${p.outputNeeded}\n\n## Sources\n- [ ] Add source links\n\n## Confidence\n- [ ] High / Medium / Low + reasoning\n\n## Notes\n- \n`;
        fs.writeFileSync(absPath, note, "utf8");

        logActivity({ kind: "research", title: `Research intake: ${p.topic}`, detail: p.market, actor: assignee, dept: "research-intel" });
        pushEvent("research.intake", p.topic);
        res.status(201).json({ ok: true, taskId, assignee, notePath: relPath });
    });

    router.get("/api/research/search", auth.requireRole("viewer"), (req, res) => {
        const q = req.query.q?.toString().trim();
        if (!q) return res.status(400).json({ error: "q is required" });

        const researchRoot = path.join(env.OBSIDIAN_COMPANY_ROOT, "01-Market");
        const files = getMarkdownFiles(researchRoot);
        const matches = files
            .map((file) => {
                const content = fs.readFileSync(file, "utf8");
                const relPath = path.relative(env.OBSIDIAN_COMPANY_ROOT, file);
                const score = scoreText(content, q, relPath);
                return { path: relPath, score, snippet: summarizeMatch(content, q) };
            })
            .filter((m) => m.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 8);

        res.json({ query: q, matches });
    });

    router.post("/api/research/answer", auth.requireRole("viewer"), (req, res) => {
        const p = req.body as { query?: string };
        const query = p.query?.trim();
        if (!query) return res.status(400).json({ error: "query is required" });

        const researchRoot = path.join(env.OBSIDIAN_COMPANY_ROOT, "01-Market");
        const files = getMarkdownFiles(researchRoot);
        const ranked = files
            .map((file) => {
                const content = fs.readFileSync(file, "utf8");
                const relPath = path.relative(env.OBSIDIAN_COMPANY_ROOT, file);
                const score = scoreText(content, query, relPath);
                return { file, relPath, score, snippet: summarizeMatch(content, query) };
            })
            .filter((m) => m.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 4);

        if (ranked.length === 0) {
            return res.json({ answer: "No prior research note matched this query.", sources: [] });
        }

        const answer = [
            `Based on prior research notes, I found ${ranked.length} relevant source(s):`,
            ...ranked.map((r, i) => `${i + 1}. ${r.relPath} — ${r.snippet}`),
        ].join("\n");

        res.json({ answer, sources: ranked.map((r) => ({ path: r.relPath, score: r.score })) });
    });

    return router;
}
