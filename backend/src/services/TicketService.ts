import type { Database } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
  dayFields,
  type Ticket,
  type TicketDraw,
  type UpdateTicketDrawInput,
  type DailyHistory,
} from '@todo/shared';
import {
  getMustDrawQuery,
  getCanDrawQuery,
  getDeadlineTicketsQuery,
  getApproachingDeadlineQuery,
} from '../db/queries.ts';
import {
  type RawDbTicket,
  type RawDbDraw,
  normalizeTicket,
  denormalizeTicket,
  calculateDailyDrawCount,
} from '../db/utils.ts';
import { type TimeProvider, SystemTimeProvider } from './TimeProvider.ts';

export interface TicketDrawResult {
  addedDraws: number;
  totalDraws: number;
}

export interface CreateTicketData {
  title: string;
  recurring?: boolean;
  done?: string | null;
  last_drawn?: string | null;
  deadline?: string | null;
  frequency?: number;
  [key: string]: unknown; // For day fields
}

export interface UpdateTicketData {
  [key: string]: unknown;
}

/**
 * TicketService encapsulates all business logic for ticket management.
 * This class is designed to be testable by accepting database and time dependencies.
 */
export class TicketService {
  // SQL query constants
  private static readonly SELECT_DRAWS_BY_DATE =
    'SELECT * FROM ticket_draw WHERE DATE(created_at) = ?';
  private static readonly SELECT_TICKET_IDS_BY_DATE =
    'SELECT ticket_id FROM ticket_draw WHERE DATE(created_at) = ?';
  private static readonly INSERT_TICKET_DRAW = `
    INSERT INTO ticket_draw (id, created_at, ticket_id, done, skipped)
    VALUES (?, ?, ?, 0, 0)
  `;

  private db: Database;
  private timeProvider: TimeProvider;

  constructor(db: Database, timeProvider?: TimeProvider) {
    this.db = db;
    this.timeProvider = timeProvider || new SystemTimeProvider();
  }

  /**
   * Get all tickets from the database
   */
  getAllTickets() {
    const raw = this.db.prepare<[], RawDbTicket>('SELECT * FROM ticket').all();
    return raw.map(normalizeTicket);
  }

  /**
   * Get a ticket by ID
   */
  getTicketById(id: string): Ticket | null {
    const ticket: RawDbTicket | undefined = this.db
      .prepare<string, RawDbTicket>('SELECT * FROM ticket WHERE id = ?')
      .get(id);

    if (!ticket) {
      return null;
    }

    return normalizeTicket(ticket);
  }

  /**
   * Create a new ticket
   */
  createTicket(data: CreateTicketData): string {
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
    this.db.transaction(() => {
      this.db.prepare(statement).run(...values);
    })();

    return id;
  }

  /**
   * Update a ticket by ID
   */
  updateTicket(id: string, updates: UpdateTicketData) {
    const existing: RawDbTicket | undefined = this.db
      .prepare<string, RawDbTicket>('SELECT * FROM ticket WHERE id = ?')
      .get(id);

    if (!existing) {
      return null;
    }

    const denormalizedUpdates = denormalizeTicket(updates);
    const updateKeys = Object.keys(denormalizedUpdates);

    if (updateKeys.length === 0) {
      throw new Error('No valid fields to update');
    }

    const setClause = updateKeys.map((key) => `${key} = ?`).join(', ');
    const updateStmt = this.db.prepare(
      `UPDATE ticket SET ${setClause} WHERE id = ?`
    );

    // Check if ticket is being marked as done and needs a ticket_draw
    const isBeingMarkedDone = denormalizedUpdates.done && !existing.done;
    let needsTicketDraw = false;

    if (isBeingMarkedDone) {
      // Check if there's already a ticket_draw for today for this ticket
      const today = this.timeProvider.getTodayDate();

      const existingDraw = this.db
        .prepare(
          'SELECT * FROM ticket_draw WHERE ticket_id = ? AND DATE(created_at) = DATE(?)'
        )
        .get(id, today);

      needsTicketDraw = !existingDraw;
    }

    // Use transaction for the update and potential ticket_draw creation
    this.db.transaction(() => {
      updateStmt.run(...updateKeys.map((k) => denormalizedUpdates[k]), id);

      if (needsTicketDraw) {
        // Create a completed ticket_draw for this ticket
        const drawId = uuidv4();
        const currentTimestamp = this.timeProvider.getCurrentTimestamp();
        const insertDraw = this.db.prepare(TicketService.INSERT_TICKET_DRAW);
        insertDraw.run(drawId, currentTimestamp, id);

        // Mark the draw as completed
        const updateDraw = this.db.prepare(
          'UPDATE ticket_draw SET done = 1 WHERE id = ?'
        );
        updateDraw.run(drawId);

        // Update last_drawn on the ticket
        const updateLastDrawn = this.db.prepare(
          'UPDATE ticket SET last_drawn = ? WHERE id = ?'
        );
        updateLastDrawn.run(currentTimestamp, id);
      }
    })();

    const updated = this.db
      .prepare<string, RawDbTicket>('SELECT * FROM ticket WHERE id = ?')
      .get(id);

    if (!updated) {
      throw new Error('Ticket not found after update');
    }

    return normalizeTicket(updated);
  }

  /**
   * Delete a ticket by ID
   */
  deleteTicket(id: string): boolean {
    const result = this.db.prepare('DELETE FROM ticket WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * Get all ticket draws for today
   */
  getTodaysTicketDraws() {
    const todayDate = this.timeProvider.getTodayDate();

    const draws = this.db
      .prepare<string, RawDbDraw>(TicketService.SELECT_DRAWS_BY_DATE)
      .all(todayDate);

    return draws.map(this.normalizeDraw);
  }

  /**
   * Get today's lowercase day name (e.g., "wednesday")
   */
  public getTodayDayString(): string {
    return this.timeProvider.getTodayDayString();
  }

  /**
   * Select tickets eligible for drawing based on business rules
   */
  public selectTicketsForDraw(
    todayDay: string,
    existingTicketIds: Set<string>
  ): RawDbTicket[] {
    const todayTimestamp = this.timeProvider.getCurrentTimestamp();
    const currentDate = new Date(this.timeProvider.getCurrentTimestamp());
    const maxDrawCount = calculateDailyDrawCount(this.db, currentDate);

    // First, prioritize tickets with deadline today or in the past
    const deadlineTickets: RawDbTicket[] = this.db
      .prepare<string, RawDbTicket>(getDeadlineTicketsQuery(todayDay))
      .all(todayTimestamp);

    // Second, get must-draw tickets, respecting frequency and done status
    const mustDrawTickets = this.db
      .prepare<string[], RawDbTicket>(getMustDrawQuery(todayDay, true))
      .all(todayTimestamp, todayTimestamp);

    // Third, get approaching deadline tickets (within next 7 days)
    const approachingDeadlineTickets: RawDbTicket[] = this.db
      .prepare<string[], RawDbTicket>(getApproachingDeadlineQuery(todayDay))
      .all(todayTimestamp, todayTimestamp, todayTimestamp);

    // Fourth, get eligible recurring can-draw tickets (prioritized over non-recurring)
    const recurringCanDrawTickets: RawDbTicket[] = this.db
      .prepare<string[], RawDbTicket>(getCanDrawQuery(todayDay, true, true))
      .all(todayTimestamp, todayTimestamp);

    // Finally, get eligible non-recurring can-draw tickets
    const nonRecurringCanDrawTickets: RawDbTicket[] = this.db
      .prepare<string[], RawDbTicket>(getCanDrawQuery(todayDay, true, false))
      .all(todayTimestamp, todayTimestamp);

    // Filter out tickets that already have draws and build priority list
    const selectedTickets: RawDbTicket[] = [];

    const addUniqueTickets = (
      tickets: RawDbTicket[],
      respectMaxCount: boolean = true
    ) => {
      for (const ticket of tickets) {
        const alreadyHasDraw = existingTicketIds.has(ticket.id);
        const wouldExceedMax =
          respectMaxCount &&
          selectedTickets.length + existingTicketIds.size >= maxDrawCount;

        if (!alreadyHasDraw && !wouldExceedMax) {
          selectedTickets.push(ticket);
        }
      }
    };

    // Add tickets in prioritized order
    // Deadline and must-draw tickets ignore max count - they MUST be drawn
    addUniqueTickets(deadlineTickets, false);
    addUniqueTickets(mustDrawTickets, false);
    // Approaching deadline, recurring can-draw, and non-recurring can-draw respect the max count
    addUniqueTickets(approachingDeadlineTickets, true);
    addUniqueTickets(recurringCanDrawTickets, true);
    addUniqueTickets(nonRecurringCanDrawTickets, true);

    return selectedTickets;
  }

  /**
   * Create ticket draws for selected tickets
   */
  private createDrawsForTickets(
    tickets: RawDbTicket[],
    existingTicketIds: Set<string>
  ): TicketDrawResult {
    const insertDraw = this.db.prepare(TicketService.INSERT_TICKET_DRAW);
    const updateLastDrawn = this.db.prepare(
      'UPDATE ticket SET last_drawn = ? WHERE id = ?'
    );
    let addedDraws = 0;

    for (const ticket of tickets) {
      if (!existingTicketIds.has(ticket.id)) {
        const id = uuidv4();
        const currentTimestamp = this.timeProvider.getCurrentTimestamp();
        insertDraw.run(id, currentTimestamp, ticket.id);
        updateLastDrawn.run(currentTimestamp, ticket.id);
        existingTicketIds.add(ticket.id);
        addedDraws++;
      }
    }

    return {
      addedDraws,
      totalDraws: existingTicketIds.size,
    };
  }

  /**
   * Create new ticket draws for today based on business logic
   */
  createTicketDraws() {
    const todayDate = this.timeProvider.getTodayDate();
    const todayDay = this.getTodayDayString();

    // Get existing draws
    const existingDraws = this.db
      .prepare<
        string,
        { ticket_id: string }
      >(TicketService.SELECT_TICKET_IDS_BY_DATE)
      .all(todayDate);

    const existingTicketIds = new Set(existingDraws.map((d) => d.ticket_id));

    // Select and create new draws
    const selectedTickets = this.selectTicketsForDraw(
      todayDay,
      existingTicketIds
    );

    // Use transaction for multiple database operations
    let result: TicketDrawResult = {
      addedDraws: 0,
      totalDraws: existingTicketIds.size,
    };

    this.db.transaction(() => {
      result = this.createDrawsForTickets(selectedTickets, existingTicketIds);
    })();

    if (result.addedDraws === 0 && result.totalDraws < 5) {
      throw new Error(
        `Not enough eligible tickets available for today. Current draws: ${result.totalDraws}`
      );
    }

    // Get all draws for today, including newly created ones
    const todaysDraws = this.db
      .prepare<string, RawDbDraw>(TicketService.SELECT_DRAWS_BY_DATE)
      .all(todayDate);

    return todaysDraws.map(this.normalizeDraw);
  }

  /**
   * Update a ticket draw by ID
   */
  updateTicketDraw(id: string, updates: UpdateTicketDrawInput) {
    if (Object.keys(updates).length === 0) {
      throw new Error('No valid fields to update');
    }

    const existing = this.db
      .prepare<string, RawDbDraw>('SELECT * FROM ticket_draw WHERE id = ?')
      .get(id);

    if (!existing) {
      return null;
    }

    const setClause = Object.keys(updates)
      .map((key) => `${key} = ?`)
      .join(', ');
    const updateStmt = this.db.prepare(
      `UPDATE ticket_draw SET ${setClause} WHERE id = ?`
    );
    const coercedValues = Object.values(updates).map((val) =>
      typeof val === 'boolean' ? Number(val) : val
    );

    // Use transaction for the update
    this.db.transaction(() => {
      updateStmt.run(...coercedValues, id);

      // Only mark the parent ticket as done if the draw is marked as done (not skipped)
      if (updates.done === true) {
        const ticket = this.db
          .prepare<string, RawDbTicket>('SELECT * FROM ticket WHERE id = ?')
          .get(existing.ticket_id);

        if (!ticket) {
          throw new Error('Parent ticket not found');
        }

        // If the ticket is NOT recurring, mark it as done when its draw is marked as done
        if (!ticket.recurring) {
          const currentTimestamp = this.timeProvider.getCurrentTimestamp();
          this.db
            .prepare('UPDATE ticket SET done = ? WHERE id = ?')
            .run(currentTimestamp, existing.ticket_id);
        }
      }
    })();

    const updated = this.db
      .prepare<string, RawDbDraw>('SELECT * FROM ticket_draw WHERE id = ?')
      .get(id);

    if (!updated) {
      throw new Error('Ticket draw not found after update');
    }

    return this.normalizeDraw(updated);
  }

  /**
   * Delete all ticket draws
   */
  deleteAllTicketDraws(): number {
    const result = this.db.prepare('DELETE FROM ticket_draw').run();
    return result.changes;
  }

  /**
   * Check database connectivity
   */
  checkDatabaseHealth(): boolean {
    try {
      this.db.prepare('SELECT 1').get();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a single ticket draw for a specific ticket
   * Useful for testing scenarios or manual draw creation
   */
  public createSingleTicketDraw(
    ticketId: string,
    options: { done?: boolean; skipped?: boolean; createdAt?: string } = {}
  ): string {
    const drawId = uuidv4();
    const createdAt =
      options.createdAt || this.timeProvider.getCurrentTimestamp();
    const done = options.done ? 1 : 0;
    const skipped = options.skipped ? 1 : 0;

    // Use transaction for the draw creation
    this.db.transaction(() => {
      // Insert the draw with explicit timestamp
      this.db
        .prepare(
          'INSERT INTO ticket_draw (id, created_at, ticket_id, done, skipped) VALUES (?, ?, ?, ?, ?)'
        )
        .run(drawId, createdAt, ticketId, done, skipped);

      // Update last_drawn on the ticket
      this.db
        .prepare('UPDATE ticket SET last_drawn = ? WHERE id = ?')
        .run(createdAt, ticketId);
    })();

    return drawId;
  }

  /**
   * Check if a specific ticket is eligible for drawing on a given day
   * Returns true if the ticket would be selected by selectTicketsForDraw
   */
  public isTicketEligibleForDay(ticketId: string, todayDay: string): boolean {
    const existingTicketIds = new Set<string>();
    const eligibleTickets = this.selectTicketsForDraw(
      todayDay,
      existingTicketIds
    );
    return eligibleTickets.some((ticket) => ticket.id === ticketId);
  }

  /**
   * Get all draws for a specific ticket
   */
  public getTicketDrawHistory(ticketId: string): TicketDraw[] {
    const draws = this.db
      .prepare<
        string,
        RawDbDraw
      >('SELECT * FROM ticket_draw WHERE ticket_id = ? ORDER BY created_at DESC')
      .all(ticketId);

    return draws.map(this.normalizeDraw);
  }

  /**
   * Calculate the dynamic daily draw count based on historical completion rates
   * This determines how many tickets to select for drawing each day
   */
  public calculateDailyDrawCount(): number {
    const currentDate = new Date(this.timeProvider.getCurrentTimestamp());
    return calculateDailyDrawCount(this.db, currentDate);
  }

  /**
   * Get daily completion history
   */
  public getDailyHistory(): DailyHistory[] {
    const limit = 32; // ~32px per day column fits typical content width
    // Use TimeProvider for consistent date calculation (works with mock times in tests)
    const todayDate = this.timeProvider.getTodayDate();

    // Get the most recent 32 days with draws, excluding today
    const query = `
      SELECT
        DATE(created_at) as date,
        COUNT(*) as totalDraws,
        SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) as completedDraws,
        SUM(CASE WHEN skipped = 1 THEN 1 ELSE 0 END) as skippedDraws
      FROM ticket_draw
      WHERE DATE(created_at) < ?
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT ?
    `;

    const rows = this.db
      .prepare<
        [string, number],
        {
          date: string;
          totalDraws: number;
          completedDraws: number;
          skippedDraws: number;
        }
      >(query)
      .all(todayDate, limit);

    return rows.map((row) => ({
      date: row.date,
      totalDraws: row.totalDraws,
      completedDraws: row.completedDraws,
      skippedDraws: row.skippedDraws,
    }));
  }

  /**
   * Normalize a raw database draw record
   */
  private normalizeDraw(draw: RawDbDraw): TicketDraw {
    return {
      id: draw.id,
      created_at: draw.created_at,
      ticket_id: draw.ticket_id,
      done: Boolean(draw.done),
      skipped: Boolean(draw.skipped),
    };
  }
}
