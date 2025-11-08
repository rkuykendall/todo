import type { Application } from 'express';
import { validateIdParam } from '../middleware/validation.ts';
import type { TicketController } from '../controllers/TicketController.ts';
import type { TicketDrawController } from '../controllers/TicketDrawController.ts';
import type { HealthController } from '../controllers/HealthController.ts';
import type { HistoryController } from '../controllers/HistoryController.ts';

export function setupRoutes(
  app: Application,
  ticketController: TicketController,
  ticketDrawController: TicketDrawController,
  healthController: HealthController,
  historyController: HistoryController
) {
  // Health check
  app.get('/health', healthController.checkHealth);

  // Ticket routes
  app.get('/tickets', ticketController.getTickets);
  app.get('/tickets/:id', validateIdParam, ticketController.getTicketById);
  app.post('/tickets', ticketController.createTicket);
  app.put('/tickets/:id', validateIdParam, ticketController.updateTicket);
  app.delete('/tickets/:id', validateIdParam, ticketController.deleteTicket);

  // Ticket draw routes
  app.get('/ticket_draw', ticketDrawController.getTicketDraw);
  app.post('/ticket_draw', ticketDrawController.createTicketDraw);
  app.patch(
    '/ticket_draw/:id',
    validateIdParam,
    ticketDrawController.updateTicketDraw
  );
  app.delete('/ticket_draw', ticketDrawController.deleteAllDraws);

  // History routes
  app.get('/history/daily', historyController.getDailyHistory);
}
