export function normalizeAccountMaskSuffix(
  value: string | null | undefined
): string | null {
  if (!value) return null;

  const digits = value.replace(/\D/g, "");
  if (!digits) return null;

  return digits.length <= 4 ? digits : digits.slice(-4);
}

export function accountMaskSuffixMatches(
  left: string | null | undefined,
  right: string | null | undefined
): boolean {
  const normalizedLeft = normalizeAccountMaskSuffix(left);
  const normalizedRight = normalizeAccountMaskSuffix(right);

  return !!normalizedLeft && normalizedLeft === normalizedRight;
}
