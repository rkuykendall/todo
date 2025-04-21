import { z } from 'zod';

export const PatchTicketDrawSchema = z.object({
  done: z.boolean().optional(),
  skipped: z.boolean().optional(),
});

export type PatchTicketDrawInput = z.infer<typeof PatchTicketDrawSchema>;

export interface TicketDraw {
  id: string;
  created_at: string;
  ticket_id: string;
  done: boolean;
  skipped: boolean;
}
