/**
 * Reward points are switched off for now: no balances, "+N pts" labels, Rewards, Points history,
 * PayPal payout or Games (the games only award points). Points are still earned and recorded by the API.
 * Set NEXT_PUBLIC_FEATURE_POINTS=true (build-time) to bring all of it back; next.config.mjs reads the
 * same variable to redirect the hidden routes.
 */
export const POINTS_ENABLED = process.env.NEXT_PUBLIC_FEATURE_POINTS === 'true';
