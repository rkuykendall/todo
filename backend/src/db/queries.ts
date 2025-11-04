/**
 * Database Queries
 *
 * Shared database query functions that can be used by both the main application
 * and test suites to ensure consistency in query logic.
 *
 * All queries use explicit timestamp parameters instead of SQLite's datetime('now')
 * functions, making them fully testable with TimeProvider dependency injection.
 */

/**
 * Get must-draw tickets based on day, frequency, and completion status
 *
 * This query finds tickets that:
 * - Must be drawn on the specified day
 * - Are not done
 * - Either have never been drawn or haven't been completed within their frequency period
 * - Optionally excludes tickets with deadlines today or in the past
 *
 * @param todayDay - The day of the week (e.g., "monday", "tuesday")
 * @param includeDeadlineFilter - Whether to exclude tickets with deadlines today or in the past
 * @returns SQL query string with two parameters: currentTimestamp, currentTimestamp
 */
export function getMustDrawQuery(
  todayDay: string,
  includeDeadlineFilter = true
): string {
  const deadlineClause = includeDeadlineFilter
    ? 'AND (t.deadline IS NULL OR date(t.deadline) > date(?))'
    : '';

  return `
    SELECT t.* FROM ticket t
    WHERE t.must_draw_${todayDay} = 1
    AND t.done IS NULL
    ${deadlineClause}
    AND (
      t.last_drawn IS NULL
      OR (
        -- Check if the ticket was successfully completed in a recent draw
        -- If not completed (only skipped), ignore frequency and allow it to be drawn again
        NOT EXISTS (
          SELECT 1 FROM ticket_draw td
          WHERE td.ticket_id = t.id
          AND td.done = 1
          AND julianday(?) - julianday(td.created_at) <= t.frequency
        )
      )
    )
    ORDER BY t.last_drawn ASC NULLS FIRST, RANDOM()
  `;
}

/**
 * Get can-draw tickets that are eligible for drawing
 *
 * @param todayDay - The day of the week (e.g., "monday", "tuesday")
 * @param includeDeadlineFilter - Whether to exclude tickets with deadlines within 7 days
 * @returns SQL query string with two parameters: currentTimestamp, currentTimestamp
 */
export function getCanDrawQuery(
  todayDay: string,
  includeDeadlineFilter = true
): string {
  const deadlineClause = includeDeadlineFilter
    ? 'AND (t.deadline is NULL OR julianday(t.deadline) - julianday(?) > 7)'
    : '';

  return `
    SELECT t.* FROM ticket t
    WHERE t.can_draw_${todayDay} = 1 
    AND t.must_draw_${todayDay} = 0
    AND t.done IS NULL
    ${deadlineClause}
    AND (
      t.last_drawn IS NULL
      OR (
        -- Check if the ticket was successfully completed in a recent draw
        NOT EXISTS (
          SELECT 1 FROM ticket_draw td
          WHERE td.ticket_id = t.id
          AND td.done = 1
          AND julianday(?) - julianday(td.created_at) <= t.frequency
        )
      )
    )
    ORDER BY t.last_drawn ASC NULLS FIRST, RANDOM()
  `;
}

/**
 * Get tickets with deadlines today or in the past
 *
 * @param todayDay - The day of the week (e.g., "monday", "tuesday")
 * @returns SQL query string with one parameter: currentTimestamp
 */
export function getDeadlineTicketsQuery(todayDay: string): string {
  return `
    SELECT * FROM ticket 
    WHERE can_draw_${todayDay} = 1
    AND done IS NULL
    AND deadline IS NOT NULL
    AND date(deadline) <= date(?)
    ORDER BY date(deadline) ASC, last_drawn ASC NULLS FIRST, RANDOM()
  `;
}

/**
 * Get tickets with approaching deadlines (within next 7 days)
 *
 * @param todayDay - The day of the week (e.g., "monday", "tuesday")
 * @returns SQL query string with three parameters: currentTimestamp, currentTimestamp, currentTimestamp
 */
export function getApproachingDeadlineQuery(todayDay: string): string {
  return `
    SELECT t.* FROM ticket t
    WHERE t.can_draw_${todayDay} = 1 
    AND t.must_draw_${todayDay} = 0
    AND t.done IS NULL
    AND t.deadline IS NOT NULL
    AND date(t.deadline) > date(?)
    AND julianday(t.deadline) - julianday(?) <= 7
    AND (
      t.last_drawn IS NULL
      OR (
        -- Check if the ticket was successfully completed in a recent draw
        NOT EXISTS (
          SELECT 1 FROM ticket_draw td
          WHERE td.ticket_id = t.id
          AND td.done = 1
          AND julianday(?) - julianday(td.created_at) <= t.frequency
        )
      )
    )
    ORDER BY date(t.deadline) ASC, t.last_drawn ASC NULLS FIRST, RANDOM()
  `;
}
