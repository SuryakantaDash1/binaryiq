import Link from 'next/link';

export default function InfoLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-teal-700 to-teal-900 text-white">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="leading-tight">
              <p className="text-base font-bold text-gray-900">Influencers</p>
              <p className="text-[10px] text-gray-500">surveys &amp; rewards</p>
            </div>
          </Link>
          <Link href="/" className="text-sm font-medium text-teal-800 hover:underline">
            ← Home
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">{children}</main>

      <footer className="border-t border-gray-200 bg-white py-6">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-6 text-xs text-gray-500">
          <Link href="/about" className="hover:text-gray-900 hover:underline">About Us</Link>
          <Link href="/cookies" className="hover:text-gray-900 hover:underline">Cookies Policy</Link>
          <Link href="/contact" className="hover:text-gray-900 hover:underline">Contact Us</Link>
          <Link href="/faqs" className="hover:text-gray-900 hover:underline">FAQ&apos;s</Link>
          <Link href="/terms" className="hover:text-gray-900 hover:underline">Terms</Link>
          <Link href="/privacy" className="hover:text-gray-900 hover:underline">Privacy</Link>
        </div>
        <p className="mt-4 text-center text-xs text-gray-400">© 2026 Influencers. All rights reserved.</p>
      </footer>
    </div>
  );
}
