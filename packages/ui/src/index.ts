/** Shared UI primitives placeholder — Phase 0 shell only. */

export function formatMoneyLabel(amount: string, currency: string): string {
  const symbols: Record<string, string> = {
    BDT: '৳',
    GBP: '£',
    USD: '$',
    EUR: '€',
  };
  const symbol = symbols[currency] ?? `${currency} `;
  return `${symbol}${amount}`;
}
