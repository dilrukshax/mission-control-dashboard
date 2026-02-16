import { AgentCard } from "./components/AgentCard";
import { fetchAgents, fetchTasks } from "./lib/api";
import { TaskTable } from "./components/TaskTable";
import { QuickTaskForm } from "./components/QuickCreateForms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function Home() {
  const [agents, tasks] = await Promise.all([fetchAgents(), fetchTasks()]);

  const activeCount = agents.filter((a) => a.current_status === "active").length;
  const sleepingCount = agents.filter((a) => a.current_status === "sleeping").length;
  const openTasks = tasks.filter((t) => t.status !== "done").length;

  const stats = [
    { label: "Total Agents", value: agents.length, color: "text-primary" },
    { label: "Active", value: activeCount, color: "text-emerald-600 dark:text-emerald-400" },
    { label: "Sleeping", value: sleepingCount, color: "text-muted-foreground" },
    { label: "Open Tasks", value: openTasks, color: "text-blue-600 dark:text-blue-400" },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-[26px] font-bold tracking-tight leading-tight">Dashboard</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Overview of your AI agent operations</p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className={`text-[11px] font-medium uppercase tracking-wider ${s.color}`}>
                {s.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Agent status */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Agent Status</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </div>

      {/* Latest tasks + Quick create */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-lg font-semibold">Latest Tasks</h2>
          <TaskTable tasks={tasks} />
        </div>
        <div>
          <h2 className="mb-3 text-lg font-semibold">Quick Create</h2>
          <QuickTaskForm />
        </div>
      </div>
    </div>
  );
}
