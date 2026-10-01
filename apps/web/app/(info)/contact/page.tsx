'use client';

import { useEffect, useState } from 'react';

const ISSUE_TYPES = [
  { value: 'LOGIN', label: 'Login issues' },
  { value: 'SURVEY', label: 'Survey issues' },
  { value: 'SURVEY_PAYMENT', label: 'Survey payment' },
  { value: 'REWARDS', label: 'Rewards delivery' },
  { value: 'UNSUBSCRIBE', label: 'Unsubscribe / account' },
  { value: 'OTHER', label: 'Other' },
];

export default function ContactPage(): React.JSX.Element {
  const [issueType, setIssueType] = useState('LOGIN');
  const [submitted, setSubmitted] = useState(false);

  // Preselect the issue type when Luna escalates here (e.g. /contact?issue=LOGIN)
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('issue');
    if (param && ISSUE_TYPES.some((i) => i.value === param)) setIssueType(param);
  }, []);

  if (submitted) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-100">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-3xl">
          ✅
        </div>
        <h1 className="text-2xl font-black text-gray-900">Thank you!</h1>
        <p className="mt-2 text-sm text-gray-600">
          Your request has been received. Our Customer Support Team will respond to your email
          shortly.
        </p>
        <a href="/" className="mt-6 inline-block rounded-full bg-brand-800 px-8 py-3 text-sm font-semibold text-white transition hover:bg-brand-900">
          Back to home
        </a>
      </div>
    );
  }

  return (
    <div>
      <p className="mx-auto max-w-2xl text-center text-lg font-medium text-blue-500">
        Have a question? Need support? We are here to help. Please send our Customer Support Team a
        message using this form. We will respond to your email shortly.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(true);
        }}
        className="mt-8 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-100"
      >
        <h2 className="text-2xl font-bold text-gray-900">New Issue</h2>

        <div className="mt-6 space-y-5">
          <Field label="Type of Issue">
            <select
              value={issueType}
              onChange={(e) => setIssueType(e.target.value)}
              className="h-12 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-300"
            >
              {ISSUE_TYPES.map((i) => (
                <option key={i.value} value={i.value}>
                  {i.label}
                </option>
              ))}
            </select>
          </Field>

          <input
            type="text"
            required
            placeholder="Name"
            className="h-12 w-full rounded-lg border border-gray-300 px-4 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-300"
          />
          <input
            type="email"
            required
            placeholder="Email"
            className="h-12 w-full rounded-lg border border-gray-300 px-4 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-300"
          />
        </div>

        <h2 className="mt-8 text-2xl font-bold text-gray-900">Issue Details</h2>
        <div className="mt-6 space-y-5">
          <Field label="Summary">
            <input
              type="text"
              required
              className="h-12 w-full rounded-lg border border-gray-300 px-4 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-300"
            />
          </Field>
          <textarea
            rows={5}
            required
            placeholder="Problem description"
            className="w-full resize-y rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-300"
          />
          <div>
            <p className="mb-2 text-lg font-semibold text-blue-500">Attached files</p>
            <input type="file" className="text-sm text-gray-600 file:mr-3 file:rounded-full file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-600 hover:file:bg-blue-100" />
          </div>
        </div>

        <button
          type="submit"
          className="mt-8 rounded-full bg-brand-800 px-10 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-brand-900 active:scale-95"
        >
          Send
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-blue-500">{label}</label>
      {children}
    </div>
  );
}
