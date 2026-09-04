'use client';

import type { AdminStats } from '@influencer/types';
import { StatCard } from '@influencer/ui';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { adminApi } from '@/lib/api/admin';

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
          <div key={i} className="h-24 animate-pulse rounded-xl bg-surface-alt" />
        ))}
      </div>
    );
  }

  const { users, points, engagement } = stats;
  const verifiedPct = users.total ? Math.round((users.verified / users.total) * 100) : 0;
  const maxDay = Math.max(1, ...stats.signupsByDay.map((d) => d.count));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-text">Dashboard</h1>
        <p className="text-sm text-secondary">Platform overview</p>
      </div>

      {/* Primary stat tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total users" value={users.total.toLocaleString()} sub={`${users.new30d} in last 30 days`} />
        <StatCard label="Active users (30d)" value={users.active30d.toLocaleString()} sub={`${users.active7d} in last 7 days`} />
        <StatCard label="Verified users" value={users.verified.toLocaleString()} sub={`${verifiedPct}% of all users`} />
        <StatCard label="New today" value={users.newToday.toLocaleString()} sub={`${users.new7d} this week`} />
        <StatCard label="Blocked users" value={users.blocked.toLocaleString()} />
        <StatCard label="Points issued" value={points.issued.toLocaleString()} sub={`${points.outstanding.toLocaleString()} outstanding`} />
        <StatCard label="Pending redemptions" value={engagement.redemptionsPending.toLocaleString()} sub={`${engagement.redemptionsTotal} total`} />
        <StatCard label="Open tickets" value={engagement.openTickets.toLocaleString()} />
      </div>

      {/* Signups chart */}
      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-4 font-semibold text-text">New signups — last 30 days</h2>
        <div className="flex h-40 items-end gap-1">
          {stats.signupsByDay.map((d) => (
            <div key={d.date} className="group flex flex-1 flex-col items-center justify-end" title={`${d.date}: ${d.count}`}>
              <div
                className="w-full rounded-t bg-primary/80 transition group-hover:bg-primary"
                style={{ height: `${(d.count / maxDay) * 100}%`, minHeight: d.count ? '3px' : '0' }}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-secondary">
          <span>{stats.signupsByDay[0]?.date}</span>
          <span>{stats.signupsByDay[stats.signupsByDay.length - 1]?.date}</span>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Engagement + demographics */}
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-4 font-semibold text-text">Engagement</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Row label="Survey responses" value={engagement.surveyResponses} />
            <Row label="Poll votes" value={engagement.pollVotes} />
            <Row label="Game plays" value={engagement.gamePlays} />
            <Row label="Profile surveys" value={engagement.profileSurveyResponses} />
            <Row label="Points spent" value={points.spent} />
            <Row label="Redemptions" value={engagement.redemptionsTotal} />
          </dl>
          <h3 className="mb-2 mt-5 text-sm font-semibold text-text">Gender split</h3>
          <div className="flex flex-wrap gap-2">
            {stats.genderSplit.map((g) => (
              <span key={g.gender} className="rounded-full bg-surface-alt px-3 py-1 text-xs text-text">
                {g.gender}: {g.count}
              </span>
            ))}
          </div>
          {stats.topCountries.length > 0 && (
            <>
              <h3 className="mb-2 mt-4 text-sm font-semibold text-text">Top countries</h3>
              <div className="flex flex-wrap gap-2">
                {stats.topCountries.map((c) => (
                  <span key={c.country} className="rounded-full bg-surface-alt px-3 py-1 text-xs text-text">
                    {c.country}: {c.count}
                  </span>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Recent signups */}
        <section className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-text">Recent signups</h2>
            <Link href="/admin/users" className="text-sm font-medium text-primary hover:underline">View all users →</Link>
          </div>
          <ul className="divide-y divide-border">
            {stats.recentSignups.map((u) => (
              <li key={u.id} className="flex items-center justify-between py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-text">{u.email}</p>
                  <p className="truncate text-xs text-secondary">@{u.username}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className={`text-xs font-medium ${u.isVerified ? 'text-green-600' : 'text-secondary'}`}>
                    {u.isVerified ? 'Verified' : 'Unverified'}
                  </span>
                  <p className="text-xs text-secondary">{new Date(u.createdAt).toLocaleDateString()}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Recent activity */}
      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-4 font-semibold text-text">Recent activity</h2>
        {stats.recentActivity.length === 0 ? (
          <p className="text-sm text-secondary">No recent activity.</p>
        ) : (
          <ul className="divide-y divide-border">
            {stats.recentActivity.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-text">
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
      <dd className="font-semibold text-text">{value.toLocaleString()}</dd>
    </div>
  );
}
