"use client";

import { useEffect, useState } from "react";
import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

type ThemeChoice = "system" | "light" | "dark";

const CHOICES: Array<{ value: ThemeChoice; label: string; icon: typeof Laptop }> = [
  { value: "system", label: "System", icon: Laptop },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeTheme: ThemeChoice = mounted && theme ? (theme as ThemeChoice) : "system";
  const effectiveTheme = mounted ? resolvedTheme : null;
  const statusLabel =
    activeTheme === "system"
      ? `System (${effectiveTheme === "dark" ? "Dark" : "Light"})`
      : activeTheme === "dark"
        ? "Dark"
        : "Light";

  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-full border bg-card p-1"
      role="group"
      aria-label="Theme mode selector"
      title={`Theme: ${statusLabel}`}
    >
      {CHOICES.map((choice) => {
        const Icon = choice.icon;
        const isActive = activeTheme === choice.value;

        return (
          <button
            key={choice.value}
            type="button"
            onClick={() => setTheme(choice.value)}
            aria-label={`Use ${choice.label} theme`}
            aria-pressed={isActive}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
