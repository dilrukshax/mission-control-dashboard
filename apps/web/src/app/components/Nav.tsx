import Link from "next/link";

const TABS = [
  { key: "dashboard", label: "Dashboard", href: "/" },
  { key: "tasks", label: "Tasks", href: "/tasks" },
  { key: "content", label: "Content", href: "/content" },
  { key: "builds", label: "Builds", href: "/builds" },
  { key: "revenue", label: "Revenue", href: "/revenue" },
  { key: "activity", label: "Activity", href: "/activity" },
] as const;

export function Nav({ active }: { active: string }) {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="font-semibold">Mission Control</div>
        <div className="text-sm text-zinc-500">Pass 1 + Pass 2</div>
      </div>
      <nav className="mx-auto max-w-6xl overflow-x-auto px-6 pb-3">
        <div className="flex gap-2">
          {TABS.map((t) => {
            const isActive = active === t.key;
            return (
              <Link
                key={t.key}
                href={t.href}
                className={`rounded-full border px-3 py-1 text-sm ${
                  isActive
                    ? "border-zinc-900 bg-zinc-900 text-white"
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
