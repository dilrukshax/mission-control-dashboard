import { fetchTasks } from "../lib/api";
import { TaskTable } from "../components/TaskTable";
import { QuickTaskForm } from "../components/QuickCreateForms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TasksPage() {
  const tasks = await fetchTasks();

  const todo = tasks.filter((t) => t.status === "todo").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const blocked = tasks.filter((t) => t.status === "blocked").length;
  const done = tasks.filter((t) => t.status === "done").length;

  const stats = [
    { label: "To Do", value: todo, color: "text-muted-foreground" },
    { label: "In Progress", value: inProgress, color: "text-blue-600 dark:text-blue-400" },
    { label: "Blocked", value: blocked, color: "text-amber-600 dark:text-amber-400" },
    { label: "Done", value: done, color: "text-emerald-600 dark:text-emerald-400" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight leading-tight">Tasks</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Manage and track all tasks across departments</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className={`text-[11px] font-medium uppercase tracking-wider ${s.color}`}>{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TaskTable tasks={tasks} />
        </div>
        <QuickTaskForm />
      </div>
    </div>
  );
}
