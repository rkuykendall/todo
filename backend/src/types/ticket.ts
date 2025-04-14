import { z } from 'zod';

const dayFields = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

type Day = (typeof dayFields)[number];

export const NewTicketSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  done_on_child_done: z.boolean().optional().default(true),
  done: z.string().datetime().optional().nullable(),
  last_drawn: z.string().datetime().optional().nullable(),
  deadline: z.string().datetime().optional().nullable(),

  ...Object.fromEntries(
    dayFields.flatMap((day) => [
      [`can_draw_${day}`, z.boolean().optional().default(false)],
      [`must_draw_${day}`, z.boolean().optional().default(false)],
    ])
  ),
});

export const UpdateTicketSchema = NewTicketSchema.partial();

export type NewTicketInput = z.infer<typeof NewTicketSchema>;
export type UpdateTicketInput = z.infer<typeof UpdateTicketSchema>;

export interface Ticket extends NewTicketInput {
  id: string;
  created_at: string;
}
