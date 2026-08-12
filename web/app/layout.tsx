import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "SetPoint",
  description: "Volleyball highlight clip library",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <Providers>
          <header className="border-b bg-white">
            <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3 text-sm font-medium">
              <Link href="/" className="text-lg font-semibold">
                SetPoint
              </Link>
              <Link href="/">Library</Link>
              <Link href="/clips/new">Add Clip</Link>
              <Link href="/players">Players</Link>
              <Link href="/playlists">Playlists</Link>
            </nav>
          </header>
          <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
