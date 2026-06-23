/**
 * Helpers for the JSON-as-String columns (SQLite has no JSON type — see
 * docs/db-schema.md). Parsing is defensive: a corrupt cell yields a safe empty
 * value, never a throw (AGENTS.md §3.2, Reliability).
 */

export function parseStringArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
  } catch {
    return [];
  }
}

export function parseJsonObject<T = Record<string, unknown>>(
  value: string | null | undefined,
): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function toJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}
