const STORAGE_KEY = "secure-hub-private-vault-v1";

function readVaultState() {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeVaultState(state) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizeUserKey(username) {
  return (username || "").trim().toLowerCase();
}

export function getUserNotes(username) {
  const key = normalizeUserKey(username);
  if (!key) return [];
  const state = readVaultState();
  const notes = state[key];
  return Array.isArray(notes) ? notes : [];
}

export function getUserNoteById(username, noteId) {
  const notes = getUserNotes(username);
  return notes.find((n) => n.id === noteId) || null;
}

export function saveUserNote(username, { id, title, content }) {
  const key = normalizeUserKey(username);
  if (!key) throw new Error("Missing username");

  const state = readVaultState();
  const current = Array.isArray(state[key]) ? state[key] : [];
  const now = new Date().toISOString();

  const existingIndex = current.findIndex((n) => n.id === id);
  if (existingIndex >= 0) {
    const existing = current[existingIndex];
    current[existingIndex] = {
      ...existing,
      title,
      content,
      updatedAt: now,
    };
  } else {
    current.unshift({
      id: id || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      title,
      content,
      createdAt: now,
      updatedAt: now,
    });
  }

  state[key] = current;
  writeVaultState(state);
  return state[key];
}

export function deleteUserNote(username, noteId) {
  const key = normalizeUserKey(username);
  if (!key) return [];
  const state = readVaultState();
  const current = Array.isArray(state[key]) ? state[key] : [];
  state[key] = current.filter((n) => n.id !== noteId);
  writeVaultState(state);
  return state[key];
}

