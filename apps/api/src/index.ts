import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { getEnv } from "./env.js";
import { openDb } from "./db.js";
import { createAuth } from "./lib/auth.js";
import { handleStreamConnection } from "./lib/sse.js";
import { createSystemService } from "./modules/system/system.service.js";
import { systemRoutes } from "./modules/system/system.routes.js";
import { createLogActivity, agentRoutes } from "./modules/agents/agents.routes.js";
import { taskRoutes } from "./modules/tasks/tasks.routes.js";
import { contentRoutes } from "./modules/content/content.routes.js";
import { researchRoutes } from "./modules/research/research.routes.js";
import { discordRoutes } from "./modules/discord/discord.routes.js";
import { createOpenClawClient } from "./modules/openclaw/client.js";
import { createOpenClawService } from "./modules/openclaw/service.js";
import { openclawRoutes } from "./modules/openclaw/routes.js";
import { createWorkflowService } from "./modules/workflow/workflow.service.js";
import { boardRoutes } from "./modules/boards/boards.routes.js";
import { activationRoutes } from "./modules/activations/activations.routes.js";
import { workflowRoutes } from "./modules/workflow/workflow.routes.js";

// ── Bootstrap ──────────────────────────────────────────
const env = getEnv();
const db = openDb(env.DB_PATH);
const auth = createAuth(env);
const logActivity = createLogActivity(db);
const system = createSystemService(db);
const openclawClient = createOpenClawClient(env.OPENCLAW_URL, env.OPENCLAW_TOKEN);
const openclawService = createOpenClawService(db, openclawClient);
const workflow = createWorkflowService(db, logActivity);

// ── Express app ────────────────────────────────────────
const app = express();
app.set("trust proxy", true);
app.use(express.json({ limit: "1mb" }));
app.use(cors({ origin: env.WEB_ORIGIN, credentials: false }));
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
  })
);

// ── Core routes ────────────────────────────────────────
app.get("/api/stream", auth.requireRole("viewer"), handleStreamConnection);
app.get("/api/health", (_req, res) => res.json({ ok: true, authEnabled: auth.authEnabled }));
app.get("/api/auth/me", (req, res) => {
  const role = auth.resolveRole(req);
  if (!role) return res.status(401).json({ error: "unauthorized" });
  res.json({ role });
});

// ── Module routers ─────────────────────────────────────
app.use(systemRoutes(system, auth));
app.use(agentRoutes(db, auth, logActivity));
app.use(taskRoutes(db, auth, logActivity));
app.use(contentRoutes(db, auth, logActivity));
app.use(researchRoutes(db, env, auth, logActivity));
app.use(discordRoutes(db, env, auth, logActivity));
app.use(openclawRoutes(auth, openclawService));
app.use(boardRoutes(db, auth, logActivity));
app.use(activationRoutes(db, auth, logActivity));
app.use(workflowRoutes(db, auth, workflow));

// ── Start ──────────────────────────────────────────────
app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(
    `[mc-api] listening on http://127.0.0.1:${env.PORT} (CORS origin ${env.WEB_ORIGIN})`
  );
});
