import Link from "next/link";
import type { Agent } from "../lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot, Clock, Briefcase, Brain } from "lucide-react";
import { timeAgo } from "@/lib/utils";

function statusVariant(status: Agent["current_status"]) {
  if (status === "active") return "success" as const;
  if (status === "sleeping") return "secondary" as const;
  return "warning" as const;
}

function getInitials(name: string) {
  return name
    .split(/[\s-]+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function AgentCard({ agent }: { agent: Agent }) {
  return (
    <Link href={`/agents/${encodeURIComponent(agent.id)}`}>
      <Card className="transition-shadow duration-200 hover:shadow-md cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {getInitials(agent.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="truncate font-medium text-sm">{agent.name}</h3>
                <Badge variant={statusVariant(agent.current_status)} className="shrink-0 text-[10px] px-1.5">
                  {agent.current_status ?? "unknown"}
                </Badge>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Bot className="h-3 w-3" />
                <span className="truncate">{agent.role}</span>
                <span className="text-border">·</span>
                <span className="truncate">general</span>
              </div>
            </div>
          </div>

          <div className="mt-3 space-y-1.5 text-xs">
            {agent.current_task && (
              <div className="flex items-start gap-2 text-muted-foreground">
                <Briefcase className="mt-0.5 h-3 w-3 shrink-0 text-blue-500" />
                <span className="truncate">{agent.current_task}</span>
              </div>
            )}
            {agent.note && (
              <div className="flex items-start gap-2 text-muted-foreground">
                <Brain className="mt-0.5 h-3 w-3 shrink-0 text-purple-500" />
                <span className="line-clamp-2">{agent.note}</span>
              </div>
            )}
            {agent.last_checkin_at && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-3 w-3 shrink-0" />
                <span>{timeAgo(agent.last_checkin_at)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
