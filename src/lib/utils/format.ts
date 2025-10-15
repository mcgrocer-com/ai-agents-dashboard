/**
 * Formatting utilities for numbers, currency, and percentages
 */

/**
 * Format a number with commas for thousands
 * @example formatNumber(1234567) => "1,234,567"
 */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }
  return new Intl.NumberFormat('en-US').format(value);
}

/**
 * Format a number as currency (GBP)
 * @example formatCurrency(1234.56) => "£1,234.56"
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '£0.00';
  }
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(value);
}

/**
 * Format a decimal as a percentage
 * @example formatPercentage(0.8523) => "85.23%"
 * @example formatPercentage(0.8523, 0) => "85%"
 */
export function formatPercentage(
  value: number | null | undefined,
  decimals: number = 2
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0%';
  }
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format a date to a readable string
 * @example formatDate(new Date()) => "Oct 12, 2025"
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return 'N/A';

  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'Invalid Date';

  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

/**
 * Format a date to include time
 * @example formatDateTime(new Date()) => "Oct 12, 2025, 11:30 PM"
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return 'N/A';

  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'Invalid Date';

  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Format a relative time (e.g., "2 hours ago")
 * @example formatRelativeTime(new Date(Date.now() - 2 * 60 * 60 * 1000)) => "2 hours ago"
 */
export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return 'N/A';

  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'Invalid Date';

  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  if (seconds > 0) return `${seconds} second${seconds > 1 ? 's' : ''} ago`;
  return 'just now';
}

/**
 * Format file size in bytes to human readable format
 * @example formatFileSize(1024) => "1 KB"
 * @example formatFileSize(1048576) => "1 MB"
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || isNaN(bytes)) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}
