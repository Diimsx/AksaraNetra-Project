"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

type KontakContextValue = {
  terbuka: boolean;
  buka: () => void;
  tutup: () => void;
};

const KontakContext = createContext<KontakContextValue | null>(null);

/**
 * Menyediakan status buka/tutup modal kontak untuk Header dan Footer
 * sekaligus, supaya keduanya bisa memicu modal yang sama tanpa harus
 * meneruskan prop lewat layout.tsx (yang tetap Server Component).
 */
export function KontakProvider({ children }: { children: ReactNode }) {
  const [terbuka, setTerbuka] = useState(false);
  return (
    <KontakContext.Provider
      value={{
        terbuka,
        buka: () => setTerbuka(true),
        tutup: () => setTerbuka(false),
      }}
    >
      {children}
    </KontakContext.Provider>
  );
}

export function useKontak() {
  const ctx = useContext(KontakContext);
  if (!ctx) {
    throw new Error("useKontak harus dipakai di dalam KontakProvider");
  }
  return ctx;
}
