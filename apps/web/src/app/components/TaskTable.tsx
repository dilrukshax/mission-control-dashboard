import type { Task } from "../lib/api";

export function TaskTable({ tasks }: { tasks: Task[] }) {
  return (
    <div className="rounded-lg border bg-white">
      <div className="grid grid-cols-[140px_1fr_120px] gap-2 border-b px-4 py-2 text-xs font-medium text-zinc-500">
        <div>Dept</div>
        <div>Title</div>
        <div>Status</div>
      </div>
      {tasks.length === 0 ? (
        <div className="px-4 py-6 text-sm text-zinc-500">No tasks yet.</div>
      ) : (
        tasks.slice(0, 50).map((t) => (
          <div
            key={t.id}
            className="grid grid-cols-[140px_1fr_120px] gap-2 px-4 py-2 text-sm hover:bg-zinc-50"
          >
            <div className="text-xs text-zinc-600">{t.dept}</div>
            <div className="truncate">{t.title}</div>
            <div className="text-xs text-zinc-600">{t.status}</div>
          </div>
        ))
      )}
    </div>
  );
}
