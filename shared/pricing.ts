/**
 * Centralized Pricing Configuration
 * Single source of truth for all pricing displays and logic
 */

export const PRICING = {
  monthly: {
    amount: 9.99,
    displayAmount: '$9.99',
    interval: 'month',
    label: 'Monthly',
  },
  yearly: {
    amount: 90,
    displayAmount: '$90',
    interval: 'year',
    label: 'Yearly',
    monthlyEquivalent: 7.50,
    savings: 25, // percentage saved vs monthly
  },
  trial: {
    duration: 30, // days
    label: '30-day free trial',
  },
} as const;

export type PricingInterval = 'monthly' | 'yearly';

export function formatPrice(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function getYearlySavings(): number {
  const yearlyIfMonthly = PRICING.monthly.amount * 12;
  const yearlySavings = yearlyIfMonthly - PRICING.yearly.amount;
  return Math.round((yearlySavings / yearlyIfMonthly) * 100);
}

export function getMonthlyEquivalent(): string {
  const monthly = PRICING.yearly.amount / 12;
  return formatPrice(monthly);
}
