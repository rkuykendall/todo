import { z } from "zod";

const dayFields = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

type Day = (typeof dayFields)[number];

// 🔹 Zod Schema for New Ticket Input
export const NewTicketSchema = z.object({
  title: z.string().min(1, "Title is required"),
  done_on_child_done: z.boolean().optional().default(false),
  done: z.string().datetime().optional().nullable(),
  last_drawn: z.string().datetime().optional().nullable(),
  deadline: z.string().datetime().optional().nullable(),

  // Dynamically build can_draw_* and must_draw_*
  ...Object.fromEntries(
    dayFields.flatMap((day) => [
      [`can_draw_${day}`, z.boolean().optional().default(false)],
      [`must_draw_${day}`, z.boolean().optional().default(false)],
    ])
  ),
});

// 🔹 Zod Schema for Ticket Update
export const UpdateTicketSchema = NewTicketSchema.partial();

// 🔹 TypeScript Types
export type NewTicketInput = z.infer<typeof NewTicketSchema>;
export type UpdateTicketInput = z.infer<typeof UpdateTicketSchema>;

export interface Ticket extends NewTicketInput {
  id: string;
  created_at: string;
}
