/**
 * Frequency Test Suite - Database Integration
 *
 * This test suite validates the frequency-based draw logic for tickets.
 *
 * MIGRATION TO APPLICATION DATABASE ARCHITECTURE:
 * - Uses the same database schema as the main application (src/db/index.ts)
 * - Replicates the exact table structure, constraints, and indexes
 * - Uses the same SQL queries and logic patterns as the production code
 * - Maintains the same Central Time timezone configuration
 * - Follows the same transaction patterns and database setup procedures
 *
 * TEST DATABASE SETUP:
 * - Uses the shared createTestDatabase() function from src/db/utils.ts
 * - Ensures identical database configuration as production (WAL mode, foreign keys)
 * - Guarantees the same CURRENT_TIMESTAMP_CT() function for timezone handling
 * - Eliminates drift between test and production database setups
 *
 * SHARED QUERY INTEGRATION:
 * - Uses shared query functions from src/db/queries.ts
 * - getMustDrawQuery() and getCanDrawQuery() ensure identical SQL logic
 * - Single source of truth for all database queries
 * - Automatic synchronization between test and production queries
 *
 * KEY BENEFITS OF THIS APPROACH:
 * - Tests run against the exact same database structure as production
 * - Ensures compatibility between test and production environments
 * - Validates that database queries work correctly with the actual schema
 * - Provides confidence that frequency logic works in the real application
 * - Single source of truth for database configuration (no duplication)
 * - Guaranteed query consistency between application and tests
 *
 * INTEGRATION POINTS:
 * - Database schema matches src/db/index.ts exactly via shared utilities
 * - Query logic mirrors the main application's selectTicketsForDraw function
 * - Date/time handling uses the same timezone and formatting logic
 * - Boolean/numeric conversions match the production data transformation patterns
 */

import Database from 'better-sqlite3';
import MockDate from 'mockdate';
import { v4 as uuidv4 } from 'uuid';
import { formatDateISO, type Ticket } from '@todo/shared';
import type { TicketDraw } from '../../src/types/ticket_draw.ts';
import {
  createTestDatabase,
  denormalizeTicket,
  normalizeTicket,
  calculateDailyDrawCount,
  getTodayDate,
  getTodayTimestamp,
} from '../../src/db/utils.ts';
import { getMustDrawQuery, getCanDrawQuery } from '../../src/db/queries.ts';

// Import shared functions from main application
import { getTodayDayString } from '../../src/index.ts';

// Create an in-memory database for testing with the same setup as the application
let db: Database.Database;

/**
 * Get a timestamp in Central Time format that's compatible with the database
 * This matches the format used by the actual application
 */
function getTodayTimestampCT(): string {
  const now = new Date();

  // Convert to Central Time using the same logic as getTodayDate but with full timestamp
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const partsMap = Object.fromEntries(
      parts.map((part) => [part.type, part.value])
    );

    return `${partsMap.year}-${partsMap.month}-${partsMap.day} ${partsMap.hour}:${partsMap.minute}:${partsMap.second}`;
  } catch {
    // Fallback to manual Central Time calculation
    const centralOffset = now.getTimezoneOffset() + 6 * 60; // Assume CST (UTC-6)
    const centralTime = new Date(now.getTime() - centralOffset * 60000);

    const year = centralTime.getFullYear();
    const month = String(centralTime.getMonth() + 1).padStart(2, '0');
    const day = String(centralTime.getDate()).padStart(2, '0');
    const hour = String(centralTime.getHours()).padStart(2, '0');
    const minute = String(centralTime.getMinutes()).padStart(2, '0');
    const second = String(centralTime.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  }
}

// Set up schema for tests - using the same schema as the main application
beforeAll(() => {
  // Initialize test database with the same setup as the application
  db = createTestDatabase();
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
function createTestTicket(overrides = {}): Ticket {
  const ticketId = uuidv4();
  const defaults = {
    id: ticketId,
    title: 'Test Ticket',
    recurring: false,
    frequency: 7, // Weekly frequency
    done: null,
    created_at: new Date().toISOString(),
    last_drawn: null,
    deadline: null,
    can_draw_monday: true,
    must_draw_monday: false,
    can_draw_tuesday: true,
    must_draw_tuesday: false,
    can_draw_wednesday: true,
    must_draw_wednesday: false,
    can_draw_thursday: true,
    must_draw_thursday: false,
    can_draw_friday: true,
    must_draw_friday: false,
    can_draw_saturday: true,
    must_draw_saturday: false,
    can_draw_sunday: true,
    must_draw_sunday: false,
  };

  const ticketData = { ...defaults, ...overrides } as Ticket;

  // Use shared function to convert boolean values to numbers for SQLite
  const dbData = denormalizeTicket(ticketData);

  const columns = Object.keys(dbData);
  const placeholders = columns.map(() => '?').join(', ');

  db.prepare(
    `INSERT INTO ticket (${columns.join(', ')}) VALUES (${placeholders})`
  ).run(...Object.values(dbData));

  return ticketData;
}

// Optimized helper functions for common ticket patterns

/**
 * Create a historical data ticket (can't be drawn on any day)
 * Used for setting up completion rate data without affecting current draws
 */
function createHistoricalTicket(title?: string): Ticket {
  return createTestTicket({
    title: title || 'Historical Ticket',
    frequency: 7,
    must_draw_monday: false,
    can_draw_monday: false,
    must_draw_tuesday: false,
    can_draw_tuesday: false,
    must_draw_wednesday: false,
    can_draw_wednesday: false,
    must_draw_thursday: false,
    can_draw_thursday: false,
    must_draw_friday: false,
    can_draw_friday: false,
    must_draw_saturday: false,
    can_draw_saturday: false,
    must_draw_sunday: false,
    can_draw_sunday: false,
  });
}

/**
 * Create a must-draw ticket for a specific day
 */
function createMustDrawTicket(
  day: string,
  frequency = 7,
  title?: string
): Ticket {
  const overrides: any = {
    title: title || `Must Draw ${day.charAt(0).toUpperCase() + day.slice(1)}`,
    frequency,
    [`must_draw_${day}`]: true,
    [`can_draw_${day}`]: true,
  };

  // Set all other days to not must-draw but can-draw
  const dayFields = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ];
  dayFields.forEach((d) => {
    if (d !== day) {
      overrides[`must_draw_${d}`] = false;
      overrides[`can_draw_${d}`] = true;
    }
  });

  return createTestTicket(overrides);
}

/**
 * Create a normal ticket (can draw any day, no must-draw constraints)
 */
function createNormalTicket(frequency = 7, title?: string): Ticket {
  return createTestTicket({
    title: title || 'Normal Ticket',
    frequency,
    must_draw_monday: false,
    can_draw_monday: true,
    must_draw_tuesday: false,
    can_draw_tuesday: true,
    must_draw_wednesday: false,
    can_draw_wednesday: true,
    must_draw_thursday: false,
    can_draw_thursday: true,
    must_draw_friday: false,
    can_draw_friday: true,
    must_draw_saturday: false,
    can_draw_saturday: true,
    must_draw_sunday: false,
    can_draw_sunday: true,
  });
}

/**
 * Create a daily must-draw ticket (must draw every day)
 */
function createDailyMustDrawTicket(title?: string): Ticket {
  return createTestTicket({
    title: title || 'Daily Must Draw',
    frequency: 1,
    must_draw_monday: true,
    can_draw_monday: true,
    must_draw_tuesday: true,
    can_draw_tuesday: true,
    must_draw_wednesday: true,
    can_draw_wednesday: true,
    must_draw_thursday: true,
    can_draw_thursday: true,
    must_draw_friday: true,
    can_draw_friday: true,
    must_draw_saturday: true,
    can_draw_saturday: true,
    must_draw_sunday: true,
    can_draw_sunday: true,
  });
}

/**
 * Create a bi-daily must-draw ticket (Monday, Wednesday, Friday, Sunday)
 */
function createBiDailyMustDrawTicket(title?: string): Ticket {
  return createTestTicket({
    title: title || 'Bi-Daily Must Draw',
    frequency: 2,
    must_draw_monday: true,
    can_draw_monday: true,
    must_draw_tuesday: false,
    can_draw_tuesday: true,
    must_draw_wednesday: true,
    can_draw_wednesday: true,
    must_draw_thursday: false,
    can_draw_thursday: true,
    must_draw_friday: true,
    can_draw_friday: true,
    must_draw_saturday: false,
    can_draw_saturday: true,
    must_draw_sunday: true,
    can_draw_sunday: true,
  });
}

/**
 * Create a normal ticket with specific day restrictions
 */
function createRestrictedNormalTicket(
  dayConfig: Record<string, boolean>,
  frequency = 7,
  title?: string
): Ticket {
  const defaults = {
    must_draw_monday: false,
    can_draw_monday: true,
    must_draw_tuesday: false,
    can_draw_tuesday: true,
    must_draw_wednesday: false,
    can_draw_wednesday: true,
    must_draw_thursday: false,
    can_draw_thursday: true,
    must_draw_friday: false,
    can_draw_friday: true,
    must_draw_saturday: false,
    can_draw_saturday: true,
    must_draw_sunday: false,
    can_draw_sunday: true,
  };

  return createTestTicket({
    title: title || 'Restricted Normal Ticket',
    frequency,
    ...defaults,
    ...dayConfig,
  });
}

function createTicketDraw(
  ticketId: string,
  {
    done = false,
    skipped = false,
    date = null,
  }: { done?: boolean; skipped?: boolean; date?: string | null } = {}
): TicketDraw {
  const drawId = uuidv4();
  // Use the same timestamp logic as the actual application
  // If date is provided, use it; otherwise use database's localtime
  const createdAt =
    date ||
    (
      db.prepare("SELECT datetime('now', 'localtime') as timestamp").get() as {
        timestamp: string;
      }
    ).timestamp;

  db.prepare(
    `INSERT INTO ticket_draw (id, created_at, ticket_id, done, skipped) VALUES (?, ?, ?, ?, ?)`
  ).run(drawId, createdAt, ticketId, done ? 1 : 0, skipped ? 1 : 0);

  // Update last_drawn on the ticket (using the same pattern as the main application)
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

// Helper function to check if a specific ticket is eligible using shared query logic
function isTicketEligible(ticketId: string, todayDay: string): boolean {
  const today = getTodayDate(); // Use getTodayDate for consistency with the main application

  // Check if ticket appears in must-draw results
  const mustDrawTickets = db
    .prepare(getMustDrawQuery(todayDay, false))
    .all(today) as Ticket[];

  if (mustDrawTickets.some((t) => t.id === ticketId)) {
    return true;
  }

  // Check if ticket appears in can-draw results
  const canDrawTickets = db
    .prepare(getCanDrawQuery(todayDay, false))
    .all(today) as Ticket[];

  return canDrawTickets.some((t) => t.id === ticketId);
}

describe('Ticket frequency behavior', () => {
  test('ticket is eligible for draw if never drawn before', () => {
    // Arrange
    const ticket = createNormalTicket(7);

    // Act
    const isEligible = isTicketEligible(ticket.id, 'monday');

    // Assert
    expect(isEligible).toBe(true);
  });

  test('ticket is NOT eligible if recently drawn and completed', () => {
    // Arrange
    MockDate.set('2025-05-01');
    const startDate = getTodayDate();
    const ticket = createNormalTicket(7);
    // Update last_drawn to startDate
    db.prepare('UPDATE ticket SET last_drawn = ? WHERE id = ?').run(
      startDate,
      ticket.id
    );

    // Create a completed draw from 2 days ago (within frequency period)
    createTicketDraw(ticket.id, { done: true, date: startDate });

    // Set date to 2 days later
    MockDate.set('2025-05-03');

    // Act
    const isEligible = isTicketEligible(ticket.id, 'monday');

    // Assert - Should not be eligible since it was completed 2 days ago with 7-day frequency
    expect(isEligible).toBe(false);
  });

  test('ticket IS eligible if recently drawn but only skipped (not completed)', () => {
    // Arrange
    MockDate.set('2025-05-01');
    const startDate = getTodayDate();
    const ticket = createNormalTicket(7);
    // Update last_drawn to startDate
    db.prepare('UPDATE ticket SET last_drawn = ? WHERE id = ?').run(
      startDate,
      ticket.id
    );

    // Create a skipped draw from 2 days ago (within frequency period)
    createTicketDraw(ticket.id, {
      skipped: true,
      done: false,
      date: startDate,
    });

    // Set date to 2 days later
    MockDate.set('2025-05-03');

    // Act
    const isEligible = isTicketEligible(ticket.id, 'monday');

    // Assert - Should be eligible since it was only skipped, not completed
    expect(isEligible).toBe(true);
  });

  test('ticket IS eligible if drawn and completed outside frequency period', () => {
    // Arrange
    MockDate.set('2025-05-01');
    const startDate = getTodayDate();
    const ticket = createNormalTicket(7);
    // Update last_drawn to startDate
    db.prepare('UPDATE ticket SET last_drawn = ? WHERE id = ?').run(
      startDate,
      ticket.id
    );

    // Create a completed draw from 8 days ago (outside frequency period)
    createTicketDraw(ticket.id, { done: true, date: startDate });

    // Set date to 8 days later
    MockDate.set('2025-05-09');

    // Act
    const isEligible = isTicketEligible(ticket.id, 'monday');

    // Assert - Should be eligible since frequency period has passed
    expect(isEligible).toBe(true);
  });
});

// Additional tests for daily tickets that were in the manual test file
describe('Daily ticket frequency behavior', () => {
  test('daily ticket (frequency=1) completed yesterday should NOT be eligible today with fixed logic', () => {
    // Arrange
    MockDate.set('2025-05-08'); // Yesterday
    const startDate = getTodayDate();
    const ticket = createNormalTicket(1); // Daily frequency

    // Create a completed draw from yesterday
    createTicketDraw(ticket.id, { done: true, date: startDate });

    // Set date to today
    MockDate.set('2025-05-09'); // Today

    // Act - Test fixed logic (<=)
    const isEligible = isTicketEligible(ticket.id, 'monday');

    // Assert - Should NOT be eligible with fixed logic
    expect(isEligible).toBe(false);
  });

  test('daily ticket (frequency=1) completed 2 days ago IS eligible today', () => {
    // Arrange
    MockDate.set('2025-05-07'); // Two days ago
    const startDate = getTodayDate();
    const ticket = createNormalTicket(1); // Daily frequency

    // Create a completed draw from two days ago
    createTicketDraw(ticket.id, { done: true, date: startDate });

    // Set date to today
    MockDate.set('2025-05-09'); // Today

    // Act
    const isEligible = isTicketEligible(ticket.id, 'monday');

    // Assert - Should be eligible since frequency period (1 day) has passed
    expect(isEligible).toBe(true);
  });
});

// Wrapper around the main application's selectTicketsForDraw logic with fixed count for testing
function selectTicketsForDrawE2EFixed(
  todayDay: string,
  fixedCount: number = 5
): Ticket[] {
  const today = getTodayDate();

  // Get existing draws for today (using same pattern as main application)
  const existingDraws = db
    .prepare(
      "SELECT ticket_id FROM ticket_draw WHERE DATE(datetime(created_at, 'localtime')) = ?"
    )
    .all(today) as Array<{ ticket_id: string }>;
  const existingTicketIds = new Set(existingDraws.map((d) => d.ticket_id));

  // Use shared query functions to get tickets (same as main app but without deadline filters for testing)
  const todayTimestamp = getTodayTimestamp();

  const mustDrawTickets = db
    .prepare(getMustDrawQuery(todayDay, false))
    .all(todayTimestamp) as any[];

  const canDrawTickets = db
    .prepare(getCanDrawQuery(todayDay, false))
    .all(todayTimestamp) as any[];

  const selectedTickets: any[] = [];
  const selectedTicketIds = new Set<string>();

  // Add must-draw tickets first (same logic as main app)
  mustDrawTickets.forEach((ticket) => {
    if (
      !existingTicketIds.has(ticket.id) &&
      selectedTickets.length < fixedCount
    ) {
      selectedTickets.push(ticket);
      selectedTicketIds.add(ticket.id);
    }
  });

  // Fill remaining slots with can-draw tickets (same logic as main app)
  canDrawTickets.forEach((ticket) => {
    if (
      !existingTicketIds.has(ticket.id) &&
      !selectedTicketIds.has(ticket.id) &&
      selectedTickets.length < fixedCount
    ) {
      selectedTickets.push(ticket);
      selectedTicketIds.add(ticket.id);
    }
  });

  // Convert to normalized format for test compatibility
  return selectedTickets.map(normalizeTicket);
}

// Wrapper around the main application's selectTicketsForDraw function for testing
// Note: This uses the test database rather than the main app's database
function selectTicketsForDrawE2E(todayDay: string): Ticket[] {
  const today = getTodayDate();
  const todayTimestamp = getTodayTimestamp();
  const maxDrawCount = calculateDailyDrawCount(db);

  // Get existing draws for today (using same pattern as main application)
  const existingDraws = db
    .prepare(
      "SELECT ticket_id FROM ticket_draw WHERE DATE(datetime(created_at, 'localtime')) = ?"
    )
    .all(today) as Array<{ ticket_id: string }>;
  const existingTicketIds = new Set(existingDraws.map((d) => d.ticket_id));

  // Use shared query functions (same logic as main app but adapted for test database)
  const mustDrawTickets = db
    .prepare(getMustDrawQuery(todayDay, false))
    .all(todayTimestamp) as any[];

  const canDrawTickets = db
    .prepare(getCanDrawQuery(todayDay, false))
    .all(todayTimestamp) as any[];

  const selectedTickets: any[] = [];
  const selectedTicketIds = new Set<string>();

  // Add must-draw tickets first (same logic as main app)
  mustDrawTickets.forEach((ticket) => {
    if (
      !existingTicketIds.has(ticket.id) &&
      selectedTickets.length < maxDrawCount
    ) {
      selectedTickets.push(ticket);
      selectedTicketIds.add(ticket.id);
    }
  });

  // Fill remaining slots with can-draw tickets (same logic as main app)
  canDrawTickets.forEach((ticket) => {
    if (
      !existingTicketIds.has(ticket.id) &&
      !selectedTicketIds.has(ticket.id) &&
      selectedTickets.length < maxDrawCount
    ) {
      selectedTickets.push(ticket);
      selectedTicketIds.add(ticket.id);
    }
  });

  // Convert to normalized format for test compatibility
  return selectedTickets.map(normalizeTicket);
}

// Helper function to advance time by 23.5 hours
function advanceTime23_5Hours() {
  const currentDate = new Date();
  const newDate = new Date(currentDate.getTime() + 23.5 * 60 * 60 * 1000);
  MockDate.set(newDate);
}

// Helper function to create a draw and mark tickets as done
function performDraw(
  expectedMustDrawCount: number,
  expectedTotalDrawCount: number,
  fixedCount?: number
): Ticket[] {
  const todayDay = getTodayDayString();

  // Simulate the draw selection logic - use fixed count version if specified
  const selectedTickets = fixedCount
    ? selectTicketsForDrawE2EFixed(todayDay, fixedCount)
    : selectTicketsForDrawE2E(todayDay);

  // Verify the expected counts
  const mustDrawTickets = selectedTickets.filter((ticket) => {
    const dayField = `must_draw_${todayDay}` as keyof Ticket;
    return ticket[dayField] === true; // Normalized tickets use boolean
  });

  expect(mustDrawTickets.length).toBe(expectedMustDrawCount);
  expect(selectedTickets.length).toBe(expectedTotalDrawCount);

  // Don't create draws here - let the test decide how to mark them
  return selectedTickets;
}

// End-to-end test that covers all aspects of drawing
describe('End-to-end drawing behavior with 23.5 hour intervals', () => {
  test('comprehensive drawing behavior with 23.5 hour intervals', () => {
    // Clean slate
    MockDate.set('2025-05-12T08:00:00.000Z'); // Monday 8 AM

    // 1. Create must-draw tickets for Monday
    const mustDrawDaily = createMustDrawTicket('monday', 1, 'Must Draw Daily');
    // Set Tuesday as must-draw too for daily ticket
    db.prepare(
      'UPDATE ticket SET must_draw_tuesday = 1, can_draw_tuesday = 1 WHERE id = ?'
    ).run(mustDrawDaily.id);

    const mustDrawBiDaily = createMustDrawTicket(
      'monday',
      2,
      'Must Draw Bi-Daily'
    );

    // 2. Create 10 normal tickets for Monday
    for (let i = 0; i < 10; i++) {
      createNormalTicket(7, `Normal Ticket ${i + 1}`);
    }

    // 3. Perform first draw on Monday 8 AM
    const firstDraw = performDraw(2, 5, 5);

    // 4. Verify both must-draw tickets are included
    expect(firstDraw.some((t) => t.id === mustDrawDaily.id)).toBe(true);
    expect(firstDraw.some((t) => t.id === mustDrawBiDaily.id)).toBe(true);

    // Mark all as done
    firstDraw.forEach((ticket) => {
      createTicketDraw(ticket.id, { done: true, date: getTodayTimestamp() });
    });

    // 5. Advance by 23.5 hours
    advanceTime23_5Hours();

    // 6. Do a draw, expect 0 must-draw tickets due to frequency constraints
    const secondDraw = performDraw(0, 5, 5);

    // Neither should be eligible yet due to frequency constraints
    const secondMustDraw = secondDraw.find(
      (t) => t.id === mustDrawDaily.id || t.id === mustDrawBiDaily.id
    );
    expect(secondMustDraw).toBeUndefined();

    // 7. Advance by another 1.5 hours (total 25 hours) to exceed the 24-hour threshold
    MockDate.set('2025-05-13T09:00:00.000Z'); // Tuesday 9 AM

    // 8. Do a draw, expect 1 must-draw (only the frequency=1 should be eligible now)
    const thirdDraw = performDraw(1, 5, 5);

    // Only the daily ticket should be eligible now
    expect(thirdDraw.some((t) => t.id === mustDrawDaily.id)).toBe(true);
    expect(thirdDraw.some((t) => t.id === mustDrawBiDaily.id)).toBe(false);

    MockDate.reset();
  });

  test('frequency=1 ticket with draws exactly 23.5 hours apart', () => {
    // Set initial time to Monday 8 AM
    MockDate.set('2025-05-12T08:00:00.000Z');

    // Create a daily ticket
    const dailyTicket = createMustDrawTicket('monday', 1, 'Daily Ticket');
    // Set Tuesday as must-draw too for daily ticket
    db.prepare(
      'UPDATE ticket SET must_draw_tuesday = 1, can_draw_tuesday = 1 WHERE id = ?'
    ).run(dailyTicket.id);

    // Complete it
    createTicketDraw(dailyTicket.id, { done: true, date: getTodayTimestamp() });

    // Advance exactly 23.5 hours (less than 24 hours)
    advanceTime23_5Hours(); // Monday 8 AM -> Tuesday 7:30 AM

    // Check if the daily ticket is eligible
    const tuesdayEligible = isTicketEligible(dailyTicket.id, 'tuesday');
    expect(tuesdayEligible).toBe(false); // Should NOT be eligible

    MockDate.reset();
  });

  test('frequency=1 ticket eligibility with fractional day differences', () => {
    // Set time to Monday 8 AM Central Time (which is 2 PM UTC)
    MockDate.set('2025-05-12T14:00:00.000Z'); // Monday 8 AM Central = 2 PM UTC

    const ticket = createNormalTicket(1);
    const mondayTimestamp = getTodayTimestampCT();

    // Create a completed draw on Monday 8 AM Central Time
    createTicketDraw(ticket.id, { done: true, date: mondayTimestamp });

    // Test different time intervals from Monday 8 AM Central Time
    const testTimes = [
      { label: '23h', hours: 23, expectedEligible: false },
      { label: '23.5h', hours: 23.5, expectedEligible: false },
      { label: '24h', hours: 24, expectedEligible: false },
      { label: '25h', hours: 25, expectedEligible: true },
    ];

    testTimes.forEach(({ hours, expectedEligible }) => {
      // Start from Monday 8 AM Central Time (2 PM UTC) and add hours
      const newTime = new Date('2025-05-12T14:00:00.000Z');
      newTime.setHours(newTime.getHours() + hours);
      MockDate.set(newTime);

      const eligible = isTicketEligible(ticket.id, 'tuesday');
      expect(eligible).toBe(expectedEligible);
    });

    MockDate.reset();
  });

  test('UNDERSTAND THE LOGIC: frequency=1 ticket completed Monday 8AM and Tuesday morning scheduling', () => {
    // Set time to Monday 8 AM Central Time (which is 2 PM UTC)
    MockDate.set('2025-05-12T14:00:00.000Z'); // Monday 8 AM Central = 2 PM UTC

    const ticket = createNormalTicket(1);
    const mondayTimestamp = getTodayTimestampCT();

    // Create a completed draw on Monday 8 AM Central Time
    createTicketDraw(ticket.id, { done: true, date: mondayTimestamp });

    // Test specific Tuesday morning times (all in UTC, representing Central Time)
    const tuesdayTimes = [
      {
        time: '2025-05-13T06:00:00.000Z', // Tuesday midnight Central = 6 AM UTC
        label: 'Tuesday midnight Central (16 hours later)',
      },
      {
        time: '2025-05-13T13:30:00.000Z', // Tuesday 7:30 AM Central = 1:30 PM UTC
        label: 'Tuesday 7:30 AM Central (23.5 hours later)',
      },
      {
        time: '2025-05-13T14:00:00.000Z', // Tuesday 8:00 AM Central = 2 PM UTC
        label: 'Tuesday 8:00 AM Central (exactly 24 hours later)',
      },
    ];

    tuesdayTimes.forEach(({ time }) => {
      MockDate.set(time);
      const eligible = isTicketEligible(ticket.id, 'tuesday');
      expect(eligible).toBe(false); // All should be ineligible (within frequency period)
    });

    // Test Tuesday 9:00 AM Central (25 hours later) - should be eligible
    MockDate.set('2025-05-13T15:00:00.000Z'); // Tuesday 9 AM Central = 3 PM UTC
    const laterEligible = isTicketEligible(ticket.id, 'tuesday');
    expect(laterEligible).toBe(true); // Should be eligible

    MockDate.reset();
  });
});

describe('Dynamic draw count calculation', () => {
  test('should return 5 when no historical data exists', () => {
    // No draws exist, should default to 5
    const drawCount = calculateDailyDrawCount(db);
    expect(drawCount).toBe(5);
  });

  test('should return 5 when completion rate is 0%', () => {
    // Create 7 draws but none completed
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() - 3); // 3 days ago

    for (let i = 0; i < 7; i++) {
      const ticket = createNormalTicket();
      createTicketDraw(ticket.id, {
        done: false,
        date: formatDateISO(baseDate),
      });
    }

    const drawCount = calculateDailyDrawCount(db);
    expect(drawCount).toBe(5);
  });

  test('should return 10 when completion rate is 100%', () => {
    // Create 7 draws all completed
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() - 3); // 3 days ago

    for (let i = 0; i < 7; i++) {
      const ticket = createNormalTicket();
      createTicketDraw(ticket.id, {
        done: true,
        date: formatDateISO(baseDate),
      });
    }

    const drawCount = calculateDailyDrawCount(db);
    expect(drawCount).toBe(10);
  });

  test('should return 8 when 5 out of 10 tickets were completed (50% rate)', () => {
    // Create 4 completed + 3 incomplete = 57% completion rate should give us ~8
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() - 3); // 3 days ago

    // 4 completed draws
    for (let i = 0; i < 4; i++) {
      const ticket = createNormalTicket();
      createTicketDraw(ticket.id, {
        done: true,
        date: formatDateISO(baseDate),
      });
    }

    // 3 incomplete draws
    for (let i = 0; i < 3; i++) {
      const ticket = createNormalTicket();
      createTicketDraw(ticket.id, {
        done: false,
        date: formatDateISO(baseDate),
      });
    }

    const drawCount = calculateDailyDrawCount(db);
    expect(drawCount).toBe(8); // 4/7 ≈ 0.57, so 5 + (0.57 * 5) ≈ 8
  });

  test('USER HYPOTHESIS: completing 5 tickets should result in 6 tickets next day (if 5 tickets were drawn)', () => {
    // User thinks: if 5 tickets drawn and 5 completed = 100% rate = 10 next day
    // But that's not what they observed. Let's test what gives us 6.

    // 5 total draws with 5 completed = 100% completion rate = 10 tickets (not 6)
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() - 3);

    for (let i = 0; i < 5; i++) {
      const ticket = createNormalTicket();
      createTicketDraw(ticket.id, {
        done: true,
        date: formatDateISO(baseDate),
      });
    }

    const drawCount = calculateDailyDrawCount(db);
    expect(drawCount).toBe(10); // 100% completion rate
  });

  test('what completion rate gives us 6 tickets?', () => {
    // To get 6 tickets: 6 = 5 + (rate * 5), so rate = 0.2 (20%)
    // 20% = 1 completed out of 5 total

    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() - 3);

    // 1 completed
    const completedTicket = createNormalTicket();
    createTicketDraw(completedTicket.id, {
      done: true,
      date: formatDateISO(baseDate),
    });

    // 4 incomplete
    for (let i = 0; i < 4; i++) {
      const ticket = createNormalTicket();
      createTicketDraw(ticket.id, {
        done: false,
        date: formatDateISO(baseDate),
      });
    }

    const drawCount = calculateDailyDrawCount(db);
    expect(drawCount).toBe(6); // 1/5 = 20% completion rate
  });

  test('edge case: exactly 7 days ago data should be included', () => {
    // Create draw exactly 7 days ago
    const exactlySevenDaysAgo = new Date();
    exactlySevenDaysAgo.setDate(exactlySevenDaysAgo.getDate() - 7);

    const ticket = createNormalTicket();
    createTicketDraw(ticket.id, {
      done: true,
      date: formatDateISO(exactlySevenDaysAgo),
    });

    const drawCount = calculateDailyDrawCount(db);
    expect(drawCount).toBe(10); // Should be included, 100% rate
  });

  test('edge case: more than 7 days ago data should NOT be included', () => {
    // Create draw 8 days ago (should be excluded)
    const eightDaysAgo = new Date();
    eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

    const ticket = createNormalTicket();
    createTicketDraw(ticket.id, {
      done: true,
      date: formatDateISO(eightDaysAgo),
    });

    const drawCount = calculateDailyDrawCount(db);
    expect(drawCount).toBe(5); // Should be excluded, default to 5
  });

  test('realistic scenario: mixed completion rates over a week', () => {
    // Simulate a week of realistic usage
    const dates = [];
    for (let i = 1; i <= 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(formatDateISO(date));
    }

    // Day 1: 5 tickets, 3 completed (60%)
    for (let i = 0; i < 3; i++) {
      const ticket = createNormalTicket();
      createTicketDraw(ticket.id, { done: true, date: dates[0] });
    }
    for (let i = 0; i < 2; i++) {
      const ticket = createNormalTicket();
      createTicketDraw(ticket.id, { done: false, date: dates[0] });
    }

    // Day 2: 6 tickets, 2 completed (33%)
    for (let i = 0; i < 2; i++) {
      const ticket = createNormalTicket();
      createTicketDraw(ticket.id, { done: true, date: dates[1] });
    }
    for (let i = 0; i < 4; i++) {
      const ticket = createNormalTicket();
      createTicketDraw(ticket.id, { done: false, date: dates[1] });
    }

    // Day 3: 7 tickets, 7 completed (100%)
    for (let i = 0; i < 7; i++) {
      const ticket = createNormalTicket();
      createTicketDraw(ticket.id, { done: true, date: dates[2] });
    }

    // Total: 18 tickets, 12 completed = 67% completion rate
    // Expected: 5 + (0.67 * 5) = ~8 tickets
    const drawCount = calculateDailyDrawCount(db);
    expect(drawCount).toBe(8);
  });
});

describe('End-to-end draw count and frequency integration', () => {
  test('dynamic draw count affects ticket selection when must-draw tickets exceed limit', () => {
    MockDate.set('2025-05-12T08:00:00.000Z'); // Monday

    // Create historical data that will result in low draw count (6 tickets)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const baseDateISO = formatDateISO(threeDaysAgo);

    // 1 completed out of 5 total = 20% rate = 6 tickets
    const completedTicket = createNormalTicket();
    createTicketDraw(completedTicket.id, { done: true, date: baseDateISO });
    for (let i = 0; i < 4; i++) {
      const ticket = createNormalTicket();
      createTicketDraw(ticket.id, { done: false, date: baseDateISO });
    }

    // Create 8 must-draw tickets for Monday (more than the 6 we'll get)
    const mustDrawTickets = [];
    for (let i = 0; i < 8; i++) {
      const ticket = createMustDrawTicket('monday', 7, `Must Draw ${i + 1}`);
      mustDrawTickets.push(ticket);
    }

    // Create several normal tickets
    for (let i = 0; i < 10; i++) {
      createNormalTicket(7, `Normal ${i + 1}`);
    }

    // Perform draw using dynamic count
    const selectedTickets = selectTicketsForDrawE2E('monday');

    // Should get exactly 6 tickets, all must-draw (up to the limit)
    expect(selectedTickets.length).toBe(6);

    // All 6 should be must-draw tickets
    selectedTickets.forEach((ticket) => {
      expect(ticket.must_draw_monday).toBe(true); // Normalized tickets use boolean
    });

    MockDate.reset();
  });

  test('high completion rate increases draw count and includes more tickets', () => {
    MockDate.set('2025-05-12T08:00:00.000Z'); // Monday

    // Create historical data for high completion rate (80% = 9 tickets)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const baseDateISO = formatDateISO(threeDaysAgo);

    // 8 completed out of 10 total = 80% rate = 9 tickets
    for (let i = 0; i < 8; i++) {
      const ticket = createHistoricalTicket(`Historical Completed ${i + 1}`);
      createTicketDraw(ticket.id, { done: true, date: baseDateISO });
    }
    for (let i = 0; i < 2; i++) {
      const ticket = createHistoricalTicket(`Historical Incomplete ${i + 1}`);
      createTicketDraw(ticket.id, { done: false, date: baseDateISO });
    }

    // Create 3 must-draw tickets
    for (let i = 0; i < 3; i++) {
      createMustDrawTicket('monday', 7, `Must Draw ${i + 1}`);
    }

    // Create 10 normal tickets
    for (let i = 0; i < 10; i++) {
      createNormalTicket(7, `Normal ${i + 1}`);
    }

    // Perform draw using dynamic count
    const selectedTickets = selectTicketsForDrawE2E('monday');

    // Should get 9 tickets (3 must-draw + 6 can-draw)
    expect(selectedTickets.length).toBe(9);

    // Count must-draw tickets
    const mustDrawCount = selectedTickets.filter(
      (t) => t.must_draw_monday === true // Normalized tickets use boolean
    ).length;
    expect(mustDrawCount).toBe(3);

    MockDate.reset();
  });

  test('frequency constraints affect ticket selection with dynamic draw count', () => {
    MockDate.set('2025-05-12T08:00:00.000Z'); // Monday 8 AM

    // Create historical data for medium completion rate (50% = 7-8 tickets)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const baseDateISO = formatDateISO(threeDaysAgo);

    // 3 completed out of 6 total = 50% rate = 7-8 tickets
    for (let i = 0; i < 3; i++) {
      const ticket = createHistoricalTicket(`Historical Completed ${i + 1}`);
      createTicketDraw(ticket.id, { done: true, date: baseDateISO });
    }
    for (let i = 0; i < 3; i++) {
      const ticket = createHistoricalTicket(`Historical Incomplete ${i + 1}`);
      createTicketDraw(ticket.id, { done: false, date: baseDateISO });
    }

    // Create tickets with different frequencies that were recently completed
    const dailyTicket = createMustDrawTicket('monday', 1, 'Daily Ticket');
    // Add other days for daily ticket
    [
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ].forEach((day) => {
      db.prepare(`UPDATE ticket SET can_draw_${day} = 1 WHERE id = ?`).run(
        dailyTicket.id
      );
    });

    const weeklyTicket = createMustDrawTicket('monday', 7, 'Weekly Ticket');

    // Complete daily ticket yesterday (should be excluded)
    // Complete weekly ticket 8 days ago (should be included)
    MockDate.set('2025-05-11T08:00:00.000Z'); // Sunday 8 AM
    const sundayTimestamp = getTodayTimestamp();
    createTicketDraw(dailyTicket.id, { done: true, date: sundayTimestamp });

    // Create weekly ticket draw 8 days ago (outside 7-day frequency)
    MockDate.set('2025-05-04T08:00:00.000Z'); // 8 days before Monday
    const eightDaysAgoTimestamp = getTodayTimestamp();
    createTicketDraw(weeklyTicket.id, {
      done: true,
      date: eightDaysAgoTimestamp,
    });

    // Back to Monday
    MockDate.set('2025-05-12T08:00:00.000Z'); // Monday 8 AM

    // Create normal tickets to fill out the draw
    for (let i = 0; i < 10; i++) {
      createRestrictedNormalTicket(
        {
          can_draw_tuesday: false,
          must_draw_thursday: true,
          can_draw_thursday: true,
          must_draw_saturday: true,
          can_draw_saturday: true,
          can_draw_sunday: false,
        },
        7,
        `Normal ${i + 1}`
      );
    }

    // Perform draw
    const selectedTickets = selectTicketsForDrawE2E('monday');

    // The daily ticket should NOT be included due to frequency constraint (24 hours not passed)
    expect(selectedTickets.some((t) => t.id === dailyTicket.id)).toBe(false);

    // The weekly ticket should be included (frequency allows)
    expect(selectedTickets.some((t) => t.id === weeklyTicket.id)).toBe(true);
  });

  test('comprehensive frequency and draw count interaction over multiple days', () => {
    // Start on Monday
    MockDate.set('2025-05-12T08:00:00.000Z'); // Monday 8 AM

    // Create some tickets with different frequencies
    const dailyMustDraw = createDailyMustDrawTicket('Daily Must Draw');

    const biDailyMustDraw = createBiDailyMustDrawTicket('Bi-Daily Must Draw');

    // Create normal tickets
    for (let i = 0; i < 15; i++) {
      createRestrictedNormalTicket(
        {
          must_draw_thursday: true,
          can_draw_thursday: true,
          must_draw_saturday: true,
          can_draw_saturday: true,
          can_draw_sunday: false,
        },
        7,
        `Normal ${i + 1}`
      );
    }

    // === MONDAY ===
    let selectedTickets = selectTicketsForDrawE2E('monday');

    // Should include both must-draw tickets
    expect(selectedTickets.some((t) => t.id === dailyMustDraw.id)).toBe(true);
    expect(selectedTickets.some((t) => t.id === biDailyMustDraw.id)).toBe(true);

    // Complete some tickets to affect next day's draw count
    selectedTickets.slice(0, 3).forEach((ticket) => {
      createTicketDraw(ticket.id, { done: true, date: getTodayTimestamp() });
    });
    selectedTickets.slice(3).forEach((ticket) => {
      createTicketDraw(ticket.id, { done: false, date: getTodayTimestamp() });
    });

    // === TUESDAY (25 hours later) ===
    MockDate.set('2025-05-13T09:00:00.000Z'); // Tuesday 9 AM

    selectedTickets = selectTicketsForDrawE2E('tuesday');

    // Daily must-draw should be eligible again (>24 hours)
    expect(selectedTickets.some((t) => t.id === dailyMustDraw.id)).toBe(true);

    // Bi-daily should NOT be eligible (frequency=2, only 1 day passed)
    expect(selectedTickets.some((t) => t.id === biDailyMustDraw.id)).toBe(
      false
    );

    // Complete more tickets
    selectedTickets.slice(0, 4).forEach((ticket) => {
      createTicketDraw(ticket.id, { done: true, date: getTodayTimestamp() });
    });
    selectedTickets.slice(4).forEach((ticket) => {
      createTicketDraw(ticket.id, { done: false, date: getTodayTimestamp() });
    });

    // === WEDNESDAY (48+ hours from Monday) ===
    MockDate.set('2025-05-14T10:00:00.000Z'); // Wednesday 10 AM (25 hours after Tuesday completion)

    selectedTickets = selectTicketsForDrawE2E('wednesday');

    // Both should be eligible now
    expect(selectedTickets.some((t) => t.id === dailyMustDraw.id)).toBe(true);
    expect(selectedTickets.some((t) => t.id === biDailyMustDraw.id)).toBe(true);

    MockDate.reset();
  });

  test('edge case: exactly at frequency boundary with dynamic draw count', () => {
    // Set time to Monday 8 AM Central Time (which is 2 PM UTC)
    MockDate.set('2025-05-12T14:00:00.000Z'); // Monday 8 AM Central = 2 PM UTC

    // Set up historical data for specific draw count
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const baseDateISO = formatDateISO(threeDaysAgo);

    // Create exactly 6 draws with 3 completed (50% = 7-8 tickets)
    for (let i = 0; i < 3; i++) {
      const ticket = createNormalTicket();
      createTicketDraw(ticket.id, { done: true, date: baseDateISO });
    }
    for (let i = 0; i < 3; i++) {
      const ticket = createNormalTicket();
      createTicketDraw(ticket.id, { done: false, date: baseDateISO });
    }

    // Create a frequency=2 ticket
    const biDailyTicket = createTestTicket({
      title: 'Bi-Daily Ticket',
      frequency: 2,
      must_draw_monday: true,
      can_draw_monday: true,
      must_draw_tuesday: false,
      can_draw_tuesday: true,
      must_draw_wednesday: false,
      can_draw_wednesday: true,
      must_draw_thursday: false,
      can_draw_thursday: true,
      must_draw_friday: false,
      can_draw_friday: true,
      must_draw_saturday: false,
      can_draw_saturday: true,
      must_draw_sunday: true,
      can_draw_sunday: true,
    });

    // Complete it exactly 2 days ago (at the frequency boundary)
    // Saturday 8 AM Central = Saturday 2 PM UTC
    MockDate.set('2025-05-10T14:00:00.000Z'); // Saturday 8 AM Central = 2 PM UTC
    createTicketDraw(biDailyTicket.id, {
      done: true,
      date: getTodayTimestampCT(), // Use Central Time consistently
    });

    // Back to Monday - exactly 2 days (48 hours) later
    // Monday 8 AM Central = Monday 2 PM UTC
    MockDate.set('2025-05-12T14:00:00.000Z'); // Monday 8 AM Central = 2 PM UTC

    // Create filler tickets
    for (let i = 0; i < 10; i++) {
      createRestrictedNormalTicket(
        {
          can_draw_tuesday: false,
          must_draw_wednesday: false,
          can_draw_wednesday: true,
          must_draw_thursday: false,
          can_draw_thursday: true,
          must_draw_friday: false,
          can_draw_friday: true,
          must_draw_saturday: false,
          can_draw_saturday: true,
          must_draw_sunday: false,
          can_draw_sunday: true,
        },
        7,
        `Filler ${i + 1}`
      );
    }

    // Check eligibility directly
    const eligible = isTicketEligible(biDailyTicket.id, 'monday');
    expect(eligible).toBe(false); // Should NOT be eligible (julianday diff = 2, frequency = 2, so 2 <= 2 is true)

    // Advance by 1 hour to exceed the boundary
    // Monday 9 AM Central = Monday 3 PM UTC
    MockDate.set('2025-05-12T15:00:00.000Z'); // Monday 9 AM Central = 3 PM UTC
    const eligibleLater = isTicketEligible(biDailyTicket.id, 'monday');
    expect(eligibleLater).toBe(true); // Should be eligible now

    MockDate.reset();
  });
});

afterEach(() => {
  MockDate.reset();
});
