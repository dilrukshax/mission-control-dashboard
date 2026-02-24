import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

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

    create table if not exists network_usage_samples (
      at integer primary key,
      ts text not null,
      inbound_bytes_total integer,
      outbound_bytes_total integer,
      inbound_bytes_delta integer,
      outbound_bytes_delta integer
    );

    create index if not exists idx_network_usage_samples_ts on network_usage_samples(ts desc);

    -- ── Boards ──────────────────────────────────────────
    create table if not exists boards (
      id text primary key,
      name text not null,
      slug text not null unique,
      dept text not null,
      owner_agent text,
      status text not null default 'active',
      created_at text not null,
      updated_at text not null
    );

    create table if not exists board_columns (
      id text primary key,
      board_id text not null references boards(id) on delete cascade,
      key text not null,
      title text not null,
      position integer not null default 0,
      wip_limit integer
    );

    create unique index if not exists idx_board_columns_board_key on board_columns(board_id, key);

    -- ── Task transitions (workflow history) ─────────────
    create table if not exists task_transitions (
      id text primary key,
      task_id text not null,
      from_status text not null,
      to_status text not null,
      actor text,
      reason text,
      ts text not null
    );

    create index if not exists idx_task_transitions_task_ts on task_transitions(task_id, ts desc);

    -- ── Activations (automation rules) ──────────────────
    create table if not exists activations (
      id text primary key,
      name text not null,
      trigger_type text not null,
      trigger_config_json text not null default '{}',
      action_type text not null,
      action_config_json text not null default '{}',
      enabled integer not null default 1,
      created_at text not null,
      updated_at text not null
    );

    create table if not exists activation_runs (
      id text primary key,
      activation_id text not null references activations(id) on delete cascade,
      task_id text,
      status text not null,
      result_json text,
      error text,
      ts text not null
    );

    create index if not exists idx_activation_runs_activation_ts on activation_runs(activation_id, ts desc);
    create index if not exists idx_activation_runs_ts on activation_runs(ts desc);
  `);

  // ── Extend tasks table with board/workflow columns (safe ALTER) ──
  const taskColumns = db
    .prepare("pragma table_info(tasks)")
    .all() as Array<{ name: string }>;
  const existing = new Set(taskColumns.map((c) => c.name));

  const addIfMissing = (col: string, sqlType: string) => {
    if (!existing.has(col)) {
      db.exec(`alter table tasks add column ${col} ${sqlType}`);
    }
  };

  addIfMissing("board_id", "text");
  addIfMissing("column_key", "text");
  addIfMissing("priority", "integer default 0");
  addIfMissing("due_at", "text");
  addIfMissing("started_at", "text");
  addIfMissing("completed_at", "text");

  return db;
}
