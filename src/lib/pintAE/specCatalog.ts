import { PINT_AE_CODELISTS } from "@/lib/pintAE/generated/codelists";
import { PINT_AE_SPEC_METADATA } from "@/lib/pintAE/generated/metadata";

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

export function getCodelistCodes(codelistName: string): string[] {
  const list = PINT_AE_CODELISTS[codelistName as keyof typeof PINT_AE_CODELISTS];
  if (!list) return [];
  return list.ids.map((code) => normalizeCode(code));
}

export function isCodeInCodelist(codelistName: string, value: string): boolean {
  const normalized = normalizeCode(value);
  const values = getCodelistCodes(codelistName);
  return values.includes(normalized);
}

export function getPintAeSpecMetadata() {
  return PINT_AE_SPEC_METADATA;
}
