import type { Server } from 'http';
import type { Application } from 'express';

export function setupGracefulShutdown(server: Server) {
  // Graceful shutdown handling
  const shutdown = (signal: string) => {
    console.log(`${signal} signal received: closing HTTP server`);
    server.close(() => {
      console.log('HTTP server closed');
      // Close database connection if needed
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Uncaught exception handler
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    server.close(() => {
      console.log('HTTP server closed due to uncaught exception');
      process.exit(1);
    });
  });
}

export function startServer(
  app: Application,
  port: number | string = 4000
): Server {
  const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });

  setupGracefulShutdown(server);
  return server;
}
