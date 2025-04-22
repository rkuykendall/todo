export const API_DOMAIN =
  import.meta.env.VITE_API_DOMAIN || 'http://localhost:4000';

export function formatDate(date: string | null): string {
  if (!date) return 'Never';
  return new Date(date).toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    dateStyle: 'short',
  });
}

export function formatAge(date: string | null): string {
  if (!date) return '';
  const now = new Date();
  const ticketDate = new Date(date);
  const diffMs = now.getTime() - ticketDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}
