import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Periksa halaman",
  description:
    "Tempel alamat halaman publik untuk diperiksa aksesibilitasnya dan disiapkan versi yang lebih mudah dibaca.",
};

export default function PeriksaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
