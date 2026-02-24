type SupabaseEnvStatus = {
  configured: boolean;
  issues: string[];
  url: string;
  key: string;
};

function readFlag(raw: string | undefined, fallback: boolean): boolean {
  if (typeof raw !== 'string') return fallback;
  return raw.toLowerCase() === 'true';
}

function isLikelyPlaceholder(value: string): boolean {
  if (!value) return true;
  const normalized = value.toLowerCase();
  return (
    normalized.includes('your_project_ref') ||
    normalized.includes('your_supabase_anon_key') ||
    normalized.includes('your_supabase_publishable_key') ||
    normalized.includes('your_')
  );
}

export function getSupabaseEnvStatus(): SupabaseEnvStatus {
  const url = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();
  const issues: string[] = [];

  if (!url) issues.push('Missing VITE_SUPABASE_URL');
  if (!key) issues.push('Missing VITE_SUPABASE_PUBLISHABLE_KEY');
  if (url && isLikelyPlaceholder(url)) issues.push('VITE_SUPABASE_URL uses placeholder value');
  if (key && isLikelyPlaceholder(key)) issues.push('VITE_SUPABASE_PUBLISHABLE_KEY uses placeholder value');

  if (url && !isLikelyPlaceholder(url)) {
    try {
      // Validate URL format early to avoid confusing runtime fetch failures.
      new URL(url);
    } catch {
      issues.push('VITE_SUPABASE_URL is not a valid URL');
    }
  }

  return {
    configured: issues.length === 0,
    issues,
    url,
    key,
  };
}

export function isLocalDevFallbackEnabled(): boolean {
  return readFlag(import.meta.env.VITE_ENABLE_LOCAL_DEV_FALLBACK, false);
}

export function shouldUseLocalDevFallback(): boolean {
  const env = getSupabaseEnvStatus();
  return !env.configured && isLocalDevFallbackEnabled();
}
