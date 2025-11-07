import { z } from 'zod';

// Re-define dayFields here to avoid circular import
const dayFields = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

// Base ticket validation schema
export const NewTicketSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  recurring: z.boolean().optional().default(false),
  done: z.string().datetime().optional().nullable(),
  last_drawn: z.string().datetime().optional().nullable(),
  deadline: z.string().datetime().optional().nullable(),
  frequency: z.number().int().min(1).default(1),

  // Day-specific draw settings
  ...Object.fromEntries(
    dayFields.flatMap((day) => [
      [`can_draw_${day}`, z.boolean().optional().default(false)],
      [`must_draw_${day}`, z.boolean().optional().default(false)],
    ])
  ),
});

// Schema for updating tickets (all fields optional)
export const UpdateTicketSchema = NewTicketSchema.partial();

// Schema for ticket draw operations
export const TicketDrawSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  ticket_id: z.string().uuid(),
  done: z.boolean().default(false),
  skipped: z.boolean().default(false),
});

// Schema for updating ticket draws
export const UpdateTicketDrawSchema = z.object({
  done: z.boolean().optional(),
  skipped: z.boolean().optional(),
});

// Frontend form validation schema (stricter rules)
export const TicketFormSchema = z
  .object({
    title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
    recurring: z.boolean().default(false),
    deadline: z.string().datetime().optional().nullable(),
    frequency: z
      .number()
      .int()
      .min(1, 'Frequency must be at least 1')
      .max(365, 'Frequency cannot exceed 365 days'),

    // Day-specific settings with validation
    ...Object.fromEntries(
      dayFields.flatMap((day) => [
        [`can_draw_${day}`, z.boolean().default(false)],
        [`must_draw_${day}`, z.boolean().default(false)],
      ])
    ),
  })
  .refine(
    (data) => {
      // At least one day must be enabled if the ticket is not done
      const canDrawDays = dayFields.some(
        (day) => data[`can_draw_${day}` as keyof typeof data]
      );
      const mustDrawDays = dayFields.some(
        (day) => data[`must_draw_${day}` as keyof typeof data]
      );
      return canDrawDays || mustDrawDays;
    },
    {
      message: 'At least one day must be enabled for drawing',
      path: ['can_draw_monday'], // Show error on the first day field
    }
  );

// Type exports
export type NewTicketInput = z.infer<typeof NewTicketSchema>;
export type UpdateTicketInput = z.infer<typeof UpdateTicketSchema>;
export type TicketDrawInput = z.infer<typeof TicketDrawSchema>;
export type UpdateTicketDrawInput = z.infer<typeof UpdateTicketDrawSchema>;
export type TicketFormInput = z.infer<typeof TicketFormSchema>;

// Validation helper functions
export function validateNewTicket(data: unknown): NewTicketInput {
  return NewTicketSchema.parse(data);
}

export function validateUpdateTicket(data: unknown): UpdateTicketInput {
  return UpdateTicketSchema.parse(data);
}

export function validateTicketForm(data: unknown): TicketFormInput {
  return TicketFormSchema.parse(data);
}

export function validateTicketDraw(data: unknown): TicketDrawInput {
  return TicketDrawSchema.parse(data);
}

export function validateUpdateTicketDraw(data: unknown): UpdateTicketDrawInput {
  return UpdateTicketDrawSchema.parse(data);
}

// Safe validation functions (return success/error results)
export function safeValidateNewTicket(data: unknown) {
  return NewTicketSchema.safeParse(data);
}

export function safeValidateUpdateTicket(data: unknown) {
  return UpdateTicketSchema.safeParse(data);
}

export function safeValidateTicketForm(data: unknown) {
  return TicketFormSchema.safeParse(data);
}

export function safeValidateTicketDraw(data: unknown) {
  return TicketDrawSchema.safeParse(data);
}

export function safeValidateUpdateTicketDraw(data: unknown) {
  return UpdateTicketDrawSchema.safeParse(data);
}
