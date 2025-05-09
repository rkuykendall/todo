import Database from 'better-sqlite3';
import MockDate from 'mockdate';
import { v4 as uuidv4 } from 'uuid';
import { formatDateISO } from '@todo/shared';

// Create an in-memory database for testing
const db = new Database(':memory:');

// Mock date functions that would be in your main code
function getTodayDate(): string {
  return formatDateISO(new Date());
}

// Set up schema for tests - simplified version of your actual schema
beforeAll(() => {
  // Create tables with only the necessary fields for these tests
  db.exec(`
    CREATE TABLE ticket (
      id TEXT PRIMARY KEY,
      created_at DATETIME DEFAULT (datetime('now')),
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
    
    CREATE TABLE ticket_draw (
      id TEXT PRIMARY KEY,
      created_at DATETIME DEFAULT (datetime('now')),
      ticket_id TEXT NOT NULL,
      done BOOLEAN DEFAULT 0,
      skipped BOOLEAN DEFAULT 0,
      FOREIGN KEY (ticket_id) REFERENCES ticket(id) ON DELETE CASCADE
    );
  `);
});

// Clean up after all tests
afterAll(() => {
  db.close();
});

// Reset database before each test
beforeEach(() => {
  db.exec('DELETE FROM ticket_draw');
  db.exec('DELETE FROM ticket');
});

// Test helper functions
function createTestTicket(overrides = {}) {
  const ticketId = uuidv4();
  const defaults = {
    id: ticketId,
    title: 'Test Ticket',
    recurring: 0,
    frequency: 7, // Weekly frequency
    done: null,
  };

  const ticketData = { ...defaults, ...overrides };
  const columns = Object.keys(ticketData);
  const placeholders = columns.map(() => '?').join(', ');

  db.prepare(
    `INSERT INTO ticket (${columns.join(', ')}) VALUES (${placeholders})`
  ).run(...Object.values(ticketData));

  return ticketData;
}

function createTicketDraw(
  ticketId: string,
  { done = 0, skipped = 0, date = null } = {}
) {
  const drawId = uuidv4();
  const createdAt = date || new Date().toISOString();

  db.prepare(
    `INSERT INTO ticket_draw (id, created_at, ticket_id, done, skipped) VALUES (?, ?, ?, ?, ?)`
  ).run(drawId, createdAt, ticketId, done, skipped);

  // Update last_drawn on the ticket
  db.prepare('UPDATE ticket SET last_drawn = ? WHERE id = ?').run(
    createdAt,
    ticketId
  );

  return {
    id: drawId,
    ticket_id: ticketId,
    done,
    skipped,
    created_at: createdAt,
  };
}

// Fixed version of the query (using <= operator)
function isTicketEligibleFixed(ticketId: string, today: string) {
  const query = `
    SELECT t.* FROM ticket t
    WHERE t.id = ?
    AND (
      t.last_drawn IS NULL
      OR (
        NOT EXISTS (
          SELECT 1 FROM ticket_draw td
          WHERE td.ticket_id = t.id
          AND td.done = 1
          AND julianday(?) - julianday(td.created_at) <= t.frequency
        )
      )
    )
  `;

  return db.prepare(query).get(ticketId, today);
}

// Original broken version of the query (using < operator)
function isTicketEligibleBroken(ticketId: string, today: string) {
  const query = `
    SELECT t.* FROM ticket t
    WHERE t.id = ?
    AND (
      t.last_drawn IS NULL
      OR (
        NOT EXISTS (
          SELECT 1 FROM ticket_draw td
          WHERE td.ticket_id = t.id
          AND td.done = 1
          AND julianday(?) - julianday(td.created_at) < t.frequency
        )
      )
    )
  `;

  return db.prepare(query).get(ticketId, today);
}

describe('Ticket frequency behavior', () => {
  test('ticket is eligible for draw if never drawn before', () => {
    // Arrange
    const ticket = createTestTicket({ frequency: 7 });
    const today = getTodayDate();

    // Act
    const eligibleTicket = isTicketEligibleFixed(ticket.id, today);

    // Assert
    expect(eligibleTicket).not.toBeUndefined();
    expect(eligibleTicket.id).toBe(ticket.id);
  });

  test('ticket is NOT eligible if recently drawn and completed', () => {
    // Arrange
    MockDate.set('2025-05-01');
    const startDate = getTodayDate();
    const ticket = createTestTicket({ frequency: 7, last_drawn: startDate });

    // Create a completed draw from 2 days ago (within frequency period)
    createTicketDraw(ticket.id, { done: 1, date: startDate });

    // Set date to 2 days later
    MockDate.set('2025-05-03');
    const today = getTodayDate();

    // Act
    const eligibleTicket = isTicketEligibleFixed(ticket.id, today);

    // Assert - Should not be eligible since it was completed 2 days ago with 7-day frequency
    expect(eligibleTicket).toBeUndefined();
  });

  test('ticket IS eligible if recently drawn but only skipped (not completed)', () => {
    // Arrange
    MockDate.set('2025-05-01');
    const startDate = getTodayDate();
    const ticket = createTestTicket({ frequency: 7, last_drawn: startDate });

    // Create a skipped draw from 2 days ago (within frequency period)
    createTicketDraw(ticket.id, { skipped: 1, done: 0, date: startDate });

    // Set date to 2 days later
    MockDate.set('2025-05-03');
    const today = getTodayDate();

    // Act
    const eligibleTicket = isTicketEligibleFixed(ticket.id, today);

    // Assert - Should be eligible since it was only skipped, not completed
    expect(eligibleTicket).not.toBeUndefined();
    expect(eligibleTicket.id).toBe(ticket.id);
  });

  test('ticket IS eligible if drawn and completed outside frequency period', () => {
    // Arrange
    MockDate.set('2025-05-01');
    const startDate = getTodayDate();
    const ticket = createTestTicket({ frequency: 7, last_drawn: startDate });

    // Create a completed draw from 8 days ago (outside frequency period)
    createTicketDraw(ticket.id, { done: 1, date: startDate });

    // Set date to 8 days later
    MockDate.set('2025-05-09');
    const today = getTodayDate();

    // Act
    const eligibleTicket = isTicketEligibleFixed(ticket.id, today);

    // Assert - Should be eligible since frequency period has passed
    expect(eligibleTicket).not.toBeUndefined();
    expect(eligibleTicket.id).toBe(ticket.id);
  });
});

// Additional tests for daily tickets that were in the manual test file
describe('Daily ticket frequency behavior', () => {
  test('daily ticket (frequency=1) completed yesterday should NOT be eligible today with fixed logic', () => {
    // Arrange
    MockDate.set('2025-05-08'); // Yesterday
    const startDate = getTodayDate();
    const ticket = createTestTicket({ frequency: 1 }); // Daily frequency

    // Create a completed draw from yesterday
    createTicketDraw(ticket.id, { done: 1, date: startDate });

    // Set date to today
    MockDate.set('2025-05-09'); // Today
    const today = getTodayDate();

    // Act - Test fixed logic (<=)
    const eligibleTicketFixed = isTicketEligibleFixed(ticket.id, today);

    // Assert - Should NOT be eligible with fixed logic
    expect(eligibleTicketFixed).toBeUndefined();
  });

  test('daily ticket (frequency=1) completed yesterday IS incorrectly eligible today with broken logic', () => {
    // Arrange
    MockDate.set('2025-05-08'); // Yesterday
    const startDate = getTodayDate();
    const ticket = createTestTicket({ frequency: 1 }); // Daily frequency

    // Create a completed draw from yesterday
    createTicketDraw(ticket.id, { done: 1, date: startDate });

    // Set date to today
    MockDate.set('2025-05-09'); // Today
    const today = getTodayDate();

    // Act - Test broken logic (<)
    const eligibleTicketBroken = isTicketEligibleBroken(ticket.id, today);

    // Assert - With broken logic, it would incorrectly be eligible
    expect(eligibleTicketBroken).not.toBeUndefined();
  });

  test('daily ticket (frequency=1) completed 2 days ago IS eligible today', () => {
    // Arrange
    MockDate.set('2025-05-07'); // Two days ago
    const startDate = getTodayDate();
    const ticket = createTestTicket({ frequency: 1 }); // Daily frequency

    // Create a completed draw from two days ago
    createTicketDraw(ticket.id, { done: 1, date: startDate });

    // Set date to today
    MockDate.set('2025-05-09'); // Today
    const today = getTodayDate();

    // Act
    const eligibleTicket = isTicketEligibleFixed(ticket.id, today);

    // Assert - Should be eligible since frequency period (1 day) has passed
    expect(eligibleTicket).not.toBeUndefined();
    expect(eligibleTicket.id).toBe(ticket.id);
  });
});
