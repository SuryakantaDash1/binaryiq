import Image from 'next/image';
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
          <Link href="/" className="flex items-center">
            <Image src="/BinaryIQ_logo.svg" alt="BinaryIQ" width={1600} height={420} className="h-9 w-auto" />
          </Link>
          <Link href="/" className="text-sm font-medium text-brand-800 hover:underline">
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
