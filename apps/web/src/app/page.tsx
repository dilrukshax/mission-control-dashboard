import { Nav } from "./components/Nav";
import { AgentCard } from "./components/AgentCard";
import { fetchAgents, fetchTasks } from "./lib/api";
import { TaskTable } from "./components/TaskTable";
import { QuickTaskForm } from "./components/QuickCreateForms";

export default async function Home() {
  const [agents, tasks] = await Promise.all([fetchAgents(), fetchTasks()]);

  const activeCount = agents.filter((a) => a.current_status === "active").length;
  const sleepingCount = agents.filter((a) => a.current_status === "sleeping").length;

  return (
    <div className="min-h-screen">
      <Nav active="dashboard" />

      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-6">
        <section className="grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border bg-white p-4">
            <div className="text-xs text-zinc-500">Agents</div>
            <div className="mt-1 text-2xl font-semibold">{agents.length}</div>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <div className="text-xs text-zinc-500">Active</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-600">{activeCount}</div>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <div className="text-xs text-zinc-500">Sleeping</div>
            <div className="mt-1 text-2xl font-semibold text-zinc-600">{sleepingCount}</div>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <div className="text-xs text-zinc-500">Open tasks</div>
            <div className="mt-1 text-2xl font-semibold">{tasks.filter((t) => t.status !== "done").length}</div>
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-zinc-700">Agent status</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2">
            <h2 className="mb-2 text-sm font-semibold text-zinc-700">Latest tasks</h2>
            <TaskTable tasks={tasks} />
          </div>
          <QuickTaskForm />
        </section>
      </main>
    </div>
  );
}
