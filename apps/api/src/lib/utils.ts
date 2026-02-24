import crypto from "node:crypto";

export function nowIso(): string {
  return new Date().toISOString();
}

export function dateOnly(ts = new Date()): string {
  return ts.toISOString().slice(0, 10);
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function asNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function roundNullable(value: number | null): number | null {
  if (value === null) return null;
  return round1(value);
}

export function asWholeNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

export function uuid(): string {
  return crypto.randomUUID();
}
