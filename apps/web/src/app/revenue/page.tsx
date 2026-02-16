import { Nav } from "../components/Nav";
import { QuickRevenueForm } from "../components/QuickCreateForms";
import { fetchRevenue } from "../lib/api";

export default async function RevenuePage() {
  const { snapshots, totalUsd } = await fetchRevenue();

  return (
    <div className="min-h-screen">
      <Nav active="revenue" />
      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-6 md:grid-cols-3">
        <section className="md:col-span-2 rounded-lg border bg-white">
          <div className="border-b px-4 py-3">
            <div className="text-sm font-semibold text-zinc-700">Revenue</div>
            <div className="text-2xl font-semibold">${totalUsd.toFixed(2)}</div>
          </div>
          <div className="divide-y">
            {snapshots.length === 0 ? (
              <div className="px-4 py-6 text-sm text-zinc-500">No revenue snapshots yet.</div>
            ) : (
              snapshots.map((s) => (
                <div key={s.id} className="px-4 py-3 text-sm">
                  <div className="font-medium">${s.amount_usd.toFixed(2)}</div>
                  <div className="text-xs text-zinc-500">
                    {s.source} · {s.period ?? "n/a"} · {new Date(s.captured_at).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
        <QuickRevenueForm />
      </main>
    </div>
  );
}
