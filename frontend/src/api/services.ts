import { apiClient } from './client';
import type {
  Ticket,
  TicketDraw,
  TicketOperations,
  TicketDrawOperations,
  NewTicketInput,
  UpdateTicketInput,
  UpdateTicketDrawInput,
} from '@todo/shared';

/**
 * Type-safe API service for ticket operations
 */
export class TicketApiService {
  /**
   * Fetch all tickets
   */
  async getAll(): Promise<TicketOperations['list']['output']> {
    return await apiClient.get<Ticket[]>('/tickets');
  }

  /**
   * Get a single ticket by ID
   */
  async getById(id: string): Promise<TicketOperations['read']['output']> {
    return await apiClient.get<Ticket>(`/tickets/${id}`);
  }

  /**
   * Create a new ticket
   */
  async create(
    data: NewTicketInput
  ): Promise<TicketOperations['create']['output']> {
    return await apiClient.post<{ id: string }>('/tickets', data);
  }

  /**
   * Update an existing ticket
   */
  async update(
    id: string,
    data: UpdateTicketInput
  ): Promise<TicketOperations['update']['output']> {
    await apiClient.put(`/tickets/${id}`, data);
    // Return the updated ticket
    return await this.getById(id);
  }

  /**
   * Delete a ticket
   */
  async delete(id: string): Promise<TicketOperations['delete']['output']> {
    await apiClient.delete(`/tickets/${id}`);
    return { deleted: true };
  }
}

/**
 * Type-safe API service for ticket draw operations
 */
export class TicketDrawApiService {
  /**
   * Fetch today's draws
   */
  async getTodays(): Promise<TicketDrawOperations['list']['output']> {
    return await apiClient.get<TicketDraw[]>('/ticket_draw');
  }

  /**
   * Create new draws for today
   */
  async createDraws(): Promise<TicketDrawOperations['create']['output']> {
    return await apiClient.post<TicketDraw[]>('/ticket_draw');
  }

  /**
   * Update a draw's status
   */
  async updateStatus(
    id: string,
    updates: UpdateTicketDrawInput
  ): Promise<TicketDrawOperations['update']['output']> {
    return await apiClient.patch<TicketDraw>(`/ticket_draw/${id}`, updates);
  }

  /**
   * Clear all draws
   */
  async clearAll(): Promise<TicketDrawOperations['clear']['output']> {
    return await apiClient.delete<{ deleted: number }>('/ticket_draw');
  }
}

// Create and export service instances
export const ticketApi = new TicketApiService();
export const ticketDrawApi = new TicketDrawApiService();
