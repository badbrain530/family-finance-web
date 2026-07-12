import { describe, it, expect } from 'vitest';
import { isBalanceAdjustment } from './transactionUtils';
import type { Transaction } from '@/types/transaction';

function makeTx(overrides: Partial<Transaction> = {} as Partial<Transaction>): Transaction {
  return {
    id: 't1',
    ledgerId: 'l1',
    userId: 'u1',
    categoryId: null,
    accountId: null,
    type: 'income' as any,
    amount: 100,
    date: new Date().toISOString(),
    merchant: null,
    note: null,
    source: 'manual' as any,
    importRecordId: null,
    aiConfidence: null,
    aiCorrected: false,
    isLargeExpense: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currency: 'CNY',
    metadata: null,
    tags: [],
    ...overrides,
  } as Transaction;
}

describe('isBalanceAdjustment', () => {
  it('true when metadata.balanceAdjustment === true', () => {
    expect(isBalanceAdjustment(makeTx({ metadata: { balanceAdjustment: true } }))).toBe(true);
  });

  it('false when metadata is null', () => {
    expect(isBalanceAdjustment(makeTx({ metadata: null }))).toBe(false);
  });

  it('false when metadata exists but flag missing/false', () => {
    expect(isBalanceAdjustment(makeTx({ metadata: { foo: 1 } }))).toBe(false);
    expect(isBalanceAdjustment(makeTx({ metadata: { balanceAdjustment: false } }))).toBe(false);
  });
});
