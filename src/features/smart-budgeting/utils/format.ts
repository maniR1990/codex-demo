import { addMonths, format, formatISO, parseISO } from 'date-fns';

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(value);
}

export function monthKey(date?: string | null) {
  return date ? date.slice(0, 7) : '';
}

export function yearKey(date?: string | null) {
  return date ? date.slice(0, 4) : '';
}

export function formatMonthLabel(month: string) {
  try {
    return format(parseISO(`${month}-01`), 'MMMM yyyy');
  } catch {
    return month;
  }
}

export function defaultDueDateForPeriod(
  viewMode: 'monthly' | 'yearly',
  month: string,
  year: string
) {
  const today = new Date();
  if (viewMode === 'monthly') {
    const [yearPart, monthPart] = month.split('-');
    const safeYear = Number.parseInt(yearPart, 10);
    const safeMonth = Number.parseInt(monthPart, 10) - 1;
    if (Number.isNaN(safeYear) || Number.isNaN(safeMonth)) {
      return formatISO(today, { representation: 'date' });
    }
    const lastDayOfMonth = new Date(safeYear, safeMonth + 1, 0).getDate();
    const preferredDay = Math.min(today.getDate(), lastDayOfMonth);
    const defaultDate = new Date(safeYear, safeMonth, preferredDay);
    return formatISO(defaultDate, { representation: 'date' });
  }

  const safeYear = Number.parseInt(year, 10);
  if (Number.isNaN(safeYear)) {
    return formatISO(today, { representation: 'date' });
  }
  const defaultDate = new Date(safeYear, today.getMonth(), today.getDate());
  return formatISO(defaultDate, { representation: 'date' });
}
