import { fetchActivity } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Bot, ListTodo, FileText, Hammer, DollarSign, Search, Clock } from "lucide-react";
import { timeAgo } from "@/lib/utils";

function kindIcon(kind: string) {
  switch (kind) {
    case "agent": case "checkin": return Bot;
    case "task": return ListTodo;
    case "content": return FileText;
    case "build": return Hammer;
    case "revenue": return DollarSign;
    case "research": return Search;
    default: return Activity;
  }
}

function kindColor(kind: string) {
  switch (kind) {
    case "agent": case "checkin": return "text-purple-500";
    case "task": return "text-blue-500";
    case "content": return "text-teal-500";
    case "build": return "text-orange-500";
    case "revenue": return "text-emerald-500";
    case "research": return "text-indigo-500";
    default: return "text-muted-foreground";
  }
}

export default async function ActivityPage() {
  const events = await fetchActivity();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight leading-tight">Activity</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Timeline of all events across the system</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            Activity Feed ({events.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Activity className="h-10 w-10 opacity-30" />
              <p className="mt-3 text-sm">No activity yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              {events.map((e) => {
                const Icon = kindIcon(e.kind);
                return (
                  <div key={e.id} className="flex items-start gap-3 rounded-lg p-3 hover:bg-muted/50 transition-colors">
                    <div className={`mt-0.5 rounded-full bg-muted p-1.5 ${kindColor(e.kind)}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{e.title}</div>
                      {e.detail && (
                        <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{e.detail}</div>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{e.kind}</Badge>
                        {e.actor && <Badge variant="secondary" className="text-[10px]">{e.actor}</Badge>}
                                                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {timeAgo(e.ts)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
