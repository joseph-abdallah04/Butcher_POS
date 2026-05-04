import { createContext, useContext, useEffect, useMemo, useState } from 'react';

/** Persisted session key — also read by `api.js` for `X-Acting-Staff-Id`. */
export const SESSION_STORAGE_KEY = 'butchery-pos-session';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [session, setSession] = useState(() => {
    try {
      const raw = localStorage.getItem(SESSION_STORAGE_KEY);
      return raw ? JSON.parse(raw) : { shop: null, staff: null };
    } catch {
      return { shop: null, staff: null };
    }
  });

  useEffect(() => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  }, [session]);

  const value = useMemo(
    () => ({
      shop: session.shop,
      staff: session.staff,
      isLocked: Boolean(session.shop && session.staff),
      isManager: String(session.staff?.role ?? '').trim().toLowerCase() === 'manager',
      setShop: (shop) => setSession((prev) => ({ ...prev, shop, staff: null })),
      setStaff: (staff) => setSession((prev) => ({ ...prev, staff })),
      reset: () => setSession({ shop: null, staff: null }),
    }),
    [session],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used inside <SessionProvider>');
  }
  return ctx;
}
