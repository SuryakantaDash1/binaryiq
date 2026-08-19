import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

// Maps every locale code in the dropdown to a base language message file
const LOCALE_MAP: Record<string, string> = {
  'en-IN': 'en', 'en-GB': 'en', 'en-US': 'en', 'en-AU': 'en', 'en-CA': 'en',
  'en-AE': 'en', 'en-IE': 'en', 'en-EG': 'en', 'en-SG': 'en', 'en-MY': 'en',
  'en-PH': 'en', 'en-ZA': 'en', 'en-PK': 'en',
  'hi-IN': 'hi',
  'ar-AE': 'ar', 'ar-EG': 'ar', 'ar-MA': 'ar', 'ar-SA': 'ar',
  'de-DE': 'de', 'de-AT': 'de', 'de-CH': 'de',
  'fr-FR': 'fr', 'fr-BE': 'fr', 'fr-CA': 'fr',
  'es-ES': 'es', 'es-MX': 'es',
  'pt-BR': 'pt', 'pt-PT': 'pt',
  'it-IT': 'it',
  'nl-NL': 'nl', 'nl-BE': 'nl',
  'pl-PL': 'pl',
  'ru-RU': 'ru',
  'tr-TR': 'tr',
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-TW',
  'ja-JP': 'ja',
  'ko-KR': 'ko',
  'id-ID': 'id',
  'ms-MY': 'ms',
  'da-DK': 'da',
  'sv-SE': 'sv',
  'cs-CZ': 'cs',
  'el-GR': 'el',
};

function getBaseLang(raw: string): string {
  return LOCALE_MAP[raw] ?? raw.split('-')[0] ?? 'en';
}

async function loadMessages(lang: string) {
  switch (lang) {
    case 'nl': return (await import('../messages/nl.json')).default;
    case 'hi': return (await import('../messages/hi.json')).default;
    case 'ar': return (await import('../messages/ar.json')).default;
    case 'de': return (await import('../messages/de.json')).default;
    case 'fr': return (await import('../messages/fr.json')).default;
    case 'es': return (await import('../messages/es.json')).default;
    case 'pt': return (await import('../messages/pt.json')).default;
    case 'it': return (await import('../messages/it.json')).default;
    case 'pl': return (await import('../messages/pl.json')).default;
    case 'ru': return (await import('../messages/ru.json')).default;
    case 'tr': return (await import('../messages/tr.json')).default;
    case 'zh-CN': return (await import('../messages/zh-CN.json')).default;
    case 'zh-TW': return (await import('../messages/zh-TW.json')).default;
    case 'ja': return (await import('../messages/ja.json')).default;
    case 'ko': return (await import('../messages/ko.json')).default;
    case 'id': return (await import('../messages/id.json')).default;
    case 'ms': return (await import('../messages/ms.json')).default;
    case 'da': return (await import('../messages/da.json')).default;
    case 'sv': return (await import('../messages/sv.json')).default;
    case 'cs': return (await import('../messages/cs.json')).default;
    case 'el': return (await import('../messages/el.json')).default;
    default: return (await import('../messages/en.json')).default;
  }
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const rawLocale = cookieStore.get('NEXT_LOCALE')?.value ?? 'en-IN';
  const lang = getBaseLang(rawLocale);
  const messages = await loadMessages(lang);
  return { locale: lang, messages };
});
