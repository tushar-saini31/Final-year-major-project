import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getVaultNote } from "../../api/vault";

export default function VaultViewPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();

  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadNote() {
      if (!user || !id) return;
      setLoading(true);
      setError("");
      try {
        const result = await getVaultNote(user, id);
        if (!active) return;
        setNote(result || null);
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.detail || "Unable to load note.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadNote();
    return () => {
      active = false;
    };
  }, [user, id]);

  if (loading) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <p className="text-slate-300">Loading note...</p>
      </section>
    );
  }

  if (error || !note) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <p className="text-slate-300">{error || "Note not found or no longer available."}</p>
        <button
          onClick={() => navigate("/vault/library")}
          className="mt-4 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-cyan-400 hover:text-white"
        >
          Back to Vault
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-white">{note.title}</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate(`/vault/editor?noteId=${note.id}`)}
            className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-emerald-400 hover:text-white"
          >
            Edit
          </button>
          <button
            onClick={() => navigate("/vault/library")}
            className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-cyan-400 hover:text-white"
          >
            Back
          </button>
        </div>
      </div>

      <p className="mt-2 text-xs text-slate-500">Updated: {new Date(note.updated_at || note.created_at).toLocaleString()}</p>
      <textarea
        readOnly
        value={note.content}
        className="mt-4 h-[60vh] w-full resize-none rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-200 outline-none"
      />
    </section>
  );
}
