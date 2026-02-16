import { z } from "zod";

export const Env = z.object({
  PORT: z.coerce.number().default(3001),
  WEB_ORIGIN: z.string().default("http://192.168.8.50:3000"),
  ALLOW_CIDR: z.string().default("192.168.8.0/24"),
  DB_PATH: z
    .string()
    .default("/home/dilan/.openclaw/mission-control/mission-control.sqlite"),
  // OpenClaw gateway
  OPENCLAW_URL: z.string().default("ws://192.168.8.50:18789"),
  OPENCLAW_TOKEN: z.string().min(1).optional(),
  // Pass 4 auth keys (optional; when unset, API runs in open local-dev mode)
  AUTH_OWNER_KEY: z.string().min(1).optional(),
  AUTH_OPERATOR_KEY: z.string().min(1).optional(),
  AUTH_VIEWER_KEY: z.string().min(1).optional(),
  OBSIDIAN_COMPANY_ROOT: z.string().default("/home/dilan/note/obsidian"),
});

export type Env = z.infer<typeof Env>;

export function getEnv(): Env {
  const parsed = Env.safeParse({
    PORT: process.env.PORT,
    WEB_ORIGIN: process.env.WEB_ORIGIN,
    ALLOW_CIDR: process.env.ALLOW_CIDR,
    DB_PATH: process.env.DB_PATH,
    OPENCLAW_URL: process.env.OPENCLAW_URL,
    OPENCLAW_TOKEN: process.env.OPENCLAW_TOKEN,
    AUTH_OWNER_KEY: process.env.AUTH_OWNER_KEY,
    AUTH_OPERATOR_KEY: process.env.AUTH_OPERATOR_KEY,
    AUTH_VIEWER_KEY: process.env.AUTH_VIEWER_KEY,
    OBSIDIAN_COMPANY_ROOT: process.env.OBSIDIAN_COMPANY_ROOT,
  });
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment");
  }
  return parsed.data;
}
