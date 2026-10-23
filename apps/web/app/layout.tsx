export const metadata = { title: "VERDICT", description: "Evaluation vehicule d'occasion" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, background: "#191919", color: "#e8e8e8",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
