'use client';

import {
  Briefcase,
  Car,
  Clapperboard,
  Contact,
  CircuitBoard,
  Gamepad2,
  Heart,
  HeartHandshake,
  HeartPulse,
  Home,
  MapPin,
  PersonStanding,
  PieChart,
  ShieldCheck,
  ShoppingBag,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { TolunaSurvey } from '@/features/profile-surveys/TolunaSurvey';
import { profileSurveysApi } from '@/lib/api/profile-surveys';
import type { CategoryListResult, CategoryDetail } from '@/lib/api/profile-surveys';

const ICONS: Record<string, LucideIcon> = {
  social_activities: ShieldCheck,
  about_you: Contact,
  home_and_family: Home,
  employment: Briefcase,
  finance: PieChart,
  health: HeartPulse,
  personal_care: HeartHandshake,
  lifestyle: PersonStanding,
  travel: MapPin,
  shopping: ShoppingBag,
  media: Clapperboard,
  technology: CircuitBoard,
  automotive: Car,
  video_games: Gamepad2,
};

type View =
  | { kind: 'grid' }
  | { kind: 'loading' }
  | { kind: 'survey'; detail: CategoryDetail };

export default function ProfileSurveysPage(): React.JSX.Element {
  const [list, setList] = useState<CategoryListResult | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ kind: 'grid' });
  const [thanks, setThanks] = useState(false);

  function refreshList(): void {
    profileSurveysApi
      .list()
      .then(setList)
      .catch(() => setError('Failed to load profile surveys'))
      .finally(() => setLoadingList(false));
  }

  useEffect(refreshList, []);

  async function openCategory(key: string): Promise<void> {
    setThanks(false);
    setView({ kind: 'loading' });
    try {
      const detail = await profileSurveysApi.get(key);
      // Brief "getting everything ready" beat, matching the reference flow.
      setTimeout(() => setView({ kind: 'survey', detail }), 900);
    } catch {
      setError('Could not open this survey');
      setView({ kind: 'grid' });
    }
  }

  function handleSaved(): void {
    setView({ kind: 'grid' });
    setThanks(true);
    setLoadingList(true);
    refreshList();
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const intro =
    'Completing and ensuring your profile surveys remain up to date will increase your chances of being matched to highly-rewarding projects, tailored just for you.';

  if (view.kind === 'loading') {
    return (
      <div>
        <p className="text-[15px] leading-relaxed text-gray-500">{intro}</p>
        <div className="flex flex-col items-center justify-center py-24">
          <div className="flex gap-3">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="h-4 w-4 animate-bounce rounded-full bg-indigo-700"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <p className="mt-8 text-xl font-medium text-gray-700">Getting everything ready for you…</p>
        </div>
      </div>
    );
  }

  if (view.kind === 'survey') {
    return (
      <TolunaSurvey
        categoryKey={view.detail.key}
        name={view.detail.name}
        schema={view.detail.schema}
        defaults={view.detail.responses as Record<string, unknown> | undefined}
        onCancel={() => setView({ kind: 'grid' })}
        onSaved={handleSaved}
      />
    );
  }

  return (
    <div>
      <p className="text-[15px] leading-relaxed text-gray-500">{intro}</p>

      {thanks && (
        <div className="mt-6 flex items-start gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 text-white">
            <Heart className="h-8 w-8 fill-white" />
          </span>
          <div className="flex-1">
            <p className="text-xl font-bold text-indigo-900">Thank you for completing your profile.</p>
            <p className="mt-1 text-gray-600">Your profile information has been saved successfully.</p>
          </div>
          <button
            type="button"
            onClick={() => setThanks(false)}
            aria-label="Dismiss"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-gray-500 hover:bg-gray-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

      {loadingList && !list ? (
        <div className="py-16 text-center text-gray-400">Loading…</div>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 md:grid-cols-4">
          {list?.categories.map((cat) => {
            const Icon = ICONS[cat.key] ?? Contact;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => void openCategory(cat.key)}
                className="group flex flex-col items-center text-center outline-none"
              >
                <span className="relative">
                  <Icon
                    className="h-12 w-12 text-teal-800 transition group-hover:scale-110"
                    strokeWidth={1.75}
                    fill="currentColor"
                  />
                  {cat.completed && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white ring-2 ring-white">
                      <svg viewBox="0 0 20 20" fill="none" className="h-3 w-3">
                        <path d="M5 10l3 3 7-7" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  )}
                </span>
                <span className="mt-3 text-lg font-bold leading-tight text-gray-800">{cat.name}</span>
                <span className="mt-1 text-[15px] text-gray-700">{cat.pointsValue} points</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
