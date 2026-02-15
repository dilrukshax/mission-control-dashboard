import Link from "next/link";

const TABS = [
  { key: "mission-control", label: "Mission Control" },
  { key: "eng-platform", label: "Eng Platform" },
  { key: "eng-delivery", label: "Eng Delivery" },
  { key: "research-intel", label: "Research" },
  { key: "product-strategy", label: "Product" },
  { key: "marketing-growth", label: "Marketing" },
  { key: "sales-enable", label: "Sales" },
  { key: "ops-reliability", label: "Ops" },
  { key: "finance-ops", label: "Finance" },
  { key: "legal-policy", label: "Legal" },
  { key: "cron", label: "Cron" },
  { key: "logs", label: "Logs" },
] as const;

export function Nav({ active }: { active: string }) {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="font-semibold">Mission Control</div>
        <div className="text-sm text-zinc-500">v0</div>
      </div>
      <nav className="mx-auto max-w-6xl overflow-x-auto px-6 pb-3">
        <div className="flex gap-2">
          {TABS.map((t) => {
            const isActive = active === t.key;
            return (
              <Link
                key={t.key}
                href={t.key === "mission-control" ? "/" : `/dept/${t.key}`}
                className={`rounded-full border px-3 py-1 text-sm ${
                  isActive
                    ? "bg-zinc-900 text-white border-zinc-900"
                    : "bg-white text-zinc-700"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
