import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'butchery-pos-session';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [session, setSession] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { shop: null, staff: null };
    } catch {
      return { shop: null, staff: null };
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, [session]);

  const value = useMemo(
    () => ({
      shop: session.shop,
      staff: session.staff,
      isLocked: Boolean(session.shop && session.staff),
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
