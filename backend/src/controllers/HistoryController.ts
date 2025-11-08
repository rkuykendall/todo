import type { Request, Response } from 'express';
import type { TicketService } from '../services/TicketService.ts';

export class HistoryController {
  private ticketService: TicketService;

  constructor(ticketService: TicketService) {
    this.ticketService = ticketService;
  }

  /**
   * Get daily completion history
   * GET /history/daily
   */
  getDailyHistory = async (_req: Request, res: Response) => {
    const history = this.ticketService.getDailyHistory();
    res.json({
      data: history,
      timestamp: new Date().toISOString(),
      status: 'success' as const,
    });
  };
}
