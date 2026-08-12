import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Riwayat pemeriksaan",
  description:
    "Lanjutkan pemeriksaan aktif atau buka hasil AksaraNetra yang masih tersedia di perangkat ini.",
};

export default function RiwayatLayout({ children }: { children: ReactNode }) {
  return children;
}
