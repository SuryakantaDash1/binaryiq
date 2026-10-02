/** Deterministic gradient tile for cards with no image — varies per item, not per
 *  category, so a grid with no thumbnails doesn't render a wall of identical cards. */
export const GRADIENTS = [
  'from-indigo-900 via-purple-800 to-indigo-900',
  'from-slate-900 via-indigo-800 to-slate-900',
  'from-emerald-800 via-teal-800 to-teal-900',
  'from-teal-600 via-cyan-600 to-teal-700',
  'from-sky-600 via-blue-600 to-indigo-700',
  'from-rose-700 via-red-700 to-rose-800',
  'from-fuchsia-800 via-purple-700 to-indigo-900',
  'from-amber-700 via-orange-700 to-rose-800',
];

export function gradientFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length] as string;
}
