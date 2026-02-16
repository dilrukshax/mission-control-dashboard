import { Nav } from "../components/Nav";
import { fetchTasks } from "../lib/api";
import { TaskTable } from "../components/TaskTable";
import { QuickTaskForm } from "../components/QuickCreateForms";

export default async function TasksPage() {
  const tasks = await fetchTasks();

  return (
    <div className="min-h-screen">
      <Nav active="tasks" />
      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-6 md:grid-cols-3">
        <section className="md:col-span-2">
          <h2 className="mb-2 text-sm font-semibold text-zinc-700">Task board</h2>
          <TaskTable tasks={tasks} />
        </section>
        <QuickTaskForm />
      </main>
    </div>
  );
}
