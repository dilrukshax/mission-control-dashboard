import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export function openDb(dbPath: string) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    create table if not exists tasks (
      id text primary key,
      dept text not null,
      title text not null,
      status text not null,
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

    create index if not exists idx_task_events_task_id_ts on task_events(task_id, ts);

    create table if not exists audit_log (
      id text primary key,
      actor text,
      action text not null,
      payload_json text not null,
      ts text not null
    );

    create index if not exists idx_audit_ts on audit_log(ts);
  `);

  return db;
}
