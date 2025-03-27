import express from "express";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import db from "./db/index";
import { NewTicketSchema, Ticket, UpdateTicketSchema } from "./types/ticket";
import { PatchTicketDrawSchema, TicketDraw } from "./types/ticket_draw";

const app = express();
app.use(cors());
app.use(express.json());

const dayFields = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"
];

function normalizeTicket(ticket: any) {
  const boolFields = [
    "done_on_child_done",
    "can_draw_monday", "must_draw_monday",
    "can_draw_tuesday", "must_draw_tuesday",
    "can_draw_wednesday", "must_draw_wednesday",
    "can_draw_thursday", "must_draw_thursday",
    "can_draw_friday", "must_draw_friday",
    "can_draw_saturday", "must_draw_saturday",
    "can_draw_sunday", "must_draw_sunday",
  ];

  const normalized = { ...ticket };
  for (const key of boolFields) {
    if (key in normalized) {
      normalized[key] = Boolean(normalized[key]);
    }
  }

  return normalized;
}

function denormalizeTicket(input: Record<string, any>): Record<string, any> {
  const boolFields = [
    "done_on_child_done",
    "can_draw_monday", "must_draw_monday",
    "can_draw_tuesday", "must_draw_tuesday",
    "can_draw_wednesday", "must_draw_wednesday",
    "can_draw_thursday", "must_draw_thursday",
    "can_draw_friday", "must_draw_friday",
    "can_draw_saturday", "must_draw_saturday",
    "can_draw_sunday", "must_draw_sunday",
  ];

  const denormalized = { ...input };
  for (const key of boolFields) {
    if (key in denormalized) {
      denormalized[key] = denormalized[key] ? 1 : 0;
    }
  }
  return denormalized;
}


app.get("/tickets", (_req, res) => {
  const raw = db.prepare("SELECT * FROM ticket").all();
  const normalized = raw.map(normalizeTicket);
  res.json(normalized);
});

app.get("/tickets/:id", (req, res) => {
  const ticket = db.prepare("SELECT * FROM ticket WHERE id = ?").get(req.params.id);
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  res.json(normalizeTicket(ticket));
});

app.post("/tickets", (req, res) => {
  const result = NewTicketSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten() });
  }

  const data = result.data;
  const id = uuidv4();

  const columns = [
    "id", "title", "done_on_child_done", "done", "last_drawn", "deadline",
    ...dayFields.flatMap(day => [`can_draw_${day}`, `must_draw_${day}`])
  ];

  const values = [
    id,
    data.title,
    Number(data.done_on_child_done ?? false),
    data.done ?? null,
    data.last_drawn ?? null,
    data.deadline ?? null,
    ...dayFields.flatMap(day => [
      Number(!!data[`can_draw_${day}` as keyof typeof data]),
      Number(!!data[`must_draw_${day}` as keyof typeof data]),
    ]),
  ];
  
  const placeholders = columns.map(() => "?").join(", ");
  const statement = `INSERT INTO ticket (${columns.join(", ")}) VALUES (${placeholders})`

  db.prepare(statement).run(...values);

  res.status(201).json({ id });
});

app.put("/tickets/:id", (req, res) => {
  const { id } = req.params;
  const existing: Ticket | undefined = db.prepare<unknown[], Ticket>("SELECT * FROM ticket WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Ticket not found" });

  const result = UpdateTicketSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten() });
  }

  const updates = denormalizeTicket(result.data);

  const updateKeys = Object.keys(updates);
  if (updateKeys.length === 0) {
    return res.status(400).json({ error: "No valid fields to update" });
  }

  const setClause = updateKeys.map(key => `${key} = ?`).join(", ");
  const updateStmt = db.prepare(`UPDATE ticket SET ${setClause} WHERE id = ?`);
  updateStmt.run(...updateKeys.map(k => updates[k]), id);

  const updated = db.prepare("SELECT * FROM ticket WHERE id = ?").get(id);
  res.json(normalizeTicket(updated));
});

app.delete("/tickets/:id", (req, res) => {
  const { id } = req.params;
  const result = db.prepare("DELETE FROM ticket WHERE id = ?").run(id);
  if (result.changes === 0) return res.status(404).json({ error: "Ticket not found" });
  res.json({ deleted: true });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


// Utility: Get today's lowercase day name (e.g., "wednesday")
function getTodayDayString(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
}

// Utility: Get ISO date string for YYYY-MM-DD (used for filtering)
function getTodayDate(): string {
  return new Date().toISOString().split("T")[0]!;
}

app.get("/ticket_draw", (_req, res) => {
  const today = getTodayDate();

  const draws = db.prepare(`
    SELECT * FROM ticket_draw
    WHERE DATE(created_at) = ?
  `).all(today);

  res.json(draws.map(normalizeTicket));
});

app.post("/ticket_draw", (_req, res) => {
  const today = getTodayDate();
  const todayDay = getTodayDayString(); // e.g. "wednesday"

  // Get tickets eligible for drawing today
  const eligibleTickets = db.prepare<unknown[], Ticket>(`
    SELECT * FROM ticket
    WHERE can_draw_${todayDay} = 1
  `).all();

  const existingDraws = db.prepare(`
    SELECT ticket_id FROM ticket_draw
    WHERE DATE(created_at) = ?
  `).all(today).map((d: any) => d.ticket_id);

  const insert = db.prepare(`
    INSERT INTO ticket_draw (id, created_at, ticket_id, done, made_progress, skipped)
    VALUES (?, CURRENT_TIMESTAMP, ?, 0, 0, 0)
  `);

  const drawsCreated = [];

  for (const ticket of eligibleTickets) {
    if (existingDraws.includes(ticket.id)) continue;

    const id = uuidv4();
    insert.run(id, ticket.id);
    drawsCreated.push({ id, ticket_id: ticket.id });
  }

  const todaysDraws = db.prepare(`
    SELECT * FROM ticket_draw
    WHERE DATE(created_at) = ?
  `).all(today);

  res.status(201).json(todaysDraws.map(normalizeTicket));
});

app.patch("/ticket_draw/:id", (req, res) => {
  const { id } = req.params;

  const parse = PatchTicketDrawSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.flatten() });
  }

  const updates = parse.data;
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No valid fields to update." });
  }

  const existing = db.prepare<unknown[], TicketDraw>("SELECT * FROM ticket_draw WHERE id = ?").get(id);
  if (!existing) {
    return res.status(404).json({ error: "ticket_draw not found." });
  }

  const setClause = Object.keys(updates).map(key => `${key} = ?`).join(", ");
  const updateStmt = db.prepare(`UPDATE ticket_draw SET ${setClause} WHERE id = ?`);
  const coercedValues = Object.values(updates).map(val =>
    typeof val === "boolean" ? Number(val) : val
  );
  updateStmt.run(...coercedValues, id);
  
  if (updates.done === true) {
    db.prepare(`
      UPDATE ticket SET last_drawn = CURRENT_TIMESTAMP WHERE id = ?
    `).run(existing.ticket_id);
  }

  const updated = db.prepare("SELECT * FROM ticket_draw WHERE id = ?").get(id);
  res.json(normalizeTicket(updated));
});
