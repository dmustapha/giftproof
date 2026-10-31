import type { Metadata } from "next";
import { Fraunces, JetBrains_Mono, Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

// Three fonts, three jobs (SELECTION R3): warm serif display, mono ledger hand, quiet sans body.
// Fraunces is a VARIABLE font. Next.js forbids pinning `weight` when custom
// `axes` are requested — a variable font already serves the full weight range.
// Dropping the weight array keeps the opsz/SOFT optical axes (the design intent)
// and unblocks `next build`. (debug P1)
const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
  variable: "--font-display",
  display: "swap",
});
const jbmono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});
const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://giftproof-app.vercel.app"),
  title: "GiftProof — a gift, with its receipt",
  description:
    "Gift someone whose taste you don't share. Qloo's taste graph finds a cross-domain gift; a live receipt shows exactly why.",
  openGraph: {
    title: "GiftProof — a gift, with its receipt",
    description:
      "Gift someone whose taste you don't share — ranked by Qloo, proven by the receipt.",
    url: "https://giftproof-app.vercel.app",
    siteName: "GiftProof",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "GiftProof — a gift, with its receipt" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${jbmono.variable} ${inter.variable}`}>
      <body className="min-h-screen font-sans text-ink antialiased">
        <SiteMark />
        {children}
      </body>
    </html>
  );
}

// De-glassed opaque mark + perforation rule (R8 — no glass, no backdrop-filter).
function SiteMark() {
  return (
    <div className="sticky top-0 z-40 border-b border-[var(--hair)] bg-paper">
      <div className="mx-auto flex max-w-5xl items-center gap-2.5 px-6 py-3">
        <Link href="/" aria-label="GiftProof home" className="group flex items-center gap-2.5">
          <ReceiptCorner />
          <span className="font-mono text-[16px] font-bold tracking-[-0.02em] text-ink">
            Gift<span className="text-accent-ink">Proof</span>
          </span>
        </Link>
        <nav className="ml-auto flex items-center gap-5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">
          <Link href="/app" className="transition-colors hover:text-ink">The tool</Link>
          <Link href="/proof" className="transition-colors hover:text-ink">The proof</Link>
        </nav>
      </div>
    </div>
  );
}

// Logo: the GiftProof mark — a gift tag that is a receipt (gift + proof in one glyph).
// Terracotta fill with paper-coloured cutouts so the hole/perforation/check read as negative space
// on the paper nav. Mirrors public/logo-mark.svg + the app icon.
function ReceiptCorner() {
  return (
    <svg width="18" height="22" viewBox="0 0 48 60" fill="none" aria-hidden className="shrink-0">
      <path d="M17 5 L40 5 Q44 5 44 9 L44 44 l-4 3 l-4 -3 l-4 3 l-4 -3 l-4 3 l-4 -3 l-4 3 l-4 -3 L8 16 Q8 14 9.5 12.5 L15 7 Q16 5 17 5 Z" fill="var(--color-accent)" />
      <circle cx="14.5" cy="12.5" r="2.4" fill="var(--color-paper)" />
      <line x1="12" y1="24" x2="40" y2="24" stroke="var(--color-paper)" strokeWidth="1.6" strokeDasharray="2.4 2.4" strokeLinecap="round" />
      <path d="M18 33 l3.6 3.6 L30 28.5" fill="none" stroke="var(--color-paper)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
