/**
 * Display-only score formatter. Never use this to round values before storage
 * or intermediate calculation — round only for leaderboard/UI display.
 *
 * Outputs exactly 4 decimal places.
 */
export type FormatScoreOptions = {
  /** Number of decimal places for display. Fixed at 4 for Digiverse. */
  decimals?: 4;
};

/**
 * Formats a numeric score (or decimal string) to exactly 4 decimal places
 * for display. Does not mutate or round the source value for storage.
 *
 * Accepts strings to preserve precision from decimal.js / NUMERIC columns.
 */
export function formatScore(
  value: number | string,
  options: FormatScoreOptions = {},
): string {
  const decimals = options.decimals ?? 4;

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new RangeError(`formatScore: non-finite number ${String(value)}`);
    }
    // Display-only: toFixed is acceptable here because the contract is
    // "exactly N decimals on screen", not precision-preserving arithmetic.
    return value.toFixed(decimals);
  }

  const trimmed = value.trim();
  if (trimmed === '' || !/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed)) {
    throw new TypeError(`formatScore: invalid decimal string "${value}"`);
  }

  // Prefer BigInt-style fixed decimal for non-scientific strings to avoid
  // binary float drift when the input already has many fractional digits.
  if (!/[eE]/.test(trimmed)) {
    return formatDecimalString(trimmed, decimals);
  }

  const asNumber = Number(trimmed);
  if (!Number.isFinite(asNumber)) {
    throw new RangeError(`formatScore: non-finite string "${value}"`);
  }
  return asNumber.toFixed(decimals);
}

function formatDecimalString(raw: string, decimals: number): string {
  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;
  const [intPartRaw, fracRaw = ''] = unsigned.split('.');
  const intPart = intPartRaw === '' ? '0' : intPartRaw;

  if (fracRaw.length === decimals) {
    return `${negative ? '-' : ''}${intPart}.${fracRaw}`;
  }

  if (fracRaw.length < decimals) {
    return `${negative ? '-' : ''}${intPart}.${fracRaw.padEnd(decimals, '0')}`;
  }

  // Round half-up at the display boundary only.
  const keep = fracRaw.slice(0, decimals);
  const nextDigit = Number(fracRaw.charAt(decimals));
  if (nextDigit < 5) {
    return `${negative ? '-' : ''}${intPart}.${keep}`;
  }

  const bumped = incrementDecimalDigits(intPart, keep);
  return `${negative ? '-' : ''}${bumped.int}.${bumped.frac}`;
}

function incrementDecimalDigits(
  intPart: string,
  fracDigits: string,
): { int: string; frac: string } {
  const digits = (intPart + fracDigits).split('').map((d) => Number(d));
  let carry = 1;
  for (let i = digits.length - 1; i >= 0 && carry > 0; i -= 1) {
    const sum = digits[i]! + carry;
    digits[i] = sum % 10;
    carry = Math.floor(sum / 10);
  }
  const all = carry > 0 ? [carry, ...digits] : digits;
  const fracLen = fracDigits.length;
  const frac = all.slice(-fracLen).join('').padStart(fracLen, '0');
  const int = all.slice(0, all.length - fracLen).join('') || '0';
  return { int, frac };
}
