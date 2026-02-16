import { Nav } from "../components/Nav";
import { fetchActivity } from "../lib/api";

export default async function ActivityPage() {
  const events = await fetchActivity();

  return (
    <div className="min-h-screen">
      <Nav active="activity" />
      <main className="mx-auto max-w-6xl px-6 py-6">
        <section className="rounded-lg border bg-white">
          <div className="border-b px-4 py-3 text-sm font-semibold text-zinc-700">Activity feed</div>
          <div className="divide-y">
            {events.length === 0 ? (
              <div className="px-4 py-6 text-sm text-zinc-500">No activity yet.</div>
            ) : (
              events.map((e) => (
                <div key={e.id} className="px-4 py-3 text-sm">
                  <div className="font-medium">{e.title}</div>
                  <div className="text-xs text-zinc-500">
                    {e.kind}
                    {e.actor ? ` · ${e.actor}` : ""}
                    {e.dept ? ` · ${e.dept}` : ""}
                    {` · ${new Date(e.ts).toLocaleString()}`}
                  </div>
                  {e.detail ? <div className="mt-1 text-xs text-zinc-600">{e.detail}</div> : null}
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
