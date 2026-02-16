import type { Task } from "../lib/api";

const STATUS_STYLE: Record<string, string> = {
  todo: "bg-zinc-100 text-zinc-700",
  in_progress: "bg-blue-100 text-blue-700",
  blocked: "bg-amber-100 text-amber-700",
  done: "bg-emerald-100 text-emerald-700",
};

export function TaskTable({ tasks }: { tasks: Task[] }) {
  return (
    <div className="rounded-lg border bg-white">
      <div className="grid grid-cols-[140px_1fr_120px_140px] gap-2 border-b px-4 py-2 text-xs font-medium text-zinc-500">
        <div>Dept</div>
        <div>Title</div>
        <div>Status</div>
        <div>Assignee</div>
      </div>
      {tasks.length === 0 ? (
        <div className="px-4 py-6 text-sm text-zinc-500">No tasks yet.</div>
      ) : (
        tasks.slice(0, 100).map((t) => (
          <div
            key={t.id}
            className="grid grid-cols-[140px_1fr_120px_140px] gap-2 border-b px-4 py-3 text-sm last:border-0 hover:bg-zinc-50"
          >
            <div className="text-xs text-zinc-600">{t.dept}</div>
            <div>
              <div className="truncate font-medium">{t.title}</div>
              {t.description ? (
                <div className="truncate text-xs text-zinc-500">{t.description}</div>
              ) : null}
            </div>
            <div>
              <span className={`rounded px-2 py-1 text-xs ${STATUS_STYLE[t.status] ?? "bg-zinc-100"}`}>
                {t.status}
              </span>
            </div>
            <div className="text-xs text-zinc-600">{t.assignee_agent_id ?? "—"}</div>
          </div>
        ))
      )}
    </div>
  );
}
