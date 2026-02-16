import { fetchSystemMetrics, fetchSystemNetworkUsage } from "../lib/api";
import { SystemMetricsPanel } from "./system-metrics-panel";

export default async function SystemPage() {
  const [metrics, networkUsage] = await Promise.all([
    fetchSystemMetrics(),
    fetchSystemNetworkUsage(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight leading-tight">System</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Live CPU, RAM, disk, and host-wide network telemetry with a rolling 5-minute window
        </p>
      </div>

      <SystemMetricsPanel initialMetrics={metrics} initialNetworkUsage={networkUsage} />
    </div>
  );
}
