import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";

const db = new Database("../data/todo.db");

db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS ticket (
    id TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    title TEXT NOT NULL,
    done_on_child_done BOOLEAN DEFAULT 1,
    done DATETIME,
    last_drawn DATETIME,
    deadline DATETIME,

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

db.exec(`
  CREATE TABLE IF NOT EXISTS ticket_draw (
    id TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ticket_id TEXT NOT NULL,
    done BOOLEAN DEFAULT 0,
    made_progress BOOLEAN DEFAULT 0,
    skipped BOOLEAN DEFAULT 0,
    FOREIGN KEY (ticket_id) REFERENCES ticket(id) ON DELETE CASCADE
  );
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_ticket_draw_ticket_id ON ticket_draw(ticket_id);
`);

export default db;
