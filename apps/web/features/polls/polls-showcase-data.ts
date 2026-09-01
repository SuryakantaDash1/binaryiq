/**
 * Static demo data for the Sponsored Polls results showcase.
 * The backend results endpoint returns only per-option counts (no gender breakdown),
 * and the seed has no votes — so these Toluna-style infographics are mock demo data.
 */

export interface ShowcaseOption {
  label: string;
  votes: number;
  percent: number;
}

export interface ShowcasePoll {
  id: string;
  question: string;
  totalVotes: number;
  femalePct: number;
  femaleCount: number;
  malePct: number;
  maleCount: number;
  options: ShowcaseOption[];
}

export const SHOWCASE_POLLS: ShowcasePoll[] = [
  {
    id: 'alcoholic-rtd',
    question: 'Have you consumed any of the following in the last 3 months?',
    totalVotes: 3575,
    femalePct: 46,
    femaleCount: 1660,
    malePct: 54,
    maleCount: 1915,
    options: [
      { label: 'Alcoholic Ready to drink beverages like Bacardi Plus, Breezer, Buzz Ball, etc', votes: 1134, percent: 32 },
      { label: 'I have not consumed Alcoholic Ready to drink beverages, but I know what they are', votes: 1528, percent: 43 },
      { label: 'Neither am I aware nor have I consumed alcoholic ready to drink beverages', votes: 915, percent: 26 },
    ],
  },
  {
    id: 'condoms-last-purchase',
    question: 'When did you last purchase condoms?',
    totalVotes: 1670,
    femalePct: 48,
    femaleCount: 808,
    malePct: 52,
    maleCount: 862,
    options: [
      { label: 'In the last week', votes: 315, percent: 19 },
      { label: 'In the last 2 weeks', votes: 184, percent: 11 },
      { label: 'In the last 3 weeks', votes: 83, percent: 5 },
      { label: 'In the last 4 weeks', votes: 70, percent: 4 },
      { label: 'More than 4 weeks ago', votes: 207, percent: 12 },
      { label: 'I have never purchased condoms', votes: 811, percent: 49 },
    ],
  },
  {
    id: 'condoms-store-type',
    question:
      'Thinking about your purchase of condoms within the past 4 weeks. In which of the following type of stores did you buy this category? If you did not purchase condoms in the past 4 weeks, please select the option "did not purchase condoms".',
    totalVotes: 1666,
    femalePct: 48,
    femaleCount: 804,
    malePct: 52,
    maleCount: 862,
    options: [
      { label: 'Supermarkets', votes: 292, percent: 18 },
      { label: 'Hypermarkets', votes: 170, percent: 10 },
      { label: 'E-commerce/ online stores (e.g., Amazon, Flipkart)', votes: 342, percent: 21 },
      { label: 'Quick commerce (e.g., Blinkit, Zepto, Swiggy Instamart, etc.)', votes: 319, percent: 19 },
      { label: 'Discount stores/ value retailers', votes: 118, percent: 7 },
      { label: 'Pharmacy / Chemist', votes: 443, percent: 27 },
      { label: 'Personal care / health & wellness stores', votes: 167, percent: 10 },
      { label: 'Kirana stores / local neighborhood stores', votes: 109, percent: 7 },
      { label: 'Other type of stores', votes: 49, percent: 3 },
      { label: 'I did not purchase condoms in the past 4 weeks', votes: 714, percent: 43 },
    ],
  },
  {
    id: 'pet-ownership',
    question: 'Which of the following best describes your current pet ownership status?',
    totalVotes: 2593,
    femalePct: 46,
    femaleCount: 1197,
    malePct: 54,
    maleCount: 1396,
    options: [
      { label: 'I currently have a pet', votes: 1207, percent: 47 },
      { label: 'I am considering getting a pet', votes: 399, percent: 15 },
      { label: 'I do not have a pet and am not considering one', votes: 494, percent: 19 },
      { label: 'I do not have a pet, but would like one someday', votes: 493, percent: 19 },
    ],
  },
  {
    id: 'ipl-medium',
    question: 'Which is your preferred medium to watch IPL?',
    totalVotes: 3989,
    femalePct: 46,
    femaleCount: 1823,
    malePct: 54,
    maleCount: 2166,
    options: [
      { label: 'On TV (e.g. Star Sports 1/2/3 etc.)', votes: 2050, percent: 51 },
      { label: 'On mobile via JioHotstar App', votes: 1932, percent: 48 },
      { label: 'Streaming JioHotstar on a Smart TV or Connected TV (e.g. via Amazon firestick or google home etc.)', votes: 1295, percent: 32 },
      { label: "I don't watch IPL", votes: 342, percent: 9 },
    ],
  },
  {
    id: 'kids-11-17',
    question: 'Do you have any kids of your own between the age of 11 - 17 years?',
    totalVotes: 3956,
    femalePct: 46,
    femaleCount: 1812,
    malePct: 54,
    maleCount: 2144,
    options: [
      { label: 'Yes', votes: 1571, percent: 40 },
      { label: 'No', votes: 2386, percent: 60 },
    ],
  },
  {
    id: 'data-plan',
    question: 'Which of the following data plans do you use for your cellphone?',
    totalVotes: 3946,
    femalePct: 46,
    femaleCount: 1811,
    malePct: 54,
    maleCount: 2135,
    options: [
      { label: '1.5gb per day data plan', votes: 1305, percent: 33 },
      { label: '2gb - 2.5gb per day data plan', votes: 1748, percent: 44 },
      { label: '3gb or more per day data plan', votes: 656, percent: 17 },
      { label: "I don't have a data plan for my cellphone connection", votes: 127, percent: 3 },
      { label: "Don't know / Can't say", votes: 110, percent: 3 },
    ],
  },
  {
    id: 'mobile-connection',
    question: 'What type of a mobile connection do you have?',
    totalVotes: 3924,
    femalePct: 46,
    femaleCount: 1801,
    malePct: 54,
    maleCount: 2123,
    options: [
      { label: 'Prepaid connection', votes: 3212, percent: 82 },
      { label: 'Postpaid connection', votes: 790, percent: 20 },
      { label: "I don't have a mobile connection", votes: 118, percent: 3 },
    ],
  },
  {
    id: 'residence-type',
    question: 'In which kind of residence/house do you live in?',
    totalVotes: 4274,
    femalePct: 45,
    femaleCount: 1902,
    malePct: 55,
    maleCount: 2372,
    options: [
      { label: 'Independent House', votes: 3258, percent: 76 },
      { label: 'Gated society/apartments', votes: 1018, percent: 24 },
    ],
  },
  {
    id: 'brand-term',
    question: 'Which term do you think better represents brands that are rooted in tradition and culture?',
    totalVotes: 3814,
    femalePct: 45,
    femaleCount: 1731,
    malePct: 55,
    maleCount: 2083,
    options: [
      { label: 'Legacy Brand', votes: 2080, percent: 55 },
      { label: 'Heritage Brand', votes: 1734, percent: 45 },
    ],
  },
];
