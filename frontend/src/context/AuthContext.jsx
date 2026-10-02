import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { TOKEN_KEY } from '../config';
import { auth as authApi } from '../services/endpoints';
import { setUnauthorizedHandler } from '../services/api';
import { storage } from '../utils/storage';

const AuthContext = createContext(null);

/**
 * Holds the signed-in user. `status` is "loading" while a stored token is being
 * verified, then "authed" or "anon", so routes never flash the wrong screen.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(() => (storage.get(TOKEN_KEY) ? 'loading' : 'anon'));
  const [sessionExpired, setSessionExpired] = useState(false);

  const signOut = useCallback(() => {
    storage.remove(TOKEN_KEY);
    setUser(null);
    setStatus('anon');
  }, []);

  // Verify a stored token once on start-up.
  useEffect(() => {
    if (!storage.get(TOKEN_KEY)) return undefined;
    let cancelled = false;
    authApi
      .me()
      .then(({ user: me }) => {
        if (cancelled) return;
        setUser(me);
        setStatus('authed');
      })
      .catch((err) => {
        if (cancelled) return;
        // Only a rejected token ends the session. If the server is just waking up
        // or offline we keep the token and let the user retry.
        if (err.response && err.response.status === 401) signOut();
        else setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [signOut]);

  // Any 401 after sign-in (expired token, deleted account) logs out.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      signOut();
      setSessionExpired(true);
    });
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  const accept = useCallback(({ token, user: me }) => {
    storage.set(TOKEN_KEY, token);
    setUser(me);
    setStatus('authed');
    setSessionExpired(false);
    return me;
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      isAuthed: status === 'authed',
      isDemo: Boolean(user && user.isDemo),
      sessionExpired,
      login: async (credentials) => accept(await authApi.login(credentials)),
      signup: async (details) => accept(await authApi.signup(details)),
      startDemo: async () => accept(await authApi.demo()),
      updateUser: (me) => setUser(me),
      logout: signOut,
      retry: () => {
        setStatus('loading');
        authApi
          .me()
          .then(({ user: me }) => {
            setUser(me);
            setStatus('authed');
          })
          .catch((err) => (err.response && err.response.status === 401 ? signOut() : setStatus('error')));
      },
    }),
    [user, status, sessionExpired, accept, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
