import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function navClass(isActive) {
  return isActive
    ? "rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950"
    : "rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-emerald-400 hover:text-white";
}

export default function PrivateVaultLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-900 text-white">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <header className="sticky top-0 z-50 mb-8 rounded-2xl border border-white/15 bg-slate-950/90 p-4 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">Private Vault</p>
              <h1 className="text-xl font-bold text-white">Protected Data Workspace</h1>
              <p className="text-sm text-slate-300">Signed in as {user}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <NavLink to="/vault/editor" className={({ isActive }) => navClass(isActive)}>
                Add Private Data
              </NavLink>
              <NavLink to="/vault/library" className={({ isActive }) => navClass(isActive)}>
                Explore Vault
              </NavLink>
              <button
                onClick={() => navigate("/dashboard")}
                className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-cyan-400 hover:text-white"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </header>

        <Outlet />
      </div>
    </div>
  );
}
