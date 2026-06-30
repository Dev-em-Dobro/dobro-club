import { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext({ loading: true, lead: null });

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, lead: null });

  useEffect(() => {
    let active = true;
    fetch('/api/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((lead) => active && setState({ loading: false, lead }))
      .catch(() => active && setState({ loading: false, lead: null }));
    return () => { active = false; };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
