import type { Request, Response, NextFunction } from 'express';
import { PatchTicketDrawSchema } from '../types/ticket_draw.ts';
import type { TicketService } from '../services/TicketService.ts';

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
        res.status(400).json({ error: 'ID parameter is required' });
        return;
      }

      const parse = PatchTicketDrawSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: parse.error.flatten() });
        return;
      }

      const updates = parse.data;
      if (Object.keys(updates).length === 0) {
        res.status(400).json({ error: 'No valid fields to update.' });
        return;
      }

      const updated = this.ticketService.updateTicketDraw(id, updates);
      if (!updated) {
        res.status(404).json({ error: 'ticket_draw not found.' });
        return;
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
