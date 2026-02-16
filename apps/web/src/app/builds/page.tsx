import { Nav } from "../components/Nav";
import { QuickBuildForm } from "../components/QuickCreateForms";
import { fetchBuildJobs } from "../lib/api";

export default async function BuildsPage() {
  const jobs = await fetchBuildJobs();

  return (
    <div className="min-h-screen">
      <Nav active="builds" />
      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-6 md:grid-cols-3">
        <section className="md:col-span-2 rounded-lg border bg-white">
          <div className="border-b px-4 py-3 text-sm font-semibold text-zinc-700">Build queue</div>
          <div className="divide-y">
            {jobs.length === 0 ? (
              <div className="px-4 py-6 text-sm text-zinc-500">No builds yet.</div>
            ) : (
              jobs.map((job) => (
                <div key={job.id} className="px-4 py-3 text-sm">
                  <div className="font-medium">{job.title}</div>
                  <div className="text-xs text-zinc-500">
                    {job.service} · {job.status} · {new Date(job.started_at).toLocaleString()}
                  </div>
                  {job.note ? <div className="mt-1 text-xs text-zinc-600">{job.note}</div> : null}
                </div>
              ))
            )}
          </div>
        </section>
        <QuickBuildForm />
      </main>
    </div>
  );
}
