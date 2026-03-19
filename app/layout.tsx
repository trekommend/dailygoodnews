import "./globals.css";
import Link from "next/link";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="overflow-x-hidden bg-gray-50 text-gray-900">
        <header className="border-b border-gray-200 bg-white">
          <nav className="mx-auto w-full max-w-5xl px-4 py-4 sm:px-6">
            {/* Top row */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link
                href="/"
                className="text-lg font-bold tracking-tight"
              >
                Daily Good News 🌤️
              </Link>

              <div className="flex flex-wrap gap-4 text-sm">
                <Link href="/stories" className="hover:underline">
                  Stories
                </Link>
                <Link href="/submit" className="hover:underline">
                  Submit
                </Link>
              </div>
            </div>

            {/* Category row */}
            <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-600">
              <Link href="/category/kindness" className="hover:underline">
                Kindness
              </Link>
              <Link href="/category/community" className="hover:underline">
                Community
              </Link>
              <Link href="/category/animals" className="hover:underline">
                Animals
              </Link>
              <Link href="/category/health" className="hover:underline">
                Health
              </Link>
              <Link href="/category/hope" className="hover:underline">
                Hope
              </Link>
            </div>
          </nav>
        </header>

        {/* Main content */}
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
          {children}
        </div>
      </body>
    </html>
  );
}