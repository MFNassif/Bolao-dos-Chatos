import { createContext, useContext, useState } from 'react';

export const BellaContext = createContext({ bella: false, setBella: () => {} });

export function useBella() {
  return useContext(BellaContext);
}

export function BellaProvider({ children }) {
  const [bella, setBella] = useState(() => {
    try { return localStorage.getItem('bellaMode') === '1'; } catch { return false; }
  });

  function toggle() {
    setBella(v => {
      const next = !v;
      try { localStorage.setItem('bellaMode', next ? '1' : '0'); } catch {}
      return next;
    });
  }

  return (
    <BellaContext.Provider value={{ bella, toggle }}>
      {children}
    </BellaContext.Provider>
  );
}
