'use client';

import { useEffect, useState } from 'react';

import { accountApi } from '@/lib/api/account';

/* ── Option lists (exact Toluna wording) ─────────────────────────────────── */
const EDUCATION = [
  'Lower Elementary School', 'Upper Elementary School', 'Secondary School', 'Technical Education',
  'Vocational Education', 'Graduated 3-year College', 'Graduated 4-year College', 'Master Degrees',
  'Postgraduate', 'Other',
];
const EMPLOYMENT = [
  'Business owner, craftsman', 'Farmer ( farm owner)', 'Freelancers', 'Housewife / Homemaker',
  'Intellectual profession (Philosophy, law…), or self-employed professionals (Accountant, Doctor…)',
  'Lower management (executives or administrative)', 'Non-managerial general employees',
  'Public sector companies (Office Based Public Worker Professionals – Government Agencies/Council Workers)',
  'Public service (school teacher, army, fireman, police)', 'Retired',
  'Semi-skilled or unskilled manual worker', 'Skilled manual worker', 'Student', 'Unemployed',
  'Upper & middle management (executives or administrative)',
];
const SHOPPING = ['Yes', 'Share responsibility', 'No'];
const YEARLY_INCOME = [
  'Less than 30,000 ₹', '30,000 – 49,999 ₹', '50,000 – 99,999 ₹', '100,000 – 199,999 ₹',
  '200,000 – 299,999 ₹', '300,000 – 499,999 ₹', '500,000 – 799,999 ₹', '800,000 – 1,199,999 ₹',
  '1,200,000 – 1,599,999 ₹', '1,600,000 – 1,999,999 ₹', '2,000,000 – 2,999,999 ₹',
  'Over 3,000,000 ₹', "Don't know / prefer not to answer",
];
const MONTHLY_INCOME = [
  'Less than ₹25,000', '₹25,000 – ₹49,999', '₹50,000 – ₹74,999', '₹75,000 – ₹99,999',
  '₹100,000 – ₹149,999', '₹150,000 – ₹199,999', '₹200,000 – ₹249,999', '₹250,000 – ₹299,999',
  '₹300,000 – ₹399,999', '₹400,000 – ₹499,999', '₹500,000 – ₹599,999', '₹600,000 – ₹699,999',
  '₹700,000 – ₹799,999', '₹800,000 – ₹899,999', '₹900,000 – ₹999,999', '₹1,000,000 or more',
];
const CWE_EDUCATION = [
  'Illiterate', 'Literate but no formal schooling / School- up to 4 years', 'School - 5 to 9 years',
  'SSC / HSC', 'Some College (incl. a Diploma) but not Graduate', 'Graduate / Post Graduate - General',
  'Graduate / Post Graduate - Professional',
];
const CWE_OCCUPATION = [
  'Unskilled worker', 'Skilled worker', 'Petty trader', 'Shop owner',
  'Businessperson / Industrialist with no employees', 'Businessperson / Industrialist with 1-9 employees',
  'Businessperson / Industrialists with 10+ employees', 'Self-employed professional',
  'Clerical / Salesperson', 'Supervisory level', 'Officer / Executive - Junior',
  'Officer / Executive - Middle / Senior',
];
const ITEMS = [
  'Agricultural land (that is currently under cultivation or plantation)', 'Air conditioner',
  'Car / Jeep / Van', 'Ceiling fan', 'Color TV', 'Microwave oven', 'Personal computer / Laptop',
  'Refrigerator', 'Two wheeler (Motorcycle, Scooter, Scooterette, Moped)', 'Washing machine',
  'None of the above',
];
const AREA = ['Urban', 'Rural'];
const MEN_EDUCATION = [
  'No male adult', 'No formal education', 'Up to class 5th Standard', 'Class 6-9th Standard',
  'Class 10-14th Standard', 'Regular degree (e.g. B.A., B.Sc., B.Com., M.A., M.Sc., M.Com., BBA, BCA)',
  'Professional degree (e.g. Engineering, Medicine, Law)', 'Other',
];
const WOMEN_EDUCATION = ['No female adult', ...MEN_EDUCATION.slice(1)];
const HOUSEHOLD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10 +'];
const CHILDREN = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10 +'];

type Answers = {
  address: string; city: string; pinCode: string; area: string;
  education: string; employment: string; shopping: string; householdSize: string;
  children: string; yearlyIncome: string; monthlyIncome: string; cweEducation: string;
  cweOccupation: string; itemsOwned: string[]; menEducation: string; womenEducation: string;
};

const EMPTY: Answers = {
  address: '', city: '', pinCode: '', area: '', education: '', employment: '', shopping: '',
  householdSize: '', children: '', yearlyIncome: '', monthlyIncome: '', cweEducation: '',
  cweOccupation: '', itemsOwned: [], menEducation: '', womenEducation: '',
};

export default function AboutYouTab(): React.JSX.Element {
  const [a, setA] = useState<Answers>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    accountApi
      .getAboutYou()
      .then((d) => {
        const ex = (d.demographics.assets ?? {}) as Partial<Answers>;
        setA({
          address: d.address.line1 ?? '',
          city: d.address.city ?? '',
          pinCode: d.address.pinCode ?? '',
          area: d.address.areaType === 'URBAN' ? 'Urban' : d.address.areaType === 'RURAL' ? 'Rural' : '',
          education: d.demographics.educationLevel ?? '',
          employment: d.demographics.employmentType ?? '',
          yearlyIncome: d.demographics.incomeBracket ?? '',
          householdSize: ex.householdSize ?? '',
          children: ex.children ?? '',
          shopping: ex.shopping ?? '',
          monthlyIncome: ex.monthlyIncome ?? '',
          cweEducation: ex.cweEducation ?? '',
          cweOccupation: ex.cweOccupation ?? '',
          itemsOwned: ex.itemsOwned ?? [],
          menEducation: ex.menEducation ?? '',
          womenEducation: ex.womenEducation ?? '',
        });
      })
      .catch(() => void 0);
  }, []);

  function set<K extends keyof Answers>(k: K, v: Answers[K]): void {
    setA((prev) => ({ ...prev, [k]: v }));
    setSaved(false);
  }

  function toggleItem(item: string): void {
    setA((prev) => {
      const has = prev.itemsOwned.includes(item);
      const next = item === 'None of the above'
        ? has ? [] : ['None of the above']
        : has
          ? prev.itemsOwned.filter((i) => i !== item)
          : [...prev.itemsOwned.filter((i) => i !== 'None of the above'), item];
      return { ...prev, itemsOwned: next };
    });
    setSaved(false);
  }

  async function save(): Promise<void> {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await accountApi.updateAboutYou({
        address: {
          line1: a.address || undefined,
          city: a.city || undefined,
          pinCode: a.pinCode || undefined,
          areaType: a.area === 'Urban' ? 'URBAN' : a.area === 'Rural' ? 'RURAL' : undefined,
        },
        demographics: {
          educationLevel: a.education || undefined,
          employmentType: a.employment || undefined,
          incomeBracket: a.yearlyIncome || undefined,
          householdSize: a.householdSize ? parseInt(a.householdSize, 10) : undefined,
          childrenCount: a.children !== '' ? parseInt(a.children, 10) : undefined,
          assets: {
            householdSize: a.householdSize,
            children: a.children,
            shopping: a.shopping,
            monthlyIncome: a.monthlyIncome,
            cweEducation: a.cweEducation,
            cweOccupation: a.cweOccupation,
            itemsOwned: a.itemsOwned,
            menEducation: a.menEducation,
            womenEducation: a.womenEducation,
          },
        },
      });
      setSaved(true);
    } catch {
      setError('Could not save your answers. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 p-5">
        <h2 className="text-xl font-black text-blue-700">About You</h2>
        <p className="mt-1 text-sm text-blue-600/80">
          Everyone is unique, and so are you! Complete this brief survey about yourself. Your
          responses help us find surveys relevant to your interests and increase your chances of
          qualifying.
        </p>
      </div>

      <div className="space-y-4">
        <Question title="Address:">
          <textarea rows={2} className={INPUT} placeholder="Write your address" value={a.address} onChange={(e) => set('address', e.target.value)} />
        </Question>
        <Question title="City:">
          <input className={INPUT} value={a.city} onChange={(e) => set('city', e.target.value)} />
        </Question>
        <Question title="PIN code (Postal Index Number):">
          <input className={INPUT} value={a.pinCode} onChange={(e) => set('pinCode', e.target.value)} />
        </Question>
        <Question title="Education level:"><Select value={a.education} onChange={(v) => set('education', v)} options={EDUCATION} /></Question>
        <Question title="Employment:"><Select value={a.employment} onChange={(v) => set('employment', v)} options={EMPLOYMENT} /></Question>
        <Question title="Are you responsible for the shopping in your household?:"><Select value={a.shopping} onChange={(v) => set('shopping', v)} options={SHOPPING} /></Question>
        <Question title="Number of people in your household including you:"><Select value={a.householdSize} onChange={(v) => set('householdSize', v)} options={HOUSEHOLD} /></Question>
        <Question title="Number of children under 18 in your household:"><Select value={a.children} onChange={(v) => set('children', v)} options={CHILDREN} /></Question>
        <Question title="Household Yearly Income (Gross):"><Select value={a.yearlyIncome} onChange={(v) => set('yearlyIncome', v)} options={YEARLY_INCOME} /></Question>
        <Question title="What is your monthly household income?"><Select value={a.monthlyIncome} onChange={(v) => set('monthlyIncome', v)} options={MONTHLY_INCOME} /></Question>
        <Question title="Please select the maximum level of education of the chief wage earner in your household (the person who contributes the most towards household expenses):"><Select value={a.cweEducation} onChange={(v) => set('cweEducation', v)} options={CWE_EDUCATION} /></Question>
        <Question title="Please select the occupation of the chief wage earner of your household:"><Select value={a.cweOccupation} onChange={(v) => set('cweOccupation', v)} options={CWE_OCCUPATION} /></Question>
        <Question title="Please select from the below list all the items you or your family own (It could be owned by you, your family, or provided by the employer or it could be available in the house you live in; but it should be for the use of just you or your family):">
          <div className="grid gap-2 sm:grid-cols-2">
            {ITEMS.map((item) => (
              <label key={item} className="flex items-start gap-2 rounded-lg border border-gray-100 p-2 text-sm text-gray-700 hover:bg-gray-50">
                <input type="checkbox" checked={a.itemsOwned.includes(item)} onChange={() => toggleItem(item)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-400" />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </Question>
        <Question title="Please select the type of area you are living in:"><Select value={a.area} onChange={(v) => set('area', v)} options={AREA} /></Question>
        <Question title="Among the men above 18 years of age in your household, what is the highest level of education that anyone has achieved?"><Select value={a.menEducation} onChange={(v) => set('menEducation', v)} options={MEN_EDUCATION} /></Question>
        <Question title="Among the women above 18 years of age in your household, what is the highest level of education that anyone has achieved?"><Select value={a.womenEducation} onChange={(v) => set('womenEducation', v)} options={WOMEN_EDUCATION} /></Question>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {saved && <p className="mt-4 text-sm text-green-600">✓ Your answers have been saved.</p>}

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-full bg-blue-700 px-10 py-3 text-sm font-bold text-white shadow-md transition hover:bg-blue-800 active:scale-95 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'SAVE'}
        </button>
      </div>
    </div>
  );
}

const INPUT =
  'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300';

function Question({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="mb-3 text-sm font-medium leading-relaxed text-blue-600">{title}</p>
      {children}
    </div>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }): React.JSX.Element {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={INPUT}>
      <option value="">please select an answer …</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}
