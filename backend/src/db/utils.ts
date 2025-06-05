/**
 * Database Utilities
 *
 * Shared database utility functions that can be used by both the main application
 * and test suites to ensure consistency in database setup and operations.
 */

import Database from 'better-sqlite3';

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
