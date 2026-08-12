import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Hasil pemeriksaan",
  description:
    "Ringkasan pemeriksaan aksesibilitas dan hasil perbaikan AksaraNetra.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ResultLayout({ children }: { children: ReactNode }) {
  return children;
}
