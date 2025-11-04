/**
 * TicketService Unit Test Suite
 *
 * This test suite validates the TicketService business logic in isolation using dependency injection.
 *
 * TESTING STRATEGY:
 * - Uses in-memory SQLite database for each test
 * - Tests service layer methods without HTTP concerns
 * - Complements comprehensive integration tests in frequency.test.ts
 *
 * COVERAGE ANALYSIS:
 *
 * ✅ FULLY TESTED VIA SERVICE LAYER:
 * - Basic CRUD operations (createTicket, getAllTickets, getTicketById, updateTicket, deleteTicket)
 * - Data validation and error handling (empty updates, non-existent records)
 * - Utility methods (checkDatabaseHealth, getTodayDayString)
 * - Business logic isolation from HTTP layer
 *
 * 🔄 COMPLEX BUSINESS LOGIC (Covered by Integration Tests):
 * - Draw creation algorithms (frequency constraints, priorities, deadlines)
 * - Ticket eligibility calculations (day-of-week rules, completion status)
 * - Dynamic draw count calculations based on historical performance
 * - Multi-ticket selection and prioritization algorithms
 *
 * ❌ NOT TESTABLE VIA SERVICE LAYER:
 * - HTTP status codes and response formatting
 * - Request parameter validation and parsing
 * - Express middleware behavior and routing
 * - Authentication and authorization flows
 *
 * This focused approach provides fast, reliable unit tests for core business logic
 * while leveraging comprehensive integration tests for complex algorithmic behavior.
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { TicketService, type CreateTicketData } from './TicketService.ts';
import { MockTimeProvider } from './TimeProvider.ts';
import { createTestDatabase } from '../db/utils.ts';

describe('TicketService Unit Tests', () => {
  let db: Database.Database;
  let mockTimeProvider: MockTimeProvider;
  let ticketService: TicketService;

  beforeEach(() => {
    // Create fresh database and service for each test
    db = createTestDatabase();
    // Set a default test time - Monday, May 12, 2025 at 8:00 AM Central
    mockTimeProvider = new MockTimeProvider(
      new Date('2025-05-12T14:00:00.000Z')
    );
    ticketService = new TicketService(db, mockTimeProvider);
  });

  afterEach(() => {
    db.close();
  });

  describe('Ticket CRUD Operations', () => {
    test('should create and retrieve a ticket', () => {
      const id = ticketService.createTicket({
        title: 'Test Ticket',
        recurring: false,
        frequency: 7,
        can_draw_monday: true,
        can_draw_tuesday: true,
        can_draw_wednesday: true,
        can_draw_thursday: true,
        can_draw_friday: true,
        can_draw_saturday: true,
        can_draw_sunday: true,
      });

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');

      const created = ticketService.getTicketById(id);
      expect(created).toBeDefined();
      expect(created?.title).toBe('Test Ticket');
      expect(created?.recurring).toBe(false);
      expect(created?.frequency).toBe(7);
    });

    test('should return null for non-existent ticket', () => {
      const fakeId = uuidv4();
      const ticket = ticketService.getTicketById(fakeId);
      expect(ticket).toBeNull();
    });

    test('should return empty array when no tickets exist', () => {
      const tickets = ticketService.getAllTickets();
      expect(tickets).toEqual([]);
    });

    test('should return all created tickets', () => {
      // Create multiple tickets
      const id1 = ticketService.createTicket({
        title: 'First Ticket',
        recurring: false,
        frequency: 7,
        can_draw_monday: true,
      });

      const id2 = ticketService.createTicket({
        title: 'Second Ticket',
        recurring: true,
        frequency: 1,
        deadline: '2025-06-01',
        can_draw_tuesday: true,
      });

      const tickets = ticketService.getAllTickets();

      expect(tickets).toHaveLength(2);
      expect(tickets.find((t) => t.id === id1)).toBeDefined();
      expect(tickets.find((t) => t.id === id2)).toBeDefined();

      // Verify data integrity
      const firstTicket = tickets.find((t) => t.id === id1);
      expect(firstTicket?.title).toBe('First Ticket');
      expect(firstTicket?.recurring).toBe(false);

      const secondTicket = tickets.find((t) => t.id === id2);
      expect(secondTicket?.title).toBe('Second Ticket');
      expect(secondTicket?.recurring).toBe(true);
      expect(secondTicket?.deadline).toBe('2025-06-01');
    });

    test('should update ticket properties', () => {
      const id = ticketService.createTicket({
        title: 'Original Title',
        recurring: false,
        frequency: 7,
        can_draw_monday: true,
      });

      const updated = ticketService.updateTicket(id, {
        title: 'Updated Title',
        recurring: true,
        frequency: 1,
      });

      expect(updated?.title).toBe('Updated Title');
      expect(updated?.recurring).toBe(true);
      expect(updated?.frequency).toBe(1);
      expect(updated?.id).toBe(id);
    });

    test('should return null when updating non-existent ticket', () => {
      const fakeId = uuidv4();
      const updated = ticketService.updateTicket(fakeId, {
        title: 'New Title',
      });

      expect(updated).toBeNull();
    });

    test('should throw error when updating with no fields', () => {
      const id = ticketService.createTicket({
        title: 'Test Ticket',
        recurring: false,
        frequency: 7,
        can_draw_monday: true,
      });

      expect(() => {
        ticketService.updateTicket(id, {});
      }).toThrow('No valid fields to update');
    });

    test('should update day-specific draw settings', () => {
      const id = ticketService.createTicket({
        title: 'Day Settings Test',
        recurring: false,
        frequency: 7,
        can_draw_monday: true,
        can_draw_tuesday: true,
      });

      const updated = ticketService.updateTicket(id, {
        must_draw_monday: true,
        can_draw_tuesday: false,
      });

      expect(updated?.must_draw_monday).toBe(true);
      expect(updated?.can_draw_tuesday).toBe(false);
    });

    test('should delete ticket successfully', () => {
      const id = ticketService.createTicket({
        title: 'To Delete',
        recurring: false,
        frequency: 7,
        can_draw_monday: true,
      });

      // Verify it exists
      expect(ticketService.getTicketById(id)).toBeDefined();

      // Delete it
      const deleted = ticketService.deleteTicket(id);
      expect(deleted).toBe(true);

      // Verify it's gone
      expect(ticketService.getTicketById(id)).toBeNull();
    });

    test('should return false when deleting non-existent ticket', () => {
      const fakeId = uuidv4();
      const deleted = ticketService.deleteTicket(fakeId);
      expect(deleted).toBe(false);
    });
  });

  describe('Draw Operations - Basic Interface', () => {
    test('should return empty array when no draws exist', () => {
      const draws = ticketService.getTodaysTicketDraws();
      expect(Array.isArray(draws)).toBe(true);
      expect(draws).toHaveLength(0);
    });

    test('should return number when deleting draws (even if none exist)', () => {
      const deleteCount = ticketService.deleteAllTicketDraws();
      expect(typeof deleteCount).toBe('number');
      expect(deleteCount).toBe(0); // No draws to delete initially
    });

    // Note: Complex draw creation logic is thoroughly tested in integration tests
    // These tests focus on the service interface and basic functionality
  });

  describe('Utility Methods', () => {
    test('should check database health', () => {
      const health = ticketService.checkDatabaseHealth();
      expect(health).toBe(true);
    });

    test('should return correct day string for different dates', () => {
      const testDates = [
        { date: '2025-05-12T08:00:00.000Z', expected: 'monday' },
        { date: '2025-05-13T08:00:00.000Z', expected: 'tuesday' },
        { date: '2025-05-14T08:00:00.000Z', expected: 'wednesday' },
        { date: '2025-05-15T08:00:00.000Z', expected: 'thursday' },
        { date: '2025-05-16T08:00:00.000Z', expected: 'friday' },
        { date: '2025-05-17T08:00:00.000Z', expected: 'saturday' },
        { date: '2025-05-18T08:00:00.000Z', expected: 'sunday' },
      ];

      testDates.forEach(({ date, expected }) => {
        mockTimeProvider.setMockTime(new Date(date));
        const dayString = ticketService.getTodayDayString();
        expect(dayString).toBe(expected);
      });
    });
  });

  describe('Data Handling', () => {
    test('should handle undefined draw settings as false (default behavior)', () => {
      // This test documents that undefined draw settings are coerced to false
      const id = ticketService.createTicket({
        title: 'Minimal Data Test',
        can_draw_monday: true,
        // All other draw settings omitted - should default to false
      });
      const created = ticketService.getTicketById(id);

      expect(created).toBeDefined();
      expect(created?.can_draw_monday).toBe(true);
      expect(created?.must_draw_monday).toBe(false); // undefined → false
      expect(created?.can_draw_tuesday).toBe(false); // undefined → false
      expect(created?.must_draw_tuesday).toBe(false); // undefined → false
      expect(created?.can_draw_wednesday).toBe(false); // undefined → false
      expect(created?.must_draw_wednesday).toBe(false); // undefined → false
      expect(created?.can_draw_thursday).toBe(false); // undefined → false
      expect(created?.must_draw_thursday).toBe(false); // undefined → false
      expect(created?.can_draw_friday).toBe(false); // undefined → false
      expect(created?.must_draw_friday).toBe(false); // undefined → false
      expect(created?.can_draw_saturday).toBe(false); // undefined → false
      expect(created?.must_draw_saturday).toBe(false); // undefined → false
      expect(created?.can_draw_sunday).toBe(false); // undefined → false
      expect(created?.must_draw_sunday).toBe(false); // undefined → false

      // Other optional fields should also have sensible defaults
      expect(created?.recurring).toBe(false); // undefined → false
      expect(created?.frequency).toBe(1); // undefined → 1 (default)
      expect(created?.deadline).toBeNull(); // undefined → null
    });
  });

  describe('Ticket Eligibility Logic', () => {
    test('should return empty array when no eligible tickets exist', () => {
      const existingTicketIds = new Set<string>();
      const eligibleTickets = ticketService.selectTicketsForDraw(
        'monday',
        existingTicketIds
      );

      expect(eligibleTickets).toEqual([]);
    });

    test('should select never-drawn ticket as eligible', () => {
      const ticketId = ticketService.createTicket({
        title: 'Never Drawn Ticket',
        recurring: false,
        frequency: 7,
        can_draw_monday: true,
      });

      const existingTicketIds = new Set<string>();
      const eligibleTickets = ticketService.selectTicketsForDraw(
        'monday',
        existingTicketIds
      );

      expect(eligibleTickets).toHaveLength(1);
      expect(eligibleTickets[0]?.id).toBe(ticketId);
    });

    test('should prioritize must-draw tickets over can-draw tickets', () => {
      // Create a can-draw ticket
      const canDrawId = ticketService.createTicket({
        title: 'Can Draw Ticket',
        recurring: false,
        frequency: 7,
        can_draw_monday: true,
        must_draw_monday: false,
      });

      // Create a must-draw ticket
      const mustDrawId = ticketService.createTicket({
        title: 'Must Draw Ticket',
        recurring: false,
        frequency: 7,
        can_draw_monday: true,
        must_draw_monday: true,
      });

      const existingTicketIds = new Set<string>();
      const eligibleTickets = ticketService.selectTicketsForDraw(
        'monday',
        existingTicketIds
      );

      expect(eligibleTickets).toHaveLength(2);
      // Must-draw ticket should come first due to prioritization logic
      expect(eligibleTickets[0]?.id).toBe(mustDrawId);
      expect(eligibleTickets[1]?.id).toBe(canDrawId);
    });

    test('should exclude tickets not eligible for specified day', () => {
      // Create ticket that can only be drawn on Tuesday
      const ticketId = ticketService.createTicket({
        title: 'Tuesday Only Ticket',
        recurring: false,
        frequency: 7,
        can_draw_monday: false,
        can_draw_tuesday: true,
      });

      const existingTicketIds = new Set<string>();

      // Should not be eligible on Monday
      const mondayEligible = ticketService.selectTicketsForDraw(
        'monday',
        existingTicketIds
      );
      expect(mondayEligible).toHaveLength(0);

      // Should be eligible on Tuesday
      const tuesdayEligible = ticketService.selectTicketsForDraw(
        'tuesday',
        existingTicketIds
      );
      expect(tuesdayEligible).toHaveLength(1);
      expect(tuesdayEligible[0]?.id).toBe(ticketId);
    });

    test('should exclude completed (done) tickets', () => {
      const ticketId = ticketService.createTicket({
        title: 'Will Be Completed',
        recurring: false,
        frequency: 7,
        can_draw_monday: true,
      });

      // Initially should be eligible
      const existingTicketIds = new Set<string>();
      let eligibleTickets = ticketService.selectTicketsForDraw(
        'monday',
        existingTicketIds
      );
      expect(eligibleTickets).toHaveLength(1);

      // Mark as done
      ticketService.updateTicket(ticketId, {
        done: new Date().toISOString(),
      });

      // Should no longer be eligible
      eligibleTickets = ticketService.selectTicketsForDraw(
        'monday',
        existingTicketIds
      );
      expect(eligibleTickets).toHaveLength(0);
    });

    test('should exclude tickets that already have draws today', () => {
      const ticketId = ticketService.createTicket({
        title: 'Already Drawn Today',
        recurring: false,
        frequency: 7,
        can_draw_monday: true,
      });

      // Simulate that this ticket already has a draw today
      const existingTicketIds = new Set<string>([ticketId]);
      const eligibleTickets = ticketService.selectTicketsForDraw(
        'monday',
        existingTicketIds
      );

      expect(eligibleTickets).toHaveLength(0);
    });

    test('should respect daily draw count limit', () => {
      // Create more tickets than the daily limit (default is usually 5)
      const ticketIds: string[] = [];
      for (let i = 0; i < 10; i++) {
        const id = ticketService.createTicket({
          title: `Ticket ${i + 1}`,
          recurring: false,
          frequency: 7,
          can_draw_monday: true,
        });
        ticketIds.push(id);
      }

      const existingTicketIds = new Set<string>();
      const eligibleTickets = ticketService.selectTicketsForDraw(
        'monday',
        existingTicketIds
      );

      // Should respect the daily draw limit (5 by default when no historical data)
      expect(eligibleTickets.length).toBeLessThanOrEqual(5);

      // All returned tickets should be from our created tickets
      eligibleTickets.forEach((ticket) => {
        expect(ticketIds).toContain(ticket.id);
      });
    });

    test('should handle mixed eligibility scenarios correctly', () => {
      // Create tickets with different eligibility scenarios
      const mustDrawMondayId = ticketService.createTicket({
        title: 'Must Draw Monday',
        recurring: false,
        frequency: 7,
        can_draw_monday: true,
        must_draw_monday: true,
        can_draw_tuesday: false,
      });

      const canDrawMondayId = ticketService.createTicket({
        title: 'Can Draw Monday',
        recurring: false,
        frequency: 7,
        can_draw_monday: true,
        must_draw_monday: false,
      });

      const tuesdayOnlyId = ticketService.createTicket({
        title: 'Tuesday Only',
        recurring: false,
        frequency: 7,
        can_draw_monday: false,
        can_draw_tuesday: true,
      });

      const completedId = ticketService.createTicket({
        title: 'Completed',
        recurring: false,
        frequency: 7,
        can_draw_monday: true,
        done: new Date().toISOString(),
      });

      const existingTicketIds = new Set<string>();
      const mondayEligible = ticketService.selectTicketsForDraw(
        'monday',
        existingTicketIds
      );

      // Should include must-draw and can-draw Monday tickets
      expect(mondayEligible).toHaveLength(2);

      const eligibleIds = mondayEligible.map((t) => t.id);
      expect(eligibleIds).toContain(mustDrawMondayId);
      expect(eligibleIds).toContain(canDrawMondayId);
      expect(eligibleIds).not.toContain(tuesdayOnlyId);
      expect(eligibleIds).not.toContain(completedId);
    });
  });

  describe('Frequency Constraint Testing', () => {
    test('should demonstrate basic frequency constraint behavior', () => {
      // Create a weekly frequency ticket (easier to test than daily)
      const ticketId = ticketService.createTicket({
        title: 'Weekly Ticket',
        frequency: 7,
        can_draw_monday: true,
        can_draw_tuesday: true,
      });

      // Initially should be eligible
      let eligibleTickets = ticketService.selectTicketsForDraw(
        'monday',
        new Set()
      );
      expect(eligibleTickets.some((t) => t.id === ticketId)).toBe(true);

      // Create a completed draw
      ticketService.createSingleTicketDraw(ticketId, { done: true });

      // Immediately after completion, should NOT be eligible
      eligibleTickets = ticketService.selectTicketsForDraw('monday', new Set());
      expect(eligibleTickets.some((t) => t.id === ticketId)).toBe(false);

      // Check draw history
      const drawHistory = ticketService.getTicketDrawHistory(ticketId);
      expect(drawHistory).toHaveLength(1);
      expect(drawHistory[0]?.done).toBe(true);
    });

    test('should validate helper methods work correctly', () => {
      const ticketId = ticketService.createTicket({
        title: 'Helper Test Ticket',
        frequency: 1,
        can_draw_wednesday: true,
        can_draw_thursday: false,
      });

      // Test isTicketEligibleForDay for allowed/disallowed days
      expect(ticketService.isTicketEligibleForDay(ticketId, 'wednesday')).toBe(
        true
      );
      expect(ticketService.isTicketEligibleForDay(ticketId, 'thursday')).toBe(
        false
      );

      // Test createSingleTicketDraw
      const drawId = ticketService.createSingleTicketDraw(ticketId, {
        done: false,
      });
      expect(typeof drawId).toBe('string'); // UUID string
      expect(drawId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );

      // Test getTicketDrawHistory
      let history = ticketService.getTicketDrawHistory(ticketId);
      expect(history).toHaveLength(1);
      expect(history[0]?.done).toBe(false);
      expect(history[0]?.ticket_id).toBe(ticketId);
      expect(history[0]?.id).toBe(drawId);

      // Create another draw with different properties
      const completedDrawId = ticketService.createSingleTicketDraw(ticketId, {
        done: true,
        skipped: false,
      });
      expect(completedDrawId).not.toBe(drawId);
      expect(typeof completedDrawId).toBe('string');

      history = ticketService.getTicketDrawHistory(ticketId);
      expect(history).toHaveLength(2);
      expect(history.some((d) => d.done === true)).toBe(true);
      expect(history.some((d) => d.done === false)).toBe(true);
    });

    test('should handle skipped vs completed draws differently', () => {
      // Create a weekly frequency ticket
      const ticketId = ticketService.createTicket({
        title: 'Skip vs Complete Test',
        frequency: 7,
        can_draw_monday: true,
        can_draw_wednesday: true,
      });

      // Initially eligible
      let eligibleTickets = ticketService.selectTicketsForDraw(
        'monday',
        new Set()
      );
      expect(eligibleTickets.some((t) => t.id === ticketId)).toBe(true);

      // Create a SKIPPED draw
      ticketService.createSingleTicketDraw(ticketId, {
        done: false,
        skipped: true,
      });

      // Should still be eligible because it was only skipped, not completed
      eligibleTickets = ticketService.selectTicketsForDraw(
        'wednesday',
        new Set()
      );
      expect(eligibleTickets.some((t) => t.id === ticketId)).toBe(true);

      // Now create a COMPLETED draw
      ticketService.createSingleTicketDraw(ticketId, { done: true });

      // Should NOT be eligible because it was completed within frequency period
      eligibleTickets = ticketService.selectTicketsForDraw(
        'wednesday',
        new Set()
      );
      expect(eligibleTickets.some((t) => t.id === ticketId)).toBe(false);
    });

    test('should validate basic frequency logic without precise timing', () => {
      // Create tickets with different frequencies
      const dailyTicketId = ticketService.createTicket({
        title: 'Daily Ticket',
        frequency: 1,
        can_draw_monday: true,
        can_draw_tuesday: true,
      });

      const weeklyTicketId = ticketService.createTicket({
        title: 'Weekly Ticket',
        frequency: 7,
        can_draw_monday: true,
        can_draw_tuesday: true,
      });

      // Both should initially be eligible
      expect(
        ticketService.isTicketEligibleForDay(dailyTicketId, 'monday')
      ).toBe(true);
      expect(
        ticketService.isTicketEligibleForDay(weeklyTicketId, 'monday')
      ).toBe(true);

      // Complete both tickets
      ticketService.createSingleTicketDraw(dailyTicketId, { done: true });
      ticketService.createSingleTicketDraw(weeklyTicketId, { done: true });

      // Both should be ineligible immediately after completion
      expect(
        ticketService.isTicketEligibleForDay(dailyTicketId, 'tuesday')
      ).toBe(false);
      expect(
        ticketService.isTicketEligibleForDay(weeklyTicketId, 'tuesday')
      ).toBe(false);
    });

    test('should prioritize must-draw over can-draw tickets in selection', () => {
      // Create a must-draw ticket
      const mustDrawId = ticketService.createTicket({
        title: 'Must Draw Monday',
        frequency: 7,
        must_draw_monday: true,
        can_draw_monday: true,
      });

      // Create several can-draw tickets
      const canDrawIds: string[] = [];
      for (let i = 0; i < 10; i++) {
        const id = ticketService.createTicket({
          title: `Can Draw ${i}`,
          frequency: 7,
          can_draw_monday: true,
          must_draw_monday: false,
        });
        canDrawIds.push(id);
      }

      // Select tickets for Monday
      const selectedTickets = ticketService.selectTicketsForDraw(
        'monday',
        new Set()
      );

      // Must-draw ticket should be included
      expect(selectedTickets.some((t) => t.id === mustDrawId)).toBe(true);

      // Should have selected multiple tickets total
      expect(selectedTickets.length).toBeGreaterThan(1);
    });

    test('should handle multiple frequency scenarios', () => {
      // Create tickets with various frequencies
      const frequencies = [1, 2, 3, 7, 14];
      const ticketIds = frequencies.map((freq) =>
        ticketService.createTicket({
          title: `Frequency ${freq} Ticket`,
          frequency: freq,
          can_draw_monday: true,
        })
      );

      // All should initially be eligible
      ticketIds.forEach((id) => {
        expect(ticketService.isTicketEligibleForDay(id, 'monday')).toBe(true);
      });

      // Complete all tickets
      ticketIds.forEach((id) => {
        ticketService.createSingleTicketDraw(id, { done: true });
      });

      // All should be ineligible after completion
      ticketIds.forEach((id) => {
        expect(ticketService.isTicketEligibleForDay(id, 'monday')).toBe(false);
      });

      // Check that draw history is created for each
      ticketIds.forEach((id) => {
        const history = ticketService.getTicketDrawHistory(id);
        expect(history).toHaveLength(1);
        expect(history[0]?.done).toBe(true);
      });
    });

    test('should exclude tickets with no draws allowed for specified day', () => {
      // Create a ticket that can't draw on Tuesday
      const ticketId = ticketService.createTicket({
        title: 'Monday Only Ticket',
        frequency: 7,
        can_draw_monday: true,
        can_draw_tuesday: false, // Not allowed on Tuesday
      });

      // Should be eligible on Monday
      expect(ticketService.isTicketEligibleForDay(ticketId, 'monday')).toBe(
        true
      );

      // Should NOT be eligible on Tuesday
      expect(ticketService.isTicketEligibleForDay(ticketId, 'tuesday')).toBe(
        false
      );

      // Verify it doesn't appear in Tuesday's selection
      const tuesdayTickets = ticketService.selectTicketsForDraw(
        'tuesday',
        new Set()
      );
      expect(tuesdayTickets.some((t) => t.id === ticketId)).toBe(false);
    });

    test('should demonstrate TimeProvider integration for basic frequency', () => {
      // Create a daily frequency ticket
      const ticketId = ticketService.createTicket({
        title: 'TimeProvider Integration Test',
        frequency: 7, // Use weekly to make it clearer
        can_draw_monday: true,
        can_draw_tuesday: true,
      });

      // Set time to Monday 8:00 AM
      mockTimeProvider.setMockTime(new Date('2025-05-12T14:00:00.000Z'));

      // Should be eligible initially
      expect(ticketService.isTicketEligibleForDay(ticketId, 'monday')).toBe(
        true
      );

      // Create a completed draw at the current time
      const drawId = ticketService.createSingleTicketDraw(ticketId, {
        done: true,
      });
      expect(typeof drawId).toBe('string');

      // Should not be eligible immediately after completion (within 7-day frequency)
      expect(ticketService.isTicketEligibleForDay(ticketId, 'monday')).toBe(
        false
      );

      // Advance time by 8 days (beyond 7-day frequency)
      mockTimeProvider.setMockTime(new Date('2025-05-20T15:00:00.000Z'));
      expect(ticketService.isTicketEligibleForDay(ticketId, 'tuesday')).toBe(
        true
      );

      // Verify draw history shows our mocked timestamps
      const history = ticketService.getTicketDrawHistory(ticketId);
      expect(history).toHaveLength(1);
      expect(history[0]?.created_at).toContain('2025-05-12'); // Should contain the mocked date
    });

    // NOTE: With TimeProvider injection, we've significantly improved testability!
    // - Unit tests can now control time precisely for business logic validation
    // - Integration tests still handle complex SQL julianday() scenarios reliably
    // - Both levels now provide comprehensive coverage with clear separation of concerns
  });

  describe('Migrated from Integration Tests', () => {
    // These tests were moved from frequency.test.ts since TimeProvider makes them
    // suitable for unit testing without complex database setup

    test('should exclude tickets recently completed within frequency period', () => {
      // Set time to May 1st
      mockTimeProvider.setMockTime(new Date('2025-05-01T14:00:00.000Z'));

      const ticketId = ticketService.createTicket({
        title: 'Weekly Frequency Test',
        frequency: 7,
        can_draw_monday: true,
      });

      // Create a completed draw at current time
      ticketService.createSingleTicketDraw(ticketId, { done: true });

      // Advance time by 2 days (within 7-day frequency)
      mockTimeProvider.setMockTime(new Date('2025-05-03T14:00:00.000Z'));

      // Should not be eligible since it was completed within frequency period
      expect(ticketService.isTicketEligibleForDay(ticketId, 'monday')).toBe(
        false
      );
    });

    test('should include tickets with skipped draws (not completed)', () => {
      // Set time to May 1st
      mockTimeProvider.setMockTime(new Date('2025-05-01T14:00:00.000Z'));

      const ticketId = ticketService.createTicket({
        title: 'Skipped Draw Test',
        frequency: 7,
        can_draw_monday: true,
      });

      // Create a skipped draw (not completed)
      ticketService.createSingleTicketDraw(ticketId, {
        done: false,
        skipped: true,
      });

      // Advance time by 2 days (within frequency period)
      mockTimeProvider.setMockTime(new Date('2025-05-03T14:00:00.000Z'));

      // Should be eligible since it was only skipped, not completed
      expect(ticketService.isTicketEligibleForDay(ticketId, 'monday')).toBe(
        true
      );
    });

    test('should include tickets completed outside frequency period', () => {
      // Set time to May 1st
      mockTimeProvider.setMockTime(new Date('2025-05-01T14:00:00.000Z'));

      const ticketId = ticketService.createTicket({
        title: 'Outside Frequency Test',
        frequency: 7,
        can_draw_monday: true,
      });

      // Create a completed draw
      ticketService.createSingleTicketDraw(ticketId, { done: true });

      // Advance time by 8 days (outside 7-day frequency)
      mockTimeProvider.setMockTime(new Date('2025-05-09T14:00:00.000Z'));

      // Should be eligible since frequency period has passed
      expect(ticketService.isTicketEligibleForDay(ticketId, 'monday')).toBe(
        true
      );
    });

    test('should handle daily frequency correctly (completed yesterday)', () => {
      // Set time to May 8th
      mockTimeProvider.setMockTime(new Date('2025-05-08T14:00:00.000Z'));

      const ticketId = ticketService.createTicket({
        title: 'Daily Frequency Test',
        frequency: 1,
        can_draw_monday: true,
      });

      // Create a completed draw yesterday
      ticketService.createSingleTicketDraw(ticketId, { done: true });

      // Advance time to today (1 day later)
      mockTimeProvider.setMockTime(new Date('2025-05-09T14:00:00.000Z'));

      // Should NOT be eligible (within 1-day frequency)
      expect(ticketService.isTicketEligibleForDay(ticketId, 'monday')).toBe(
        false
      );
    });

    test('should handle daily frequency correctly (completed 2 days ago)', () => {
      // Set time to May 7th
      mockTimeProvider.setMockTime(new Date('2025-05-07T14:00:00.000Z'));

      const ticketId = ticketService.createTicket({
        title: 'Daily Frequency Past Test',
        frequency: 1,
        can_draw_monday: true,
      });

      // Create a completed draw 2 days ago
      ticketService.createSingleTicketDraw(ticketId, { done: true });

      // Advance time to today (2 days later, beyond 1-day frequency)
      mockTimeProvider.setMockTime(new Date('2025-05-09T14:00:00.000Z'));

      // Should be eligible since frequency period has passed
      expect(ticketService.isTicketEligibleForDay(ticketId, 'monday')).toBe(
        true
      );
    });
  });

  describe('Dynamic Draw Count Calculation', () => {
    // These tests were migrated from frequency.test.ts integration tests
    // Now they can run faster at unit test level with precise time control

    test('should return 5 when no historical data exists', () => {
      // No draws exist in fresh database, should default to 5
      const drawCount = ticketService.calculateDailyDrawCount();
      expect(drawCount).toBe(5);
    });

    test('should return 5 when completion rate is 0%', () => {
      // Set time to create draws "3 days ago"
      mockTimeProvider.setMockTime(new Date('2025-05-09T14:00:00.000Z')); // 3 days ago from test baseline

      // Create 7 draws but none completed
      for (let i = 0; i < 7; i++) {
        const ticketId = ticketService.createTicket({
          title: `Incomplete Ticket ${i}`,
          frequency: 7,
          can_draw_monday: true,
        });
        ticketService.createSingleTicketDraw(ticketId, { done: false });
      }

      // Advance to "today"
      mockTimeProvider.setMockTime(new Date('2025-05-12T14:00:00.000Z'));

      const drawCount = ticketService.calculateDailyDrawCount();
      expect(drawCount).toBe(5); // 0% completion rate = minimum count
    });

    test('should return 10 when completion rate is 100%', () => {
      // Set time to create draws "3 days ago"
      mockTimeProvider.setMockTime(new Date('2025-05-09T14:00:00.000Z'));

      // Create 7 draws all completed
      for (let i = 0; i < 7; i++) {
        const ticketId = ticketService.createTicket({
          title: `Completed Ticket ${i}`,
          frequency: 7,
          can_draw_monday: true,
        });
        ticketService.createSingleTicketDraw(ticketId, { done: true });
      }

      // Advance to "today"
      mockTimeProvider.setMockTime(new Date('2025-05-12T14:00:00.000Z'));

      const drawCount = ticketService.calculateDailyDrawCount();
      expect(drawCount).toBe(10); // 100% completion rate = maximum count
    });

    test('should return 8 when 4 out of 7 tickets were completed (57% rate)', () => {
      // Set time to create draws "3 days ago"
      mockTimeProvider.setMockTime(new Date('2025-05-09T14:00:00.000Z'));

      // Create 4 completed draws
      for (let i = 0; i < 4; i++) {
        const ticketId = ticketService.createTicket({
          title: `Completed Ticket ${i}`,
          frequency: 7,
          can_draw_monday: true,
        });
        ticketService.createSingleTicketDraw(ticketId, { done: true });
      }

      // Create 3 incomplete draws
      for (let i = 0; i < 3; i++) {
        const ticketId = ticketService.createTicket({
          title: `Incomplete Ticket ${i}`,
          frequency: 7,
          can_draw_monday: true,
        });
        ticketService.createSingleTicketDraw(ticketId, { done: false });
      }

      // Advance to "today"
      mockTimeProvider.setMockTime(new Date('2025-05-12T14:00:00.000Z'));

      const drawCount = ticketService.calculateDailyDrawCount();
      expect(drawCount).toBe(8); // 4/7 ≈ 0.57, so 5 + (0.57 * 5) ≈ 8
    });

    test('should return 6 for 20% completion rate (1 out of 5 completed)', () => {
      // Set time to create draws "3 days ago"
      mockTimeProvider.setMockTime(new Date('2025-05-09T14:00:00.000Z'));

      // Create 1 completed draw
      const completedTicketId = ticketService.createTicket({
        title: 'Completed Ticket',
        frequency: 7,
        can_draw_monday: true,
      });
      ticketService.createSingleTicketDraw(completedTicketId, { done: true });

      // Create 4 incomplete draws
      for (let i = 0; i < 4; i++) {
        const ticketId = ticketService.createTicket({
          title: `Incomplete Ticket ${i}`,
          frequency: 7,
          can_draw_monday: true,
        });
        ticketService.createSingleTicketDraw(ticketId, { done: false });
      }

      // Advance to "today"
      mockTimeProvider.setMockTime(new Date('2025-05-12T14:00:00.000Z'));

      const drawCount = ticketService.calculateDailyDrawCount();
      expect(drawCount).toBe(6); // 1/5 = 20% completion rate = 5 + (0.2 * 5) = 6
    });

    test('should validate completion rate formula with 100% rate example', () => {
      // This test demonstrates the user hypothesis from the original integration test
      // If 5 tickets drawn and 5 completed = 100% rate = 10 tickets next day (not 6)

      // Set time to create draws "3 days ago"
      mockTimeProvider.setMockTime(new Date('2025-05-09T14:00:00.000Z'));

      // Create exactly 5 completed draws
      for (let i = 0; i < 5; i++) {
        const ticketId = ticketService.createTicket({
          title: `Perfect Completion ${i}`,
          frequency: 7,
          can_draw_monday: true,
        });
        ticketService.createSingleTicketDraw(ticketId, { done: true });
      }

      // Advance to "today"
      mockTimeProvider.setMockTime(new Date('2025-05-12T14:00:00.000Z'));

      const drawCount = ticketService.calculateDailyDrawCount();
      expect(drawCount).toBe(10); // 5/5 = 100% completion rate = maximum count
    });

    test('should use time provider for date calculations', () => {
      // Test that the calculation respects TimeProvider's current time

      // Create some draws at a specific time
      mockTimeProvider.setMockTime(new Date('2025-05-01T14:00:00.000Z'));

      const ticketId = ticketService.createTicket({
        title: 'Time Sensitive Test',
        frequency: 7,
        can_draw_monday: true,
      });
      ticketService.createSingleTicketDraw(ticketId, { done: true });

      // Advance to within the 7-day window
      mockTimeProvider.setMockTime(new Date('2025-05-06T14:00:00.000Z')); // 5 days later

      let drawCount = ticketService.calculateDailyDrawCount();
      expect(drawCount).toBe(10); // Should include the draw (within 7 days)

      // Advance to beyond the 7-day window
      mockTimeProvider.setMockTime(new Date('2025-05-09T14:00:00.000Z')); // 8 days later

      drawCount = ticketService.calculateDailyDrawCount();
      expect(drawCount).toBe(5); // Should exclude the draw (beyond 7 days), default to 5
    });
  });
  describe('Draw Creation and Management', () => {
    test('should create draws with different completion states', () => {
      const ticketId = ticketService.createTicket({
        title: 'Draw Management Test',
        frequency: 7,
        can_draw_monday: true,
      });

      // Test creating incomplete draw
      const incompleteDrawId = ticketService.createSingleTicketDraw(ticketId, {
        done: false,
        skipped: false,
      });
      expect(typeof incompleteDrawId).toBe('string');

      // Test creating completed draw
      const completedDrawId = ticketService.createSingleTicketDraw(ticketId, {
        done: true,
        skipped: false,
      });
      expect(typeof completedDrawId).toBe('string');
      expect(completedDrawId).not.toBe(incompleteDrawId);

      // Test creating skipped draw
      const skippedDrawId = ticketService.createSingleTicketDraw(ticketId, {
        done: false,
        skipped: true,
      });
      expect(typeof skippedDrawId).toBe('string');

      // Verify all draws exist in history
      const history = ticketService.getTicketDrawHistory(ticketId);
      expect(history).toHaveLength(3);

      // Verify different states
      const states = history.map((d) => ({ done: d.done, skipped: d.skipped }));
      expect(states).toContainEqual({ done: false, skipped: false });
      expect(states).toContainEqual({ done: true, skipped: false });
      expect(states).toContainEqual({ done: false, skipped: true });
    });

    test('should handle draw history ordering and count', () => {
      const ticketId = ticketService.createTicket({
        title: 'History Order Test',
        frequency: 7,
        can_draw_monday: true,
      });

      // Create multiple draws with different completion states
      const drawIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const drawId = ticketService.createSingleTicketDraw(ticketId, {
          done: i % 2 === 0, // Alternate between done and not done
        });
        drawIds.push(drawId);
      }

      // Get history (should be ordered by created_at DESC)
      const history = ticketService.getTicketDrawHistory(ticketId);
      expect(history).toHaveLength(5);

      // Verify all draws are accounted for (order may vary due to same timestamps)
      const historyIds = history.map((d) => d.id);
      drawIds.forEach((id) => {
        expect(historyIds).toContain(id);
      });

      // Verify the completion states are correct
      const completedCount = history.filter((d) => d.done).length;
      const incompleteCount = history.filter((d) => !d.done).length;
      expect(completedCount).toBe(3); // indices 0, 2, 4
      expect(incompleteCount).toBe(2); // indices 1, 3

      // Verify ticket_id is consistent
      history.forEach((draw) => {
        expect(draw.ticket_id).toBe(ticketId);
      });
    });

    test('should validate empty draw history for new tickets', () => {
      const ticketId = ticketService.createTicket({
        title: 'No Draws Yet',
        frequency: 7,
        can_draw_monday: true,
      });

      const history = ticketService.getTicketDrawHistory(ticketId);
      expect(history).toHaveLength(0);
      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('Service Architecture Validation', () => {
    test('should demonstrate successful dependency injection pattern', () => {
      // This test validates that the service layer architecture works correctly

      // Create a ticket using the service
      const ticketId = ticketService.createTicket({
        title: 'Dependency Injection Test',
        recurring: false,
        frequency: 7,
        can_draw_monday: true,
      });

      // Retrieve using the same service instance
      const retrieved = ticketService.getTicketById(ticketId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.title).toBe('Dependency Injection Test');

      // Update using the service
      const updated = ticketService.updateTicket(ticketId, {
        title: 'Updated via Service',
      });

      expect(updated?.title).toBe('Updated via Service');

      // Verify the update persisted in the database
      const verification = ticketService.getTicketById(ticketId);
      expect(verification?.title).toBe('Updated via Service');

      // Clean up
      const deleted = ticketService.deleteTicket(ticketId);
      expect(deleted).toBe(true);

      // Verify deletion worked
      const shouldBeNull = ticketService.getTicketById(ticketId);
      expect(shouldBeNull).toBeNull();
    });

    test('should handle multiple service instances with different databases', () => {
      // Create second service with its own database
      const db2 = createTestDatabase();
      const ticketService2 = new TicketService(db2);

      try {
        // Create ticket in first service
        const ticketData1: CreateTicketData = {
          title: 'Service 1 Ticket',
          recurring: false,
          frequency: 7,
          can_draw_monday: true,
        };
        const id1 = ticketService.createTicket(ticketData1);

        // Create ticket in second service
        const ticketData2: CreateTicketData = {
          title: 'Service 2 Ticket',
          recurring: true,
          frequency: 1,
          can_draw_tuesday: true,
        };
        const id2 = ticketService2.createTicket(ticketData2);

        // Verify isolation - each service only sees its own tickets
        const tickets1 = ticketService.getAllTickets();
        const tickets2 = ticketService2.getAllTickets();

        expect(tickets1).toHaveLength(1);
        expect(tickets2).toHaveLength(1);
        expect(tickets1[0]?.title).toBe('Service 1 Ticket');
        expect(tickets2[0]?.title).toBe('Service 2 Ticket');

        // Cross-service queries should return null
        expect(ticketService.getTicketById(id2)).toBeNull();
        expect(ticketService2.getTicketById(id1)).toBeNull();
      } finally {
        db2.close();
      }
    });
  });

  describe('Ticket Lifecycle and Business Logic Integration', () => {
    // These tests combine multiple TicketService methods to test realistic scenarios
    // They're more complex than basic unit tests but simpler than full integration tests

    test('should handle complete ticket lifecycle with draws and updates', () => {
      // Create a ticket
      const ticketId = ticketService.createTicket({
        title: 'Lifecycle Test Ticket',
        frequency: 3,
        can_draw_monday: true,
        can_draw_wednesday: true,
        can_draw_friday: true,
      });

      // Verify initial state
      const ticket = ticketService.getTicketById(ticketId);
      expect(ticket?.title).toBe('Lifecycle Test Ticket');
      expect(ticket?.frequency).toBe(3);

      // Should be eligible initially
      expect(ticketService.isTicketEligibleForDay(ticketId, 'monday')).toBe(
        true
      );

      // Draw history should be empty
      let drawHistory = ticketService.getTicketDrawHistory(ticketId);
      expect(drawHistory).toHaveLength(0);

      // Create a draw
      const drawId1 = ticketService.createSingleTicketDraw(ticketId, {
        done: false,
      });
      expect(typeof drawId1).toBe('string');

      // History should show one draw
      drawHistory = ticketService.getTicketDrawHistory(ticketId);
      expect(drawHistory).toHaveLength(1);
      expect(drawHistory[0]?.done).toBe(false);
      expect(drawHistory[0]?.ticket_id).toBe(ticketId);

      // Complete another draw
      ticketService.createSingleTicketDraw(ticketId, { done: true });

      // Should not be eligible immediately after completion
      expect(ticketService.isTicketEligibleForDay(ticketId, 'monday')).toBe(
        false
      );

      // History should show two draws
      drawHistory = ticketService.getTicketDrawHistory(ticketId);
      expect(drawHistory).toHaveLength(2);
      expect(drawHistory.some((d) => d.done === true)).toBe(true);
      expect(drawHistory.some((d) => d.done === false)).toBe(true);

      // Update the ticket
      const updatedTicket = ticketService.updateTicket(ticketId, {
        title: 'Updated Lifecycle Test',
        frequency: 1,
        can_draw_tuesday: true,
      });

      expect(updatedTicket?.title).toBe('Updated Lifecycle Test');
      expect(updatedTicket?.frequency).toBe(1);
      expect(updatedTicket?.can_draw_tuesday).toBe(true);

      // Draw history should persist through updates
      drawHistory = ticketService.getTicketDrawHistory(ticketId);
      expect(drawHistory).toHaveLength(2);

      // Clean up
      expect(ticketService.deleteTicket(ticketId)).toBe(true);
      expect(ticketService.getTicketById(ticketId)).toBeNull();
    });

    test('should handle multiple tickets with different day restrictions', () => {
      // Create tickets for different days
      const mondayOnlyId = ticketService.createTicket({
        title: 'Monday Only',
        frequency: 7,
        can_draw_monday: true,
        can_draw_tuesday: false,
        can_draw_wednesday: false,
      });

      const weekdayId = ticketService.createTicket({
        title: 'Weekdays Only',
        frequency: 1,
        can_draw_monday: true,
        can_draw_tuesday: true,
        can_draw_wednesday: true,
        can_draw_thursday: true,
        can_draw_friday: true,
        can_draw_saturday: false,
        can_draw_sunday: false,
      });

      const everyDayId = ticketService.createTicket({
        title: 'Every Day',
        frequency: 1,
        can_draw_monday: true,
        can_draw_tuesday: true,
        can_draw_wednesday: true,
        can_draw_thursday: true,
        can_draw_friday: true,
        can_draw_saturday: true,
        can_draw_sunday: true,
      });

      // Test Monday eligibility
      expect(ticketService.isTicketEligibleForDay(mondayOnlyId, 'monday')).toBe(
        true
      );
      expect(ticketService.isTicketEligibleForDay(weekdayId, 'monday')).toBe(
        true
      );
      expect(ticketService.isTicketEligibleForDay(everyDayId, 'monday')).toBe(
        true
      );

      // Test Tuesday eligibility
      expect(
        ticketService.isTicketEligibleForDay(mondayOnlyId, 'tuesday')
      ).toBe(false);
      expect(ticketService.isTicketEligibleForDay(weekdayId, 'tuesday')).toBe(
        true
      );
      expect(ticketService.isTicketEligibleForDay(everyDayId, 'tuesday')).toBe(
        true
      );

      // Test Saturday eligibility
      expect(
        ticketService.isTicketEligibleForDay(mondayOnlyId, 'saturday')
      ).toBe(false);
      expect(ticketService.isTicketEligibleForDay(weekdayId, 'saturday')).toBe(
        false
      );
      expect(ticketService.isTicketEligibleForDay(everyDayId, 'saturday')).toBe(
        true
      );

      // Test selection for different days
      const mondayTickets = ticketService.selectTicketsForDraw(
        'monday',
        new Set()
      );
      expect(mondayTickets).toHaveLength(3); // All three should be eligible

      const tuesdayTickets = ticketService.selectTicketsForDraw(
        'tuesday',
        new Set()
      );
      expect(tuesdayTickets).toHaveLength(2); // weekday and everyday tickets

      const saturdayTickets = ticketService.selectTicketsForDraw(
        'saturday',
        new Set()
      );
      expect(saturdayTickets).toHaveLength(1); // only everyday ticket
    });

    test('should handle frequency constraints across multiple tickets', () => {
      // Set initial time
      mockTimeProvider.setMockTime(new Date('2025-05-12T14:00:00.000Z')); // Monday

      // Create tickets with different frequencies
      const dailyId = ticketService.createTicket({
        title: 'Daily Ticket',
        frequency: 1,
        can_draw_monday: true,
        can_draw_tuesday: true,
      });

      const weeklyId = ticketService.createTicket({
        title: 'Weekly Ticket',
        frequency: 7,
        can_draw_monday: true,
        can_draw_tuesday: true,
      });

      // Both should be eligible initially
      expect(ticketService.isTicketEligibleForDay(dailyId, 'monday')).toBe(
        true
      );
      expect(ticketService.isTicketEligibleForDay(weeklyId, 'monday')).toBe(
        true
      );

      // Complete both
      ticketService.createSingleTicketDraw(dailyId, { done: true });
      ticketService.createSingleTicketDraw(weeklyId, { done: true });

      // Both should be ineligible immediately after
      expect(ticketService.isTicketEligibleForDay(dailyId, 'monday')).toBe(
        false
      );
      expect(ticketService.isTicketEligibleForDay(weeklyId, 'monday')).toBe(
        false
      );

      // Advance by 2 days (beyond daily frequency but within weekly)
      mockTimeProvider.setMockTime(new Date('2025-05-14T14:00:00.000Z')); // Wednesday

      // Daily should be eligible again, weekly should not
      expect(ticketService.isTicketEligibleForDay(dailyId, 'tuesday')).toBe(
        true
      );
      expect(ticketService.isTicketEligibleForDay(weeklyId, 'tuesday')).toBe(
        false
      );

      // Advance by 8 days total (beyond weekly frequency)
      mockTimeProvider.setMockTime(new Date('2025-05-20T14:00:00.000Z')); // Next Tuesday

      // Both should be eligible again
      expect(ticketService.isTicketEligibleForDay(dailyId, 'tuesday')).toBe(
        true
      );
      expect(ticketService.isTicketEligibleForDay(weeklyId, 'tuesday')).toBe(
        true
      );
    });

    test('should handle priority-based selection with mixed ticket types', () => {
      // Create tickets with different priority levels
      const mustDrawMondayId = ticketService.createTicket({
        title: 'Must Draw Monday',
        frequency: 7,
        must_draw_monday: true,
        can_draw_monday: true,
      });

      const canDrawMondayId = ticketService.createTicket({
        title: 'Can Draw Monday',
        frequency: 7,
        can_draw_monday: true,
        must_draw_monday: false,
      });

      const anotherCanDrawId = ticketService.createTicket({
        title: 'Another Can Draw',
        frequency: 7,
        can_draw_monday: true,
      });

      // Select tickets for Monday
      const selectedTickets = ticketService.selectTicketsForDraw(
        'monday',
        new Set()
      );

      // All should be selected (no limits in unit test scenario)
      expect(selectedTickets).toHaveLength(3);

      // Must-draw should be first in selection due to priority
      const ticketIds = selectedTickets.map((t) => t.id);
      expect(ticketIds[0]).toBe(mustDrawMondayId);

      // Can-draw tickets should follow
      expect(ticketIds).toContain(canDrawMondayId);
      expect(ticketIds).toContain(anotherCanDrawId);
    });

    test('should maintain data consistency across service operations', () => {
      // Create a ticket
      const ticketId = ticketService.createTicket({
        title: 'Consistency Test',
        frequency: 5,
        can_draw_monday: true,
      });

      // Verify in getAllTickets
      let allTickets = ticketService.getAllTickets();
      expect(allTickets.some((t) => t.id === ticketId)).toBe(true);

      // Create several draws
      for (let i = 0; i < 3; i++) {
        ticketService.createSingleTicketDraw(ticketId, {
          done: i % 2 === 0,
          skipped: i % 2 === 1,
        });
      }

      // Verify draw count
      const drawHistory = ticketService.getTicketDrawHistory(ticketId);
      expect(drawHistory).toHaveLength(3);

      // Verify draw state distribution
      const completedDraws = drawHistory.filter((d) => d.done);
      const skippedDraws = drawHistory.filter((d) => d.skipped);
      expect(completedDraws).toHaveLength(2); // indices 0, 2
      expect(skippedDraws).toHaveLength(1); // index 1

      // Update the ticket
      const updated = ticketService.updateTicket(ticketId, {
        title: 'Updated Consistency Test',
        frequency: 3,
      });

      expect(updated?.title).toBe('Updated Consistency Test');
      expect(updated?.frequency).toBe(3);

      // Verify draws still exist after update
      const postUpdateDraws = ticketService.getTicketDrawHistory(ticketId);
      expect(postUpdateDraws).toHaveLength(3);

      // Verify still in getAllTickets with updated data
      allTickets = ticketService.getAllTickets();
      const updatedTicketInList = allTickets.find((t) => t.id === ticketId);
      expect(updatedTicketInList?.title).toBe('Updated Consistency Test');
      expect(updatedTicketInList?.frequency).toBe(3);
    });
  });

  describe('Edge Cases and Input Validation', () => {
    // Tests for boundary conditions and error scenarios

    test('should handle tickets with frequency of 1 (daily)', () => {
      const ticketId = ticketService.createTicket({
        title: 'Daily Edge Case',
        frequency: 1,
        can_draw_monday: true,
        can_draw_tuesday: true,
      });

      // Should be eligible initially
      expect(ticketService.isTicketEligibleForDay(ticketId, 'monday')).toBe(
        true
      );

      // Create a completed draw
      ticketService.createSingleTicketDraw(ticketId, { done: true });

      // Should not be eligible immediately
      expect(ticketService.isTicketEligibleForDay(ticketId, 'monday')).toBe(
        false
      );

      // Verify the draw was created
      const drawHistory = ticketService.getTicketDrawHistory(ticketId);
      expect(drawHistory).toHaveLength(1);
      expect(drawHistory[0]?.done).toBe(true);
    });

    test('should handle tickets with high frequency values', () => {
      const ticketId = ticketService.createTicket({
        title: 'High Frequency Test',
        frequency: 365, // Yearly frequency
        can_draw_monday: true,
      });

      // Should be eligible initially
      expect(ticketService.isTicketEligibleForDay(ticketId, 'monday')).toBe(
        true
      );

      // Create a completed draw
      ticketService.createSingleTicketDraw(ticketId, { done: true });

      // Should not be eligible for a long time
      expect(ticketService.isTicketEligibleForDay(ticketId, 'monday')).toBe(
        false
      );

      // Even after 30 days, should still not be eligible
      mockTimeProvider.setMockTime(new Date('2025-06-11T14:00:00.000Z')); // 30 days later
      expect(ticketService.isTicketEligibleForDay(ticketId, 'monday')).toBe(
        false
      );

      // After a full year, should be eligible
      mockTimeProvider.setMockTime(new Date('2026-05-13T14:00:00.000Z')); // Over 365 days later
      expect(ticketService.isTicketEligibleForDay(ticketId, 'monday')).toBe(
        true
      );
    });

    test('should handle tickets with no allowed draw days', () => {
      const ticketId = ticketService.createTicket({
        title: 'No Draw Days',
        frequency: 7,
        can_draw_monday: false,
        can_draw_tuesday: false,
        can_draw_wednesday: false,
        can_draw_thursday: false,
        can_draw_friday: false,
        can_draw_saturday: false,
        can_draw_sunday: false,
      });

      // Should not be eligible on any day
      const days = [
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday',
      ];
      days.forEach((day) => {
        expect(ticketService.isTicketEligibleForDay(ticketId, day)).toBe(false);
      });

      // Should not appear in any selection
      days.forEach((day) => {
        const selectedTickets = ticketService.selectTicketsForDraw(
          day,
          new Set()
        );
        expect(selectedTickets.some((t) => t.id === ticketId)).toBe(false);
      });
    });

    test('should handle tickets with all must-draw days', () => {
      const ticketId = ticketService.createTicket({
        title: 'Must Draw Every Day',
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

      // Should be eligible (must-draw) on all days initially
      const days = [
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday',
      ];
      days.forEach((day) => {
        expect(ticketService.isTicketEligibleForDay(ticketId, day)).toBe(true);
      });

      // Create a completed draw
      ticketService.createSingleTicketDraw(ticketId, { done: true });

      // Should not be eligible on any day immediately after completion
      days.forEach((day) => {
        expect(ticketService.isTicketEligibleForDay(ticketId, day)).toBe(false);
      });
    });

    test('should handle mixed skipped and completed draws correctly', () => {
      const ticketId = ticketService.createTicket({
        title: 'Mixed Draw States',
        frequency: 7,
        can_draw_monday: true,
      });

      // Create multiple draws with different states
      ticketService.createSingleTicketDraw(ticketId, {
        done: false,
        skipped: true,
      });
      ticketService.createSingleTicketDraw(ticketId, {
        done: false,
        skipped: false,
      });
      ticketService.createSingleTicketDraw(ticketId, {
        done: true,
        skipped: false,
      });

      // Verify draw history shows all states
      const history = ticketService.getTicketDrawHistory(ticketId);
      expect(history).toHaveLength(3);

      const states = history.map((d) => ({ done: d.done, skipped: d.skipped }));
      expect(states).toContainEqual({ done: false, skipped: true });
      expect(states).toContainEqual({ done: false, skipped: false });
      expect(states).toContainEqual({ done: true, skipped: false });

      // Should not be eligible due to the completed draw
      expect(ticketService.isTicketEligibleForDay(ticketId, 'monday')).toBe(
        false
      );
    });

    test('should handle empty existingTicketIds set', () => {
      const ticketId = ticketService.createTicket({
        title: 'Empty Existing Set Test',
        frequency: 7,
        can_draw_monday: true,
      });

      // Empty set should allow ticket to be selected
      const selectedTickets = ticketService.selectTicketsForDraw(
        'monday',
        new Set()
      );
      expect(selectedTickets.some((t) => t.id === ticketId)).toBe(true);
    });

    test('should handle large existingTicketIds set', () => {
      // Create a few tickets
      const ticketIds: string[] = [];
      for (let i = 0; i < 3; i++) {
        const id = ticketService.createTicket({
          title: `Existing Ticket ${i}`,
          frequency: 7,
          can_draw_monday: true,
        });
        ticketIds.push(id);
      }

      // Create one more ticket not in existing set
      const newTicketId = ticketService.createTicket({
        title: 'New Ticket',
        frequency: 7,
        can_draw_monday: true,
      });

      // Pass some tickets as "existing" (already drawn)
      const existingSet = new Set(ticketIds);
      const selectedTickets = ticketService.selectTicketsForDraw(
        'monday',
        existingSet
      );

      // Should select the new ticket since it's not in the existing set
      expect(selectedTickets.some((t) => t.id === newTicketId)).toBe(true);

      // Should not include any tickets from the existing set
      selectedTickets.forEach((ticket) => {
        expect(existingSet.has(ticket.id)).toBe(false);
      });
    });

    test('should handle timezone edge cases with TimeProvider', () => {
      // Test different times of day to ensure consistent behavior
      const times = [
        '2025-05-12T06:00:00.000Z', // Midnight Central Time
        '2025-05-12T12:00:00.000Z', // 6 AM Central
        '2025-05-12T18:00:00.000Z', // Noon Central
        '2025-05-12T23:59:59.000Z', // Late evening Central
      ];

      times.forEach((timeString) => {
        mockTimeProvider.setMockTime(new Date(timeString));

        const dayString = ticketService.getTodayDayString();
        expect(dayString).toBe('monday'); // Should all be Monday in Central Time

        const ticketId = ticketService.createTicket({
          title: `Timezone Test ${timeString}`,
          frequency: 1,
          can_draw_monday: true,
        });

        expect(ticketService.isTicketEligibleForDay(ticketId, 'monday')).toBe(
          true
        );
      });
    });

    test('should handle concurrent draw creation scenarios', () => {
      const ticketId = ticketService.createTicket({
        title: 'Concurrent Draw Test',
        frequency: 7,
        can_draw_monday: true,
      });

      // Simulate rapid draw creation (like concurrent requests)
      const drawIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const drawId = ticketService.createSingleTicketDraw(ticketId, {
          done: i % 2 === 0,
          skipped: i % 3 === 0,
        });
        drawIds.push(drawId);
        expect(typeof drawId).toBe('string');
      }

      // All draws should be unique
      const uniqueDrawIds = new Set(drawIds);
      expect(uniqueDrawIds.size).toBe(5);

      // History should show all draws
      const history = ticketService.getTicketDrawHistory(ticketId);
      expect(history).toHaveLength(5);

      // All draws should have the same ticket_id
      history.forEach((draw) => {
        expect(draw.ticket_id).toBe(ticketId);
      });
    });
  });
});
