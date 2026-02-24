"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Lock } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_MC_API_BASE ?? "http://127.0.0.1:3001";
const API_KEY = process.env.NEXT_PUBLIC_MC_API_KEY;
const ROLE = process.env.NEXT_PUBLIC_MC_ROLE ?? "owner";
const CAN_WRITE = ROLE === "owner" || ROLE === "operator";

function authHeaders(): HeadersInit {
  return API_KEY ? { "x-mc-key": API_KEY } : {};
}

function ReadOnlyCard() {
  return (
    <Card>
      <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Lock className="h-4 w-4" />
        Read-only mode ({ROLE}). Mutations are disabled.
      </CardContent>
    </Card>
  );
}

export function QuickTaskForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  if (!CAN_WRITE) return <ReadOnlyCard />;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/tasks`, {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          title: fd.get("title"),
          description: fd.get("description") || undefined,
          assigneeAgentId: fd.get("assigneeAgentId") || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to create task");
      toast.success("Task created successfully");
      form.reset();
      router.refresh();
    } catch {
      toast.error("Failed to create task");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Plus className="h-4 w-4" />
          Create Task
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input id="task-title" name="title" required placeholder="Task title" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-desc">Description</Label>
            <Input id="task-desc" name="description" placeholder="Optional description" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-assignee">Assignee Agent ID</Label>
            <Input id="task-assignee" name="assigneeAgentId" placeholder="Optional" />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Creating..." : "Create Task"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function QuickContentDropForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  if (!CAN_WRITE) return <ReadOnlyCard />;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/content-drops`, {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          title: fd.get("title"),
          agentId: fd.get("agentId") || undefined,
          contentType: fd.get("contentType"),
          contentPreview: fd.get("contentPreview") || undefined,
          link: fd.get("link") || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Content drop added");
      form.reset();
      router.refresh();
    } catch {
      toast.error("Failed to add content drop");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Plus className="h-4 w-4" />
          Add Content Drop
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input name="title" required placeholder="Content title" />
          </div>
          <div className="space-y-1.5">
            <Label>Agent ID</Label>
            <Input name="agentId" placeholder="Optional" />
          </div>
          <div className="space-y-1.5">
            <Label>Content Type</Label>
            <Select name="contentType" required>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="script">Script</SelectItem>
                <SelectItem value="post">Post</SelectItem>
                <SelectItem value="doc">Document</SelectItem>
                <SelectItem value="report">Report</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Preview</Label>
            <Input name="contentPreview" placeholder="Short preview text" />
          </div>
          <div className="space-y-1.5">
            <Label>Link</Label>
            <Input name="link" placeholder="https://..." />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving..." : "Add Content"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function QuickBuildForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  if (!CAN_WRITE) return <ReadOnlyCard />;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/build-jobs`, {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          title: fd.get("title"),
          service: fd.get("service"),
          status: fd.get("status"),
          note: fd.get("note") || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Build job added");
      form.reset();
      router.refresh();
    } catch {
      toast.error("Failed to add build job");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Plus className="h-4 w-4" />
          Add Build Job
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Build Title</Label>
            <Input name="title" required placeholder="Build title" />
          </div>
          <div className="space-y-1.5">
            <Label>Service</Label>
            <Input name="service" required placeholder="Service name" />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select name="status" required>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="queued">Queued</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Note</Label>
            <Input name="note" placeholder="Optional note" />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving..." : "Add Build"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function QuickRevenueForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  if (!CAN_WRITE) return <ReadOnlyCard />;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/revenue`, {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          source: fd.get("source"),
          amountUsd: Number(fd.get("amountUsd")),
          period: fd.get("period") || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Revenue snapshot added");
      form.reset();
      router.refresh();
    } catch {
      toast.error("Failed to add revenue snapshot");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Plus className="h-4 w-4" />
          Add Revenue Snapshot
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Source</Label>
            <Input name="source" required placeholder="e.g. stripe" />
          </div>
          <div className="space-y-1.5">
            <Label>Amount (USD)</Label>
            <Input name="amountUsd" required type="number" step="0.01" placeholder="0.00" />
          </div>
          <div className="space-y-1.5">
            <Label>Period</Label>
            <Input name="period" placeholder="e.g. 2026-02" />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving..." : "Add Revenue"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
