export const API_DOMAIN =
  import.meta.env.VITE_API_DOMAIN || 'http://localhost:4000';

export function formatDate(date: string | null): string {
  if (!date) return 'Never';
  return new Date(date).toLocaleDateString();
}
