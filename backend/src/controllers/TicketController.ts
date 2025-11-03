import type { Request, Response, NextFunction } from 'express';
import { NewTicketSchema, UpdateTicketSchema } from '../types/ticket.ts';
import type { TicketService } from '../services/TicketService.ts';

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
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'ID parameter is required' });
        return;
      }

      const ticket = this.ticketService.getTicketById(id);
      if (!ticket) {
        res.status(404).json({ error: 'Ticket not found' });
        return;
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
        res.status(400).json({ error: result.error.flatten() });
        return;
      }

      const id = this.ticketService.createTicket(result.data);
      res.status(201).json({ id });
    } catch (error) {
      next(error);
    }
  };

  updateTicket: AsyncRequestHandler = async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'ID parameter is required' });
        return;
      }

      const result = UpdateTicketSchema.safeParse(req.body);
      if (!result.success) {
        res.status(400).json({ error: result.error.flatten() });
        return;
      }

      const updated = this.ticketService.updateTicket(id, result.data);
      if (!updated) {
        res.status(404).json({ error: 'Ticket not found' });
        return;
      }

      res.json(updated);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'No valid fields to update'
      ) {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  };

  deleteTicket: AsyncRequestHandler = async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'ID parameter is required' });
        return;
      }

      const deleted = this.ticketService.deleteTicket(id);
      if (!deleted) {
        res.status(404).json({ error: 'Ticket not found' });
        return;
      }
      res.json({ deleted: true });
    } catch (error) {
      next(error);
    }
  };
}
