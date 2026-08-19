'use client';

import { useState, useEffect } from 'react';
import { Button } from '@influencer/ui';
import { dataRightsApi } from '@/lib/api/data-rights.js';

const STORAGE_KEY = 'cookie_consent_v1';

export function CookieBanner(): React.JSX.Element | null {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) setVisible(true);
  }, []);

  function handleAccept() {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    setVisible(false);
    dataRightsApi
      .grantConsent({ consentType: 'COOKIES', consentVersion: '1.0', granted: true })
      .catch(() => void 0);
  }

  function handleDecline() {
    localStorage.setItem(STORAGE_KEY, 'declined');
    setVisible(false);
    dataRightsApi
      .grantConsent({ consentType: 'COOKIES', consentVersion: '1.0', granted: false })
      .catch(() => void 0);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-[100] border-t border-border bg-surface px-4 py-4 shadow-lg md:px-8"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-text">
          We use essential cookies for authentication. We also use analytics cookies to improve your
          experience. See our{' '}
          <a href="/privacy" className="text-primary underline">
            Privacy Policy
          </a>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={handleDecline}>
            Essential only
          </Button>
          <Button size="sm" onClick={handleAccept}>
            Accept all
          </Button>
        </div>
      </div>
    </div>
  );
}
