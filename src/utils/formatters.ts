// Standardized formatting utilities across the application

export const formatCurrency = (amount: number): string => {
  if (isNaN(amount) || !isFinite(amount)) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatCurrencyCompact = (amount: number): string => {
  if (isNaN(amount) || !isFinite(amount)) return '$0';
  if (Math.abs(amount) >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `$${(amount / 1_000).toFixed(0)}k`;
  }
  return formatCurrency(amount);
};

export const formatPercent = (val: number, decimals: number = 1): string => {
  if (isNaN(val) || !isFinite(val)) return '0.0%';
  return `${(val * 100).toFixed(decimals)}%`;
};

export const formatAge = (age: number): string => {
  return Math.round(age).toString();
};
