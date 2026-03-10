import "./globals.css";
import Link from "next/link";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header style={{ padding: 20, borderBottom: "1px solid #eee" }}>
  <nav
    style={{
      maxWidth: 900,
      margin: "auto",
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <Link href="/" style={{ fontWeight: 700, fontSize: 20 }}>
        Daily Good News 🌤️
      </Link>

      <div style={{ display: "flex", gap: 20 }}>
        <Link href="/stories">Stories</Link>
        <Link href="/submit">Submit</Link>
      </div>
    </div>

    <div style={{ display: "flex", gap: 15, fontSize: 14 }}>
      <Link href="/category/kindness">Kindness</Link>
      <Link href="/category/community">Community</Link>
      <Link href="/category/animals">Animals</Link>
      <Link href="/category/health">Health</Link>
      <Link href="/category/hope">Hope</Link>
    </div>
  </nav>
</header>

        {children}
      </body>
    </html>
  );
}
