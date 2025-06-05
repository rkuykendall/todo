import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import db from './db/index.ts';
import { dayFields } from '@todo/shared';
import { NewTicketSchema, UpdateTicketSchema } from './types/ticket.ts';
import { PatchTicketDrawSchema, type TicketDraw } from './types/ticket_draw.ts';
import {
  getMustDrawQuery,
  getCanDrawQuery,
  getDeadlineTicketsQuery,
  getApproachingDeadlineQuery,
} from './db/queries.ts';
import {
  type RawDbTicket,
  type RawDbDraw,
  normalizeTicket,
  denormalizeTicket,
  calculateDailyDrawCount,
  getTodayDate,
} from './db/utils.ts';

const app = express();
app.use(cors());
app.use(
  express.json({
    verify: (_req, _res, buf) => {
      try {
        JSON.parse(buf.toString());
      } catch {
        // Need to throw an error to stop the request processing
        // We can't properly respond here due to Express typing limitations
        throw new Error('Invalid JSON in request body');
      }
    },
  })
);

// Configure rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minute window
  limit: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: 'draft-7', // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: { error: 'Too many requests, please try again later.' },
});

// Apply rate limiting to all routes
app.use(apiLimiter);

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const requestId = uuidv4().slice(0, 8);

  console.log(`[${requestId}] ${req.method} ${req.path} started`);

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `[${requestId}] ${req.method} ${req.path} ${res.statusCode} - ${duration}ms`
    );
  });

  next();
});

// Add basic authentication
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || 'default-password';

// URL parameter validation middleware
const validateIdParam = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const id = req.params.id;

  // Check if the ID parameter exists and has the right format (UUID)
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!id || !uuidRegex.test(id)) {
    res.status(400).json({ error: 'Invalid ID format' });
    return;
  }

  next();
};

function basicAuth(req: Request, res: Response, next: NextFunction) {
  // Skip auth for OPTIONS requests (CORS preflight)
  if (req.method === 'OPTIONS') {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const passwordToCheck = token.trim();

  if (passwordToCheck !== AUTH_PASSWORD) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}

// Apply authentication to all routes
app.use(basicAuth);

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

function normalizeDraw(draw: RawDbDraw): TicketDraw {
  return {
    ...draw,
    done: Boolean(draw.done),
    skipped: Boolean(draw.skipped),
  };
}

const getTickets: AsyncRequestHandler = async (_req, res, next) => {
  try {
    const raw = db.prepare('SELECT * FROM ticket').all() as RawDbTicket[];
    const normalized = raw.map(normalizeTicket);
    res.json(normalized);
  } catch (error) {
    next(error);
  }
};

const getTicketById: AsyncRequestHandler = async (req, res, next) => {
  try {
    const ticket = db
      .prepare('SELECT * FROM ticket WHERE id = ?')
      .get(req.params.id) as RawDbTicket | undefined;
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }
    res.json(normalizeTicket(ticket));
  } catch (error) {
    next(error);
  }
};

const createTicket: AsyncRequestHandler = async (req, res, next) => {
  try {
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
      'recurring',
      'done',
      'last_drawn',
      'deadline',
      'frequency',
      ...dayFields.flatMap((day) => [`can_draw_${day}`, `must_draw_${day}`]),
    ];

    const values = [
      id,
      data.title,
      Number(data.recurring ?? false),
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

    // Use transaction for database write
    db.transaction(() => {
      db.prepare(statement).run(...values);
    })();

    res.status(201).json({ id });
  } catch (error) {
    next(error);
  }
};

const updateTicket: AsyncRequestHandler = async (req, res, next) => {
  try {
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
    const updateStmt = db.prepare(
      `UPDATE ticket SET ${setClause} WHERE id = ?`
    );

    // Use transaction for the update
    db.transaction(() => {
      updateStmt.run(...updateKeys.map((k) => updates[k]), id);
    })();

    const updated = db
      .prepare('SELECT * FROM ticket WHERE id = ?')
      .get(id) as RawDbTicket;
    res.json(normalizeTicket(updated));
  } catch (error) {
    next(error);
  }
};

const deleteTicket: AsyncRequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM ticket WHERE id = ?').run(id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }
    res.json({ deleted: true });
  } catch (error) {
    next(error);
  }
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

const getTicketDraw: AsyncRequestHandler = async (_req, res, next) => {
  try {
    const today = getTodayDate();

    const draws = db
      .prepare(
        "SELECT * FROM ticket_draw WHERE DATE(datetime(created_at, 'localtime')) = ?"
      )
      .all(today) as RawDbDraw[];

    res.json(draws.map(normalizeDraw));
  } catch (error) {
    next(error);
  }
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
  const maxDrawCount = calculateDailyDrawCount(db);

  // First, prioritize tickets with deadline today or in the past
  const deadlineTickets = db
    .prepare(getDeadlineTicketsQuery(todayDay))
    .all(today) as RawDbTicket[];

  // Second, get must-draw tickets, respecting frequency and done status
  // Only respect frequency for tickets that were completed, not just drawn
  const mustDrawTickets = db
    .prepare(getMustDrawQuery(todayDay, true))
    .all(today, today) as RawDbTicket[];

  // Third, get approaching deadline tickets (within next 7 days)
  const approachingDeadlineTickets = db
    .prepare(getApproachingDeadlineQuery(todayDay))
    .all(today, today, today) as RawDbTicket[];

  // Finally, get eligible can-draw tickets without deadline constraints
  const canDrawTickets = db
    .prepare(getCanDrawQuery(todayDay, true))
    .all(today, today) as RawDbTicket[];

  // Filter out tickets that already have draws
  // Start with highest priority tickets first
  const selectedTickets: RawDbTicket[] = [];

  // Add tickets in order of priority until we fill up the available spots
  const addUniqueTickets = (tickets: RawDbTicket[]) => {
    for (const ticket of tickets) {
      if (
        !existingTicketIds.has(ticket.id) &&
        selectedTickets.length + existingTicketIds.size < maxDrawCount
      ) {
        selectedTickets.push(ticket);
      }
    }
  };

  // Add tickets in prioritized order
  addUniqueTickets(deadlineTickets);
  addUniqueTickets(mustDrawTickets);
  addUniqueTickets(approachingDeadlineTickets);
  addUniqueTickets(canDrawTickets);

  return selectedTickets;
}

function createDrawsForTickets(
  tickets: RawDbTicket[],
  existingTicketIds: Set<string>
): TicketDrawResult {
  const insertDraw = db.prepare(INSERT_TICKET_DRAW);
  const updateLastDrawn = db.prepare(
    "UPDATE ticket SET last_drawn = datetime('now', 'localtime') WHERE id = ?"
  );
  let addedDraws = 0;

  for (const ticket of tickets) {
    if (!existingTicketIds.has(ticket.id)) {
      const id = uuidv4();
      insertDraw.run(id, ticket.id);
      updateLastDrawn.run(ticket.id);
      existingTicketIds.add(ticket.id);
      addedDraws++;
    }
  }

  return {
    addedDraws,
    totalDraws: existingTicketIds.size,
  };
}

const createTicketDraw: AsyncRequestHandler = async (_req, res, next) => {
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

    // Use transaction for multiple database operations
    let result: TicketDrawResult = {
      addedDraws: 0,
      totalDraws: existingTicketIds.size,
    };

    db.transaction(() => {
      result = createDrawsForTickets(selectedTickets, existingTicketIds);
    })();

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
    next(error);
  }
};

const updateTicketDraw: AsyncRequestHandler = async (req, res, next) => {
  try {
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

    // Use transaction for the update
    db.transaction(() => {
      updateStmt.run(...coercedValues, id);

      // Only mark the parent ticket as done if the draw is marked as done (not skipped)
      if (updates.done === true) {
        const ticket = db
          .prepare('SELECT * FROM ticket WHERE id = ?')
          .get(existing.ticket_id) as RawDbTicket;

        // If the ticket is NOT recurring, mark it as done when its draw is marked as done
        if (!ticket.recurring) {
          db.prepare(
            "UPDATE ticket SET done = datetime('now', 'localtime') WHERE id = ?"
          ).run(existing.ticket_id);
        }
      }
    })();

    const updated = db
      .prepare('SELECT * FROM ticket_draw WHERE id = ?')
      .get(id) as RawDbDraw;
    res.json(normalizeDraw(updated));
  } catch (error) {
    next(error);
  }
};

const deleteAllDraws: AsyncRequestHandler = async (_req, res, next) => {
  try {
    const result = db.prepare('DELETE FROM ticket_draw').run();
    res.json({ deleted: true, count: result.changes });
  } catch (error) {
    next(error);
  }
};

// Health check endpoint that verifies database connectivity
app.get('/health', async (_req, res) => {
  try {
    // Simple query to check database connectivity
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      message: 'Database connection failed',
    });
  }
});

app.get('/tickets', getTickets);
app.get('/tickets/:id', validateIdParam, getTicketById);
app.post('/tickets', createTicket);
app.put('/tickets/:id', validateIdParam, updateTicket);
app.delete('/tickets/:id', validateIdParam, deleteTicket);
app.get('/ticket_draw', getTicketDraw);
app.post('/ticket_draw', createTicketDraw);
app.patch('/ticket_draw/:id', validateIdParam, updateTicketDraw);
app.delete('/ticket_draw', deleteAllDraws);

// Global error handler middleware
app.use((err: Error, _req: Request, res: Response) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    // Close database connection if needed
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    // Close database connection if needed
    process.exit(0);
  });
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  server.close(() => {
    console.log('HTTP server closed due to uncaught exception');
    process.exit(1);
  });
});
