import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-zinc-50">
        <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
          <header className="mb-6">
            <h1 className="text-xl font-semibold text-zinc-900">ATLAS</h1>
            <p className="text-sm text-zinc-600">UI MVP v1.0</p>
            <nav className="mt-3 flex gap-4 text-sm text-zinc-700">
              <a href="/sites" className="underline">Sites</a>
              <a href="/precheck" className="underline">Precheck</a>
              <a href="/score" className="underline">Score</a>
              <a href="/audit-log" className="underline">Audit log</a>
            </nav>
          </header>

          {children}
        </main>
      </body>
    </html>
  );
}
