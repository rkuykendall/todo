import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import db from './db/index.ts';
import { dayFields, formatDateISO } from '@todo/shared';
import type { Day, Ticket } from '@todo/shared';
import { NewTicketSchema, UpdateTicketSchema } from './types/ticket.ts';
import { PatchTicketDrawSchema, type TicketDraw } from './types/ticket_draw.ts';

const app = express();
app.use(cors());
app.use(express.json());

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void> | void;

// Raw database types with numbers instead of booleans
type RawDbTicket = {
  id: string;
  title: string;
  created_at: string;
  done_on_child_done: number;
  done: string | null;
  last_drawn: string | null;
  deadline: string | null;
  frequency: number;
} & Record<`can_draw_${Day}` | `must_draw_${Day}`, number>;

interface RawDbDraw {
  id: string;
  created_at: string;
  ticket_id: string;
  done: number;
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
    frequency: ticket.frequency ?? 1,
    ...dayFieldValues,
  };
}

function normalizeDraw(draw: RawDbDraw): TicketDraw {
  return {
    ...draw,
    done: Boolean(draw.done),
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
    'frequency',
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

const getTickets: AsyncRequestHandler = (_req, res) => {
  const raw = db.prepare('SELECT * FROM ticket').all() as RawDbTicket[];
  const normalized = raw.map(normalizeTicket);
  res.json(normalized);
  return;
};

const getTicketById: AsyncRequestHandler = (req, res) => {
  const ticket = db
    .prepare('SELECT * FROM ticket WHERE id = ?')
    .get(req.params.id) as RawDbTicket | undefined;
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }
  res.json(normalizeTicket(ticket));
  return;
};

const createTicket: AsyncRequestHandler = (req, res) => {
  const result = NewTicketSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
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
    'frequency',
    ...dayFields.flatMap((day) => [`can_draw_${day}`, `must_draw_${day}`]),
  ];

  const values = [
    id,
    data.title,
    Number(data.done_on_child_done ?? false),
    data.done ?? null,
    data.last_drawn ?? null,
    data.deadline ?? null,
    data.frequency ?? 1,
    ...dayFields.flatMap((day) => [
      Number(!!data[`can_draw_${day}` as keyof typeof data]),
      Number(!!data[`must_draw_${day}` as keyof typeof data]),
    ]),
  ];

  const placeholders = columns.map(() => '?').join(', ');
  const statement = `INSERT INTO ticket (${columns.join(', ')}) VALUES (${placeholders})`;

  db.prepare(statement).run(...values);

  res.status(201).json({ id });
  return;
};

const updateTicket: AsyncRequestHandler = (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM ticket WHERE id = ?').get(id) as
    | RawDbTicket
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  const result = UpdateTicketSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const updates = denormalizeTicket(result.data);

  const updateKeys = Object.keys(updates);
  if (updateKeys.length === 0) {
    res.status(400).json({ error: 'No valid fields to update' });
    return;
  }

  const setClause = updateKeys.map((key) => `${key} = ?`).join(', ');
  const updateStmt = db.prepare(`UPDATE ticket SET ${setClause} WHERE id = ?`);
  updateStmt.run(...updateKeys.map((k) => updates[k]), id);

  const updated = db
    .prepare('SELECT * FROM ticket WHERE id = ?')
    .get(id) as RawDbTicket;
  res.json(normalizeTicket(updated));
  return;
};

const deleteTicket: AsyncRequestHandler = (req, res) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM ticket WHERE id = ?').run(id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }
  res.json({ deleted: true });
  return;
};

// Utility: Get today's lowercase day name (e.g., "wednesday")
function getTodayDayString(): string {
  return new Date()
    .toLocaleString('en-US', {
      weekday: 'long',
      timeZone: 'America/Chicago',
    })
    .toLowerCase();
}

// Utility: Get ISO date string for YYYY-MM-DD (used for filtering)
function getTodayDate(): string {
  const date = new Date();
  const central = new Date(
    date.toLocaleString('en-US', { timeZone: 'America/Chicago' })
  );
  return formatDateISO(central);
}

const getTicketDraw: AsyncRequestHandler = (_req, res) => {
  const today = getTodayDate();

  const draws = db
    .prepare(
      "SELECT * FROM ticket_draw WHERE DATE(datetime(created_at, 'localtime')) = ?"
    )
    .all(today) as RawDbDraw[];

  res.json(draws.map(normalizeDraw));
  return;
};

// SQL query constants
const SELECT_DRAWS_BY_DATE =
  "SELECT * FROM ticket_draw WHERE DATE(datetime(created_at, 'localtime')) = ?";
const SELECT_TICKET_IDS_BY_DATE =
  "SELECT ticket_id FROM ticket_draw WHERE DATE(datetime(created_at, 'localtime')) = ?";
const INSERT_TICKET_DRAW = `
  INSERT INTO ticket_draw (id, created_at, ticket_id, done, skipped)
  VALUES (?, datetime('now', 'localtime'), ?, 0, 0)
`;

interface TicketDrawResult {
  addedDraws: number;
  totalDraws: number;
}

function selectTicketsForDraw(
  todayDay: string,
  existingTicketIds: Set<string>
): RawDbTicket[] {
  const today = getTodayDate();

  // Get must-draw tickets first, respecting frequency and done status
  const mustDrawTickets = db
    .prepare(
      `
      SELECT * FROM ticket 
      WHERE must_draw_${todayDay} = 1
      AND done IS NULL
      AND (
        last_drawn IS NULL 
        OR julianday(?) - julianday(last_drawn) >= frequency
      )
    `
    )
    .all(today) as RawDbTicket[];

  // Get eligible can-draw tickets, respecting frequency and done status
  const canDrawTickets = db
    .prepare(
      `SELECT * FROM ticket 
      WHERE can_draw_${todayDay} = 1 
      AND must_draw_${todayDay} = 0
      AND done IS NULL
      AND (
        last_drawn IS NULL 
        OR julianday(?) - julianday(last_drawn) >= frequency
      )`
    )
    .all(today) as RawDbTicket[];

  // Filter out tickets that already have draws
  const selectedTickets = [...mustDrawTickets];
  const remainingCanDraw = canDrawTickets.filter(
    (t) => !existingTicketIds.has(t.id)
  );

  // Randomly select additional tickets if needed
  while (
    selectedTickets.length + existingTicketIds.size < 5 &&
    remainingCanDraw.length > 0
  ) {
    const randomIndex = Math.floor(Math.random() * remainingCanDraw.length);
    selectedTickets.push(remainingCanDraw[randomIndex]);
    remainingCanDraw.splice(randomIndex, 1);
  }

  return selectedTickets;
}

function createDrawsForTickets(
  tickets: RawDbTicket[],
  existingTicketIds: Set<string>
): TicketDrawResult {
  const insert = db.prepare(INSERT_TICKET_DRAW);
  let addedDraws = 0;

  for (const ticket of tickets) {
    if (!existingTicketIds.has(ticket.id)) {
      const id = uuidv4();
      insert.run(id, ticket.id);
      existingTicketIds.add(ticket.id);
      addedDraws++;
    }
  }

  return {
    addedDraws,
    totalDraws: existingTicketIds.size,
  };
}

const createTicketDraw: AsyncRequestHandler = (_req, res) => {
  try {
    const today = getTodayDate();
    const todayDay = getTodayDayString();

    // Get existing draws
    const existingDraws = db
      .prepare(SELECT_TICKET_IDS_BY_DATE)
      .all(today) as Array<{ ticket_id: string }>;
    const existingTicketIds = new Set(existingDraws.map((d) => d.ticket_id));

    // Select and create new draws
    const selectedTickets = selectTicketsForDraw(todayDay, existingTicketIds);
    const result = createDrawsForTickets(selectedTickets, existingTicketIds);

    if (result.addedDraws === 0 && result.totalDraws < 5) {
      res.status(400).json({
        error: 'Not enough eligible tickets available for today',
        currentDraws: result.totalDraws,
      });
      return;
    }

    // Get all draws for today, including newly created ones
    const todaysDraws = db
      .prepare(SELECT_DRAWS_BY_DATE)
      .all(today) as RawDbDraw[];

    res.status(201).json(todaysDraws.map(normalizeDraw));
  } catch (error) {
    console.error('Error creating ticket draw:', error);
    res
      .status(500)
      .json({ error: 'Internal server error creating ticket draw' });
  }
  return;
};

const updateTicketDraw: AsyncRequestHandler = (req, res) => {
  const { id } = req.params;

  const parse = PatchTicketDrawSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }

  const updates = parse.data;
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: 'No valid fields to update.' });
    return;
  }

  const existing = db
    .prepare('SELECT * FROM ticket_draw WHERE id = ?')
    .get(id) as RawDbDraw | undefined;
  if (!existing) {
    res.status(404).json({ error: 'ticket_draw not found.' });
    return;
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

  if (updates.done === true || updates.skipped === true) {
    const ticket = db
      .prepare('SELECT * FROM ticket WHERE id = ?')
      .get(existing.ticket_id) as RawDbTicket;

    if (ticket.done_on_child_done) {
      // Get all draws for this ticket today
      const allDrawsToday = db
        .prepare(
          `SELECT * FROM ticket_draw 
           WHERE ticket_id = ? 
           AND DATE(datetime(created_at, 'localtime')) = DATE('now', 'localtime')`
        )
        .all(existing.ticket_id) as RawDbDraw[];

      // Check if all draws are either done or skipped
      const allCompleted = allDrawsToday.every(
        (draw) => draw.done || draw.skipped
      );

      if (allCompleted) {
        // Mark the ticket as done
        db.prepare(
          "UPDATE ticket SET done = datetime('now', 'localtime') WHERE id = ?"
        ).run(existing.ticket_id);
      }
    }

    // Update last_drawn timestamp only when marked as done
    if (updates.done === true) {
      db.prepare(
        "UPDATE ticket SET last_drawn = datetime('now', 'localtime') WHERE id = ?"
      ).run(existing.ticket_id);
    }
  }

  const updated = db
    .prepare('SELECT * FROM ticket_draw WHERE id = ?')
    .get(id) as RawDbDraw;
  res.json(normalizeDraw(updated));
  return;
};

const deleteAllDraws: AsyncRequestHandler = (_req, res) => {
  const result = db.prepare('DELETE FROM ticket_draw').run();
  res.json({ deleted: true, count: result.changes });
  return;
};

app.get('/tickets', getTickets);
app.get('/tickets/:id', getTicketById);
app.post('/tickets', createTicket);
app.put('/tickets/:id', updateTicket);
app.delete('/tickets/:id', deleteTicket);
app.get('/ticket_draw', getTicketDraw);
app.post('/ticket_draw', createTicketDraw);
app.patch('/ticket_draw/:id', updateTicketDraw);
app.delete('/ticket_draw', deleteAllDraws);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
