import { fetchTasks, fetchAgents } from "../../lib/api";
import { TaskTable } from "../../components/TaskTable";
import { AgentCard } from "../../components/AgentCard";
import { QuickTaskForm } from "../../components/QuickCreateForms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";

export default async function DeptPage({
  params,
}: {
  params: Promise<{ dept: string }>;
}) {
  const { dept } = await params;
  const [tasks, agents] = await Promise.all([
    fetchTasks(dept),
    fetchAgents(),
  ]);

  const deptAgents = agents.filter((a) => a.dept === dept);
  const openTasks = tasks.filter((t) => t.status !== "done").length;
  const doneTasks = tasks.filter((t) => t.status === "done").length;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          <h1 className="text-[26px] font-bold tracking-tight leading-tight">{dept}</h1>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">Department overview and tasks</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-medium uppercase tracking-wider text-primary">Agents</CardTitle>
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{deptAgents.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-medium uppercase tracking-wider text-blue-600 dark:text-blue-400">Open Tasks</CardTitle>
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{openTasks}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Completed</CardTitle>
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{doneTasks}</div></CardContent>
        </Card>
      </div>

      {/* Department agents */}
      {deptAgents.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Agents in {dept}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {deptAgents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        </div>
      )}

      {/* Tasks */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-lg font-semibold">Tasks</h2>
          <TaskTable tasks={tasks} showDept={false} />
        </div>
        <div>
          <h2 className="mb-3 text-lg font-semibold">Quick Create</h2>
          <QuickTaskForm />
        </div>
      </div>
    </div>
  );
}
