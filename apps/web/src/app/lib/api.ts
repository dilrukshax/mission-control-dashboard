export type Task = {
  id: string;
  dept: string;
  title: string;
  status: string;
  updated_at: string;
  owner_agent?: string | null;
  blockers?: string | null;
  approval_needed?: number | null;
  approval_reason?: string | null;
};

function apiBase() {
  return process.env.MC_API_BASE ?? "http://127.0.0.1:3001";
}

export async function fetchTasks(dept?: string): Promise<Task[]> {
  const url = new URL(apiBase() + "/api/tasks");
  if (dept) url.searchParams.set("dept", dept);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as { tasks: Task[] };
  return data.tasks ?? [];
}
