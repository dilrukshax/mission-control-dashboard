import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const DEFAULT_AGENTS = [
  { id: "jarvis", name: "Mission Control Team", role: "Coordination", dept: "mission-control" },
  { id: "closer", name: "Sales Team", role: "Sales Execution", dept: "sales-enable" },
  { id: "ghost", name: "Marketing Content Team", role: "Content", dept: "marketing-growth" },
  { id: "hype", name: "Marketing Social Team", role: "Social", dept: "marketing-growth" },
  { id: "forge", name: "Engineering Delivery Team", role: "Delivery", dept: "eng-delivery" },
  { id: "scout", name: "Research Team", role: "Research", dept: "research-intel" },
  { id: "reviewer", name: "Engineering Platform Team", role: "Platform", dept: "eng-platform" },
  { id: "keeper", name: "Knowledge Team", role: "Knowledge Base", dept: "ops-reliability" },
] as const;

export function openDb(dbPath: string) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    create table if not exists agents (
      id text primary key,
      name text not null,
      role text not null,
      dept text not null,
      created_at text not null,
      updated_at text not null
    );

    create table if not exists agent_checkins (
      id text primary key,
      agent_id text not null,
      status text not null,
      current_task text,
      previous_task text,
      note text,
      ts text not null
    );

    create index if not exists idx_agent_checkins_agent_ts on agent_checkins(agent_id, ts desc);

    create table if not exists tasks (
      id text primary key,
      dept text not null,
      title text not null,
      description text,
      status text not null,
      assignee_agent_id text,
      owner_agent text,
      eta text,
      blockers text,
      approval_needed integer,
      approval_reason text,
      created_at text not null,
      updated_at text not null,
      source_session text,
      source_message text
    );

    create table if not exists task_events (
      id text primary key,
      task_id text not null,
      event_type text not null,
      payload_json text not null,
      ts text not null
    );

    create index if not exists idx_task_events_task_id_ts on task_events(task_id, ts desc);

    create table if not exists content_drops (
      id text primary key,
      title text not null,
      dept text not null,
      agent_id text,
      content_type text not null,
      content_preview text,
      link text,
      status text not null,
      created_at text not null
    );

    create table if not exists build_jobs (
      id text primary key,
      title text not null,
      service text not null,
      status text not null,
      started_at text not null,
      finished_at text,
      note text
    );

    create table if not exists revenue_snapshots (
      id text primary key,
      source text not null,
      amount_usd real not null,
      period text,
      captured_at text not null
    );

    create table if not exists memory_notes (
      id text primary key,
      dept text not null,
      agent_id text,
      note text not null,
      created_at text not null
    );

    create table if not exists activity_events (
      id text primary key,
      kind text not null,
      title text not null,
      detail text,
      actor text,
      dept text,
      ts text not null
    );

    create index if not exists idx_activity_ts on activity_events(ts desc);
  `);

  const now = new Date().toISOString();
  const upsertAgent = db.prepare(
    `insert into agents (id, name, role, dept, created_at, updated_at)
     values (@id, @name, @role, @dept, @created_at, @updated_at)
     on conflict(id) do update set
       name=excluded.name,
       role=excluded.role,
       dept=excluded.dept,
       updated_at=excluded.updated_at`
  );

  for (const agent of DEFAULT_AGENTS) {
    upsertAgent.run({ ...agent, created_at: now, updated_at: now });
  }

  return db;
}
