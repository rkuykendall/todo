export function formatDate(date: string | null): string {
  if (!date) return 'Never';
  return new Date(date).toLocaleDateString();
}
