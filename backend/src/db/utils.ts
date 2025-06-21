/**
 * Database Utilities
 *
 * Shared database utility functions that can be used by both the main application
 * and test suites to ensure consistency in database setup and operations.
 */

import Database from 'better-sqlite3';
import { dayFields, formatDateISO, type Day, type Ticket } from '@todo/shared';

/**
 * Configure a SQLite database with the standard settings used by the application
 */
export function configureSQLiteDatabase(db: Database.Database): void {
  // Configure database with the same settings as main application
  db.pragma('journal_mode = WAL'); // Write-Ahead Logging for better concurrency
  db.pragma('foreign_keys = ON');

  // Configure SQLite to use Central Time (same as main application)
  db.function('CURRENT_TIMESTAMP_CT', () => {
    return new Date().toLocaleString('en-US', {
      timeZone: 'America/Chicago',
    });
  });
}

/**
 * Create the application's database schema
 * This function contains the exact same schema creation logic as the main application
 */
export function createApplicationSchema(db: Database.Database): void {
  // Create ticket table (identical to main application)
  db.exec(`
    CREATE TABLE IF NOT EXISTS ticket (
      id TEXT PRIMARY KEY,
      created_at DATETIME DEFAULT (CURRENT_TIMESTAMP_CT()),
      title TEXT NOT NULL,
      recurring BOOLEAN DEFAULT 0,
      done DATETIME,
      last_drawn DATETIME,
      deadline DATETIME,
      frequency INTEGER DEFAULT 1,

      can_draw_monday BOOLEAN DEFAULT 1,
      must_draw_monday BOOLEAN DEFAULT 1,
      can_draw_tuesday BOOLEAN DEFAULT 1,
      must_draw_tuesday BOOLEAN DEFAULT 1,
      can_draw_wednesday BOOLEAN DEFAULT 1,
      must_draw_wednesday BOOLEAN DEFAULT 1,
      can_draw_thursday BOOLEAN DEFAULT 1,
      must_draw_thursday BOOLEAN DEFAULT 1,
      can_draw_friday BOOLEAN DEFAULT 1,
      must_draw_friday BOOLEAN DEFAULT 1,
      can_draw_saturday BOOLEAN DEFAULT 1,
      must_draw_saturday BOOLEAN DEFAULT 1,
      can_draw_sunday BOOLEAN DEFAULT 1,
      must_draw_sunday BOOLEAN DEFAULT 1
    );
  `);

  // Create ticket_draw table (identical to main application)
  db.exec(`
    CREATE TABLE IF NOT EXISTS ticket_draw (
      id TEXT PRIMARY KEY,
      created_at DATETIME DEFAULT (CURRENT_TIMESTAMP_CT()),
      ticket_id TEXT NOT NULL,
      done BOOLEAN DEFAULT 0,
      skipped BOOLEAN DEFAULT 0,
      FOREIGN KEY (ticket_id) REFERENCES ticket(id) ON DELETE CASCADE
    );
  `);

  // Create index for ticket_draw (identical to main application)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_ticket_draw_ticket_id ON ticket_draw(ticket_id);
  `);
}

/**
 * Create a properly configured in-memory test database
 * This ensures test databases use the exact same setup as the production database
 */
export function createTestDatabase(): Database.Database {
  const testDb = new Database(':memory:');

  // Apply the same configuration as production
  configureSQLiteDatabase(testDb);

  // Create the same schema as production
  createApplicationSchema(testDb);

  return testDb;
}

/**
 * Initialize a database with full application setup
 * This can be used by both production and test environments
 */
export function initializeDatabase(
  dbPath: string,
  verbose = false
): Database.Database {
  const db = new Database(dbPath, {
    verbose: verbose ? console.log : undefined,
    timeout: 5000, // 5 second timeout for queries
  });

  configureSQLiteDatabase(db);
  createApplicationSchema(db);

  return db;
}

/**
 * Raw database types with numbers instead of booleans
 */
export type RawDbTicket = {
  id: string;
  title: string;
  created_at: string;
  recurring: number;
  done: string | null;
  last_drawn: string | null;
  deadline: string | null;
  frequency: number;
} & Record<`can_draw_${Day}` | `must_draw_${Day}`, number>;

export interface RawDbDraw {
  id: string;
  created_at: string;
  ticket_id: string;
  done: number;
  skipped: number;
}

/**
 * Convert a raw database ticket (with numbers) to a normalized ticket (with booleans)
 */
export function normalizeTicket(ticket: RawDbTicket): Ticket {
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
    created_at: ticket.created_at,
    recurring: Boolean(ticket.recurring),
    done: ticket.done,
    last_drawn: ticket.last_drawn,
    deadline: ticket.deadline,
    frequency: ticket.frequency ?? 1,
    ...dayFieldValues,
  };
}

/**
 * Convert a normalized ticket (with booleans) to database format (with numbers)
 */
export function denormalizeTicket(
  input: Partial<Ticket>
): Record<string, unknown> {
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
  if ('recurring' in input) {
    result.recurring = Number(input.recurring);
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

/**
 * Calculate daily draw count based on completion rate in past week
 * Returns a value between 5-10: 5 if few tickets completed, 10 if many completed
 */
export function calculateDailyDrawCount(db: Database.Database): number {
  // Get one-week-ago date
  const today = new Date();
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(today.getDate() - 7);

  const todayISO = formatDateISO(today);
  const oneWeekAgoISO = formatDateISO(oneWeekAgo);

  // Count completed draws in the past week
  const completedDraws = db
    .prepare(
      `
    SELECT COUNT(*) as count 
    FROM ticket_draw 
    WHERE done = 1 
    AND datetime(created_at) BETWEEN datetime(?) AND datetime(?)
  `
    )
    .get(oneWeekAgoISO, todayISO) as { count: number };

  // Count total draws in the past week
  const totalDraws = db
    .prepare(
      `
    SELECT COUNT(*) as count 
    FROM ticket_draw 
    WHERE datetime(created_at) BETWEEN datetime(?) AND datetime(?)
  `
    )
    .get(oneWeekAgoISO, todayISO) as { count: number };

  // Calculate completion rate with better default handling
  let drawCount = 5; // Default minimum if no data

  if (totalDraws.count > 0) {
    // If we have data, calculate based on completion rate
    const completionRate = completedDraws.count / totalDraws.count;
    const minDrawCount = 5;
    const maxDrawCount = 10;
    drawCount = Math.round(
      minDrawCount + completionRate * (maxDrawCount - minDrawCount)
    );
  }

  return drawCount;
}

/**
 * Get today's date in ISO format (YYYY-MM-DD) using Central Time
 */
export function getTodayDate(): string {
  const now = new Date();

  // For MockDate compatibility, we need to use a more direct approach
  // Calculate Central Time by creating a date in Central timezone
  try {
    // This should work with MockDate
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    return formatter.format(now); // This returns YYYY-MM-DD format
  } catch {
    // Fallback to UTC-based calculation with manual Central Time offset
    // Central Time is typically UTC-6 (winter) or UTC-5 (summer)
    const centralOffset = now.getTimezoneOffset() + 6 * 60; // Assume CST (UTC-6)
    const centralTime = new Date(now.getTime() - centralOffset * 60000);

    const year = centralTime.getFullYear();
    const month = String(centralTime.getMonth() + 1).padStart(2, '0');
    const day = String(centralTime.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}

/**
 * Get today's timestamp for database queries
 */
export function getTodayTimestamp(): string {
  return new Date().toISOString();
}
