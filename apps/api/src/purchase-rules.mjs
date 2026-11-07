import { phpToStroops, MONEY_MAPPING } from './money-mapping.mjs';
// Change future purchase policy here; existing purchases retain their snapshot.
export const PURCHASE_RULES = Object.freeze({ version: 'needs-demo-v2', capMinor: '484', allowedCategories: ['meals', 'fruits_vegetables', 'drinking_water', 'school_supplies', 'books'], sellerId: 'demo-seller', mappingVersion: MONEY_MAPPING.version });
export function decidePurchase(ai, priceMinor, availableStroops, rules = PURCHASE_RULES) {
  if (!ai || ai.uncertain || !ai.productName || ai.category === 'unknown') return 'AI_UNCERTAIN';
  if (ai.prohibited || !rules.allowedCategories.includes(ai.category)) return 'CATEGORY_DISALLOWED';
  if (BigInt(priceMinor) > BigInt(rules.capMinor)) return 'CAP_EXCEEDED';
  if (BigInt(phpToStroops(priceMinor)) > BigInt(availableStroops)) return 'INSUFFICIENT_FUNDS';
  return null;
}
