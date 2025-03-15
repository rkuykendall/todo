import express from "express";
import cors from "cors";
import db from "./db/index";

const app = express();
app.use(cors());
app.use(express.json());

// Fetch all tasks
app.get("/tasks", (req, res) => {
  const tasks = db.prepare("SELECT * FROM tasks").all();
  res.json(tasks);
});

// Add a new task
app.post("/tasks", (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: "Title is required" });

  const insert = db.prepare("INSERT INTO tasks (title) VALUES (?)");
  const result = insert.run(title);
  res.json({ id: result.lastInsertRowid, title, completed: false });
});

// Toggle task completion
app.put("/tasks/:id", (req, res) => {
  const { id } = req.params;
  const { completed } = req.body;

  const update = db.prepare("UPDATE tasks SET completed = ? WHERE id = ?");
  update.run(completed ? 1 : 0, id);

  res.json({ id, completed });
});

// Delete a task
app.delete("/tasks/:id", (req, res) => {
  const { id } = req.params;
  const remove = db.prepare("DELETE FROM tasks WHERE id = ?");
  remove.run(id);
  res.json({ success: true });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
