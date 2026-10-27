export const metadata = {
  title: "AutoVerdict",
  description: "Evaluation d'un vehicule d'occasion importe d'Allemagne",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Anton&family=Oswald:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{
        margin: 0, minHeight: "100vh", color: "#17140d",
        fontFamily: '"Oswald", system-ui, sans-serif',
        background: "radial-gradient(ellipse at 50% 0%, #e7d9af 0%, #cdb985 55%, #aa9565 100%)",
        backgroundAttachment: "fixed",
      }}>
        {children}
      </body>
    </html>
  );
}
