export const FEATURE_FLAGS = {
  casesMenu: (import.meta.env.VITE_ENABLE_CASES ?? 'false').toLowerCase() === 'true',
} as const;
