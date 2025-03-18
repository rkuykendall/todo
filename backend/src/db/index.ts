import Database from "better-sqlite3";

// const db = new Database("/Users/rkuykendall/docker/todo-db/todo.db");
const db = new Database("/data/todo.db");

// Create the tasks table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    completed BOOLEAN DEFAULT 0
  );
`);

export default db;
