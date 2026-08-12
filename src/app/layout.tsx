import type { Metadata } from "next";
import { Atkinson_Hyperlegible } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const atkinson = Atkinson_Hyperlegible({
  variable: "--font-atkinson",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "AksaraNetra | Aksesibilitas Digital Indonesia",
    template: "%s | AksaraNetra",
  },
  description:
    "Periksa hambatan aksesibilitas pada halaman publik, uji perbaikan yang aman, dan siapkan tampilan reader tanpa mengubah situs asli.",
  openGraph: {
    title: "AksaraNetra",
    description:
      "Pemeriksaan aksesibilitas untuk halaman publik dengan hasil yang dapat ditinjau.",
    type: "website",
    locale: "id_ID",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-scroll-behavior memberi tahu Next bahwa scroll-behavior: smooth di
    // CSS memang disengaja, sehingga peringatan di konsol berhenti muncul.
    <html lang="id" className={atkinson.variable} data-scroll-behavior="smooth">
      {/*
        suppressHydrationWarning hanya dipasang di body, bukan di seluruh
        pohon. Alasannya sempit dan spesifik: ekstensi browser seperti
        ColorZilla menempelkan atribut cz-shortcut-listen ke body sebelum React
        sempat jalan, dan React melaporkannya sebagai ketidakcocokan.
        Peringatan itu bukan bug kita dan tidak bisa kita cegah dari sisi kode.
        Yang penting, ini tidak menyembunyikan ketidakcocokan di dalam halaman,
        karena sifatnya tidak menurun ke elemen anak.
      */}
      <body suppressHydrationWarning>
        <a href="#main-content" className="skip-link">
          Langsung ke konten utama
        </a>
        <Header />
        <div id="main-content" tabIndex={-1}>
          {children}
        </div>
        <Footer />
      </body>
    </html>
  );
}
