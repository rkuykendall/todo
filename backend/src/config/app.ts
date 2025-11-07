import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { basicAuth } from '../middleware/auth.ts';
import { requestLogger } from '../middleware/logging.ts';

export function createApp(): express.Application {
  const app = express();

  // Basic middleware
  app.use(
    cors({
      origin: process.env.FRONTEND_URL || [
        'http://localhost:3000', // Create React App default
        'http://localhost:5173', // Vite default
        'http://localhost:4173', // Vite preview
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );
  app.use(
    express.json({
      verify: (_req, _res, buf) => {
        try {
          JSON.parse(buf.toString());
        } catch {
          // Need to throw an error to stop the request processing
          // We can't properly respond here due to Express typing limitations
          throw new Error('Invalid JSON in request body');
        }
      },
    })
  );

  // Configure rate limiting
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minute window
    limit: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: 'draft-7', // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: { error: 'Too many requests, please try again later.' },
  });

  // Apply middleware
  app.use(apiLimiter);
  app.use(requestLogger);
  app.use(basicAuth);

  return app;
}
