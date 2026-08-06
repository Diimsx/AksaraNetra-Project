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
    default: "AksaraNetra — Aksesibilitas Digital Indonesia",
    template: "%s | AksaraNetra",
  },
  description:
    "Alat bantu aksesibilitas untuk membantu tunanetra mengakses layanan publik pemerintah Indonesia dengan versi yang lebih mudah dibaca dan navigasi ramah pembaca layar.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={atkinson.variable}>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to Main Content
        </a>
        <Header />
        <main id="main-content">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
