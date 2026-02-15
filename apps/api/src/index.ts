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
    limit: 240,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/tasks", (req, res) => {
  const dept = req.query.dept?.toString();
  const rows = dept
    ? db
        .prepare(
          "select * from tasks where dept = ? order by updated_at desc limit 200"
        )
        .all(dept)
    : db
        .prepare("select * from tasks order by updated_at desc limit 200")
        .all();
  res.json({ tasks: rows });
});

app.post("/api/tasks/upsert", (req, res) => {
  // expects a normalized payload from message parser (we'll wire later)
  const p = req.body as any;
  if (!p?.id || !p?.dept || !p?.title || !p?.status) {
    return res.status(400).json({ error: "missing required fields" });
  }

  const now = new Date().toISOString();
  const existing = db.prepare("select id from tasks where id=?").get(p.id);
  if (!existing) {
    db.prepare(
      `insert into tasks (id, dept, title, status, owner_agent, eta, blockers, approval_needed, approval_reason, created_at, updated_at, source_session, source_message)
       values (@id, @dept, @title, @status, @owner_agent, @eta, @blockers, @approval_needed, @approval_reason, @created_at, @updated_at, @source_session, @source_message)`
    ).run({
      id: p.id,
      dept: p.dept,
      title: p.title,
      status: p.status,
      owner_agent: p.owner_agent ?? null,
      eta: p.eta ?? null,
      blockers: p.blockers ?? null,
      approval_needed:
        p.approval_needed === undefined ? null : p.approval_needed ? 1 : 0,
      approval_reason: p.approval_reason ?? null,
      created_at: now,
      updated_at: now,
      source_session: p.source_session ?? null,
      source_message: p.source_message ?? null,
    });
  } else {
    db.prepare(
      `update tasks set dept=@dept, title=@title, status=@status, owner_agent=@owner_agent, eta=@eta, blockers=@blockers,
        approval_needed=@approval_needed, approval_reason=@approval_reason, updated_at=@updated_at,
        source_session=@source_session, source_message=@source_message
        where id=@id`
    ).run({
      id: p.id,
      dept: p.dept,
      title: p.title,
      status: p.status,
      owner_agent: p.owner_agent ?? null,
      eta: p.eta ?? null,
      blockers: p.blockers ?? null,
      approval_needed:
        p.approval_needed === undefined ? null : p.approval_needed ? 1 : 0,
      approval_reason: p.approval_reason ?? null,
      updated_at: now,
      source_session: p.source_session ?? null,
      source_message: p.source_message ?? null,
    });
  }

  const eventId = crypto.randomUUID();
  db.prepare(
    "insert into task_events (id, task_id, event_type, payload_json, ts) values (?, ?, ?, ?, ?)"
  ).run(eventId, p.id, "upsert", JSON.stringify(p), now);

  res.json({ ok: true, id: p.id });
});

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[mc-api] listening on http://127.0.0.1:${env.PORT} (CORS origin ${env.WEB_ORIGIN})`);
});
