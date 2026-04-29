import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

import Home             from "./pages/home";
import AuthPage         from "./pages/AuthPage";
import Dashboard        from "./pages/Dashboard";
import VoiceAuthPage    from "./pages/VoiceAuthPage";
import OtpDetailsPage   from "./pages/OtpDetailsPage";
import OtpVerifyPage    from "./pages/OtpVerifyPage";
import AdminLoginPage   from "./pages/AdminLoginPage";
import PrivateVaultLayout from "./components/PrivateVaultLayout";
import VaultEditorPage  from "./pages/vault/VaultEditorPage";
import VaultLibraryPage from "./pages/vault/VaultLibraryPage";
import VaultViewPage    from "./pages/vault/VaultViewPage";

// IDS pages (NEW)
import SecurityMonitor  from "./pages/SecurityMonitor";
import AdminDashboard   from "./pages/AdminDashboard";
import DemoControlPanel from "./pages/DemoControlPanel";

function PrivateRoute({ children }) {
  const { authComplete } = useAuth();
  return authComplete ? children : <Navigate to="/" replace />;
}

function AdminRoute({ children }) {
  const { authComplete, role } = useAuth();
  return authComplete && role === "admin"
    ? children
    : <Navigate to="/dashboard" replace />;
}

function BlockAfterAuth({ children }) {
  const { authComplete, role } = useAuth();
  if (!authComplete) return children;
  return role === "admin"
    ? <Navigate to="/admin" replace />
    : <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<BlockAfterAuth><Home /></BlockAfterAuth>} />
      <Route path="/admin-login" element={<AdminLoginPage />} />
      <Route path="/otp-details" element={<BlockAfterAuth><OtpDetailsPage /></BlockAfterAuth>} />
      <Route path="/otp-verify"  element={<BlockAfterAuth><OtpVerifyPage /></BlockAfterAuth>} />
      <Route path="/face-auth"   element={<BlockAfterAuth><AuthPage /></BlockAfterAuth>} />
      <Route path="/login"       element={<BlockAfterAuth><AuthPage /></BlockAfterAuth>} />
      <Route path="/voice-auth"  element={<BlockAfterAuth><VoiceAuthPage /></BlockAfterAuth>} />

      <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />

      {/* IDS pages — protected (must be logged in) */}
      <Route path="/monitor" element={<AdminRoute><SecurityMonitor /></AdminRoute>} />
      <Route path="/admin"   element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      <Route path="/demo"    element={<AdminRoute><DemoControlPanel /></AdminRoute>} />

      <Route path="/vault" element={<PrivateRoute><PrivateVaultLayout /></PrivateRoute>}>
        <Route index element={<Navigate to="/vault/editor" replace />} />
        <Route path="editor"    element={<VaultEditorPage />} />
        <Route path="library"   element={<VaultLibraryPage />} />
        <Route path="view/:id"  element={<VaultViewPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
