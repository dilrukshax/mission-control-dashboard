"use client";

import { useState, type FormEvent } from "react";

const API_BASE = process.env.NEXT_PUBLIC_MC_API_BASE ?? "http://127.0.0.1:3001";
const API_KEY = process.env.NEXT_PUBLIC_MC_API_KEY;
const ROLE = process.env.NEXT_PUBLIC_MC_ROLE ?? "owner";
const CAN_WRITE = ROLE === "owner" || ROLE === "operator";

function authHeaders(): HeadersInit {
  return API_KEY ? { "x-mc-key": API_KEY } : {};
}

function ReadOnlyCard() {
  return (
    <div className="rounded-lg border bg-white p-4 text-sm text-zinc-600">
      Read-only mode ({ROLE}). Mutations are disabled.
    </div>
  );
}

export function QuickTaskForm() {
  const [saving, setSaving] = useState(false);
  if (!CAN_WRITE) return <ReadOnlyCard />;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    setSaving(true);
    await fetch(`${API_BASE}/api/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        title: fd.get("title"),
        description: fd.get("description"),
        dept: fd.get("dept"),
        assigneeAgentId: fd.get("assigneeAgentId") || undefined,
      }),
    });
    setSaving(false);
    form.reset();
    window.location.reload();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 rounded-lg border bg-white p-4">
      <div className="text-sm font-medium">Create task</div>
      <input name="title" required placeholder="Task title" className="w-full rounded border px-3 py-2 text-sm" />
      <input name="description" placeholder="Description" className="w-full rounded border px-3 py-2 text-sm" />
      <input name="dept" required placeholder="Dept (e.g. eng-delivery)" className="w-full rounded border px-3 py-2 text-sm" />
      <input name="assigneeAgentId" placeholder="Assignee agent id" className="w-full rounded border px-3 py-2 text-sm" />
      <button disabled={saving} className="rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-60">
        {saving ? "Creating..." : "Create task"}
      </button>
    </form>
  );
}

export function QuickContentDropForm() {
  const [saving, setSaving] = useState(false);
  if (!CAN_WRITE) return <ReadOnlyCard />;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    setSaving(true);
    await fetch(`${API_BASE}/api/content-drops`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        title: fd.get("title"),
        dept: fd.get("dept"),
        agentId: fd.get("agentId") || undefined,
        contentType: fd.get("contentType"),
        contentPreview: fd.get("contentPreview") || undefined,
        link: fd.get("link") || undefined,
      }),
    });
    setSaving(false);
    form.reset();
    window.location.reload();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 rounded-lg border bg-white p-4">
      <div className="text-sm font-medium">Add content drop</div>
      <input name="title" required placeholder="Title" className="w-full rounded border px-3 py-2 text-sm" />
      <input name="dept" required placeholder="Dept" className="w-full rounded border px-3 py-2 text-sm" />
      <input name="agentId" placeholder="Agent id" className="w-full rounded border px-3 py-2 text-sm" />
      <input name="contentType" required placeholder="Type (script/post/doc)" className="w-full rounded border px-3 py-2 text-sm" />
      <input name="contentPreview" placeholder="Preview" className="w-full rounded border px-3 py-2 text-sm" />
      <input name="link" placeholder="Link" className="w-full rounded border px-3 py-2 text-sm" />
      <button disabled={saving} className="rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-60">
        {saving ? "Saving..." : "Add content"}
      </button>
    </form>
  );
}

export function QuickBuildForm() {
  const [saving, setSaving] = useState(false);
  if (!CAN_WRITE) return <ReadOnlyCard />;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    setSaving(true);
    await fetch(`${API_BASE}/api/build-jobs`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        title: fd.get("title"),
        service: fd.get("service"),
        status: fd.get("status"),
        note: fd.get("note") || undefined,
      }),
    });
    setSaving(false);
    form.reset();
    window.location.reload();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 rounded-lg border bg-white p-4">
      <div className="text-sm font-medium">Add build job</div>
      <input name="title" required placeholder="Build title" className="w-full rounded border px-3 py-2 text-sm" />
      <input name="service" required placeholder="Service" className="w-full rounded border px-3 py-2 text-sm" />
      <input name="status" required placeholder="Status (queued/running/success/failed)" className="w-full rounded border px-3 py-2 text-sm" />
      <input name="note" placeholder="Note" className="w-full rounded border px-3 py-2 text-sm" />
      <button disabled={saving} className="rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-60">
        {saving ? "Saving..." : "Add build"}
      </button>
    </form>
  );
}

export function QuickRevenueForm() {
  const [saving, setSaving] = useState(false);
  if (!CAN_WRITE) return <ReadOnlyCard />;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    setSaving(true);
    await fetch(`${API_BASE}/api/revenue`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        source: fd.get("source"),
        amountUsd: Number(fd.get("amountUsd")),
        period: fd.get("period") || undefined,
      }),
    });
    setSaving(false);
    form.reset();
    window.location.reload();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 rounded-lg border bg-white p-4">
      <div className="text-sm font-medium">Add revenue snapshot</div>
      <input name="source" required placeholder="Source (stripe)" className="w-full rounded border px-3 py-2 text-sm" />
      <input name="amountUsd" required type="number" step="0.01" placeholder="Amount USD" className="w-full rounded border px-3 py-2 text-sm" />
      <input name="period" placeholder="Period (2026-02)" className="w-full rounded border px-3 py-2 text-sm" />
      <button disabled={saving} className="rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-60">
        {saving ? "Saving..." : "Add revenue"}
      </button>
    </form>
  );
}
