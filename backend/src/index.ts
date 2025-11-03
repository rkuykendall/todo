import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import db from './db/index.ts';
import { NewTicketSchema, UpdateTicketSchema } from './types/ticket.ts';
import { PatchTicketDrawSchema } from './types/ticket_draw.ts';
import { TicketService } from './services/TicketService.ts';

// Initialize the ticket service with the database
const ticketService = new TicketService(db);

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

const getTickets: AsyncRequestHandler = async (_req, res, next) => {
  try {
    const tickets = ticketService.getAllTickets();
    res.json(tickets);
  } catch (error) {
    next(error);
  }
};

const getTicketById: AsyncRequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'ID parameter is required' });
      return;
    }

    const ticket = ticketService.getTicketById(id);
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }
    res.json(ticket);
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

    const id = ticketService.createTicket(result.data);
    res.status(201).json({ id });
  } catch (error) {
    next(error);
  }
};

const updateTicket: AsyncRequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'ID parameter is required' });
      return;
    }

    const result = UpdateTicketSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: result.error.flatten() });
      return;
    }

    const updated = ticketService.updateTicket(id, result.data);
    if (!updated) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    res.json(updated);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'No valid fields to update'
    ) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
};

const deleteTicket: AsyncRequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'ID parameter is required' });
      return;
    }

    const deleted = ticketService.deleteTicket(id);
    if (!deleted) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }
    res.json({ deleted: true });
  } catch (error) {
    next(error);
  }
};

const createTicketDraw: AsyncRequestHandler = async (_req, res, next) => {
  try {
    const draws = ticketService.createTicketDraws();
    res.status(201).json(draws);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Not enough eligible tickets')
    ) {
      res.status(400).json({
        error: error.message,
      });
      return;
    }
    next(error);
  }
};

const getTicketDraw: AsyncRequestHandler = async (_req, res, next) => {
  try {
    const draws = ticketService.getTodaysTicketDraws();
    res.json(draws);
  } catch (error) {
    next(error);
  }
};

const updateTicketDraw: AsyncRequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'ID parameter is required' });
      return;
    }

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

    const updated = ticketService.updateTicketDraw(id, updates);
    if (!updated) {
      res.status(404).json({ error: 'ticket_draw not found.' });
      return;
    }

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

const deleteAllDraws: AsyncRequestHandler = async (_req, res, next) => {
  try {
    const count = ticketService.deleteAllTicketDraws();
    res.json({ deleted: true, count });
  } catch (error) {
    next(error);
  }
};

// Health check endpoint that verifies database connectivity
app.get('/health', async (_req, res) => {
  try {
    const healthStatus = ticketService.checkDatabaseHealth();
    res.json(healthStatus);
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
