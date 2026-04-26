import axios from "axios";

const BASE = "http://127.0.0.1:8000";

export async function verifyVaultUserPassword(username, password) {
  const res = await axios.post(`${BASE}/vault/verify-user-password`, { username, password });
  return res.data?.success === true;
}

export async function verifyVaultNotePassword(noteId, password) {
  const res = await axios.post(`${BASE}/vault/notes/${noteId}/verify-password`, { password });
  return res.data?.success === true;
}

export async function createVaultNote({ username, password, title, content }) {
  const res = await axios.post(`${BASE}/vault/notes`, { username, password, title, content });
  return res.data?.note;
}

export async function listVaultNotes(viewerUsername) {
  const res = await axios.get(`${BASE}/vault/notes`, { params: { viewer_username: viewerUsername } });
  return res.data?.notes || [];
}

export async function getVaultNote(viewerUsername, noteId) {
  const res = await axios.get(`${BASE}/vault/notes/${noteId}`, { params: { viewer_username: viewerUsername } });
  return res.data?.note;
}

export async function updateVaultNote({ actorUsername, noteId, password, title, content }) {
  const res = await axios.put(`${BASE}/vault/notes/${noteId}`, {
    actor_username: actorUsername,
    password,
    title,
    content,
  });
  return res.data?.note;
}

export async function deleteVaultNote(actorUsername, noteId, password) {
  const res = await axios.delete(`${BASE}/vault/notes/${noteId}`, {
    params: { actor_username: actorUsername, password },
  });
  return res.data;
}
