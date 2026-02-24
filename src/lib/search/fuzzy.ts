export type FuzzyStrictness = 'strict' | 'balanced' | 'loose';

export const STRICTNESS_CONFIG: Record<FuzzyStrictness, { minScore: number }> = {
  strict: { minScore: 0.86 },
  balanced: { minScore: 0.72 },
  loose: { minScore: 0.58 },
};

export function normalizeInvoiceSearchValue(value: string | undefined | null): string {
  if (!value) return '';
  return value.toLowerCase().replace(/[\s\-_/.\\]/g, '');
}

export function normalizeNameSearchValue(value: string | undefined | null): string {
  if (!value) return '';
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function normalizeTrnSearchValue(value: string | undefined | null): string {
  if (!value) return '';
  return value.replace(/\D/g, '');
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + 1);
    }
  }

  return dp[m][n];
}

export function similarityScore(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.9;
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;
  const distance = levenshteinDistance(longer, shorter);
  return Math.max(0, (longer.length - distance) / longer.length);
}

export interface FuzzyCandidate {
  id: string;
  vendorName?: string;
  invoiceNumber?: string;
  trn?: string;
  reference?: string;
}

export interface RankedFuzzyResult<T extends FuzzyCandidate> {
  item: T;
  score: number;
}

export function rankFuzzyCandidates<T extends FuzzyCandidate>(
  query: string,
  candidates: T[],
  strictness: FuzzyStrictness
): RankedFuzzyResult<T>[] {
  const qName = normalizeNameSearchValue(query);
  const qDoc = normalizeInvoiceSearchValue(query);
  const qTrn = normalizeTrnSearchValue(query);
  const minScore = STRICTNESS_CONFIG[strictness].minScore;

  if (!query.trim()) {
    return candidates.map((item) => ({ item, score: 1 }));
  }

  return candidates
    .map((item) => {
      const scores = [
        similarityScore(qName, normalizeNameSearchValue(item.vendorName)),
        similarityScore(qDoc, normalizeInvoiceSearchValue(item.invoiceNumber)),
        similarityScore(qTrn, normalizeTrnSearchValue(item.trn)),
        similarityScore(qName, normalizeNameSearchValue(item.reference)),
      ];
      const score = Math.max(...scores);
      return { item, score };
    })
    .filter((entry) => entry.score >= minScore)
    .sort((a, b) => b.score - a.score);
}
