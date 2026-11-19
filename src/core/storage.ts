// localStorage can be missing or throw (private mode, blocked site data), so all access goes through here and
// the game always works without it.

export function readItem(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function writeItem(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* storage is optional */ }
}

export function removeItem(key: string): void {
  try { localStorage.removeItem(key); } catch { /* storage is optional */ }
}

/** Parsed JSON stored under `key`, or null when absent or unreadable. The caller validates the shape. */
export function readJson(key: string): unknown {
  const raw = readItem(key);
  if (raw === null) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function writeJson(key: string, value: unknown): void { writeItem(key, JSON.stringify(value)); }
