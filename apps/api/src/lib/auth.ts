import type express from "express";
import type { Env } from "../env.js";

export type UserRole = "viewer" | "operator" | "owner";

const roleRank: Record<UserRole, number> = {
    viewer: 1,
    operator: 2,
    owner: 3,
};

export function createAuth(env: Env) {
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

    return { authEnabled, resolveRole, requireRole };
}
