import type { Agent } from "../lib/api";

function statusDot(status: Agent["current_status"]) {
  if (status === "active") return "bg-emerald-500";
  if (status === "sleeping") return "bg-zinc-400";
  return "bg-amber-500";
}

export function AgentCard({ agent }: { agent: Agent }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="font-medium">{agent.name}</div>
          <div className="text-xs text-zinc-500">{agent.dept}</div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${statusDot(agent.current_status)}`} />
          <span className="text-zinc-600">{agent.current_status ?? "unknown"}</span>
        </div>
      </div>
      <div className="space-y-1 text-xs text-zinc-600">
        <div><span className="font-medium text-zinc-700">Agent ID:</span> {agent.id}</div>
        <div><span className="font-medium text-zinc-700">Current:</span> {agent.current_task ?? "—"}</div>
        <div><span className="font-medium text-zinc-700">Previous:</span> {agent.previous_task ?? "—"}</div>
        <div><span className="font-medium text-zinc-700">Memory:</span> {agent.note ?? "—"}</div>
        <div><span className="font-medium text-zinc-700">Check-in:</span> {agent.last_checkin_at ? new Date(agent.last_checkin_at).toLocaleString() : "never"}</div>
      </div>
    </div>
  );
}
