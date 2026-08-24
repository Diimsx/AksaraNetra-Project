"use client";

import ContactModal from "./ContactModal";
import { useKontak } from "./KontakContext";

/**
 * Jembatan tipis antara KontakContext dan ContactModal, supaya layout.tsx
 * (Server Component) tidak perlu tahu soal state buka/tutup modal.
 */
export default function ContactModalMount() {
  const { terbuka, tutup } = useKontak();
  return <ContactModal terbuka={terbuka} tutup={tutup} />;
}
