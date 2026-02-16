import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getEnv } from "./env.js";
import { openDb } from "./db.js";

const env = getEnv();
const db = openDb(env.DB_PATH);

const app = express();
app.set("trust proxy", true);

app.use(express.json({ limit: "1mb" }));
app.use(
  cors({
    origin: env.WEB_ORIGIN,
    credentials: false,
  })
);

app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
  })
);

function nowIso() {
  return new Date().toISOString();
}

function dateOnly(ts = new Date()) {
  return ts.toISOString().slice(0, 10);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

type CpuTimesSnapshot = {
  idle: number;
  total: number;
};

type SystemMetricSample = {
  at: number;
  cpuUsagePercent: number | null;
  cpuTempC: number | null;
  memoryUsagePercent: number | null;
  memoryUsedBytes: number | null;
  memoryTotalBytes: number | null;
  diskUsagePercent: number | null;
  diskUsedBytes: number | null;
  diskTotalBytes: number | null;
};

const SYSTEM_SAMPLE_INTERVAL_MS = 5_000;
const SYSTEM_WINDOW_MS = 5 * 60_000;
const SYSTEM_MAX_SAMPLES = Math.ceil(SYSTEM_WINDOW_MS / SYSTEM_SAMPLE_INTERVAL_MS) + 8;
const SYSTEM_RETENTION_MS = 30 * 24 * 60 * 60_000;
const SYSTEM_RETENTION_PRUNE_INTERVAL_MS = 5 * 60_000;

type NetworkIoSnapshot = {
  rxBytes: number;
  txBytes: number;
};

type MemorySnapshot = {
  totalBytes: number;
  availableBytes: number;
  usedBytes: number;
  usagePercent: number;
};

type DiskSnapshot = {
  mountPath: string;
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  usagePercent: number | null;
};

type NetworkUsageSummaryRow = {
  sample_count: number;
  first_at: number | null;
  last_at: number | null;
  total_inbound_bytes: number | null;
  total_outbound_bytes: number | null;
};

type NetworkUsageDailyRow = {
  day: string;
  sample_count: number;
  total_inbound_bytes: number | null;
  total_outbound_bytes: number | null;
};

type NetworkUsageLatestRow = {
  at: number | null;
  inbound_bytes_delta: number | null;
  outbound_bytes_delta: number | null;
};

type NetworkUsageRecentRow = {
  at: number | null;
  inbound_bytes_delta: number | null;
  outbound_bytes_delta: number | null;
};

const insertNetworkUsageSampleStmt = db.prepare(
  `
  insert into network_usage_samples (
    at, ts, inbound_bytes_total, outbound_bytes_total, inbound_bytes_delta, outbound_bytes_delta
  )
  values (?, ?, ?, ?, ?, ?)
  on conflict(at) do update set
    ts=excluded.ts,
    inbound_bytes_total=excluded.inbound_bytes_total,
    outbound_bytes_total=excluded.outbound_bytes_total,
    inbound_bytes_delta=excluded.inbound_bytes_delta,
    outbound_bytes_delta=excluded.outbound_bytes_delta
  `
);

const deleteExpiredNetworkUsageSamplesStmt = db.prepare(
  "delete from network_usage_samples where at < ?"
);

const selectNetworkUsageSummaryStmt = db.prepare(
  `
  select
    count(*) as sample_count,
    min(at) as first_at,
    max(at) as last_at,
    sum(coalesce(inbound_bytes_delta, 0)) as total_inbound_bytes,
    sum(coalesce(outbound_bytes_delta, 0)) as total_outbound_bytes
  from network_usage_samples
  where at >= ?
  `
);

const selectNetworkUsageDailyStmt = db.prepare(
  `
  select
    substr(ts, 1, 10) as day,
    count(*) as sample_count,
    sum(coalesce(inbound_bytes_delta, 0)) as total_inbound_bytes,
    sum(coalesce(outbound_bytes_delta, 0)) as total_outbound_bytes
  from network_usage_samples
  where at >= ?
  group by day
  order by day asc
  `
);

const selectLatestNetworkUsageStmt = db.prepare(
  `
  select at, inbound_bytes_delta, outbound_bytes_delta
  from network_usage_samples
  where at >= ?
  order by at desc
  limit 1
  `
);

const selectRecentNetworkUsageStmt = db.prepare(
  `
  select at, inbound_bytes_delta, outbound_bytes_delta
  from network_usage_samples
  where at >= ?
  order by at asc
  `
);

let lastNetworkRetentionPruneAt = 0;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function asNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function roundNullable(value: number | null): number | null {
  if (value === null) return null;
  return round1(value);
}

function asWholeNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function readCpuTimes(): CpuTimesSnapshot {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;

  for (const cpu of cpus) {
    const times = cpu.times;
    idle += times.idle;
    total += times.user + times.nice + times.sys + times.idle + times.irq;
  }

  return { idle, total };
}

function parseTempC(raw: string): number | null {
  const parsed = Number(raw.trim());
  if (!Number.isFinite(parsed)) return null;

  const tempC = parsed > 1000 ? parsed / 1000 : parsed;
  if (tempC < -20 || tempC > 150) return null;

  return tempC;
}

function thermalTypeScore(typeLabel: string): number {
  const type = typeLabel.toLowerCase();

  if (/(cpu|x86_pkg_temp|package|core|tctl|tdie|soc)/.test(type)) return 20;
  if (/(acpitz|thermal)/.test(type)) return 8;
  return 1;
}

function readCpuTempC(): number | null {
  const thermalRoot = "/sys/class/thermal";
  if (!fs.existsSync(thermalRoot)) return null;

  const candidates: Array<{ tempC: number; score: number }> = [];

  try {
    const entries = fs.readdirSync(thermalRoot, { withFileTypes: true });

    for (const entry of entries) {
      if ((!entry.isDirectory() && !entry.isSymbolicLink()) || !entry.name.startsWith("thermal_zone")) {
        continue;
      }

      const zonePath = path.join(thermalRoot, entry.name);
      const tempPath = path.join(zonePath, "temp");
      if (!fs.existsSync(tempPath)) continue;

      let tempC: number | null = null;
      try {
        tempC = parseTempC(fs.readFileSync(tempPath, "utf8"));
      } catch {
        tempC = null;
      }
      if (tempC === null) continue;

      let typeLabel = "";
      try {
        typeLabel = fs.readFileSync(path.join(zonePath, "type"), "utf8").trim();
      } catch {
        typeLabel = "";
      }

      candidates.push({
        tempC,
        score: thermalTypeScore(typeLabel),
      });
    }
  } catch {
    return null;
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.score - a.score || b.tempC - a.tempC);
  return round1(candidates[0].tempC);
}

function readMemorySnapshot(): MemorySnapshot {
  const totalBytes = os.totalmem();
  let availableBytes = os.freemem();

  const meminfoPath = "/proc/meminfo";
  if (fs.existsSync(meminfoPath)) {
    try {
      const meminfo = fs.readFileSync(meminfoPath, "utf8");
      const memAvailableKb = meminfo.match(/^MemAvailable:\s+(\d+)\s+kB$/m);
      const memTotalKb = meminfo.match(/^MemTotal:\s+(\d+)\s+kB$/m);

      if (memTotalKb?.[1] && memAvailableKb?.[1]) {
        const parsedTotalBytes = Number(memTotalKb[1]) * 1024;
        const parsedAvailableBytes = Number(memAvailableKb[1]) * 1024;

        if (Number.isFinite(parsedTotalBytes) && parsedTotalBytes > 0) {
          const boundedAvailableBytes = clampNumber(
            parsedAvailableBytes,
            0,
            parsedTotalBytes
          );
          const usedBytes = Math.max(0, parsedTotalBytes - boundedAvailableBytes);

          return {
            totalBytes: Math.round(parsedTotalBytes),
            availableBytes: Math.round(boundedAvailableBytes),
            usedBytes: Math.round(usedBytes),
            usagePercent: round1(
              clampNumber((usedBytes / parsedTotalBytes) * 100, 0, 100)
            ),
          };
        }
      }
    } catch {
      // Fallback to os.totalmem()/os.freemem() values below.
    }
  }

  const safeTotalBytes = Math.max(1, totalBytes);
  availableBytes = clampNumber(availableBytes, 0, safeTotalBytes);
  const usedBytes = Math.max(0, safeTotalBytes - availableBytes);

  return {
    totalBytes: safeTotalBytes,
    availableBytes: Math.round(availableBytes),
    usedBytes: Math.round(usedBytes),
    usagePercent: round1(clampNumber((usedBytes / safeTotalBytes) * 100, 0, 100)),
  };
}

function readDiskSnapshot(mountPath = "/"): DiskSnapshot | null {
  try {
    const stats = fs.statfsSync(mountPath);
    const totalBytes = stats.blocks * stats.bsize;
    const freeBytes = stats.bavail * stats.bsize;

    if (!Number.isFinite(totalBytes) || totalBytes <= 0) {
      return {
        mountPath,
        totalBytes: 0,
        freeBytes: 0,
        usedBytes: 0,
        usagePercent: null,
      };
    }

    const boundedFreeBytes = clampNumber(freeBytes, 0, totalBytes);
    const usedBytes = Math.max(0, totalBytes - boundedFreeBytes);

    return {
      mountPath,
      totalBytes: Math.round(totalBytes),
      freeBytes: Math.round(boundedFreeBytes),
      usedBytes: Math.round(usedBytes),
      usagePercent: round1(clampNumber((usedBytes / totalBytes) * 100, 0, 100)),
    };
  } catch {
    return null;
  }
}

let lastCpuTimes = readCpuTimes();
const systemSamples: SystemMetricSample[] = [];
let lastNetworkSnapshot: NetworkIoSnapshot | null = null;

function trimSystemSamples(nowMs: number): void {
  const cutoff = nowMs - SYSTEM_WINDOW_MS;

  while (systemSamples.length > 0 && systemSamples[0].at < cutoff) {
    systemSamples.shift();
  }

  while (systemSamples.length > SYSTEM_MAX_SAMPLES) {
    systemSamples.shift();
  }
}

function readNetworkIoSnapshot(): NetworkIoSnapshot | null {
  const procNetDev = "/proc/net/dev";
  if (!fs.existsSync(procNetDev)) return null;

  try {
    const raw = fs.readFileSync(procNetDev, "utf8");
    const lines = raw.split("\n").slice(2);
    let rxBytes = 0;
    let txBytes = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const [ifacePart, statsPart] = trimmed.split(":");
      if (!ifacePart || !statsPart) continue;

      const iface = ifacePart.trim();
      if (!iface || iface === "lo") continue;

      const fields = statsPart.trim().split(/\s+/);
      if (fields.length < 16) continue;

      const rx = Number(fields[0]);
      const tx = Number(fields[8]);
      if (!Number.isFinite(rx) || !Number.isFinite(tx)) continue;

      rxBytes += rx;
      txBytes += tx;
    }

    if (rxBytes <= 0 && txBytes <= 0) return null;
    return { rxBytes, txBytes };
  } catch {
    return null;
  }
}

function pruneNetworkUsageSamples(nowMs = Date.now(), force = false): void {
  if (!force && nowMs - lastNetworkRetentionPruneAt < SYSTEM_RETENTION_PRUNE_INTERVAL_MS) {
    return;
  }

  const cutoff = nowMs - SYSTEM_RETENTION_MS;
  deleteExpiredNetworkUsageSamplesStmt.run(cutoff);
  lastNetworkRetentionPruneAt = nowMs;
}

function recordNetworkUsageSample(at = Date.now()): void {
  const snapshot = readNetworkIoSnapshot();
  let inboundDelta: number | null = null;
  let outboundDelta: number | null = null;

  if (snapshot && lastNetworkSnapshot) {
    const nextInboundDelta = snapshot.rxBytes - lastNetworkSnapshot.rxBytes;
    const nextOutboundDelta = snapshot.txBytes - lastNetworkSnapshot.txBytes;
    inboundDelta = nextInboundDelta >= 0 ? nextInboundDelta : null;
    outboundDelta = nextOutboundDelta >= 0 ? nextOutboundDelta : null;
  }

  if (snapshot) {
    lastNetworkSnapshot = snapshot;
  }

  insertNetworkUsageSampleStmt.run(
    at,
    new Date(at).toISOString(),
    snapshot?.rxBytes ?? null,
    snapshot?.txBytes ?? null,
    inboundDelta,
    outboundDelta
  );

  pruneNetworkUsageSamples(at);
}

function getNetworkUsageSummary(nowMs = Date.now()) {
  const cutoff = nowMs - SYSTEM_RETENTION_MS;
  const recentCutoff = nowMs - SYSTEM_WINDOW_MS;
  const summary = selectNetworkUsageSummaryStmt.get(cutoff) as
    | NetworkUsageSummaryRow
    | undefined;
  const dailyRows = selectNetworkUsageDailyStmt.all(cutoff) as NetworkUsageDailyRow[];
  const latest = selectLatestNetworkUsageStmt.get(cutoff) as
    | NetworkUsageLatestRow
    | undefined;
  const recentRows = selectRecentNetworkUsageStmt.all(recentCutoff) as NetworkUsageRecentRow[];

  const sampleCount = Number(summary?.sample_count ?? 0);
  const expectedSamples = Math.floor(SYSTEM_RETENTION_MS / SYSTEM_SAMPLE_INTERVAL_MS);
  const coveragePercent =
    expectedSamples > 0
      ? round1(clampNumber((sampleCount / expectedSamples) * 100, 0, 100))
      : 0;
  const latestAt = asNumberOrNull(latest?.at);
  const latestIsFresh =
    latestAt !== null && nowMs - latestAt <= SYSTEM_SAMPLE_INTERVAL_MS * 3;
  const latestInboundDelta = asNumberOrNull(latest?.inbound_bytes_delta);
  const latestOutboundDelta = asNumberOrNull(latest?.outbound_bytes_delta);
  const intervalSeconds = SYSTEM_SAMPLE_INTERVAL_MS / 1000;

  return {
    retentionMs: SYSTEM_RETENTION_MS,
    intervalMs: SYSTEM_SAMPLE_INTERVAL_MS,
    startedAt: new Date(cutoff).toISOString(),
    sampleCount,
    expectedSamples,
    coveragePercent,
    firstSampleAt:
      typeof summary?.first_at === "number"
        ? new Date(summary.first_at).toISOString()
        : null,
    lastSampleAt:
      typeof summary?.last_at === "number"
        ? new Date(summary.last_at).toISOString()
        : null,
    totals: {
      inboundBytes: asWholeNumber(summary?.total_inbound_bytes),
      outboundBytes: asWholeNumber(summary?.total_outbound_bytes),
    },
    current: {
      sampledAt: latestAt !== null ? new Date(latestAt).toISOString() : null,
      inboundBps:
        latestIsFresh && latestInboundDelta !== null
          ? roundNullable(latestInboundDelta / intervalSeconds)
          : null,
      outboundBps:
        latestIsFresh && latestOutboundDelta !== null
          ? roundNullable(latestOutboundDelta / intervalSeconds)
          : null,
    },
    daily: dailyRows.map((row) => ({
      day: row.day,
      sampleCount: Number(row.sample_count ?? 0),
      inboundBytes: asWholeNumber(row.total_inbound_bytes),
      outboundBytes: asWholeNumber(row.total_outbound_bytes),
    })),
    recent: recentRows
      .map((row) => {
        const at = asNumberOrNull(row.at);
        if (at === null) return null;

        const inboundDelta = asNumberOrNull(row.inbound_bytes_delta);
        const outboundDelta = asNumberOrNull(row.outbound_bytes_delta);

        return {
          ts: new Date(at).toISOString(),
          inboundBps:
            inboundDelta !== null ? roundNullable(inboundDelta / intervalSeconds) : null,
          outboundBps:
            outboundDelta !== null
              ? roundNullable(outboundDelta / intervalSeconds)
              : null,
        };
      })
      .filter(
        (
          sample
        ): sample is { ts: string; inboundBps: number | null; outboundBps: number | null } =>
          sample !== null
      ),
  };
}

function takeSystemSample(at = Date.now()): SystemMetricSample {
  const currentCpu = readCpuTimes();
  const totalDelta = currentCpu.total - lastCpuTimes.total;
  const idleDelta = currentCpu.idle - lastCpuTimes.idle;
  lastCpuTimes = currentCpu;

  const cpuUsagePercent =
    totalDelta > 0
      ? round1(clampNumber(((totalDelta - idleDelta) / totalDelta) * 100, 0, 100))
      : null;
  const memory = readMemorySnapshot();
  const disk = readDiskSnapshot("/");

  const sample: SystemMetricSample = {
    at,
    cpuUsagePercent,
    cpuTempC: readCpuTempC(),
    memoryUsagePercent: memory.usagePercent,
    memoryUsedBytes: memory.usedBytes,
    memoryTotalBytes: memory.totalBytes,
    diskUsagePercent: disk?.usagePercent ?? null,
    diskUsedBytes: disk?.usedBytes ?? null,
    diskTotalBytes: disk?.totalBytes ?? null,
  };

  systemSamples.push(sample);
  trimSystemSamples(at);
  recordNetworkUsageSample(at);

  return sample;
}

function ensureFreshSystemSample(minGapMs = 1200): SystemMetricSample {
  const latest = systemSamples[systemSamples.length - 1];
  if (latest && Date.now() - latest.at < minGapMs) return latest;
  return takeSystemSample();
}

function summarizeWindow(values: Array<number | null>) {
  const nums = values.filter((value): value is number => typeof value === "number");

  if (nums.length === 0) {
    return {
      avg: null,
      min: null,
      max: null,
    };
  }

  const total = nums.reduce((sum, value) => sum + value, 0);

  return {
    avg: round1(total / nums.length),
    min: round1(Math.min(...nums)),
    max: round1(Math.max(...nums)),
  };
}

lastNetworkSnapshot = readNetworkIoSnapshot();
pruneNetworkUsageSamples(Date.now(), true);
takeSystemSample();
const systemSampler = setInterval(() => {
  takeSystemSample();
}, SYSTEM_SAMPLE_INTERVAL_MS);
systemSampler.unref();

function getMarkdownFiles(rootDir: string): string[] {
  const out: string[] = [];

  function walk(current: string) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const full = path.join(current, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (e.isFile() && e.name.toLowerCase().endsWith(".md")) {
        out.push(full);
      }
    }
  }

  if (fs.existsSync(rootDir)) walk(rootDir);
  return out;
}

function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

function scoreText(content: string, query: string, relPath = ""): number {
  const q = tokenizeQuery(query);
  const body = content.toLowerCase();
  const title = (content.match(/^#\s+(.+)$/m)?.[1] ?? "").toLowerCase();
  const pathText = relPath.toLowerCase();

  let score = 0;
  for (const token of q) {
    // body matches (base signal)
    let idx = body.indexOf(token);
    while (idx !== -1) {
      score += 1;
      idx = body.indexOf(token, idx + token.length);
    }

    // title/path boosts
    if (title.includes(token)) score += 6;
    if (pathText.includes(token)) score += 4;

    // exact phrase in body boost (for longer queries)
    if (query.length > 8 && body.includes(query.toLowerCase())) score += 8;
  }

  return score;
}

function summarizeMatch(content: string, query: string): string {
  const lower = content.toLowerCase();
  const token = query
    .toLowerCase()
    .split(/\s+/)
    .map((s) => s.trim())
    .find((s) => s.length > 1);

  const idx = token ? lower.indexOf(token) : -1;
  if (idx === -1) {
    return content.replace(/\s+/g, " ").slice(0, 220);
  }

  const start = Math.max(0, idx - 120);
  const end = Math.min(content.length, idx + 180);
  return content.slice(start, end).replace(/\s+/g, " ");
}

type StreamEvent = {
  id: string;
  kind: string;
  ts: string;
  summary?: string;
};

const sseClients = new Set<express.Response>();

function pushEvent(kind: string, summary?: string) {
  const evt: StreamEvent = {
    id: crypto.randomUUID(),
    kind,
    ts: nowIso(),
    summary,
  };

  const payload = `id: ${evt.id}\nevent: update\ndata: ${JSON.stringify(evt)}\n\n`;
  for (const res of sseClients) {
    res.write(payload);
  }
}

function logActivity(params: {
  kind: string;
  title: string;
  detail?: string;
  actor?: string;
  dept?: string;
}) {
  db.prepare(
    `insert into activity_events (id, kind, title, detail, actor, dept, ts)
     values (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    crypto.randomUUID(),
    params.kind,
    params.title,
    params.detail ?? null,
    params.actor ?? null,
    params.dept ?? null,
    nowIso()
  );
}

type UserRole = "viewer" | "operator" | "owner";

const roleRank: Record<UserRole, number> = {
  viewer: 1,
  operator: 2,
  owner: 3,
};

const authEnabled =
  !!env.AUTH_OWNER_KEY || !!env.AUTH_OPERATOR_KEY || !!env.AUTH_VIEWER_KEY;

function extractApiKey(req: express.Request): string | null {
  const xKey = req.header("x-mc-key");
  if (xKey) return xKey;

  const auth = req.header("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }

  const queryKey = req.query.key;
  if (typeof queryKey === "string" && queryKey.length > 0) return queryKey;

  return null;
}

function resolveRole(req: express.Request): UserRole | null {
  if (!authEnabled) return "owner";

  const key = extractApiKey(req);
  if (!key) return null;

  if (env.AUTH_OWNER_KEY && key === env.AUTH_OWNER_KEY) return "owner";
  if (env.AUTH_OPERATOR_KEY && key === env.AUTH_OPERATOR_KEY) return "operator";
  if (env.AUTH_VIEWER_KEY && key === env.AUTH_VIEWER_KEY) return "viewer";

  return null;
}

function requireRole(minRole: UserRole): express.RequestHandler {
  return (req, res, next) => {
    const role = resolveRole(req);
    if (!role || roleRank[role] < roleRank[minRole]) {
      return res.status(403).json({
        error: "forbidden",
        requiredRole: minRole,
      });
    }

    next();
  };
}

app.get("/api/stream", requireRole("viewer"), (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  res.write(`event: hello\ndata: ${JSON.stringify({ ts: nowIso() })}\n\n`);

  sseClients.add(res);

  const keepAlive = setInterval(() => {
    res.write(`event: ping\ndata: ${JSON.stringify({ ts: nowIso() })}\n\n`);
  }, 25_000);

  req.on("close", () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, authEnabled });
});

app.get("/api/system/metrics", requireRole("viewer"), (_req, res) => {
  const latest = ensureFreshSystemSample();
  const cutoff = Date.now() - SYSTEM_WINDOW_MS;
  const samples = systemSamples.filter((sample) => sample.at >= cutoff);

  const cpuWindow = summarizeWindow(samples.map((sample) => sample.cpuUsagePercent));
  const thermalWindow = summarizeWindow(samples.map((sample) => sample.cpuTempC));
  const memoryWindow = summarizeWindow(samples.map((sample) => sample.memoryUsagePercent));
  const diskWindow = summarizeWindow(samples.map((sample) => sample.diskUsagePercent));

  const cpus = os.cpus();
  const loadAvg = os.loadavg().map((value) => round1(value));

  res.json({
    windowMs: SYSTEM_WINDOW_MS,
    intervalMs: SYSTEM_SAMPLE_INTERVAL_MS,
    sampledAt: new Date(latest.at).toISOString(),
    cpu: {
      usagePercent: latest.cpuUsagePercent,
      cores: cpus.length,
      model: cpus[0]?.model?.trim() || null,
      loadAvg,
      window: {
        avgPercent: cpuWindow.avg,
        minPercent: cpuWindow.min,
        maxPercent: cpuWindow.max,
      },
    },
    thermal: {
      cpuTempC: latest.cpuTempC,
      window: {
        avgC: thermalWindow.avg,
        minC: thermalWindow.min,
        maxC: thermalWindow.max,
      },
    },
    memory: {
      usagePercent: latest.memoryUsagePercent,
      usedBytes: latest.memoryUsedBytes,
      totalBytes: latest.memoryTotalBytes,
      availableBytes:
        latest.memoryTotalBytes !== null && latest.memoryUsedBytes !== null
          ? Math.max(0, latest.memoryTotalBytes - latest.memoryUsedBytes)
          : null,
      window: {
        avgPercent: memoryWindow.avg,
        minPercent: memoryWindow.min,
        maxPercent: memoryWindow.max,
      },
    },
    disk: {
      mountPath: "/",
      usagePercent: latest.diskUsagePercent,
      usedBytes: latest.diskUsedBytes,
      totalBytes: latest.diskTotalBytes,
      freeBytes:
        latest.diskTotalBytes !== null && latest.diskUsedBytes !== null
          ? Math.max(0, latest.diskTotalBytes - latest.diskUsedBytes)
          : null,
      window: {
        avgPercent: diskWindow.avg,
        minPercent: diskWindow.min,
        maxPercent: diskWindow.max,
      },
    },
    samples: samples.map((sample) => ({
      ts: new Date(sample.at).toISOString(),
      cpuUsagePercent: sample.cpuUsagePercent,
      cpuTempC: sample.cpuTempC,
      memoryUsagePercent: sample.memoryUsagePercent,
      diskUsagePercent: sample.diskUsagePercent,
    })),
  });
});

app.get("/api/system/network-usage", requireRole("viewer"), (_req, res) => {
  pruneNetworkUsageSamples(Date.now(), true);
  res.json(getNetworkUsageSummary());
});

app.get("/api/system/usage", requireRole("viewer"), (_req, res) => {
  pruneNetworkUsageSamples(Date.now(), true);
  res.json(getNetworkUsageSummary());
});

app.get("/api/auth/me", (req, res) => {
  const role = resolveRole(req);
  if (!role) return res.status(401).json({ error: "unauthorized" });
  res.json({ role });
});

app.get("/api/agents", requireRole("viewer"), (_req, res) => {
  const rows = db
    .prepare(
      `
      select
        a.id,
        a.name,
        a.role,
        a.dept,
        c.status as current_status,
        c.current_task,
        c.previous_task,
        c.note,
        c.ts as last_checkin_at
      from agents a
      left join agent_checkins c on c.id = (
        select c2.id from agent_checkins c2
        where c2.agent_id = a.id
        order by c2.ts desc
        limit 1
      )
      order by a.name asc
      `
    )
    .all();

  res.json({ agents: rows });
});

app.post("/api/agents/upsert", requireRole("operator"), (req, res) => {
  const p = req.body as {
    id?: string;
    name?: string;
    role?: string;
    dept?: string;
  };

  if (!p.id || !p.name || !p.dept) {
    return res.status(400).json({ error: "id, name, dept are required" });
  }

  const ts = nowIso();
  db.prepare(
    `insert into agents (id, name, role, dept, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?)
     on conflict(id) do update set
       name=excluded.name,
       role=excluded.role,
       dept=excluded.dept,
       updated_at=excluded.updated_at`
  ).run(p.id, p.name, p.role ?? "Team", p.dept, ts, ts);

  logActivity({ kind: "agent", title: `Agent upsert: ${p.name}`, dept: p.dept, actor: p.id });
  pushEvent("agent.upsert", p.name);

  res.json({ ok: true, id: p.id });
});

app.post("/api/agents/replace", requireRole("operator"), (req, res) => {
  const p = req.body as {
    agents?: Array<{ id: string; name: string; role?: string; dept: string }>;
  };

  if (!Array.isArray(p.agents)) {
    return res.status(400).json({ error: "agents array is required" });
  }

  const ts = nowIso();
  const tx = db.transaction(() => {
    db.prepare("delete from agents").run();
    const ins = db.prepare(
      `insert into agents (id, name, role, dept, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?)`
    );
    for (const a of p.agents!) {
      ins.run(a.id, a.name, a.role ?? "Team", a.dept, ts, ts);
    }
  });
  tx();

  logActivity({ kind: "agent", title: `Agents replaced (${p.agents.length})` });
  pushEvent("agent.replace", String(p.agents.length));

  res.json({ ok: true, count: p.agents.length });
});

app.post("/api/agents/checkin", requireRole("operator"), (req, res) => {
  const p = req.body as {
    agentId?: string;
    status?: "active" | "sleeping";
    currentTask?: string;
    previousTask?: string;
    note?: string;
  };

  if (!p?.agentId || !p?.status) {
    return res.status(400).json({ error: "agentId and status are required" });
  }

  const exists = db.prepare("select id from agents where id = ?").get(p.agentId);
  if (!exists) return res.status(404).json({ error: "agent not found" });

  const ts = nowIso();
  db.prepare(
    `insert into agent_checkins (id, agent_id, status, current_task, previous_task, note, ts)
     values (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    crypto.randomUUID(),
    p.agentId,
    p.status,
    p.currentTask ?? null,
    p.previousTask ?? null,
    p.note ?? null,
    ts
  );

  logActivity({
    kind: "checkin",
    title: `Agent ${p.agentId} checked in`,
    detail: p.currentTask ?? p.note,
    actor: p.agentId,
  });
  pushEvent("agent.checkin", p.agentId);

  res.json({ ok: true });
});

app.get("/api/tasks", requireRole("viewer"), (req, res) => {
  const dept = req.query.dept?.toString();
  const rows = dept
    ? db
        .prepare(
          "select * from tasks where dept = ? order by updated_at desc limit 300"
        )
        .all(dept)
    : db.prepare("select * from tasks order by updated_at desc limit 300").all();

  res.json({ tasks: rows });
});

app.post("/api/tasks", requireRole("operator"), (req, res) => {
  const p = req.body as {
    title?: string;
    description?: string;
    dept?: string;
    status?: string;
    assigneeAgentId?: string;
  };

  if (!p?.title || !p?.dept) {
    return res.status(400).json({ error: "title and dept are required" });
  }

  const id = crypto.randomUUID();
  const ts = nowIso();
  const status = p.status ?? "todo";

  db.prepare(
    `insert into tasks (
      id, dept, title, description, status, assignee_agent_id,
      created_at, updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, p.dept, p.title, p.description ?? null, status, p.assigneeAgentId ?? null, ts, ts);

  db.prepare(
    "insert into task_events (id, task_id, event_type, payload_json, ts) values (?, ?, ?, ?, ?)"
  ).run(crypto.randomUUID(), id, "created", JSON.stringify(p), ts);

  logActivity({
    kind: "task",
    title: `Task created: ${p.title}`,
    detail: p.description,
    actor: p.assigneeAgentId,
    dept: p.dept,
  });
  pushEvent("task.created", p.title);

  res.status(201).json({ ok: true, id });
});

app.post("/api/research/intake", requireRole("operator"), (req, res) => {
  const p = req.body as {
    topic?: string;
    market?: string;
    outputNeeded?: string;
    deadline?: string;
    requester?: string;
    agentId?: string;
  };

  if (!p.topic || !p.market || !p.outputNeeded) {
    return res
      .status(400)
      .json({ error: "topic, market, outputNeeded are required" });
  }

  const ts = nowIso();
  const taskId = crypto.randomUUID();
  const assignee = p.agentId ?? "scout";
  const title = `Research: ${p.topic}`;
  const description = [
    `Market: ${p.market}`,
    `Output needed: ${p.outputNeeded}`,
    p.deadline ? `Deadline: ${p.deadline}` : null,
    p.requester ? `Requester: ${p.requester}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  db.prepare(
    `insert into tasks (
      id, dept, title, description, status, assignee_agent_id,
      created_at, updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(taskId, "research-intel", title, description, "todo", assignee, ts, ts);

  db.prepare(
    "insert into task_events (id, task_id, event_type, payload_json, ts) values (?, ?, ?, ?, ?)"
  ).run(crypto.randomUUID(), taskId, "research_intake", JSON.stringify(p), ts);

  const date = dateOnly();
  const fileName = `${date} - ${slugify(p.topic)}.md`;
  const relPath = path.join("01-Market", "Research Requests", fileName);
  const absPath = path.join(env.OBSIDIAN_COMPANY_ROOT, relPath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });

  const note = `# Research Request - ${p.topic}\n\n## Brief\n- Topic: ${p.topic}\n- Market: ${p.market}\n- Output Needed: ${p.outputNeeded}\n- Deadline: ${p.deadline ?? "TBD"}\n- Requester: ${p.requester ?? "unknown"}\n- Assigned Agent: ${assignee}\n- Task ID: ${taskId}\n\n## Expected Deliverable\n${p.outputNeeded}\n\n## Sources\n- [ ] Add source links\n\n## Confidence\n- [ ] High / Medium / Low + reasoning\n\n## Notes\n- \n`;
  fs.writeFileSync(absPath, note, "utf8");

  logActivity({
    kind: "research",
    title: `Research intake: ${p.topic}`,
    detail: p.market,
    actor: assignee,
    dept: "research-intel",
  });
  pushEvent("research.intake", p.topic);

  res.status(201).json({
    ok: true,
    taskId,
    assignee,
    notePath: relPath,
  });
});

app.get("/api/research/search", requireRole("viewer"), (req, res) => {
  const q = req.query.q?.toString().trim();
  if (!q) return res.status(400).json({ error: "q is required" });

  const researchRoot = path.join(env.OBSIDIAN_COMPANY_ROOT, "01-Market");
  const files = getMarkdownFiles(researchRoot);

  const matches = files
    .map((file) => {
      const content = fs.readFileSync(file, "utf8");
      const relPath = path.relative(env.OBSIDIAN_COMPANY_ROOT, file);
      const score = scoreText(content, q, relPath);
      return {
        path: relPath,
        score,
        snippet: summarizeMatch(content, q),
      };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  res.json({ query: q, matches });
});

app.post("/api/research/answer", requireRole("viewer"), (req, res) => {
  const p = req.body as { query?: string };
  const query = p.query?.trim();
  if (!query) return res.status(400).json({ error: "query is required" });

  const researchRoot = path.join(env.OBSIDIAN_COMPANY_ROOT, "01-Market");
  const files = getMarkdownFiles(researchRoot);

  const ranked = files
    .map((file) => {
      const content = fs.readFileSync(file, "utf8");
      const relPath = path.relative(env.OBSIDIAN_COMPANY_ROOT, file);
      const score = scoreText(content, query, relPath);
      return {
        file,
        relPath,
        score,
        snippet: summarizeMatch(content, query),
      };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  if (ranked.length === 0) {
    return res.json({
      answer: "No prior research note matched this query.",
      sources: [],
    });
  }

  const answer = [
    `Based on prior research notes, I found ${ranked.length} relevant source(s):`,
    ...ranked.map((r, i) => `${i + 1}. ${r.relPath} — ${r.snippet}`),
  ].join("\n");

  res.json({
    answer,
    sources: ranked.map((r) => ({ path: r.relPath, score: r.score })),
  });
});

function handleDiscordResearchMessage(input: {
  channel?: string;
  text: string;
  requester?: string;
}) {
  const text = input.text.trim();
  const createPrefix = /^research\s*:\s*/i;

  if (createPrefix.test(text)) {
    const topic = text.replace(createPrefix, "").trim();
    if (!topic) return { status: 400, body: { error: "research topic missing" } };

    const ts = nowIso();
    const taskId = crypto.randomUUID();
    const assignee = "scout";
    const title = `Research: ${topic}`;
    const description = [
      `Market: unspecified`,
      `Output needed: summary with sources and recommendation`,
      input.requester ? `Requester: ${input.requester}` : null,
      input.channel ? `Channel: ${input.channel}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    db.prepare(
      `insert into tasks (
        id, dept, title, description, status, assignee_agent_id,
        created_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(taskId, "research-intel", title, description, "todo", assignee, ts, ts);

    const date = dateOnly();
    const fileName = `${date} - ${slugify(topic)}.md`;
    const relPath = path.join("01-Market", "Research Requests", fileName);
    const absPath = path.join(env.OBSIDIAN_COMPANY_ROOT, relPath);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });

    const note = `# Research Request - ${topic}\n\n## Brief\n- Topic: ${topic}\n- Market: TBD\n- Output Needed: summary with sources and recommendation\n- Requester: ${input.requester ?? "unknown"}\n- Task ID: ${taskId}\n\n## Notes\n- \n`;
    fs.writeFileSync(absPath, note, "utf8");

    logActivity({
      kind: "research",
      title: `Discord research intake: ${topic}`,
      detail: input.channel,
      actor: assignee,
      dept: "research-intel",
    });
    pushEvent("research.intake", topic);

    return {
      status: 201,
      body: {
        mode: "intake",
        taskId,
        notePath: relPath,
        message: `Created research task and note for: ${topic}`,
      },
    };
  }

  const researchRoot = path.join(env.OBSIDIAN_COMPANY_ROOT, "01-Market");
  const files = getMarkdownFiles(researchRoot);
  const ranked = files
    .map((file) => {
      const content = fs.readFileSync(file, "utf8");
      const relPath = path.relative(env.OBSIDIAN_COMPANY_ROOT, file);
      const score = scoreText(content, text, relPath);
      return {
        relPath,
        score,
        snippet: summarizeMatch(content, text),
      };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (ranked.length === 0) {
    return {
      status: 200,
      body: {
        mode: "lookup",
        answer: "No prior research found for this query.",
        sources: [],
      },
    };
  }

  return {
    status: 200,
    body: {
      mode: "lookup",
      answer: ranked
        .map((r, i) => `${i + 1}. ${r.relPath} — ${r.snippet}`)
        .join("\n"),
      sources: ranked.map((r) => r.relPath),
    },
  };
}

app.post("/api/discord/research-message", requireRole("operator"), (req, res) => {
  const p = req.body as {
    channel?: string;
    text?: string;
    requester?: string;
  };

  if (!p.text?.trim()) {
    return res.status(400).json({ error: "text is required" });
  }

  const out = handleDiscordResearchMessage({
    channel: p.channel,
    text: p.text,
    requester: p.requester,
  });
  return res.status(out.status).json(out.body);
});

function searchNotesInRoots(query: string, roots: string[]) {
  const ranked = roots
    .flatMap((root) => {
      const abs = path.join(env.OBSIDIAN_COMPANY_ROOT, root);
      return getMarkdownFiles(abs);
    })
    .map((file) => {
      const relPath = path.relative(env.OBSIDIAN_COMPANY_ROOT, file);
      const content = fs.readFileSync(file, "utf8");
      const score = scoreText(content, query, relPath);
      return { relPath, score, snippet: summarizeMatch(content, query) };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  return ranked;
}

function createChannelNote(folder: string, title: string, requester: string, text: string) {
  const fileName = `${dateOnly()} - ${slugify(title)}.md`;
  const relPath = path.join(folder, fileName);
  const absPath = path.join(env.OBSIDIAN_COMPANY_ROOT, relPath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });

  const body = `# ${title}\n\n- Date: ${nowIso()}\n- Requester: ${requester}\n\n## Context\n${text}\n\n## Notes\n- \n`;
  fs.writeFileSync(absPath, body, "utf8");
  return relPath;
}

function toAgentId(requester: string, requesterId?: string) {
  if (requesterId && requesterId.trim()) return `discord-${slugify(requesterId)}`;
  return `discord-${slugify(requester || "user")}`;
}

function deptFromChannel(channel: string): string {
  const c = channel.toLowerCase();
  if (c === "research-intel" || c === "research") return "research-intel";
  if (c === "company-policy" || c === "policy") return "legal-policy";
  if (c === "sales-enable" || c === "sales") return "sales-enable";
  if (c === "ops-reliability" || c === "ops") return "ops-reliability";
  return "mission-control";
}

function ensureAgentFromDiscord(requester: string, channel: string, requesterId?: string) {
  const id = toAgentId(requester, requesterId);
  const dept = deptFromChannel(channel);
  const name = requester;
  const ts = nowIso();

  db.prepare(
    `insert into agents (id, name, role, dept, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?)
     on conflict(id) do update set
       name=excluded.name,
       dept=excluded.dept,
       updated_at=excluded.updated_at`
  ).run(id, name, "Discord Agent", dept, ts, ts);

  return { id, name, dept };
}

function checkinAgent(agentId: string, messageText: string, dept: string) {
  const prev = db
    .prepare(
      `select current_task from agent_checkins where agent_id=? order by ts desc limit 1`
    )
    .get(agentId) as { current_task?: string | null } | undefined;

  const currentTask = messageText.slice(0, 140);
  db.prepare(
    `insert into agent_checkins (id, agent_id, status, current_task, previous_task, note, ts)
     values (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    crypto.randomUUID(),
    agentId,
    "active",
    currentTask,
    prev?.current_task ?? null,
    "Updated from Discord activity",
    nowIso()
  );

  db.prepare(
    `insert into memory_notes (id, dept, agent_id, note, created_at)
     values (?, ?, ?, ?, ?)`
  ).run(crypto.randomUUID(), dept, agentId, messageText.slice(0, 500), nowIso());

  pushEvent("agent.checkin", agentId);
}

app.post("/api/discord/sync-agents", requireRole("operator"), (req, res) => {
  const p = req.body as {
    agents?: Array<{ requester: string; requesterId?: string; channel: string }>;
  };

  if (!Array.isArray(p.agents) || p.agents.length === 0) {
    return res.status(400).json({ error: "agents array is required" });
  }

  const seen = new Set<string>();
  for (const a of p.agents) {
    if (!a?.requester || !a?.channel) continue;
    const agent = ensureAgentFromDiscord(a.requester, a.channel, a.requesterId);
    if (seen.has(agent.id)) continue;
    seen.add(agent.id);
  }

  pushEvent("agent.sync", String(seen.size));
  return res.json({ ok: true, count: seen.size });
});

app.post("/api/discord/bridge", requireRole("operator"), (req, res) => {
  const payload = req.body as Record<string, unknown>;

  const text =
    (typeof payload.text === "string" && payload.text) ||
    (typeof payload.content === "string" && payload.content) ||
    (typeof payload.message === "string" && payload.message) ||
    "";

  const channel =
    (typeof payload.channel === "string" && payload.channel) ||
    (typeof payload.channel_name === "string" && payload.channel_name) ||
    (typeof payload.channelName === "string" && payload.channelName) ||
    "";

  const requester =
    (typeof payload.requester === "string" && payload.requester) ||
    (typeof payload.author === "string" && payload.author) ||
    (typeof payload.author_username === "string" && payload.author_username) ||
    "discord-user";

  const requesterId =
    (typeof payload.requester_id === "string" && payload.requester_id) ||
    (typeof payload.author_id === "string" && payload.author_id) ||
    (typeof payload.authorId === "string" && payload.authorId) ||
    undefined;

  if (!text.trim()) return res.status(400).json({ error: "message text missing" });

  const normalizedChannel = channel.toLowerCase();
  const mappedChannels = new Set([
    "research-intel",
    "research",
    "company-policy",
    "policy",
    "sales-enable",
    "sales",
    "ops-reliability",
    "ops",
  ]);

  if (!mappedChannels.has(normalizedChannel)) {
    return res.status(200).json({ ignored: true, reason: "channel not mapped" });
  }

  const agent = ensureAgentFromDiscord(requester, normalizedChannel, requesterId);
  checkinAgent(agent.id, text, agent.dept);

  if (normalizedChannel === "research-intel" || normalizedChannel === "research") {
    const out = handleDiscordResearchMessage({ channel, text, requester });
    return res.status(out.status).json(out.body);
  }

  if (normalizedChannel === "company-policy" || normalizedChannel === "policy") {
    const createPrefix = /^policy\s*:\s*/i;
    if (createPrefix.test(text)) {
      const topic = text.replace(createPrefix, "").trim() || "Policy Note";
      const relPath = createChannelNote("00-Company/Policies", `Policy - ${topic}`, requester, text);
      return res.status(201).json({
        mode: "policy-intake",
        message: `Policy note created: ${relPath}`,
        notePath: relPath,
      });
    }

    const matches = searchNotesInRoots(text, ["00-Company/Policies", "06-Decisions"]);
    return res.status(200).json({
      mode: "policy-lookup",
      answer:
        matches.length === 0
          ? "No prior policy notes found."
          : matches.map((m, i) => `${i + 1}. ${m.relPath} — ${m.snippet}`).join("\n"),
      sources: matches.map((m) => m.relPath),
    });
  }

  if (normalizedChannel === "sales-enable" || normalizedChannel === "sales") {
    const createPrefix = /^sales\s*:\s*/i;
    if (createPrefix.test(text)) {
      const topic = text.replace(createPrefix, "").trim() || "Sales Note";
      const relPath = createChannelNote("03-Sales", `Sales - ${topic}`, requester, text);
      return res.status(201).json({ mode: "sales-intake", message: `Sales note created: ${relPath}`, notePath: relPath });
    }

    const matches = searchNotesInRoots(text, ["03-Sales", "01-Market"]);
    return res.status(200).json({
      mode: "sales-lookup",
      answer:
        matches.length === 0
          ? "No prior sales notes found."
          : matches.map((m, i) => `${i + 1}. ${m.relPath} — ${m.snippet}`).join("\n"),
      sources: matches.map((m) => m.relPath),
    });
  }

  if (normalizedChannel === "ops-reliability" || normalizedChannel === "ops") {
    const createPrefix = /^ops\s*:\s*/i;
    if (createPrefix.test(text)) {
      const topic = text.replace(createPrefix, "").trim() || "Ops Note";
      const relPath = createChannelNote("05-Ops", `Ops - ${topic}`, requester, text);
      return res.status(201).json({ mode: "ops-intake", message: `Ops note created: ${relPath}`, notePath: relPath });
    }

    const matches = searchNotesInRoots(text, ["05-Ops", "06-Decisions"]);
    return res.status(200).json({
      mode: "ops-lookup",
      answer:
        matches.length === 0
          ? "No prior ops notes found."
          : matches.map((m, i) => `${i + 1}. ${m.relPath} — ${m.snippet}`).join("\n"),
      sources: matches.map((m) => m.relPath),
    });
  }

  return res.status(200).json({ ignored: true, reason: "channel not mapped" });
});

app.patch("/api/tasks/:id", requireRole("operator"), (req, res) => {
  const id = req.params.id;
  const p = req.body as {
    title?: string;
    description?: string;
    dept?: string;
    status?: string;
    assigneeAgentId?: string | null;
    blockers?: string | null;
  };

  const existing = db.prepare("select * from tasks where id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  if (!existing) return res.status(404).json({ error: "task not found" });

  const next = {
    title: p.title ?? (existing.title as string),
    description: p.description ?? (existing.description as string | null),
    dept: p.dept ?? (existing.dept as string),
    status: p.status ?? (existing.status as string),
    assigneeAgentId:
      p.assigneeAgentId === undefined
        ? (existing.assignee_agent_id as string | null)
        : p.assigneeAgentId,
    blockers:
      p.blockers === undefined
        ? (existing.blockers as string | null)
        : p.blockers,
  };

  const ts = nowIso();
  db.prepare(
    `update tasks
     set title=?, description=?, dept=?, status=?, assignee_agent_id=?, blockers=?, updated_at=?
     where id=?`
  ).run(
    next.title,
    next.description,
    next.dept,
    next.status,
    next.assigneeAgentId,
    next.blockers,
    ts,
    id
  );

  db.prepare(
    "insert into task_events (id, task_id, event_type, payload_json, ts) values (?, ?, ?, ?, ?)"
  ).run(crypto.randomUUID(), id, "updated", JSON.stringify(p), ts);

  logActivity({
    kind: "task",
    title: `Task updated: ${next.title}`,
    detail: `Status ${next.status}`,
    actor: next.assigneeAgentId ?? undefined,
    dept: next.dept,
  });
  pushEvent("task.updated", next.title);

  res.json({ ok: true });
});

app.post("/api/tasks/upsert", requireRole("operator"), (req, res) => {
  const p = req.body as any;
  if (!p?.id || !p?.dept || !p?.title || !p?.status) {
    return res.status(400).json({ error: "missing required fields" });
  }

  const ts = nowIso();
  const existing = db.prepare("select id from tasks where id=?").get(p.id);

  if (!existing) {
    db.prepare(
      `insert into tasks (id, dept, title, description, status, assignee_agent_id, owner_agent, eta, blockers, approval_needed, approval_reason, created_at, updated_at, source_session, source_message)
       values (@id, @dept, @title, @description, @status, @assignee_agent_id, @owner_agent, @eta, @blockers, @approval_needed, @approval_reason, @created_at, @updated_at, @source_session, @source_message)`
    ).run({
      id: p.id,
      dept: p.dept,
      title: p.title,
      description: p.description ?? null,
      status: p.status,
      assignee_agent_id: p.assignee_agent_id ?? null,
      owner_agent: p.owner_agent ?? null,
      eta: p.eta ?? null,
      blockers: p.blockers ?? null,
      approval_needed:
        p.approval_needed === undefined ? null : p.approval_needed ? 1 : 0,
      approval_reason: p.approval_reason ?? null,
      created_at: ts,
      updated_at: ts,
      source_session: p.source_session ?? null,
      source_message: p.source_message ?? null,
    });
  } else {
    db.prepare(
      `update tasks set dept=@dept, title=@title, description=@description, status=@status, assignee_agent_id=@assignee_agent_id, owner_agent=@owner_agent, eta=@eta, blockers=@blockers,
        approval_needed=@approval_needed, approval_reason=@approval_reason, updated_at=@updated_at,
        source_session=@source_session, source_message=@source_message where id=@id`
    ).run({
      id: p.id,
      dept: p.dept,
      title: p.title,
      description: p.description ?? null,
      status: p.status,
      assignee_agent_id: p.assignee_agent_id ?? null,
      owner_agent: p.owner_agent ?? null,
      eta: p.eta ?? null,
      blockers: p.blockers ?? null,
      approval_needed:
        p.approval_needed === undefined ? null : p.approval_needed ? 1 : 0,
      approval_reason: p.approval_reason ?? null,
      updated_at: ts,
      source_session: p.source_session ?? null,
      source_message: p.source_message ?? null,
    });
  }

  db.prepare(
    "insert into task_events (id, task_id, event_type, payload_json, ts) values (?, ?, ?, ?, ?)"
  ).run(crypto.randomUUID(), p.id, "upsert", JSON.stringify(p), ts);

  logActivity({
    kind: "task",
    title: `Task upsert: ${p.title}`,
    detail: p.status,
    actor: p.assignee_agent_id,
    dept: p.dept,
  });
  pushEvent("task.upsert", p.title);

  res.json({ ok: true, id: p.id });
});

app.get("/api/content-drops", requireRole("viewer"), (_req, res) => {
  const rows = db
    .prepare("select * from content_drops order by created_at desc limit 200")
    .all();
  res.json({ contentDrops: rows });
});

app.post("/api/content-drops", requireRole("operator"), (req, res) => {
  const p = req.body as {
    title?: string;
    dept?: string;
    agentId?: string;
    contentType?: string;
    contentPreview?: string;
    link?: string;
    status?: string;
  };

  if (!p?.title || !p?.dept || !p?.contentType) {
    return res.status(400).json({ error: "title, dept, contentType required" });
  }

  db.prepare(
    `insert into content_drops (id, title, dept, agent_id, content_type, content_preview, link, status, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    crypto.randomUUID(),
    p.title,
    p.dept,
    p.agentId ?? null,
    p.contentType,
    p.contentPreview ?? null,
    p.link ?? null,
    p.status ?? "submitted",
    nowIso()
  );

  logActivity({
    kind: "content",
    title: `Content drop: ${p.title}`,
    detail: p.contentType,
    actor: p.agentId,
    dept: p.dept,
  });
  pushEvent("content.created", p.title);

  res.status(201).json({ ok: true });
});

app.get("/api/build-jobs", requireRole("viewer"), (_req, res) => {
  const rows = db
    .prepare("select * from build_jobs order by started_at desc limit 200")
    .all();
  res.json({ buildJobs: rows });
});

app.post("/api/build-jobs", requireRole("operator"), (req, res) => {
  const p = req.body as {
    title?: string;
    service?: string;
    status?: string;
    note?: string;
    finishedAt?: string;
  };

  if (!p?.title || !p?.service || !p?.status) {
    return res.status(400).json({ error: "title, service, status required" });
  }

  db.prepare(
    `insert into build_jobs (id, title, service, status, started_at, finished_at, note)
     values (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    crypto.randomUUID(),
    p.title,
    p.service,
    p.status,
    nowIso(),
    p.finishedAt ?? null,
    p.note ?? null
  );

  logActivity({
    kind: "build",
    title: `Build ${p.status}: ${p.title}`,
    detail: p.note,
  });
  pushEvent("build.created", p.title);

  res.status(201).json({ ok: true });
});

app.get("/api/revenue", requireRole("viewer"), (_req, res) => {
  const snapshots = db
    .prepare("select * from revenue_snapshots order by captured_at desc limit 120")
    .all() as { amount_usd: number }[];
  const totalUsd = snapshots.reduce((sum, row) => sum + (row.amount_usd ?? 0), 0);
  res.json({ snapshots, totalUsd });
});

app.post("/api/revenue", requireRole("operator"), (req, res) => {
  const p = req.body as { source?: string; amountUsd?: number; period?: string };
  if (!p?.source || typeof p.amountUsd !== "number") {
    return res.status(400).json({ error: "source and amountUsd required" });
  }

  db.prepare(
    `insert into revenue_snapshots (id, source, amount_usd, period, captured_at)
     values (?, ?, ?, ?, ?)`
  ).run(crypto.randomUUID(), p.source, p.amountUsd, p.period ?? null, nowIso());

  logActivity({
    kind: "revenue",
    title: `Revenue snapshot: $${p.amountUsd.toFixed(2)}`,
    detail: p.source,
  });
  pushEvent("revenue.created", p.source);

  res.status(201).json({ ok: true });
});

app.get("/api/memory-notes", requireRole("viewer"), (req, res) => {
  const agentId = req.query.agentId?.toString();
  const rows = agentId
    ? db
        .prepare(
          "select * from memory_notes where agent_id=? order by created_at desc limit 100"
        )
        .all(agentId)
    : db
        .prepare("select * from memory_notes order by created_at desc limit 300")
        .all();

  res.json({ memoryNotes: rows });
});

app.get("/api/activity", requireRole("viewer"), (_req, res) => {
  const rows = db
    .prepare("select * from activity_events order by ts desc limit 300")
    .all();
  res.json({ activity: rows });
});

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(
    `[mc-api] listening on http://127.0.0.1:${env.PORT} (CORS origin ${env.WEB_ORIGIN})`
  );
});
