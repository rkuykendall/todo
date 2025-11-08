// Enhanced type definitions with discriminated unions and better type safety

import type { Day } from './index.js';

// Status types with discriminated unions
export type TicketStatus =
  | { type: 'active'; done: null }
  | { type: 'completed'; done: string }; // ISO date string

// API Response types
export interface ApiResponse<T> {
  data: T;
  timestamp: string;
  status: 'success';
}

export interface ApiErrorResponse {
  error: string;
  message?: string;
  details?: unknown;
  timestamp: string;
  path: string;
  method: string;
  status: 'error';
}

// Enhanced Ticket interface with better typing
export interface TicketWithStatus
  extends Omit<import('./index.js').Ticket, 'done'> {
  status: TicketStatus;
}

// Ticket Draw with simple boolean flags
export interface TicketDraw {
  id: string;
  created_at: string;
  ticket_id: string;
  done: boolean;
  skipped: boolean;
}

// Day configuration types
export type DayConfig = {
  readonly [K in Day as `can_draw_${K}`]: boolean;
} & {
  readonly [K in Day as `must_draw_${K}`]: boolean;
};

// Frequency configuration
export type FrequencyType = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface FrequencyConfig {
  type: FrequencyType;
  value: number;
  displayName: string;
}

export const FREQUENCY_PRESETS: readonly FrequencyConfig[] = [
  { type: 'daily', value: 1, displayName: 'Daily' },
  { type: 'weekly', value: 7, displayName: 'Weekly' },
  { type: 'monthly', value: 30, displayName: 'Monthly' },
] as const;

// Form input types with better validation
export interface TicketFormData {
  title: string;
  recurring: boolean;
  deadline?: Date | null;
  frequency: number;
  dayConfig: Partial<DayConfig>;
}

// API operation types
export type ApiOperation<TInput = unknown, TOutput = unknown> = {
  input: TInput;
  output: TOutput;
};

// CRUD operation types for tickets
export type TicketOperations = {
  create: ApiOperation<
    Omit<import('./index.js').Ticket, 'id' | 'created_at'>,
    { id: string }
  >;
  read: ApiOperation<{ id: string }, import('./index.js').Ticket>;
  update: ApiOperation<
    { id: string; data: Partial<import('./index.js').Ticket> },
    import('./index.js').Ticket
  >;
  delete: ApiOperation<{ id: string }, { deleted: boolean }>;
  list: ApiOperation<void, import('./index.js').Ticket[]>;
};

// Ticket Draw operations
export type TicketDrawOperations = {
  create: ApiOperation<void, TicketDraw[]>;
  update: ApiOperation<
    { id: string; done?: boolean; skipped?: boolean },
    TicketDraw
  >;
  list: ApiOperation<void, TicketDraw[]>;
  clear: ApiOperation<void, { deleted: number }>;
};

// History data types
export interface DailyHistory {
  date: string; // ISO date string (YYYY-MM-DD)
  totalDraws: number;
  completedDraws: number;
  skippedDraws: number;
}

// Type guards for runtime type checking
export function isTicketCompleted(
  ticket: import('./index.js').Ticket
): ticket is import('./index.js').Ticket & { done: string } {
  return ticket.done !== null;
}

export function isTicketActive(
  ticket: import('./index.js').Ticket
): ticket is import('./index.js').Ticket & { done: null } {
  return ticket.done === null;
}

// Utility type for extracting API response data
export type ExtractApiData<T> = T extends ApiResponse<infer U> ? U : never;

// Utility type for creating partial updates
export type PartialUpdate<T> = {
  [P in keyof T]?: T[P] | null;
};

// Better error handling types
export interface ValidationErrorDetails {
  field: string;
  message: string;
  code: string;
}

export interface FormError {
  field: string;
  messages: string[];
}

export type FormErrors = FormError[];

// State management types for Redux
export interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

export interface EntityState<T> extends LoadingState {
  items: T[];
  selectedId?: string | null;
}

export interface TicketState extends EntityState<import('./index.js').Ticket> {
  filters: {
    status: 'all' | 'active' | 'completed' | 'recurring';
    search?: string;
  };
}

export interface DrawState extends EntityState<TicketDraw> {
  createLoading: boolean;
  sortBy: 'status' | 'created_at';
}

// Component prop types for better reusability
export interface TicketCardProps {
  ticket: import('./index.js').Ticket;
  onEdit?: (ticket: import('./index.js').Ticket) => void;
  onDelete?: (id: string) => void;
  onToggleStatus?: (id: string) => void;
  showActions?: boolean;
  compact?: boolean;
}

export interface DrawCardProps {
  draw: TicketDraw;
  ticket?: import('./index.js').Ticket;
  onMarkDone?: (id: string) => void;
  onMarkSkipped?: (id: string) => void;
  onUndo?: (id: string) => void;
  index?: number;
}

// Form handling types
export type FormSubmitHandler<T> = (data: T) => Promise<void> | void;
export type FormValidationHandler<T> = (data: T) => FormErrors | null;

// HTTP client types
export interface HttpClientConfig {
  baseURL: string;
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
}

export interface RequestConfig extends Omit<RequestInit, 'body'> {
  params?: Record<string, string>;
  timeout?: number;
}

// Database operation result types
export interface DatabaseResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  rowsAffected?: number;
}

// Time provider interface for dependency injection
export interface TimeProvider {
  getCurrentTimestamp(): string;
  getTodayDate(): string;
  getTodayDayString(): Day;
}

// Configuration types
export interface AppConfig {
  api: {
    baseURL: string;
    timeout: number;
  };
  auth: {
    tokenKey: string;
    sessionTimeout?: number;
  };
  ui: {
    theme: 'light' | 'dark' | 'auto';
    animations: boolean;
  };
}
