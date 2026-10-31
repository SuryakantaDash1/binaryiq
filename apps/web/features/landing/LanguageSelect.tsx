'use client';

import { Globe } from 'lucide-react';
import { useEffect, useState } from 'react';

export const LANGUAGES = [
  { code: 'en-IN', label: 'english (india)' },
  { code: 'en-GB', label: 'english (united kingdom)' },
  { code: 'en-US', label: 'english (united states)' },
  { code: 'en-AU', label: 'english (australia)' },
  { code: 'en-CA', label: 'english (canada)' },
  { code: 'en-AE', label: 'english (united arab emirates)' },
  { code: 'en-IE', label: 'english (ireland)' },
  { code: 'en-EG', label: 'english (egypt)' },
  { code: 'en-SG', label: 'english (singapore)' },
  { code: 'en-MY', label: 'english (malaysia)' },
  { code: 'en-PH', label: 'english (philippines)' },
  { code: 'en-ZA', label: 'english (south africa)' },
  { code: 'en-PK', label: 'english (pakistan)' },
  { code: 'hi-IN', label: 'हिन्दी (भारत)' },
  { code: 'ar-AE', label: 'العربية (الإمارات العربية المتحدة)' },
  { code: 'ar-EG', label: 'العربية (مصر)' },
  { code: 'ar-MA', label: 'العربية (المغرب)' },
  { code: 'ar-SA', label: 'العربية (المملكة العربية السعودية)' },
  { code: 'de-DE', label: 'deutsch (deutschland)' },
  { code: 'de-AT', label: 'deutsch (österreich)' },
  { code: 'de-CH', label: 'deutsch (schweiz)' },
  { code: 'fr-FR', label: 'français (france)' },
  { code: 'fr-BE', label: 'français (belgique)' },
  { code: 'fr-CA', label: 'français (canada)' },
  { code: 'es-ES', label: 'español (españa)' },
  { code: 'es-MX', label: 'español (méxico)' },
  { code: 'pt-BR', label: 'português (brasil)' },
  { code: 'pt-PT', label: 'português (portugal)' },
  { code: 'it-IT', label: 'italiano (italia)' },
  { code: 'nl-NL', label: 'nederlands (nederland)' },
  { code: 'nl-BE', label: 'nederlands (belgië)' },
  { code: 'pl-PL', label: 'polski (polska)' },
  { code: 'ru-RU', label: 'русский (россия)' },
  { code: 'tr-TR', label: 'türkçe (türkiye)' },
  { code: 'zh-CN', label: '简体中文 (中国)' },
  { code: 'zh-TW', label: '繁體中文 (台灣)' },
  { code: 'ja-JP', label: '日本語 (日本)' },
  { code: 'ko-KR', label: '한국어 (한국)' },
  { code: 'id-ID', label: 'bahasa indonesia' },
  { code: 'ms-MY', label: 'bahasa malaysia' },
  { code: 'da-DK', label: 'dansk' },
  { code: 'sv-SE', label: 'svenska' },
  { code: 'cs-CZ', label: 'čeština' },
  { code: 'el-GR', label: 'ελληνικά' },
];

function getStoredLocale(): string {
  if (typeof document === 'undefined') return 'en-IN';
  const m = document.cookie.match(/NEXT_LOCALE=([^;]+)/);
  return m?.[1] ?? 'en-IN';
}

/** Locale picker — stores the choice in the NEXT_LOCALE cookie and reloads so the server renders the new language. */
export function LanguageSelect({
  label,
  className = '',
  tone = 'light',
}: {
  label: string;
  className?: string;
  /** `dark` for use on the dark auth background. */
  tone?: 'light' | 'dark';
}): React.JSX.Element {
  const [lang, setLang] = useState('en-IN');

  useEffect(() => {
    setLang(getStoredLocale());
  }, []);

  function onChange(e: React.ChangeEvent<HTMLSelectElement>): void {
    const next = e.target.value;
    setLang(next);
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; SameSite=Lax`;
    window.location.reload();
  }

  return (
    <label className={`relative inline-flex items-center ${className}`}>
      <span className="sr-only">{label}</span>
      <Globe className={`pointer-events-none absolute left-3 h-4 w-4 ${tone === 'dark' ? 'text-white/60' : 'text-gray-400'}`} />
      <select
        value={lang}
        onChange={onChange}
        className={`h-9 max-w-[11rem] appearance-none truncate rounded-full border pl-9 pr-4 text-xs font-medium transition focus:outline-none ${
          tone === 'dark'
            ? 'border-white/15 bg-white/10 text-white/80 hover:border-white/30 focus:border-white/40 [&>option]:text-ink'
            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 focus:border-brand-500'
        }`}
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
