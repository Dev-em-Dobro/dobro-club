"use client";

import { createContext, useContext, useEffect, useState } from "react";

export interface Lead {
  leadId: string;
  name: string | null;
  eventId: string;
  magicLink?: string;
}

interface AuthState {
  loading: boolean;
  lead: Lead | null;
}

const AuthContext = createContext<AuthState>({ loading: true, lead: null });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ loading: true, lead: null });

  useEffect(() => {
    let active = true;
    fetch("/api/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((lead) => active && setState({ loading: false, lead }))
      .catch(() => active && setState({ loading: false, lead: null }));
    return () => {
      active = false;
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
