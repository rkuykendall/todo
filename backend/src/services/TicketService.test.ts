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
      // Set time to May 8th (Thursday)
      mockTimeProvider.setMockTime(new Date('2025-05-08T14:00:00.000Z'));

      const ticketId = ticketService.createTicket({
        title: 'Daily Frequency Test',
        frequency: 1,
        can_draw_thursday: true,
        can_draw_friday: true,
      });

      // Create a completed draw yesterday (Thursday)
      ticketService.createSingleTicketDraw(ticketId, { done: true });

      // Advance time to today (Friday, 1 day later)
      mockTimeProvider.setMockTime(new Date('2025-05-09T14:00:00.000Z'));

      // Should be eligible because it's a different calendar day
      // With our fix, daily tickets are eligible on different calendar days
      expect(ticketService.isTicketEligibleForDay(ticketId, 'friday')).toBe(
        true
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
    // Tests for new recursive target-based system where targets adjust +1/-1 based on previous day performance

    test('should return 5 when no historical data exists', () => {
      // No draw history exists in fresh database, should default to 5
      const drawCount = ticketService.calculateDailyDrawCount();
      expect(drawCount).toBe(5);
    });

    test('should increase by 1 when previous day target was met', () => {
      // Create tickets for testing
      const tickets: string[] = [];
      for (let i = 0; i < 5; i++) {
        tickets.push(
          ticketService.createTicket({
            title: `Test Ticket ${i}`,
            frequency: 7,
            can_draw_monday: true,
          })
        );
      }

      // Set time to yesterday and create draws that meet the default target (5)
      mockTimeProvider.setMockTime(new Date('2025-05-11T14:00:00.000Z'));

      // Create 5 completed draws (meets the default target of 5)
      for (const ticketId of tickets) {
        ticketService.createSingleTicketDraw(ticketId, { done: true });
      }

      // Advance to "today"
      mockTimeProvider.setMockTime(new Date('2025-05-12T14:00:00.000Z'));

      const drawCount = ticketService.calculateDailyDrawCount();
      expect(drawCount).toBe(6); // Previous target (5) + 1 because target was met
    });

    test('should decrease by 1 when previous day target was missed', () => {
      // Create tickets for testing
      const tickets: string[] = [];
      for (let i = 0; i < 3; i++) {
        tickets.push(
          ticketService.createTicket({
            title: `Test Ticket ${i}`,
            frequency: 7,
            can_draw_monday: true,
          })
        );
      }

      // Set time to yesterday and create draws that miss the target
      mockTimeProvider.setMockTime(new Date('2025-05-11T14:00:00.000Z'));

      // Create only 3 completed draws (misses the default target of 5)
      for (const ticketId of tickets) {
        ticketService.createSingleTicketDraw(ticketId, { done: true });
      }

      // Advance to "today"
      mockTimeProvider.setMockTime(new Date('2025-05-12T14:00:00.000Z'));

      const drawCount = ticketService.calculateDailyDrawCount();
      expect(drawCount).toBe(5); // Previous target (5) - 1 = 4, but minimum is 5
    });

    test('should respect minimum bound of 5', () => {
      // Create a scenario where the recursive calculation would go below 5
      // We need to create a chain of missed targets that would try to go below 5

      // Create tickets
      const tickets: string[] = [];
      for (let i = 0; i < 2; i++) {
        tickets.push(
          ticketService.createTicket({
            title: `Test Ticket ${i}`,
            frequency: 7,
            can_draw_monday: true,
          })
        );
      }

      // Set time to 2 days ago and create missed draws
      mockTimeProvider.setMockTime(new Date('2025-05-10T14:00:00.000Z'));
      for (const ticketId of tickets) {
        ticketService.createSingleTicketDraw(ticketId, { done: true }); // Only 2 completed, misses target of 5
      }

      // Move to yesterday and create more missed draws
      mockTimeProvider.setMockTime(new Date('2025-05-11T14:00:00.000Z'));
      for (const ticketId of tickets) {
        ticketService.createSingleTicketDraw(ticketId, { done: true }); // Only 2 completed, would try to go from 4 to 3
      }

      // Advance to "today"
      mockTimeProvider.setMockTime(new Date('2025-05-12T14:00:00.000Z'));

      const drawCount = ticketService.calculateDailyDrawCount();
      expect(drawCount).toBe(5); // Cannot go below minimum of 5
    });

    test('should respect maximum bound of 10', () => {
      // Create a scenario where we build up to the maximum
      // We'll need to create a series of days where targets are consistently met

      // Create many tickets to ensure we can meet large targets
      const tickets: string[] = [];
      for (let i = 0; i < 12; i++) {
        tickets.push(
          ticketService.createTicket({
            title: `Test Ticket ${i}`,
            frequency: 7,
            can_draw_monday: true,
          })
        );
      }

      let currentTarget = 5;

      // Build up target over several days by consistently meeting targets
      for (let daysBack = 6; daysBack >= 1; daysBack--) {
        const date = new Date('2025-05-12T14:00:00.000Z');
        date.setDate(date.getDate() - daysBack);
        mockTimeProvider.setMockTime(date);

        // Create enough completed draws to meet the current target
        for (let i = 0; i < Math.min(currentTarget, tickets.length); i++) {
          ticketService.createSingleTicketDraw(tickets[i]!, { done: true });
        }

        // Target increases each day, but caps at 10
        currentTarget = Math.min(currentTarget + 1, 10);
      }

      // Advance to "today"
      mockTimeProvider.setMockTime(new Date('2025-05-12T14:00:00.000Z'));

      const drawCount = ticketService.calculateDailyDrawCount();
      expect(drawCount).toBe(10); // Should hit the maximum of 10
    });

    test('should look back up to 7 days for most recent draw data', () => {
      // Create tickets
      const tickets: string[] = [];
      for (let i = 0; i < 5; i++) {
        tickets.push(
          ticketService.createTicket({
            title: `Test Ticket ${i}`,
            frequency: 7,
            can_draw_monday: true,
          })
        );
      }

      // Set time to 3 days ago and create draws that meet target
      mockTimeProvider.setMockTime(new Date('2025-05-09T14:00:00.000Z')); // 3 days ago

      for (const ticketId of tickets) {
        ticketService.createSingleTicketDraw(ticketId, { done: true }); // 5 completed, meets target
      }

      // Advance to today (skipping 2 days with no draws)
      mockTimeProvider.setMockTime(new Date('2025-05-12T14:00:00.000Z'));

      const drawCount = ticketService.calculateDailyDrawCount();
      expect(drawCount).toBe(6); // Found data from 3 days ago: 5 + 1 = 6
    });

    test('should return default when no draw data within 7 days', () => {
      // Create tickets and draws 8 days ago (beyond lookback window)
      const tickets: string[] = [];
      for (let i = 0; i < 10; i++) {
        tickets.push(
          ticketService.createTicket({
            title: `Test Ticket ${i}`,
            frequency: 7,
            can_draw_monday: true,
          })
        );
      }

      // Set time to 8 days ago
      mockTimeProvider.setMockTime(new Date('2025-05-04T14:00:00.000Z')); // 8 days ago

      for (const ticketId of tickets) {
        ticketService.createSingleTicketDraw(ticketId, { done: true });
      }

      // Advance to today
      mockTimeProvider.setMockTime(new Date('2025-05-12T14:00:00.000Z'));

      const drawCount = ticketService.calculateDailyDrawCount();
      expect(drawCount).toBe(5); // No recent data within 7 days, use default
    });

    test('should find most recent draw data when multiple days exist', () => {
      // Create tickets
      const tickets: string[] = [];
      for (let i = 0; i < 8; i++) {
        tickets.push(
          ticketService.createTicket({
            title: `Test Ticket ${i}`,
            frequency: 7,
            can_draw_monday: true,
          })
        );
      }

      // Create draws 3 days ago (5 completed, meets target of 5)
      mockTimeProvider.setMockTime(new Date('2025-05-09T14:00:00.000Z'));
      for (let i = 0; i < 5; i++) {
        ticketService.createSingleTicketDraw(tickets[i]!, { done: true });
      }

      // Create draws 2 days ago (3 completed, misses target of 6) - more recent
      mockTimeProvider.setMockTime(new Date('2025-05-10T14:00:00.000Z'));
      for (let i = 0; i < 3; i++) {
        ticketService.createSingleTicketDraw(tickets[i]!, { done: true });
      }

      // Advance to today
      mockTimeProvider.setMockTime(new Date('2025-05-12T14:00:00.000Z'));

      const drawCount = ticketService.calculateDailyDrawCount();
      expect(drawCount).toBe(5); // Uses most recent (2 days ago): target was 6, missed, so 6-1=5
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

  describe('Daily Must-Draw Ticket Issue Investigation', () => {
    test('should replicate Take Pill daily must-draw issue - ticket only drawing every other day', () => {
      // This test replicates the reported issue where a daily must-draw ticket
      // "Take Pill" is only drawing every other day instead of daily

      // Create a daily must-draw ticket like "Take Pill"
      const takePillTicketId = ticketService.createTicket({
        title: 'Take Pill',
        frequency: 1, // Daily frequency
        must_draw_monday: true,
        must_draw_tuesday: true,
        must_draw_wednesday: true,
        must_draw_thursday: true,
        must_draw_friday: true,
        must_draw_saturday: true,
        must_draw_sunday: true,
        can_draw_monday: true,
        can_draw_tuesday: true,
        can_draw_wednesday: true,
        can_draw_thursday: true,
        can_draw_friday: true,
        can_draw_saturday: true,
        can_draw_sunday: true,
      });

      // Start on Monday morning
      mockTimeProvider.setMockTime(new Date('2025-05-12T14:00:00.000Z')); // Monday 8 AM Central

      // Day 1 (Monday): Should be eligible initially
      expect(
        ticketService.isTicketEligibleForDay(takePillTicketId, 'monday')
      ).toBe(true);

      // Complete the draw on Monday
      ticketService.createSingleTicketDraw(takePillTicketId, { done: true });

      // Still Monday (later): Should NOT be eligible (same day)
      expect(
        ticketService.isTicketEligibleForDay(takePillTicketId, 'monday')
      ).toBe(false);

      // Day 2 (Tuesday): Should be eligible again since it's a new day
      mockTimeProvider.setMockTime(new Date('2025-05-13T14:00:00.000Z')); // Tuesday 8 AM Central
      expect(
        ticketService.isTicketEligibleForDay(takePillTicketId, 'tuesday')
      ).toBe(true);

      // Complete the draw on Tuesday
      ticketService.createSingleTicketDraw(takePillTicketId, { done: true });

      // Day 3 (Wednesday): Should be eligible again
      mockTimeProvider.setMockTime(new Date('2025-05-14T14:00:00.000Z')); // Wednesday 8 AM Central
      expect(
        ticketService.isTicketEligibleForDay(takePillTicketId, 'wednesday')
      ).toBe(true);

      // Complete the draw on Wednesday
      ticketService.createSingleTicketDraw(takePillTicketId, { done: true });

      // Day 4 (Thursday): Should be eligible again
      mockTimeProvider.setMockTime(new Date('2025-05-15T14:00:00.000Z')); // Thursday 8 AM Central
      expect(
        ticketService.isTicketEligibleForDay(takePillTicketId, 'thursday')
      ).toBe(true);

      // Verify draw history shows consecutive daily completions
      const drawHistory = ticketService.getTicketDrawHistory(takePillTicketId);
      expect(drawHistory).toHaveLength(3); // Monday, Tuesday, Wednesday

      // All draws should be completed
      drawHistory.forEach((draw) => {
        expect(draw.done).toBe(true);
      });
    });

    test('should test edge case timing that might cause skip - same time different days', () => {
      // Test if the issue is related to exact timing within the day
      const takePillTicketId = ticketService.createTicket({
        title: 'Take Pill - Timing Test',
        frequency: 1,
        must_draw_monday: true,
        must_draw_tuesday: true,
        must_draw_wednesday: true,
        can_draw_monday: true,
        can_draw_tuesday: true,
        can_draw_wednesday: true,
      });

      // Monday at exactly midnight (start of day)
      mockTimeProvider.setMockTime(new Date('2025-05-12T06:00:00.000Z')); // Monday midnight Central
      expect(
        ticketService.isTicketEligibleForDay(takePillTicketId, 'monday')
      ).toBe(true);

      // Complete at midnight
      ticketService.createSingleTicketDraw(takePillTicketId, { done: true });

      // Tuesday at exactly midnight (24 hours later)
      mockTimeProvider.setMockTime(new Date('2025-05-13T06:00:00.000Z')); // Tuesday midnight Central
      expect(
        ticketService.isTicketEligibleForDay(takePillTicketId, 'tuesday')
      ).toBe(true);

      // Complete at midnight
      ticketService.createSingleTicketDraw(takePillTicketId, { done: true });

      // Wednesday at exactly midnight (48 hours after original)
      mockTimeProvider.setMockTime(new Date('2025-05-14T06:00:00.000Z')); // Wednesday midnight Central
      expect(
        ticketService.isTicketEligibleForDay(takePillTicketId, 'wednesday')
      ).toBe(true);
    });

    test('should test problematic timing - 23 hour gap', () => {
      // This tests the potential issue where completing at different times of day
      // might cause the julian day calculation to prevent next-day eligibility
      const takePillTicketId = ticketService.createTicket({
        title: 'Take Pill - 23hr Gap Test',
        frequency: 1,
        must_draw_monday: true,
        must_draw_tuesday: true,
        can_draw_monday: true,
        can_draw_tuesday: true,
      });

      // Monday at 11 PM
      mockTimeProvider.setMockTime(new Date('2025-05-13T05:00:00.000Z')); // Monday 11 PM Central
      expect(
        ticketService.isTicketEligibleForDay(takePillTicketId, 'monday')
      ).toBe(true);

      // Complete late Monday night
      ticketService.createSingleTicketDraw(takePillTicketId, { done: true });

      // Tuesday morning (only ~7 hours later, but different day)
      mockTimeProvider.setMockTime(new Date('2025-05-13T12:00:00.000Z')); // Tuesday 6 AM Central

      // This should be eligible because it's a new day, even though less than 24 hours
      // If this fails, it suggests the julian day calculation is the problem
      expect(
        ticketService.isTicketEligibleForDay(takePillTicketId, 'tuesday')
      ).toBe(true);
    });

    test('should test 25 hour gap to confirm frequency works', () => {
      // This should definitely work since it's more than 24 hours
      const takePillTicketId = ticketService.createTicket({
        title: 'Take Pill - 25hr Test',
        frequency: 1,
        must_draw_monday: true,
        must_draw_tuesday: true,
        can_draw_monday: true,
        can_draw_tuesday: true,
      });

      // Monday at 8 AM
      mockTimeProvider.setMockTime(new Date('2025-05-12T14:00:00.000Z')); // Monday 8 AM Central
      expect(
        ticketService.isTicketEligibleForDay(takePillTicketId, 'monday')
      ).toBe(true);

      ticketService.createSingleTicketDraw(takePillTicketId, { done: true });

      // Tuesday at 9 AM (25 hours later)
      mockTimeProvider.setMockTime(new Date('2025-05-13T15:00:00.000Z')); // Tuesday 9 AM Central
      expect(
        ticketService.isTicketEligibleForDay(takePillTicketId, 'tuesday')
      ).toBe(true);
    });

    test('should demonstrate the julian day calculation bug', () => {
      // This test explicitly shows the bug in the julian day calculation
      const takePillTicketId = ticketService.createTicket({
        title: 'Julian Day Bug Demo',
        frequency: 1,
        must_draw_monday: true,
        must_draw_tuesday: true,
        can_draw_monday: true,
        can_draw_tuesday: true,
      });

      // Monday at exactly 8:00 AM
      mockTimeProvider.setMockTime(new Date('2025-05-12T14:00:00.000Z')); // Monday 8 AM Central
      ticketService.createSingleTicketDraw(takePillTicketId, { done: true });

      // Tuesday at exactly 8:00 AM (exactly 24 hours later)
      mockTimeProvider.setMockTime(new Date('2025-05-13T14:00:00.000Z')); // Tuesday 8 AM Central

      // With the fix, this should now work because we check calendar dates for all frequencies
      // instead of using julian day time differences
      expect(
        ticketService.isTicketEligibleForDay(takePillTicketId, 'tuesday')
      ).toBe(true);
    });

    test('should use calendar date logic consistently for all frequencies', () => {
      // Test that weekly and daily tickets both use calendar date logic consistently
      const weeklyTicketId = ticketService.createTicket({
        title: 'Weekly Consistency Test',
        frequency: 7,
        must_draw_monday: true,
        must_draw_tuesday: true,
        can_draw_monday: true,
        can_draw_tuesday: true,
      });

      const dailyTicketId = ticketService.createTicket({
        title: 'Daily Consistency Test',
        frequency: 1,
        must_draw_monday: true,
        must_draw_tuesday: true,
        can_draw_monday: true,
        can_draw_tuesday: true,
      });

      // Monday morning - complete both tickets
      mockTimeProvider.setMockTime(new Date('2025-05-12T14:00:00.000Z')); // Monday 8 AM Central
      ticketService.createSingleTicketDraw(weeklyTicketId, { done: true });
      ticketService.createSingleTicketDraw(dailyTicketId, { done: true });

      // Tuesday morning - daily should be eligible, weekly should not
      mockTimeProvider.setMockTime(new Date('2025-05-13T14:00:00.000Z')); // Tuesday 8 AM Central
      expect(
        ticketService.isTicketEligibleForDay(dailyTicketId, 'tuesday')
      ).toBe(true);
      expect(
        ticketService.isTicketEligibleForDay(weeklyTicketId, 'tuesday')
      ).toBe(false);

      // Next Monday (7 calendar days later) - both should be eligible
      mockTimeProvider.setMockTime(new Date('2025-05-19T14:00:00.000Z')); // Next Monday 8 AM Central
      expect(
        ticketService.isTicketEligibleForDay(dailyTicketId, 'monday')
      ).toBe(true);
      expect(
        ticketService.isTicketEligibleForDay(weeklyTicketId, 'monday')
      ).toBe(true);
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

  describe('getDailyHistory', () => {
    test('should return empty array when no draws exist', () => {
      const history = ticketService.getDailyHistory();
      expect(history).toEqual([]);
    });

    test('should calculate daily stats correctly for a single day', () => {
      // Create tickets
      const ticket1Id = ticketService.createTicket({
        title: 'Test Ticket 1',
        frequency: 1,
        can_draw_monday: true,
      });
      const ticket2Id = ticketService.createTicket({
        title: 'Test Ticket 2',
        frequency: 1,
        can_draw_monday: true,
      });

      // Create draws for today - 2 completed, 1 skipped
      ticketService.createSingleTicketDraw(ticket1Id, { done: true });
      ticketService.createSingleTicketDraw(ticket2Id, { done: true });
      ticketService.createSingleTicketDraw(ticket1Id, { skipped: true });

      const history = ticketService.getDailyHistory();

      // Should have today's data (and potentially empty days within 30-day range)
      expect(history.length).toBeGreaterThanOrEqual(1);
      // Find today's entry
      const todayEntry = history.find((h) => h.date === '2025-05-12');
      expect(todayEntry).toBeDefined();
      expect(todayEntry).toMatchObject({
        date: '2025-05-12', // Mock time is Monday, May 12, 2025
        totalDraws: 3,
        completedDraws: 2,
        skippedDraws: 1,
      });
      expect(history[0]).toMatchObject({
        date: '2025-05-12', // Mock time is Monday, May 12, 2025
        totalDraws: 3,
        completedDraws: 2,
        skippedDraws: 1,
      });
    });

    test('should aggregate data correctly across multiple days', () => {
      // Create tickets
      const ticket1Id = ticketService.createTicket({
        title: 'Multi-day Test 1',
        frequency: 1,
        can_draw_monday: true,
        can_draw_tuesday: true,
      });
      const ticket2Id = ticketService.createTicket({
        title: 'Multi-day Test 2',
        frequency: 1,
        can_draw_monday: true,
        can_draw_tuesday: true,
      });

      // Day 1 (May 12): 2 completed, 0 skipped
      ticketService.createSingleTicketDraw(ticket1Id, {
        done: true,
        createdAt: '2025-05-12T14:00:00.000Z',
      });
      ticketService.createSingleTicketDraw(ticket2Id, {
        done: true,
        createdAt: '2025-05-12T15:00:00.000Z',
      });

      // Day 2 (May 13): 1 completed, 1 skipped
      ticketService.createSingleTicketDraw(ticket1Id, {
        done: true,
        createdAt: '2025-05-13T14:00:00.000Z',
      });
      ticketService.createSingleTicketDraw(ticket2Id, {
        skipped: true,
        createdAt: '2025-05-13T15:00:00.000Z',
      });

      // Day 3 (May 14): 0 completed, 2 skipped
      ticketService.createSingleTicketDraw(ticket1Id, {
        skipped: true,
        createdAt: '2025-05-14T14:00:00.000Z',
      });
      ticketService.createSingleTicketDraw(ticket2Id, {
        skipped: true,
        createdAt: '2025-05-14T15:00:00.000Z',
      });

      const history = ticketService.getDailyHistory();

      // Should have at least the 3 days we created data for
      expect(history.length).toBeGreaterThanOrEqual(3);

      // Find the specific days we care about
      const day14 = history.find((h) => h.date === '2025-05-14');
      const day13 = history.find((h) => h.date === '2025-05-13');

      expect(day14).toMatchObject({
        date: '2025-05-14',
        totalDraws: 2,
        completedDraws: 0,
        skippedDraws: 2,
      });

      expect(day13).toMatchObject({
        date: '2025-05-13',
        totalDraws: 2,
        completedDraws: 1,
        skippedDraws: 1,
      });

      const day12 = history.find((h) => h.date === '2025-05-12');
      expect(day12).toMatchObject({
        date: '2025-05-12',
        totalDraws: 2,
        completedDraws: 2,
        skippedDraws: 0,
      });
    });

    test('should handle edge case with no completions', () => {
      const ticketId = ticketService.createTicket({
        title: 'No Completions Test',
        frequency: 1,
        can_draw_monday: true,
      });

      // Create draws that are all skipped or incomplete
      ticketService.createSingleTicketDraw(ticketId, { skipped: true });
      ticketService.createSingleTicketDraw(ticketId, {
        done: false,
        skipped: false,
      });

      const history = ticketService.getDailyHistory();

      // Should have at least today's entry
      expect(history.length).toBeGreaterThanOrEqual(1);
      const todayEntry = history.find((h) => h.date === '2025-05-12');
      expect(todayEntry).toMatchObject({
        date: '2025-05-12',
        totalDraws: 2,
        completedDraws: 0,
        skippedDraws: 1, // Only one is explicitly skipped
      });
    });

    test('should handle edge case with all completions (golden day)', () => {
      const ticket1Id = ticketService.createTicket({
        title: 'Golden Day Test 1',
        frequency: 1,
        can_draw_monday: true,
      });
      const ticket2Id = ticketService.createTicket({
        title: 'Golden Day Test 2',
        frequency: 1,
        can_draw_monday: true,
      });

      // All draws completed
      ticketService.createSingleTicketDraw(ticket1Id, { done: true });
      ticketService.createSingleTicketDraw(ticket2Id, { done: true });

      const history = ticketService.getDailyHistory();

      // Should have at least today's entry
      expect(history.length).toBeGreaterThanOrEqual(1);
      const todayEntry = history.find((h) => h.date === '2025-05-12');
      expect(todayEntry).toMatchObject({
        date: '2025-05-12',
        totalDraws: 2,
        completedDraws: 2,
        skippedDraws: 0,
      });

      // This should be a "golden" day (100% completion)
      expect(history[0]?.completedDraws).toBe(history[0]?.totalDraws);
    });

    test('should filter by date range correctly using timezone-aware logic', () => {
      const ticketId = ticketService.createTicket({
        title: 'Timezone Test',
        frequency: 1,
        can_draw_monday: true,
      });

      // Create draws at different times but same local date
      const sameDayTimes = [
        '2025-05-12T06:00:00.000Z', // Midnight Central Time (day starts)
        '2025-05-12T14:00:00.000Z', // 8 AM Central Time
        '2025-05-12T23:59:59.000Z', // Late evening Central Time (day ends)
      ];

      sameDayTimes.forEach((time) => {
        ticketService.createSingleTicketDraw(ticketId, {
          done: true,
          createdAt: time,
        });
      });

      const history = ticketService.getDailyHistory();

      // Should have at least today's entry
      expect(history.length).toBeGreaterThanOrEqual(1);
      const todayEntry = history.find((h) => h.date === '2025-05-12');
      expect(todayEntry).toMatchObject({
        date: '2025-05-12',
        totalDraws: 3, // All should be grouped into same day
        completedDraws: 3,
        skippedDraws: 0,
      });
    });
  });
});
