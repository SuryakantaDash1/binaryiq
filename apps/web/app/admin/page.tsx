'use client';

import type { AdminStats } from '@binaryiq/types';
import {
  Activity,
  Coins,
  Gift,
  LifeBuoy,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { adminApi } from '@/lib/api/admin';

type Tone = 'teal' | 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'orange' | 'pink';

const TONES: Record<Tone, { chip: string; grad: string }> = {
  teal: { chip: 'bg-brand-100 text-brand-700', grad: 'from-brand-50' },
  blue: { chip: 'bg-sky-100 text-sky-700', grad: 'from-sky-50' },
  green: { chip: 'bg-emerald-100 text-emerald-700', grad: 'from-emerald-50' },
  amber: { chip: 'bg-amber-100 text-amber-700', grad: 'from-amber-50' },
  red: { chip: 'bg-rose-100 text-rose-700', grad: 'from-rose-50' },
  purple: { chip: 'bg-violet-100 text-violet-700', grad: 'from-violet-50' },
  orange: { chip: 'bg-orange-100 text-orange-700', grad: 'from-orange-50' },
  pink: { chip: 'bg-pink-100 text-pink-700', grad: 'from-pink-50' },
};

function MetricCard({
  label,
  value,
  sub,
  tone,
  icon,
  href,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone: Tone;
  icon: ReactIcon;
  href?: string;
}): React.JSX.Element {
  const Icon = icon;
  const t = TONES[tone];
  const inner = (
    <>
      <span className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${t.grad} to-transparent opacity-70`} />
      <div className="relative">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-secondary">{label}</span>
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${t.chip}`}>
            <Icon className="h-5 w-5" />
          </span>
        </div>
        <p className="text-3xl font-black tracking-tight text-text">{value}</p>
        {sub && <p className="mt-1 text-xs text-secondary">{sub}</p>}
      </div>
    </>
  );
  const cls =
    'relative block overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition duration-200';
  if (href) {
    return (
      <Link href={href} className={`${cls} cursor-pointer hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)]`}>
        {inner}
      </Link>
    );
  }
  return <div className={`${cls} hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)]`}>{inner}</div>;
}

type ReactIcon = typeof Users;

/** Builds a smooth (bezier-through-midpoints) SVG path from data points. */
function smoothPath(points: [number, number][]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0]![0]},${points[0]![1]}`;
  let d = `M ${points[0]![0]},${points[0]![1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i]!;
    const [x1, y1] = points[i + 1]!;
    const mx = (x0 + x1) / 2;
    d += ` C ${mx},${y0} ${mx},${y1} ${x1},${y1}`;
  }
  return d;
}

function SignupsLineChart({ data }: { data: { date: string; count: number }[] }): React.JSX.Element {
  const W = 600;
  const H = 160;
  const PAD = 6;
  const max = Math.max(1, ...data.map((d) => d.count));
  const min = Math.min(...data.map((d) => d.count));
  const span = Math.max(1, max - min);

  const points: [number, number][] = data.map((d, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * W : 0;
    const y = PAD + (1 - (d.count - min) / span) * (H - PAD * 2);
    return [x, y];
  });

  const linePath = smoothPath(points);
  const last = points[points.length - 1]!;
  const areaPath = `${linePath} L ${last[0]},${H} L 0,${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-40 w-full overflow-visible">
      <defs>
        <linearGradient id="signupsArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9a268f" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#9a268f" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#signupsArea)" stroke="none" />
      <path
        d={linePath}
        fill="none"
        stroke="#9a268f"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last[0]} cy={last[1]} r={4.5} fill="#9a268f" stroke="white" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function AdminDashboardPage(): React.JSX.Element {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.getStats().then(setStats).catch(() => setError('Failed to load dashboard stats.'));
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!stats) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-surface-alt" />
        ))}
      </div>
    );
  }

  const { users, points, engagement } = stats;
  const verifiedPct = users.total ? Math.round((users.verified / users.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-8">
      <div className="md:hidden">
        <h1 className="text-2xl font-black text-text">Dashboard</h1>
        <p className="text-sm text-secondary">Platform overview</p>
      </div>

      {/* Metric tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard tone="teal" icon={Users} label="Total users" value={users.total.toLocaleString()} sub={`${users.new30d} in last 30 days`} href="/admin/users" />
        <MetricCard tone="blue" icon={Activity} label="Active users (7d)" value={users.active7d.toLocaleString()} sub={`${users.active30d.toLocaleString()} in last 30 days`} href="/admin/users?status=active" />
        <MetricCard tone="green" icon={UserCheck} label="Verified users" value={users.verified.toLocaleString()} sub={`${verifiedPct}% of all users`} href="/admin/users?verified=true" />
        <MetricCard tone="amber" icon={UserPlus} label="New today" value={users.newToday.toLocaleString()} sub={`${users.new7d} this week`} href="/admin/users" />
        <MetricCard tone="red" icon={UserX} label="Blocked users" value={users.blocked.toLocaleString()} href="/admin/users?status=blocked" />
        <MetricCard tone="purple" icon={Coins} label="Points issued" value={points.issued.toLocaleString()} sub={`${points.outstanding.toLocaleString()} outstanding`} href="/admin/rewards" />
        <MetricCard tone="orange" icon={Gift} label="Pending redemptions" value={engagement.redemptionsPending.toLocaleString()} sub={`${engagement.redemptionsTotal} total`} href="/admin/rewards" />
        <MetricCard tone="pink" icon={LifeBuoy} label="Open tickets" value={engagement.openTickets.toLocaleString()} href="/admin/support" />
      </div>

      {/* Signups chart */}
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-bold text-text">New signups — last 30 days</h2>
          <span className="text-sm font-semibold text-brand-700">
            {stats.signupsByDay[stats.signupsByDay.length - 1]?.count} today
          </span>
        </div>
        <SignupsLineChart data={stats.signupsByDay} />
        <div className="mt-2 flex justify-between text-xs text-secondary">
          <span>{stats.signupsByDay[0]?.date}</span>
          <span>{stats.signupsByDay[stats.signupsByDay.length - 1]?.date}</span>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Engagement + demographics */}
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="mb-4 font-bold text-text">Engagement</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Row label="Survey responses" value={engagement.surveyResponses} />
            <Row label="Poll votes" value={engagement.pollVotes} />
            <Row label="Game plays" value={engagement.gamePlays} />
            <Row label="Profile surveys" value={engagement.profileSurveyResponses} />
            <Row label="Points spent" value={points.spent} />
            <Row label="Redemptions" value={engagement.redemptionsTotal} />
          </dl>
          <h3 className="mb-2 mt-6 text-sm font-semibold text-text">Gender split</h3>
          <div className="flex flex-wrap gap-2">
            {stats.genderSplit.map((g) => (
              <span key={g.gender} className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                {g.gender}: {g.count}
              </span>
            ))}
          </div>
          {stats.topCountries.length > 0 && (
            <>
              <h3 className="mb-2 mt-4 text-sm font-semibold text-text">Top countries</h3>
              <div className="flex flex-wrap gap-2">
                {stats.topCountries.map((c) => (
                  <span key={c.country} className="rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
                    {c.country}: {c.count}
                  </span>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Recent signups */}
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-text">Recent signups</h2>
            <Link href="/admin/users" className="text-sm font-medium text-brand-700 hover:underline">View all users →</Link>
          </div>
          <ul className="divide-y divide-border">
            {stats.recentSignups.map((u) => (
              <li key={u.id} className="flex items-center justify-between py-2.5 text-sm">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                    {u.username.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-text">{u.email}</p>
                    <p className="truncate text-xs text-secondary">@{u.username}</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${u.isVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {u.isVerified ? 'Verified' : 'Unverified'}
                  </span>
                  <p className="mt-0.5 text-xs text-secondary">{new Date(u.createdAt).toLocaleDateString()}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Recent activity */}
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="mb-4 font-bold text-text">Recent activity</h2>
        {stats.recentActivity.length === 0 ? (
          <p className="text-sm text-secondary">No recent activity.</p>
        ) : (
          <ul className="divide-y divide-border">
            {stats.recentActivity.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="flex items-center gap-2 text-text">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                    <Activity className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-secondary">{a.actorType}</span> · {a.action}
                  {a.targetType ? <span className="text-secondary"> ({a.targetType})</span> : null}
                </span>
                <span className="text-xs text-secondary">{new Date(a.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between rounded-lg bg-surface-alt px-3 py-2">
      <dt className="text-secondary">{label}</dt>
      <dd className="font-bold text-text">{value.toLocaleString()}</dd>
    </div>
  );
}
