import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ||
      "https://your-domain.vercel.app"
  ),
  title: {
    default: "Daily Good News",
    template: "%s | Daily Good News",
  },
  description:
    "A daily source of uplifting, positive news from around the world. Real stories that inspire hope.",
  openGraph: {
    title: "Daily Good News",
    description:
      "A daily source of uplifting, positive news from around the world.",
    siteName: "Daily Good News",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Daily Good News",
    description:
      "A daily source of uplifting, positive news from around the world.",
  },
  robots: {
  index: process.env.NODE_ENV === "production",
  follow: process.env.NODE_ENV === "production",
},
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          overflowX: "hidden",
          background: "#f9fafb",
          color: "#111827",
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <header
          style={{
            borderBottom: "1px solid #e5e7eb",
            background: "#ffffff",
          }}
        >
          <nav
            style={{
              maxWidth: 1100,
              margin: "0 auto",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <Link
                href="/"
                style={{
                  fontWeight: 700,
                  fontSize: 22,
                  textDecoration: "none",
                  color: "#111827",
                }}
              >
                Daily Good News 🌤️
              </Link>

              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <Link href="/stories" style={{ textDecoration: "none", color: "#111827" }}>
                  Stories
                </Link>
                <Link href="/submit" style={{ textDecoration: "none", color: "#111827" }}>
                  Submit
                </Link>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 14,
                flexWrap: "wrap",
                fontSize: 14,
              }}
            >
              <Link href="/category/kindness" style={{ textDecoration: "none", color: "#4b5563" }}>
                Kindness
              </Link>
              <Link href="/category/community" style={{ textDecoration: "none", color: "#4b5563" }}>
                Community
              </Link>
              <Link href="/category/animals" style={{ textDecoration: "none", color: "#4b5563" }}>
                Animals
              </Link>
              <Link href="/category/health" style={{ textDecoration: "none", color: "#4b5563" }}>
                Health
              </Link>
              <Link href="/category/hope" style={{ textDecoration: "none", color: "#4b5563" }}>
                Hope
              </Link>
            </div>
          </nav>
        </header>

        {children}
      </body>
    </html>
  );
}