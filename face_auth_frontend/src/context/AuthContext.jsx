import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);
const STORAGE_KEY = "secure-hub-auth";

const DEFAULT_AUTH = {
  user: null,
  token: null,
  profile: null,
  role: null,
  authComplete: false,
};

function loadAuthFromStorage() {
  if (typeof window === "undefined") return DEFAULT_AUTH;
  const saved = window.sessionStorage.getItem(STORAGE_KEY);
  if (!saved) return DEFAULT_AUTH;
  try {
    const parsed = JSON.parse(saved);
    return {
      user: parsed.user ?? null,
      token: parsed.token ?? null,
      profile: parsed.profile ?? null,
      role: parsed.role ?? null,
      authComplete: Boolean(parsed.authComplete),
    };
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return DEFAULT_AUTH;
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(loadAuthFromStorage);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  }, [auth]);

  const login = (username, accessToken, profileData = null, role = "user") => {
    setAuth({
      user: username,
      token: accessToken,
      profile: profileData,
      role,
      authComplete: false,
    });
  };

  const loginAndComplete = (username, accessToken, profileData = null, role = "user") => {
    setAuth({
      user: username,
      token: accessToken,
      profile: profileData,
      role,
      authComplete: true,
    });
  };

  const completeAuth = () => {
    setAuth((current) => ({ ...current, authComplete: true }));
  };

  const logout = () => {
    setAuth(DEFAULT_AUTH);
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user: auth.user,
        token: auth.token,
        profile: auth.profile,
        role: auth.role,
        isAdmin: auth.role === "admin",
        authComplete: auth.authComplete,
        login,
        loginAndComplete,
        completeAuth,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
