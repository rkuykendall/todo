import Database from 'better-sqlite3';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const dbPath = process.env.DATABASE_PATH || '/data/todo.db';
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 1000;
const QUERY_TIMEOUT_MS = 5000; // 5 second timeout for queries

// Ensure the directory exists
function ensureDbDirectoryExists(dbPath: string): void {
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    console.log(`Creating database directory: ${dbDir}`);
    fs.mkdirSync(dbDir, { recursive: true });
  }
}

// Initialize database with retry logic
function initializeDatabase(retries = MAX_RETRIES): Database.Database {
  try {
    ensureDbDirectoryExists(dbPath);
    console.log(`Connecting to database at: ${dbPath}`);

    const db = new Database(dbPath, {
      verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
      timeout: QUERY_TIMEOUT_MS, // Add timeout for database operations
    });

    // Configure database
    db.pragma('journal_mode = WAL'); // Write-Ahead Logging for better concurrency
    db.pragma('foreign_keys = ON');

    // Configure SQLite to use Central Time
    db.function('CURRENT_TIMESTAMP_CT', () => {
      return new Date().toLocaleString('en-US', {
        timeZone: 'America/Chicago',
      });
    });

    // Initialize schema
    createSchema(db);

    console.log('Database connection established successfully');
    return db;
  } catch (error) {
    if (retries > 0) {
      console.error(
        `Database connection failed, retrying... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`
      );
      console.error(error);

      // Wait before retrying
      const waitTime = RETRY_DELAY_MS * (MAX_RETRIES - retries + 1);
      console.log(`Waiting ${waitTime}ms before retry...`);

      // Using setTimeout in a synchronous way for simplicity
      const startWait = Date.now();
      while (Date.now() - startWait < waitTime) {
        // Busy wait
      }

      return initializeDatabase(retries - 1);
    }

    console.error('Could not connect to database after maximum retries');
    throw error;
  }
}

function createSchema(db: Database.Database): void {
  // Create ticket table
  db.exec(`
    CREATE TABLE IF NOT EXISTS ticket (
      id TEXT PRIMARY KEY,
      created_at DATETIME DEFAULT (CURRENT_TIMESTAMP_CT()),
      title TEXT NOT NULL,
      done_on_child_done BOOLEAN DEFAULT 1,
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

  // Create ticket_draw table
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

  // Create index for ticket_draw
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_ticket_draw_ticket_id ON ticket_draw(ticket_id);
  `);
}

// Initialize the database
const db = initializeDatabase();

export default db;
