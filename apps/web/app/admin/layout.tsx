// Enveloppe de toutes les pages /admin : ajoute le bouton flottant « Conso Apify ».
import ConsoApify from "@/components/ConsoApify";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ConsoApify />
    </>
  );
}
