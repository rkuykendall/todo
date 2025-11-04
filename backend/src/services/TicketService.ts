import type { Database } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { dayFields } from '@todo/shared';
import type { TicketDraw } from '../types/ticket_draw.ts';
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

export interface UpdateTicketDrawData {
  done?: boolean;
  skipped?: boolean;
}

/**
 * TicketService encapsulates all business logic for ticket management.
 * This class is designed to be testable by accepting database and time dependencies.
 */
export class TicketService {
  // SQL query constants
  private static readonly SELECT_DRAWS_BY_DATE =
    "SELECT * FROM ticket_draw WHERE DATE(datetime(created_at, 'localtime')) = ?";
  private static readonly SELECT_TICKET_IDS_BY_DATE =
    "SELECT ticket_id FROM ticket_draw WHERE DATE(datetime(created_at, 'localtime')) = ?";
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
    const raw = this.db.prepare('SELECT * FROM ticket').all() as RawDbTicket[];
    return raw.map(normalizeTicket);
  }

  /**
   * Get a ticket by ID
   */
  getTicketById(id: string) {
    const ticket = this.db
      .prepare('SELECT * FROM ticket WHERE id = ?')
      .get(id) as RawDbTicket | undefined;

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
    const existing = this.db
      .prepare('SELECT * FROM ticket WHERE id = ?')
      .get(id) as RawDbTicket | undefined;

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
          "SELECT * FROM ticket_draw WHERE ticket_id = ? AND DATE(datetime(created_at, 'localtime')) = DATE(?)"
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
      .prepare('SELECT * FROM ticket WHERE id = ?')
      .get(id) as RawDbTicket;

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
    const today = this.timeProvider.getTodayDate();
    const todayDate = today.split(' ')[0]; // Extract just the date part (YYYY-MM-DD)

    const draws = this.db
      .prepare(TicketService.SELECT_DRAWS_BY_DATE)
      .all(todayDate) as RawDbDraw[];

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
    const deadlineTickets = this.db
      .prepare(getDeadlineTicketsQuery(todayDay))
      .all(todayTimestamp) as RawDbTicket[];

    // Second, get must-draw tickets, respecting frequency and done status
    const mustDrawTickets = this.db
      .prepare(getMustDrawQuery(todayDay, true))
      .all(todayTimestamp, todayTimestamp) as RawDbTicket[];

    // Third, get approaching deadline tickets (within next 7 days)
    const approachingDeadlineTickets = this.db
      .prepare(getApproachingDeadlineQuery(todayDay))
      .all(todayTimestamp, todayTimestamp, todayTimestamp) as RawDbTicket[];

    // Finally, get eligible can-draw tickets without deadline constraints
    const canDrawTickets = this.db
      .prepare(getCanDrawQuery(todayDay, true))
      .all(todayTimestamp, todayTimestamp) as RawDbTicket[];

    // Filter out tickets that already have draws and build priority list
    const selectedTickets: RawDbTicket[] = [];

    const addUniqueTickets = (tickets: RawDbTicket[]) => {
      for (const ticket of tickets) {
        if (
          !existingTicketIds.has(ticket.id) &&
          selectedTickets.length + existingTicketIds.size < maxDrawCount
        ) {
          selectedTickets.push(ticket);
        }
      }
    };

    // Add tickets in prioritized order
    addUniqueTickets(deadlineTickets);
    addUniqueTickets(mustDrawTickets);
    addUniqueTickets(approachingDeadlineTickets);
    addUniqueTickets(canDrawTickets);

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
    const today = this.timeProvider.getTodayDate();
    const todayDate = today.split(' ')[0]; // Extract just the date part (YYYY-MM-DD)
    const todayDay = this.getTodayDayString();

    // Get existing draws
    const existingDraws = this.db
      .prepare(TicketService.SELECT_TICKET_IDS_BY_DATE)
      .all(todayDate) as Array<{ ticket_id: string }>;
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
      .prepare(TicketService.SELECT_DRAWS_BY_DATE)
      .all(today) as RawDbDraw[];

    return todaysDraws.map(this.normalizeDraw);
  }

  /**
   * Update a ticket draw by ID
   */
  updateTicketDraw(id: string, updates: UpdateTicketDrawData) {
    if (Object.keys(updates).length === 0) {
      throw new Error('No valid fields to update');
    }

    const existing = this.db
      .prepare('SELECT * FROM ticket_draw WHERE id = ?')
      .get(id) as RawDbDraw | undefined;

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
          .prepare('SELECT * FROM ticket WHERE id = ?')
          .get(existing.ticket_id) as RawDbTicket;

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
      .prepare('SELECT * FROM ticket_draw WHERE id = ?')
      .get(id) as RawDbDraw;

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
      .prepare(
        'SELECT * FROM ticket_draw WHERE ticket_id = ? ORDER BY created_at DESC'
      )
      .all(ticketId) as RawDbDraw[];

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
   * Normalize a raw database draw record
   */
  private normalizeDraw(draw: RawDbDraw): TicketDraw {
    return {
      ...draw,
      done: Boolean(draw.done),
      skipped: Boolean(draw.skipped),
    };
  }
}
