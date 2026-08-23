'use client';

import type { CategorySchema, CategoryQuestion } from '@influencer/types';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { profileSurveysApi } from '@/lib/api/profile-surveys';
import { ApiError } from '@/lib/api/client';

interface TolunaSurveyProps {
  categoryKey: string;
  name: string;
  schema: CategorySchema;
  defaults?: Record<string, unknown>;
  onCancel: () => void;
  onSaved: (pointsAwarded: number) => void;
}

type Answers = Record<string, unknown>;

export function TolunaSurvey({
  categoryKey,
  name,
  schema,
  defaults,
  onCancel,
  onSaved,
}: TolunaSurveyProps): React.JSX.Element {
  const [answers, setAnswers] = useState<Answers>(defaults ?? {});
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [rootError, setRootError] = useState<string | null>(null);

  function setAnswer(key: string, value: unknown): void {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: false } : prev));
  }

  function toggleMulti(q: CategoryQuestion, value: string, exclusive: boolean): void {
    const current = Array.isArray(answers[q.key]) ? (answers[q.key] as string[]) : [];
    const exclusiveValues = (q.options ?? []).filter((o) => o.exclusive).map((o) => o.value);
    if (exclusive) {
      // Clicking an exclusive option selects only it (or clears if re-clicked).
      setAnswer(q.key, current.includes(value) ? [] : [value]);
      return;
    }
    // Clicking a normal option removes any exclusive selection first.
    const base = current.filter((v) => !exclusiveValues.includes(v));
    const next = base.includes(value) ? base.filter((v) => v !== value) : [...base, value];
    setAnswer(q.key, next);
  }

  function validate(): boolean {
    const next: Record<string, boolean> = {};
    for (const q of schema.questions) {
      if (!q.required) continue;
      const v = answers[q.key];
      const empty =
        v === undefined ||
        v === null ||
        v === '' ||
        (Array.isArray(v) && v.length === 0);
      if (empty) next[q.key] = true;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave(): Promise<void> {
    setRootError(null);
    if (!validate()) {
      setRootError('Please answer all questions before saving.');
      // Scroll to first error
      const firstKey = schema.questions.find((q) => q.required && isEmpty(answers[q.key]))?.key;
      if (firstKey) document.getElementById(`q-${firstKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSaving(true);
    try {
      const res = await profileSurveysApi.submit(categoryKey, answers);
      onSaved(res.pointsAwarded);
    } catch (err) {
      // Already completed → treat as a successful (idempotent) save.
      if (err instanceof ApiError && /already_completed/i.test(err.message)) {
        onSaved(0);
        return;
      }
      setRootError(err instanceof ApiError ? err.message : 'Could not save. Please try again.');
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Category header with gradient underline */}
      <h2 className="text-center text-2xl font-semibold text-indigo-800 md:text-3xl">{name}</h2>
      <div className="mx-auto mt-3 h-[3px] w-full max-w-3xl rounded-full bg-gradient-to-r from-indigo-700 via-purple-500 to-pink-500" />

      <div className="mx-auto mt-6 flex max-w-3xl flex-col gap-4">
        {schema.intro && (
          <div className="rounded-xl bg-gray-50 p-5 text-[15px] leading-relaxed text-indigo-700">
            {schema.intro}
          </div>
        )}

        {rootError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {rootError}
          </div>
        )}

        {schema.questions.map((q) => (
          <QuestionCard
            key={q.key}
            q={q}
            value={answers[q.key]}
            invalid={!!errors[q.key]}
            onSelect={(v) => setAnswer(q.key, v)}
            onToggleMulti={(v, ex) => toggleMulti(q, v, ex)}
          />
        ))}
      </div>

      {/* Sticky footer bar */}
      <div className="sticky bottom-0 z-10 -mx-5 mt-8 flex items-center justify-between gap-4 border-t border-gray-100 bg-white px-5 py-4 md:-mx-8 md:px-8">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 text-white">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </span>
          <span className="text-lg font-bold text-gray-900">Influencers</span>
        </div>
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="text-sm font-medium text-gray-600 transition hover:text-gray-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-full bg-indigo-900 px-10 py-3 text-sm font-bold tracking-wide text-white transition hover:bg-indigo-800 disabled:opacity-60"
          >
            {saving ? 'SAVING…' : 'SAVE'}
          </button>
        </div>
      </div>
    </div>
  );
}

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
}

interface QuestionCardProps {
  q: CategoryQuestion;
  value: unknown;
  invalid: boolean;
  onSelect: (value: unknown) => void;
  onToggleMulti: (value: string, exclusive: boolean) => void;
}

function QuestionCard({ q, value, invalid, onSelect, onToggleMulti }: QuestionCardProps): React.JSX.Element {
  return (
    <div
      id={`q-${q.key}`}
      className={`rounded-xl bg-white p-5 shadow-sm ring-1 transition ${
        invalid ? 'ring-red-300' : 'ring-gray-100'
      }`}
    >
      <p className="mb-4 text-[17px] font-medium text-indigo-700">{q.label}</p>

      {q.type === 'select' && (
        <div className="relative max-w-md">
          <select
            value={(value as string) ?? ''}
            onChange={(e) => onSelect(e.target.value)}
            className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-4 py-3 pr-10 text-[15px] text-gray-700 outline-none focus:border-indigo-500"
          >
            <option value="" disabled>
              {q.placeholder ?? 'please select an answer …'}
            </option>
            {(q.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-indigo-500" />
        </div>
      )}

      {q.type === 'radio' && (
        <div className="flex flex-col">
          {(q.options ?? []).map((o) => {
            const selected = value === o.value;
            return (
              <label
                key={o.value}
                className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-3 transition hover:bg-gray-50 ${
                  selected ? 'bg-gray-50' : ''
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    selected ? 'border-indigo-600' : 'border-gray-300'
                  }`}
                >
                  {selected && <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />}
                </span>
                <input
                  type="radio"
                  className="sr-only"
                  checked={selected}
                  onChange={() => onSelect(o.value)}
                />
                <span className="text-[15px] text-gray-700">{o.label}</span>
              </label>
            );
          })}
        </div>
      )}

      {q.type === 'multiselect' && (
        <div className="flex flex-col">
          {(q.options ?? []).map((o) => {
            const arr = Array.isArray(value) ? (value as string[]) : [];
            const selected = arr.includes(o.value);
            const exclusive = !!o.exclusive;
            return (
              <label
                key={o.value}
                className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-3 transition hover:bg-gray-50 ${
                  selected ? 'bg-gray-50' : ''
                }`}
              >
                {exclusive ? (
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                      selected ? 'border-indigo-600' : 'border-gray-300'
                    }`}
                  >
                    {selected && <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />}
                  </span>
                ) : (
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${
                      selected ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'
                    }`}
                  >
                    {selected && (
                      <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5 text-white">
                        <path d="M5 10l3 3 7-7" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                )}
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={selected}
                  onChange={() => onToggleMulti(o.value, exclusive)}
                />
                <span className="text-[15px] text-gray-700">{o.label}</span>
              </label>
            );
          })}
        </div>
      )}

      {(q.type === 'text' || q.type === 'number' || q.type === 'date') && (
        <input
          type={q.type === 'number' ? 'number' : q.type === 'date' ? 'date' : 'text'}
          value={(value as string) ?? ''}
          min={q.min}
          max={q.max}
          onChange={(e) => onSelect(q.type === 'number' ? e.target.value : e.target.value)}
          className="w-full max-w-md rounded-lg border border-gray-300 bg-white px-4 py-3 text-[15px] text-gray-700 outline-none focus:border-indigo-500"
        />
      )}
    </div>
  );
}
