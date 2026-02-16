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

export const AgentStatus = z.enum(["active", "sleeping"]);
export type AgentStatus = z.infer<typeof AgentStatus>;

export const Task = z.object({
  id: z.string(),
  dept: Dept,
  title: z.string(),
  description: z.string().nullable().optional(),
  status: TaskStatus,
  assignee_agent_id: z.string().nullable().optional(),
  updated_at: z.string(),
  created_at: z.string(),
});
export type Task = z.infer<typeof Task>;

export const Agent = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  dept: Dept,
  current_status: AgentStatus.nullable().optional(),
  current_task: z.string().nullable().optional(),
  previous_task: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  last_checkin_at: z.string().nullable().optional(),
});
export type Agent = z.infer<typeof Agent>;

export const ContentDrop = z.object({
  id: z.string(),
  title: z.string(),
  dept: Dept,
  agent_id: z.string().nullable().optional(),
  content_type: z.string(),
  content_preview: z.string().nullable().optional(),
  link: z.string().nullable().optional(),
  status: z.string(),
  created_at: z.string(),
});
export type ContentDrop = z.infer<typeof ContentDrop>;

export const BuildJob = z.object({
  id: z.string(),
  title: z.string(),
  service: z.string(),
  status: z.string(),
  started_at: z.string(),
  finished_at: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});
export type BuildJob = z.infer<typeof BuildJob>;

export const RevenueSnapshot = z.object({
  id: z.string(),
  source: z.string(),
  amount_usd: z.number(),
  period: z.string().nullable().optional(),
  captured_at: z.string(),
});
export type RevenueSnapshot = z.infer<typeof RevenueSnapshot>;

export const ActivityEvent = z.object({
  id: z.string(),
  kind: z.string(),
  title: z.string(),
  detail: z.string().nullable().optional(),
  actor: z.string().nullable().optional(),
  dept: z.string().nullable().optional(),
  ts: z.string(),
});
export type ActivityEvent = z.infer<typeof ActivityEvent>;
