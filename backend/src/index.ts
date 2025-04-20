import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import db from './db/index.js';
import { dayFields } from '@todo/shared/index.js';
import type { Day, Ticket } from '@todo/shared/index.js';
import { NewTicketSchema, UpdateTicketSchema } from './types/ticket.js';
import { PatchTicketDrawSchema, TicketDraw } from './types/ticket_draw.js';

const app = express();
app.use(cors());
app.use(express.json());

// Raw database types with numbers instead of booleans
type RawDbTicket = {
  id: string;
  title: string;
  created_at: string;
  done_on_child_done: number;
  done: string | null;
  last_drawn: string | null;
  deadline: string | null;
} & Record<`can_draw_${Day}` | `must_draw_${Day}`, number>;

interface RawDbDraw {
  id: string;
  created_at: string;
  ticket_id: string;
  done: number;
  made_progress: number;
  skipped: number;
}

function normalizeTicket(ticket: RawDbTicket): Ticket {
  // Convert can_draw and must_draw fields into a temporary object
  const dayFieldValues = {} as Record<
    `can_draw_${Day}` | `must_draw_${Day}`,
    boolean
  >;

  for (const day of dayFields) {
    const canDrawKey = `can_draw_${day}` as const;
    const mustDrawKey = `must_draw_${day}` as const;
    dayFieldValues[canDrawKey] = Boolean(ticket[canDrawKey]);
    dayFieldValues[mustDrawKey] = Boolean(ticket[mustDrawKey]);
  }

  // Return combined object
  return {
    id: ticket.id,
    title: ticket.title,
    done_on_child_done: Boolean(ticket.done_on_child_done),
    done: ticket.done,
    last_drawn: ticket.last_drawn,
    deadline: ticket.deadline,
    ...dayFieldValues,
  };
}

function normalizeDraw(draw: RawDbDraw): TicketDraw {
  return {
    ...draw,
    done: Boolean(draw.done),
    made_progress: Boolean(draw.made_progress),
    skipped: Boolean(draw.skipped),
  };
}

function denormalizeTicket(input: Partial<Ticket>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Copy non-boolean fields directly
  const nonBoolFields = [
    'id',
    'title',
    'created_at',
    'done',
    'last_drawn',
    'deadline',
  ];
  for (const field of nonBoolFields) {
    if (field in input) {
      result[field] = input[field as keyof typeof input];
    }
  }

  // Convert boolean fields to numbers
  if ('done_on_child_done' in input) {
    result.done_on_child_done = Number(input.done_on_child_done);
  }

  for (const day of dayFields) {
    const canDrawKey = `can_draw_${day}` as keyof Ticket;
    const mustDrawKey = `must_draw_${day}` as keyof Ticket;
    if (canDrawKey in input) {
      result[canDrawKey] = Number(input[canDrawKey]);
    }
    if (mustDrawKey in input) {
      result[mustDrawKey] = Number(input[mustDrawKey]);
    }
  }

  return result;
}

app.get('/tickets', (_req, res) => {
  const raw = db.prepare('SELECT * FROM ticket').all() as RawDbTicket[];
  const normalized = raw.map(normalizeTicket);
  res.json(normalized);
});

app.get('/tickets/:id', (req, res) => {
  const ticket = db
    .prepare('SELECT * FROM ticket WHERE id = ?')
    .get(req.params.id) as RawDbTicket | undefined;
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  res.json(normalizeTicket(ticket));
});

app.post('/tickets', (req, res) => {
  const result = NewTicketSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten() });
  }

  const data = result.data;
  const id = uuidv4();

  const columns = [
    'id',
    'title',
    'done_on_child_done',
    'done',
    'last_drawn',
    'deadline',
    ...dayFields.flatMap((day) => [`can_draw_${day}`, `must_draw_${day}`]),
  ];

  const values = [
    id,
    data.title,
    Number(data.done_on_child_done ?? false),
    data.done ?? null,
    data.last_drawn ?? null,
    data.deadline ?? null,
    ...dayFields.flatMap((day) => [
      Number(!!data[`can_draw_${day}` as keyof typeof data]),
      Number(!!data[`must_draw_${day}` as keyof typeof data]),
    ]),
  ];

  const placeholders = columns.map(() => '?').join(', ');
  const statement = `INSERT INTO ticket (${columns.join(', ')}) VALUES (${placeholders})`;

  db.prepare(statement).run(...values);

  res.status(201).json({ id });
});

app.put('/tickets/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM ticket WHERE id = ?').get(id) as
    | RawDbTicket
    | undefined;
  if (!existing) return res.status(404).json({ error: 'Ticket not found' });

  const result = UpdateTicketSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten() });
  }

  const updates = denormalizeTicket(result.data);

  const updateKeys = Object.keys(updates);
  if (updateKeys.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  const setClause = updateKeys.map((key) => `${key} = ?`).join(', ');
  const updateStmt = db.prepare(`UPDATE ticket SET ${setClause} WHERE id = ?`);
  updateStmt.run(...updateKeys.map((k) => updates[k]), id);

  const updated = db
    .prepare('SELECT * FROM ticket WHERE id = ?')
    .get(id) as RawDbTicket;
  res.json(normalizeTicket(updated));
});

app.delete('/tickets/:id', (req, res) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM ticket WHERE id = ?').run(id);
  if (result.changes === 0)
    return res.status(404).json({ error: 'Ticket not found' });
  res.json({ deleted: true });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Utility: Get today's lowercase day name (e.g., "wednesday")
function getTodayDayString(): string {
  return new Date()
    .toLocaleDateString('en-US', { weekday: 'long' })
    .toLowerCase();
}

// Utility: Get ISO date string for YYYY-MM-DD (used for filtering)
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

app.get('/ticket_draw', (_req, res) => {
  const today = getTodayDate();

  const draws = db
    .prepare('SELECT * FROM ticket_draw WHERE DATE(created_at) = ?')
    .all(today) as RawDbDraw[];

  res.json(draws.map(normalizeDraw));
});

app.post('/ticket_draw', (_req, res) => {
  const today = getTodayDate();
  const todayDay = getTodayDayString();

  const eligibleTickets = db
    .prepare(`SELECT * FROM ticket WHERE can_draw_${todayDay} = 1`)
    .all() as RawDbTicket[];

  const existingDraws = db
    .prepare('SELECT ticket_id FROM ticket_draw WHERE DATE(created_at) = ?')
    .all(today) as Array<{ ticket_id: string }>;

  const existingTicketIds = new Set(existingDraws.map((d) => d.ticket_id));

  const insert = db.prepare(`
    INSERT INTO ticket_draw (id, created_at, ticket_id, done, made_progress, skipped)
    VALUES (?, CURRENT_TIMESTAMP, ?, 0, 0, 0)
  `);

  for (const ticket of eligibleTickets) {
    if (existingTicketIds.has(ticket.id)) continue;
    const id = uuidv4();
    insert.run(id, ticket.id);
  }

  const todaysDraws = db
    .prepare('SELECT * FROM ticket_draw WHERE DATE(created_at) = ?')
    .all(today) as RawDbDraw[];

  res.status(201).json(todaysDraws.map(normalizeDraw));
});

app.patch('/ticket_draw/:id', (req, res) => {
  const { id } = req.params;

  const parse = PatchTicketDrawSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.flatten() });
  }

  const updates = parse.data;
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update.' });
  }

  const existing = db
    .prepare('SELECT * FROM ticket_draw WHERE id = ?')
    .get(id) as RawDbDraw | undefined;
  if (!existing) {
    return res.status(404).json({ error: 'ticket_draw not found.' });
  }

  const setClause = Object.keys(updates)
    .map((key) => `${key} = ?`)
    .join(', ');
  const updateStmt = db.prepare(
    `UPDATE ticket_draw SET ${setClause} WHERE id = ?`
  );
  const coercedValues = Object.values(updates).map((val) =>
    typeof val === 'boolean' ? Number(val) : val
  );
  updateStmt.run(...coercedValues, id);

  if (updates.done === true) {
    db.prepare(
      'UPDATE ticket SET last_drawn = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(existing.ticket_id);
  }

  const updated = db
    .prepare('SELECT * FROM ticket_draw WHERE id = ?')
    .get(id) as RawDbDraw;
  res.json(normalizeDraw(updated));
});
