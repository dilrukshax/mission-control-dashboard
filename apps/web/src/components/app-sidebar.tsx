"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListTodo,
  FileText,
  Hammer,
  DollarSign,
  Activity,
  Bot,
  Building2,
  Server,
  Menu,
  X,
  Minus,
  Unplug,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
// ScrollArea removed — using plain overflow with hidden scrollbar
import { ThemeToggle } from "@/components/theme-toggle";
import { useState } from "react";

/* ── Sidebar sections matching OpenClaw structure ── */
const SIDEBAR_SECTIONS = [
  {
    label: "Overview",
    items: [
      { key: "dashboard", label: "Dashboard", href: "/", icon: LayoutDashboard },
      { key: "system", label: "System", href: "/system", icon: Server },
      { key: "gateway", label: "Gateway", href: "/gateway", icon: Unplug },
      { key: "activity", label: "Activity", href: "/activity", icon: Activity },
    ],
  },
  {
    label: "Operations",
    items: [
      { key: "tasks", label: "Tasks", href: "/tasks", icon: ListTodo },
      { key: "builds", label: "Builds", href: "/builds", icon: Hammer },
      { key: "content", label: "Content", href: "/content", icon: FileText },
      { key: "revenue", label: "Revenue", href: "/revenue", icon: DollarSign },
    ],
  },
  {
    label: "Agent",
    items: [
      { key: "agents", label: "Agents", href: "/agents", icon: Bot },
    ],
  },
] as const;

const DEPARTMENTS = [
  "mission-control",
  "eng-platform",
  "eng-delivery",
  "research-intel",
  "product-strategy",
  "marketing-growth",
  "sales-enable",
  "ops-reliability",
  "finance-ops",
  "legal-policy",
] as const;

/* ── Section with dash toggle (like OpenClaw) ── */
function SidebarSection({
  label,
  children,
  defaultOpen = true,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-5">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>{label}</span>
        <Minus className={cn("h-3 w-3 opacity-50", !open && "rotate-90")} />
      </button>
      {open && <div className="mt-1 space-y-[2px]">{children}</div>}
    </div>
  );
}

/* ── Nav item matching OpenClaw: subtle red bg when active, red icon ── */
function NavItem({
  href,
  icon: Icon,
  label,
  isActive,
  onClick,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isActive: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors duration-150",
        isActive
          ? "bg-sidebar-accent text-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          isActive ? "text-primary" : "opacity-70"
        )}
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* ── Brand ── */}
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/robot.svg" alt="Mission Control" width={28} height={28} className="shrink-0" />
          <div className="flex flex-col gap-px">
            <span className="text-[16px] font-bold leading-tight tracking-tight text-foreground">
              Mission Control
            </span>
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Dashboard
            </span>
          </div>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto lg:hidden h-8 w-8"
          onClick={() => setMobileOpen(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* ── Nav ── */}
      <div className="flex-1 overflow-y-auto px-3 py-4 sidebar-scroll">
        {SIDEBAR_SECTIONS.map((section) => (
          <SidebarSection key={section.label} label={section.label}>
            {section.items.map((item) => (
              <NavItem
                key={item.key}
                href={item.href}
                icon={item.icon}
                label={item.label}
                isActive={isActive(item.href)}
                onClick={() => setMobileOpen(false)}
              />
            ))}
          </SidebarSection>
        ))}

        <SidebarSection label="Departments">
          {DEPARTMENTS.map((dept) => (
            <NavItem
              key={dept}
              href={`/dept/${dept}`}
              icon={Building2}
              label={dept}
              isActive={pathname === `/dept/${dept}`}
              onClick={() => setMobileOpen(false)}
            />
          ))}
        </SidebarSection>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Mobile top bar ── */}
      <div className="fixed left-0 top-0 z-40 flex h-14 w-full items-center border-b bg-background px-4 lg:hidden">
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>
        <div className="ml-3 flex items-center gap-2">
          <Image src="/robot.svg" alt="MC" width={24} height={24} />
          <span className="text-sm font-bold tracking-tight">Mission Control</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <HealthBadge />
          <ThemeToggle />
        </div>
      </div>

      {/* ── Mobile overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile sidebar ── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-56 transform border-r border-sidebar-border bg-sidebar transition-transform duration-200 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>

      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-56 lg:flex-col lg:bg-sidebar">
        {sidebarContent}
      </aside>
    </>
  );
}

/* ── Health badge (matching OpenClaw top-right) ── */
export function HealthBadge() {
  return (
    <div className="flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs font-medium">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
      </span>
      <span>Health</span>
      <span className="font-semibold text-emerald-600 dark:text-emerald-400">OK</span>
    </div>
  );
}
