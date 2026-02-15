type Task = {
  id: string;
  dept: string;
  title: string;
  status: string;
  updated_at: string;
  owner_agent?: string | null;
};

async function getTasks(): Promise<Task[]> {
  const res = await fetch("http://127.0.0.1:3001/api/tasks", {
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { tasks: Task[] };
  return data.tasks ?? [];
}

const TABS = [
  "mission-control",
  "eng-platform",
  "eng-delivery",
  "research-intel",
  "product-strategy",
  "marketing-growth",
  "sales-enable",
  "ops-reliability",
  "finance-ops",
  "legal-policy",
  "cron",
  "approvals",
  "logs",
] as const;

export default async function Home() {
  const tasks = await getTasks();

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="font-semibold">Mission Control</div>
          <div className="text-sm text-zinc-500">LAN dashboard (v0)</div>
        </div>
        <nav className="mx-auto max-w-6xl overflow-x-auto px-6 pb-3">
          <div className="flex gap-2">
            {TABS.map((t) => (
              <div
                key={t}
                className="rounded-full border bg-white px-3 py-1 text-sm text-zinc-700"
              >
                {t}
              </div>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-6 md:grid-cols-3">
        <section className="md:col-span-2">
          <h2 className="mb-2 text-sm font-semibold text-zinc-700">
            Tasks (latest)
          </h2>
          <div className="rounded-lg border bg-white">
            <div className="grid grid-cols-[110px_1fr_120px] gap-2 border-b px-4 py-2 text-xs font-medium text-zinc-500">
              <div>Dept</div>
              <div>Title</div>
              <div>Status</div>
            </div>
            {tasks.length === 0 ? (
              <div className="px-4 py-6 text-sm text-zinc-500">
                No tasks yet. Next: wire auto-sync from agent messages.
              </div>
            ) : (
              tasks.slice(0, 30).map((t) => (
                <div
                  key={t.id}
                  className="grid grid-cols-[110px_1fr_120px] gap-2 px-4 py-2 text-sm hover:bg-zinc-50"
                >
                  <div className="text-xs text-zinc-600">{t.dept}</div>
                  <div className="truncate">{t.title}</div>
                  <div className="text-xs text-zinc-600">{t.status}</div>
                </div>
              ))
            )}
          </div>
        </section>

        <aside>
          <h2 className="mb-2 text-sm font-semibold text-zinc-700">Status</h2>
          <div className="rounded-lg border bg-white p-4 text-sm text-zinc-600">
            <div>API: http://127.0.0.1:3001</div>
            <div>Web: http://0.0.0.0:3000</div>
            <div className="mt-3 text-xs text-zinc-500">
              Next: sessions/runs, cron, approvals, and agent-message auto-sync.
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
