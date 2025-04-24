import { z } from 'zod';
import { dayFields } from '@todo/shared';

export const NewTicketSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  recurring: z.boolean().optional().default(false),
  done: z.string().datetime().optional().nullable(),
  last_drawn: z.string().datetime().optional().nullable(),
  deadline: z.string().datetime().optional().nullable(),
  frequency: z.number().int().min(1).default(1),

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
