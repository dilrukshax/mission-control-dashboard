export type Agent = {
  id: string;
  name: string;
  role: string;
  dept: string;
  current_status?: "active" | "sleeping" | null;
  current_task?: string | null;
  previous_task?: string | null;
  note?: string | null;
  last_checkin_at?: string | null;
};

export type Task = {
  id: string;
  dept: string;
  title: string;
  description?: string | null;
  status: string;
  assignee_agent_id?: string | null;
  updated_at: string;
};

export type ContentDrop = {
  id: string;
  title: string;
  dept: string;
  agent_id?: string | null;
  content_type: string;
  content_preview?: string | null;
  link?: string | null;
  status: string;
  created_at: string;
};

export type BuildJob = {
  id: string;
  title: string;
  service: string;
  status: string;
  started_at: string;
  finished_at?: string | null;
  note?: string | null;
};

export type RevenueSnapshot = {
  id: string;
  source: string;
  amount_usd: number;
  period?: string | null;
  captured_at: string;
};

export type ActivityEvent = {
  id: string;
  kind: string;
  title: string;
  detail?: string | null;
  actor?: string | null;
  dept?: string | null;
  ts: string;
};

function apiBase() {
  return process.env.MC_API_BASE ?? "http://127.0.0.1:3001";
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function fetchAgents(): Promise<Agent[]> {
  const data = await getJson<{ agents: Agent[] }>("/api/agents");
  return data.agents ?? [];
}

export async function fetchTasks(dept?: string): Promise<Task[]> {
  const url = new URL(`${apiBase()}/api/tasks`);
  if (dept) url.searchParams.set("dept", dept);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as { tasks: Task[] };
  return data.tasks ?? [];
}

export async function fetchContentDrops(): Promise<ContentDrop[]> {
  const data = await getJson<{ contentDrops: ContentDrop[] }>("/api/content-drops");
  return data.contentDrops ?? [];
}

export async function fetchBuildJobs(): Promise<BuildJob[]> {
  const data = await getJson<{ buildJobs: BuildJob[] }>("/api/build-jobs");
  return data.buildJobs ?? [];
}

export async function fetchRevenue(): Promise<{ snapshots: RevenueSnapshot[]; totalUsd: number }> {
  return getJson<{ snapshots: RevenueSnapshot[]; totalUsd: number }>("/api/revenue");
}

export async function fetchActivity(): Promise<ActivityEvent[]> {
  const data = await getJson<{ activity: ActivityEvent[] }>("/api/activity");
  return data.activity ?? [];
}
