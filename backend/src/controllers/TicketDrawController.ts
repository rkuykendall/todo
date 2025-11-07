import type { Request, Response, NextFunction } from 'express';
import { UpdateTicketDrawSchema } from '@todo/shared';
import type { TicketService } from '../services/TicketService.ts';
import { ValidationError, NotFoundError } from '../middleware/validation.ts';

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

export class TicketDrawController {
  private ticketService: TicketService;

  constructor(ticketService: TicketService) {
    this.ticketService = ticketService;
  }

  getTicketDraw: AsyncRequestHandler = async (_req, res, next) => {
    try {
      const draws = this.ticketService.getTodaysTicketDraws();
      res.json(draws);
    } catch (error) {
      next(error);
    }
  };

  createTicketDraw: AsyncRequestHandler = async (_req, res, next) => {
    try {
      const draws = this.ticketService.createTicketDraws();
      res.status(201).json(draws);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('Not enough eligible tickets')
      ) {
        res.status(400).json({
          error: error.message,
        });
        return;
      }
      next(error);
    }
  };

  updateTicketDraw: AsyncRequestHandler = async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!id) {
        throw new ValidationError('ID parameter is required');
      }

      const parse = UpdateTicketDrawSchema.safeParse(req.body);
      if (!parse.success) {
        throw new ValidationError(
          'Invalid ticket draw data',
          parse.error.flatten()
        );
      }

      const updates = parse.data;
      if (Object.keys(updates).length === 0) {
        throw new ValidationError('No valid fields to update');
      }

      const updated = this.ticketService.updateTicketDraw(id, updates);
      if (!updated) {
        throw new NotFoundError('Ticket draw not found');
      }

      res.json(updated);
    } catch (error) {
      next(error);
    }
  };

  deleteAllDraws: AsyncRequestHandler = async (_req, res, next) => {
    try {
      const count = this.ticketService.deleteAllTicketDraws();
      res.json({ deleted: true, count });
    } catch (error) {
      next(error);
    }
  };
}
