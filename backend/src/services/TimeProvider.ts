/**
 * Time Provider Interface
 *
 * Provides time-related functionality that can be injected into services
 * to make them more testable and allow for time mocking.
 */

export interface TimeProvider {
  /**
   * Get the current date in YYYY-MM-DD format for Central Time
   */
  getTodayDate(): string;

  /**
   * Get the current timestamp in Central Time format (YYYY-MM-DD HH:mm:ss)
   */
  getCurrentTimestamp(): string;

  /**
   * Get today's day name in lowercase (e.g., "monday", "tuesday")
   */
  getTodayDayString(): string;
}

/**
 * Production time provider that uses actual system time
 */
export class SystemTimeProvider implements TimeProvider {
  getTodayDate(): string {
    const now = new Date();

    try {
      // Use Intl.DateTimeFormat for reliable timezone conversion
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Chicago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });

      return formatter.format(now);
    } catch {
      // Fallback to manual Central Time calculation
      const centralOffset = now.getTimezoneOffset() + 6 * 60; // Assume CST (UTC-6)
      const centralTime = new Date(now.getTime() - centralOffset * 60000);

      const year = centralTime.getFullYear();
      const month = String(centralTime.getMonth() + 1).padStart(2, '0');
      const day = String(centralTime.getDate()).padStart(2, '0');

      return `${year}-${month}-${day}`;
    }
  }

  getCurrentTimestamp(): string {
    const now = new Date();

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

  getTodayDayString(): string {
    return new Date()
      .toLocaleString('en-US', {
        weekday: 'long',
        timeZone: 'America/Chicago',
      })
      .toLowerCase();
  }
}

/**
 * Mock time provider for testing that uses a fixed time
 */
export class MockTimeProvider implements TimeProvider {
  private mockTime: Date;

  constructor(mockTime: Date) {
    this.mockTime = mockTime;
  }

  setMockTime(mockTime: Date): void {
    this.mockTime = mockTime;
  }

  getTodayDate(): string {
    const now = this.mockTime;

    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Chicago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });

      return formatter.format(now);
    } catch {
      // Fallback to manual Central Time calculation
      const centralOffset = now.getTimezoneOffset() + 6 * 60; // Assume CST (UTC-6)
      const centralTime = new Date(now.getTime() - centralOffset * 60000);

      const year = centralTime.getFullYear();
      const month = String(centralTime.getMonth() + 1).padStart(2, '0');
      const day = String(centralTime.getDate()).padStart(2, '0');

      return `${year}-${month}-${day}`;
    }
  }

  getCurrentTimestamp(): string {
    const now = this.mockTime;

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

  getTodayDayString(): string {
    return this.mockTime
      .toLocaleString('en-US', {
        weekday: 'long',
        timeZone: 'America/Chicago',
      })
      .toLowerCase();
  }
}
