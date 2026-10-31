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
  title: "GiftProof — a gift, with its receipt",
  description:
    "Gift someone whose taste you don't share. Qloo's taste graph finds a cross-domain gift; a live receipt shows exactly why.",
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
          <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.22em] text-ink">
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

// Logo: a torn receipt-corner mark (the one metaphor, SIGNATURE-SPEC).
function ReceiptCorner() {
  return (
    <svg width="20" height="22" viewBox="0 0 20 22" fill="none" aria-hidden className="shrink-0">
      <path
        d="M2 2h16v14l-2.7-1.6L12.6 16l-2.6-1.6L7.4 16l-2.7-1.6L2 16V2Z"
        fill="var(--color-paper-2)"
        stroke="var(--color-ink)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M5.5 6.5h9M5.5 9.5h6" stroke="var(--color-accent)" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
