import Database from 'better-sqlite3';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { configureSQLiteDatabase, createApplicationSchema } from './utils.ts';

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

    // Use shared configuration and schema creation
    configureSQLiteDatabase(db);
    createApplicationSchema(db);

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

// Initialize the database
const db = initializeDatabase();

export default db;
