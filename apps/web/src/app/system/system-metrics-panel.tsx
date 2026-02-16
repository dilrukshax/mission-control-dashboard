"use client";

import { useEffect, useMemo, useState, type MouseEventHandler } from "react";
import {
  Cpu,
  Gauge,
  Thermometer,
  Clock3,
  Database,
  MemoryStick,
  HardDrive,
  ArrowDownToLine,
  ArrowUpToLine,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { timeAgo } from "@/lib/utils";
import type {
  SystemMetricSample,
  SystemMetrics,
  SystemNetworkUsageRecent,
  SystemNetworkUsage,
} from "../lib/api";

type NumericSampleKey =
  | "cpuUsagePercent"
  | "cpuTempC"
  | "memoryUsagePercent"
  | "diskUsagePercent";

async function fetchSystemMetricsClient(): Promise<SystemMetrics> {
  const res = await fetch("/api/system/metrics", {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`System metrics request failed (${res.status})`);
  }

  return (await res.json()) as SystemMetrics;
}

async function fetchSystemNetworkUsageClient(): Promise<SystemNetworkUsage> {
  const res = await fetch("/api/system/network-usage", {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Network usage request failed (${res.status})`);
  }

  return (await res.json()) as SystemNetworkUsage;
}

function formatValue(value: number | null, suffix: string, digits = 1) {
  if (value === null || Number.isNaN(value)) return `—${suffix}`;
  return `${value.toFixed(digits)}${suffix}`;
}

function formatBytes(bytes: number | null, digits = 1) {
  if (bytes === null || Number.isNaN(bytes) || bytes < 0) return "—";
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const fixed = unitIndex === 0 ? 0 : digits;
  return `${value.toFixed(fixed)} ${units[unitIndex]}`;
}

function formatRate(bytesPerSecond: number | null) {
  if (bytesPerSecond === null || Number.isNaN(bytesPerSecond) || bytesPerSecond < 0) return "—";
  return `${formatBytes(bytesPerSecond)}/s`;
}

function formatCount(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatDay(day: string) {
  const parsed = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return day;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Sparkline({
  samples,
  metric,
  strokeClass,
  unit,
  fixedScale,
}: {
  samples: SystemMetricSample[];
  metric: NumericSampleKey;
  strokeClass: string;
  unit: string;
  fixedScale?: { min: number; max: number };
}) {
  const [hoverPointIdx, setHoverPointIdx] = useState<number | null>(null);

  const chart = useMemo(() => {
    const valid = samples
      .map((sample, index) => ({
        index,
        value: sample[metric],
        ts: sample.ts,
      }))
      .filter((p): p is { index: number; value: number; ts: string } => typeof p.value === "number");

    if (valid.length < 2) return null;

    const measuredMin = Math.min(...valid.map((p) => p.value));
    const measuredMax = Math.max(...valid.map((p) => p.value));
    const min = fixedScale?.min ?? measuredMin;
    const max = fixedScale?.max ?? measuredMax;
    const span = max - min || 1;

    const width = 100;
    const height = 30;
    const points = valid.map(({ index, value, ts }) => {
        const x = samples.length <= 1 ? width : (index / (samples.length - 1)) * width;
        const y = height - ((value - min) / span) * height;
        return {
          x,
          y,
          value,
          ts,
        };
      });

    return {
      polylinePoints: points
        .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
        .join(" "),
      min,
      max,
      measuredMin,
      measuredMax,
      latest: points[points.length - 1]?.value ?? null,
      points,
      width,
      height,
    };
  }, [samples, metric, fixedScale]);

  useEffect(() => {
    setHoverPointIdx(null);
  }, [samples, metric]);

  if (!chart) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
        Collecting data…
      </div>
    );
  }

  const hoveredPoint =
    hoverPointIdx === null ? null : chart.points[hoverPointIdx] ?? null;

  const onMouseMove: MouseEventHandler<SVGSVGElement> = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width) return;

    const cursorX = ((event.clientX - bounds.left) / bounds.width) * chart.width;
    let closestIdx = 0;
    let smallestDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < chart.points.length; i += 1) {
      const distance = Math.abs(chart.points[i].x - cursorX);
      if (distance < smallestDistance) {
        smallestDistance = distance;
        closestIdx = i;
      }
    }

    setHoverPointIdx(closestIdx);
  };

  const onMouseLeave = () => {
    setHoverPointIdx(null);
  };

  return (
    <div className="space-y-2">
      <div className="relative h-28 rounded-lg border bg-muted/20 p-3">
        <svg
          viewBox="0 0 100 30"
          preserveAspectRatio="none"
          className={`h-full w-full ${strokeClass}`}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
        >
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={chart.polylinePoints}
          />
          {hoveredPoint && (
            <>
              <line
                x1={hoveredPoint.x}
                y1={0}
                x2={hoveredPoint.x}
                y2={chart.height}
                stroke="currentColor"
                strokeOpacity="0.25"
                strokeWidth="0.8"
                strokeDasharray="1.5 1.5"
              />
              <circle
                cx={hoveredPoint.x}
                cy={hoveredPoint.y}
                r="1.2"
                fill="currentColor"
              />
            </>
          )}
        </svg>
        {hoveredPoint && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border bg-background/95 px-2 py-1 text-[11px] shadow-sm"
            style={{
              left: `${(hoveredPoint.x / chart.width) * 100}%`,
              top: `${(hoveredPoint.y / chart.height) * 100}%`,
            }}
          >
            <div className="font-medium">
              {hoveredPoint.value.toFixed(2)}
              {unit}
            </div>
            <div className="text-muted-foreground">
              {new Date(hoveredPoint.ts).toLocaleTimeString()}
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>5m ago</span>
        <span>now</span>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          min {(fixedScale ? chart.measuredMin : chart.min).toFixed(1)}
          {unit}
        </span>
        <span>
          max {(fixedScale ? chart.measuredMax : chart.max).toFixed(1)}
          {unit}
        </span>
        <span>
          current {chart.latest?.toFixed(1)}
          {unit}
        </span>
      </div>
      {fixedScale && (
        <div className="text-[11px] text-muted-foreground">
          Scale: {fixedScale.min}–{fixedScale.max}
          {unit}
        </div>
      )}
    </div>
  );
}

function NetworkSpeedChart({
  samples,
}: {
  samples: SystemNetworkUsageRecent[];
}) {
  const [hoverPointIdx, setHoverPointIdx] = useState<number | null>(null);

  const chart = useMemo(() => {
    if (samples.length < 2) return null;

    const width = 100;
    const height = 34;
    const points = samples.map((sample, index) => {
      const inboundRaw = typeof sample.inboundBps === "number" ? sample.inboundBps : null;
      const outboundRaw = typeof sample.outboundBps === "number" ? sample.outboundBps : null;

      return {
        x: samples.length <= 1 ? width : (index / (samples.length - 1)) * width,
        ts: sample.ts,
        inboundRaw,
        outboundRaw,
      };
    });

    const maxValue = Math.max(
      1,
      ...points.map((point) =>
        Math.max(point.inboundRaw ?? 0, point.outboundRaw ?? 0)
      )
    );
    const span = maxValue || 1;

    const plotted = points.map((point) => {
      const inbound = point.inboundRaw ?? 0;
      const outbound = point.outboundRaw ?? 0;

      return {
        ...point,
        inboundY: height - (inbound / span) * height,
        outboundY: height - (outbound / span) * height,
      };
    });

    return {
      width,
      height,
      maxValue,
      points: plotted,
      inboundPolylinePoints: plotted
        .map((point) => `${point.x.toFixed(2)},${point.inboundY.toFixed(2)}`)
        .join(" "),
      outboundPolylinePoints: plotted
        .map((point) => `${point.x.toFixed(2)},${point.outboundY.toFixed(2)}`)
        .join(" "),
    };
  }, [samples]);

  useEffect(() => {
    setHoverPointIdx(null);
  }, [samples]);

  if (!chart) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
        Collecting real-time network speed…
      </div>
    );
  }

  const hoveredPoint = hoverPointIdx === null ? null : chart.points[hoverPointIdx] ?? null;
  const latestPoint = chart.points[chart.points.length - 1] ?? null;

  const onMouseMove: MouseEventHandler<SVGSVGElement> = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width) return;

    const cursorX = ((event.clientX - bounds.left) / bounds.width) * chart.width;
    let closestIdx = 0;
    let smallestDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < chart.points.length; i += 1) {
      const distance = Math.abs(chart.points[i].x - cursorX);
      if (distance < smallestDistance) {
        smallestDistance = distance;
        closestIdx = i;
      }
    }

    setHoverPointIdx(closestIdx);
  };

  const onMouseLeave = () => {
    setHoverPointIdx(null);
  };

  return (
    <div className="space-y-2">
      <div className="relative h-36 rounded-lg border bg-muted/20 p-3">
        <svg
          viewBox="0 0 100 34"
          preserveAspectRatio="none"
          className="h-full w-full"
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
        >
          <line x1={0} y1={34} x2={100} y2={34} stroke="currentColor" className="text-border" />
          <line x1={0} y1={17} x2={100} y2={17} stroke="currentColor" className="text-border/60" />
          <line x1={0} y1={0} x2={100} y2={0} stroke="currentColor" className="text-border/40" />

          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-blue-500"
            points={chart.inboundPolylinePoints}
          />
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-amber-500"
            points={chart.outboundPolylinePoints}
          />

          {hoveredPoint && (
            <>
              <line
                x1={hoveredPoint.x}
                y1={0}
                x2={hoveredPoint.x}
                y2={chart.height}
                stroke="currentColor"
                strokeOpacity="0.35"
                strokeWidth="0.8"
                strokeDasharray="1.5 1.5"
                className="text-muted-foreground"
              />
              <circle cx={hoveredPoint.x} cy={hoveredPoint.inboundY} r="1.3" fill="currentColor" className="text-blue-500" />
              <circle cx={hoveredPoint.x} cy={hoveredPoint.outboundY} r="1.3" fill="currentColor" className="text-amber-500" />
            </>
          )}
        </svg>

        {hoveredPoint && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border bg-background/95 px-2 py-1 text-[11px] shadow-sm"
            style={{
              left: `${(hoveredPoint.x / chart.width) * 100}%`,
              top: `${(Math.min(hoveredPoint.inboundY, hoveredPoint.outboundY) / chart.height) * 100}%`,
            }}
          >
            <div className="font-medium">{new Date(hoveredPoint.ts).toLocaleTimeString()}</div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              Download {formatRate(hoveredPoint.inboundRaw)}
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Upload {formatRate(hoveredPoint.outboundRaw)}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>5m ago</span>
        <span>now</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Download
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Upload
          </span>
        </div>
        <div className="tabular-nums">max {formatRate(chart.maxValue)}</div>
      </div>

      {latestPoint && (
        <div className="text-xs text-muted-foreground">
          Latest: download {formatRate(latestPoint.inboundRaw)} · upload{" "}
          {formatRate(latestPoint.outboundRaw)}
        </div>
      )}
    </div>
  );
}

export function SystemMetricsPanel({
  initialMetrics,
  initialNetworkUsage,
}: {
  initialMetrics: SystemMetrics;
  initialNetworkUsage: SystemNetworkUsage;
}) {
  const [metrics, setMetrics] = useState<SystemMetrics>(initialMetrics);
  const [networkUsage, setNetworkUsage] = useState<SystemNetworkUsage>(initialNetworkUsage);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [networkUsageError, setNetworkUsageError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      try {
        const next = await fetchSystemMetricsClient();
        if (!active) return;
        setMetrics(next);
        setMetricsError(null);
      } catch (err) {
        if (!active) return;
        setMetricsError(err instanceof Error ? err.message : "Unable to refresh system metrics");
      }
    };

    const pollEvery = Math.max(metrics.intervalMs || 5_000, 2_000);
    const timer = setInterval(refresh, pollEvery);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [metrics.intervalMs]);

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      try {
        const next = await fetchSystemNetworkUsageClient();
        if (!active) return;
        setNetworkUsage(next);
        setNetworkUsageError(null);
      } catch (err) {
        if (!active) return;
        setNetworkUsageError(
          err instanceof Error ? err.message : "Unable to refresh network usage"
        );
      }
    };

    const pollEvery = Math.max(networkUsage.intervalMs || 5_000, 2_000);
    const timer = setInterval(refresh, pollEvery);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [networkUsage.intervalMs]);

  const loadAvg = metrics.cpu.loadAvg ?? [];
  const temp = metrics.thermal.cpuTempC;
  const tempState =
    temp === null ? "unknown"
    : temp >= 80 ? "hot"
    : temp >= 70 ? "warm"
    : "normal";
  const memoryUsage = metrics.memory.usagePercent;
  const diskUsage = metrics.disk.usagePercent;
  const realtimeSamples = useMemo(() => networkUsage.recent ?? [], [networkUsage.recent]);
  const usageDays = useMemo(() => networkUsage.daily.slice(-30).reverse(), [networkUsage.daily]);
  const retentionDays = Math.round(networkUsage.retentionMs / 86_400_000);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-blue-600 dark:text-blue-400">
              <Cpu className="h-3.5 w-3.5" />
              CPU Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatValue(metrics.cpu.usagePercent, "%")}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              5m avg {formatValue(metrics.cpu.window.avgPercent, "%")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-orange-600 dark:text-orange-400">
              <Thermometer className="h-3.5 w-3.5" />
              CPU Temperature
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-3xl font-bold">{formatValue(temp, "°C")}</div>
              <Badge
                variant="outline"
                className={
                  tempState === "hot"
                    ? "border-red-500/40 text-red-600 dark:text-red-400"
                    : tempState === "warm"
                    ? "border-amber-500/40 text-amber-600 dark:text-amber-400"
                    : tempState === "normal"
                    ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                    : ""
                }
              >
                {tempState}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              5m avg {formatValue(metrics.thermal.window.avgC, "°C")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              <MemoryStick className="h-3.5 w-3.5" />
              RAM Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatValue(memoryUsage, "%")}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              used {formatBytes(metrics.memory.usedBytes)} / {formatBytes(metrics.memory.totalBytes)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-cyan-700 dark:text-cyan-300">
              <HardDrive className="h-3.5 w-3.5" />
              Disk Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatValue(diskUsage, "%")}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              used {formatBytes(metrics.disk.usedBytes)} / {formatBytes(metrics.disk.totalBytes)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <Gauge className="h-3.5 w-3.5" />
              Load Average
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold tabular-nums">
              {loadAvg.length > 0 ? loadAvg.slice(0, 3).map((v) => v.toFixed(2)).join(" / ") : "—"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {metrics.cpu.cores} cores
              {metrics.cpu.model ? ` · ${metrics.cpu.model}` : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" />
              Sampling
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.samples.length}</div>
            <p className="mt-1 text-xs text-muted-foreground">Last update {timeAgo(metrics.sampledAt)}</p>
          </CardContent>
        </Card>
      </div>

      {metricsError && (
        <Card className="border-amber-500/40">
          <CardContent className="py-3 text-sm text-amber-700 dark:text-amber-300">
            {metricsError}
          </CardContent>
        </Card>
      )}

      {networkUsageError && (
        <Card className="border-amber-500/40">
          <CardContent className="py-3 text-sm text-amber-700 dark:text-amber-300">
            {networkUsageError}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">CPU Usage · Last 5 Minutes</CardTitle>
          </CardHeader>
          <CardContent>
            <Sparkline
              samples={metrics.samples}
              metric="cpuUsagePercent"
              strokeClass="text-blue-500"
              unit="%"
              fixedScale={{ min: 0, max: 100 }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">CPU Temperature · Last 5 Minutes</CardTitle>
          </CardHeader>
          <CardContent>
            <Sparkline
              samples={metrics.samples}
              metric="cpuTempC"
              strokeClass="text-orange-500"
              unit="°C"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">RAM Usage · Last 5 Minutes</CardTitle>
          </CardHeader>
          <CardContent>
            <Sparkline
              samples={metrics.samples}
              metric="memoryUsagePercent"
              strokeClass="text-emerald-500"
              unit="%"
              fixedScale={{ min: 0, max: 100 }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Network Speed · Last 5 Minutes</CardTitle>
          </CardHeader>
          <CardContent>
            <NetworkSpeedChart samples={realtimeSamples} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4" />
            Data Usage · Network (Last {retentionDays} Days)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Retained Samples
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {formatCount(networkUsage.sampleCount)}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Coverage</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {networkUsage.coveragePercent.toFixed(1)}%
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                target {formatCount(networkUsage.expectedSamples)} samples
              </p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                <ArrowDownToLine className="h-3.5 w-3.5" />
                Inbound Total
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{formatBytes(networkUsage.totals.inboundBytes)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                current {formatRate(networkUsage.current.inboundBps)}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                <ArrowUpToLine className="h-3.5 w-3.5" />
                Outbound Total
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{formatBytes(networkUsage.totals.outboundBytes)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                current {formatRate(networkUsage.current.outboundBps)}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Day</th>
                  <th className="px-3 py-2 text-left font-medium">Samples</th>
                  <th className="px-3 py-2 text-left font-medium">Inbound</th>
                  <th className="px-3 py-2 text-left font-medium">Outbound</th>
                </tr>
              </thead>
              <tbody>
                {usageDays.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-sm text-muted-foreground">
                      No retained samples yet.
                    </td>
                  </tr>
                )}
                {usageDays.map((day) => (
                  <tr key={day.day} className="border-t">
                    <td className="px-3 py-2">{formatDay(day.day)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatCount(day.sampleCount)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatBytes(day.inboundBytes)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatBytes(day.outboundBytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            Last retained network sample{" "}
            {networkUsage.lastSampleAt ? timeAgo(networkUsage.lastSampleAt) : "not available"}.
          </p>
          <p className="text-xs text-muted-foreground">
            Source: host-wide counters from all non-loopback interfaces.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
