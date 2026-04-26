import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import VaultPasswordActionModal from "../../components/VaultPasswordActionModal";
import { deleteVaultNote, listVaultNotes, verifyVaultNotePassword } from "../../api/vault";

function prettyDate(value) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value || "-";
  }
}

export default function VaultLibraryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [noteToDelete, setNoteToDelete] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadNotes() {
      if (!user) return;
      setLoading(true);
      setError("");
      try {
        const result = await listVaultNotes(user);
        if (!active) return;
        setNotes(result || []);
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.detail || "Unable to load notes.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadNotes();
    return () => {
      active = false;
    };
  }, [user]);

  const filtered = useMemo(
    () => notes.filter((n) => n.title.toLowerCase().includes(query.toLowerCase())),
    [notes, query]
  );

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
      <VaultPasswordActionModal
        open={Boolean(noteToDelete)}
        title="Delete Private Note"
        description="Enter password for this note owner before delete."
        actionLabel="Delete"
        onVerify={(password) => (noteToDelete ? verifyVaultNotePassword(noteToDelete.id, password) : Promise.resolve(true))}
        onCancel={() => setNoteToDelete(null)}
        onConfirm={async (password) => {
          if (!noteToDelete) return;
          try {
            await deleteVaultNote(user, noteToDelete.id, password);
            setNotes((prev) => prev.filter((n) => n.id !== noteToDelete.id));
            setNoteToDelete(null);
          } catch (err) {
            setError(err?.response?.data?.detail || "Unable to delete note.");
            setNoteToDelete(null);
          }
        }}
      />

      <h2 className="text-2xl font-bold text-white">Explore Private Vault</h2>
      <p className="mt-1 text-sm text-slate-300">
        All authenticated users can view all notes. Edit/Delete requires owner password verification.
      </p>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by title..."
        className="mt-5 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-emerald-400"
      />

      {error && <p className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}

      <div className="mt-6 space-y-3">
        {!loading && filtered.length === 0 && (
          <p className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-5 text-center text-slate-300">
            No private notes found.
          </p>
        )}

        {loading && (
          <p className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-5 text-center text-slate-300">
            Loading notes...
          </p>
        )}

        {filtered.map((note) => (
          <article key={note.id} className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-lg font-semibold text-white">{note.title}</h3>
                <p className="mt-1 text-xs text-cyan-300">Owner: {note.username}</p>
                <p className="mt-1 line-clamp-2 text-sm text-slate-300">{note.content}</p>
                <p className="mt-2 text-xs text-slate-500">Updated: {prettyDate(note.updated_at || note.created_at)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => navigate(`/vault/view/${note.id}`)}
                  className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-cyan-400 hover:text-white"
                >
                  View
                </button>
                <button
                  onClick={() => navigate(`/vault/editor?noteId=${note.id}`)}
                  className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-emerald-400 hover:text-white"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(note.content);
                  }}
                  className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-amber-400 hover:text-white"
                >
                  Copy
                </button>
                <button
                  onClick={() => setNoteToDelete(note)}
                  className="rounded-lg border border-red-500/40 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/10"
                >
                  Delete
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
