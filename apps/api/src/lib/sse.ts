import type express from "express";
import crypto from "node:crypto";
import { nowIso } from "./utils.js";

export type StreamEvent = {
    id: string;
    kind: string;
    ts: string;
    summary?: string;
};

const sseClients = new Set<express.Response>();

export function pushEvent(kind: string, summary?: string): void {
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

export function handleStreamConnection(req: express.Request, res: express.Response): void {
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
}
