import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { Providers } from "@/components/Providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });

export const metadata: Metadata = {
  title: "SetPoint",
  description: "Volleyball highlight clip library",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen font-sans">
        <Providers>
          <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/80 backdrop-blur-md">
            <nav className="mx-auto flex max-w-5xl items-center gap-8 px-4 py-4">
              <Link
                href="/"
                className="bg-gradient-to-r from-cyan-300 to-violet-400 bg-clip-text text-lg font-bold tracking-tight text-transparent"
              >
                SetPoint
              </Link>
              <div className="flex items-center gap-6">
                <Link href="/" className="nav-link">
                  Library
                </Link>
                <Link href="/clips/new" className="nav-link">
                  Add Clip
                </Link>
                <Link href="/players" className="nav-link">
                  Players
                </Link>
                <Link href="/playlists" className="nav-link">
                  Playlists
                </Link>
              </div>
            </nav>
          </header>
          <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
