import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import VaultPasswordActionModal from "../../components/VaultPasswordActionModal";
import {
  createVaultNote,
  getVaultNote,
  updateVaultNote,
  verifyVaultNotePassword,
  verifyVaultUserPassword,
} from "../../api/vault";

export default function VaultEditorPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const noteId = searchParams.get("noteId");

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingCreate, setPendingCreate] = useState(null);
  const [pendingUpdate, setPendingUpdate] = useState(null);

  const clearMessages = () => {
    if (message) setMessage("");
    if (error) setError("");
  };

  useEffect(() => {
    let active = true;

    async function loadNote() {
      if (!noteId || !user) return;
      setLoading(true);
      setError("");
      try {
        const existing = await getVaultNote(user, noteId);
        if (!active) return;
        setTitle(existing?.title || "");
        setContent(existing?.content || "");
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
  }, [noteId, user]);

  const onSave = () => {
    clearMessages();
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!content.trim()) {
      setError("Content is required.");
      return;
    }

    const payload = {
      title: title.trim(),
      content: content.trim(),
    };

    if (noteId) {
      setPendingUpdate(payload);
      return;
    }
    setPendingCreate(payload);
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
      <VaultPasswordActionModal
        open={Boolean(pendingCreate)}
        title="Save Private Note"
        description="Enter your account password to save this data into private vault."
        actionLabel="Save"
        onVerify={(password) => verifyVaultUserPassword(user, password)}
        onCancel={() => setPendingCreate(null)}
        onConfirm={async (password) => {
          if (!pendingCreate) return;
          try {
            setLoading(true);
            await createVaultNote({ username: user, password, ...pendingCreate });
            setMessage("Private note saved.");
            setTitle("");
            setContent("");
            setPendingCreate(null);
          } catch (err) {
            setError(err?.response?.data?.detail || "Unable to save note.");
          } finally {
            setLoading(false);
          }
        }}
      />

      <VaultPasswordActionModal
        open={Boolean(pendingUpdate)}
        title="Update Private Note"
        description="Enter password to verify ownership before update."
        actionLabel="Update"
        onVerify={(password) => (noteId ? verifyVaultNotePassword(user, noteId, password) : Promise.resolve(true))}
        onCancel={() => setPendingUpdate(null)}
        onConfirm={async (password) => {
          if (!pendingUpdate || !noteId) return;
          try {
            setLoading(true);
            await updateVaultNote({ actorUsername: user, noteId, password, ...pendingUpdate });
            setMessage("Private note updated.");
            setPendingUpdate(null);
          } catch (err) {
            setError(err?.response?.data?.detail || "Unable to update note.");
          } finally {
            setLoading(false);
          }
        }}
      />

      <h2 className="text-2xl font-bold text-white">{noteId ? "Edit Private Note" : "Add Private Note"}</h2>
      <p className="mt-1 text-sm text-slate-300">
        All users can view vault entries. Save or change actions require password verification.
      </p>

      <div className="mt-6 space-y-4">
        <input
          value={title}
          onChange={(e) => {
            clearMessages();
            setTitle(e.target.value);
          }}
          placeholder="Title"
          disabled={loading}
          className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-emerald-400 disabled:opacity-60"
        />

        <textarea
          value={content}
          onChange={(e) => {
            clearMessages();
            setContent(e.target.value);
          }}
          placeholder="Write your private data here..."
          rows={14}
          disabled={loading}
          className="w-full resize-y rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-emerald-400 disabled:opacity-60"
        />
      </div>

      {message && <p className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{message}</p>}
      {error && <p className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={onSave}
          disabled={loading}
          className="rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Working..." : noteId ? "Update Note" : "Save Note"}
        </button>
        <button
          onClick={() => navigate("/vault/library")}
          className="rounded-xl border border-white/15 px-5 py-3 font-semibold text-slate-200 hover:border-cyan-400 hover:text-white"
        >
          Explore Vault
        </button>
        {noteId && (
          <button
            onClick={() => {
              setSearchParams({});
              setTitle("");
              setContent("");
              clearMessages();
            }}
            className="rounded-xl border border-white/15 px-5 py-3 font-semibold text-slate-200 hover:border-white/30 hover:text-white"
          >
            New Note
          </button>
        )}
      </div>
    </section>
  );
}
