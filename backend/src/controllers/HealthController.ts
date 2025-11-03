import type { Request, Response } from 'express';
import type { TicketService } from '../services/TicketService.ts';

export class HealthController {
  private ticketService: TicketService;

  constructor(ticketService: TicketService) {
    this.ticketService = ticketService;
  }

  checkHealth = async (_req: Request, res: Response) => {
    try {
      const healthStatus = this.ticketService.checkDatabaseHealth();
      res.json(healthStatus);
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(500).json({
        status: 'error',
        database: 'disconnected',
        message: 'Database connection failed',
      });
    }
  };
}
