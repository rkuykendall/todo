import db from './db/index.ts';
import { TicketService } from './services/TicketService.ts';
import { TicketController } from './controllers/TicketController.ts';
import { TicketDrawController } from './controllers/TicketDrawController.ts';
import { HealthController } from './controllers/HealthController.ts';
import { HistoryController } from './controllers/HistoryController.ts';
import { createApp } from './config/app.ts';
import { setupRoutes } from './routes/index.ts';
import { startServer } from './config/server.ts';

// Initialize services and controllers
const ticketService = new TicketService(db);
const ticketController = new TicketController(ticketService);
const ticketDrawController = new TicketDrawController(ticketService);
const healthController = new HealthController(ticketService);
const historyController = new HistoryController(ticketService);

// Create and configure Express app
const app = createApp();

// Setup routes
setupRoutes(
  app,
  ticketController,
  ticketDrawController,
  healthController,
  historyController
);

// Add error handler after routes (must be last middleware)
import { errorHandler } from './middleware/validation.ts';
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 4000;
startServer(app, PORT);
