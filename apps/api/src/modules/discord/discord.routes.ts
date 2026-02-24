import { Router } from "express";
import crypto from "node:crypto";
import type Database from "better-sqlite3";
import type { Env } from "../../env.js";
import type { createAuth } from "../../lib/auth.js";
import type { LogActivity } from "../agents/agents.routes.js";
import { pushEvent } from "../../lib/sse.js";
import { nowIso, dateOnly, slugify } from "../../lib/utils.js";
import { getMarkdownFiles, scoreText, summarizeMatch, searchNotesInRoots, createChannelNote } from "../research/research.service.js";
import path from "node:path";
import fs from "node:fs";

function toAgentId(requester: string, requesterId?: string) {
    if (requesterId && requesterId.trim()) return `discord-${slugify(requesterId)}`;
    return `discord-${slugify(requester || "user")}`;
}

function deptFromChannel(channel: string): string {
    const c = channel.toLowerCase();
    if (c === "research-intel" || c === "research") return "research-intel";
    if (c === "company-policy" || c === "policy") return "legal-policy";
    if (c === "sales-enable" || c === "sales") return "sales-enable";
    if (c === "ops-reliability" || c === "ops") return "ops-reliability";
    return "mission-control";
}

export function discordRoutes(
    db: Database.Database,
    env: Env,
    auth: ReturnType<typeof createAuth>,
    logActivity: LogActivity,
) {
    const router = Router();

    function ensureAgentFromDiscord(requester: string, channel: string, requesterId?: string) {
        const id = toAgentId(requester, requesterId);
        const dept = deptFromChannel(channel);
        const ts = nowIso();
        db.prepare(
            `insert into agents (id, name, role, dept, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?)
       on conflict(id) do update set name=excluded.name, dept=excluded.dept, updated_at=excluded.updated_at`
        ).run(id, requester, "Discord Agent", dept, ts, ts);
        return { id, name: requester, dept };
    }

    function checkinAgent(agentId: string, messageText: string, dept: string) {
        const prev = db.prepare(`select current_task from agent_checkins where agent_id=? order by ts desc limit 1`).get(agentId) as { current_task?: string | null } | undefined;
        const currentTask = messageText.slice(0, 140);
        db.prepare(
            `insert into agent_checkins (id, agent_id, status, current_task, previous_task, note, ts) values (?, ?, ?, ?, ?, ?, ?)`
        ).run(crypto.randomUUID(), agentId, "active", currentTask, prev?.current_task ?? null, "Updated from Discord activity", nowIso());
        db.prepare(
            `insert into memory_notes (id, dept, agent_id, note, created_at) values (?, ?, ?, ?, ?)`
        ).run(crypto.randomUUID(), dept, agentId, messageText.slice(0, 500), nowIso());
        pushEvent("agent.checkin", agentId);
    }

    function handleDiscordResearchMessage(input: { channel?: string; text: string; requester?: string }) {
        const text = input.text.trim();
        const createPrefix = /^research\s*:\s*/i;

        if (createPrefix.test(text)) {
            const topic = text.replace(createPrefix, "").trim();
            if (!topic) return { status: 400, body: { error: "research topic missing" } };

            const ts = nowIso();
            const taskId = crypto.randomUUID();
            const assignee = "scout";
            const title = `Research: ${topic}`;
            const description = [`Market: unspecified`, `Output needed: summary with sources and recommendation`, input.requester ? `Requester: ${input.requester}` : null, input.channel ? `Channel: ${input.channel}` : null].filter(Boolean).join("\n");

            db.prepare(`insert into tasks (id, dept, title, description, status, assignee_agent_id, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)`).run(taskId, "research-intel", title, description, "todo", assignee, ts, ts);

            const date = dateOnly();
            const fileName = `${date} - ${slugify(topic)}.md`;
            const relPath = path.join("01-Market", "Research Requests", fileName);
            const absPath = path.join(env.OBSIDIAN_COMPANY_ROOT, relPath);
            fs.mkdirSync(path.dirname(absPath), { recursive: true });
            const note = `# Research Request - ${topic}\n\n## Brief\n- Topic: ${topic}\n- Market: TBD\n- Output Needed: summary with sources and recommendation\n- Requester: ${input.requester ?? "unknown"}\n- Task ID: ${taskId}\n\n## Notes\n- \n`;
            fs.writeFileSync(absPath, note, "utf8");

            logActivity({ kind: "research", title: `Discord research intake: ${topic}`, detail: input.channel, actor: assignee, dept: "research-intel" });
            pushEvent("research.intake", topic);
            return { status: 201, body: { mode: "intake", taskId, notePath: relPath, message: `Created research task and note for: ${topic}` } };
        }

        const researchRoot = path.join(env.OBSIDIAN_COMPANY_ROOT, "01-Market");
        const files = getMarkdownFiles(researchRoot);
        const ranked = files
            .map((file) => {
                const content = fs.readFileSync(file, "utf8");
                const relPath = path.relative(env.OBSIDIAN_COMPANY_ROOT, file);
                const score = scoreText(content, text, relPath);
                return { relPath, score, snippet: summarizeMatch(content, text) };
            })
            .filter((m) => m.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);

        if (ranked.length === 0) {
            return { status: 200, body: { mode: "lookup", answer: "No prior research found for this query.", sources: [] } };
        }
        return { status: 200, body: { mode: "lookup", answer: ranked.map((r, i) => `${i + 1}. ${r.relPath} — ${r.snippet}`).join("\n"), sources: ranked.map((r) => r.relPath) } };
    }

    // ── Routes ──

    router.post("/api/discord/research-message", auth.requireRole("operator"), (req, res) => {
        const p = req.body as { channel?: string; text?: string; requester?: string };
        if (!p.text?.trim()) return res.status(400).json({ error: "text is required" });
        const out = handleDiscordResearchMessage({ channel: p.channel, text: p.text, requester: p.requester });
        return res.status(out.status).json(out.body);
    });

    router.post("/api/discord/sync-agents", auth.requireRole("operator"), (req, res) => {
        const p = req.body as { agents?: Array<{ requester: string; requesterId?: string; channel: string }> };
        if (!Array.isArray(p.agents) || p.agents.length === 0) {
            return res.status(400).json({ error: "agents array is required" });
        }
        const seen = new Set<string>();
        for (const a of p.agents) {
            if (!a?.requester || !a?.channel) continue;
            const agent = ensureAgentFromDiscord(a.requester, a.channel, a.requesterId);
            if (seen.has(agent.id)) continue;
            seen.add(agent.id);
        }
        pushEvent("agent.sync", String(seen.size));
        return res.json({ ok: true, count: seen.size });
    });

    router.post("/api/discord/bridge", auth.requireRole("operator"), (req, res) => {
        const payload = req.body as Record<string, unknown>;
        const text = (typeof payload.text === "string" && payload.text) || (typeof payload.content === "string" && payload.content) || (typeof payload.message === "string" && payload.message) || "";
        const channel = (typeof payload.channel === "string" && payload.channel) || (typeof payload.channel_name === "string" && payload.channel_name) || (typeof payload.channelName === "string" && payload.channelName) || "";
        const requester = (typeof payload.requester === "string" && payload.requester) || (typeof payload.author === "string" && payload.author) || (typeof payload.author_username === "string" && payload.author_username) || "discord-user";
        const requesterId = (typeof payload.requester_id === "string" && payload.requester_id) || (typeof payload.author_id === "string" && payload.author_id) || (typeof payload.authorId === "string" && payload.authorId) || undefined;

        if (!text.trim()) return res.status(400).json({ error: "message text missing" });

        const normalizedChannel = channel.toLowerCase();
        const mappedChannels = new Set(["research-intel", "research", "company-policy", "policy", "sales-enable", "sales", "ops-reliability", "ops"]);
        if (!mappedChannels.has(normalizedChannel)) {
            return res.status(200).json({ ignored: true, reason: "channel not mapped" });
        }

        const agent = ensureAgentFromDiscord(requester, normalizedChannel, requesterId);
        checkinAgent(agent.id, text, agent.dept);

        if (normalizedChannel === "research-intel" || normalizedChannel === "research") {
            const out = handleDiscordResearchMessage({ channel, text, requester });
            return res.status(out.status).json(out.body);
        }

        if (normalizedChannel === "company-policy" || normalizedChannel === "policy") {
            const createPrefix = /^policy\s*:\s*/i;
            if (createPrefix.test(text)) {
                const topic = text.replace(createPrefix, "").trim() || "Policy Note";
                const relPath = createChannelNote(env.OBSIDIAN_COMPANY_ROOT, "00-Company/Policies", `Policy - ${topic}`, requester, text);
                return res.status(201).json({ mode: "policy-intake", message: `Policy note created: ${relPath}`, notePath: relPath });
            }
            const matches = searchNotesInRoots(env.OBSIDIAN_COMPANY_ROOT, text, ["00-Company/Policies", "06-Decisions"]);
            return res.status(200).json({ mode: "policy-lookup", answer: matches.length === 0 ? "No prior policy notes found." : matches.map((m, i) => `${i + 1}. ${m.relPath} — ${m.snippet}`).join("\n"), sources: matches.map((m) => m.relPath) });
        }

        if (normalizedChannel === "sales-enable" || normalizedChannel === "sales") {
            const createPrefix = /^sales\s*:\s*/i;
            if (createPrefix.test(text)) {
                const topic = text.replace(createPrefix, "").trim() || "Sales Note";
                const relPath = createChannelNote(env.OBSIDIAN_COMPANY_ROOT, "03-Sales", `Sales - ${topic}`, requester, text);
                return res.status(201).json({ mode: "sales-intake", message: `Sales note created: ${relPath}`, notePath: relPath });
            }
            const matches = searchNotesInRoots(env.OBSIDIAN_COMPANY_ROOT, text, ["03-Sales", "01-Market"]);
            return res.status(200).json({ mode: "sales-lookup", answer: matches.length === 0 ? "No prior sales notes found." : matches.map((m, i) => `${i + 1}. ${m.relPath} — ${m.snippet}`).join("\n"), sources: matches.map((m) => m.relPath) });
        }

        if (normalizedChannel === "ops-reliability" || normalizedChannel === "ops") {
            const createPrefix = /^ops\s*:\s*/i;
            if (createPrefix.test(text)) {
                const topic = text.replace(createPrefix, "").trim() || "Ops Note";
                const relPath = createChannelNote(env.OBSIDIAN_COMPANY_ROOT, "05-Ops", `Ops - ${topic}`, requester, text);
                return res.status(201).json({ mode: "ops-intake", message: `Ops note created: ${relPath}`, notePath: relPath });
            }
            const matches = searchNotesInRoots(env.OBSIDIAN_COMPANY_ROOT, text, ["05-Ops", "06-Decisions"]);
            return res.status(200).json({ mode: "ops-lookup", answer: matches.length === 0 ? "No prior ops notes found." : matches.map((m, i) => `${i + 1}. ${m.relPath} — ${m.snippet}`).join("\n"), sources: matches.map((m) => m.relPath) });
        }

        return res.status(200).json({ ignored: true, reason: "channel not mapped" });
    });

    return router;
}
