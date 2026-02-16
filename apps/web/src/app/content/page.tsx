import { Nav } from "../components/Nav";
import { QuickContentDropForm } from "../components/QuickCreateForms";
import { fetchContentDrops } from "../lib/api";

export default async function ContentPage() {
  const items = await fetchContentDrops();

  return (
    <div className="min-h-screen">
      <Nav active="content" />
      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-6 md:grid-cols-3">
        <section className="md:col-span-2 rounded-lg border bg-white">
          <div className="border-b px-4 py-3 text-sm font-semibold text-zinc-700">Content dropbox</div>
          <div className="divide-y">
            {items.length === 0 ? (
              <div className="px-4 py-6 text-sm text-zinc-500">No content yet.</div>
            ) : (
              items.map((item) => (
                <div key={item.id} className="px-4 py-3 text-sm">
                  <div className="font-medium">{item.title}</div>
                  <div className="text-xs text-zinc-500">
                    {item.dept} · {item.content_type} · {item.agent_id ?? "unassigned"}
                  </div>
                  {item.content_preview ? (
                    <div className="mt-1 text-xs text-zinc-600">{item.content_preview}</div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </section>
        <QuickContentDropForm />
      </main>
    </div>
  );
}
