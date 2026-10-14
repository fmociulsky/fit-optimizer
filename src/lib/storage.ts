import type { AppState } from "./types";

const KEY = "enforma-state-v1";

let activeUserId: string | null = null;

export function bindStorageUser(userId: string | null) {
  activeUserId = userId;
}

function scopedKey() {
  return activeUserId ? `${KEY}:${activeUserId}` : KEY;
}

export function loadState(): AppState | null {
  if (typeof window === "undefined") return null;
  if (!activeUserId) return null;
  try {
    const scoped = localStorage.getItem(scopedKey());
    if (scoped) return JSON.parse(scoped) as AppState;
    const legacy = localStorage.getItem(KEY);
    if (legacy) {
      localStorage.setItem(scopedKey(), legacy);
      return JSON.parse(legacy) as AppState;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveState(state: AppState) {
  if (!activeUserId) return;
  localStorage.setItem(scopedKey(), JSON.stringify(state));
}

export function clearState() {
  if (!activeUserId) {
    localStorage.removeItem(KEY);
    return;
  }
  localStorage.removeItem(scopedKey());
}
