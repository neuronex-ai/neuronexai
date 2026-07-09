import { describe, expect, it } from 'vitest';
import {
  buildFinancialEntryIdempotencyKey,
  computeFinancialMonthlySeries,
  computeFinancialSummary,
  type FinancialEntry,
} from '../use-financial-entries';

const entry = (overrides: Partial<FinancialEntry>): FinancialEntry => ({
  id: 'entry-1',
  clinic_id: null,
  professional_id: 'user-1',
  patient_id: null,
  appointment_id: null,
  type: 'income',
  title: 'Sessao',
  description: 'Sessao',
  category_id: null,
  amount: 100,
  due_date: '2026-06-10',
  competence_date: '2026-06-10',
  paid_at: null,
  status: 'pending',
  payment_method: 'manual',
  origin: 'manual',
  neurofinance_transaction_id: null,
  neurofinance_charge_id: null,
  idempotency_key: null,
  reversal_of_entry_id: null,
  reversal_reason: null,
  cancelled_at: null,
  cancelled_reason: null,
  metadata: {},
  created_at: '2026-06-01T12:00:00.000Z',
  updated_at: '2026-06-01T12:00:00.000Z',
  ...overrides,
});

describe('financial entry calculations', () => {
  it('ignores cancelled entries in monthly summary', () => {
    const summary = computeFinancialSummary([
      entry({ id: 'paid-income', amount: 300, status: 'paid', paid_at: '2026-06-11T12:00:00.000Z' }),
      entry({ id: 'cancelled-income', amount: 500, status: 'cancelled' }),
    ], 2026, 5);

    expect(summary.incomePlanned).toBe(300);
    expect(summary.incomePaid).toBe(300);
    expect(summary.resultCurrent).toBe(300);
  });

  it('counts refund and chargeback reversals as paid expenses', () => {
    const summary = computeFinancialSummary([
      entry({ id: 'original-income', amount: 300, status: 'paid', paid_at: '2026-06-11T12:00:00.000Z' }),
      entry({
        id: 'refund-reversal',
        type: 'expense',
        title: 'Estorno',
        amount: 100,
        status: 'paid',
        origin: 'reversal',
        paid_at: '2026-06-12T12:00:00.000Z',
        reversal_of_entry_id: 'original-income',
        reversal_reason: 'refund',
      }),
    ], 2026, 5);

    expect(summary.incomePaid).toBe(300);
    expect(summary.expensePaid).toBe(100);
    expect(summary.resultCurrent).toBe(200);
  });

  it('keeps convenio totals separate in monthly series', () => {
    const [january] = computeFinancialMonthlySeries([
      entry({
        id: 'convenio-paid',
        amount: 200,
        status: 'paid',
        paid_at: '2026-01-05T12:00:00.000Z',
        competence_date: '2026-01-05',
        due_date: '2026-01-05',
        payment_method: 'convenio',
        origin: 'convenio',
      }),
      entry({
        id: 'convenio-pending',
        amount: 150,
        status: 'pending',
        competence_date: '2026-01-09',
        due_date: '2026-01-09',
        payment_method: 'convenio',
        origin: 'convenio',
      }),
    ], 2026);

    expect(january.convenioTotal).toBe(350);
    expect(january.convenioPaid).toBe(200);
    expect(january.convenioPending).toBe(150);
  });

  it('normalizes idempotency keys', () => {
    expect(buildFinancialEntryIdempotencyKey(['Appointment', 'Primary', ' abc 123 ', null])).toBe('appointment:primary:abc-123');
  });
});
