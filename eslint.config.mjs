import baseConfig from '@influencer/config/eslint';

/** Root flat ESLint config — shared across all workspaces. */
export default [
  ...baseConfig,
  {
    ignores: ['**/dist/**', '**/.next/**', '**/coverage/**', '**/node_modules/**', '**/*.config.*'],
  },
];
