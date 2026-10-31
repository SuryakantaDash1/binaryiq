'use client';

import Link from 'next/link';
import { POINTS_ENABLED } from '@/features/flags';

export default function UnsubscribePage(): React.JSX.Element {
  return (
    <div className="max-w-lg">
      <h2 className="text-xl font-bold text-gray-900">Unsubscribe / Account</h2>
      <p className="mt-2 text-sm text-gray-600">
        We&apos;d be sad to see you go. You can pause survey invitations from your{' '}
        <Link href="/account/notifications" className="text-brand-800 underline">
          notification preferences
        </Link>
        , or request account deletion below in line with our{' '}
        <Link href="/privacy" className="text-brand-800 underline">
          Privacy Policy
        </Link>
        .
      </p>

      <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-5">
        <p className="text-sm font-semibold text-red-700">Delete my account</p>
        <p className="mt-1 text-sm text-red-600">
          This permanently removes your account{POINTS_ENABLED ? ' and forfeits any unredeemed points' : ''}. This action
          cannot be undone.
        </p>
        <button
          type="button"
          className="mt-4 rounded-full border border-red-300 bg-white px-6 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100"
        >
          Request account deletion
        </button>
      </div>
    </div>
  );
}
