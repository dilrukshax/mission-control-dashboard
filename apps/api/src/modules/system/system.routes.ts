import { Router } from "express";
import os from "node:os";
import type { createSystemService } from "./system.service.js";
import type { createAuth } from "../../lib/auth.js";
import { round1 } from "../../lib/utils.js";

export function systemRoutes(
    system: ReturnType<typeof createSystemService>,
    auth: ReturnType<typeof createAuth>,
) {
    const router = Router();

    router.get("/api/system/metrics", auth.requireRole("viewer"), (_req, res) => {
        const latest = system.ensureFreshSystemSample();
        const cutoff = Date.now() - system.SYSTEM_WINDOW_MS;
        const samples = system.systemSamples.filter((s) => s.at >= cutoff);

        const cpuWindow = system.summarizeWindow(samples.map((s) => s.cpuUsagePercent));
        const thermalWindow = system.summarizeWindow(samples.map((s) => s.cpuTempC));
        const memoryWindow = system.summarizeWindow(samples.map((s) => s.memoryUsagePercent));
        const diskWindow = system.summarizeWindow(samples.map((s) => s.diskUsagePercent));

        const cpus = os.cpus();
        const loadAvg = os.loadavg().map((v) => round1(v));

        res.json({
            windowMs: system.SYSTEM_WINDOW_MS,
            intervalMs: system.SYSTEM_SAMPLE_INTERVAL_MS,
            sampledAt: new Date(latest.at).toISOString(),
            cpu: {
                usagePercent: latest.cpuUsagePercent,
                cores: cpus.length,
                model: cpus[0]?.model?.trim() || null,
                loadAvg,
                window: { avgPercent: cpuWindow.avg, minPercent: cpuWindow.min, maxPercent: cpuWindow.max },
            },
            thermal: {
                cpuTempC: latest.cpuTempC,
                window: { avgC: thermalWindow.avg, minC: thermalWindow.min, maxC: thermalWindow.max },
            },
            memory: {
                usagePercent: latest.memoryUsagePercent,
                usedBytes: latest.memoryUsedBytes,
                totalBytes: latest.memoryTotalBytes,
                availableBytes:
                    latest.memoryTotalBytes !== null && latest.memoryUsedBytes !== null
                        ? Math.max(0, latest.memoryTotalBytes - latest.memoryUsedBytes)
                        : null,
                window: { avgPercent: memoryWindow.avg, minPercent: memoryWindow.min, maxPercent: memoryWindow.max },
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
                window: { avgPercent: diskWindow.avg, minPercent: diskWindow.min, maxPercent: diskWindow.max },
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

    router.get("/api/system/network-usage", auth.requireRole("viewer"), (_req, res) => {
        system.pruneNetworkUsageSamples(Date.now(), true);
        res.json(system.getNetworkUsageSummary());
    });

    router.get("/api/system/usage", auth.requireRole("viewer"), (_req, res) => {
        system.pruneNetworkUsageSamples(Date.now(), true);
        res.json(system.getNetworkUsageSummary());
    });

    return router;
}
