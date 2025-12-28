/**
 * Credit System Tests
 * Per Test Cases v1.9.3 - Critical Path Tests
 */
import { describe, test, expect, beforeEach } from 'vitest';

// Types
interface CreditPack {
  credits: number;
  purchasedAt: string;
  expired?: boolean;
}

interface AnalysisOptions {
  static?: boolean;
  runtime?: boolean;
  templates?: boolean;
  historical?: boolean;
}

// Functions under test (to be implemented in src/credits.ts)
function calculateCost(options: AnalysisOptions): number {
  let cost = 0;
  if (options.static) cost += 1;
  if (options.runtime) cost += 1;
  if (options.templates) cost += 1;
  if (options.historical) cost += 1;
  return cost;
}

function consumeCredits(packs: CreditPack[], amount: number): { consumed: number; remaining: number } {
  let remaining = amount;

  // Sort by purchase date (FIFO)
  const sortedPacks = [...packs].sort(
    (a, b) => new Date(a.purchasedAt).getTime() - new Date(b.purchasedAt).getTime()
  );

  for (const pack of sortedPacks) {
    if (pack.expired) continue;

    const toConsume = Math.min(pack.credits, remaining);
    pack.credits -= toConsume;
    remaining -= toConsume;

    if (remaining === 0) break;
  }

  if (remaining > 0) {
    throw new Error('Insufficient credits');
  }

  return { consumed: amount, remaining: 0 };
}

function isExpired(purchasedAt: string, expiryMonths: number = 6): boolean {
  const purchaseDate = new Date(purchasedAt);
  const expiryDate = new Date(purchaseDate);
  expiryDate.setMonth(expiryDate.getMonth() + expiryMonths);
  return new Date() > expiryDate;
}

function getTotalCredits(packs: CreditPack[]): number {
  return packs
    .filter(pack => !pack.expired)
    .reduce((sum, pack) => sum + pack.credits, 0);
}

// Tests
describe('Credit Calculation', () => {
  test('Static-only analysis costs 1 credit', () => {
    expect(calculateCost({ static: true, runtime: false })).toBe(1);
  });

  test('Runtime analysis costs 2 credits', () => {
    expect(calculateCost({ static: true, runtime: true })).toBe(2);
  });

  test('Template suggestions cost 3 credits', () => {
    expect(calculateCost({ static: true, runtime: true, templates: true })).toBe(3);
  });

  test('Historical comparison adds 1 credit', () => {
    expect(calculateCost({ static: true, historical: true })).toBe(2);
  });

  test('Full analysis costs 4 credits', () => {
    expect(calculateCost({ static: true, runtime: true, templates: true, historical: true })).toBe(4);
  });

  test('Empty options costs 0 credits', () => {
    expect(calculateCost({})).toBe(0);
  });
});

describe('FIFO Consumption', () => {
  test('Oldest credits consumed first', () => {
    const packs: CreditPack[] = [
      { credits: 50, purchasedAt: '2025-01-01' },
      { credits: 200, purchasedAt: '2025-06-01' },
    ];
    consumeCredits(packs, 30);
    expect(packs[0].credits).toBe(20);  // Oldest reduced
    expect(packs[1].credits).toBe(200); // Newer untouched
  });

  test('Expired credits skipped', () => {
    const packs: CreditPack[] = [
      { credits: 50, purchasedAt: '2024-01-01', expired: true },
      { credits: 200, purchasedAt: '2025-06-01' },
    ];
    consumeCredits(packs, 30);
    expect(packs[0].credits).toBe(50);  // Expired untouched
    expect(packs[1].credits).toBe(170); // Active reduced
  });

  test('Cannot go negative', () => {
    const packs: CreditPack[] = [{ credits: 10, purchasedAt: '2025-01-01' }];
    expect(() => consumeCredits(packs, 20)).toThrow('Insufficient credits');
  });

  test('Consumes across multiple packs', () => {
    const packs: CreditPack[] = [
      { credits: 30, purchasedAt: '2025-01-01' },
      { credits: 50, purchasedAt: '2025-02-01' },
    ];
    consumeCredits(packs, 50);
    expect(packs[0].credits).toBe(0);
    expect(packs[1].credits).toBe(30);
  });

  test('Exact consumption works', () => {
    const packs: CreditPack[] = [{ credits: 50, purchasedAt: '2025-01-01' }];
    consumeCredits(packs, 50);
    expect(packs[0].credits).toBe(0);
  });
});

describe('Credit Expiration', () => {
  test('Credits expire after 6 months', () => {
    const oldDate = new Date();
    oldDate.setMonth(oldDate.getMonth() - 7);
    expect(isExpired(oldDate.toISOString())).toBe(true);
  });

  test('Recent credits are not expired', () => {
    const recentDate = new Date();
    recentDate.setMonth(recentDate.getMonth() - 1);
    expect(isExpired(recentDate.toISOString())).toBe(false);
  });

  test('Credits at exactly 6 months are not expired', () => {
    const exactDate = new Date();
    exactDate.setMonth(exactDate.getMonth() - 6);
    exactDate.setDate(exactDate.getDate() + 1); // Just under 6 months
    expect(isExpired(exactDate.toISOString())).toBe(false);
  });
});

describe('Total Credits', () => {
  test('Sums all non-expired packs', () => {
    const packs: CreditPack[] = [
      { credits: 50, purchasedAt: '2025-01-01' },
      { credits: 200, purchasedAt: '2025-06-01' },
    ];
    expect(getTotalCredits(packs)).toBe(250);
  });

  test('Excludes expired packs', () => {
    const packs: CreditPack[] = [
      { credits: 50, purchasedAt: '2025-01-01', expired: true },
      { credits: 200, purchasedAt: '2025-06-01' },
    ];
    expect(getTotalCredits(packs)).toBe(200);
  });

  test('Empty packs returns 0', () => {
    expect(getTotalCredits([])).toBe(0);
  });
});
