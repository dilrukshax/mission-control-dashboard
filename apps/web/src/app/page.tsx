import { Nav } from "./components/Nav";
import { fetchTasks } from "./lib/api";
import { TaskTable } from "./components/TaskTable";

export default async function Home() {
  const tasks = await fetchTasks();

  return (
    <div className="min-h-screen">
      <Nav active="mission-control" />

      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-6 md:grid-cols-3">
        <section className="md:col-span-2">
          <h2 className="mb-2 text-sm font-semibold text-zinc-700">
            Company tasks (latest)
          </h2>
          <TaskTable tasks={tasks} />
        </section>

        <aside>
          <h2 className="mb-2 text-sm font-semibold text-zinc-700">Next</h2>
          <div className="rounded-lg border bg-white p-4 text-sm text-zinc-600">
            <div>Wire auto-sync from OpenClaw agent messages → tasks.</div>
            <div className="mt-2">
              Add: cron, logs, approvals panels.
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
