import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import crypto from "node:crypto";
import { getEnv } from "./env.js";
import { openDb } from "./db.js";

const env = getEnv();
const db = openDb(env.DB_PATH);

const app = express();
app.set("trust proxy", true);

app.use(express.json({ limit: "1mb" }));
app.use(
  cors({
    origin: env.WEB_ORIGIN,
    credentials: false,
  })
);

app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

function nowIso() {
  return new Date().toISOString();
}

type StreamEvent = {
  id: string;
  kind: string;
  ts: string;
  summary?: string;
};

const sseClients = new Set<express.Response>();

function pushEvent(kind: string, summary?: string) {
  const evt: StreamEvent = {
    id: crypto.randomUUID(),
    kind,
    ts: nowIso(),
    summary,
  };

  const payload = `id: ${evt.id}\nevent: update\ndata: ${JSON.stringify(evt)}\n\n`;
  for (const res of sseClients) {
    res.write(payload);
  }
}

function logActivity(params: {
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
}

type UserRole = "viewer" | "operator" | "owner";

const roleRank: Record<UserRole, number> = {
  viewer: 1,
  operator: 2,
  owner: 3,
};

const authEnabled =
  !!env.AUTH_OWNER_KEY || !!env.AUTH_OPERATOR_KEY || !!env.AUTH_VIEWER_KEY;

function extractApiKey(req: express.Request): string | null {
  const xKey = req.header("x-mc-key");
  if (xKey) return xKey;

  const auth = req.header("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }

  const queryKey = req.query.key;
  if (typeof queryKey === "string" && queryKey.length > 0) return queryKey;

  return null;
}

function resolveRole(req: express.Request): UserRole | null {
  if (!authEnabled) return "owner";

  const key = extractApiKey(req);
  if (!key) return null;

  if (env.AUTH_OWNER_KEY && key === env.AUTH_OWNER_KEY) return "owner";
  if (env.AUTH_OPERATOR_KEY && key === env.AUTH_OPERATOR_KEY) return "operator";
  if (env.AUTH_VIEWER_KEY && key === env.AUTH_VIEWER_KEY) return "viewer";

  return null;
}

function requireRole(minRole: UserRole): express.RequestHandler {
  return (req, res, next) => {
    const role = resolveRole(req);
    if (!role || roleRank[role] < roleRank[minRole]) {
      return res.status(403).json({
        error: "forbidden",
        requiredRole: minRole,
      });
    }

    next();
  };
}

app.get("/api/stream", requireRole("viewer"), (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  res.write(`event: hello\ndata: ${JSON.stringify({ ts: nowIso() })}\n\n`);

  sseClients.add(res);

  const keepAlive = setInterval(() => {
    res.write(`event: ping\ndata: ${JSON.stringify({ ts: nowIso() })}\n\n`);
  }, 25_000);

  req.on("close", () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, authEnabled });
});

app.get("/api/auth/me", (req, res) => {
  const role = resolveRole(req);
  if (!role) return res.status(401).json({ error: "unauthorized" });
  res.json({ role });
});

app.get("/api/agents", requireRole("viewer"), (_req, res) => {
  const rows = db
    .prepare(
      `
      select
        a.id,
        a.name,
        a.role,
        a.dept,
        c.status as current_status,
        c.current_task,
        c.previous_task,
        c.note,
        c.ts as last_checkin_at
      from agents a
      left join agent_checkins c on c.id = (
        select c2.id from agent_checkins c2
        where c2.agent_id = a.id
        order by c2.ts desc
        limit 1
      )
      order by a.name asc
      `
    )
    .all();

  res.json({ agents: rows });
});

app.post("/api/agents/checkin", requireRole("operator"), (req, res) => {
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
  ).run(
    crypto.randomUUID(),
    p.agentId,
    p.status,
    p.currentTask ?? null,
    p.previousTask ?? null,
    p.note ?? null,
    ts
  );

  logActivity({
    kind: "checkin",
    title: `Agent ${p.agentId} checked in`,
    detail: p.currentTask ?? p.note,
    actor: p.agentId,
  });
  pushEvent("agent.checkin", p.agentId);

  res.json({ ok: true });
});

app.get("/api/tasks", requireRole("viewer"), (req, res) => {
  const dept = req.query.dept?.toString();
  const rows = dept
    ? db
        .prepare(
          "select * from tasks where dept = ? order by updated_at desc limit 300"
        )
        .all(dept)
    : db.prepare("select * from tasks order by updated_at desc limit 300").all();

  res.json({ tasks: rows });
});

app.post("/api/tasks", requireRole("operator"), (req, res) => {
  const p = req.body as {
    title?: string;
    description?: string;
    dept?: string;
    status?: string;
    assigneeAgentId?: string;
  };

  if (!p?.title || !p?.dept) {
    return res.status(400).json({ error: "title and dept are required" });
  }

  const id = crypto.randomUUID();
  const ts = nowIso();
  const status = p.status ?? "todo";

  db.prepare(
    `insert into tasks (
      id, dept, title, description, status, assignee_agent_id,
      created_at, updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, p.dept, p.title, p.description ?? null, status, p.assigneeAgentId ?? null, ts, ts);

  db.prepare(
    "insert into task_events (id, task_id, event_type, payload_json, ts) values (?, ?, ?, ?, ?)"
  ).run(crypto.randomUUID(), id, "created", JSON.stringify(p), ts);

  logActivity({
    kind: "task",
    title: `Task created: ${p.title}`,
    detail: p.description,
    actor: p.assigneeAgentId,
    dept: p.dept,
  });
  pushEvent("task.created", p.title);

  res.status(201).json({ ok: true, id });
});

app.patch("/api/tasks/:id", requireRole("operator"), (req, res) => {
  const id = req.params.id;
  const p = req.body as {
    title?: string;
    description?: string;
    dept?: string;
    status?: string;
    assigneeAgentId?: string | null;
    blockers?: string | null;
  };

  const existing = db.prepare("select * from tasks where id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  if (!existing) return res.status(404).json({ error: "task not found" });

  const next = {
    title: p.title ?? (existing.title as string),
    description: p.description ?? (existing.description as string | null),
    dept: p.dept ?? (existing.dept as string),
    status: p.status ?? (existing.status as string),
    assigneeAgentId:
      p.assigneeAgentId === undefined
        ? (existing.assignee_agent_id as string | null)
        : p.assigneeAgentId,
    blockers:
      p.blockers === undefined
        ? (existing.blockers as string | null)
        : p.blockers,
  };

  const ts = nowIso();
  db.prepare(
    `update tasks
     set title=?, description=?, dept=?, status=?, assignee_agent_id=?, blockers=?, updated_at=?
     where id=?`
  ).run(
    next.title,
    next.description,
    next.dept,
    next.status,
    next.assigneeAgentId,
    next.blockers,
    ts,
    id
  );

  db.prepare(
    "insert into task_events (id, task_id, event_type, payload_json, ts) values (?, ?, ?, ?, ?)"
  ).run(crypto.randomUUID(), id, "updated", JSON.stringify(p), ts);

  logActivity({
    kind: "task",
    title: `Task updated: ${next.title}`,
    detail: `Status ${next.status}`,
    actor: next.assigneeAgentId ?? undefined,
    dept: next.dept,
  });
  pushEvent("task.updated", next.title);

  res.json({ ok: true });
});

app.post("/api/tasks/upsert", requireRole("operator"), (req, res) => {
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
      id: p.id,
      dept: p.dept,
      title: p.title,
      description: p.description ?? null,
      status: p.status,
      assignee_agent_id: p.assignee_agent_id ?? null,
      owner_agent: p.owner_agent ?? null,
      eta: p.eta ?? null,
      blockers: p.blockers ?? null,
      approval_needed:
        p.approval_needed === undefined ? null : p.approval_needed ? 1 : 0,
      approval_reason: p.approval_reason ?? null,
      created_at: ts,
      updated_at: ts,
      source_session: p.source_session ?? null,
      source_message: p.source_message ?? null,
    });
  } else {
    db.prepare(
      `update tasks set dept=@dept, title=@title, description=@description, status=@status, assignee_agent_id=@assignee_agent_id, owner_agent=@owner_agent, eta=@eta, blockers=@blockers,
        approval_needed=@approval_needed, approval_reason=@approval_reason, updated_at=@updated_at,
        source_session=@source_session, source_message=@source_message where id=@id`
    ).run({
      id: p.id,
      dept: p.dept,
      title: p.title,
      description: p.description ?? null,
      status: p.status,
      assignee_agent_id: p.assignee_agent_id ?? null,
      owner_agent: p.owner_agent ?? null,
      eta: p.eta ?? null,
      blockers: p.blockers ?? null,
      approval_needed:
        p.approval_needed === undefined ? null : p.approval_needed ? 1 : 0,
      approval_reason: p.approval_reason ?? null,
      updated_at: ts,
      source_session: p.source_session ?? null,
      source_message: p.source_message ?? null,
    });
  }

  db.prepare(
    "insert into task_events (id, task_id, event_type, payload_json, ts) values (?, ?, ?, ?, ?)"
  ).run(crypto.randomUUID(), p.id, "upsert", JSON.stringify(p), ts);

  logActivity({
    kind: "task",
    title: `Task upsert: ${p.title}`,
    detail: p.status,
    actor: p.assignee_agent_id,
    dept: p.dept,
  });
  pushEvent("task.upsert", p.title);

  res.json({ ok: true, id: p.id });
});

app.get("/api/content-drops", requireRole("viewer"), (_req, res) => {
  const rows = db
    .prepare("select * from content_drops order by created_at desc limit 200")
    .all();
  res.json({ contentDrops: rows });
});

app.post("/api/content-drops", requireRole("operator"), (req, res) => {
  const p = req.body as {
    title?: string;
    dept?: string;
    agentId?: string;
    contentType?: string;
    contentPreview?: string;
    link?: string;
    status?: string;
  };

  if (!p?.title || !p?.dept || !p?.contentType) {
    return res.status(400).json({ error: "title, dept, contentType required" });
  }

  db.prepare(
    `insert into content_drops (id, title, dept, agent_id, content_type, content_preview, link, status, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    crypto.randomUUID(),
    p.title,
    p.dept,
    p.agentId ?? null,
    p.contentType,
    p.contentPreview ?? null,
    p.link ?? null,
    p.status ?? "submitted",
    nowIso()
  );

  logActivity({
    kind: "content",
    title: `Content drop: ${p.title}`,
    detail: p.contentType,
    actor: p.agentId,
    dept: p.dept,
  });
  pushEvent("content.created", p.title);

  res.status(201).json({ ok: true });
});

app.get("/api/build-jobs", requireRole("viewer"), (_req, res) => {
  const rows = db
    .prepare("select * from build_jobs order by started_at desc limit 200")
    .all();
  res.json({ buildJobs: rows });
});

app.post("/api/build-jobs", requireRole("operator"), (req, res) => {
  const p = req.body as {
    title?: string;
    service?: string;
    status?: string;
    note?: string;
    finishedAt?: string;
  };

  if (!p?.title || !p?.service || !p?.status) {
    return res.status(400).json({ error: "title, service, status required" });
  }

  db.prepare(
    `insert into build_jobs (id, title, service, status, started_at, finished_at, note)
     values (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    crypto.randomUUID(),
    p.title,
    p.service,
    p.status,
    nowIso(),
    p.finishedAt ?? null,
    p.note ?? null
  );

  logActivity({
    kind: "build",
    title: `Build ${p.status}: ${p.title}`,
    detail: p.note,
  });
  pushEvent("build.created", p.title);

  res.status(201).json({ ok: true });
});

app.get("/api/revenue", requireRole("viewer"), (_req, res) => {
  const snapshots = db
    .prepare("select * from revenue_snapshots order by captured_at desc limit 120")
    .all() as { amount_usd: number }[];
  const totalUsd = snapshots.reduce((sum, row) => sum + (row.amount_usd ?? 0), 0);
  res.json({ snapshots, totalUsd });
});

app.post("/api/revenue", requireRole("operator"), (req, res) => {
  const p = req.body as { source?: string; amountUsd?: number; period?: string };
  if (!p?.source || typeof p.amountUsd !== "number") {
    return res.status(400).json({ error: "source and amountUsd required" });
  }

  db.prepare(
    `insert into revenue_snapshots (id, source, amount_usd, period, captured_at)
     values (?, ?, ?, ?, ?)`
  ).run(crypto.randomUUID(), p.source, p.amountUsd, p.period ?? null, nowIso());

  logActivity({
    kind: "revenue",
    title: `Revenue snapshot: $${p.amountUsd.toFixed(2)}`,
    detail: p.source,
  });
  pushEvent("revenue.created", p.source);

  res.status(201).json({ ok: true });
});

app.get("/api/activity", requireRole("viewer"), (_req, res) => {
  const rows = db
    .prepare("select * from activity_events order by ts desc limit 300")
    .all();
  res.json({ activity: rows });
});

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(
    `[mc-api] listening on http://127.0.0.1:${env.PORT} (CORS origin ${env.WEB_ORIGIN})`
  );
});
