import { z } from "zod";

export const Dept = z.enum([
  "mission-control",
  "eng-platform",
  "eng-delivery",
  "research-intel",
  "product-strategy",
  "marketing-growth",
  "sales-enable",
  "ops-reliability",
  "finance-ops",
  "legal-policy",
]);
export type Dept = z.infer<typeof Dept>;

export const TaskStatus = z.enum(["todo", "in_progress", "blocked", "done"]);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const TaskUpdateBlock = z.object({
  taskId: z.string().min(1),
  dept: Dept,
  status: TaskStatus,
  title: z.string().min(1),
  ownerAgent: z.string().min(1).optional(),
  eta: z.string().min(1).optional(),
  blockers: z.string().min(1).optional(),
  approvalNeeded: z.boolean().optional(),
  approvalReason: z.string().min(1).optional(),
  source: z
    .object({
      sessionKey: z.string().optional(),
      messageId: z.string().optional(),
    })
    .optional(),
});
export type TaskUpdateBlock = z.infer<typeof TaskUpdateBlock>;

// Parse a strict machine-readable block from plain text.
// Expected format (one per line):
// TASK_ID: ...
// DEPT: ...
// STATUS: ...
// TITLE: ...
// OWNER_AGENT: ... (optional)
// ETA: ... (optional)
// BLOCKERS: ... (optional)
// APPROVAL_NEEDED: yes|no (optional)
// APPROVAL_REASON: ... (optional)
export function parseTaskUpdateBlock(text: string): TaskUpdateBlock | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const kv: Record<string, string> = {};
  for (const line of lines) {
    const m = line.match(/^([A-Z0-9_]+)\s*:\s*(.+)$/);
    if (!m) continue;
    kv[m[1]] = m[2];
  }

  if (!kv.TASK_ID || !kv.DEPT || !kv.STATUS || !kv.TITLE) return null;

  const approvalNeeded =
    kv.APPROVAL_NEEDED?.toLowerCase() === "yes"
      ? true
      : kv.APPROVAL_NEEDED?.toLowerCase() === "no"
        ? false
        : undefined;

  const parsed = TaskUpdateBlock.safeParse({
    taskId: kv.TASK_ID,
    dept: kv.DEPT,
    status: kv.STATUS,
    title: kv.TITLE,
    ownerAgent: kv.OWNER_AGENT,
    eta: kv.ETA,
    blockers: kv.BLOCKERS,
    approvalNeeded,
    approvalReason: kv.APPROVAL_REASON,
  });

  return parsed.success ? parsed.data : null;
}
