// DEC-046 snapshot: illustrative PHP centavos per XLM, not redeemable pesos.
export const MONEY_MAPPING = Object.freeze({ version: 'php-xlm-20261107-v1', phpCentavosPerXlm: '968', checkedAt: '2026-11-06T16:51:24Z', source: 'https://www.coingecko.com/en/coins/stellar/php', simulated: true });
export function units(value) {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,23})$/.test(value)) throw new Error('INVALID_AMOUNT');
  return BigInt(value);
}
export function phpToStroops(priceMinor) { if (typeof priceMinor !== 'string' || priceMinor.length > 18) throw new Error('INVALID_AMOUNT'); return ((units(priceMinor) * 10_000_000n + 484n) / 968n).toString(); }
export function stroopsToPhp(amountStroops) { return ((units(amountStroops) * 968n + 5_000_000n) / 10_000_000n).toString(); }
export function splitAllowance(amountStroops, needsPercent = 60) {
  if (!Number.isInteger(needsPercent) || needsPercent < 0 || needsPercent > 100) throw new Error('INVALID_RATIO');
  const total = units(amountStroops), needs = total * BigInt(needsPercent) / 100n;
  return { needs: needs.toString(), wants: (total - needs).toString() };
}
