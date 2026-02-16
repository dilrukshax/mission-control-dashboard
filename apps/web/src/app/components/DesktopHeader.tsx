"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { HealthBadge } from "@/components/app-sidebar";
import { RefreshCw, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { useRouter } from "next/navigation";

export function DesktopHeader() {
  const router = useRouter();

  return (
    <div className="hidden lg:fixed lg:left-56 lg:right-0 lg:top-0 lg:z-20 lg:flex lg:h-14 lg:items-center lg:justify-between lg:border-b lg:bg-background lg:px-5">
      {/* left spacer */}
      <div />
      {/* right: status area matching OpenClaw topbar */}
      <div className="flex items-center gap-2">
        <HealthBadge />
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
          <Image src="/robot.svg" alt="MC" width={18} height={18} className="brightness-0 invert" />
        </div>
        <ThemeToggle />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => router.refresh()}
          aria-label="Refresh"
        >
          <Power className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
