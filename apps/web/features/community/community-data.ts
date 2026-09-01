/**
 * Static mock content for the Community page (News + Forum).
 * No backend exists for news/forum/contests, so this stands in for a future CMS.
 * Brand-safe: no "Toluna" text — everything is "Influencers"/"our".
 */

export interface NewsItem {
  id: string;
  emoji: string;
  title: string;
  date: string;
  excerpt: string;
  comments: number;
  /** Tailwind gradient classes for the card banner. */
  grad: string;
  /** Big banner headline (kept short). */
  banner: string;
}

export const NEWS: NewsItem[] = [
  {
    id: 'wc-campaign',
    emoji: '🏆',
    title: 'Our World Cup Campaign Has Come to an End!',
    date: '24 Jul',
    excerpt:
      "What an incredible World Cup it's been! Over the past several weeks, members from around the world joined us to celebrate, compete and win big.",
    comments: 19,
    grad: 'from-indigo-900 via-purple-800 to-indigo-900',
    banner: 'WORLD CUP · CAMPAIGN COMPLETE',
  },
  {
    id: 'wc-predictions',
    emoji: '🏆',
    title: 'The Final Stage Is Now Live — One Last Chance to Become Champion!',
    date: '13 Jul',
    excerpt:
      "Stage 1 and 2 of our World Cup Predictions game have officially ended — and after some incredible matches, we're excited to launch the final stage.",
    comments: 13,
    grad: 'from-slate-900 via-indigo-800 to-slate-900',
    banner: 'WORLD CUP · PREDICTIONS',
  },
  {
    id: 'wc-penalty',
    emoji: '⚽',
    title: 'The World Cup Penalty Game is Officially Live! Edit Entry',
    date: '12 Jun',
    excerpt:
      'The wait is over — all our World Cup games are now fully live! 🌍 🏆 From predictions to penalty shootouts and fan competitions, there are now more ways to win.',
    comments: 38,
    grad: 'from-emerald-800 via-teal-800 to-teal-900',
    banner: 'WORLD CUP · PENALTY SHOT!',
  },
  {
    id: 'eggmatch-open',
    emoji: '🥚',
    title: 'World Cup Predictions Are Now Open!',
    date: '09 Jun',
    excerpt:
      'The World Cup is almost here… and you can already start making your predictions! ⚽ 🏆 Our Predictions game is officially open before kick-off.',
    comments: 20,
    grad: 'from-teal-600 via-cyan-600 to-teal-700',
    banner: 'MAKE YOUR PREDICTIONS',
  },
  {
    id: 'eggmatch-winners',
    emoji: '🎉',
    title: 'Meet Our EggMatch Winners!',
    date: '21 Apr',
    excerpt:
      "Our EggMatch challenge has come to an end, and we've loved seeing your memory skills in action. A huge thank you to everyone who joined and played.",
    comments: 58,
    grad: 'from-sky-500 via-cyan-500 to-teal-500',
    banner: 'EGG MATCH · WINNERS',
  },
  {
    id: 'eggmatch-play',
    emoji: '🧠',
    title: 'Test your memory with Egg Match!',
    date: '07 Apr',
    excerpt:
      'Discover our latest game, Egg Match, where fun meets rewards! Ready to put your skills to the test? Visit the Games page to play and win points.',
    comments: 25,
    grad: 'from-cyan-500 via-teal-500 to-emerald-500',
    banner: 'EGG MATCH · 2–16 APRIL',
  },
  {
    id: 'lucky-draw',
    emoji: '🎁',
    title: 'Win points in our festive lucky draw',
    date: '17 Dec',
    excerpt:
      'Dear Members, celebrate the end of the year with a boost to your points balance! To enter the draw, all you have to do is complete two or more surveys.',
    comments: 179,
    grad: 'from-rose-700 via-red-700 to-rose-800',
    banner: 'WIN 15,000 POINTS',
  },
  {
    id: 'ski-camp',
    emoji: '⛷️',
    title: 'Welcome to the Ski Camp!',
    date: '15 Dec',
    excerpt:
      "From 15 to 29 December, we're inviting you to play our brand-new ski-themed game with 3 fun levels, and win instant bonuses of up to 3,000 points.",
    comments: 20,
    grad: 'from-sky-600 via-blue-600 to-indigo-700',
    banner: 'SKI CAMP · 15–29 DEC',
  },
  {
    id: 'haunted-house',
    emoji: '👻',
    title: 'Enter the Haunted House, we dare you!',
    date: '21 Oct',
    excerpt:
      "It's time to face the Haunted House! 🎃 Our spooky new game is now live. Face all the ghosts and monsters to win up to 10,000 points.",
    comments: 46,
    grad: 'from-slate-800 via-teal-900 to-slate-900',
    banner: 'HAUNTED HOUSE',
  },
];

export interface ForumCategory {
  id: string;
  title: string;
  description: string;
  categories: number;
  threads: number;
}

export const FORUM_CATEGORIES: ForumCategory[] = [
  {
    id: 'interest-groups',
    title: 'Interest groups',
    description:
      'Join the groups you are most interested in to share great ideas and engage with likeminded people.',
    categories: 6,
    threads: 1,
  },
];
