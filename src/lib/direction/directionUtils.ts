import { DEFAULT_DIRECTION, Direction } from '@/types/direction';

const DIRECTION_TAG_REGEX = /\[\[direction:(AR|AP)\]\]/i;

export function resolveDirection(input?: string | null): Direction {
  if (input === 'AR' || input === 'AP') return input;
  return DEFAULT_DIRECTION;
}

export function detectDirectionFromColumns(columns: string[]): Direction | null {
  const normalized = new Set(columns.map((column) => column.trim().toLowerCase()));
  const apSignals = ['supplier_id', 'supplier_name', 'vendor_id', 'vendor_name'];
  const arSignals = ['buyer_id', 'buyer_name', 'customer_id', 'customer_name'];

  const apScore = apSignals.reduce((score, signal) => score + (normalized.has(signal) ? 1 : 0), 0);
  const arScore = arSignals.reduce((score, signal) => score + (normalized.has(signal) ? 1 : 0), 0);

  if (apScore === 0 && arScore === 0) return null;
  if (apScore > arScore) return 'AP';
  if (arScore > apScore) return 'AR';
  return null;
}

export function withDirectionTag(description: string | null | undefined, direction: Direction): string {
  const clean = removeDirectionTag(description ?? '').trim();
  const tag = `[[direction:${direction}]]`;
  return clean ? `${tag}\n${clean}` : tag;
}

export function parseDirectionFromDescription(description?: string | null): Direction {
  const match = description?.match(DIRECTION_TAG_REGEX);
  return resolveDirection(match?.[1]);
}

export function removeDirectionTag(description?: string | null): string {
  if (!description) return '';
  return description.replace(DIRECTION_TAG_REGEX, '').trim();
}
