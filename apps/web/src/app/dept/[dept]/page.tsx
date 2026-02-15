import { Nav } from "../../components/Nav";
import { fetchTasks } from "../../lib/api";
import { TaskTable } from "../../components/TaskTable";

export default async function DeptPage({
  params,
}: {
  params: Promise<{ dept: string }>;
}) {
  const { dept } = await params;
  const tasks = await fetchTasks(dept);

  return (
    <div className="min-h-screen">
      <Nav active={dept} />

      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-6 md:grid-cols-3">
        <section className="md:col-span-2">
          <h2 className="mb-2 text-sm font-semibold text-zinc-700">
            Tasks: {dept}
          </h2>
          <TaskTable tasks={tasks} />
        </section>

        <aside>
          <h2 className="mb-2 text-sm font-semibold text-zinc-700">Actions</h2>
          <div className="rounded-lg border bg-white p-4 text-sm text-zinc-600">
            Next: Ask agent + Create task.
          </div>
        </aside>
      </main>
    </div>
  );
}
