import type { Request, Response, NextFunction } from 'express';
import { NewTicketSchema, UpdateTicketSchema } from '@todo/shared';
import type { TicketService } from '../services/TicketService.ts';
import { ValidationError, NotFoundError } from '../middleware/validation.ts';

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

export class TicketController {
  private ticketService: TicketService;

  constructor(ticketService: TicketService) {
    this.ticketService = ticketService;
  }

  getTickets: AsyncRequestHandler = async (_req, res, next) => {
    try {
      const tickets = this.ticketService.getAllTickets();
      res.json(tickets);
    } catch (error) {
      next(error);
    }
  };

  getTicketById: AsyncRequestHandler = async (req, res, next) => {
    try {
      const id = req.params.id;
      if (!id || Array.isArray(id)) {
        throw new ValidationError('ID parameter is required');
      }

      const ticket = this.ticketService.getTicketById(id);
      if (!ticket) {
        throw new NotFoundError('Ticket not found');
      }
      res.json(ticket);
    } catch (error) {
      next(error);
    }
  };

  createTicket: AsyncRequestHandler = async (req, res, next) => {
    try {
      const result = NewTicketSchema.safeParse(req.body);
      if (!result.success) {
        throw new ValidationError(
          'Invalid ticket data',
          result.error.flatten()
        );
      }

      const id = this.ticketService.createTicket(result.data);
      res.status(201).json({ id });
    } catch (error) {
      next(error);
    }
  };

  updateTicket: AsyncRequestHandler = async (req, res, next) => {
    try {
      const id = req.params.id;
      if (!id || Array.isArray(id)) {
        throw new ValidationError('ID parameter is required');
      }

      const result = UpdateTicketSchema.safeParse(req.body);
      if (!result.success) {
        throw new ValidationError(
          'Invalid ticket data',
          result.error.flatten()
        );
      }

      const updated = this.ticketService.updateTicket(id, result.data);
      if (!updated) {
        throw new NotFoundError('Ticket not found');
      }

      res.json(updated);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'No valid fields to update'
      ) {
        next(new ValidationError(error.message));
        return;
      }
      next(error);
    }
  };

  deleteTicket: AsyncRequestHandler = async (req, res, next) => {
    try {
      const id = req.params.id;
      if (!id || Array.isArray(id)) {
        throw new ValidationError('ID parameter is required');
      }

      const deleted = this.ticketService.deleteTicket(id);
      if (!deleted) {
        throw new NotFoundError('Ticket not found');
      }
      res.json({ deleted: true });
    } catch (error) {
      next(error);
    }
  };
}
