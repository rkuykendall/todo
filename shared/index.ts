export const dayFields = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type Day = (typeof dayFields)[number];

export interface Ticket {
  id: string;
  title: string;
  created_at: string;
  recurring: boolean;
  done: string | null;
  last_drawn: string | null;
  deadline: string | null;
  frequency: number;

  can_draw_monday: boolean;
  must_draw_monday: boolean;
  can_draw_tuesday: boolean;
  must_draw_tuesday: boolean;
  can_draw_wednesday: boolean;
  must_draw_wednesday: boolean;
  can_draw_thursday: boolean;
  must_draw_thursday: boolean;
  can_draw_friday: boolean;
  must_draw_friday: boolean;
  can_draw_saturday: boolean;
  must_draw_saturday: boolean;
  can_draw_sunday: boolean;
  must_draw_sunday: boolean;
}

const dateToIsoDateString = (date: Date): string => {
  const isoString = date.toISOString();
  return isoString.split('T')[0] || '';
};

export function formatDateISO(date: unknown): string {
  const now = dateToIsoDateString(new Date());

  if (date === null || date === undefined) {
    return now;
  }

  try {
    if (date instanceof Date) {
      return dateToIsoDateString(date);
    }

    if (typeof date === 'string' || typeof date === 'number') {
      return dateToIsoDateString(new Date(date));
    }

    return now;
  } catch {
    return now;
  }
}

// Re-export validation schemas and functions
export * from './validation.js';

// Re-export enhanced types
export * from './types.js';
