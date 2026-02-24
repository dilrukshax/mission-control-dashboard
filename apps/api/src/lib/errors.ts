import type express from "express";

export function badRequest(res: express.Response, message: string) {
    return res.status(400).json({ error: message });
}

export function notFound(res: express.Response, message = "not found") {
    return res.status(404).json({ error: message });
}

export function forbidden(res: express.Response, requiredRole: string) {
    return res.status(403).json({ error: "forbidden", requiredRole });
}
