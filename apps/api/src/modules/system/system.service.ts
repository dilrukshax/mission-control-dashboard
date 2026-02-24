import type Database from "better-sqlite3";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { round1, clampNumber, asNumberOrNull, roundNullable, asWholeNumber } from "../../lib/utils.js";

// ── Types ──────────────────────────────────────────────
export type CpuTimesSnapshot = { idle: number; total: number };

export type SystemMetricSample = {
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

export type NetworkIoSnapshot = { rxBytes: number; txBytes: number };
export type MemorySnapshot = { totalBytes: number; availableBytes: number; usedBytes: number; usagePercent: number };
export type DiskSnapshot = { mountPath: string; totalBytes: number; freeBytes: number; usedBytes: number; usagePercent: number | null };

type NetworkUsageSummaryRow = { sample_count: number; first_at: number | null; last_at: number | null; total_inbound_bytes: number | null; total_outbound_bytes: number | null };
type NetworkUsageDailyRow = { day: string; sample_count: number; total_inbound_bytes: number | null; total_outbound_bytes: number | null };
type NetworkUsageLatestRow = { at: number | null; inbound_bytes_delta: number | null; outbound_bytes_delta: number | null };
type NetworkUsageRecentRow = { at: number | null; inbound_bytes_delta: number | null; outbound_bytes_delta: number | null };

// ── Constants ──────────────────────────────────────────
const SYSTEM_SAMPLE_INTERVAL_MS = 5_000;
const SYSTEM_WINDOW_MS = 5 * 60_000;
const SYSTEM_MAX_SAMPLES = Math.ceil(SYSTEM_WINDOW_MS / SYSTEM_SAMPLE_INTERVAL_MS) + 8;
const SYSTEM_RETENTION_MS = 30 * 24 * 60 * 60_000;
const SYSTEM_RETENTION_PRUNE_INTERVAL_MS = 5 * 60_000;

// ── Service ────────────────────────────────────────────
export function createSystemService(db: Database.Database) {
    // Prepared statements
    const insertNetworkUsageSampleStmt = db.prepare(
        `insert into network_usage_samples (at, ts, inbound_bytes_total, outbound_bytes_total, inbound_bytes_delta, outbound_bytes_delta)
     values (?, ?, ?, ?, ?, ?)
     on conflict(at) do update set ts=excluded.ts, inbound_bytes_total=excluded.inbound_bytes_total, outbound_bytes_total=excluded.outbound_bytes_total, inbound_bytes_delta=excluded.inbound_bytes_delta, outbound_bytes_delta=excluded.outbound_bytes_delta`
    );

    const deleteExpiredNetworkUsageSamplesStmt = db.prepare("delete from network_usage_samples where at < ?");

    const selectNetworkUsageSummaryStmt = db.prepare(
        `select count(*) as sample_count, min(at) as first_at, max(at) as last_at,
       sum(coalesce(inbound_bytes_delta, 0)) as total_inbound_bytes,
       sum(coalesce(outbound_bytes_delta, 0)) as total_outbound_bytes
     from network_usage_samples where at >= ?`
    );

    const selectNetworkUsageDailyStmt = db.prepare(
        `select substr(ts, 1, 10) as day, count(*) as sample_count,
       sum(coalesce(inbound_bytes_delta, 0)) as total_inbound_bytes,
       sum(coalesce(outbound_bytes_delta, 0)) as total_outbound_bytes
     from network_usage_samples where at >= ? group by day order by day asc`
    );

    const selectLatestNetworkUsageStmt = db.prepare(
        `select at, inbound_bytes_delta, outbound_bytes_delta from network_usage_samples where at >= ? order by at desc limit 1`
    );

    const selectRecentNetworkUsageStmt = db.prepare(
        `select at, inbound_bytes_delta, outbound_bytes_delta from network_usage_samples where at >= ? order by at asc`
    );

    // State
    let lastCpuTimes = readCpuTimes();
    const systemSamples: SystemMetricSample[] = [];
    let lastNetworkSnapshot: NetworkIoSnapshot | null = null;
    let lastNetworkRetentionPruneAt = 0;

    // ── CPU / Memory / Disk / Network readers ──

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
                if ((!entry.isDirectory() && !entry.isSymbolicLink()) || !entry.name.startsWith("thermal_zone")) continue;

                const zonePath = path.join(thermalRoot, entry.name);
                const tempPath = path.join(zonePath, "temp");
                if (!fs.existsSync(tempPath)) continue;

                let tempC: number | null = null;
                try { tempC = parseTempC(fs.readFileSync(tempPath, "utf8")); } catch { tempC = null; }
                if (tempC === null) continue;

                let typeLabel = "";
                try { typeLabel = fs.readFileSync(path.join(zonePath, "type"), "utf8").trim(); } catch { typeLabel = ""; }

                candidates.push({ tempC, score: thermalTypeScore(typeLabel) });
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
                        const boundedAvailableBytes = clampNumber(parsedAvailableBytes, 0, parsedTotalBytes);
                        const usedBytes = Math.max(0, parsedTotalBytes - boundedAvailableBytes);
                        return {
                            totalBytes: Math.round(parsedTotalBytes),
                            availableBytes: Math.round(boundedAvailableBytes),
                            usedBytes: Math.round(usedBytes),
                            usagePercent: round1(clampNumber((usedBytes / parsedTotalBytes) * 100, 0, 100)),
                        };
                    }
                }
            } catch { /* fallback below */ }
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
                return { mountPath, totalBytes: 0, freeBytes: 0, usedBytes: 0, usagePercent: null };
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

    // ── Trimming / Pruning ──

    function trimSystemSamples(nowMs: number): void {
        const cutoff = nowMs - SYSTEM_WINDOW_MS;
        while (systemSamples.length > 0 && systemSamples[0].at < cutoff) systemSamples.shift();
        while (systemSamples.length > SYSTEM_MAX_SAMPLES) systemSamples.shift();
    }

    function pruneNetworkUsageSamples(nowMs = Date.now(), force = false): void {
        if (!force && nowMs - lastNetworkRetentionPruneAt < SYSTEM_RETENTION_PRUNE_INTERVAL_MS) return;
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

        if (snapshot) lastNetworkSnapshot = snapshot;

        insertNetworkUsageSampleStmt.run(at, new Date(at).toISOString(), snapshot?.rxBytes ?? null, snapshot?.txBytes ?? null, inboundDelta, outboundDelta);
        pruneNetworkUsageSamples(at);
    }

    // ── Sampling ──

    function takeSystemSample(at = Date.now()): SystemMetricSample {
        const currentCpu = readCpuTimes();
        const totalDelta = currentCpu.total - lastCpuTimes.total;
        const idleDelta = currentCpu.idle - lastCpuTimes.idle;
        lastCpuTimes = currentCpu;

        const cpuUsagePercent = totalDelta > 0
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
        if (nums.length === 0) return { avg: null, min: null, max: null };
        const total = nums.reduce((sum, value) => sum + value, 0);
        return {
            avg: round1(total / nums.length),
            min: round1(Math.min(...nums)),
            max: round1(Math.max(...nums)),
        };
    }

    function getNetworkUsageSummary(nowMs = Date.now()) {
        const cutoff = nowMs - SYSTEM_RETENTION_MS;
        const recentCutoff = nowMs - SYSTEM_WINDOW_MS;
        const summary = selectNetworkUsageSummaryStmt.get(cutoff) as NetworkUsageSummaryRow | undefined;
        const dailyRows = selectNetworkUsageDailyStmt.all(cutoff) as NetworkUsageDailyRow[];
        const latest = selectLatestNetworkUsageStmt.get(cutoff) as NetworkUsageLatestRow | undefined;
        const recentRows = selectRecentNetworkUsageStmt.all(recentCutoff) as NetworkUsageRecentRow[];

        const sampleCount = Number(summary?.sample_count ?? 0);
        const expectedSamples = Math.floor(SYSTEM_RETENTION_MS / SYSTEM_SAMPLE_INTERVAL_MS);
        const coveragePercent = expectedSamples > 0
            ? round1(clampNumber((sampleCount / expectedSamples) * 100, 0, 100))
            : 0;
        const latestAt = asNumberOrNull(latest?.at);
        const latestIsFresh = latestAt !== null && nowMs - latestAt <= SYSTEM_SAMPLE_INTERVAL_MS * 3;
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
            firstSampleAt: typeof summary?.first_at === "number" ? new Date(summary.first_at).toISOString() : null,
            lastSampleAt: typeof summary?.last_at === "number" ? new Date(summary.last_at).toISOString() : null,
            totals: {
                inboundBytes: asWholeNumber(summary?.total_inbound_bytes),
                outboundBytes: asWholeNumber(summary?.total_outbound_bytes),
            },
            current: {
                sampledAt: latestAt !== null ? new Date(latestAt).toISOString() : null,
                inboundBps: latestIsFresh && latestInboundDelta !== null ? roundNullable(latestInboundDelta / intervalSeconds) : null,
                outboundBps: latestIsFresh && latestOutboundDelta !== null ? roundNullable(latestOutboundDelta / intervalSeconds) : null,
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
                        inboundBps: inboundDelta !== null ? roundNullable(inboundDelta / intervalSeconds) : null,
                        outboundBps: outboundDelta !== null ? roundNullable(outboundDelta / intervalSeconds) : null,
                    };
                })
                .filter((s): s is { ts: string; inboundBps: number | null; outboundBps: number | null } => s !== null),
        };
    }

    // ── Init: start sampling ──
    lastNetworkSnapshot = readNetworkIoSnapshot();
    pruneNetworkUsageSamples(Date.now(), true);
    takeSystemSample();
    const sampler = setInterval(() => takeSystemSample(), SYSTEM_SAMPLE_INTERVAL_MS);
    sampler.unref();

    return {
        ensureFreshSystemSample,
        summarizeWindow,
        pruneNetworkUsageSamples,
        getNetworkUsageSummary,
        get systemSamples() { return systemSamples; },
        SYSTEM_WINDOW_MS,
        SYSTEM_SAMPLE_INTERVAL_MS,
    };
}
