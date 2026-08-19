'use client';

import { Switch, Skeleton, Alert, Heading, Text } from '@influencer/ui';
import { useState, useEffect, useCallback } from 'react';


import { notificationsApi, type NotificationPreferenceDTO, type NotificationTypeEnum } from '@/lib/api/notifications';

const ALWAYS_ON_TYPES: NotificationTypeEnum[] = ['REGISTRATION', 'PASSWORD_RESET'];

const TYPE_LABELS: Record<NotificationTypeEnum, string> = {
  REGISTRATION: 'Account Registration',
  PASSWORD_RESET: 'Password Reset',
  SURVEY_INVITE: 'Survey Invitations',
  SURVEY_REMINDER: 'Survey Reminders',
  POINTS_UPDATE: 'Points Updates',
  GAME_REMINDER: 'Daily Game Reminders',
  REWARD_UPDATE: 'Reward Status Updates',
  OFFERS_NEWS: 'Offers & News',
};

const CHANNEL_LABELS = ['email', 'push', 'sms', 'whatsapp'] as const;
type Channel = (typeof CHANNEL_LABELS)[number];

const CHANNEL_DISPLAY: Record<Channel, string> = {
  email: 'Email',
  push: 'Push',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
};

export default function NotificationsPage(): React.JSX.Element {
  const [prefs, setPrefs] = useState<NotificationPreferenceDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    notificationsApi.getPreferences()
      .then(setPrefs)
      .catch(() => setError('Failed to load preferences'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = useCallback(async (type: NotificationTypeEnum, channel: Channel, value: boolean) => {
    const key = `${type}:${channel}`;
    setPrefs((prev) => prev.map((p) => p.type === type ? { ...p, [channel]: value } : p));
    setSaving(key);
    try {
      const updated = await notificationsApi.updatePreference({ type, [channel]: value });
      setPrefs((prev) => prev.map((p) => p.type === type ? { ...p, ...updated } : p));
    } catch {
      setPrefs((prev) => prev.map((p) => p.type === type ? { ...p, [channel]: !value } : p));
    } finally {
      setSaving(null);
    }
  }, []);

  return (
    <div>
      <div className="mb-6">
        <Heading level={3}>Notification Preferences</Heading>
        <Text color="secondary" size="sm">Choose how you&apos;d like to be notified.</Text>
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      {loading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse">
            <thead>
              <tr>
                <th className="pb-3 text-left text-sm font-semibold text-text">Notification type</th>
                {CHANNEL_LABELS.map((ch) => (
                  <th key={ch} className="pb-3 text-center text-sm font-semibold text-text">{CHANNEL_DISPLAY[ch]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {prefs.map((pref) => {
                const isAlwaysOn = ALWAYS_ON_TYPES.includes(pref.type);
                return (
                  <tr key={pref.type} className="border-t border-border">
                    <td className="py-4 pr-4">
                      <Text className="font-medium">{TYPE_LABELS[pref.type]}</Text>
                      {isAlwaysOn && <Text size="sm" color="secondary">Required for account security</Text>}
                    </td>
                    {CHANNEL_LABELS.map((ch) => {
                      const isDisabled = isAlwaysOn && ch === 'email';
                      return (
                        <td key={ch} className="py-4 text-center">
                          <Switch
                            checked={pref[ch]}
                            onChange={(v) => handleToggle(pref.type, ch, v)}
                            disabled={isDisabled || saving === `${pref.type}:${ch}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
