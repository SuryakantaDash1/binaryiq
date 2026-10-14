'use client';

import { Mail, MessageCircle, MessageSquare, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ApiError } from '@/lib/api/client';
import {
  notificationsApi,
  type NotificationPreferenceDTO,
  type NotificationTypeEnum,
} from '@/lib/api/notifications';

type Channel = 'email' | 'push' | 'sms' | 'whatsapp';
const CHANNELS: { key: Channel; label: string; icon: typeof Mail }[] = [
  { key: 'email', label: 'EMAIL', icon: Mail },
  { key: 'push', label: 'PUSH', icon: Smartphone },
  { key: 'sms', label: 'SMS', icon: MessageSquare },
  { key: 'whatsapp', label: 'WHATSAPP', icon: MessageCircle },
];

type Prefs = Record<Channel, boolean>;
const emptyPrefs = (): Prefs => ({ email: false, push: false, sms: false, whatsapp: false });

/** Rows backed by a real NotificationType (persisted via the API). */
interface ApiRow {
  kind: 'api';
  key: string;
  type: NotificationTypeEnum;
  label: string;
  hint: string;
}
/** Rows with no backend type yet — persisted per-viewer in localStorage. */
interface LocalRow {
  kind: 'local';
  key: string;
  label: string;
  hint: string;
}
type Row = ApiRow | LocalRow;

const SECTIONS: { title: string; rows: Row[] }[] = [
  {
    title: 'Surveys',
    rows: [
      {
        kind: 'api',
        key: 'survey_invitations',
        type: 'SURVEY_INVITE',
        label: 'Survey invitations',
        hint: 'Be informed when a new survey is available',
      },
    ],
  },
  {
    title: 'News',
    rows: [
      {
        kind: 'api',
        key: 'offers',
        type: 'OFFERS_NEWS',
        label: 'Offers',
        hint: 'Receive exclusive promotional offers and important updates.',
      },
      {
        kind: 'local',
        key: 'comments_my_post',
        label: 'Comments on my post',
        hint: 'Get notifications when someone comments on my post',
      },
      {
        kind: 'local',
        key: 'all_comments',
        label: 'All comments',
        hint: 'Get notifications when new comments are posted on existing posts.',
      },
    ],
  },
];

const LOCAL_STORAGE_KEY = 'community_comment_prefs';

function readLocalPrefs(): Record<string, Prefs> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Prefs>) : {};
  } catch {
    return {};
  }
}

export function CommunityNotificationSettings(): React.JSX.Element {
  const [state, setState] = useState<Record<string, Prefs>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    notificationsApi
      .getPreferences()
      .then((prefs) => {
        if (!active) return;
        const byType = new Map<string, NotificationPreferenceDTO>(prefs.map((p) => [p.type, p]));
        const local = readLocalPrefs();
        const next: Record<string, Prefs> = {};
        for (const section of SECTIONS) {
          for (const row of section.rows) {
            if (row.kind === 'api') {
              const p = byType.get(row.type);
              next[row.key] = p
                ? { email: p.email, push: p.push, sms: p.sms, whatsapp: p.whatsapp }
                : emptyPrefs();
            } else {
              next[row.key] = local[row.key] ?? emptyPrefs();
            }
          }
        }
        setState(next);
      })
      .catch(() => active && setError('Could not load your notification settings.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  function toggle(rowKey: string, channel: Channel): void {
    setSaved(false);
    setState((prev) => {
      const current = prev[rowKey] ?? emptyPrefs();
      return { ...prev, [rowKey]: { ...current, [channel]: !current[channel] } };
    });
  }

  async function handleSave(): Promise<void> {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      // Persist API-backed rows (one PUT per type).
      const apiRows = SECTIONS.flatMap((s) => s.rows).filter((r): r is ApiRow => r.kind === 'api');
      await Promise.all(
        apiRows.map((r) => {
          const p = state[r.key] ?? emptyPrefs();
          return notificationsApi.updatePreference({
            type: r.type,
            email: p.email,
            push: p.push,
            sms: p.sms,
            whatsapp: p.whatsapp,
          });
        }),
      );
      // Persist local-only rows (comment prefs) per viewer.
      const localRows = SECTIONS.flatMap((s) => s.rows).filter((r): r is LocalRow => r.kind === 'local');
      const localOut: Record<string, Prefs> = {};
      for (const r of localRows) localOut[r.key] = state[r.key] ?? emptyPrefs();
      try {
        window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localOut));
      } catch {
        /* storage may be unavailable — non-fatal */
      }
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <h2 className="text-2xl font-black text-brand-800">Notification Settings</h2>
        {/* Channel column headers */}
        <div className="grid grid-cols-4 gap-6 md:gap-8">
          {CHANNELS.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.key} className="flex flex-col items-center gap-1">
                <Icon className="h-6 w-6 text-gray-900" />
                <span className="text-[11px] font-bold tracking-wide text-gray-900">{c.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-8 space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="mb-2 text-lg font-bold text-brand-800">{section.title}</h3>
              <div className="divide-y divide-gray-100">
                {section.rows.map((row) => {
                  const prefs = state[row.key] ?? emptyPrefs();
                  return (
                    <div
                      key={row.key}
                      className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="max-w-md">
                        <p className="font-bold text-gray-900">{row.label}</p>
                        <p className="mt-0.5 text-sm text-gray-500">{row.hint}</p>
                      </div>
                      <div className="grid grid-cols-4 gap-6 md:gap-8">
                        {CHANNELS.map((c) => (
                          <label key={c.key} className="flex items-center justify-center">
                            <input
                              type="checkbox"
                              checked={prefs[c.key]}
                              onChange={() => toggle(row.key, c.key)}
                              className="h-5 w-5 cursor-pointer rounded border-gray-300 text-brand-800 accent-brand-800 focus:ring-brand-700"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded-full bg-brand-800 px-10 py-3 text-sm font-bold tracking-wide text-white transition hover:bg-brand-900 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            {saved && <span className="text-sm font-medium text-brand-800">Saved ✓</span>}
          </div>
        </div>
      )}
    </div>
  );
}
